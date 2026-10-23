// HTTP-level tests for the WS9 routes: flag gating, who may call what, the redeem page, and the boot
// warnings. The Paddle webhook itself (signature, replay) is tested against the real server.js in
// scripts/billingWebhook.test.mjs.

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DAY, makeBilling, PRICES, transactionCompleted } from '../../test-utils/billingHarness.js';
import { ROUTE_MODULES } from './index.js';
import billing, { bootChecks, prepareRedeemShell } from './billing.js';
import { createFlags } from '../features.js';

const open = [];
const harness = async opts => { const h = await makeBilling(opts); open.push(h); return h; };
afterEach(async () => { while (open.length) await open.pop().close(); });

describe('registration', () => {
  it('the module is in the registry with its six migrations', () => {
    expect(ROUTE_MODULES.find(m => m.name === 'billing')).toBe(billing);
    expect(billing.migrations.map(m => m.id)).toEqual([
      'ws9_001_paddle_events', 'ws9_002_billing_transactions', 'ws9_003_entitlements',
      'ws9_004_gift_codes', 'ws9_005_referral_codes', 'ws9_006_referrals',
    ]);
  });

  it('every migration is additive (create-if-missing only) and can run twice', async () => {
    const h = await harness({ listen: false });
    const { runMigrations } = await import('../db/migrate.js');
    expect(runMigrations(h.db, billing.migrations)).toEqual([]);        // already applied by the harness
    for (const m of billing.migrations) m.up({
      createTable: sql => h.db.exec(sql), createIndex: sql => h.db.exec(sql),
    });                                                                  // and idempotent on their own
  });
});

describe('with every flag off the routes do not exist', () => {
  const dead = [
    ['GET', '/api/referrals/me'], ['POST', '/api/referrals/attach'], ['GET', '/api/billing/gift-info'],
    ['POST', '/api/billing/gift/redeem'], ['POST', '/api/billing/verify-transaction'], ['GET', '/redeem'],
  ];
  it.each(dead)('%s %s is a 404 whoever asks', async (method, path) => {
    const h = await harness({ flags: '' });
    for (const user of [undefined, 'someone']) {
      const r = await h.call(path, { method, user, body: method === 'POST' ? { code: 'x', transactionId: 'txn_1' } : undefined });
      expect(r.status, `${method} ${path} as ${user ?? 'nobody'}`).toBe(404);
    }
  });

  it('an unrelated flag does not open them', async () => {
    const h = await harness({ flags: 'free_tier,regional_pricing' });
    expect((await h.call('/api/referrals/me', { user: 'u' })).status).toBe(404);
    expect((await h.call('/api/billing/gift/redeem', { method: 'POST', user: 'u', body: { code: 'x' } })).status).toBe(404);
  });

  it('each route follows its own flag', async () => {
    const h = await harness({ flags: 'referrals' });
    h.addUser({ id: 'u' });
    expect((await h.call('/api/referrals/me', { user: 'u' })).status).toBe(200);
    expect((await h.call('/api/billing/gift/redeem', { method: 'POST', user: 'u', body: { code: 'x' } })).status).toBe(404);
    expect((await h.call('/api/billing/verify-transaction', { method: 'POST', user: 'u', body: { transactionId: 'txn_1' } })).status).toBe(404);
  });
});

describe('referral routes', () => {
  it('need a session', async () => {
    const h = await harness();
    expect((await h.call('/api/referrals/me')).status).toBe(401);
    expect((await h.call('/api/referrals/attach', { method: 'POST', body: { code: 'ABCDEFGH' } })).status).toBe(401);
  });

  it('give each user their own link, and attach a new account to it', async () => {
    const h = await harness();
    h.addUser({ id: 'ref' }); h.addUser({ id: 'new' });
    const mine = await h.call('/api/referrals/me', { user: 'ref' });
    expect(mine.json).toMatchObject({ link: expect.stringMatching(/^https:\/\/stopbiting\.test\/\?ref=[2-9A-Z]{8}$/), credit_days: 30, pending: 0, rewarded: 0 });
    expect((await h.call('/api/referrals/attach', { method: 'POST', user: 'new', body: { code: mine.json.code } })).json).toEqual({ ok: true });
    expect((await h.call('/api/referrals/me', { user: 'ref' })).json.pending).toBe(1);
    expect((await h.call('/api/referrals/attach', { method: 'POST', user: 'new', body: {} })).status).toBe(400);
  });

  it('refuse self-referral over HTTP too', async () => {
    const h = await harness();
    h.addUser({ id: 'ref' });
    const { json } = await h.call('/api/referrals/me', { user: 'ref' });
    expect((await h.call('/api/referrals/attach', { method: 'POST', user: 'ref', body: { code: json.code } })).json).toEqual({ ok: false, reason: 'self_referral' });
  });

  it('the credit days follow REFERRAL_CREDIT_DAYS', async () => {
    const h = await harness({ env: { REFERRAL_CREDIT_DAYS: '45' } });
    h.addUser({ id: 'ref' });
    expect((await h.call('/api/referrals/me', { user: 'ref' })).json.credit_days).toBe(45);
  });
});

describe('gift info route', () => {
  it('tells anyone how long a gift lasts, following GIFT_PLAN_DAYS', async () => {
    const h = await harness();
    expect((await h.call('/api/billing/gift-info')).json).toEqual({ days: 365 });
    const h2 = await harness({ env: { GIFT_PLAN_DAYS: '90' } });
    expect((await h2.call('/api/billing/gift-info')).json).toEqual({ days: 90 });
  });
});

describe('gift redeem route', () => {
  it('needs a session, and a code', async () => {
    const h = await harness();
    h.addUser({ id: 'u' });
    expect((await h.call('/api/billing/gift/redeem', { method: 'POST', body: { code: 'x' } })).status).toBe(401);
    expect((await h.call('/api/billing/gift/redeem', { method: 'POST', user: 'u', body: {} })).status).toBe(400);
  });

  it('adds the days once and says so', async () => {
    const h = await harness();
    h.addUser({ id: 'rec' }); h.addUser({ id: 'other' });
    const { code } = h.billing.gifts.issueForTransaction({ txnId: 'txn_r', buyerEmail: 'b@example.com' });
    expect((await h.call('/api/billing/gift/redeem', { method: 'POST', user: 'rec', body: { code: 'NOT-A-REAL-CODE-AT-ALL' } })).json).toEqual({ ok: false, reason: 'invalid' });
    expect((await h.call('/api/billing/gift/redeem', { method: 'POST', user: 'rec', body: { code } })).json).toEqual({ ok: true, days: 365 });
    expect((await h.call('/api/billing/gift/redeem', { method: 'POST', user: 'other', body: { code } })).json).toEqual({ ok: false, reason: 'already_redeemed' });
  });

  it('is rate limited per caller address', async () => {
    const h = await harness();
    h.addUser({ id: 'u' });
    const statuses = [];
    for (let i = 0; i < 12; i++) statuses.push((await h.call('/api/billing/gift/redeem', { method: 'POST', user: 'u', body: { code: 'WRONGWRONGWRONGWRONG' } })).status);
    expect(statuses.slice(0, 10).every(s => s === 200)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});

describe('verify-transaction route', () => {
  it('checks the payment with Paddle and grants a lifetime purchase of the caller', async () => {
    const data = transactionCompleted({ userId: 'buyer', priceId: PRICES.lifetime, txnId: 'txn_ok1' }).data;
    const calls = [];
    const h = await harness({ fetchImpl: async (url, init) => { calls.push([url, init.headers.Authorization]); return { ok: true, status: 200, json: async () => ({ data }) }; } });
    h.addUser({ id: 'buyer', subscription_status: 'expired', trial_end_date: new Date(h.clock.t - 9 * DAY).toISOString() });
    expect((await h.call('/api/billing/verify-transaction', { method: 'POST', user: 'buyer', body: { transactionId: 'bad id' } })).status).toBe(400);
    const r = await h.call('/api/billing/verify-transaction', { method: 'POST', user: 'buyer', body: { transactionId: 'txn_ok1' } });
    expect(r.json).toEqual({ ok: true, kind: 'lifetime' });
    expect(calls[0][0]).toBe('https://sandbox-api.paddle.com/transactions/txn_ok1');
    expect(calls[0][1]).toBe('Bearer pdl_test');
    expect(h.decorate(h.getUser('buyer')).entitlement.grants).toEqual([{ kind: 'lifetime', ends_at: null }]);
  });

  it('answers 409 for a payment that belongs to someone else, 202 for one that is not complete yet', async () => {
    const data = transactionCompleted({ userId: 'owner', priceId: PRICES.lifetime, txnId: 'txn_ok2' }).data;
    const h = await harness({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data }) }) });
    h.addUser({ id: 'thief' });
    expect((await h.call('/api/billing/verify-transaction', { method: 'POST', user: 'thief', body: { transactionId: 'txn_ok2' } })).status).toBe(409);
    const pending = await harness({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: { ...data, status: 'ready' } }) }) });
    pending.addUser({ id: 'owner' });
    expect((await pending.call('/api/billing/verify-transaction', { method: 'POST', user: 'owner', body: { transactionId: 'txn_ok2' } })).status).toBe(202);
  });

  it('answers 502 when Paddle cannot be reached', async () => {
    const h = await harness({ fetchImpl: async () => { throw new Error('offline'); } });
    h.addUser({ id: 'u' });
    expect((await h.call('/api/billing/verify-transaction', { method: 'POST', user: 'u', body: { transactionId: 'txn_ok3' } })).status).toBe(502);
  });
});

describe('the redeem page', () => {
  const shell = '<!doctype html><html><head><title>x</title><link rel="canonical" href="https://stopbiting.today/"><meta name="robots" content="index, follow"></head><body><div id="root"></div></body></html>';

  it('is the app shell, not indexable, without a canonical, with a script that takes the code out of the address', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sb-redeem-'));
    const shellPath = join(dir, 'index.html');
    writeFileSync(shellPath, shell);
    const h = await harness({ shellPath });
    const r = await h.call('/redeem');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('referrer-policy')).toBe('no-referrer');
    expect(r.headers.get('x-robots-tag')).toBe('noindex');
    expect(r.text).toContain('noindex, nofollow');
    expect(r.text).not.toContain('canonical');
    expect(r.text.indexOf('__sbGiftCode')).toBeLessThan(r.text.indexOf('<title>'));
    expect(r.text).toContain('<div id="root">');
  });

  it('prepareRedeemShell adds robots when the shell has none', () => {
    expect(prepareRedeemShell('<html><head></head></html>')).toContain('<meta name="robots" content="noindex, nofollow"></head>');
  });
});

describe('boot warnings the owner should see', () => {
  const flagsOf = list => createFlags({ FEATURE_FLAGS: list }, { warn: () => {} });
  const quiet = { log: () => {} };

  it('say nothing for a plain default setup', () => {
    expect(bootChecks({ env: {}, flags: flagsOf(''), shellPath: '/nonexistent', ...quiet })).toEqual([]);
  });

  it('flag an unusable TRIAL_DAYS', () => {
    expect(bootChecks({ env: { TRIAL_DAYS: 'seven' }, flags: flagsOf(''), shellPath: '/nonexistent', ...quiet })[0]).toMatch(/TRIAL_DAYS="seven"/);
  });

  it('flag a build made with a different TRIAL_DAYS than the server runs with', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sb-boot-'));
    const shellPath = join(dir, 'index.html');
    writeFileSync(shellPath, '<script type="application/ld+json">{"eligibleDuration": {"@type": "QuantitativeValue", "value": 9, "unitCode": "DAY"}}</script>');
    const out = bootChecks({ env: {}, flags: flagsOf(''), shellPath, ...quiet });
    expect(out[0]).toMatch(/built with TRIAL_DAYS=9 but this server runs with TRIAL_DAYS=3/);
    writeFileSync(shellPath, '<script type="application/ld+json">{"eligibleDuration": {"@type": "QuantitativeValue", "value": 3, "unitCode": "DAY"}}</script>');
    expect(bootChecks({ env: {}, flags: flagsOf(''), shellPath, ...quiet })).toEqual([]);
  });

  it('flag lifetime and gift ids that are missing from PADDLE_PRICE_IDS', () => {
    const out = bootChecks({
      env: { PADDLE_PRICE_IDS: 'pri_a pri_b', PADDLE_PRICE_ID_LIFETIME: 'pri_life', PADDLE_PRICE_ID_GIFT: 'pri_b' },
      flags: flagsOf(''), shellPath: '/nonexistent', ...quiet,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/does not include PADDLE_PRICE_ID_LIFETIME/);
  });

  it('flag a feature that is on without the price id it needs', () => {
    const out = bootChecks({ env: {}, flags: flagsOf('lifetime_plan,gift_plan,referrals'), shellPath: '/nonexistent', ...quiet });
    expect(out.join('\n')).toMatch(/PADDLE_PRICE_ID_LIFETIME is not set/);
    expect(out.join('\n')).toMatch(/PADDLE_PRICE_ID_GIFT is not set/);
    expect(out.join('\n')).toMatch(/nothing will be rewarded/);
  });
});
