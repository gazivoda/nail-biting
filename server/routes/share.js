// Read-only share links (WS10). Everything here is behind the `share_links` flag: while
// it is off every path answers 404 (the owner API with {"error":"Not found"}, the
// page with whatever the site answers for an unknown address).
//
// Owner API (signed in; the flag is checked first, then sign-in):
//   POST   /api/share/links       { label?, expiresInDays? (7|30|90|null), detailed?, timezone? }
//                                 -> 201 { id, token, url, label, createdAt, expiresAt, detailed }
//                                 THE ONLY TIME the token is ever returned.
//   GET    /api/share/links       -> { links: [{ id, label, createdAt, expiresAt, lastViewedAt, detailed }],
//                                     max, syncedEntries }   (no tokens)
//   DELETE /api/share/links/:id   -> { ok: true }, or 404 for a link that is not yours / not active
//
// Public (no sign-in, no cookie; the token in the address IS the credential):
//   GET /share/:token             the summary page (self-contained HTML, see server/share/page.js)
//   GET /share/:token/data.json   the same summary as JSON (server/share/summary.js)
//
// Rules the public routes keep, and server/share/*.test.js and share.test.js pin:
//   * An unknown, malformed, revoked or expired token gets ONE answer: the same status, body and
//     headers. The lookup is a single query that already excludes revoked and expired links, so
//     the two cases are not even distinguishable inside this file.
//   * Every response is `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` and
//     `Referrer-Policy: no-referrer`; none sets a cookie.
//   * What a link can show is exactly the object server/share/summary.js builds from the OWNER's
//     synced events (server/events/store.js). The public handlers get the two stores they need
//     and nothing else: no `getUser`, no users table, so a name or email cannot be reached.
//   * Rate limited per caller, with a stricter second limit that only counts misses.
//
// The page is served from this module, not from dist/index.html: that shell loads Google
// Analytics, and a share address contains the token. server.js has one line that keeps its
// "lower-case page URLs" redirect away from /share/ (tokens are mixed case).

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { createEventStore } from '../events/store.js';
import { clientIp } from '../auth/session.js';
import { SHARE_MIGRATIONS, createShareStore } from '../share/links.js';
import { generateToken, hashToken, isWellFormedToken } from '../share/tokens.js';
import { buildShareView, normalizeTimezone } from '../share/summary.js';
import { NOT_FOUND_PAGE, TOO_MANY_PAGE, pageCsp, renderSharePage } from '../share/page.js';

export const MAX_ACTIVE_LINKS = 5;
export const EXPIRY_CHOICES_DAYS = Object.freeze([7, 30, 90]);
export const DEFAULT_EXPIRY_DAYS = 30;
export const MAX_LABEL_LENGTH = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const CREATE_KEYS = new Set(['label', 'expiresInDays', 'detailed', 'timezone']);
const JSON_CSP = "default-src 'none'; frame-ancestors 'none'";

const bad = (res, field, why) => res.status(400).json({ error: 'invalid_request', field, why });

/** Validates a create request. Returns { ok: true, value } or { ok: false, field, why }. */
export function parseCreateRequest(body) {
  if (body === undefined || body === null) body = {};
  if (typeof body !== 'object' || Array.isArray(body)) return { ok: false, field: 'body', why: 'must be an object' };
  for (const key of Object.keys(body)) {
    if (!CREATE_KEYS.has(key)) return { ok: false, field: key, why: 'not allowed' };
  }

  let label = '';
  if (body.label !== undefined) {
    if (typeof body.label !== 'string') return { ok: false, field: 'label', why: 'must be a string' };
    label = body.label.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (label.length > MAX_LABEL_LENGTH) return { ok: false, field: 'label', why: `at most ${MAX_LABEL_LENGTH} characters` };
  }

  let expiresInDays = DEFAULT_EXPIRY_DAYS;
  if (body.expiresInDays !== undefined) {
    if (body.expiresInDays !== null && !EXPIRY_CHOICES_DAYS.includes(body.expiresInDays)) {
      return { ok: false, field: 'expiresInDays', why: 'must be 7, 30, 90 or null' };
    }
    expiresInDays = body.expiresInDays;
  }

  if (body.detailed !== undefined && typeof body.detailed !== 'boolean') return { ok: false, field: 'detailed', why: 'must be true or false' };
  if (body.timezone !== undefined && typeof body.timezone !== 'string') return { ok: false, field: 'timezone', why: 'must be a string' };

  return {
    ok: true,
    value: {
      label,
      expiresInDays,
      detailed: body.detailed === true,
      timezone: normalizeTimezone(body.timezone),
    },
  };
}

/**
 * @param {object} [options] overrides for tests
 * @param {number} [options.maxActiveLinks]
 * @param {() => number} [options.now]
 * @param {() => string} [options.newToken]
 * @param {{ windowMs?: number, limit?: number }} [options.publicRateLimit]  every public request
 * @param {{ windowMs?: number, limit?: number }} [options.missRateLimit]    only requests that end in 404
 * @param {{ windowMs?: number, limit?: number }} [options.ownerRateLimit]   per signed-in user
 */
export function createShareModule(options = {}) {
  const now = options.now ?? Date.now;

  return {
    name: 'share',
    migrations: SHARE_MIGRATIONS,

    register({ app, db, authMiddleware, requireFeature, flags, config }) {
      const maxActive = options.maxActiveLinks ?? MAX_ACTIVE_LINKS;
      const links = createShareStore(db, { now });
      const events = createEventStore(db);
      const appUrl = (config?.APP_URL ?? '').replace(/\/+$/, '');

      // ── Owner API ─────────────────────────────────────────────────────────
      const ownerLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 60,
        ...options.ownerRateLimit,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: req => `share:${req.userId}`,
        validate: false,
        message: { error: 'Too many requests, please slow down.' },
      });
      const ownerGate = [requireFeature('share_links'), authMiddleware, ownerLimiter];

      app.post('/api/share/links', ...ownerGate, (req, res) => {
        res.set('Cache-Control', 'no-store');
        const parsed = parseCreateRequest(req.body);
        if (!parsed.ok) return bad(res, parsed.field, parsed.why);
        const { label, expiresInDays, detailed, timezone } = parsed.value;
        const userId = String(req.userId);

        links.purgeStale();
        const token = (options.newToken ?? generateToken)();
        const made = links.create({
          userId,
          tokenHash: hashToken(token),
          detailed,
          label,
          expiresAt: expiresInDays === null ? null : now() + expiresInDays * DAY_MS,
          timezone,
          maxActive,
        });
        if (!made.ok) return res.status(409).json({ error: made.code, limit: made.limit });

        const origin = appUrl || `${req.protocol}://${req.get('host')}`;
        return res.status(201).json({ ...made.link, token, url: `${origin}/share/${token}` });
      });

      app.get('/api/share/links', ...ownerGate, (req, res) => {
        res.set('Cache-Control', 'no-store');
        const userId = String(req.userId);
        res.json({ links: links.listActive(userId), max: maxActive, syncedEntries: events.counts(userId).live });
      });

      app.delete('/api/share/links/:id', ...ownerGate, (req, res) => {
        res.set('Cache-Control', 'no-store');
        if (!links.revoke(String(req.userId), String(req.params.id))) return res.status(404).json({ error: 'Not found' });
        return res.json({ ok: true });
      });

      // ── Public routes ─────────────────────────────────────────────────────
      const CSP = { page: pageCsp({ script: true }), dead: pageCsp({ script: false }), json: JSON_CSP };

      function setPrivateHeaders(res, csp) {
        res.set({
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
          'Referrer-Policy': 'no-referrer',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': csp,
        });
      }

      // No RateLimit-* headers: they change with every request, and a dead-link answer must be
      // byte-identical whatever the link's history. A refused request still says how long to wait.
      const limiter = (cfg, extra = {}) => rateLimit({
        ...cfg,
        standardHeaders: false,
        legacyHeaders: false,
        keyGenerator: req => ipKeyGenerator(clientIp(req)),
        validate: false,
        handler: (req, res) => {
          const resetAt = req.rateLimit?.resetTime?.getTime?.() ?? now() + 60_000;
          res.set('Retry-After', String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))));
          if (res.locals.shareKind === 'page') {
            setPrivateHeaders(res, CSP.dead);
            return res.status(429).type('html').send(TOO_MANY_PAGE);
          }
          setPrivateHeaders(res, CSP.json);
          return res.status(429).json({ error: 'too_many_requests' });
        },
        ...extra,
      });
      const publicLimiter = limiter({ windowMs: 10 * 60 * 1000, limit: 120, ...options.publicRateLimit });
      // Counts only answers >= 400, i.e. misses: a script trying tokens runs out far sooner than a person reading.
      const missLimiter = limiter({ windowMs: 10 * 60 * 1000, limit: 20, ...options.missRateLimit }, { skipSuccessfulRequests: true });

      const kind = which => (_req, res, next) => { res.locals.shareKind = which; next(); };
      const pageGate = (_req, _res, next) => (flags.isOn('share_links') ? next() : next('route'));

      /** THE answer for every dead link. Nothing in it depends on why the link is dead. */
      function sendNotFound(res, which) {
        if (which === 'page') {
          setPrivateHeaders(res, CSP.dead);
          return res.status(404).type('html').send(NOT_FOUND_PAGE);
        }
        setPrivateHeaders(res, CSP.json);
        return res.status(404).json({ error: 'Not found' });
      }

      const view = which => (req, res) => {
        const token = req.params.token;
        if (!isWellFormedToken(token)) return sendNotFound(res, which);
        try {
          const link = links.findActiveByHash(hashToken(token));
          if (!link) return sendNotFound(res, which);

          const summary = buildShareView(events.listUserEvents(link.userId), {
            detailed: link.detailed,
            timezone: link.timezone,
            now: now(),
          });
          if (req.method !== 'HEAD') links.touchViewed(link.id);

          setPrivateHeaders(res, which === 'page' ? CSP.page : CSP.json);
          if (which === 'page') return res.status(200).type('html').send(renderSharePage(summary));
          return res.status(200).json(summary);
        } catch (err) {
          console.error('[share] view failed:', err?.code ?? err?.message);
          setPrivateHeaders(res, CSP.dead);
          return res.status(500).type('text/plain').send('Something went wrong.');
        }
      };

      app.get('/share/:token/data.json', requireFeature('share_links'), kind('json'), publicLimiter, missLimiter, view('json'));
      app.get('/share/:token', pageGate, kind('page'), publicLimiter, missLimiter, view('page'));
    },
  };
}

export default createShareModule();
