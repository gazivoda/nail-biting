// A small Express app wired like server.js (cookie parser, 10kb JSON parser) with
// the WS8 sign-in module registered on an in-memory database. No network, no real
// providers, no data/users.db. Used by the server/auth and server/routes tests.

import { generateKeyPairSync } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { buildContext } from '../server/routes/index.js';
import { runMigrations } from '../server/db/migrate.js';
import { AUTH_MIGRATIONS } from '../server/auth/schema.js';
import { registerAuthProviders } from '../server/routes/authProviders.js';
import { createMemoryDb } from './memorySqlite.js';
import { startTestServer } from './testServer.js';

export const ALL_FLAGS = 'signin_magic_link,signin_apple,signin_microsoft';

/** The users upsert from server.js, so saveUser behaves like production. */
function userFunctions(db) {
  const stmtGet = db.prepare('SELECT * FROM users WHERE id = ?');
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
  return { getUser, saveUser };
}

export function seedUser(db, fields) {
  const { saveUser } = userFunctions(db);
  return saveUser({
    name: null, avatar: null,
    trial_end_date: new Date(Date.now() + 86400000).toISOString(),
    subscription_status: 'trial', created_at: '2026-01-01T00:00:00.000Z',
    ...fields,
  });
}

/**
 * @param {object} [opts]
 * @param {string} [opts.flags]     FEATURE_FLAGS value
 * @param {object} [opts.env]       env for the module (RESEND_API_KEY, APPLE_*, MICROSOFT_*)
 * @param {object} [opts.deps]      overrides for registerAuthProviders (fetchImpl, now, clients, shellPath)
 * @param {object} [opts.config]    overrides for ctx.config (APP_URL, ELECTRON_PROTOCOL)
 * @param {boolean} [opts.listen]   start an HTTP server (default true)
 */
export async function makeHarness({ flags = ALL_FLAGS, env = {}, deps = {}, config = {}, listen = true } = {}) {
  const db = createMemoryDb({ users: true });
  runMigrations(db, AUTH_MIGRATIONS);
  const { getUser, saveUser } = userFunctions(db);
  const app = express();
  app.use(cookieParser());
  app.use(express.json({ limit: '10kb' }));

  const sent = [];
  const welcomed = [];
  const logged = [];
  const ctx = buildContext({
    app, db, getUser, saveUser,
    signToken: id => `session-for:${id}`,
    authMiddleware: (_req, _res, next) => next(),
    // Like the Resend SDK: a result object, { data, error }, not a throw.
    sendEmail: async message => { sent.push(message); return { data: { id: 'test' }, error: null }; },
    config: { APP_URL: 'http://localhost:5199', ELECTRON_PROTOCOL: null, ...config },
  }, { FEATURE_FLAGS: flags }, );

  registerAuthProviders(ctx, {
    env: { RESEND_API_KEY: 're_test', ...env },
    sendWelcomeEmail: async user => { welcomed.push(user); },
    sendAdminNotification: async () => {},
    log: (...args) => logged.push(args.join(' ')),
    ...deps,
  });

  // Like the catch-all in server.js: anything unmatched is a 404.
  app.use((_req, res) => res.status(404).json({ error: 'catch-all 404' }));

  const server = listen ? await startTestServer(app) : null;
  return { db, app, ctx, sent, welcomed, logged, url: server?.url, close: () => server?.close(), getUser, saveUser };
}

/** Pulls `name=value` pairs out of a fetch Response's Set-Cookie headers. */
export function cookiesFrom(res) {
  const out = {};
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    out[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
  }
  return out;
}

export const cookieHeader = jar => Object.entries(jar).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');

export function postJson(url, body, headers = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
}

/** An RSA key pair standing in for a provider's signing key, plus its public JWK. */
export function makeSigningKey(kid = 'test-key-1') {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' };
  const sign = (payload, { alg = 'RS256', keyid = kid, key = privateKey } = {}) =>
    jwt.sign(payload, key, { algorithm: alg, keyid });
  return { kid, jwk, privateKey, sign };
}

/** A fetch stub that answers by URL prefix. Records every call. */
export function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    for (const [prefix, handler] of Object.entries(routes)) {
      if (String(url).startsWith(prefix)) {
        const { status = 200, body } = await handler(String(url), init);
        return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
      }
    }
    return new Response('{}', { status: 404 });
  };
  impl.calls = calls;
  return impl;
}
