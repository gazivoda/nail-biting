// What happens when Paddle says a payment completed or was taken back (WS9).
//
//   transaction.completed
//     lifetime price  -> a lifetime grant for the user named in the checkout's customData (idempotent on
//                        the transaction id)
//     gift price      -> a gift code for the purchase, emailed to the buyer as a redeem link
//     any other price of ours (monthly, yearly) -> recorded, and offered to the referral program as a
//                        possible first payment. The subscription itself is still handled by the existing
//                        subscription.* handlers in server.js; nothing here touches it.
//   adjustment.created / adjustment.updated (refund or chargeback)
//     a full refund (once approved) or a chargeback of a transaction we recorded takes back what it paid
//     for: the lifetime grant, the gift code (and the recipient's days, if redeemed), the referral
//     credits it earned. Partial refunds are ignored (policy: docs/agents/legal/ws9-refund.md).
//
// Every effect is idempotent on its own (unique keys), so running a handler twice, or the webhook and
// the verify-transaction endpoint for the same payment, changes nothing the second time.
//
// A payment that cannot be matched to an account (no userId in customData, and no account with the
// payer's email) is recorded with user_id NULL and logged as an error, and acknowledged: retrying cannot
// fix it. The owner finds it in billing_transactions and grants it by hand (ws9-notes.md).

import { chargedMinorUnits, customUserId, isRecurring, paymentFingerprint, priceIdsOf } from './paddleData.js';

const iso = t => new Date(t).toISOString();

export function createPurchases({
  db, entitlements, gifts, referrals, config, getUser, findUserByEmail, sendEmail, buildGiftEmail,
  appUrl, fetchImpl = fetch, now = Date.now, log = console.log, logError = console.error,
}) {
  const record = db.prepare(`
    INSERT OR IGNORE INTO billing_transactions (txn_id, kind, user_id, customer_id, price_id, origin, payment_fingerprint, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const attachUser = db.prepare('UPDATE billing_transactions SET user_id = ? WHERE txn_id = ? AND user_id IS NULL');
  const selTxn = db.prepare('SELECT * FROM billing_transactions WHERE txn_id = ?');
  const markRefunded = db.prepare('UPDATE billing_transactions SET refunded_at = ? WHERE txn_id = ? AND refunded_at IS NULL');

  function kindOf(prices) {
    if (config.lifetimePriceId && prices.includes(config.lifetimePriceId)) return 'lifetime';
    if (config.giftPriceId && prices.includes(config.giftPriceId)) return 'gift';
    if (prices.some(p => config.ourPriceIds.has(p))) return 'subscription';
    return null;
  }

  async function paddleGet(path) {
    if (!config.paddleApiKey) throw new Error('PADDLE_API_KEY is not set');
    const res = await fetchImpl(`${config.paddleApi}${path}`, { headers: { Authorization: `Bearer ${config.paddleApiKey}` } });
    if (!res.ok) throw new Error(`Paddle ${path} answered ${res.status}`);
    return (await res.json()).data;
  }

  /** The payer's email, looked up with the API key (a webhook payload carries only the customer id). */
  async function payerEmail(customerId) {
    if (!customerId) return null;
    const customer = await paddleGet(`/customers/${encodeURIComponent(customerId)}`);
    return typeof customer?.email === 'string' ? customer.email : null;
  }

  async function resolveUser(data, { lookupByEmail }) {
    const id = customUserId(data);
    const byId = id ? getUser(id) : null;
    if (byId) return byId;
    if (!lookupByEmail) return null;
    try {
      const email = await payerEmail(data.customer_id);
      return email ? findUserByEmail(email) : null;
    } catch (err) {
      logError(`[billing] could not look up the payer of ${data.id}: ${err.message}`);
      return null;
    }
  }

  async function sendGift({ txnId, buyerEmail, buyerUserId }) {
    const issued = gifts.issueForTransaction({ txnId, buyerEmail, buyerUserId });
    if (issued.duplicate) return 'duplicate';
    if (!buyerEmail) throw new Error(`gift ${txnId}: no email address for the buyer`);
    const mail = buildGiftEmail({ appUrl, code: issued.code, days: issued.row.days, expiresAt: issued.row.expires_at });
    const result = await sendEmail({ to: buyerEmail, subject: mail.subject, html: mail.html, text: mail.text });
    // email.js reports a Resend rejection as a returned { error }, not a throw (known issue, not changed here).
    // A gift whose link never reached the buyer must stay retryable, so look at it.
    if (result && result.error) throw new Error(`gift email to the buyer was rejected: ${result.error.message ?? result.error.name ?? 'unknown error'}`);
    gifts.markEmailSent(txnId);
    return 'sent';
  }

  async function onTransactionCompleted(data) {
    const txnId = typeof data?.id === 'string' ? data.id : null;
    if (!txnId) return { handled: false, reason: 'no_id' };
    const prices = priceIdsOf(data);
    const kind = kindOf(prices);
    if (!kind) return { handled: false, reason: 'not_ours' };

    const user = await resolveUser(data, { lookupByEmail: kind === 'lifetime' });
    record.run(txnId, kind, user?.id ?? null, data.customer_id ?? null, prices.find(p => config.ourPriceIds.has(p)) ?? prices[0] ?? null,
      data.origin ?? null, paymentFingerprint(data), iso(now()));
    if (user) attachUser.run(user.id, txnId);

    if (kind === 'lifetime') {
      if (!user) {
        logError(`[billing] lifetime payment ${txnId} could not be matched to an account (customer ${data.customer_id ?? 'unknown'}); grant it by hand`);
        return { handled: true, kind, unmatched: true };
      }
      const fresh = entitlements.grantLifetime(user.id, `txn:${txnId}`);
      if (fresh) log(`[billing] lifetime granted to ${user.id} (${txnId})`);
    } else if (kind === 'gift') {
      let email = null;
      try { email = await payerEmail(data.customer_id); } catch (err) { logError(`[billing] gift ${txnId}: ${err.message}`); }
      email = email ?? user?.email ?? null;
      const outcome = await sendGift({ txnId, buyerEmail: email, buyerUserId: user?.id ?? null });
      log(`[billing] gift ${txnId}: email ${outcome}`);
    }

    if (kind !== 'gift' && user) {
      const out = referrals.onPayment({
        userId: user.id, txnId, customerId: data.customer_id ?? null, fingerprint: paymentFingerprint(data),
        recurring: isRecurring(data), chargedMinor: chargedMinorUnits(data),
      });
      if (out.status === 'rewarded') log(`[billing] referral rewarded for ${user.id} (${txnId})`);
    }
    return { handled: true, kind };
  }

  function onAdjustment(data) {
    const action = data?.action;
    const txnId = typeof data?.transaction_id === 'string' ? data.transaction_id : null;
    if (!txnId || (action !== 'refund' && action !== 'chargeback')) return { handled: false, reason: 'not_a_refund' };
    if (action === 'refund' && (data.status !== 'approved' || data.type !== 'full')) return { handled: false, reason: 'refund_not_final_or_partial' };
    if (action === 'chargeback' && (data.status === 'rejected' || data.status === 'reversed')) return { handled: false, reason: 'chargeback_not_final' };
    const txn = selTxn.get(txnId);
    if (!txn) return { handled: false, reason: 'unknown_transaction' };

    const tx = db.transaction(() => {
      markRefunded.run(iso(now()), txnId);
      if (txn.kind === 'lifetime') entitlements.revokeBySource(`txn:${txnId}`, action);
      if (txn.kind === 'gift') gifts.revokeByTransaction(txnId, action);
      referrals.revokeForTransaction(txnId);
    });
    tx();
    log(`[billing] ${action} of ${txnId} (${txn.kind}): grants and credits taken back`);
    return { handled: true, kind: txn.kind };
  }

  return {
    onTransactionCompleted,
    onAdjustment,

    /**
     * The fallback the paywall calls right after checkout, like verify-subscription does: asks Paddle for
     * the transaction and runs the same handler as the webhook.
     */
    async verifyTransaction({ userId, transactionId }) {
      const data = await paddleGet(`/transactions/${encodeURIComponent(transactionId)}`);
      if (!data) return { ok: false, reason: 'not_found' };
      if (customUserId(data) !== userId) return { ok: false, reason: 'not_yours' };
      if (data.status !== 'completed') return { ok: false, reason: 'not_completed', status: data.status };
      const out = await onTransactionCompleted(data);
      return out.handled ? { ok: true, kind: out.kind } : { ok: false, reason: out.reason };
    },
  };
}
