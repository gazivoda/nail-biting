// Weekly summary email (WS5): the opt-in endpoints, the one-click unsubscribe, and
// the hourly job that sends the emails.
//
//   GET  /api/email/weekly                 -> { enabled, timezone, hasSyncedData, hasEmail, lastSentWeek }
//   PUT  /api/email/weekly                 { enabled: boolean, timezone?: string } -> the same shape
//   GET  /api/email/unsubscribe/:token     a page that ASKS ("Unsubscribe?"); changes nothing
//   POST /api/email/unsubscribe/:token     switches the weekly email off (RFC 8058 one-click lands here)
//
// The first two are behind the `weekly_email` flag (404 while it is off, for everyone)
// and need a signed-in user. The unsubscribe pair is deliberately NOT behind the flag
// and needs no sign-in: the link is already in people's inboxes, and a dead
// unsubscribe link after the owner switches the flag off would be a compliance
// problem (and honouring the link can only mean LESS email). A token is a signature
// over the person's id with their own random secret (server/weeklyEmail/token.js); it
// can do exactly one thing, switch that person's weekly email off.
//
// Why under /api/: the service worker's navigateFallback skips /api/, so the page an
// email link opens comes from this server and not from the cached app shell; and a
// plain navigation or a mail provider's server-to-server POST carries no Origin
// header, so the /api/ CORS check lets both through. The registry runs before the
// page catch-all, so these routes win.
//
// The email goes to the address on the account, never to one supplied by the client.
// It is built only from events the person synced (WS4); someone who never synced has
// nothing to summarise and gets nothing (server/jobs/weeklyEmail.js).

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createEventStore } from '../events/store.js';
import { clientIp } from '../auth/session.js';
import { startWeeklyEmailJob } from '../jobs/weeklyEmail.js';
import { WEEKLY_EMAIL_MIGRATIONS, createPrefsStore } from '../weeklyEmail/prefs.js';
import { readUnsubscribeToken, verifyUnsubscribeToken } from '../weeklyEmail/token.js';
import { validTimeZone } from '../weeklyEmail/week.js';
import { confirmPageHtml, doneUnsubscribedPageHtml, invalidLinkPageHtml } from '../weeklyEmail/template.js';

const PUT_KEYS = new Set(['enabled', 'timezone']);
const FALLBACK_APP_URL = 'https://stopbiting.today';

/**
 * @param {object} [options] overrides for tests
 * @param {Record<string, string | undefined>} [options.env]   defaults to process.env (read at registration, after .env is loaded)
 * @param {Function} [options.startJob]                         defaults to startWeeklyEmailJob
 * @param {{ windowMs?: number, limit?: number }} [options.manageRateLimit]
 * @param {{ windowMs?: number, limit?: number }} [options.unsubscribeRateLimit]
 * @param {() => number} [options.now]
 */
export function createWeeklyEmailModule(options = {}) {
  return {
    name: 'weeklyEmail',
    migrations: WEEKLY_EMAIL_MIGRATIONS,

    register(ctx) {
      const { app, db, authMiddleware, requireFeature, flags, getUser, sendEmail } = ctx;
      const appUrl = (ctx.config?.APP_URL || FALLBACK_APP_URL).replace(/\/+$/, '');
      const prefs = createPrefsStore(db, options.now ? { now: options.now } : {});
      const store = createEventStore(db);
      const gate = [requireFeature('weekly_email'), authMiddleware];

      const manageLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 30,
        ...options.manageRateLimit,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: req => `weekly-email:${req.userId}`,
        validate: false,
        message: { error: 'Too many requests, please slow down.' },
      });
      const unsubscribeLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 60,
        ...options.unsubscribeRateLimit,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: req => ipKeyGenerator(clientIp(req)),
        validate: false,
        message: { error: 'Too many requests, please slow down.' },
      });

      function stateFor(userId) {
        const row = prefs.get(userId);
        const user = getUser(userId);
        return {
          enabled: row?.weekly_summary === 1,
          timezone: row?.timezone ?? null,
          hasSyncedData: store.counts(userId).live > 0,
          hasEmail: typeof user?.email === 'string' && user.email.trim() !== '',
          lastSentWeek: row?.last_sent_week ?? null,
        };
      }

      app.get('/api/email/weekly', ...gate, manageLimiter, (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(stateFor(String(req.userId)));
      });

      app.put('/api/email/weekly', ...gate, manageLimiter, (req, res) => {
        res.set('Cache-Control', 'no-store');
        const body = req.body;
        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
          return res.status(400).json({ error: 'invalid_request', field: 'body' });
        }
        for (const key of Object.keys(body)) {
          if (!PUT_KEYS.has(key)) return res.status(400).json({ error: 'invalid_request', field: key });
        }
        if (typeof body.enabled !== 'boolean') return res.status(400).json({ error: 'invalid_request', field: 'enabled' });
        let timezone = null;
        if (body.timezone !== undefined) {
          timezone = validTimeZone(body.timezone);
          if (timezone === null) return res.status(400).json({ error: 'invalid_request', field: 'timezone' });
        }

        const userId = String(req.userId);
        if (body.enabled) {
          // The address always comes from the account, never from the request.
          const user = getUser(userId);
          if (typeof user?.email !== 'string' || user.email.trim() === '') {
            return res.status(400).json({ error: 'no_email' });
          }
        }
        prefs.setEnabled(userId, body.enabled, timezone);
        return res.json(stateFor(userId));
      });

      // ── Unsubscribe (not behind the flag, no sign-in: see the header) ───────────
      const noStore = res => {
        res.set({
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
          'X-Robots-Tag': 'noindex, nofollow',
        });
      };

      /** The user id the token is valid for, or null. Unknown person and forged token look the same. */
      function resolveToken(token) {
        const parsed = readUnsubscribeToken(token);
        if (!parsed) return null;
        const row = prefs.get(parsed.userId);
        if (!row) return null;
        return verifyUnsubscribeToken(token, row.unsubscribe_secret) ? parsed.userId : null;
      }

      app.get('/api/email/unsubscribe/:token', unsubscribeLimiter, (req, res) => {
        noStore(res);
        const userId = resolveToken(req.params.token);
        if (userId === null) return res.status(404).type('html').send(invalidLinkPageHtml(appUrl));
        // Opening the link changes nothing: mail scanners and link previewers open links.
        return res.status(200).type('html').send(confirmPageHtml(`/api/email/unsubscribe/${req.params.token}`));
      });

      app.post('/api/email/unsubscribe/:token', unsubscribeLimiter, (req, res) => {
        noStore(res);
        const wantsJson = req.accepts(['html', 'json']) === 'json';
        const userId = resolveToken(req.params.token);
        if (userId === null) {
          return wantsJson
            ? res.status(404).json({ error: 'not_found' })
            : res.status(404).type('html').send(invalidLinkPageHtml(appUrl));
        }
        prefs.unsubscribe(userId);
        return wantsJson ? res.json({ ok: true }) : res.status(200).type('html').send(doneUnsubscribedPageHtml(appUrl));
      });

      // ── The hourly job ─────────────────────────────────────────────────────────
      // Only with the flag on, a configured provider (checked in startWeeklyEmailJob), and not in
      // the desktop app's embedded server (it has its own database and must not send mail).
      if (flags.isOn('weekly_email') && !ctx.config?.ELECTRON_PROTOCOL) {
        (options.startJob ?? startWeeklyEmailJob)({ db, send: sendEmail, appUrl, env: options.env ?? process.env });
      }
    },
  };
}

export default createWeeklyEmailModule();
