// A small Express app wired like server.js for the event sync tests: cookie
// parser, the SAME global 10 kb JSON parser with the SAME exemption for
// /api/events/sync (server/routes/events.test.js greps server.js to prove the
// exemption is really there), the events module registered on an in-memory
// database, and a fake sign-in (the `x-user` header carries the user id).
//
// Used by the route tests and by the two-browser convergence test, which talks
// to this app over real HTTP with real fetch.

import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from '../server/routes/index.js';
import { createEventsModule } from '../server/routes/events.js';
import { createMemoryDb } from './memorySqlite.js';
import { startTestServer } from './testServer.js';

export function fakeAuth(req, res, next) {
  const id = req.headers['x-user'];
  if (!id) return res.status(401).json({ error: 'Unauthorized' });
  req.userId = id;
  next();
}

/**
 * @param {object} [opts]
 * @param {string} [opts.flags]       FEATURE_FLAGS value (default 'event_sync')
 * @param {object} [opts.module]      options for createEventsModule (limits, rate limits)
 * @param {object} [opts.db]          reuse a database
 */
export async function makeEventsHarness({ flags = 'event_sync', module = {}, db = createMemoryDb({ users: true }) } = {}) {
  const app = express();
  app.use(cookieParser());
  // Same shape as server.js: 10kb everywhere except the paths that parse their own body.
  app.use((req, res, next) => {
    if (req.path === '/api/events/sync') return next();
    express.json({ limit: '10kb' })(req, res, next);
  });
  registerRoutes(
    { app, db, authMiddleware: fakeAuth },
    [createEventsModule(module)],
    { FEATURE_FLAGS: flags },
    () => {},
  );
  // What server.js has after the registry: a catch-all that would swallow a missed API route.
  app.get('/{*path}', (_req, res) => res.status(404).type('html').send('<h1>page not found</h1>'));
  const srv = await startTestServer(app);

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

  return {
    srv,
    db,
    url: srv.url,
    call,
    close: () => srv.close(),
    /** POST /api/events/sync as `user`. Returns { status, body }. */
    async sync(user, body) {
      const res = await call('POST', '/api/events/sync', { user, body });
      return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
    },
    async status(user) {
      const res = await call('GET', '/api/events/status', { user });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    async wipe(user) {
      const res = await call('DELETE', '/api/events', { user });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    maxSeq: () => db.prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM habit_events').get().m,
    rows: userId => db.prepare('SELECT * FROM habit_events WHERE user_id = ? ORDER BY seq').all(userId),
  };
}

/** A valid wire event with sensible defaults. */
export function ev(id, over = {}) {
  return { id, ts: 1_700_000_000_000, source: 'manual', behavior: 'nail_biting', updatedAt: 1_700_000_000_000, ...over };
}
