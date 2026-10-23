// A small Express app wired like server.js (JSON parser, a session stand-in) with the WS9 billing
// module registered on an in-memory database. No network, no real Paddle, no real email. Used by the
// server/billing and server/routes billing tests.
//
// The session stand-in reads the `x-test-user` header; without it the request is a 401, like a missing
// cookie. Paddle events are built by the fixture functions below. THEY ARE WRITTEN FROM PADDLE'S
// DOCUMENTED PAYLOAD SHAPES, NOT RECORDED FROM A LIVE ACCOUNT (see server/billing/paddleData.js).

import express from 'express';
import { buildContext } from '../server/routes/index.js';
import { runMigrations } from '../server/db/migrate.js';
import billing, { registerBilling } from '../server/routes/billing.js';
import { createMemoryDb } from './memorySqlite.js';
import { startTestServer } from './testServer.js';

export const T0 = Date.parse('2026-10-23T12:00:00.000Z');
export const DAY = 86_400_000;
export const PRICES = { monthly: 'pri_monthly', yearly: 'pri_yearly', lifetime: 'pri_lifetime', gift: 'pri_gift', other: 'pri_other_product' };

function userFunctions(db) {
  const stmtGet = db.prepare('SELECT * FROM users WHERE id = ?');
  const stmtByEmail = db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
  const stmtUpsert = db.prepare(`
    INSERT INTO users (id, email, name, avatar, trial_end_date, subscription_status,
      subscription_plan, subscription_end_date, paddle_subscription_id, paddle_customer_id, created_at)
    VALUES (@id, @email, @name, @avatar, @trial_end_date, @subscription_status,
      @subscription_plan, @subscription_end_date, @paddle_subscription_id, @paddle_customer_id, @created_at)
    ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name, avatar = excluded.avatar,
      trial_end_date = excluded.trial_end_date, subscription_status = excluded.subscription_status,
      subscription_plan = excluded.subscription_plan, subscription_end_date = excluded.subscription_end_date,
      paddle_subscription_id = excluded.paddle_subscription_id, paddle_customer_id = excluded.paddle_customer_id`);
  const getUser = id => stmtGet.get(id) ?? null;
  const saveUser = user => {
    stmtUpsert.run({
      id: user.id, email: user.email ?? null, name: user.name ?? null, avatar: user.avatar ?? null,
      trial_end_date: user.trial_end_date, subscription_status: user.subscription_status,
      subscription_plan: user.subscription_plan ?? null, subscription_end_date: user.subscription_end_date ?? null,
      paddle_subscription_id: user.paddle_subscription_id ?? null, paddle_customer_id: user.paddle_customer_id ?? null,
      created_at: user.created_at,
    });
    return getUser(user.id);
  };
  return { getUser, saveUser, findUserByEmail: email => stmtByEmail.get(email) ?? null };
}

/**
 * @param {object} [opts]
 * @param {string} [opts.flags]   FEATURE_FLAGS value
 * @param {object} [opts.env]     env for the module (price ids, credit days, ...)
 * @param {Function} [opts.fetchImpl]  stands in for Paddle's API (customers, transactions)
 * @param {boolean} [opts.listen] start an HTTP server (default true)
 */
export async function makeBilling({ flags = 'referrals,gift_plan,lifetime_plan', env = {}, fetchImpl, listen = true, sendEmail, shellPath = '/nonexistent/index.html' } = {}) {
  const db = createMemoryDb({ users: true });
  const fns = userFunctions(db);
  const clock = { t: T0, now: () => clock.t, advance: ms => { clock.t += ms; }, set: t => { clock.t = t; } };
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  const sent = [];
  const logs = [];
  const errors = [];
  const warns = [];
  const mail = sendEmail ?? (async message => { sent.push(message); return { data: { id: 'test' }, error: null }; });
  const fullEnv = {
    PADDLE_API_KEY: 'pdl_test', PADDLE_ENV: 'sandbox',
    PADDLE_PRICE_ID_LIFETIME: PRICES.lifetime, PADDLE_PRICE_ID_GIFT: PRICES.gift,
    PADDLE_PRICE_ID_MONTHLY: PRICES.monthly, PADDLE_PRICE_ID_YEARLY: PRICES.yearly,
    ...env,
  };

  const authMiddleware = (req, res, next) => {
    const id = req.headers['x-test-user'];
    if (!id) return res.status(401).json({ error: 'Unauthorized' });
    req.userId = String(id);
    next();
  };
  const ctx = buildContext({
    app, db, authMiddleware, ...fns, signToken: id => `session-for:${id}`,
    sendEmail: mail,
    config: { APP_URL: 'https://stopbiting.test', ELECTRON_PROTOCOL: null },
  }, { FEATURE_FLAGS: flags }, undefined);

  runMigrations(db, billing.migrations);
  registerBilling(ctx, {
    env: fullEnv, now: clock.now, fetchImpl, sendEmail: mail, shellPath,
    log: (...a) => logs.push(a.join(' ')), logError: (...a) => errors.push(a.join(' ')), warn: (...a) => warns.push(a.join(' ')),
  });

  // Like the catch-all in server.js: anything unmatched is a 404.
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  const server = listen ? await startTestServer(app) : null;
  const url = server?.url;
  const call = async (path, { method = 'GET', user, body, headers = {} } = {}) => {
    const res = await fetch(`${url}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text, headers: res.headers };
  };

  const addUser = (fields = {}) => {
    const id = fields.id ?? `u${Math.random().toString(36).slice(2, 8)}`;
    return fns.saveUser({
      id, email: `${id}@example.com`, name: id, avatar: null,
      trial_end_date: new Date(clock.t + 3 * DAY).toISOString(),
      subscription_status: 'trial', subscription_plan: null, subscription_end_date: null,
      paddle_subscription_id: null, paddle_customer_id: null,
      created_at: new Date(clock.t).toISOString(),
      ...fields,
    });
  };

  return {
    db, app, ctx, url, call, addUser, clock, sent, logs, errors, warns, env: fullEnv,
    ...fns,
    billing: app.locals.billing,
    decorate: u => app.locals.decorateUser(u),
    webhook: app.locals.billingWebhook,
    close: async () => { await server?.close(); db.close(); },
  };
}

// ─── Paddle payload fixtures ─────────────────────────────────────────────────

let counter = 0;
const nextId = prefix => `${prefix}_${String(++counter).padStart(6, '0')}`;

export function card({ type = 'visa', last4 = '4242', month = 12, year = 2030 } = {}) {
  return { status: 'captured', method_details: { type: 'card', card: { type, last4, expiry_month: month, expiry_year: year, cardholder_name: 'A Person' } } };
}

/** A transaction.completed event. */
export function transactionCompleted({
  eventId = nextId('evt'), txnId = nextId('txn'), priceId = PRICES.lifetime, userId = 'u1', customerId = 'ctm_1',
  origin = 'web', payment = card(), total = '499', subscriptionId = null, occurredAt = '2026-10-23T12:00:00.000Z', customData,
} = {}) {
  return {
    event_id: eventId, event_type: 'transaction.completed', occurred_at: occurredAt, notification_id: nextId('ntf'),
    data: {
      id: txnId, status: 'completed', customer_id: customerId, address_id: 'add_1', origin, subscription_id: subscriptionId,
      custom_data: customData === undefined ? (userId ? { userId } : null) : customData,
      currency_code: 'USD',
      items: [{ price: { id: priceId, billing_cycle: null }, quantity: 1 }],
      details: { totals: { subtotal: total, total, grand_total: total, currency_code: 'USD' }, line_items: [{ price_id: priceId, quantity: 1 }] },
      payments: payment ? [payment] : [],
      created_at: occurredAt, billed_at: occurredAt,
    },
  };
}

/** An adjustment.created / adjustment.updated event for a refund or chargeback. */
export function adjustment({ eventId = nextId('evt'), type = 'adjustment.updated', txnId, action = 'refund', status = 'approved', kind = 'full' } = {}) {
  return {
    event_id: eventId, event_type: type, occurred_at: '2026-10-24T09:00:00.000Z',
    data: { id: nextId('adj'), transaction_id: txnId, action, type: kind, status, reason: 'test', currency_code: 'USD' },
  };
}

/** A subscription.* event, which server.js's existing handlers deal with. */
export function subscriptionEvent({ eventId = nextId('evt'), type = 'subscription.created', userId = 'u1' } = {}) {
  return { event_id: eventId, event_type: type, occurred_at: '2026-10-23T12:00:00.000Z', data: { id: 'sub_1', customer_id: 'ctm_1', custom_data: { userId } } };
}
