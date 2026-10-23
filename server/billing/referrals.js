// Referrals (WS9, flag referrals).
//
//   * Every signed-in user can get a personal code (8 random characters, stored server-side). The
//     link is <APP_URL>/?ref=CODE. The visitor's browser keeps the code (src/billing/referral.ts) and
//     the app attaches it to the new account right after sign-up: POST /api/referrals/attach.
//   * Attaching only works for a NEW account (created in the last 7 days, no payment on record).
//   * Tracking is server-side from Paddle webhooks: when the referred user's FIRST payment completes,
//     BOTH users get REFERRAL_CREDIT_DAYS (default 30) of saved bonus access (entitlements.js). Nothing is
//     done to any Paddle subscription.
//
// Fraud checks (all in onPayment, all covered by tests):
//   1. no self-referral: the same user id, or the same email once normalised (case, +tags, Gmail dots);
//   2. no shared Paddle customer: the referred transaction's customer id is the referrer's;
//   3. no shared payment method: the referred user's card (type, last four, expiry, hashed) is one the
//      referrer has paid with;
//   4. one reward per referred user: the pending -> rewarded transition is a single guarded UPDATE, and
//      the credits' `source` keys are unique, so a replayed webhook cannot pay twice;
//   5. a refund or chargeback of the qualifying payment takes both credits back (revokeForTransaction).
//
// LIMITS, said plainly: checks 2 and 3 only see what Paddle puts in the transaction. A second card, a
// wallet that exposes no card details (PayPal, Apple Pay) or another email address defeats them, and
// the referrer's own payment history is only known for payments that arrived after this feature was
// deployed. They raise the cost of farming; they do not make it impossible, and every reward still
// needs a real, unrefunded payment by someone.

import { randomBytes } from 'node:crypto';

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0 O 1 I
const CODE_LENGTH = 8;
export const ATTACH_WINDOW_MS = 7 * 86_400_000;

export function generateReferralCode() {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** The canonical code from what a link or a person supplied, or null. */
export function normalizeReferralCode(input) {
  if (typeof input !== 'string') return null;
  const code = input.trim().toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** Email as the fraud check compares it: lower case, no +tag, no dots and one domain for Gmail. */
export function referralEmailKey(email) {
  if (typeof email !== 'string') return null;
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf('@');
  if (at < 1) return null;
  let local = lower.slice(0, at).split('+')[0];
  let domain = lower.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return local ? `${local}@${domain}` : null;
}

export function createReferrals({ db, entitlements, getUser, config, flags, now = Date.now, log = console.log }) {
  const iso = t => new Date(t).toISOString();
  const selCode = db.prepare('SELECT code FROM referral_codes WHERE user_id = ?');
  const selByCode = db.prepare('SELECT user_id FROM referral_codes WHERE code = ?');
  const insCode = db.prepare('INSERT OR IGNORE INTO referral_codes (user_id, code, created_at) VALUES (?, ?, ?)');
  const selReferral = db.prepare('SELECT * FROM referrals WHERE referred_user_id = ?');
  const insReferral = db.prepare(`
    INSERT OR IGNORE INTO referrals (referred_user_id, referrer_user_id, code, attached_at, status) VALUES (?, ?, ?, ?, 'pending')`);
  const reward = db.prepare(`
    UPDATE referrals SET status = 'rewarded', qualifying_txn_id = ?, rewarded_at = ?
    WHERE referred_user_id = ? AND status = 'pending'`);
  const reject = db.prepare(`
    UPDATE referrals SET status = 'rejected', reject_reason = ? WHERE referred_user_id = ? AND status = 'pending'`);
  // Gift purchases are not "the user paying for their own plan": they never count as a first payment.
  const selTxnsOf = db.prepare("SELECT txn_id FROM billing_transactions WHERE user_id = ? AND kind != 'gift'");
  const selFingerprints = db.prepare('SELECT DISTINCT payment_fingerprint AS fp FROM billing_transactions WHERE user_id = ? AND payment_fingerprint IS NOT NULL');
  const selCustomerOf = db.prepare('SELECT 1 FROM billing_transactions WHERE user_id = ? AND customer_id = ? LIMIT 1');
  const selRewardedFor = db.prepare("SELECT * FROM referrals WHERE qualifying_txn_id = ? AND status = 'rewarded'");
  const markRevoked = db.prepare("UPDATE referrals SET status = 'revoked', revoked_at = ? WHERE referred_user_id = ? AND status = 'rewarded'");
  const countBy = db.prepare('SELECT status, COUNT(*) AS n FROM referrals WHERE referrer_user_id = ? GROUP BY status');

  const credits = (referredId, role) => `referral:${referredId}:${role}`;

  function codeFor(userId) {
    const have = selCode.get(userId);
    if (have) return have.code;
    for (let attempt = 0; attempt < 8; attempt++) {
      insCode.run(userId, generateReferralCode(), iso(now()));
      const row = selCode.get(userId);
      if (row) return row.code;     // the unique index rejects a colliding code; try another
    }
    throw new Error('referrals: could not make a unique code');
  }

  return {
    codeFor,

    /** Where the person's link goes, and how the program is doing for them. */
    summaryFor(userId, appUrl) {
      const code = codeFor(userId);
      const counts = Object.fromEntries(countBy.all(userId).map(r => [r.status, r.n]));
      return {
        code,
        link: `${appUrl.replace(/\/+$/, '')}/?ref=${code}`,
        credit_days: config.referralCreditDays,
        pending: counts.pending ?? 0,
        rewarded: counts.rewarded ?? 0,
        credit_days_earned: (counts.rewarded ?? 0) * config.referralCreditDays,
      };
    },

    /**
     * Ties a new account to the person whose link brought it.
     * @returns {{ ok: true } | { ok: false, reason: string }}
     */
    attach({ userId, code }) {
      const canonical = normalizeReferralCode(code);
      if (!canonical) return { ok: false, reason: 'invalid_code' };
      const user = getUser(userId);
      if (!user) return { ok: false, reason: 'unknown_user' };
      const owner = selByCode.get(canonical);
      if (!owner) return { ok: false, reason: 'invalid_code' };
      if (owner.user_id === userId) return { ok: false, reason: 'self_referral' };
      const referrer = getUser(owner.user_id);
      if (!referrer) return { ok: false, reason: 'invalid_code' };
      const a = referralEmailKey(user.email), b = referralEmailKey(referrer.email);
      if (a && b && a === b) return { ok: false, reason: 'self_referral' };
      if (selReferral.get(userId)) return { ok: false, reason: 'already_referred' };

      const created = Date.parse(user.created_at);
      const isNew = Number.isFinite(created) && now() - created <= ATTACH_WINDOW_MS;
      const hasPaid = !!user.paddle_subscription_id || selTxnsOf.all(userId).length > 0
        || user.subscription_status === 'active' || user.subscription_status === 'paused';
      if (!isNew || hasPaid) return { ok: false, reason: 'not_a_new_account' };

      insReferral.run(userId, owner.user_id, canonical, iso(now()));
      return { ok: true };
    },

    /**
     * Called for every completed payment of ours (not gifts). Rewards the referral when this is the
     * referred user's first payment and the fraud checks pass.
     * @returns {{ status: string, reason?: string }}
     */
    onPayment({ userId, txnId, customerId = null, fingerprint = null, recurring = false, chargedMinor = null }) {
      if (!userId) return { status: 'no_user' };
      if (!flags.isOn('referrals')) return { status: 'flag_off' };
      const referral = selReferral.get(userId);
      if (!referral || referral.status !== 'pending') return { status: 'not_referred' };
      if (recurring) return { status: 'not_first_payment' };
      if (chargedMinor !== null && chargedMinor <= 0) return { status: 'not_a_payment' };
      // Some other transaction of this user was recorded earlier: this is not the first payment.
      const earlier = selTxnsOf.all(userId).filter(t => t.txn_id !== txnId);
      if (earlier.length > 0) return { status: 'not_first_payment' };

      const refuse = why => { reject.run(why, userId); log(`[referrals] ${userId} rejected: ${why}`); return { status: 'rejected', reason: why }; };

      const referrer = getUser(referral.referrer_user_id);
      const referred = getUser(userId);
      if (!referrer || !referred) return refuse('unknown_user');
      if (referrer.id === referred.id) return refuse('self_referral');
      const a = referralEmailKey(referred.email), b = referralEmailKey(referrer.email);
      if (a && b && a === b) return refuse('same_email');
      if (customerId && (referrer.paddle_customer_id === customerId || selCustomerOf.get(referrer.id, customerId))) return refuse('same_customer');
      if (fingerprint && selFingerprints.all(referrer.id).some(r => r.fp === fingerprint)) return refuse('same_payment_method');

      const tx = db.transaction(() => {
        if (reward.run(txnId, iso(now()), userId).changes !== 1) return false;   // someone else got there first
        entitlements.bank(referrer.id, 'referral_credit', config.referralCreditDays, credits(userId, 'referrer'));
        entitlements.bank(referred.id, 'referral_credit', config.referralCreditDays, credits(userId, 'referred'));
        return true;
      });
      return tx() ? { status: 'rewarded' } : { status: 'already_handled' };
    },

    /** A refund or chargeback of a payment that earned a reward: both sides lose it. */
    revokeForTransaction(txnId) {
      const rows = selRewardedFor.all(txnId);
      for (const r of rows) {
        markRevoked.run(iso(now()), r.referred_user_id);
        entitlements.revokeBySource(credits(r.referred_user_id, 'referrer'), 'refund');
        entitlements.revokeBySource(credits(r.referred_user_id, 'referred'), 'refund');
      }
      return rows.length;
    },
  };
}
