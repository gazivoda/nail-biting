// WS9 billing logic against an in-memory database: entitlements for every state, gift codes, the
// webhook (idempotency, lifetime, gift, refunds), referrals and their fraud checks.
//
// Paddle is simulated. The payloads are written from Paddle's documented shapes, not recorded from a
// live account: see test-utils/billingHarness.js.

import { describe, it, expect, afterEach } from 'vitest';
import { adjustment, DAY, makeBilling, PRICES, subscriptionEvent, transactionCompleted, card } from '../../test-utils/billingHarness.js';
import { formatGiftCode, generateGiftCode, hashGiftCode, normalizeGiftCode } from './gift.js';
import { referralEmailKey, normalizeReferralCode } from './referrals.js';
import { evaluateAccess } from '../../shared/access.js';

const open = [];
const world = async opts => { const w = await makeBilling({ listen: false, ...opts }); open.push(w); return w; };
afterEach(async () => { while (open.length) await open.pop().close(); });

const days = (w, n) => new Date(w.clock.t + n * DAY).toISOString();
/** Sends an event through the webhook hook like server.js does, with a response that finishes successfully. */
async function deliver(w, event, { status = 200 } = {}) {
  const res = { statusCode: status, once(name, fn) { this.fn = fn; }, finish() { this.fn?.(); } };
  const done = await w.webhook.take(event, res);
  if (!done) res.finish();                   // the existing handlers ran and answered
  return done;
}
const rows = (w, table) => w.db.prepare(`SELECT * FROM ${table}`).all();
const grantsOf = (w, userId) => w.decorate(w.getUser(userId)).entitlement?.grants ?? [];

describe('entitlements and what /api/user/me reports', () => {
  it('an account with nothing special gets its own row back, untouched', async () => {
    const w = await world({ flags: '' });
    const u = w.addUser({ id: 'plain' });
    expect(w.decorate(u)).toBe(u);
    expect(Object.keys(w.decorate(u))).not.toContain('entitlement');
  });

  it('free_tier on: the limits are reported (placeholders unless the owner sets them)', async () => {
    const w = await world({ flags: 'free_tier' });
    const u = w.addUser({ id: 'free', subscription_status: 'expired' });
    expect(w.decorate(u).entitlement).toEqual({ free_tier: { detection_minutes_per_day: 30, history_days: 7 } });
    const w2 = await world({ flags: 'free_tier', env: { FREE_TIER_DETECTION_MINUTES: '45', FREE_TIER_HISTORY_DAYS: '14' } });
    expect(w2.decorate(w2.addUser({ id: 'x' })).entitlement.free_tier).toEqual({ detection_minutes_per_day: 45, history_days: 14 });
  });

  it('lifetime is reported and honoured with every flag off', async () => {
    const w = await world({ flags: '' });
    const u = w.addUser({ id: 'life', subscription_status: 'expired', trial_end_date: days(w, -30) });
    w.billing.entitlements.grantLifetime('life', 'txn:txn_x');
    const out = w.decorate(w.getUser('life'));
    expect(out.entitlement.grants).toEqual([{ kind: 'lifetime', ends_at: null }]);
    expect(evaluateAccess(out, w.clock.t)).toMatchObject({ status: 'subscribed', source: 'lifetime' });
    expect(u.subscription_status).toBe('expired');   // the users row itself is never rewritten
  });

  it('a cancelled subscription event cannot take a lifetime grant away: it lives outside the users row', async () => {
    const w = await world();
    w.addUser({ id: 'both', subscription_status: 'cancelled', trial_end_date: days(w, -30) });
    w.billing.entitlements.grantLifetime('both', 'txn:txn_y');
    expect(evaluateAccess(w.decorate(w.getUser('both')), w.clock.t).status).toBe('subscribed');
  });

  it('saved days wait while the trial runs and while a subscription is active, then start', async () => {
    const w = await world();
    w.addUser({ id: 'bank' });
    w.billing.entitlements.bank('bank', 'referral_credit', 30, 'referral:r1:referrer');

    // Trial running: saved, not started.
    let out = w.decorate(w.getUser('bank'));
    expect(out.entitlement).toEqual({ banked_days: 30 });
    expect(evaluateAccess(out, w.clock.t).status).toBe('trial_active');

    // Trial over (the server marks it expired): the block starts now and runs 30 days.
    w.clock.advance(4 * DAY);
    w.db.prepare("UPDATE users SET subscription_status = 'expired' WHERE id = 'bank'").run();
    out = w.decorate(w.getUser('bank'));
    expect(out.entitlement.grants).toEqual([{ kind: 'referral_credit', ends_at: days(w, 30) }]);
    expect(out.entitlement.banked_days).toBeUndefined();
    expect(evaluateAccess(out, w.clock.t)).toMatchObject({ status: 'subscribed', source: 'referral_credit' });

    // Asking again does not start it a second time or move its end.
    w.clock.advance(10 * DAY);
    expect(w.decorate(w.getUser('bank')).entitlement.grants).toEqual([{ kind: 'referral_credit', ends_at: days(w, 20) }]);

    // After it ends, nothing else is saved: paywall.
    w.clock.advance(21 * DAY);
    expect(evaluateAccess(w.decorate(w.getUser('bank')), w.clock.t).status).toBe('paywall');
  });

  it('an active subscriber keeps their saved days for later', async () => {
    const w = await world();
    w.addUser({ id: 'paying', subscription_status: 'active', subscription_plan: 'monthly' });
    w.billing.entitlements.bank('paying', 'gift', 365, 'gift:1');
    const out = w.decorate(w.getUser('paying'));
    expect(out.entitlement).toEqual({ banked_days: 365 });
    expect(evaluateAccess(out, w.clock.t)).toMatchObject({ status: 'subscribed', source: 'monthly' });
    // The subscription is cancelled: the gift starts on the next look.
    w.db.prepare("UPDATE users SET subscription_status = 'cancelled', trial_end_date = ? WHERE id = 'paying'").run(days(w, -20));
    expect(w.decorate(w.getUser('paying')).entitlement.grants[0]).toEqual({ kind: 'gift', ends_at: days(w, 365) });
  });

  it('several saved blocks start one after another, oldest first', async () => {
    const w = await world();
    w.addUser({ id: 'many', subscription_status: 'expired', trial_end_date: days(w, -9) });
    w.billing.entitlements.bank('many', 'referral_credit', 30, 'referral:a:referrer');
    w.billing.entitlements.bank('many', 'gift', 365, 'gift:2');
    let out = w.decorate(w.getUser('many'));
    expect(out.entitlement.grants).toEqual([{ kind: 'referral_credit', ends_at: days(w, 30) }]);
    expect(out.entitlement.banked_days).toBe(365);
    w.clock.advance(31 * DAY);
    out = w.decorate(w.getUser('many'));
    expect(out.entitlement.grants).toEqual([{ kind: 'gift', ends_at: days(w, 365) }]);
    expect(out.entitlement.banked_days).toBeUndefined();
  });

  it('a grant is written once per source, and revoking is idempotent', async () => {
    const w = await world();
    w.addUser({ id: 'g' });
    const e = w.billing.entitlements;
    expect(e.grantLifetime('g', 'txn:t1')).toBe(true);
    expect(e.grantLifetime('g', 'txn:t1')).toBe(false);
    expect(e.bank('g', 'gift', 30, 'gift:9')).toBe(true);
    expect(e.bank('g', 'gift', 30, 'gift:9')).toBe(false);
    expect(rows(w, 'entitlements')).toHaveLength(2);
    expect(e.revokeBySource('txn:t1', 'refund')).toBe(true);
    expect(e.revokeBySource('txn:t1', 'refund')).toBe(false);
    expect(grantsOf(w, 'g')).toEqual([]);
  });

  it('refuses nonsense', async () => {
    const w = await world();
    expect(() => w.billing.entitlements.bank('g', 'lifetime', 30, 's')).toThrow();
    expect(() => w.billing.entitlements.bank('g', 'gift', 0, 's')).toThrow();
  });
});

describe('gift codes', () => {
  it('are 100 bits of Crockford base32 and never repeat', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      const c = generateGiftCode();
      expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{20}$/);
      seen.add(c);
    }
    expect(seen.size).toBe(500);
    expect(formatGiftCode('ABCDEFGHJKMNPQRSTVWX')).toBe('ABCDE-FGHJK-MNPQR-STVWX');
  });

  it('accept what a person types or pastes', () => {
    expect(normalizeGiftCode(' abcde-fghjk mnpqr-stvwx ')).toBe('ABCDEFGHJKMNPQRSTVWX');
    expect(normalizeGiftCode('ABCDE-FGHJK-MNPQR-STVWl')).toBe('ABCDEFGHJKMNPQRSTVWX'.slice(0, 19) + '1');
    expect(normalizeGiftCode('short')).toBeNull();
    expect(normalizeGiftCode('ABCDE-FGHJK-MNPQR-STVW!')).toBeNull();
    expect(normalizeGiftCode(null)).toBeNull();
    expect(hashGiftCode('A'.repeat(20))).toMatch(/^[0-9a-f]{64}$/);
  });

  it('are stored only as a hash', async () => {
    const w = await world();
    const issued = w.billing.gifts.issueForTransaction({ txnId: 'txn_a', buyerEmail: 'b@example.com' });
    const row = rows(w, 'gift_codes')[0];
    expect(JSON.stringify(row)).not.toContain(issued.code);
    expect(row.code_hash).toBe(hashGiftCode(issued.code));
    expect(row.days).toBe(365);
  });

  it('can be redeemed once, by one person, and grant a defined duration', async () => {
    const w = await world();
    w.addUser({ id: 'rec' }); w.addUser({ id: 'late' });
    const { code } = w.billing.gifts.issueForTransaction({ txnId: 'txn_b', buyerEmail: 'b@example.com' });
    expect(w.billing.gifts.redeem({ userId: 'rec', code: 'WRONGWRONGWRONGWRONG' })).toEqual({ ok: false, reason: 'invalid' });
    expect(w.billing.gifts.redeem({ userId: 'rec', code: formatGiftCode(code).toLowerCase() })).toEqual({ ok: true, days: 365 });
    expect(w.billing.gifts.redeem({ userId: 'late', code })).toEqual({ ok: false, reason: 'already_redeemed' });
    expect(w.billing.gifts.redeem({ userId: 'rec', code })).toEqual({ ok: false, reason: 'already_redeemed' });
    expect(w.billing.entitlements.bankedDays('rec')).toBe(365);
    expect(w.billing.entitlements.bankedDays('late')).toBe(0);
  });

  it('the duration and the optional expiry come from the environment', async () => {
    const w = await world({ env: { GIFT_PLAN_DAYS: '90', GIFT_CODE_EXPIRY_DAYS: '10' } });
    w.addUser({ id: 'rec' });
    const { code } = w.billing.gifts.issueForTransaction({ txnId: 'txn_c' });
    expect(rows(w, 'gift_codes')[0].days).toBe(90);
    expect(rows(w, 'gift_codes')[0].expires_at).toBe(days(w, 10));
    w.clock.advance(11 * DAY);
    expect(w.billing.gifts.redeem({ userId: 'rec', code })).toEqual({ ok: false, reason: 'expired' });
    expect(w.billing.entitlements.bankedDays('rec')).toBe(0);
  });

  it('a revoked code stops working; if it was redeemed the recipient loses the days', async () => {
    const w = await world();
    w.addUser({ id: 'r1' }); w.addUser({ id: 'r2' });
    const a = w.billing.gifts.issueForTransaction({ txnId: 'txn_d' });
    const b = w.billing.gifts.issueForTransaction({ txnId: 'txn_e' });
    expect(w.billing.gifts.redeem({ userId: 'r2', code: b.code }).ok).toBe(true);
    w.billing.gifts.revokeByTransaction('txn_d');
    w.billing.gifts.revokeByTransaction('txn_e');
    expect(w.billing.gifts.redeem({ userId: 'r1', code: a.code })).toEqual({ ok: false, reason: 'revoked' });
    expect(w.billing.entitlements.bankedDays('r2')).toBe(0);
  });

  it('a purchase whose email never went out gets a NEW code on the retry, and the old one is dead', async () => {
    const w = await world();
    w.addUser({ id: 'r' });
    const first = w.billing.gifts.issueForTransaction({ txnId: 'txn_f', buyerEmail: 'b@example.com' });
    const second = w.billing.gifts.issueForTransaction({ txnId: 'txn_f', buyerEmail: 'b@example.com' });
    expect(second.code).not.toBe(first.code);
    expect(rows(w, 'gift_codes')).toHaveLength(1);
    expect(w.billing.gifts.redeem({ userId: 'r', code: first.code })).toEqual({ ok: false, reason: 'invalid' });
    w.billing.gifts.markEmailSent('txn_f');
    expect(w.billing.gifts.issueForTransaction({ txnId: 'txn_f' })).toEqual({ duplicate: true });
  });
});

describe('the webhook hook: signature-verified events arrive here', () => {
  it('lifetime: transaction.completed grants it, and replaying the same event changes nothing', async () => {
    const w = await world();
    w.addUser({ id: 'buyer', subscription_status: 'expired', trial_end_date: days(w, -9) });
    const event = transactionCompleted({ userId: 'buyer', priceId: PRICES.lifetime });
    expect(await deliver(w, event)).toBe(true);
    expect(grantsOf(w, 'buyer')).toEqual([{ kind: 'lifetime', ends_at: null }]);
    const snapshot = JSON.stringify([rows(w, 'entitlements'), rows(w, 'billing_transactions'), rows(w, 'paddle_events')]);

    expect(await deliver(w, event)).toBe(true);                               // same event_id: ignored
    expect(await deliver(w, { ...event, event_id: 'evt_other' })).toBe(true); // a new event for the same payment: the unique keys hold
    expect(rows(w, 'entitlements')).toHaveLength(1);
    expect(rows(w, 'billing_transactions')).toHaveLength(1);
    expect(JSON.stringify([rows(w, 'entitlements'), rows(w, 'billing_transactions')])).toBe(JSON.stringify([JSON.parse(snapshot)[0], JSON.parse(snapshot)[1]]));
    expect(rows(w, 'paddle_events').map(r => r.event_id).sort()).toEqual([event.event_id, 'evt_other'].sort());
  });

  it('lifetime for a payer with no userId in customData is matched by the payer\'s email, via the API', async () => {
    const fetchImpl = async url => ({ ok: true, status: 200, json: async () => ({ data: { email: 'lena@example.com' } }), url });
    const w = await world({ fetchImpl });
    w.addUser({ id: 'lena', email: 'lena@example.com' });
    await deliver(w, transactionCompleted({ userId: null, priceId: PRICES.lifetime, customerId: 'ctm_lena' }));
    expect(grantsOf(w, 'lena')).toEqual([{ kind: 'lifetime', ends_at: null }]);
  });

  it('lifetime that matches nobody is recorded, logged as an error, acknowledged, and grants nothing', async () => {
    const w = await world({ fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }) });
    const event = transactionCompleted({ userId: 'ghost', priceId: PRICES.lifetime });
    expect(await deliver(w, event)).toBe(true);
    expect(rows(w, 'entitlements')).toHaveLength(0);
    expect(rows(w, 'billing_transactions')[0]).toMatchObject({ kind: 'lifetime', user_id: null });
    expect(w.errors.join('\n')).toMatch(/could not be matched to an account/);
  });

  it('a payment for another product on the shared account does nothing at all', async () => {
    const w = await world();
    w.addUser({ id: 'u' });
    const event = transactionCompleted({ userId: 'u', priceId: PRICES.other });
    expect(await deliver(w, event)).toBe(true);
    expect(rows(w, 'entitlements')).toHaveLength(0);
    expect(rows(w, 'billing_transactions')).toHaveLength(0);
  });

  it('gift: creates a code, emails the buyer a redeem link, and a replay sends nothing more', async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ data: { email: 'buyer@example.com' } }) });
    const w = await world({ fetchImpl });
    const event = transactionCompleted({ userId: null, priceId: PRICES.gift, customerId: 'ctm_b' });
    await deliver(w, event);
    expect(w.sent).toHaveLength(1);
    expect(w.sent[0].to).toBe('buyer@example.com');
    const link = /https:\/\/stopbiting\.test\/redeem#code=([0-9A-Z]{20})/.exec(w.sent[0].text);
    expect(link).toBeTruthy();
    expect(w.sent[0].html).toContain('/redeem#code=');
    expect(rows(w, 'gift_codes')[0].email_sent_at).toBeTruthy();
    expect(rows(w, 'gift_codes')[0].code_hash).toBe(hashGiftCode(link[1]));

    await deliver(w, event);
    await deliver(w, { ...event, event_id: 'evt_resent' });                  // Paddle's "resend" button: a new event id
    expect(w.sent).toHaveLength(1);
    expect(rows(w, 'gift_codes')).toHaveLength(1);

    // The recipient redeems with the link's code.
    w.addUser({ id: 'recipient' });
    expect(w.billing.gifts.redeem({ userId: 'recipient', code: link[1] })).toEqual({ ok: true, days: 365 });
  });

  it('gift: when the email is rejected (a returned { error }) the event fails so Paddle retries, then a new code goes out', async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ data: { email: 'buyer@example.com' } }) });
    let reject = true;
    const sent = [];
    const sendEmail = async message => {
      if (reject) return { data: null, error: { name: 'validation_error', message: 'domain not verified' } };
      sent.push(message); return { data: { id: 'ok' }, error: null };
    };
    const w = await world({ fetchImpl, sendEmail });
    const event = transactionCompleted({ userId: null, priceId: PRICES.gift });
    await expect(deliver(w, event)).rejects.toThrow(/rejected/);
    expect(rows(w, 'paddle_events')).toHaveLength(0);                          // not recorded: the retry is processed
    expect(rows(w, 'gift_codes')[0].email_sent_at).toBeNull();
    reject = false;
    expect(await deliver(w, event)).toBe(true);
    expect(sent).toHaveLength(1);
    expect(rows(w, 'gift_codes')).toHaveLength(1);
    expect(rows(w, 'gift_codes')[0].email_sent_at).toBeTruthy();
  });

  it('gift without any address for the buyer fails (and so retries) rather than losing the code', async () => {
    const w = await world({ fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) });
    await expect(deliver(w, transactionCompleted({ userId: null, priceId: PRICES.gift }))).rejects.toThrow(/no email address/);
  });

  it('subscription events are left to the existing handlers, and recorded once those have answered', async () => {
    const w = await world();
    const event = subscriptionEvent({ userId: 'u' });
    expect(await deliver(w, event)).toBe(false);                               // not handled here
    expect(rows(w, 'paddle_events').map(r => r.event_id)).toEqual([event.event_id]);
    expect(await deliver(w, event)).toBe(true);                                // the replay is acknowledged here
  });

  it('a subscription event the handlers failed on (500) is NOT recorded, so Paddle\'s retry is processed', async () => {
    const w = await world();
    const event = subscriptionEvent();
    expect(await deliver(w, event, { status: 500 })).toBe(false);
    expect(rows(w, 'paddle_events')).toHaveLength(0);
    expect(await deliver(w, event)).toBe(false);                               // processed again
    expect(rows(w, 'paddle_events')).toHaveLength(1);
  });

  it('an event without an id is still handled, just not de-duplicated by id', async () => {
    const w = await world();
    w.addUser({ id: 'noid' });
    const event = { ...transactionCompleted({ userId: 'noid' }), event_id: undefined };
    await deliver(w, event); await deliver(w, event);
    expect(rows(w, 'entitlements')).toHaveLength(1);
    expect(rows(w, 'paddle_events')).toHaveLength(0);
  });

  it('forgets handled events after 60 days', async () => {
    const w = await world();
    await deliver(w, subscriptionEvent());
    w.clock.advance(61 * DAY);
    expect(w.webhook.prune()).toBe(1);
    expect(rows(w, 'paddle_events')).toHaveLength(0);
  });
});

describe('refunds and chargebacks', () => {
  async function lifetimeBuyer() {
    const w = await world();
    w.addUser({ id: 'buyer', subscription_status: 'expired', trial_end_date: days(w, -9) });
    const paid = transactionCompleted({ userId: 'buyer', priceId: PRICES.lifetime });
    await deliver(w, paid);
    return { w, txnId: paid.data.id };
  }

  it('a full approved refund takes the lifetime grant back; replaying it changes nothing', async () => {
    const { w, txnId } = await lifetimeBuyer();
    const refund = adjustment({ txnId });
    await deliver(w, refund);
    expect(grantsOf(w, 'buyer')).toEqual([]);
    expect(rows(w, 'entitlements')[0].revoked_at).toBeTruthy();
    expect(rows(w, 'billing_transactions')[0].refunded_at).toBeTruthy();
    const before = JSON.stringify(rows(w, 'entitlements'));
    await deliver(w, refund);
    await deliver(w, { ...refund, event_id: 'evt_again' });
    expect(JSON.stringify(rows(w, 'entitlements'))).toBe(before);
  });

  it('a chargeback does the same', async () => {
    const { w, txnId } = await lifetimeBuyer();
    await deliver(w, adjustment({ txnId, action: 'chargeback', kind: 'partial', status: 'approved' }));
    expect(grantsOf(w, 'buyer')).toEqual([]);
  });

  it.each([
    ['a refund still pending approval', { status: 'pending_approval' }],
    ['a rejected refund', { status: 'rejected' }],
    ['a partial refund', { kind: 'partial' }],
    ['a credit', { action: 'credit' }],
  ])('%s leaves the grant alone', async (_name, over) => {
    const { w, txnId } = await lifetimeBuyer();
    await deliver(w, adjustment({ txnId, ...over }));
    expect(grantsOf(w, 'buyer')).toEqual([{ kind: 'lifetime', ends_at: null }]);
  });

  it('an adjustment for a transaction we never recorded is ignored', async () => {
    const w = await world();
    expect(await deliver(w, adjustment({ txnId: 'txn_unknown' }))).toBe(true);
    expect(rows(w, 'entitlements')).toHaveLength(0);
  });

  it('a refunded gift purchase kills the code, and the recipient\'s days if it was redeemed', async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ data: { email: 'buyer@example.com' } }) });
    const w = await world({ fetchImpl });
    w.addUser({ id: 'recipient' });
    const paid = transactionCompleted({ userId: null, priceId: PRICES.gift });
    await deliver(w, paid);
    const code = /#code=([0-9A-Z]{20})/.exec(w.sent[0].text)[1];
    w.billing.gifts.redeem({ userId: 'recipient', code });
    expect(w.billing.entitlements.bankedDays('recipient')).toBe(365);
    await deliver(w, adjustment({ txnId: paid.data.id }));
    expect(w.billing.entitlements.bankedDays('recipient')).toBe(0);
    expect(rows(w, 'gift_codes')[0].revoked_at).toBeTruthy();
  });
});

describe('referrals', () => {
  /** A referrer (with a code) and a brand-new referred account attached to them. */
  async function pair(opts = {}, referrerFields = {}, referredFields = {}) {
    const w = await world(opts);
    w.addUser({ id: 'ref', email: 'ref@example.com', ...referrerFields });
    w.addUser({ id: 'new', email: 'new@example.com', ...referredFields });
    const code = w.billing.referrals.codeFor('ref');
    return { w, code };
  }
  const pay = (w, over = {}) => deliver(w, transactionCompleted({ userId: 'new', priceId: PRICES.monthly, customerId: 'ctm_new', payment: card({ last4: '1111' }), ...over }));
  const credit = (w, id) => w.billing.entitlements.bankedDays(id);

  it('every user gets one random short code, stable, and a link that carries it', async () => {
    const { w, code } = await pair();
    expect(code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(w.billing.referrals.codeFor('ref')).toBe(code);
    expect(w.billing.referrals.codeFor('new')).not.toBe(code);
    expect(w.billing.referrals.summaryFor('ref', 'https://stopbiting.test/')).toMatchObject({ code, link: `https://stopbiting.test/?ref=${code}`, credit_days: 30, pending: 0, rewarded: 0 });
    expect(normalizeReferralCode(` ${code.toLowerCase()} `)).toBe(code);
    expect(normalizeReferralCode('0OIL1')).toBeNull();
  });

  it('attaches a new account to the link\'s owner', async () => {
    const { w, code } = await pair();
    expect(w.billing.referrals.attach({ userId: 'new', code })).toEqual({ ok: true });
    expect(rows(w, 'referrals')[0]).toMatchObject({ referred_user_id: 'new', referrer_user_id: 'ref', status: 'pending' });
    expect(w.billing.referrals.attach({ userId: 'new', code })).toEqual({ ok: false, reason: 'already_referred' });
  });

  it.each([
    ['an unknown code', 'ZZZZZZZZ', 'invalid_code'],
    ['a malformed code', 'abc', 'invalid_code'],
  ])('refuses %s', async (_n, code, reason) => {
    const { w } = await pair();
    expect(w.billing.referrals.attach({ userId: 'new', code })).toEqual({ ok: false, reason });
  });

  it('refuses a referral of yourself, by user id', async () => {
    const { w, code } = await pair();
    expect(w.billing.referrals.attach({ userId: 'ref', code })).toEqual({ ok: false, reason: 'self_referral' });
  });

  it('refuses a referral of yourself, by email once normalised (case, +tag, Gmail dots)', async () => {
    const w = await world();
    w.addUser({ id: 'a', email: 'Jane.Doe@gmail.com' });
    w.addUser({ id: 'b', email: 'janedoe+referral@googlemail.com' });
    const code = w.billing.referrals.codeFor('a');
    expect(w.billing.referrals.attach({ userId: 'b', code })).toEqual({ ok: false, reason: 'self_referral' });
    expect(referralEmailKey('Jane.Doe+x@Gmail.com')).toBe('janedoe@gmail.com');
    expect(referralEmailKey('a.b@example.com')).toBe('a.b@example.com');   // dots only matter at Gmail
  });

  it('refuses an account that is not new, or has already paid', async () => {
    const w = await world();
    w.addUser({ id: 'ref' });
    w.addUser({ id: 'old', created_at: days(w, -30) });
    w.addUser({ id: 'payer', subscription_status: 'active', paddle_subscription_id: 'sub_1' });
    const code = w.billing.referrals.codeFor('ref');
    expect(w.billing.referrals.attach({ userId: 'old', code })).toEqual({ ok: false, reason: 'not_a_new_account' });
    expect(w.billing.referrals.attach({ userId: 'payer', code })).toEqual({ ok: false, reason: 'not_a_new_account' });
  });

  it('first payment of the referred user: BOTH get the configured days, saved for later', async () => {
    const { w, code } = await pair({ env: { REFERRAL_CREDIT_DAYS: '14' } });
    w.billing.referrals.attach({ userId: 'new', code });
    await pay(w);
    expect(credit(w, 'ref')).toBe(14);
    expect(credit(w, 'new')).toBe(14);
    expect(rows(w, 'referrals')[0]).toMatchObject({ status: 'rewarded' });
    expect(w.billing.referrals.summaryFor('ref', 'https://x.test').credit_days_earned).toBe(14);
  });

  it('is rewarded once per referred user: a second payment, a replay and a duplicate event pay nothing more', async () => {
    const { w, code } = await pair();
    w.billing.referrals.attach({ userId: 'new', code });
    const first = transactionCompleted({ userId: 'new', priceId: PRICES.monthly, customerId: 'ctm_new', payment: card({ last4: '1111' }) });
    await deliver(w, first);
    await deliver(w, first);                                                    // replay
    await deliver(w, { ...first, event_id: 'evt_dup' });                        // same payment, new event id
    await pay(w);                                                               // a second payment
    await pay(w, { priceId: PRICES.lifetime });                                 // and a lifetime purchase
    expect(credit(w, 'ref')).toBe(30);
    expect(credit(w, 'new')).toBe(30);
    expect(rows(w, 'entitlements').filter(e => e.kind === 'referral_credit')).toHaveLength(2);
  });

  it('renewals are not first payments', async () => {
    const { w, code } = await pair();
    w.billing.referrals.attach({ userId: 'new', code });
    await pay(w, { origin: 'subscription_recurring' });
    expect(credit(w, 'ref')).toBe(0);
    expect(rows(w, 'referrals')[0].status).toBe('pending');
  });

  it('a free (100% discounted) transaction is not a payment', async () => {
    const { w, code } = await pair();
    w.billing.referrals.attach({ userId: 'new', code });
    await pay(w, { total: '0' });
    expect(credit(w, 'ref')).toBe(0);
  });

  it('a lifetime purchase as the first payment also counts', async () => {
    const { w, code } = await pair();
    w.billing.referrals.attach({ userId: 'new', code });
    await pay(w, { priceId: PRICES.lifetime });
    expect(credit(w, 'ref')).toBe(30);
    expect(grantsOf(w, 'new')).toEqual([{ kind: 'lifetime', ends_at: null }]);
  });

  it('a payment for another product on the account rewards nobody', async () => {
    const { w, code } = await pair();
    w.billing.referrals.attach({ userId: 'new', code });
    await pay(w, { priceId: PRICES.other });
    expect(credit(w, 'ref')).toBe(0);
  });

  it('with referrals off nothing is rewarded', async () => {
    const { w, code } = await pair({ flags: 'gift_plan' });
    w.billing.referrals.attach({ userId: 'new', code });
    await pay(w);
    expect(credit(w, 'ref')).toBe(0);
  });

  describe('fraud checks', () => {
    it('same payment method as the referrer\'s: no reward for either', async () => {
      const { w, code } = await pair();
      await deliver(w, transactionCompleted({ userId: 'ref', priceId: PRICES.monthly, customerId: 'ctm_ref', payment: card({ last4: '4242' }) }));
      w.billing.referrals.attach({ userId: 'new', code });
      await pay(w, { payment: card({ last4: '4242' }) });
      expect(credit(w, 'ref')).toBe(0);
      expect(credit(w, 'new')).toBe(0);
      expect(rows(w, 'referrals')[0]).toMatchObject({ status: 'rejected', reject_reason: 'same_payment_method' });
    });

    it('the same card number with a different expiry or brand is a different card', async () => {
      const { w, code } = await pair();
      await deliver(w, transactionCompleted({ userId: 'ref', priceId: PRICES.monthly, customerId: 'ctm_ref', payment: card({ last4: '4242', year: 2030 }) }));
      w.billing.referrals.attach({ userId: 'new', code });
      await pay(w, { payment: card({ last4: '4242', year: 2031 }) });
      expect(rows(w, 'referrals')[0].status).toBe('rewarded');
    });

    it('same Paddle customer id as the referrer: no reward', async () => {
      const { w, code } = await pair({}, { paddle_customer_id: 'ctm_shared' });
      w.billing.referrals.attach({ userId: 'new', code });
      await pay(w, { customerId: 'ctm_shared' });
      expect(rows(w, 'referrals')[0]).toMatchObject({ status: 'rejected', reject_reason: 'same_customer' });
      expect(credit(w, 'ref')).toBe(0);
    });

    it('same Paddle customer id as one of the referrer\'s earlier payments: no reward', async () => {
      const { w, code } = await pair();
      await deliver(w, transactionCompleted({ userId: 'ref', priceId: PRICES.monthly, customerId: 'ctm_x', payment: card({ last4: '9999' }) }));
      w.billing.referrals.attach({ userId: 'new', code });
      await pay(w, { customerId: 'ctm_x' });
      expect(rows(w, 'referrals')[0].reject_reason).toBe('same_customer');
    });

    it('an email that became the same after attach (account edited) is caught at payment time', async () => {
      const { w, code } = await pair();
      w.billing.referrals.attach({ userId: 'new', code });
      w.db.prepare("UPDATE users SET email = 'ref+again@example.com' WHERE id = 'new'").run();
      await pay(w);
      expect(rows(w, 'referrals')[0].reject_reason).toBe('same_email');
    });

    it('a rejected referral is not retried by a later payment', async () => {
      const { w, code } = await pair();
      await deliver(w, transactionCompleted({ userId: 'ref', priceId: PRICES.monthly, customerId: 'ctm_ref', payment: card({ last4: '4242' }) }));
      w.billing.referrals.attach({ userId: 'new', code });
      await pay(w, { payment: card({ last4: '4242' }) });
      await pay(w, { payment: card({ last4: '5555' }) });
      expect(credit(w, 'ref')).toBe(0);
    });
  });

  describe('refunds', () => {
    it('a full refund of the qualifying payment takes the credit back from both, saved or running', async () => {
      const { w, code } = await pair();
      w.billing.referrals.attach({ userId: 'new', code });
      const paid = transactionCompleted({ userId: 'new', priceId: PRICES.monthly, customerId: 'ctm_new', payment: card({ last4: '1111' }) });
      await deliver(w, paid);
      expect(credit(w, 'ref')).toBe(30);

      // The referrer's block has already started when the refund lands.
      w.db.prepare("UPDATE users SET subscription_status = 'expired', trial_end_date = ? WHERE id = 'ref'").run(days(w, -3));
      expect(grantsOf(w, 'ref')).toHaveLength(1);

      await deliver(w, adjustment({ txnId: paid.data.id }));
      expect(credit(w, 'ref')).toBe(0);
      expect(credit(w, 'new')).toBe(0);
      expect(grantsOf(w, 'ref')).toEqual([]);
      expect(rows(w, 'referrals')[0].status).toBe('revoked');

      await deliver(w, adjustment({ txnId: paid.data.id }));                    // replay: still nothing, no error
      expect(rows(w, 'referrals')[0].status).toBe('revoked');
    });
  });
});

describe('verify-transaction (the paywall\'s fallback while the webhook is slow)', () => {
  const txnPayload = (over = {}) => ({
    ...transactionCompleted({ userId: 'buyer', priceId: PRICES.lifetime, txnId: 'txn_v1' }).data, ...over,
  });
  const fetchFor = data => async url => url.includes('/transactions/')
    ? { ok: true, status: 200, json: async () => ({ data }) } : { ok: false, status: 404, json: async () => ({}) };

  it('grants the lifetime purchase of the caller, once', async () => {
    const w = await world({ fetchImpl: fetchFor(txnPayload()) });
    w.addUser({ id: 'buyer', subscription_status: 'expired', trial_end_date: days(w, -9) });
    expect(await w.billing.purchases.verifyTransaction({ userId: 'buyer', transactionId: 'txn_v1' })).toEqual({ ok: true, kind: 'lifetime' });
    await w.billing.purchases.verifyTransaction({ userId: 'buyer', transactionId: 'txn_v1' });
    expect(rows(w, 'entitlements')).toHaveLength(1);
  });

  it('will not grant a payment made for someone else\'s account', async () => {
    const w = await world({ fetchImpl: fetchFor(txnPayload()) });
    w.addUser({ id: 'buyer' }); w.addUser({ id: 'thief' });
    expect(await w.billing.purchases.verifyTransaction({ userId: 'thief', transactionId: 'txn_v1' })).toEqual({ ok: false, reason: 'not_yours' });
    expect(rows(w, 'entitlements')).toHaveLength(0);
  });

  it('says "not yet" for a payment that has not completed', async () => {
    const w = await world({ fetchImpl: fetchFor(txnPayload({ status: 'ready' })) });
    w.addUser({ id: 'buyer' });
    expect(await w.billing.purchases.verifyTransaction({ userId: 'buyer', transactionId: 'txn_v1' })).toMatchObject({ ok: false, reason: 'not_completed' });
  });
});
