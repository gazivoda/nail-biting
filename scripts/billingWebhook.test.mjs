// The Paddle webhook, /api/user/me and the WS9 routes, against the REAL server.js.
//
// Boots `node server.js` on free ports with a scratch DATA_DIR and throwaway credentials, signs events
// the way Paddle does (HMAC-SHA256 of "<ts>:<raw body>" with the webhook secret), and checks:
//   * a bad or missing signature is refused and changes nothing;
//   * lifetime purchases are granted, and replaying the event (same id, or a fresh id for the same
//     payment) changes nothing;
//   * the existing subscription handlers still work exactly as before, and a replay of a subscription
//     event is acknowledged without running them again;
//   * a first payment by a referred user credits BOTH accounts once; a refund takes both back;
//   * with every flag off /api/user/me is the users row and nothing else, and the new routes are 404;
//   * grants that were paid for are honoured even while their flag is off.
// Paddle is simulated: the payloads follow Paddle's documented shapes, they were not recorded from a
// live account.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SECRET = 'test-secret-test-secret-test-secret-0123';
const HOOK_SECRET = 'pdl_ntfset_test_secret';
const PRICES = { monthly: 'pri_m', lifetime: 'pri_life', gift: 'pri_gift', other: 'pri_other' };

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.once('error', reject);
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

async function startServer(featureFlags) {
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), 'sb-billing-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH, PORT: String(port), DATA_DIR: dataDir,
      GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'x', JWT_SECRET: SECRET,
      FEATURE_FLAGS: featureFlags,
      PADDLE_WEBHOOK_SECRET: HOOK_SECRET, PADDLE_API_KEY: '',
      PADDLE_PRICE_ID_LIFETIME: PRICES.lifetime, PADDLE_PRICE_ID_GIFT: PRICES.gift, PADDLE_PRICE_ID_MONTHLY: PRICES.monthly,
      RESEND_API_KEY: '', ELECTRON_PROTOCOL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  const db = new Database(join(dataDir, 'users.db'));
  return {
    base, db, log: () => log,
    stop: async () => { db.close(); child.kill(); await new Promise(r => child.once('exit', r)); rmSync(dataDir, { recursive: true, force: true }); },
  };
}

const day = 86_400_000;
function seedUser(srv, id, over = {}) {
  const row = {
    id, email: `${id}@example.com`, name: id, avatar: null,
    trial_end_date: new Date(Date.now() + 2 * day).toISOString(), subscription_status: 'trial',
    subscription_plan: null, subscription_end_date: null, paddle_subscription_id: null, paddle_customer_id: null,
    created_at: new Date().toISOString(), ...over,
  };
  srv.db.prepare(`INSERT INTO users (id, email, name, avatar, trial_end_date, subscription_status, subscription_plan,
    subscription_end_date, paddle_subscription_id, paddle_customer_id, created_at)
    VALUES (@id, @email, @name, @avatar, @trial_end_date, @subscription_status, @subscription_plan,
    @subscription_end_date, @paddle_subscription_id, @paddle_customer_id, @created_at)`).run(row);
  return row;
}

const signed = (body, { secret = HOOK_SECRET, ts = Math.floor(Date.now() / 1000) } = {}) => {
  const raw = JSON.stringify(body);
  const h1 = createHmac('sha256', secret).update(`${ts}:${raw}`).digest('hex');
  return { raw, headers: { 'content-type': 'application/json', 'paddle-signature': `ts=${ts};h1=${h1}` } };
};
const post = (srv, body, opts) => {
  const { raw, headers } = signed(body, opts);
  return fetch(`${srv.base}/api/paddle/webhook`, { method: 'POST', headers, body: raw });
};
const me = async (srv, id) => {
  const token = jwt.sign({ sub: id }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  const res = await fetch(`${srv.base}/api/user/me`, { headers: { cookie: `nh_session=${token}` } });
  return { status: res.status, json: await res.json() };
};
const authed = (srv, id, path, init = {}) => {
  const token = jwt.sign({ sub: id }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  return fetch(`${srv.base}${path}`, { ...init, headers: { 'content-type': 'application/json', cookie: `nh_session=${token}`, ...(init.headers ?? {}) } });
};
const count = (srv, table) => srv.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

let n = 0;
const txn = ({ userId, priceId, customerId = 'ctm_1', origin = 'web', last4 = '4242', total = '499', eventId = `evt_${++n}`, txnId = `txn_${n}` }) => ({
  event_id: eventId, event_type: 'transaction.completed', occurred_at: new Date().toISOString(),
  data: {
    id: txnId, status: 'completed', customer_id: customerId, origin, custom_data: userId ? { userId } : null,
    items: [{ price: { id: priceId }, quantity: 1 }],
    details: { totals: { total, grand_total: total }, line_items: [{ price_id: priceId }] },
    payments: [{ status: 'captured', method_details: { type: 'card', card: { type: 'visa', last4, expiry_month: 12, expiry_year: 2030 } } }],
  },
});
const refund = (transactionId, over = {}) => ({
  event_id: `evt_r${++n}`, event_type: 'adjustment.updated', occurred_at: new Date().toISOString(),
  data: { id: `adj_${n}`, transaction_id: transactionId, action: 'refund', type: 'full', status: 'approved', ...over },
});

describe('with the flags on (lifetime_plan, gift_plan, referrals, free_tier)', () => {
  let srv;
  beforeAll(async () => { srv = await startServer('lifetime_plan,gift_plan,referrals,free_tier'); }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it('refuses a bad or missing signature, and changes nothing', async () => {
    seedUser(srv, 'sig');
    const event = txn({ userId: 'sig', priceId: PRICES.lifetime });
    expect((await post(srv, event, { secret: 'wrong-secret' })).status).toBe(401);
    expect((await fetch(`${srv.base}/api/paddle/webhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event) })).status).toBe(401);
    expect((await fetch(`${srv.base}/api/paddle/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'paddle-signature': 'ts=1;h1=deadbeef' }, body: JSON.stringify(event) })).status).toBe(401);
    // A valid signature over a different body than the one sent.
    const { headers } = signed({ ...event, event_id: 'evt_other' });
    expect((await fetch(`${srv.base}/api/paddle/webhook`, { method: 'POST', headers, body: JSON.stringify(event) })).status).toBe(401);
    expect(count(srv, 'entitlements')).toBe(0);
    expect(count(srv, 'paddle_events')).toBe(0);
    expect((await me(srv, 'sig')).json.entitlement?.grants).toBeUndefined();
  });

  it('lifetime: granted by a signed event; replays change nothing', async () => {
    seedUser(srv, 'life', { subscription_status: 'expired', trial_end_date: new Date(Date.now() - 3 * day).toISOString() });
    const event = txn({ userId: 'life', priceId: PRICES.lifetime });
    expect((await post(srv, event)).status).toBe(200);
    const first = (await me(srv, 'life')).json;
    expect(first.entitlement.grants).toEqual([{ kind: 'lifetime', ends_at: null }]);
    expect(first.subscription_status).toBe('expired');                       // the users row is untouched

    const rowsBefore = JSON.stringify(srv.db.prepare('SELECT * FROM entitlements').all());
    expect((await post(srv, event)).status).toBe(200);                      // same event id
    expect((await post(srv, { ...event, event_id: 'evt_fresh_id' })).status).toBe(200); // same payment, new event id
    expect(JSON.stringify(srv.db.prepare('SELECT * FROM entitlements').all())).toBe(rowsBefore);
    expect(srv.db.prepare("SELECT COUNT(*) AS n FROM entitlements WHERE user_id = 'life'").get().n).toBe(1);
    expect(srv.db.prepare("SELECT COUNT(*) AS n FROM paddle_events WHERE event_id = ?").get(event.event_id).n).toBe(1);
  });

  it('a payment for another product is acknowledged and changes nothing', async () => {
    seedUser(srv, 'foreign');
    const before = count(srv, 'entitlements');
    expect((await post(srv, txn({ userId: 'foreign', priceId: PRICES.other }))).status).toBe(200);
    expect(count(srv, 'entitlements')).toBe(before);
  });

  it('the existing subscription handlers still work, and a replayed subscription event is not run again', async () => {
    seedUser(srv, 'subbie');
    const event = {
      event_id: 'evt_sub_1', event_type: 'subscription.created', occurred_at: new Date().toISOString(),
      data: { id: 'sub_9', customer_id: 'ctm_sub', custom_data: { userId: 'subbie' }, current_billing_period: { ends_at: new Date(Date.now() + 30 * day).toISOString() }, items: [{ price: { id: PRICES.monthly, billing_cycle: { interval: 'month' } } }] },
    };
    expect((await post(srv, event)).status).toBe(200);
    const after = (await me(srv, 'subbie')).json;
    expect(after).toMatchObject({ subscription_status: 'active', subscription_plan: 'monthly', paddle_subscription_id: 'sub_9' });
    expect(srv.db.prepare("SELECT event_type FROM paddle_events WHERE event_id = 'evt_sub_1'").get()).toEqual({ event_type: 'subscription.created' });

    // The user cancels; then Paddle redelivers the old "created" event. It must not bring the subscription back.
    expect((await post(srv, { event_id: 'evt_sub_2', event_type: 'subscription.canceled', data: { id: 'sub_9', custom_data: { userId: 'subbie' } } })).status).toBe(200);
    expect((await me(srv, 'subbie')).json.subscription_status).toBe('cancelled');
    expect((await post(srv, event)).status).toBe(200);
    expect((await me(srv, 'subbie')).json.subscription_status).toBe('cancelled');
  });

  it('referral: the first payment credits both accounts once; a refund takes it back', async () => {
    seedUser(srv, 'refr', { email: 'refr@example.com' });
    seedUser(srv, 'newb', { email: 'newb@example.com' });
    const mine = await (await authed(srv, 'refr', '/api/referrals/me')).json();
    expect(mine.link).toMatch(/\?ref=[2-9A-Z]{8}$/);
    const attached = await (await authed(srv, 'newb', '/api/referrals/attach', { method: 'POST', body: JSON.stringify({ code: mine.code }) })).json();
    expect(attached).toEqual({ ok: true });

    const paid = txn({ userId: 'newb', priceId: PRICES.monthly, customerId: 'ctm_newb', last4: '1111' });
    expect((await post(srv, paid)).status).toBe(200);
    expect((await post(srv, paid)).status).toBe(200);                       // replay
    expect((await me(srv, 'refr')).json.entitlement.banked_days).toBe(30);
    expect((await me(srv, 'newb')).json.entitlement.banked_days).toBe(30);

    expect((await post(srv, refund(paid.data.id))).status).toBe(200);
    expect((await me(srv, 'refr')).json.entitlement.banked_days).toBeUndefined();
    expect((await me(srv, 'newb')).json.entitlement.banked_days).toBeUndefined();
  });

  it('self-referral over the wire: the same card pays for both accounts, and nobody is credited', async () => {
    seedUser(srv, 'selfa', { email: 'selfa@example.com' });
    seedUser(srv, 'selfb', { email: 'selfb@example.com' });
    expect((await post(srv, txn({ userId: 'selfa', priceId: PRICES.monthly, customerId: 'ctm_a', last4: '7777' }))).status).toBe(200);
    const mine = await (await authed(srv, 'selfa', '/api/referrals/me')).json();
    await authed(srv, 'selfb', '/api/referrals/attach', { method: 'POST', body: JSON.stringify({ code: mine.code }) });
    expect((await post(srv, txn({ userId: 'selfb', priceId: PRICES.monthly, customerId: 'ctm_b', last4: '7777' }))).status).toBe(200);
    expect((await me(srv, 'selfa')).json.entitlement.banked_days).toBeUndefined();
    expect((await me(srv, 'selfb')).json.entitlement.banked_days).toBeUndefined();
  });

  it('free tier: the limits are in /api/user/me for an account with nothing else', async () => {
    seedUser(srv, 'freebie', { subscription_status: 'expired', trial_end_date: new Date(Date.now() - day).toISOString() });
    expect((await me(srv, 'freebie')).json.entitlement).toEqual({ free_tier: { detection_minutes_per_day: 30, history_days: 7 } });
  });

  it('the redeem page exists while gift_plan is on, and is not indexable', async () => {
    const res = await fetch(`${srv.base}/redeem`);
    // Without a dist/ the shell is missing and the route falls through; with one it is a noindex page.
    if (res.status === 200) {
      expect(await res.text()).toContain('noindex');
      expect(res.headers.get('x-robots-tag')).toBe('noindex');
    } else {
      expect(res.status).toBe(404);
    }
  });
});

describe('with every flag off', () => {
  let srv;
  beforeAll(async () => { srv = await startServer(''); }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it('/api/user/me is exactly the users row', async () => {
    const row = seedUser(srv, 'plain');
    const { json } = await me(srv, 'plain');
    expect(json).toEqual(row);
    expect(Object.keys(json)).not.toContain('entitlement');
  });

  it('the WS9 routes are 404', async () => {
    seedUser(srv, 'nope');
    for (const [method, path] of [['GET', '/api/referrals/me'], ['POST', '/api/referrals/attach'], ['POST', '/api/billing/gift/redeem'], ['POST', '/api/billing/verify-transaction'], ['GET', '/redeem']]) {
      const res = await authed(srv, 'nope', path, { method, body: method === 'POST' ? '{}' : undefined });
      expect(res.status, `${method} ${path}`).toBe(404);
    }
  });

  it('a lifetime payment that arrives anyway is still honoured: paid-for access does not depend on a flag', async () => {
    seedUser(srv, 'early', { subscription_status: 'expired', trial_end_date: new Date(Date.now() - day).toISOString() });
    expect((await post(srv, txn({ userId: 'early', priceId: PRICES.lifetime }))).status).toBe(200);
    expect((await me(srv, 'early')).json.entitlement).toEqual({ grants: [{ kind: 'lifetime', ends_at: null }] });
  });

  it('referral rewards are not paid while referrals is off', async () => {
    seedUser(srv, 'r1'); seedUser(srv, 'r2');
    srv.db.prepare("INSERT INTO referral_codes (user_id, code, created_at) VALUES ('r1', 'ABCDEFGH', ?)").run(new Date().toISOString());
    srv.db.prepare("INSERT INTO referrals (referred_user_id, referrer_user_id, code, attached_at) VALUES ('r2', 'r1', 'ABCDEFGH', ?)").run(new Date().toISOString());
    expect((await post(srv, txn({ userId: 'r2', priceId: PRICES.monthly }))).status).toBe(200);
    expect((await me(srv, 'r1')).json.entitlement).toBeUndefined();
  });
});
