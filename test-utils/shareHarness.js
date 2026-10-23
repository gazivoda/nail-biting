// A small Express app wired like server.js for the share-link tests: cookie parser, the
// same global 10 kb JSON parser, the events module (so `habit_events` exists and a test can
// seed history through the real store) and the share module, on an in-memory database with
// a `users` table that holds recognisable personal data. Sign-in is faked: the `x-user`
// header carries the user id.
//
// The harness records every SQL string handed to `db.prepare` / `db.exec` (`harness.sql`;
// `harness.bootSql` is the part from registering the routes), so a test can prove the public
// routes never reach the users table.

import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from '../server/routes/index.js';
import { createEventsModule } from '../server/routes/events.js';
import { createShareModule } from '../server/routes/share.js';
import { createEventStore } from '../server/events/store.js';
import { createMemoryDb } from './memorySqlite.js';
import { startTestServer } from './testServer.js';
import { fakeAuth } from './eventsHarness.js';

export { fakeAuth };

/** A fixed clock the tests can move: `clock.now()`, `clock.set(ms)`, `clock.advance(ms)`. */
export function makeClock(start = Date.UTC(2026, 9, 21, 12, 0, 0)) {
  let t = start;
  return { now: () => t, set: v => { t = v; }, advance: ms => { t += ms; } };
}

/**
 * @param {object} [opts]
 * @param {string} [opts.flags]    FEATURE_FLAGS value (default 'event_sync,share_links')
 * @param {object} [opts.module]   options for createShareModule
 * @param {object} [opts.db]       reuse a database (e.g. to boot the same data with the flag off)
 * @param {ReturnType<typeof makeClock>} [opts.clock]
 * @param {object} [opts.config]   ctx.config
 */
export async function makeShareHarness({ flags = 'event_sync,share_links', module = {}, db, clock = makeClock(), config } = {}) {
  const database = db ?? createMemoryDb({ users: true });

  const sql = [];
  const origPrepare = database.prepare.bind(database);
  const origExec = database.exec.bind(database);
  database.prepare = text => { sql.push(String(text)); return origPrepare(text); };
  database.exec = text => { sql.push(String(text)); return origExec(text); };

  const app = express();
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (req.path === '/api/events/sync') return next();
    express.json({ limit: '10kb' })(req, res, next);
  });
  registerRoutes(
    { app, db: database, authMiddleware: fakeAuth, config },
    [createEventsModule(), createShareModule({ now: clock.now, ...module })],
    { FEATURE_FLAGS: flags },
    () => {},
  );
  // What server.js has after the registry: a catch-all that answers the page 404.
  app.get('/{*path}', (_req, res) => res.status(404).type('html').send('<h1>site not found page</h1>'));
  const srv = await startTestServer(app);
  const bootSql = [...sql]; // everything prepared while the routes were registered (statements are prepared once, there)

  const call = (method, path, { user, body, raw, headers = {} } = {}) =>
    fetch(`${srv.url}${path}`, {
      method,
      headers: {
        ...(user ? { 'x-user': user } : {}),
        ...(body !== undefined || raw !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    });

  const store = createEventStore(database, { now: clock.now });

  return {
    srv,
    db: database,
    url: srv.url,
    clock,
    call,
    sql,
    bootSql,
    close: () => srv.close(),

    /** A user row with recognisable personal data (to prove it never reaches a public response). */
    addUser(id, { email = `${id}@leak.example`, name = `Name ${id} LEAK` } = {}) {
      database.prepare(
        "INSERT OR REPLACE INTO users (id, email, name, trial_end_date, created_at) VALUES (?, ?, ?, '2099-01-01', '2026-01-01')",
      ).run(id, email, name);
      return { id, email, name };
    },

    /** Writes events through the real event store (what WS4 sync would have written). */
    seed(userId, events) {
      return store.sync(userId, events.map(e => ({ updatedAt: e.ts, ...e })), { quota: 1e9 });
    },

    /** POST /api/share/links as `user`. Returns { status, body, headers }. */
    async create(user, body = {}) {
      const res = await call('POST', '/api/share/links', { user, body });
      return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
    },
    async list(user) {
      const res = await call('GET', '/api/share/links', { user });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    async revoke(user, id) {
      const res = await call('DELETE', `/api/share/links/${id}`, { user });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    /** GET /share/:token. Returns { status, text, headers }. */
    async page(token, init) {
      const res = await fetch(`${srv.url}/share/${token}`, init);
      return { status: res.status, text: await res.text(), headers: res.headers };
    },
    /** GET /share/:token/data.json. Returns { status, text, json, headers }. */
    async data(token, init) {
      const res = await fetch(`${srv.url}/share/${token}/data.json`, init);
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* not JSON */ }
      return { status: res.status, text, json, headers: res.headers };
    },
    linkRows: () => database.prepare('SELECT * FROM share_links ORDER BY created_at, id').all(),
  };
}

/** Headers as a plain object without the ones that legitimately differ per response. */
export function stableHeaders(headers) {
  const out = {};
  for (const [k, v] of headers.entries()) if (k !== 'date') out[k] = v;
  return out;
}

/** An alarm / manual event on the wire. `ts` is required. */
export function ev(partial) {
  return {
    id: `e-${Math.random().toString(36).slice(2)}`,
    source: 'manual',
    behavior: 'nail_biting',
    ...partial,
  };
}
