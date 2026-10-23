// A small Express app wired like server.js for the weekly email route tests: the
// cookie parser, the SAME global 10 kb JSON parser, the events module (for the
// habit_events table) and the weekly email module registered on an in-memory
// database, a fake sign-in (the `x-user` header carries the user id) and a real
// `users` table so the account email can be looked up.

import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from '../server/routes/index.js';
import { createEventsModule } from '../server/routes/events.js';
import { createWeeklyEmailModule } from '../server/routes/weeklyEmail.js';
import { createEventStore } from '../server/events/store.js';
import { createPrefsStore } from '../server/weeklyEmail/prefs.js';
import { signUnsubscribeToken } from '../server/weeklyEmail/token.js';
import { createMemoryDb } from './memorySqlite.js';
import { startTestServer } from './testServer.js';
import { fakeAuth } from './eventsHarness.js';

export const TEST_APP_URL = 'https://stopbiting.test';

/**
 * @param {object} [opts]
 * @param {string} [opts.flags]      FEATURE_FLAGS value (default 'weekly_email,event_sync,insights')
 * @param {object} [opts.module]     options for createWeeklyEmailModule
 * @param {object} [opts.config]     extra ctx.config (ELECTRON_PROTOCOL ...)
 */
export async function makeWeeklyEmailHarness({ flags = 'weekly_email,event_sync,insights', module = {}, config = {} } = {}) {
  const db = createMemoryDb({ users: true });
  const startJob = module.startJob ?? (() => {});
  const startJobSpy = (...args) => { startJobCalls.push(args); return startJob(...args); };
  const startJobCalls = [];
  const sendEmail = async () => ({ data: { id: 'x' }, error: null });

  const app = express();
  app.use(cookieParser());
  app.use((req, res, next) => express.json({ limit: '10kb' })(req, res, next));
  const ctx = registerRoutes(
    {
      app, db, authMiddleware: fakeAuth, sendEmail,
      getUser: id => db.prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null,
      config: { APP_URL: TEST_APP_URL, ...config },
    },
    [createEventsModule(), createWeeklyEmailModule({ ...module, startJob: startJobSpy })],
    { FEATURE_FLAGS: flags },
    () => {},
  );
  // What server.js has after the registry: a catch-all that would swallow a missed route.
  app.get('/{*path}', (_req, res) => res.status(404).type('html').send('<h1>page not found</h1>'));
  const srv = await startTestServer(app);

  const call = (method, path, { user, body, raw, headers = {} } = {}) =>
    fetch(`${srv.url}${path}`, {
      method,
      headers: {
        ...(user ? { 'x-user': user } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    });

  const prefs = createPrefsStore(db);
  const store = createEventStore(db);
  return {
    srv, db, ctx, call, prefs, store, startJobCalls,
    url: srv.url,
    close: () => srv.close(),
    addUser(id, email = `${id}@example.com`) {
      db.prepare('INSERT INTO users (id, email, name, trial_end_date, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, email, 'Name', '2030-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
      return id;
    },
    /** JSON body of GET /api/email/weekly as `user`. */
    async state(user) {
      const res = await call('GET', '/api/email/weekly', { user });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    async put(user, body) {
      const res = await call('PUT', '/api/email/weekly', { user, body });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    /** A valid unsubscribe token for `userId` (creates the preferences row if needed). */
    tokenFor(userId) {
      const row = prefs.ensure(userId);
      return signUnsubscribeToken(userId, row.unsubscribe_secret);
    },
    seedEvent(userId, ts = Date.now()) {
      store.sync(userId, [{ id: `e-${userId}-${ts}`, ts, source: 'manual', behavior: 'nail_biting', updatedAt: ts }], { since: 0 });
    },
  };
}
