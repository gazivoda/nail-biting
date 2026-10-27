import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomBytes, createHmac } from 'crypto';
import { sendWelcomeEmail, sendAdminNotification, sendFeedbackEmail } from './email.js';
import { startTrialFollowupJob } from './trialFollowup.js';
import { registerRoutes } from './server/routes/index.js';
import { createGoogleLinker } from './server/auth/googleLink.js';
import {
  gatedFooterLinks, gatedLinksArticleHtml, gatedLinksMarkerTag,
  gatedLlmsFullText, gatedLlmsTxtLines, gatedNavLinks, gatedSitemapEntries, isClosedGatedFile, isGateOpen, jsonForScript,
  openGatedPages, pathOfPageData, resolveGatedPage, withGatedLlmsFull, withGatedLlmsTxt, withGatedSitemapEntries, withoutClosedPageLinks,
} from './server/marketing/gatedPages.js';
import { createCopyIsOn } from './server/marketing/copyFlags.js';
import { createLifetimeCopy } from './server/marketing/lifetimeCopy.js';   // the Lifetime plan in the words crawlers read (flag lifetime_plan)
import { anyRuleActive, fillCopyTokens, flagAware, flagAwareDeep } from './shared/flagCopy.js';   // WS11b: copy that follows the feature flags
import { TRIAL_HYPHEN, TRIAL_MS, describeDays, lifetimePriceUsd, referralCreditDays } from './shared/plans.js';   // WS9: the one trial length (TRIAL_DAYS), the Lifetime list price
import {
  decorateEnglishHtml, liveLocales, loadLocaleFiles, localeStates, localizedNoscriptNav, registerLocalePages, servedLocales,
  withLocaleAlternates,
} from './server/marketing/localePages.js';   // WS12b: the localized marketing pages (Spanish, German, Brazilian Portuguese)

// In Electron, env vars are injected by the main process via spawn().
// In web dev (npm run dev), load from .env using Node's built-in (v20.12+).
if (!process.env.GOOGLE_CLIENT_ID) {
  try { process.loadEnvFile(); } catch { /* .env missing — rely on process.env */ }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// ─── Config ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET           = process.env.JWT_SECRET;
const PADDLE_API_KEY        = process.env.PADDLE_API_KEY;
const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;
const PADDLE_API = (process.env.VITE_PADDLE_ENV || process.env.PADDLE_ENV) === 'production'
  ? 'https://api.paddle.com'
  : 'https://sandbox-api.paddle.com';

// This Paddle account is shared with other products. Paddle sends EVERY subscription and transaction
// event on the account to every webhook destination, so events for other products' prices must be ignored
// or they would change this app's users. PADDLE_PRICE_IDS = this app's price ids (comma or space separated,
// include archived prices that existing subscribers may still be on). Until it is set nothing is filtered
// (the previous behaviour) and a warning is logged at startup.
const PADDLE_PRICE_IDS = (process.env.PADDLE_PRICE_IDS || '').split(/[\s,]+/).filter(Boolean);
if (PADDLE_PRICE_IDS.length === 0) {
  console.warn('PADDLE_PRICE_IDS is not set: Paddle events for other products on this account are NOT filtered');
}
function isOurPaddleData(data) {
  if (PADDLE_PRICE_IDS.length === 0) return true;
  const items = Array.isArray(data?.items) ? data.items : [];
  if (items.length === 0) return true; // no price information to judge by
  return items.some((i) => PADDLE_PRICE_IDS.includes(i?.price?.id) || PADDLE_PRICE_IDS.includes(i?.price_id));
}

// When running inside Electron, redirect auth results to the custom protocol.
const ELECTRON_PROTOCOL = process.env.ELECTRON_PROTOCOL || null;

// APP_URL: the canonical public URL of this server. Used for OAuth redirect URI.
// Must be set in production. Falls back to localhost for local dev.
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET) {
  console.error('Missing required env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET');
  process.exit(1);
}

// ─── Security middleware ─────────────────────────────────────────────────────

// http → https as a permanent redirect. TLS terminates at the reverse proxy
// (Coolify/Traefik), which forwards the original scheme in X-Forwarded-Proto;
// a 302 here would tell crawlers the https URL is temporary and split link
// equity across both schemes. (If the proxy answers plain-HTTP requests itself
// without forwarding them, its redirect status must also be set to 301 in the
// proxy config — this middleware only covers requests that reach Node.)
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
});

// One URL per page. `/pricing/`, `/Pricing` and `/index.html` all used to answer
// 200 with a canonical pointing at the clean URL, which asks crawlers to
// consolidate them but does not make them. A 301 does, and it is what carries
// links earned by the variant over to the real page.
//
// Only extensionless page paths are touched: anything with a file extension
// (assets, fonts, downloads such as Stop-Biting-1.1.0.dmg, sitemap.xml) keeps
// its exact spelling, and /api is never rewritten. The query string is kept.
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const q = req.originalUrl.indexOf('?');
  const path = q === -1 ? req.originalUrl : req.originalUrl.slice(0, q);
  const search = q === -1 ? '' : req.originalUrl.slice(q);
  // /share/ carries mixed-case bearer tokens (WS10): lower-casing it would break every link.
  if (path.startsWith('/api/') || path.startsWith('/assets/') || path.startsWith('/share/')) return next();

  let canonical = path;
  if (path === '/index.html') canonical = '/';
  else if (!/\.[a-z0-9]+$/i.test(path)) {
    // Collapse repeated slashes too: '//blog' would otherwise serve a duplicate of /blog.
    canonical = path.toLowerCase().replace(/\/{2,}/g, '/');
    if (canonical.length > 1) canonical = canonical.replace(/\/+$/, '');
  }
  if (canonical !== path && canonical !== '') return res.redirect(301, canonical + search);
  next();
});

// ─── Compression ─────────────────────────────────────────────────────────────
// The origin served every byte uncompressed: an HTML route was 27,352 B on the
// wire with or without an `Accept-Encoding` header. Registered here, above the
// static mounts and every route, so it covers the per-request HTML too — every
// content route assembles its own <title>, meta, JSON-LD and server-rendered
// article, so none of it can be pre-compressed on disk and a build-time
// .br/.gz sidecar (express-static-gzip and friends) would have missed exactly
// the responses that matter most.
//
// `compression` negotiates br > gzip > deflate and is a no-op for a client
// that asks for none of them. Brotli quality is the package default of 4 —
// the balanced setting for content compressed once per request; q11 is for
// build-time artefacts and costs an order of magnitude more CPU for a few
// percent of bytes.
//
// It only sets Content-Encoding / Vary and drops Content-Length. It does not
// touch Cache-Control, so `/assets`' `max-age=31536000, immutable` and the
// `no-cache` on HTML both survive untouched.
const INCOMPRESSIBLE_PATHS = /^\/(?:og|fonts)\//;
app.use(compression({
  // The default filter already declines `image/png` (mime-db marks it
  // incompressible) and `font/woff2` (mime-db gives it no compressible flag).
  // Both directories are asserted by path as well: these are the 152 OG cards
  // and the 8 subsetted WOFF2s, formats that carry their own DEFLATE/Brotli
  // stream, so a second pass burns CPU to save approximately nothing. Stating
  // it here means the exclusion is a property of this server rather than of a
  // transitive dependency's data file.
  filter(req, res) {
    if (INCOMPRESSIBLE_PATHS.test(req.path)) return false;
    return compression.filter(req, res);
  },
}));

// Permissions-Policy (helmet does not set it). The app itself needs the
// camera for detection; everything else is locked down.
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), interest-cohort=()');
  next();
});

// H-1: Helmet — sets X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, etc.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'wasm-unsafe-eval'", "'unsafe-inline'", 'https://*.paddle.com', 'https://cdn.paddle.com', 'https://public.profitwell.com', 'https://www.googletagmanager.com'],
      frameSrc:    ["'self'", 'https://*.paddle.com'],
      connectSrc:  ["'self'", 'https://*.paddle.com', 'https://checkout.paddle.com', 'https://checkout-service.paddle.com', 'https://public.profitwell.com', 'https://www.google.com', 'https://www.googletagmanager.com', 'https://www.google-analytics.com', 'https://analytics.google.com', 'https://region1.google-analytics.com', 'https://formspree.io'],
      imgSrc:      ["'self'", 'data:', 'https://lh3.googleusercontent.com', 'https://*.paddle.com'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://cdn.paddle.com', 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'data:', 'https://fonts.gstatic.com'],
      workerSrc:   ["'self'"],  // PWA service worker registration
    },
  },
  // HSTS: force HTTPS for 1 year once on HTTPS. Fine to set even on HTTP (ignored by browsers on HTTP).
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// C-1: CORS — scoped to /api/ only. Static assets are same-origin and never need CORS.
// APP_URL is always allowed so production works without setting ALLOWED_ORIGINS explicitly.
const ALLOWED_ORIGINS = new Set([
  APP_URL,  // always allow the production domain (e.g. https://stopbiting.today)
  ...(process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
]);
const corsMiddleware = cors({
  origin: (origin, cb) => {
    // No origin = same-origin request or curl/Electron — allow.
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
});
app.use('/api/', corsMiddleware);  // only API routes need CORS, not static assets

app.use(cookieParser());
// Skip JSON body parsing for the Paddle webhook route (needs raw body for signature verification)
// and for the event sync route (a batch is bigger than 10kb; server/routes/events.js parses it itself,
// after the flag and sign-in checks, with its own limit).
app.use((req, res, next) => {
  if (req.path === '/api/paddle/webhook' || req.path === '/api/events/sync') return next();
  express.json({ limit: '10kb' })(req, res, next);
});

// H-3: Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests, please slow down.' },
});
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// ─── SQLite data store ───────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'users.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                    TEXT PRIMARY KEY,
    email                 TEXT,
    name                  TEXT,
    avatar                TEXT,
    trial_end_date        TEXT NOT NULL,
    subscription_status   TEXT NOT NULL DEFAULT 'trial',
    subscription_plan     TEXT,
    subscription_end_date TEXT,
    paddle_subscription_id TEXT,
    paddle_customer_id     TEXT,
    created_at            TEXT NOT NULL
  )
`);

// Migration: drop legacy paypal column from existing DBs
try { db.exec('ALTER TABLE users DROP COLUMN paypal_subscription_id'); } catch { /* already dropped or never existed */ }

// WS8: joins a Google sign-in to an account made with another method (emailed link, Apple,
// Microsoft). Returns null unless such an account exists, so Google-only behaviour is unchanged.
const linkGoogleSignIn = createGoogleLinker({ db, getUser });

const stmtGet    = db.prepare('SELECT * FROM users WHERE id = ?');
const stmtFindByEmail = db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
const stmtUpsert = db.prepare(`
  INSERT INTO users (id, email, name, avatar, trial_end_date, subscription_status,
    subscription_plan, subscription_end_date, paddle_subscription_id, paddle_customer_id, created_at)
  VALUES (@id, @email, @name, @avatar, @trial_end_date, @subscription_status,
    @subscription_plan, @subscription_end_date, @paddle_subscription_id, @paddle_customer_id, @created_at)
  ON CONFLICT(id) DO UPDATE SET
    email                  = excluded.email,
    name                   = excluded.name,
    avatar                 = excluded.avatar,
    trial_end_date         = excluded.trial_end_date,
    subscription_status    = excluded.subscription_status,
    subscription_plan      = excluded.subscription_plan,
    subscription_end_date  = excluded.subscription_end_date,
    paddle_subscription_id = excluded.paddle_subscription_id,
    paddle_customer_id     = excluded.paddle_customer_id
`);

function getUser(id) {
  const user = stmtGet.get(id) ?? null;
  if (
    user &&
    user.subscription_status === 'trial' &&
    user.trial_end_date &&
    new Date(user.trial_end_date).getTime() < Date.now()
  ) {
    user.subscription_status = 'expired';
    saveUser(user);
  }
  return user;
}

function saveUser(user) {
  stmtUpsert.run({
    id:                    user.id,
    email:                 user.email ?? null,
    name:                  user.name ?? null,
    avatar:                user.avatar ?? null,
    trial_end_date:        user.trial_end_date,
    subscription_status:   user.subscription_status,
    subscription_plan:     user.subscription_plan ?? null,
    subscription_end_date: user.subscription_end_date ?? null,
    paddle_subscription_id: user.paddle_subscription_id ?? null,
    paddle_customer_id:     user.paddle_customer_id ?? null,
    created_at:            user.created_at,
  });
  return getUser(user.id);
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────

// C-4: Shortened to 14 days (was 90d). M-2: algorithm pinned.
function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '14d', algorithm: 'HS256' });
}

// Reads JWT from HttpOnly cookie (web) or Authorization header (Electron).
function authMiddleware(req, res, next) {
  // Web: cookie-based (HttpOnly, not readable by JS)
  const cookieToken = req.cookies?.nh_session;
  // Electron: Bearer token in Authorization header (Electron sets this via localStorage)
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  const token = cookieToken || headerToken;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // M-2: algorithm pinned
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  commit: process.env.SOURCE_COMMIT || process.env.COMMIT_SHA || 'unknown',
  dist: existsSync(join(__dirname, 'dist')),
}));

// ─── OAuth ───────────────────────────────────────────────────────────────────
function makeOAuthClient() {
  // H-4: Use APP_URL env var — not request headers — for the redirect URI.
  // This prevents host-header injection attacks on the OAuth redirect URI.
  const redirectUri = ELECTRON_PROTOCOL
    ? `http://localhost:${PORT}/api/auth/callback`
    : `${APP_URL}/api/auth/callback`;
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
}

// H-5: OAuth state parameter — prevents CSRF on the callback.
app.get('/api/auth/google', (req, res) => {
  const state = randomBytes(16).toString('hex');
  // Store state in a short-lived HttpOnly cookie (5 min TTL)
  res.cookie('oauth_state', state, {
    httpOnly: true,
    maxAge: 5 * 60 * 1000,
    sameSite: 'lax',
    secure: APP_URL.startsWith('https'),
  });

  const client = makeOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    prompt: 'select_account',
    state,
  });
  res.redirect(url);
});

app.get('/api/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  // H-5: Validate state to prevent CSRF
  const expectedState = req.cookies?.oauth_state;
  if (!ELECTRON_PROTOCOL && (!expectedState || state !== expectedState)) {
    return res.redirect(`${APP_URL}/#auth_error=state_mismatch`);
  }
  res.clearCookie('oauth_state');

  if (error || !code) {
    const errVal = encodeURIComponent(error || 'no_code');
    if (ELECTRON_PROTOCOL) return res.redirect(`${ELECTRON_PROTOCOL}://auth?error=${errVal}`);
    return res.redirect(`${APP_URL}/#auth_error=${errVal}`);
  }

  try {
    const client = makeOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const googlePayload = ticket.getPayload();
    const googleId = googlePayload.sub;

    // Find or create user
    let user = getUser(googleId);
    if (!user) user = linkGoogleSignIn(googlePayload);   // WS8: null for everyone who has no other-method account
    const isNewUser = !user;
    if (!user) {
      const trialEnd = new Date(Date.now() + TRIAL_MS).toISOString();
      user = {
        id: googleId,
        email: googlePayload.email,
        name: googlePayload.name,
        avatar: googlePayload.picture,
        trial_end_date: trialEnd,
        subscription_status: 'trial',
        subscription_plan: null,
        subscription_end_date: null,
        paddle_subscription_id: null,
        paddle_customer_id: null,
        created_at: new Date().toISOString(),
      };
    }
    saveUser(user);

    if (isNewUser) {
      sendWelcomeEmail(user).catch(err => console.error('[email] welcome failed:', err));
      sendAdminNotification(user).catch(err => console.error('[email] admin notification failed:', err));
    }

    const token = signToken(user.id);

    if (ELECTRON_PROTOCOL) {
      // Electron: token goes in redirect URL to the custom protocol handler.
      // The Electron main process reads it and stores it (not in a browser context).
      return res.redirect(`${ELECTRON_PROTOCOL}://auth?token=${encodeURIComponent(token)}`);
    }

    // C-2/C-3: Web — set HttpOnly cookie instead of exposing token in URL hash.
    res.cookie('nh_session', token, {
      httpOnly: true,                          // not readable by JS — XSS-safe
      secure: APP_URL.startsWith('https'),     // HTTPS only in production
      sameSite: 'lax',                         // CSRF protection
      maxAge: 14 * 24 * 60 * 60 * 1000,       // 14 days, matches JWT expiry
    });
    res.redirect(`${APP_URL}/`);
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    if (ELECTRON_PROTOCOL) return res.redirect(`${ELECTRON_PROTOCOL}://auth?error=callback_failed`);
    res.redirect(`${APP_URL}/#auth_error=callback_failed`);
  }
});

// C-4/L-2: Explicit sign-out — clears the session cookie server-side.
app.post('/api/auth/signout', (req, res) => {
  res.clearCookie('nh_session', { httpOnly: true, sameSite: 'lax' });
  res.json({ ok: true });
});

// ─── User API ─────────────────────────────────────────────────────────────────
app.get('/api/user/me', authMiddleware, (req, res) => {
  const user = getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  // WS9: adds `entitlement` (lifetime / gift / referral credit / free tier) only when the account has one.
  res.json(app.locals.decorateUser ? app.locals.decorateUser(user) : user);
});

// H-2: PATCH /api/user/me removed — subscription fields are only written
// by the server-side Paddle webhook/verification endpoint, never by the client.

// ─── Paddle webhook ──────────────────────────────────────────────────────────

// Paddle sends webhooks as JSON with an HMAC-SHA256 signature in the
// Paddle-Signature header. We verify the signature before processing.
function verifyPaddleWebhookSignature(rawBody, signatureHeader) {
  if (!PADDLE_WEBHOOK_SECRET || !signatureHeader) return false;

  // Header format: ts=TIMESTAMP;h1=HASH
  const parts = {};
  for (const part of signatureHeader.split(';')) {
    const [key, value] = part.split('=');
    parts[key] = value;
  }

  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;

  const payload = `${ts}:${rawBody}`;
  const computed = createHmac('sha256', PADDLE_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return computed === h1;
}

// Paddle webhook needs raw body for signature verification.
// We add a separate raw-body middleware for this route only.
app.post('/api/paddle/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body.toString();
  const signature = req.headers['paddle-signature'];

  if (!verifyPaddleWebhookSignature(rawBody, signature)) {
    console.warn('Paddle webhook: invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const eventType = event.event_type;
  const data = event.data;
  // WS9: a replayed event is acknowledged and ignored; lifetime, gift, referral and refund events are
  // handled in server/billing (see docs/agents/ws9-notes.md). Everything else falls through to the handlers below.
  try {
    if (await app.locals.billingWebhook?.take(event, res)) return res.json({ received: true });
  } catch (err) {
    console.error('Paddle webhook billing error:', err.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  console.log(`Paddle webhook: ${eventType}`);

  if (!isOurPaddleData(data)) {
    console.log(`Paddle webhook: ignored ${eventType} (price belongs to another product)`);
    return res.json({ received: true }); // 200 so Paddle does not retry events that are not ours
  }

  try {
    if (eventType === 'subscription.created' || eventType === 'subscription.activated' || eventType === 'subscription.updated') {
      // Find user by customData.userId or by customer email
      const userId = data.custom_data?.userId;
      const customerEmail = data.customer?.email || null;

      let user = userId ? getUser(userId) : null;
      if (!user && customerEmail) {
        user = stmtFindByEmail.get(customerEmail) ?? null;
      }

      if (!user) {
        console.warn(`Paddle webhook: no user found for subscription ${data.id}`);
        return res.json({ received: true });
      }

      // Determine plan from billing cycle
      const billingInterval = data.items?.[0]?.price?.billing_cycle?.interval;
      const plan = billingInterval === 'year' ? 'yearly' : 'monthly';

      // Use current_billing_period.ends_at or next_billed_at for end date
      const endDate = data.current_billing_period?.ends_at
        || data.next_billed_at
        || null;

      user.subscription_status = 'active';
      user.subscription_plan = plan;
      user.subscription_end_date = endDate;
      user.paddle_subscription_id = data.id;
      user.paddle_customer_id = data.customer_id || null;
      saveUser(user);

    } else if (eventType === 'subscription.paused') {
      const userId = data.custom_data?.userId;
      const customerEmail = data.customer?.email || null;

      let user = userId ? getUser(userId) : null;
      if (!user && customerEmail) {
        user = stmtFindByEmail.get(customerEmail) ?? null;
      }

      if (user) {
        user.subscription_status = 'paused';
        // Keep subscription_end_date so access holds until period end
        saveUser(user);
      }

    } else if (eventType === 'subscription.resumed') {
      const userId = data.custom_data?.userId;
      const customerEmail = data.customer?.email || null;

      let user = userId ? getUser(userId) : null;
      if (!user && customerEmail) {
        user = stmtFindByEmail.get(customerEmail) ?? null;
      }

      if (user) {
        const billingInterval = data.items?.[0]?.price?.billing_cycle?.interval;
        const plan = billingInterval === 'year' ? 'yearly' : 'monthly';
        const endDate = data.current_billing_period?.ends_at || data.next_billed_at || null;

        user.subscription_status = 'active';
        user.subscription_plan = plan;
        user.subscription_end_date = endDate;
        saveUser(user);
      }

    } else if (eventType === 'subscription.canceled') {
      const userId = data.custom_data?.userId;
      const customerEmail = data.customer?.email || null;

      let user = userId ? getUser(userId) : null;
      if (!user && customerEmail) {
        user = stmtFindByEmail.get(customerEmail) ?? null;
      }

      if (user) {
        user.subscription_status = 'cancelled';
        saveUser(user);
      }

    } else if (eventType === 'transaction.payment_failed') {
      const subscriptionId = data.subscription_id;
      if (subscriptionId) {
        // Find user by paddle_subscription_id
        const user = db.prepare('SELECT * FROM users WHERE paddle_subscription_id = ? LIMIT 1').get(subscriptionId);
        if (user) {
          user.subscription_status = 'expired';
          saveUser(user);
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Paddle webhook processing error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ─── Paddle verify endpoint (fallback for immediate activation) ──────────────
// Called by frontend after checkout.completed to ensure DB is updated even if
// webhook hasn't arrived yet (race condition).
// The checkout.completed event only provides a transaction_id — we look up the
// transaction via Paddle API to find the subscription_id, then fetch the sub.
app.post('/api/paddle/verify-subscription', authMiddleware, async (req, res) => {
  const { transactionId } = req.body;
  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' });
  }
  if (!PADDLE_API_KEY) {
    return res.status(503).json({ error: 'Paddle not configured on server' });
  }

  try {
    // Step 1: Look up the transaction to find the subscription_id
    const txnRes = await fetch(`${PADDLE_API}/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${PADDLE_API_KEY}` },
    });

    if (!txnRes.ok) {
      throw new Error(`Paddle transaction lookup failed: ${txnRes.status}`);
    }

    const txnBody = await txnRes.json();
    const subscriptionId = txnBody.data?.subscription_id;

    if (!subscriptionId) {
      // Subscription may not be created yet — tell client to retry via webhook
      return res.status(202).json({ error: 'Subscription not yet created, webhook will handle it' });
    }

    // Step 2: Fetch the subscription details
    const subRes = await fetch(`${PADDLE_API}/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${PADDLE_API_KEY}` },
    });

    if (!subRes.ok) {
      throw new Error(`Paddle subscription lookup failed: ${subRes.status}`);
    }

    const { data } = await subRes.json();

    // Accept active or trialing status (Paddle may use either)
    if (data.status !== 'active' && data.status !== 'trialing') {
      return res.status(402).json({ error: `Subscription status is '${data.status}', not active` });
    }

    // A subscription for another product on the shared Paddle account must not unlock this app.
    if (!isOurPaddleData(data)) {
      return res.status(409).json({ error: 'Subscription is not a plan of this app' });
    }

    const user = getUser(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const billingInterval = data.items?.[0]?.price?.billing_cycle?.interval;
    const plan = billingInterval === 'year' ? 'yearly' : 'monthly';

    const endDate = data.current_billing_period?.ends_at
      || data.next_billed_at
      || new Date(Date.now() + (plan === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString();

    user.subscription_status = 'active';
    user.subscription_plan = plan;
    user.subscription_end_date = endDate;
    user.paddle_subscription_id = data.id;
    user.paddle_customer_id = data.customer_id || null;
    saveUser(user);

    res.json(user);
  } catch (err) {
    console.error('Paddle verify error:', err.message);
    res.status(502).json({ error: 'Failed to verify subscription with Paddle' });
  }
});

// ─── Paddle customer portal session ─────────────────────────────────────────
// Returns a one-time URL to Paddle's self-serve customer portal so users can
// manage or cancel their subscription without contacting support.
app.get('/api/paddle/portal-session', authMiddleware, async (req, res) => {
  const user = getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.paddle_customer_id) return res.status(400).json({ error: 'No Paddle customer on record' });
  if (!PADDLE_API_KEY) return res.status(503).json({ error: 'Paddle not configured' });

  try {
    const r = await fetch(`${PADDLE_API}/customers/${user.paddle_customer_id}/portal-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PADDLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!r.ok) throw new Error(`Paddle portal session failed: ${r.status}`);
    const body = await r.json();
    const url = body.data?.urls?.general?.overview;
    if (!url) throw new Error('No portal URL in Paddle response');

    res.json({ url });
  } catch (err) {
    console.error('Portal session error:', err.message);
    res.status(502).json({ error: 'Failed to create portal session' });
  }
});

// ─── Route modules (server/routes/*) ─────────────────────────────────────────
// New server features live there, not here. Must stay above the static/SSR block
// below so API routes win over the page catch-all.
// `flags` is the same set the route modules got; the page handlers below read it too.
const { flags } = registerRoutes({
  app, db, authMiddleware, getUser, saveUser, signToken,
  findUserByEmail: email => stmtFindByEmail.get(email) ?? null,
  config: { APP_URL, ELECTRON_PROTOCOL },
});

// ─── Downloads ───────────────────────────────────────────────────────────────
const GITHUB_RELEASES_BASE = 'https://github.com/gazivoda/nail-biting/releases/download';
const DOWNLOAD_MAP = {
  // v1.0.0 — old name (Nail Habit Tracker), still on GitHub Release
  'Nail-Habit-Tracker-1.0.0-arm64.dmg': 'v1.0.0/Nail.Habit.Tracker-1.0.0-arm64.dmg',
  'Nail-Habit-Tracker-1.0.0.dmg':       'v1.0.0/Nail.Habit.Tracker-1.0.0.dmg',
  // v1.1.0 — Stop Biting, signed + notarized
  'Stop-Biting-1.1.0-arm64.dmg': 'v1.1.0/Stop.Biting-1.1.0-arm64.dmg',
  'Stop-Biting-1.1.0.dmg':       'v1.1.0/Stop.Biting-1.1.0.dmg',
};

app.get('/downloads/:file', (req, res) => {
  const { file } = req.params;
  const ghPath = DOWNLOAD_MAP[file];
  if (!ghPath) return res.status(404).send('File not found');
  res.redirect(302, `${GITHUB_RELEASES_BASE}/${ghPath}`);
});

// ─── Static (production) ─────────────────────────────────────────────────────
const distPath = join(__dirname, 'dist');
if (!existsSync(distPath)) {
  // Log clearly — Dockerfile guarantees dist/ exists, so this means a build failure.
  console.error('WARNING: dist/ not found — frontend was not built. Static files will not be served.');
} else {
  // H-8: Serve hashed assets (JS/CSS chunks) with long-lived immutable cache.
  // Vite generates content-hashed filenames (e.g. index-CedykY1_.js) so stale
  // cache is impossible — the filename changes with every build.
  app.use('/assets', express.static(join(distPath, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));

  // The same treatment for the two directories of content-stable binaries.
  // Their names are not content-hashed, but their bytes only change when a
  // build regenerates them, and the catch-all express.static(distPath) at the
  // bottom of this block was serving both with `Cache-Control: public,
  // max-age=0` — a revalidation round-trip on every visit, on exactly the files
  // that can least afford one. The 8 WOFF2 subsets were self-hosted to clear a
  // 4.7 s LCP render delay and sit on the critical rendering path; the 152 OG
  // cards are 3.6 MB that every crawl and every social unfurl re-fetched.
  //
  // Registered here so they win over that catch-all; nothing else about them
  // changes. Content-Type still comes from the same mime lookup, and the
  // compression filter above still declines /og/ and /fonts/ by path
  // (INCOMPRESSIBLE_PATHS), so neither directory gets a second squeeze.
  // Data files that sit next to the pages are not pages: keep them out of the
  // index (robots.txt, llms.txt and sitemap.xml are the only ones that should be
  // found). /posts already sends its own header.
  app.use((req, res, next) => {
    if (/\.(json|txt)$/i.test(req.path) && !['/robots.txt', '/llms.txt', '/llms-full.txt', '/sitemap.xml'].includes(req.path)) {
      res.setHeader('X-Robots-Tag', 'noindex');
    }
    next();
  });

  // ── Pages and copy that follow the feature flags (WS11b) ───────────────────
  // Flags change only when the server restarts, so everything below is decided once, here.
  //   copyIsOn   the flag as the WORDS should see it (a sign-in method also needs its keys)
  //   COPY_ACTIVE  whether any site-wide copy rule (shared/flagCopy.js RULES) says something
  //              different from the source text. False with every flag off: nothing below
  //              is registered then and the site is served exactly as the build wrote it.
  const copyIsOn = createCopyIsOn(flags);
  const COPY_ACTIVE = anyRuleActive(copyIsOn);
  const copyHtml = text => flagAware(text, copyIsOn);
  // The Lifetime plan, for the readers that do not run the page: on only when the flag is on AND the server knows the
  // Lifetime price id (the visible card needs the same two things, server/marketing/copyFlags.js). Off, every function
  // below returns what it is given, so nothing is served differently. Decided once, here: flags change only on a restart.
  const LIFETIME = createLifetimeCopy({ on: copyIsOn('lifetime_plan'), price: lifetimePriceUsd() });
  if (LIFETIME.on) {
    console.log(`[marketing] lifetime_plan: pricing copy names the Lifetime plan ($${LIFETIME.price}; LIFETIME_PRICE_USD must equal the Paddle price)`);
  } else if (flags.isOn('lifetime_plan')) {
    console.warn('[marketing] lifetime_plan is on but no Lifetime price id (PADDLE_PRICE_ID_LIFETIME) is in the server\'s environment: the pricing copy, schema and llms.txt do not mention the Lifetime plan');
  }
  // dist/seo-gated.json: the copy of the pages that exist only while a flag is on, and the flag
  // of each. Read by this server and never served (the 404 route further down). Read here, not
  // where the rest of the gated state is built, because /og and /posts are mounted next.
  let GATED_FILE = {};
  try {
    const gatedPath = join(distPath, 'seo-gated.json');
    if (existsSync(gatedPath)) GATED_FILE = JSON.parse(readFileSync(gatedPath, 'utf-8'));
  } catch (err) {
    console.error('ERROR: dist/seo-gated.json is invalid JSON — gated pages disabled.', err);
  }
  const GATED_FLAGS = GATED_FILE.flags ?? {};

  for (const dir of ['fonts']) {
    app.use(`/${dir}`, express.static(join(distPath, dir), {
      maxAge: '1y',
      immutable: true,
    }));
  }
  // The social cards. The card of a page whose flag is off answers as a file that does not exist
  // (the page's title is printed on it, and nothing links to it, so it must not be findable).
  const ogStatic = express.static(join(distPath, 'og'), { maxAge: '1y', immutable: true });
  app.use('/og', (req, res, next) => (
    isClosedGatedFile(req.path.slice(1), GATED_FLAGS, flags) ? sendHtml(res, NOT_FOUND_HTML, 404) : ogStatic(req, res, next)
  ));

  // Per-article JSON for BlogPost.tsx (written by scripts/generate-seo-content.mjs).
  // Not a page: it must never be indexed in place of the article it describes,
  // so it carries noindex and a short cache (the files change on every deploy
  // but not between deploys).
  //
  // WS11b: while a copy rule is active the same file is served with the rule applied, so the
  // article a reader sees and the one a crawler gets say the same thing. Not registered otherwise.
  if (COPY_ACTIVE) {
    app.get('/posts/:file', (req, res, next) => {
      if (!/^[a-z0-9-]+\.json$/.test(req.params.file)) return next();
      const file = join(distPath, 'posts', req.params.file);
      if (!existsSync(file)) return next();
      res.set({ 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=300' })
        .type('json').send(copyHtml(readFileSync(file, 'utf-8')));
    });
  }
  app.use('/posts', express.static(join(distPath, 'posts'), {
    maxAge: '5m',
    setHeaders: res => res.setHeader('X-Robots-Tag', 'noindex'),
  }));

  // ── Crawler-visible content: single source of truth ────────────────────────
  // dist/seo-content.json is generated at build time by
  // scripts/generate-seo-content.mjs (wired into vite.config.ts) directly from
  // src/data/blogPosts.ts and src/data/comparePages.ts. Every meta title,
  // description, schema date, and server-rendered article body below derives
  // from it, so the HTML served to crawlers cannot drift from what React
  // renders for visitors.
  const seoContentPath = join(distPath, 'seo-content.json');
  let SEO_CONTENT = { posts: {}, comparePages: {} };
  if (existsSync(seoContentPath)) {
    try {
      SEO_CONTENT = JSON.parse(readFileSync(seoContentPath, 'utf-8'));
    } catch (err) {
      console.error('ERROR: dist/seo-content.json is invalid JSON — crawler article content disabled.', err);
    }
  } else {
    console.error('WARNING: dist/seo-content.json missing — run a build (vite build generates it). Crawler article content disabled.');
  }
  // WS11b: with a copy rule active the crawler copy and every schema derived from it follow the flags.
  if (COPY_ACTIVE) SEO_CONTENT = flagAwareDeep(SEO_CONTENT, copyIsOn);
  // slug → { title, seoTitle?, description, tag, readingMinutes, datePublished, dateModified, sections }
  const BLOG_POSTS = SEO_CONTENT.posts ?? {};
  // When the content file is absent/corrupt we must not 404 every real post —
  // unknown-slug detection is only trustworthy when the content actually loaded.
  const SEO_CONTENT_LOADED = Object.keys(BLOG_POSTS).length > 0;
  // path → { title, subtitle, intro, sections, relatedPosts }
  const COMPARE_CONTENT = SEO_CONTENT.comparePages ?? {};
  // Pages behind a flag each (WS11b): the two competitor profiles (`compare_competitors`,
  // src/data/competitorPages.ts) and the feature pages (src/data/featurePages.ts). They are
  // deliberately NOT in seo-content.json, which express.static serves to anyone: the build writes
  // them to dist/seo-gated.json, which this server reads (above) and never serves (see the 404 route
  // below). A page is "open" while ITS flag is on; closed pages are reachable nowhere.
  const GATED_FLAG = 'compare_competitors';
  const GATED_UPDATES = GATED_FILE.pageUpdates ?? {};   // freshness-ledger rows for the gated paths, kept out of seo-content.json too
  // The numbers the environment decides, for the {{PLACEHOLDERS}} in the copy.
  const COPY_TOKENS = { REFERRAL_CREDIT: describeDays(referralCreditDays()) };
  // Open pages, with markers and placeholders resolved: the one copy the article, the schema, the
  // llms files and the JSON the page renders from are all made of.
  // A page's "Related reading" loses its links to gated pages that are closed (they would be links to the 404).
  const GATED_CONTENT = Object.fromEntries(Object.entries(
    openGatedPages(GATED_FILE.comparePages ?? {}, GATED_FLAGS, flags),
  ).map(([path, page]) => [path, withoutClosedPageLinks(resolveGatedPage(page, { isOn: copyIsOn, tokens: COPY_TOKENS }), GATED_FLAGS, flags)]));
  // [href, label] pairs the noscript site nav gains for the open pages.
  const GATED_NAV = gatedNavLinks(GATED_CONTENT);
  if (GATED_NAV.length) console.log(`[marketing] pages open (flag on): ${GATED_NAV.map(([href]) => href).join(', ')}`);
  // The same pages as the site footer links them, while (and only while) they are open: a data block in the head of
  // every page for the React footer, and a list at the end of the crawler article (injectSsrArticle). Both are '' with
  // every page closed, so nothing is added to any page then (server/marketing/gatedPages.js).
  const GATED_LINKS = gatedFooterLinks(GATED_CONTENT);
  const gatedLinksTag = gatedLinksMarkerTag(GATED_LINKS);
  // path → { lastmod } — the core-page freshness ledger from
  // src/data/pageUpdates.json, the same dates sitemap.xml carries. Each one is
  // pinned to a fingerprint of that page's content and only moves when the
  // content does (see the header comment in scripts/sync-seo.mjs), so it is
  // safe to publish as `dateModified` and as a `Last-Modified` header.
  const PAGE_UPDATES = { ...(SEO_CONTENT.pageUpdates ?? {}), ...GATED_UPDATES };
  function pageLastmod(path) {
    return PAGE_UPDATES[path]?.lastmod ?? null;
  }
  // { name, role, bio } — the author box under every article, and
  // { title, lastUpdated, standfirst, sections } — the /editorial-policy body.
  // Both come from src/data/editorialPolicy.ts through seo-content.json, the
  // same module the React pages import, so the crawler copy and the rendered
  // copy are one string. Absent on an old build artifact: the author box is
  // then omitted rather than invented, and /editorial-policy falls back to the
  // SPA shell (React still has the module).
  const AUTHOR_BIO = SEO_CONTENT.authorBio ?? null;
  const EDITORIAL_POLICY = SEO_CONTENT.editorialPolicy ?? null;
  const EDITORIAL_POLICY_PATH = '/editorial-policy';

  // Helper: escape HTML entities for safe server-side content injection.
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Crawler copy of the testimonial section (src/components/site/Testimonials.tsx), built from
  // seo-content.json, which scripts/generate-seo-content.mjs fills through the same validator the
  // component uses. Empty string unless the `social_proof` flag is on AND there is at least one
  // consented entry, which is exactly when the component renders: a no-JS reader sees the same
  // page, and an empty data file leaves no trace in the HTML.
  const TESTIMONIALS = SEO_CONTENT.testimonials ?? { heading: '', entries: [] };
  function testimonialsArticleHtml() {
    if (!flags.isOn('social_proof') || !TESTIMONIALS.entries?.length) return '';
    const figures = TESTIMONIALS.entries.map(t =>
      '<figure>' +
      (t.photo ? `<img src="${escapeHtml(t.photo.src)}" alt="${escapeHtml(t.photo.alt)}" loading="lazy">` : '') +
      `<blockquote><p>${escapeHtml(t.quote)}</p></blockquote>` +
      `<figcaption>${escapeHtml(t.firstName)}. ${escapeHtml(t.detail)}</figcaption></figure>`).join('');
    return `<section><h2>${escapeHtml(TESTIMONIALS.heading)}</h2>${figures}</section>`;
  }

  // ── In-flow server-rendered articles ────────────────────────────────────────
  // AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not execute JavaScript
  // and cannot read React-rendered content, so each content route injects its
  // article into the initial HTML. The article renders IN NORMAL DOCUMENT FLOW
  // — no off-screen positioning, no aria-hidden — so crawlers, no-JS visitors,
  // and JS visitors all receive the same content (off-screen hiding is a
  // hidden-text pattern Google devalues). Cleanup is layered:
  //   1. The inline <script> adds .js to <html> the instant JS runs, and the
  //      CSS rule hides the article — so JS visitors never see a flash.
  //   2. The article lives INSIDE #root, and React's createRoot().render()
  //      removes all existing children of the container on mount — so it is
  //      gone from the DOM entirely once the app renders the same content.
  const SSR_ARTICLE_HEAD =
    '<style>' +
    '#ssr-page-content{max-width:42rem;margin:0 auto;padding:48px 24px;' +
    'font-family:Geist,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
    'line-height:1.65;color:oklch(19% 0.03 160)}' +
    '#ssr-page-content h1,#ssr-page-content h2{font-family:"Bricolage Grotesque",Geist,sans-serif;letter-spacing:-0.03em}' +
    '#ssr-page-content h1{font-size:1.9rem;line-height:1.15}' +
    '#ssr-page-content h2{font-size:1.25rem;margin-top:2rem}' +
    '#ssr-page-content table{border-collapse:collapse;width:100%;font-size:.85rem}' +
    '#ssr-page-content th,#ssr-page-content td{border:1px solid oklch(90% 0.01 130);padding:6px 8px;text-align:left;vertical-align:top}' +
    '@media (prefers-color-scheme:dark){#ssr-page-content{color:oklch(90% 0.01 130)}}' +
    'html.js #ssr-page-content{display:none}' +
    '</style>' +
    '<script>document.documentElement.classList.add("js")</script>';

  // `pageLinks` is false for the localized pages: the pages the list names are English only, and the footer React
  // draws on those pages does not link them either (src/components/site/SiteFooter.tsx).
  function injectSsrArticle(html, articleInnerHtml, { pageLinks = true } = {}) {
    const links = pageLinks ? gatedLinksArticleHtml(GATED_LINKS, escapeHtml) : '';
    return html
      .replace('</head>', `  ${SSR_ARTICLE_HEAD}\n  </head>`)
      .replace('<div id="root">', `<div id="root"><article id="ssr-page-content">${LIFETIME.article(copyHtml(articleInnerHtml))}${links}</article>`);
  }

  // Sections come straight from blogPosts.ts via seo-content.json. `body` and
  // `list` are plain text (the client renders them as text nodes), so they are
  // escaped; `html` is authored markup (e.g. comparison tables) that the client
  // injects with dangerouslySetInnerHTML, so it is emitted verbatim.
  function renderSectionsHtml(sections) {
    return sections.map(s => {
      const paras = s.body.split('\n\n').filter(Boolean).map(p => `<p>${escapeHtml(p)}</p>`).join('');
      const listHtml = s.list?.length
        ? `<ul>${s.list.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : '';
      return `<section><h2>${escapeHtml(s.heading)}</h2>${paras}${listHtml}${s.html ?? ''}</section>`;
    }).join('');
  }

  function blogArticleHtml(post) {
    const dates = post.dateModified !== post.datePublished
      ? `Published ${post.datePublished} · Updated ${post.dateModified}`
      : `Published ${post.datePublished}`;
    // The `article-summary` class is a stable hook for the SpeakableSpecification
    // cssSelector in the JSON-LD (SCHEMA_SPEAKABLE below) — keep them in step.
    // Mirrors the "Related articles" cards React renders, so crawlers that
    // never run JS still see the same three links a visitor does — without
    // them, every article is a dead end in the raw HTML.
    const related = post.related?.length
      ? `<section><h2>Related articles</h2><ul>${post.related.map(r =>
          `<li><a href="/blog/${escapeHtml(r.slug)}">${escapeHtml(r.title)}</a></li>`).join('')}</ul></section>`
      : '';
    // Mirrors the "Put it into practice" link BlogPost.tsx renders from
    // PRODUCT_LINKS (src/data/related.ts), so the crawler sees the same link.
    const productLinkHtml = post.productLink
      ? `<section><h2>Put it into practice</h2><p><a href="${escapeHtml(post.productLink.href)}">${escapeHtml(post.productLink.label)}</a></p></section>`
      : '';
    // The byline is part of the crawler-visible meta line for the same reason
    // the FAQ answers are in-flow: BlogPosting names a Person as `author`, and
    // schema must not assert something the pre-JS page never shows. bylineHtml()
    // renders the exact string BlogPost.tsx shows once React mounts.
    return `<h1>${escapeHtml(post.title)}</h1>` +
      `<p>${escapeHtml(post.tag)} · ${post.readingMinutes} min read · ${dates}</p>` +
      bylineHtml() +
      `<p class="article-summary">${escapeHtml(post.description)}</p>` +
      renderSectionsHtml(post.sections) + productLinkHtml + related + authorBoxHtml();
  }

  function compareArticleHtml(content) {
    // `s.html` is authored markup (comparison tables) that the client renders
    // with dangerouslySetInnerHTML, so it is emitted verbatim — same contract
    // as blog sections in renderSectionsHtml above.
    const body = content.sections.map(s =>
      `<section><h2>${escapeHtml(s.heading)}</h2>${s.body.split('\n\n').map(t => `<p>${escapeHtml(t)}</p>`).join('')}${s.html ?? ''}</section>`,
    ).join('');
    const related = content.relatedPosts?.length
      ? `<section><h2>Related reading</h2><ul>${content.relatedPosts.map(r =>
          `<li><a href="${escapeHtml(r.href)}">${escapeHtml(r.label)}</a></li>`).join('')}</ul></section>`
      : '';
    // Same contract as blogArticleHtml: these pages' Article schema names a
    // Person author, so the byline is in the served HTML too. The intro carries
    // `article-summary` — the hook SCHEMA_SPEAKABLE's cssSelector resolves against.
    return `<h1>${escapeHtml(content.title)}</h1>` +
      `<p>${escapeHtml(content.subtitle)}</p>` +
      bylineHtml() +
      `<p class="article-summary">${escapeHtml(content.intro)}</p>${body}${related}` +
      authorBoxHtml();
  }

  // ── Author surface (E-E-A-T) ───────────────────────────────────────────────
  // The byline used to be inert text. It now links to the founder's story —
  // the same URL SCHEMA_AUTHOR already publishes as the Person's `url`, so the
  // named author, the schema and the page a reader can click all resolve to
  // one person. The VISIBLE TEXT is unchanged — "By Igor Gazivoda · Founder,
  // Stop Biting", the same string as before and the same one BlogPost.tsx
  // renders: this adds an anchor, not a word.
  function bylineHtml() {
    return `<p>By <a href="/about">${escapeHtml(SCHEMA_AUTHOR.name)}</a> · ${escapeHtml(AUTHOR_ROLE)}</p>`;
  }

  // Author box, at the end of every article and comparison page. States what
  // the author actually is — a developer who bit his nails for 20 years, not a
  // clinician — and links to the founder's story and to the editorial policy.
  // Copy lives in src/data/editorialPolicy.ts, which BlogPost.tsx and
  // ComparePage.tsx render from too, so the two views cannot drift.
  //
  // Nothing is fabricated here when the content file is missing: the box is
  // omitted entirely rather than falling back to invented credentials.
  function authorBoxHtml({ policyLink = true } = {}) {
    if (!AUTHOR_BIO) return '';
    const links = policyLink
      ? '<p><a href="/about">More about Igor and why he built this</a> · '
        + `<a href="${EDITORIAL_POLICY_PATH}">Editorial policy and corrections</a></p>`
      : '<p><a href="/about">More about Igor and why he built this</a></p>';
    return '<footer class="author-box"><h2>About the author</h2>' +
      `<p><a href="/about">${escapeHtml(AUTHOR_BIO.name)}</a> (${escapeHtml(AUTHOR_BIO.role)}). ${escapeHtml(AUTHOR_BIO.bio)}</p>` +
      `${links}</footer>`;
  }

  // The SPA shell contains no anchors, so the raw HTML of every page has zero
  // internal links. Googlebot renders JS and eventually finds them; GPTBot,
  // PerplexityBot and ClaudeBot — all of which robots.txt explicitly welcomes,
  // and for whom llms.txt exists — do not, leaving sitemap.xml as the only
  // discovery path and no anchor text or topical clustering anywhere.
  //
  // This mirrors the navigation the app renders once React boots. It lives in
  // <noscript> deliberately: that is precisely what a client without JS gets,
  // so it is a fallback rather than anything hidden, and it costs JS clients
  // nothing. Keep it in step with the links in Landing.tsx and LegalPage.tsx.
  const SITE_NAV = [
    ['/', 'Stop Biting: AI nail biting detection'],
    ['/blog', 'Nail biting guides and research'],
    ['/how-it-works', 'How AI nail biting detection works'],
    ['/pricing', 'Pricing: free trial, $2.99/month or $29/year'],
    ['/tools/nail-biting-cost-calculator', 'Nail biting cost calculator'],
    ['/tools/nail-biting-tracker-printable', 'Free printable nail biting tracker'],
    ['/about', 'About Stop Biting'],
    ['/compare/bitter-polish-alternative', 'Stop Biting vs bitter nail polish'],
    ['/compare/habit-tracking-apps', 'Why habit tracking apps do not work for nail biting'],
    ['/compare/ai-detection-apps', 'AI apps that detect nail biting compared'],
    ['/compare/stop-biting-vs-hands-off', 'Stop Biting vs Hands Off'],
    ['/compare/stop-biting-vs-nailed', 'Stop Biting vs Nailed'],
    ['/compare/stop-biting-vs-smartbehavior', 'Stop Biting vs SmartBehavior'],
    ['/compare/stop-biting-vs-habitaware', 'Stop Biting vs HabitAware (Keen bracelet)'],
    ['/compare/stop-biting-vs-nailkeeper', 'Stop Biting vs NailKeeper'],
    ['/compare/stop-biting-vs-pavlok', 'Stop Biting vs Pavlok'],
    ['/compare/stop-biting-vs-biteless', 'Stop Biting vs BiteLess'],
    ['/compare/stop-biting-vs-habitcam', 'Stop Biting vs HabitCam'],
    ['/compare/stop-biting-vs-nailbitemenu', 'Stop Biting vs NailBiteMenu'],
    ['/solutions/for-desk-workers', 'Stop nail biting at your desk'],
    ['/solutions/for-adhd', 'Nail biting and ADHD'],
    ['/solutions/for-gamers', 'Stop nail biting while gaming'],
    ['/solutions/for-students', 'Stop nail biting as a student'],
    ['/solutions/for-remote-workers', 'Stop nail biting working from home'],
    ['/solutions/for-mac', 'Stop nail biting on a Mac'],
    ['/solutions/for-windows', 'Stop nail biting on Windows'],
    ['/editorial-policy', 'Editorial policy and corrections'],
    ['/privacy', 'Privacy policy'],
    ['/terms-and-conditions', 'Terms of service'],
    ['/refund-policy', 'Refund policy'],
  ];

  function injectNoscriptNav(html, extraLinks = []) {
    const link = ([href, label]) =>
      `<li><a href="${escapeHtml(href)}">${escapeHtml(LIFETIME.navLabel(label))}</a></li>`;
    const extra = extraLinks.length
      ? `<h2>Articles</h2><ul>${extraLinks.map(link).join('')}</ul>`
      : '';
    const nav =
      `<noscript><nav aria-label="Site"><h2>Stop Biting</h2><ul>` +
      `${[...SITE_NAV, ...GATED_NAV].map(link).join('')}</ul>${extra}</nav></noscript>`;
    return html.replace('</body>', `    ${nav}\n  </body>`);
  }

  // Helper: inject page-specific <title>, <meta description>, <link canonical>,
  // Open Graph, and Twitter Card tags into the SPA index.html shell before sending it.
  // This makes critical SEO elements visible to Googlebot and AI crawlers.
  function injectMeta(html, { title, description, canonical, ogType = 'website', ogImage }) {
    // Every value below is interpolated into an HTML attribute, so it must be
    // escaped. A description containing a quoted phrase — a "nail biting cure"
    // — otherwise closes the content attribute on its own first quote, and the
    // tag silently truncates to a few words while the rest of the sentence
    // becomes stray attributes.
    //
    // The replacements are functions, not strings: String.prototype.replace
    // treats $&, $', $` and $1 inside a string replacement as substitution
    // patterns, so copy containing them would come out mangled.
    const t = escapeHtml(title);
    const d = escapeHtml(description);
    const c = escapeHtml(canonical);
    const o = escapeHtml(ogType);
    let out = html
      .replace(/<title>[^<]*<\/title>/, () => `<title>${t}</title>`)
      .replace(/<meta name="description" content="[^"]*"/, () => `<meta name="description" content="${d}"`)
      .replace(/<link rel="canonical" href="[^"]*"/, () => `<link rel="canonical" href="${c}"`)
      .replace(/<meta property="og:type" content="[^"]*"/, () => `<meta property="og:type" content="${o}"`)
      .replace(/<meta property="og:title" content="[^"]*"/, () => `<meta property="og:title" content="${t}"`)
      .replace(/<meta property="og:description" content="[^"]*"/, () => `<meta property="og:description" content="${d}"`)
      .replace(/<meta property="og:url" content="[^"]*"/, () => `<meta property="og:url" content="${c}"`)
      .replace(/<meta name="twitter:title" content="[^"]*"/, () => `<meta name="twitter:title" content="${t}"`)
      .replace(/<meta name="twitter:description" content="[^"]*"/, () => `<meta name="twitter:description" content="${d}"`)
      // The shell ships `author` = "Stop Biting" — the organisation — while the
      // JSON-LD `author` on every article, and the visible byline beside it,
      // name a Person. Three declarations of authorship, one of them a
      // different kind of entity from the other two. It is rewritten here from
      // SCHEMA_AUTHOR.name rather than hardcoded in index.html so the meta tag,
      // the schema and the byline read from one string and cannot drift apart.
      .replace(/<meta name="author" content="[^"]*"/, () => `<meta name="author" content="${escapeHtml(SCHEMA_AUTHOR.name)}"`);
    // Per-page OG image (absolute URL). When absent, the shell's shared
    // /og/site.png tags pass through untouched.
    if (ogImage) {
      const img = escapeHtml(ogImage);
      out = out
        .replace(/<meta property="og:image" content="[^"]*"/, () => `<meta property="og:image" content="${img}"`)
        .replace(/<meta name="twitter:image" content="[^"]*"/, () => `<meta name="twitter:image" content="${img}"`)
        // The shell's alt text describes the site card, not this page's image.
        // These cards are rendered from the page title, so the title is the
        // truthful alt text; dropping the tag left 171 pages with no alt.
        .replace(/(<meta property="og:image:alt" content=")[^"]*"/, (_m, pre) => `${pre}${t}"`)
        .replace(/(<meta name="twitter:image:alt" content=")[^"]*"/, (_m, pre) => `${pre}${t}"`);
    }
    return out;
  }

  // ── JSON-LD helpers ────────────────────────────────────────────────────────
  // AI crawlers and Googlebot's first pass do not execute JavaScript, so
  // schemas are injected server-side. The server copy is CANONICAL — the
  // client injects no BlogPosting/BreadcrumbList of its own (it used to, which
  // left two BlogPosting entities under one @id with different headlines).
  //
  // Entity @ids are shared with the shell blocks in index.html (#organization,
  // #website, #app, #person). Nodes that repeat across pages carry the SAME @id,
  // so a consumer merges them into one entity instead of collecting 153 unlinked
  // lookalikes. The inline properties are kept alongside the @id (rather than
  // collapsing author/publisher to a bare reference) because Google requires
  // `author.name` and `publisher.name` on Article/BlogPosting — the @id adds
  // identity without removing anything a rich result depends on.
  const ORG_ID = 'https://stopbiting.today/#organization';
  const PERSON_ID = 'https://stopbiting.today/#person';
  const WEBSITE_ID = 'https://stopbiting.today/#website';
  const APP_ID = 'https://stopbiting.today/#app';
  // One entity, one topic list. This used to be written out twice — once on the
  // author node of 152 articles, once on the /about Person node — and the two
  // copies had already drifted apart (`WebAssembly` on one, `body-focused
  // repetitive behaviors` on the other), so #person described itself two ways
  // on the same site. Both routes now read this const; they cannot diverge.
  const PERSON_KNOWS_ABOUT = [
    'nail biting',
    'onychophagia',
    'body-focused repetitive behaviors',
    'habit reversal training',
    'MediaPipe',
    'WebAssembly',
    'on-device AI',
  ];
  const SCHEMA_AUTHOR = {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: 'Igor Gazivoda',
    url: 'https://stopbiting.today/about',
    jobTitle: 'Founder',
    // This identifies the author, rather than the product's source repository.
    sameAs: ['https://github.com/gazivoda'],
    knowsAbout: PERSON_KNOWS_ABOUT,
    worksFor: { '@id': ORG_ID },
  };
  // Rendered byline for the crawler-visible article, verbatim what BlogPost.tsx
  // shows a visitor after hydration — so the Person the schema names is also the
  // byline in the pre-JS HTML, on the same page. See bylineHtml() above; the
  // visible text is `${SCHEMA_AUTHOR.name} · ${AUTHOR_ROLE}` on both sides.
  const AUTHOR_ROLE = 'Founder, Stop Biting';
  // MUST stay byte-identical in `url` and `logo` to the Organization block in
  // index.html: both declare @id …/#organization, so a consumer merges them.
  // They used to disagree — `https://stopbiting.today` here vs the shell's
  // trailing-slash form — which left one entity with two contradictory `url`
  // values on every article page. The logo points at the same icon asset the
  // shell names, expressed as an ImageObject on both sides.
  const SCHEMA_PUBLISHER = {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'Stop Biting',
    url: 'https://stopbiting.today/',
    logo: { '@type': 'ImageObject', url: 'https://stopbiting.today/icons/icon-512x512.png' },
  };
  const SCHEMA_IMAGE = {
    '@type': 'ImageObject',
    // The site card from scripts/generate-og-images.mjs (same template as
    // every post card). /og-image.png holds the same bytes for old shares.
    url: 'https://stopbiting.today/og/site.png',
    width: 1200,
    height: 630,
  };
  // Speakable (GEO): tells voice assistants and AI crawlers which passages to
  // read aloud / quote. The selectors MUST match elements in the raw served
  // HTML — they point at the server-rendered article (#ssr-page-content):
  // its <h1> and the standfirst paragraph, which carries the article-summary
  // class in blogArticleHtml()/homeArticleHtml()/compareArticleHtml() and in
  // the inline articles for /blog, /about, /pricing and /how-it-works, and for
  // the legal and tool pages. Only pages that actually ship that article emit
  // it; a route without one must omit the spec.
  // A route that adds `speakable` MUST add `class="article-summary"` to its
  // standfirst in the same change; a selector matching nothing is worse than
  // no selector at all.
  const SCHEMA_SPEAKABLE = {
    '@type': 'SpeakableSpecification',
    cssSelector: ['#ssr-page-content h1', '#ssr-page-content .article-summary'],
  };
  // Per-post OG/hero image: posts may set `ogImage` in blogPosts.ts (a
  // site-absolute path under public/, e.g. "/og/psychology.png", 1200x630).
  // Falls back to the shared /og/site.png until per-tag images exist.
  function postImageUrl(post) {
    if (!post.ogImage) return null;
    return post.ogImage.startsWith('http')
      ? post.ogImage
      : `https://stopbiting.today${post.ogImage}`;
  }
  // One ImageObject shape for every route that has its own card, and the shared
  // SCHEMA_IMAGE for every route that does not — so `image` in the JSON-LD can
  // never name a different file from og:image/twitter:image on the same page.
  function schemaImage(url) {
    return url ? { '@type': 'ImageObject', url, width: 1200, height: 630 } : SCHEMA_IMAGE;
  }
  function postSchemaImage(post) {
    return schemaImage(postImageUrl(post));
  }
  // Per-page OG card for a non-blog route. scripts/generate-og-images.mjs
  // writes public/og/<path, leading slash dropped, / → ->.png for every entry
  // in COMPARE_META and `vite build` copies public/ verbatim into dist/, so the
  // served file and this URL are the same bytes. The file is probed rather than
  // assumed: a route whose card has not been generated yet falls back to the
  // shell's shared /og/site.png and to SCHEMA_IMAGE, instead of advertising a
  // social preview that 404s.
  function routeImageUrl(pagePath) {
    const file = `${pagePath.replace(/^\//, '').replace(/\//g, '-')}.png`;
    return existsSync(join(distPath, 'og', file))
      ? `https://stopbiting.today/og/${file}`
      : null;
  }

  function schemaTag(obj) {
    return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
  }

  function breadcrumbSchema(trail) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: trail.map(([name, item], i) =>
        ({ '@type': 'ListItem', position: i + 1, name, item })),
    };
  }

  // ── FAQ answer blocks ──────────────────────────────────────────────────────
  // Question-headed Q&A is the unit AI answer engines extract, and FAQPage is
  // how they are told where it is. The hard rule, learned expensively: mark up
  // ONLY pairs that genuinely render, with the answer text byte-identical to
  // the visible answer. An earlier homepage FAQPage declared six Q&As of which
  // one was on the page.
  //
  // Nothing below hardcodes a question. The pairs are read out of the very
  // markup the route serves, so schema and page share one source by
  // construction, and a page with no FAQ section simply gets no FAQPage.
  const FAQ_HEADING = /\b(faq|frequently asked|common questions)\b/i;
  const HTML_ENTITIES = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': '\'', '&nbsp;': ' ',
  };
  // The text an element shows a reader: tags dropped, entities decoded. One
  // pass, so a decoded `&` is never rescanned into a second entity.
  function elementText(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g, m => HTML_ENTITIES[m])
      .trim();
  }

  // Every `<h3>question</h3><p>answer</p>` pair in a block of authored markup.
  //
  // A pair is emitted only when EVERYTHING between one question and the next is
  // a paragraph. If a list, a table or any other element sits in between, the
  // visible answer is not the text of those paragraphs, so the pair is dropped
  // rather than described by a partial answer.
  function faqPairsFromHtml(html) {
    const pairs = [];
    const chunks = html.split(/<h3\b[^>]*>/i);
    // chunks[0] precedes the first question and belongs to no answer.
    for (let i = 1; i < chunks.length; i++) {
      const close = chunks[i].indexOf('</h3>');
      if (close < 0) continue;
      const q = elementText(chunks[i].slice(0, close));
      const rest = chunks[i].slice(close + '</h3>'.length);
      const paragraph = /\s*<p\b[^>]*>([\s\S]*?)<\/p>\s*/gi;
      const answers = [];
      let consumed = 0;
      let m;
      while ((m = paragraph.exec(rest)) !== null) {
        if (m.index !== consumed) break;   // something that is not a <p> intervened
        answers.push(elementText(m[1]));
        consumed = paragraph.lastIndex;
      }
      if (consumed !== rest.length || !answers.length || !q) continue;
      pairs.push({ q, a: answers.join(' ') });
    }
    return pairs;
  }

  // The one FAQ-headed section of a compare/solutions page, if it has one.
  // Matched on the section's own visible heading, never on a path or a title,
  // so a page that gains or loses an FAQ needs no change here.
  function visibleFaqSection(content) {
    for (const s of content?.sections ?? []) {
      if (!s.html || !FAQ_HEADING.test(s.heading ?? '')) continue;
      const pairs = faqPairsFromHtml(s.html);
      if (pairs.length) return { heading: s.heading, pairs };
    }
    return null;
  }

  // Keep the Q&A node distinct from the canonical WebPage and any #article
  // entity. Its #faq fragment identifies the answers, not the whole page.
  function faqPageSchema(canonical, name, faqs) {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      url: canonical,
      name,
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORG_ID },
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: copyHtml(f.q),
        acceptedAnswer: { '@type': 'Answer', text: copyHtml(f.a) },
      })),
    };
  }

  function injectBlogSchemas(html, { slug, description, canonical, post }) {
    const blogPosting = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      // The article's identity in the graph. Without it every article was
      // anonymous, and the stub /blog declares for the same post (see the
      // CollectionPage below) became a second, unlinked half-entity: one node
      // with the body, one with the link. Both now carry this @id and merge
      // into a single article. The fragment distinguishes that article from
      // its WebPage; `url`/`mainEntityOfPage` keep the page canonical below.
      '@id': `${canonical}#article`,
      // The article's OWN title — the string blogArticleHtml() renders as the
      // <h1>. It used to be the SEO meta title (post.seoTitle ?? post.title),
      // which differed from the visible heading on 97 of 152 articles: AI
      // engines quote `headline`, so they were quoting a title no reader sees.
      // `seoTitle` still drives <title> — that is its job, and it is unchanged.
      headline: post.title,
      description,
      url: canonical,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      // Dates come from blogPosts.ts via seo-content.json — the same values
      // the rendered page shows, so they cannot conflict.
      datePublished: post.datePublished,
      dateModified: post.dateModified,
      author: SCHEMA_AUTHOR,
      publisher: SCHEMA_PUBLISHER,
      inLanguage: 'en',
      isAccessibleForFree: true,
      timeRequired: `PT${post.readingMinutes}M`,
      articleSection: post.tag,
      image: postSchemaImage(post),
      speakable: SCHEMA_SPEAKABLE,
    };

    const breadcrumb = breadcrumbSchema([
      ['Home', 'https://stopbiting.today/'],
      ['Blog', 'https://stopbiting.today/blog'],
      // The trail's leaf names the page as the page names itself, for the same
      // reason `headline` does.
      [post.title, canonical],
    ]);

    const schemaBlocks = [schemaTag(blogPosting), schemaTag(breadcrumb)];

    // A post that renders an FAQ-headed section of <h3>/<p> pairs gets a
    // FAQPage, read out of that same markup. This ran only on compare and
    // solutions pages before, so the two posts that do render an FAQ block
    // described it to no one. Same function, same contract: a post with no
    // FAQ section still gets no FAQPage.
    const postFaq = visibleFaqSection(post);
    if (postFaq) schemaBlocks.push(schemaTag(faqPageSchema(canonical, postFaq.heading, postFaq.pairs)));

    // HowTo for any post whose own sections are numbered "Step N: ..." (two or
    // more). Steps are read from those sections, so the markup can only describe
    // text a reader can see (no separate copy to drift). Name and description
    // default to the post's title and meta description; the HRT guide keeps the
    // hand-set pair below because its lead sentence is what the page says.
    const HOWTO_TEXT = {
      'habit-reversal-training-guide': {
        name: 'How to Stop Nail Biting Using Habit Reversal Training',
        description: 'A three-step procedure: notice every episode, have a competing response ready, and get an external signal.',
      },
    };
    const howToSteps = post.sections
      .map(s => ({ m: /^Step (\d+):\s*(.+)$/.exec(s.heading), body: s.body }))
      .filter(x => x.m && x.body)
      .map((x, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: x.m[2],
        text: x.body.replace(/\s*\n\n\s*/g, ' '),
      }));
    if (howToSteps.length >= 2) {
      const text = HOWTO_TEXT[slug] || { name: post.title, description: post.description };
      schemaBlocks.push(schemaTag({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: text.name,
        description: text.description,
        step: howToSteps,
      }));
    }

    const schemas = schemaBlocks.join('\n    ');

    // Inject before closing </head>
    return html.replace('</head>', `    ${schemas}\n  </head>`);
  }

  // Read index.html once at startup (it's static after build).
  //
  // The shell in index.html carries schema blocks that are NOT true of every
  // route, so two variants are derived from it and each route picks one:
  //
  //   indexHtmlFaqOnly     FAQPage, no MedicalCondition — the homepage only.
  //   indexHtml            neither — the default shell for every other route.
  //
  // The MedicalCondition block is stripped from BOTH. It is never served as the
  // shell ships it; the routes that qualify re-emit a per-page copy built by
  // visibleConditionSchema() below.
  //
  // MedicalCondition scoping rule: a page may carry the condition entity only
  // when the page's own crawler-visible text discusses the condition the entity
  // describes. This used to be approximated by the post's tag (Clinical /
  // Health / Treatment), which put the block on 71 URLs — and on 58 of them the
  // rendered text contained none of what it asserts. A YMYL medical entity on a
  // page that never names the condition is exactly the "don't mark up content
  // that is not visible to readers" case, and it risks the site's other
  // structured data being discounted with it.
  //
  // The rule is derived from the block itself rather than hardcoded here, so it
  // can never claim more than the block claims, and it is applied per therapy
  // rather than per page — see visibleConditionSchema() below.
  let indexHtml = null;
  let indexHtmlRaw = null;
  let indexHtmlFaqOnly = null;
  const indexPath = join(distPath, 'index.html');
  const stripSchemaBlock = (html, label) => html.replace(
    new RegExp(`\\n\\n[ \\t]*<!-- Structured Data: ${label}[\\s\\S]*?<\\/script>`),
    '',
  );
  if (existsSync(indexPath)) {
    // The one product node (#app) of the shell says what is for sale: with the Lifetime plan on, it lists that offer too.
    indexHtmlRaw = LIFETIME.shell(readFileSync(indexPath, 'utf-8'));
    // MedicalCondition comes off both shells — it is only ever re-emitted
    // per page. FAQPage comes off the default shell too, so it survives on the
    // homepage alone (see app.get('/') below); no other route may carry it.
    indexHtmlFaqOnly = stripSchemaBlock(indexHtmlRaw, 'MedicalCondition');
    indexHtml = stripSchemaBlock(indexHtmlFaqOnly, 'FAQPage');
    if (indexHtmlFaqOnly === indexHtmlRaw) {
      // Either the block is gone from index.html (nothing to emit anywhere), or
      // its comment marker changed and the strip silently missed it — in which
      // case the unfiltered block rides the shell onto every route and the
      // qualifying ones emit a second, narrowed copy beside it.
      console.error('WARNING: the MedicalCondition block in index.html did not match the strip pattern — check that it is still present and still introduced by its "Structured Data: MedicalCondition" comment.');
    }
  }

  // The MedicalCondition entity the shell declares, read out of index.html so
  // the served copy and the source can never drift, decomposed into what proves
  // a reader was actually shown each therapy: its parenthesised acronym, and
  // the words of its name. "Habit Reversal Training (HRT)" yields the acronym
  // "hrt" and the words habit/reversal/training; "Bitter-taste nail polish"
  // yields no acronym and bitter/taste/nail/polish.
  let CONDITION_ENTITY = null;
  let CONDITION_NAME = null;
  let CONDITION_THERAPIES = [];
  if (indexHtmlRaw) {
    const m = indexHtmlRaw.match(
      /<!-- Structured Data: MedicalCondition[\s\S]*?<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    try {
      const cond = JSON.parse(m[1]);
      CONDITION_ENTITY = cond;
      CONDITION_NAME = cond.name.toLowerCase();
      CONDITION_THERAPIES = [cond.possibleTreatment ?? []].flat().map(therapy => {
        const name = String(therapy.name).toLowerCase();
        return {
          therapy,
          acronym: name.match(/\(([^)]+)\)/)?.[1] ?? null,
          words: name.replace(/\s*\([^)]*\)/g, '').split(/[^a-z0-9]+/).filter(Boolean),
        };
      });
    } catch {
      console.error('WARNING: could not parse the MedicalCondition block in index.html — the entity will not be emitted on any route.');
    }
  }
  // The text a reader of `articleHtml` — the exact markup this route puts in the
  // served page — actually sees THIS PAGE CLAIM. Two kinds of markup are in the
  // article but are not the page making a claim, and both are stripped before
  // any matching: they carry other people's words.
  //
  //   1. "Related articles" / "Related reading" are navigation. A link whose
  //      title happens to name the condition is not this page discussing it —
  //      without this, 3 posts qualified purely on a sibling's headline.
  //
  //   2. A "Sources:" bibliography quotes THE TITLES OF OTHER PEOPLE'S PAPERS.
  //      Twohig 2003 is titled "Evaluating the efficacy of habit reversal…" and
  //      Lee & Lipner 2022 "…diagnosis and management of onychophagia and
  //      onychotillomania". Once citations were added to 102 posts, both the
  //      condition name and a therapy name were readable on pages whose prose
  //      says neither, and the entity spread from 15 pages to 42 — asserting
  //      Habit Reversal Training as a treatment on posts about nail technicians
  //      and press-on nails, where the words exist only in the reference list.
  //      Citing a paper about a treatment is not recommending the treatment;
  //      a YMYL claim the reader is never shown must not reach the schema.
  //
  // The bibliography is removed twice over so the next citation campaign cannot
  // reopen this: by its label (the shape blogPosts.ts emits — "Sources:" and
  // "Sources for this section:", each followed by its list), and by shape — any
  // list item carrying an outbound link is a citation wherever it sits and
  // whatever introduces it. Every citation item in the corpus matches both, and
  // no list or outbound link exists outside a reference block, so the shape rule
  // costs nothing today and catches an unlabelled bibliography tomorrow.
  const CITATION_BLOCK = /<p>\s*<strong>\s*Sources\b[^<]*<\/strong>\s*<\/p>\s*(?:<ul>[\s\S]*?<\/ul>)?/gi;
  const CITATION_ITEM = /<li>[\s\S]*?<\/li>/g;
  const isCitationItem = li => /<a [^>]*href="https?:/i.test(li);
  function visibleArticleText(articleHtml) {
    return articleHtml
      .replace(/<section><h2>Related [\s\S]*?<\/section>/g, ' ')
      .replace(CITATION_BLOCK, ' ')
      .replace(CITATION_ITEM, li => (isCitationItem(li) ? ' ' : li))
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#39;/g, '\'')
      .replace(/&amp;/g, '&')
      .toLowerCase();
  }
  const namesWord = (text, term) =>
    new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);

  // Whether a page's visible text shows the reader this therapy: its acronym as
  // a word, or every word of its name somewhere in the copy.
  //
  // Every word, rather than the name as a literal phrase, because the name in
  // the block is a label and not a quotation the prose has to repeat. The two
  // pages that review this treatment at length — with brand names, a mechanism
  // and a verdict — write "bitter nail polish", "bitter taste" and
  // "bitter-tasting polish", never the block's own "bitter-taste nail polish".
  // A phrase test would strip the therapy from the only pages that genuinely
  // document it. Requiring all four words still refuses every page that
  // discusses none of it, and no synonym is invented here: the vocabulary comes
  // entirely from the entity.
  //
  // The scatter test is what a paper title in a bibliography exploited, so it
  // was re-examined when citations were excluded above rather than kept on
  // faith. With the reference lists out of `text` it stands: the 7 assertions
  // that rest on it are all real prose — "bitter", "taste", "nail", "polish"
  // on the four posts that review bitter polish under other names, and
  // "active habit-reversal work … awareness training" on the gel-manicure post.
  // Tightening it to a phrase match would cost those and prevent nothing that
  // excluding citations does not already prevent.
  function therapyIsVisible(text, { acronym, words }) {
    if (acronym && namesWord(text, acronym)) return true;
    return words.length > 0 && words.every(word => namesWord(text, word));
  }

  // The MedicalCondition entity for one page, narrowed to the therapies that
  // page's own visible text actually names — or null when the page never names
  // the condition, or names none of the therapies.
  //
  // The page-level gate alone was not enough. It passed a page on the condition
  // name plus ANY ONE therapy, then emitted the shell's full possibleTreatment
  // list: of the pages that qualified, all but two shipped a block asserting
  // bitter-taste nail polish as a treatment while their copy never mentions it
  // — they qualified on Habit Reversal Training and carried the polish along
  // for the ride. Filtering per therapy makes the list a statement about this
  // page, and a page left with no therapy at all emits no entity rather than an
  // untreatable condition.
  function visibleConditionSchema(articleHtml) {
    if (!CONDITION_ENTITY || !CONDITION_NAME || !CONDITION_THERAPIES.length) return null;
    const text = visibleArticleText(articleHtml);
    if (!text.includes(CONDITION_NAME)) return null;
    const possibleTreatment = CONDITION_THERAPIES
      .filter(t => therapyIsVisible(text, t))
      .map(({ therapy }) => therapy);
    if (!possibleTreatment.length) return null;
    // Spread first so the narrowed list keeps possibleTreatment's original
    // position in the entity and every other property passes through verbatim.
    return { ...CONDITION_ENTITY, possibleTreatment };
  }

  // Append one JSON-LD block to <head>.
  function injectSchema(html, obj) {
    return html.replace('</head>', `    ${schemaTag(obj)}\n  </head>`);
  }

  // HTML responses must not be cached: every route's HTML is assembled per
  // build (meta, schemas, article content), and a cached shell would keep
  // serving stale titles and content after a deploy. Hashed /assets keep their
  // 1-year immutable cache — the filenames change instead.
  const HTML_SENDFILE_OPTS = { headers: { 'Cache-Control': 'no-cache' } };
  // `lastModified` is a YYYY-MM-DD content date (a post's dateModified, or the
  // page's entry in the freshness ledger). Every indexable HTML route passes
  // one: without it a crawler doing a conditional fetch gets no date at all, and
  // `/`, `/pricing`, `/how-it-works` and `/about` carried no freshness signal
  // anywhere — no header, no `dateModified`, no `article:modified_time`. It is
  // the same value sitemap.xml and the JSON-LD publish, so the three agree.
  // Omitted deliberately on 404s and on any route with no content date.
  // WS11b: the copy-affecting flags that are ON, as a marker in every 200 page, so a marketing page can word
  // its copy without asking for the flags (src/features/copyFlags.ts). Empty, and nothing is added, while
  // they are all off.
  const copyMarkerFlags = ['event_sync', 'phone_companion'].filter(name => flags.isOn(name));
  const copyMarkerTag = copyMarkerFlags.length ? `<meta name="sb-copy-flags" content="${copyMarkerFlags.join(' ')}">` : '';
  // ── Localized marketing pages (WS12b) ───────────────────────────────────────
  // dist/i18n/<locale>.json holds each language's rendered pages and its review marker (src/i18n/locales/<x>/reviewed.ts).
  // Never served (the /i18n route below). Each language is off, draft (flag on, not reviewed: 200, noindex, no sitemap, no
  // hreflang) or live (flag on and reviewed: indexable); server/marketing/localePages.js has the rule. SB_I18N_DIR points a
  // test at another folder of the same files; nothing makes a language "reviewed" except the marker in the file.
  const LOCALE_FILES = loadLocaleFiles(process.env.SB_I18N_DIR || join(distPath, 'i18n'));
  const LOCALE_STATES = localeStates(flags, LOCALE_FILES);
  const LOCALE_CTX = { files: LOCALE_FILES, states: LOCALE_STATES };
  if (servedLocales(LOCALE_STATES).length) {
    console.log(`[locale] served: ${servedLocales(LOCALE_STATES).map(l => `${l} (${LOCALE_STATES[l]})`).join(', ')}`);
  }
  function sendHtml(res, html, status = 200, lastModified = null) {
    if (copyMarkerTag && status === 200) html = html.replace('</head>', () => `${copyMarkerTag}</head>`);
    // The links to the open pages, for the React footer (server/marketing/gatedPages.js). '' while none is open.
    if (gatedLinksTag && status === 200) html = html.replace('</head>', () => `${gatedLinksTag}</head>`);
    // The language switcher's marker and the hreflang links of the four core pages: nothing while no language is served.
    if (status === 200) html = decorateEnglishHtml(html, res.req?.path, LOCALE_CTX);
    if (lastModified) {
      const when = new Date(`${lastModified}T00:00:00Z`);
      if (!Number.isNaN(when.valueOf())) res.set('Last-Modified', when.toUTCString());
    }
    res.status(status).set('Cache-Control', 'no-cache').type('html').send(html);
  }

  // The 6 homepage FAQ answers, read from the FAQPage JSON-LD in index.html —
  // which Landing.tsx already mirrors (Google requires the visible counterpart)
  // — so the crawler prose, the schema, and the rendered page share one source.
  let HOME_FAQS = [];
  // The shell the homepage is served from. It is indexHtmlFaqOnly untouched unless a copy rule is
  // active (WS11b), in which case its FAQPage block says what the visible FAQ says for these flags.
  let homeShell = indexHtmlFaqOnly;
  if (indexHtmlRaw) {
    const m = indexHtmlRaw.match(/<!-- Structured Data: FAQPage -->\s*<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (m) {
      try {
        const faqSchema = JSON.parse(m[1]);
        HOME_FAQS = faqSchema.mainEntity.map(q => ({ q: q.name, a: q.acceptedAnswer.text }));
        if (COPY_ACTIVE) {
          const followed = flagAwareDeep(faqSchema, copyIsOn);
          HOME_FAQS = followed.mainEntity.map(q => ({ q: q.name, a: q.acceptedAnswer.text }));
          if (followed !== faqSchema && indexHtmlFaqOnly.includes(m[1])) {
            homeShell = indexHtmlFaqOnly.replace(m[1], () => `\n${JSON.stringify(followed, null, 2)}\n        `);
          }
        }
      } catch (err) {
        console.error('WARNING: could not parse FAQPage schema from index.html', err);
      }
    }
  }

  // Crawler-visible homepage summary. Keep the copy in step with Landing.tsx
  // (hero, live demo, how-it-works, pricing) — the FAQ block is parsed from the
  // FAQPage schema above and cannot drift.
  function homeArticleHtml() {
    const faqs = HOME_FAQS.map(f =>
      `<section><h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p></section>`).join('');
    return (
      // Headings and copy follow what the page renders, section for section.
      // This block is what a crawler without JavaScript reads, so it must say
      // what a visitor sees (Landing.tsx), not a differently-worded version.
      '<h1>Stop biting your nails.</h1>' +
      '<p class="article-summary">Stop Biting uses your webcam and on-device AI to detect nail biting in real time: ' +
      'it checks 21 hand landmarks and your face mesh five times a second, and the moment your hand moves toward your mouth an ' +
      'audible alarm fires within a second, catching the automatic episodes you never notice. All detection runs ' +
      `locally via MediaPipe and WebAssembly: no camera data ever leaves your device. The ${TRIAL_HYPHEN} free trial needs no ` +
      'credit card; after that it is $2.99/month or $29.00/year.</p>' +
      '<p>Your webcam watches your hands while you work. The moment a fingertip reaches your lips, an alarm sounds, ' +
      'so you catch the bites you would otherwise never notice. Made for a laptop or desktop with a webcam. ' +
      'Detection runs on your device and sends no camera data while it runs. Sign in with Google (it opens in a new tab). Cancel anytime.</p>' +
      '<section><h2>Try the detector right now</h2>' +
      '<p>Runs on your own camera for 60 seconds, no account needed. Your browser will ask for camera access first. Turn your sound on. About 20 MB of ' +
      'AI models download once; after that, no video leaves the page.</p></section>' +
      '<section><h2>Every catch ends up in History</h2>' +
      '<p>Each alarm and each bite you log lands here with the time. Tag what set it off ' +
      '(stress, boredom, deep focus) and after a week you can see which one is yours.</p></section>' +
      '<section><h2>How to start</h2>' +
      '<p>Sign in with Google (it opens in a new tab), allow the camera, and get on with your work. When your hand ' +
      'reaches your mouth, it goes off. That\'s the whole setup. It runs in your desktop browser, so there\'s nothing ' +
      'to download. You can install it like an app later if you want it one click away.</p>' +
      '<h3>Before you start</h3><ul>' +
      '<li>You need a webcam and a laptop or desktop browser. It\'s made for the hours you spend at a screen.</li>' +
      '<li>Keep the app open while you work. If you switch to another tab, press Minimize so a small window keeps watching.</li>' +
      '<li>It reacts to a hand near your mouth, not only to biting, so resting your chin on your fingers can set it off. Sensitivity has three levels.</li>' +
      '<li>It makes a noise. Pick a quieter sound, turn it down, or use a screen flash instead.</li>' +
      '<li>Your history is stored in this browser, so it doesn\'t follow you to another computer.</li></ul>' +
      'Read more at <a href="/how-it-works">how it works</a>, or start with ' +
      '<a href="/blog/how-to-stop-nail-biting">the complete guide to stopping nail biting</a>.</section>' +
      '<section><h2>Why an alarm works when willpower doesn\'t</h2>' +
      '<p>Nail biting runs on autopilot: by the time you notice, you\'re already doing it. That is why bitter polish and ' +
      'willpower rarely stick. The method with the strongest evidence, habit reversal training, starts with one hard ' +
      'step: noticing every time.</p>' +
      '<p>In a clinic, a therapist would tap your shoulder. The alarm is that tap, available all day while you work. ' +
      'What you do next (press your palms flat, clench a fist) is the other half of the method, and it\'s yours.</p>' +
      '<p>An app is not a clinician. For severe or distressing biting, the TLC Foundation for Body-Focused Repetitive ' +
      'Behaviors lists BFRB-informed therapists.</p></section>' +
      '<section><h2>Your camera never leaves your device.</h2>' +
      '<p>A camera pointed at you all day is a lot to trust an app with, so detection runs entirely in your browser, ' +
      'on your own computer. No camera data is sent while it runs. Signing in and paying use the network.</p></section>' +
      '<section><h2>Why this exists</h2>' +
      '<p>I bit my nails for over twenty years. Bitter polish, reminder bands, willpower: none of it lasted, because ' +
      'I never noticed I was doing it until the damage was done. I write software and I had a webcam, so I built the ' +
      'thing that notices for me. Igor Gazivoda. <a href="/about">The longer story</a>.</p></section>' +
      testimonialsArticleHtml() +
      '<section><h2>$2.99 a month, or $29 a year.</h2>' +
      `<p>Start with a ${TRIAL_HYPHEN} free trial, no credit card required. ` +
      'Monthly: $2.99/month. Yearly: $29.00/year, just $2.42/month, saving 19%. ' +
      'Both plans include unlimited AI detection, streak and habit tracking, full incident history, and all alert types. ' +
      'Secure payment via Paddle, cancel anytime. You can ask for a full refund within 14 days of your first payment (<a href="/refund-policy">refund policy</a>). See <a href="/pricing">pricing details</a>.</p></section>' +
      `<section><h2>Questions people ask about nail biting</h2>${faqs}</section>` +
      '<section><h2>Learn more</h2><ul>' +
      '<li><a href="/blog">Evidence-based nail biting guides</a></li>' +
      '<li><a href="/how-it-works">How the AI detection works</a></li>' +
      '<li><a href="/about">About Stop Biting</a></li>' +
      '</ul></section>'
    );
  }

  // Homepage — serve with FAQPage schema (only this route should have it)
  app.get('/', (_req, res) => {
    if (!indexHtmlFaqOnly) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    const homeDescription = `Stop nail biting with your webcam: on-device AI sounds an alarm the moment a finger reaches your mouth. No camera data is sent while it runs. ${TRIAL_HYPHEN} free trial.`;
    // The homepage FAQ names onychophagia and habit reversal training in flow,
    // so it earns the MedicalCondition entity — but which therapies it may list
    // is read off the article it actually renders, never assumed.
    const article = homeArticleHtml();
    const condition = visibleConditionSchema(article);
    let injected = injectMeta(homeShell, {
      title: 'Nail Biting App: Stop Biting with AI | Stop Biting',
      description: homeDescription,
      canonical: 'https://stopbiting.today/',
    });
    if (condition) injected = injectSchema(injected, condition);
    // The hero screenshot is the largest thing above the fold on desktop, but
    // React only creates its <img> after the JS bundle has run. Preloading it
    // from the HTML starts the download in parallel. srcset/sizes mirror the
    // <img> in Landing.tsx exactly, or the browser fetches a second copy.
    injected = injected.replace(
      '</head>',
      '<link rel="preload" as="image" href="/shots/app-watch-1280.webp" ' +
      'imagesrcset="/shots/app-watch-1280@1x.webp 1280w, /shots/app-watch-1280.webp 2560w" ' +
      'imagesizes="(min-width: 1024px) 36rem, 100vw" fetchpriority="high"></head>',
    );
    // WebPage entity carrying the speakable spec — injected only here, so
    // legal/noindex routes (which share the same shell) never receive it.
    // Selectors resolve against the SSR article injected just below.
    const homeWebPage = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': 'https://stopbiting.today/',
      url: 'https://stopbiting.today/',
      name: 'Nail Biting App: Stop Biting with AI | Stop Biting',
      description: homeDescription,
      // Reference, not a re-declaration — the WebSite node ships in the shell.
      isPartOf: { '@id': WEBSITE_ID },
      speakable: SCHEMA_SPEAKABLE,
      inLanguage: 'en',
      // What the page is about, who wrote it (the "Why this exists" section is
      // signed by him), and its real screenshot (see public/shots provenance).
      about: { '@id': 'https://stopbiting.today/#app' },
      author: SCHEMA_AUTHOR,
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: 'https://stopbiting.today/shots/app-watch-1280.webp',
        width: 2560,
        height: 1584,
        caption: 'The Stop Biting Watch screen, shown with example data.',
      },
      // Same date sitemap.xml and the Last-Modified header carry.
      ...(pageLastmod('/') ? { dateModified: pageLastmod('/') } : {}),
    };
    // Single-item trail: the homepage is the root of every other trail on the
    // site, and this makes that explicit rather than leaving the one page they
    // all point at as the only one without a BreadcrumbList.
    const breadcrumb = breadcrumbSchema([['Home', 'https://stopbiting.today/']]);
    injected = injected.replace('</head>', `    ${schemaTag(homeWebPage)}\n    ${schemaTag(breadcrumb)}\n  </head>`);
    injected = injectSsrArticle(injected, article);
    sendHtml(res, injectNoscriptNav(injected), 200, pageLastmod('/'));
  });

  // Google renders roughly 600px of title text, about 60 characters.
  //
  // This used to hard-cut the title at 45 characters and append an ellipsis,
  // which sliced words in half ("The Psycholog…") on 105 of 140 posts and threw
  // away the term the page actually ranks for. Two rules fix that: never cut
  // mid-word, and treat the brand suffix as the first thing to sacrifice — a
  // recognisable brand is worth less than the keywords it pushes out, and
  // Google appends the site name itself when it wants to.
  //
  // Posts can still opt out entirely by setting `seoTitle` in blogPosts.ts.
  const TITLE_BUDGET = 60;
  const BRAND_SUFFIX = ' | Stop Biting';

  function buildPageTitle(rawTitle) {
    const title = (rawTitle || '').trim();
    if (title.length + BRAND_SUFFIX.length <= TITLE_BUDGET) return title + BRAND_SUFFIX;
    if (title.length <= TITLE_BUDGET) return title;

    const clipped = title.slice(0, TITLE_BUDGET - 1);
    const lastSpace = clipped.lastIndexOf(' ');
    // Only honour the word boundary if it still leaves a meaningful title.
    const trimmed = lastSpace > 30 ? clipped.slice(0, lastSpace) : clipped;
    return trimmed.replace(/[\s,;:.\-–—]+$/, '') + '…';
  }

  // Blog post pages — inject per-post meta + structured data before serving the SPA shell
  app.get('/blog/:slug', (req, res) => {
    const { slug } = req.params;
    const post = BLOG_POSTS[slug];
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    if (!post) {
      // Content file failed to load — serve the shell and let React render the
      // post rather than 404ing all 140 real posts.
      if (!SEO_CONTENT_LOADED) return sendHtml(res, indexHtml, 200);
      // Unknown slug — the branded 404 page, exactly like the catch-all below.
      // Serving the SPA shell here returned a 404 status wrapped around a body
      // that still said `robots: index, follow` and canonicalised to `/`: an
      // error page asking to be indexed, and pointing its authority at the
      // homepage. NOT_FOUND_HTML is noindex and declares no canonical at all.
      return sendHtml(res, NOT_FOUND_HTML, 404);
    }
    const canonical = `https://stopbiting.today/blog/${slug}`;
    // Same title the client sets on mount: buildPageTitle(seoTitle ?? title).
    const metaTitle = post.seoTitle ?? post.title;
    // MedicalCondition only when this post's own rendered text names the
    // condition, and listing only the therapies that text names — see
    // visibleConditionSchema().
    const article = blogArticleHtml(post);
    const condition = visibleConditionSchema(article);
    let injected = injectMeta(indexHtml, {
      title: buildPageTitle(metaTitle),
      description: post.description,
      canonical,
      ogType: 'article',
      ogImage: postImageUrl(post),
    });
    injected = injectBlogSchemas(injected, {
      slug,
      description: post.description,
      canonical,
      post,
    });
    if (condition) injected = injectSchema(injected, condition);
    // Same two dates the BlogPosting JSON-LD and sitemap lastmod carry, as the
    // Open Graph article tags that Bing, Copilot and Perplexity read.
    injected = injected.replace('</head>', () =>
      `    <meta property="article:published_time" content="${escapeHtml(post.datePublished)}" />\n` +
      `    <meta property="article:modified_time" content="${escapeHtml(post.dateModified)}" />\n  </head>`);
    injected = injectSsrArticle(injected, article);
    sendHtml(res, injectNoscriptNav(injected), 200, post.dateModified);
  });

  // `hasPart` on /blog used to stub every post: 143 nodes, 44.6 KB of JSON-LD,
  // 90% of the page's weight — restating links the SSR list below already
  // carries in-flow with the same anchor text. The stubs now merge into the
  // real article nodes by @id, so they are a recency window, not the index:
  // the newest posts get a machine-readable entry, and the visible list stays
  // the complete 143-link hub it has always been.
  const BLOG_FEATURED_COUNT = 20;
  const BLOG_RECENT = Object.entries(BLOG_POSTS)
    // Newest first by publication date; slug breaks ties so the block is
    // byte-stable across restarts.
    .sort(([aSlug, a], [bSlug, b]) =>
      (b.datePublished ?? '').localeCompare(a.datePublished ?? '') || aSlug.localeCompare(bSlug))
    .slice(0, BLOG_FEATURED_COUNT);

  // Blog index page
  app.get('/blog', (req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    let injected = injectMeta(indexHtml, {
      title: 'Nail Biting Resources: Evidence-Based Guides | Stop Biting',
      description: 'Research-backed articles on habit psychology, treatment options, and the science of breaking body-focused repetitive behaviours.',
      canonical: 'https://stopbiting.today/blog',
    });

    // The page's own node. CollectionPage is a WebPage subtype, so this is the
    // page entity — hence the @id (it had none, leaving the index anonymous in
    // a graph where every article it lists is now identified) and the speakable
    // spec, whose selectors resolve against the SSR <h1> and the
    // `article-summary` standfirst injected below.
    const collectionSchema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': 'https://stopbiting.today/blog',
      name: 'Nail Biting Resources — Evidence-Based Guides',
      description: 'Research-backed articles on onychophagia, habit reversal training, and body-focused repetitive behaviors.',
      url: 'https://stopbiting.today/blog',
      isPartOf: { '@id': WEBSITE_ID },
      publisher: SCHEMA_PUBLISHER,
      speakable: SCHEMA_SPEAKABLE,
      // Each stub carries the same @id as the full BlogPosting on the article's
      // own page, so the two merge into one entity instead of describing the
      // article twice. `headline` is the article title, which is both the
      // anchor text in the list below and the <h1> on the article itself.
      hasPart: BLOG_RECENT.map(([slug, p]) => ({
        '@type': 'BlogPosting',
        '@id': `https://stopbiting.today/blog/${slug}#article`,
        headline: p.title,
        description: p.description,
        url: `https://stopbiting.today/blog/${slug}`,
      })),
      ...(pageLastmod('/blog') ? { dateModified: pageLastmod('/blog') } : {}),
    };
    const breadcrumb = breadcrumbSchema([
      ['Home', 'https://stopbiting.today/'],
      ['Blog', 'https://stopbiting.today/blog'],
    ]);

    injected = injected.replace('</head>', `    ${schemaTag(collectionSchema)}\n    ${schemaTag(breadcrumb)}\n  </head>`);
    // The index is the hub: listing every article as a real in-flow link is
    // what makes each one reachable — with anchor text — by crawlers that
    // never run the JS, in one hop from /. This list stays complete even though
    // `hasPart` above is a window — the links are the discovery path, not the
    // stubs.
    const postList = Object.entries(BLOG_POSTS).map(([slug, p]) =>
      `<li><a href="/blog/${slug}">${escapeHtml(p.title)}</a><br>${escapeHtml(p.description)}</li>`).join('');
    const articleHtml =
      '<h1>Nail biting resources</h1>' +
      '<p class="article-summary">Research-backed articles on habit psychology, treatment options, and the science of breaking body-focused repetitive behaviours.</p>' +
      '<p>New here? Start with <a href="/blog/how-to-stop-nail-biting">How to stop nail biting: the complete guide</a>.</p>' +
      `<section><h2>All articles</h2><ul>${postList}</ul></section>`;
    injected = injectSsrArticle(injected, articleHtml);
    sendHtml(res, injectNoscriptNav(injected), 200, pageLastmod('/blog'));
  });

  // The three legal pages carried no page-level schema at all: indexable URLs
  // that identified no node of their own, so the only entities on them were the
  // sitewide shell's. This adds a WebPage keyed by the page's own canonical and
  // the breadcrumb that places it under the homepage — nothing beyond the title,
  // description and freshness date the served HTML already carries. These
  // routes now inject an SSR article (h1 + `.article-summary`), so the shared
  // speakable selectors resolve here too.
  function legalPageSchemas(path, name, description) {
    const canonical = `https://stopbiting.today${path}`;
    const webPage = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': canonical,
      url: canonical,
      name,
      description,
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORG_ID },
      speakable: SCHEMA_SPEAKABLE,
      ...(pageLastmod(path) ? { dateModified: pageLastmod(path) } : {}),
    };
    const breadcrumb = breadcrumbSchema([
      ['Home', 'https://stopbiting.today/'],
      [name, canonical],
    ]);
    return `    ${schemaTag(webPage)}\n    ${schemaTag(breadcrumb)}\n  </head>`;
  }

  // Privacy policy page
  app.get('/privacy', (req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    const description = 'Stop Biting processes your webcam feed on-device. No camera data is sent while it runs. Read our full privacy policy.';
    let injected = injectMeta(indexHtml, {
      title: 'Privacy Policy | Stop Biting',
      description,
      canonical: 'https://stopbiting.today/privacy',
    });
    injected = injected.replace('</head>', legalPageSchemas('/privacy', 'Privacy Policy', description));
    injected = injectSsrArticle(injected,
      '<h1>Privacy Policy</h1>' +
      '<p class="article-summary">Last updated September 26, 2026. Stop Biting is designed so that your camera feed never leaves your device, and your habit log stays in your own browser. This policy explains exactly what data exists, where it is kept, which third parties see any of it, and why.</p>' +
      '<h2>In this policy</h2>' +
      '<ul><li>Overview</li><li>Camera and Video Data</li><li>Data We Collect</li><li>How We Use Your Data</li><li>Authentication</li><li>Payment Processing</li><li>Third Parties</li><li>Data Storage</li><li>Data Retention</li><li>Cookies</li><li>Your Rights</li><li>Children&#39;s Privacy</li><li>Changes to This Policy</li><li>Contact</li></ul>');
    sendHtml(res, injectNoscriptNav(injected), 200, pageLastmod('/privacy'));
  });

  // Terms of Service page
  app.get('/terms-and-conditions', (req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    const description = 'Terms of Service for Stop Biting, the on-device AI nail biting detection app. Read our usage terms, subscription terms, and user rights.';
    let injected = injectMeta(indexHtml, {
      title: 'Terms of Service | Stop Biting',
      description,
      canonical: 'https://stopbiting.today/terms-and-conditions',
    });
    injected = injected.replace('</head>', legalPageSchemas('/terms-and-conditions', 'Terms of Service', description));
    injected = injectSsrArticle(injected,
      '<h1>Terms of Service</h1>' +
      '<p class="article-summary">Last updated October 24, 2026. These are the terms for using Stop Biting at stopbiting.today, including the free trial, subscriptions and billing, the Lifetime plan, the referral program, refunds, acceptable use and governing law.</p>' +
      '<h2>In this policy</h2>' +
      '<ul><li>Acceptance of Terms</li><li>Description of Service</li><li>Free Trial</li><li>Subscriptions and Billing</li><li>Lifetime Plan</li><li>Referral Program</li><li>Refunds</li><li>User Accounts</li><li>Acceptable Use</li><li>Privacy</li><li>Disclaimer of Warranties</li><li>Limitation of Liability</li><li>Changes to Terms</li><li>Governing Law</li><li>Contact</li></ul>');
    sendHtml(res, injectNoscriptNav(injected), 200, pageLastmod('/terms-and-conditions'));
  });

  // Refund Policy page
  app.get('/refund-policy', (req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    const description = 'Refund and cancellation policy for Stop Biting subscriptions: cancel anytime, and request a full refund within 14 days of your first payment.';
    let injected = injectMeta(indexHtml, {
      title: 'Refund Policy | Stop Biting',
      description,
      canonical: 'https://stopbiting.today/refund-policy',
    });
    injected = injected.replace('</head>', legalPageSchemas('/refund-policy', 'Refund Policy', description));
    injected = injectSsrArticle(injected,
      '<h1>Refund Policy</h1>' +
      '<p class="article-summary">Last updated October 24, 2026. This policy outlines when and how refunds are issued for Stop Biting subscription payments and the one-time Lifetime plan. All new users get a 3-day free trial with no credit card required.</p>' +
      '<h2>In this policy</h2>' +
      '<ul><li>Overview</li><li>Free Trial</li><li>Refund Eligibility</li><li>Lifetime Plan</li><li>Referral Bonus Access</li><li>How to Request a Refund</li><li>Processing</li><li>Cancellation</li><li>Exceptional Circumstances</li><li>Contact</li></ul>');
    sendHtml(res, injectNoscriptNav(injected), 200, pageLastmod('/refund-policy'));
  });

  // Remaining static assets (icons, WASM, models, etc.)
  // redirect:false: the 301 middleware above strips the trailing slash from
  // extensionless paths while express.static adds one for a directory, so
  // /shots and /video bounced between each other forever. A bare directory now
  // falls through to the 404 handler instead.
  // sitemap.xml: the generated file never lists a gated page (scripts/sync-seo.mjs). While a page's
  // own flag is on it is spliced in here, at start-up (flags only change on a restart); while every
  // gated flag is off this handler is not registered and express.static serves the file exactly as before.
  const SITEMAP_PATH = join(distPath, 'sitemap.xml');
  const GATED_OPEN = Object.keys(GATED_CONTENT).length > 0;
  // WS12b: a language that is live (flag on AND reviewed) puts its pages in, with xhtml:link alternates on both sides.
  // Draft and off languages add nothing; with none live the handler below exists only for the gated pages, as before.
  const LOCALE_SITEMAP = liveLocales(LOCALE_STATES).length > 0;
  if ((GATED_OPEN || LOCALE_SITEMAP) && existsSync(SITEMAP_PATH)) {
    const sitemapWithGated = withLocaleAlternates(
      GATED_OPEN
        ? withGatedSitemapEntries(
          readFileSync(SITEMAP_PATH, 'utf-8'),
          gatedSitemapEntries(GATED_CONTENT, pageLastmod, { warn: console.warn }),
        )
        : readFileSync(SITEMAP_PATH, 'utf-8'),
      LOCALE_CTX,
    );
    app.get('/sitemap.xml', (_req, res) => {
      res.set('Cache-Control', 'public, max-age=0').type('application/xml').send(sitemapWithGated);
    });
  }
  // llms.txt and llms-full.txt: the same. The open pages are appended to the generated files, and
  // while a site-wide copy rule is active the full text follows the flags too. Nothing is
  // registered with every flag off, so both files are served byte for byte as built.
  const LLMS_TXT_PATH = join(distPath, 'llms.txt');
  const LLMS_FULL_PATH = join(distPath, 'llms-full.txt');
  // The Lifetime plan (LIFETIME.llmsTxt / .llmsFull) is the same kind of addition: a Lifetime bullet in the Pricing
  // block, and a Pricing section llms-full.txt never had, only while the plan is for sale.
  if ((GATED_OPEN || LIFETIME.on) && existsSync(LLMS_TXT_PATH)) {
    let llmsTxt = null;   // built on the first request: COMPARE_META (the descriptions) is declared further down
    app.get('/llms.txt', (_req, res) => {
      llmsTxt ??= LIFETIME.llmsTxt(withGatedLlmsTxt(
        readFileSync(LLMS_TXT_PATH, 'utf-8'),
        gatedLlmsTxtLines(GATED_CONTENT, path => COMPARE_META[path]),
      ));
      res.set('Cache-Control', 'public, max-age=0').type('text/plain; charset=utf-8').send(llmsTxt);
    });
  }
  if ((GATED_OPEN || COPY_ACTIVE || LIFETIME.on) && existsSync(LLMS_FULL_PATH)) {
    // A section a marker emptied leaves a bare "### " line in the text version; drop it with its blank line.
    const resolveBlock = text => flagAware(fillCopyTokens(text, COPY_TOKENS), copyIsOn).replace(/^### *\n\n/gm, '');
    const llmsFullTxt = LIFETIME.llmsFull(withGatedLlmsFull(
      copyHtml(readFileSync(LLMS_FULL_PATH, 'utf-8')),
      gatedLlmsFullText(GATED_CONTENT, GATED_FILE.llmsFull, resolveBlock),
    ));
    app.get('/llms-full.txt', (_req, res) => {
      res.set('Cache-Control', 'public, max-age=0').type('text/plain; charset=utf-8').send(llmsFullTxt);
    });
  }
  if (COPY_ACTIVE && existsSync(seoContentPath)) {
    app.get('/seo-content.json', (_req, res) => {
      res.set({ 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=0' }).type('json')
        .send(copyHtml(readFileSync(seoContentPath, 'utf-8')));
    });
  }
  // The JSON a feature page renders from: the same copy as the crawler article above, for pages whose
  // flag is on. With every gated flag off the route does not exist and the path is any other unknown
  // address (the branded 404). Not a page: noindex, from the rule for .json files above.
  if (GATED_OPEN) {
    app.get('/page-data/{*rest}', (req, res) => {
      const page = GATED_CONTENT[pathOfPageData(req.path)];
      if (!page) return sendHtml(res, NOT_FOUND_HTML, 404);
      res.set('Cache-Control', 'no-cache').json(page);
    });
  }
  // The unpublished copy of the gated pages is for this server only.
  app.get('/seo-gated.json', (_req, res) => res.status(404).type('text/plain').send('Not found'));
  // WS12b: dist/i18n/*.json (the rendered localized pages and the review markers) is for this server only: it answers like
  // any address that does not exist.
  app.get('/i18n/{*rest}', (_req, res) => sendHtml(res, NOT_FOUND_HTML, 404));

  app.use(express.static(distPath, { redirect: false }));

  // Core app pages — each needs its own canonical and meta so they can be indexed separately
  app.get('/about', (_req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    const aboutDescription = 'Stop Biting was built by Igor Gazivoda, a developer who bit his nails for 20 years. On-device AI detection that sends no camera data anywhere while it runs.';
    let injected = injectMeta(indexHtml, {
      title: 'About Stop Biting | Built by Igor Gazivoda',
      description: aboutDescription,
      canonical: 'https://stopbiting.today/about',
    });
    // Same @id as SCHEMA_AUTHOR: the founder named on 152 articles and the
    // founder described here are one node, not two people with one name — which
    // is also why `knowsAbout` is the shared PERSON_KNOWS_ABOUT const and not a
    // second hand-written list.
    const personSchema = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': PERSON_ID,
      name: 'Igor Gazivoda',
      url: 'https://stopbiting.today/about',
      sameAs: SCHEMA_AUTHOR.sameAs,
      jobTitle: 'Founder',
      worksFor: { '@id': ORG_ID },
      knowsAbout: PERSON_KNOWS_ABOUT,
      description: 'Igor Gazivoda is the founder of Stop Biting, an on-device AI app for nail biting detection built with MediaPipe and WebAssembly.',
    };
    // The page itself had no page-level node at all — only the Person it
    // describes. AboutPage is the WebPage subtype for exactly this page, and it
    // is what carries the speakable spec (selectors resolve against the SSR
    // <h1> and `article-summary` standfirst below) and the freshness date.
    const aboutPage = {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      '@id': 'https://stopbiting.today/about',
      url: 'https://stopbiting.today/about',
      name: 'About Stop Biting',
      description: aboutDescription,
      isPartOf: { '@id': WEBSITE_ID },
      // The page is about the company; the founder it profiles is the Person
      // node above, linked from the org side by worksFor.
      about: { '@id': ORG_ID },
      publisher: { '@id': ORG_ID },
      speakable: SCHEMA_SPEAKABLE,
      ...(pageLastmod('/about') ? { dateModified: pageLastmod('/about') } : {}),
    };
    const breadcrumb = breadcrumbSchema([
      ['Home', 'https://stopbiting.today/'],
      ['About', 'https://stopbiting.today/about'],
    ]);
    injected = injected.replace('</head>', `    ${schemaTag(aboutPage)}\n    ${schemaTag(personSchema)}\n    ${schemaTag(breadcrumb)}\n  </head>`);
    // Crawler-visible summary — keep the copy in step with About.tsx.
    injected = injectSsrArticle(injected,
      '<h1>About Stop Biting</h1>' +
      '<p class="article-summary">Built by a nail biter, for nail biters: Igor Gazivoda bit his nails for over 20 years, ' +
      'then built the awareness component of Habit Reversal Training into an app: MediaPipe hand tracking, ' +
      '21 landmarks five times a second, running entirely on your own device.</p>' +
      '<section><h2>The founder&#39;s story</h2>' +
      '<p>I&#39;m Igor Gazivoda, a software developer. I bit my nails for over 20 years: constantly, automatically, ' +
      'without noticing until the damage was already done. I tried everything: bitter polish, reminder bands, sheer willpower. ' +
      'They all failed the same way, because the habit is automatic and happens below the threshold of conscious awareness.</p>' +
      '<p>When I read the research on Habit Reversal Training, I understood why everything else had failed. HRT&#39;s core ' +
      'insight is that awareness is the bottleneck: you can&#39;t interrupt a habit you don&#39;t know is happening. ' +
      'I had a webcam, I knew how to code, and I knew MediaPipe could run hand tracking on-device. So I built the awareness ' +
      'component, the part of HRT that is hardest to do alone.</p></section>' +
      '<section><h2>What Stop Biting does</h2>' +
      '<p>Stop Biting uses your computer&#39;s webcam and Google&#39;s MediaPipe framework (compiled to WebAssembly and ' +
      'running entirely in your browser) to detect when your hand moves toward your mouth. When it does, an audible alarm fires. ' +
      'That alarm is the external awareness signal HRT research identifies as the most critical component of treatment. ' +
      'The app also logs each detection with a timestamp, so you can see your actual biting frequency, not your estimated frequency.</p></section>' +
      '<section><h2>Privacy: the non-negotiable</h2>' +
      '<p>All video processing runs in WebAssembly on your device. No video, no frames and no detections are transmitted. ' +
      'You can disconnect your internet connection after the app loads and it will function identically. ' +
      'Your alarm and bite log is stored in your browser. The site counts page visits with Google Analytics; that never includes anything from your camera.</p></section>' +
      '<section><h2>The technology</h2>' +
      '<p>Detection is built on Google MediaPipe&#39;s Hand Landmarker, which locates 21 hand landmarks. Stop Biting runs it five times a second: enough to catch a hand on its way to your mouth, and far less CPU than running it on every frame. ' +
      'Mouth proximity detection compares hand landmark coordinates to facial landmark coordinates in each frame. ' +
      'Read the full explanation at <a href="/how-it-works">how it works</a>.</p></section>' +
      '<section><h2>How this site is written</h2>' +
      '<p>Every article, guide and comparison here is written by me. I&#39;m a developer, not a clinician, and the ' +
      '<a href="/editorial-policy">editorial policy and corrections page</a> says exactly what that means for what you read: ' +
      'how claims are sourced, how anything I say about a competing product is checked, and how to tell me when ' +
      'something on this site is wrong.</p></section>');
    sendHtml(res, injectNoscriptNav(injected), 200, pageLastmod('/about'));
  });

  // ── Editorial policy and corrections ───────────────────────────────────────
  // A named author with no published standards is half an authority signal.
  // This page carries the other half, and it is deliberately short: it states
  // only practices this repository actually follows. There is no editorial
  // board, no medical reviewer, no staff and no review cadence, so none is
  // claimed — see the evidence map at the top of src/data/editorialPolicy.ts,
  // which is where the copy lives and which EditorialPolicyPage.tsx renders
  // for visitors from the same strings.
  app.get(EDITORIAL_POLICY_PATH, (_req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    // No content file (or one built before this page existed): serve the shell
    // and let React render it from the module rather than ship a blank page.
    if (!EDITORIAL_POLICY) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    const canonical = `https://stopbiting.today${EDITORIAL_POLICY_PATH}`;
    const description = 'Who writes Stop Biting’s articles, why he is not a clinician, how claims and competitor '
      + 'comparisons are sourced and verified, and how to report a mistake.';
    let injected = injectMeta(indexHtml, {
      title: 'Editorial Policy and Corrections | Stop Biting',
      description,
      canonical,
    });
    // The page describes the Person who writes the site, so it points at the
    // existing #person node rather than declaring a second one.
    const policyPage = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': canonical,
      url: canonical,
      name: EDITORIAL_POLICY.title,
      description,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': PERSON_ID },
      publisher: { '@id': ORG_ID },
      // Selectors resolve against the <h1> and the `article-summary`
      // standfirst in the article injected below.
      speakable: SCHEMA_SPEAKABLE,
      ...(pageLastmod(EDITORIAL_POLICY_PATH) ? { dateModified: pageLastmod(EDITORIAL_POLICY_PATH) } : {}),
    };
    const breadcrumb = breadcrumbSchema([
      ['Home', 'https://stopbiting.today/'],
      [EDITORIAL_POLICY.title, canonical],
    ]);
    injected = injected.replace('</head>', `    ${schemaTag(policyPage)}\n    ${schemaTag(breadcrumb)}\n  </head>`);
    // Same shape LegalPage.tsx renders the sections in: a string is a
    // paragraph, an array is a list.
    const sections = EDITORIAL_POLICY.sections.map(s => {
      const content = Array.isArray(s.content)
        ? `<ul>${s.content.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : `<p>${escapeHtml(s.content)}</p>`;
      return `<section><h2>${escapeHtml(s.heading)}</h2>${content}</section>`;
    }).join('');
    injected = injectSsrArticle(injected,
      `<h1>${escapeHtml(EDITORIAL_POLICY.title)}</h1>` +
      `<p>Last updated: ${escapeHtml(EDITORIAL_POLICY.lastUpdated)}</p>` +
      `<p class="article-summary">${escapeHtml(EDITORIAL_POLICY.standfirst)}</p>` +
      sections + authorBoxHtml({ policyLink: false }));
    sendHtml(res, injectNoscriptNav(injected), 200, pageLastmod(EDITORIAL_POLICY_PATH));
  });

  // /faq has no client-side route and its content lives on the homepage —
  // redirect permanently and let the anchor do the scrolling.
  app.get('/faq', (_req, res) => res.redirect(301, '/#faq'));

  // Pricing — dedicated page. The client renders PricingPage.tsx here, which
  // reuses the same PricingSection component as the landing page, so crawler
  // view and user view carry the same figures. Prices in the prose and the
  // Offer schema below MUST match PricingSection.tsx exactly:
  // $2.99/month, $29.00/year, free trial (${TRIAL_HYPHEN}).
  // The two questions an AI engine actually resolves against a pricing page,
  // answered directly and in the page's own first section. Every figure here is
  // already on the page and in PricingSection.tsx — $2.99/month, $29.00/year,
  // $2.42/month equivalent, 19% saving, ${TRIAL_HYPHEN} trial, no credit card. Nothing is
  // introduced; the page simply never stated it in the shape of an answer, so
  // "how much does Stop Biting cost" had no extractable passage to lift.
  //
  // One source for the visible <h2>/<p> pairs AND for the FAQPage below, the
  // same contract HOME_FAQS and HOW_IT_WORKS_FAQS enforce: the answer a machine
  // reads is by construction the answer a reader sees.
  // These ARE the four questions PricingPage.tsx renders, word for word: the FAQPage schema
  // below must describe what a visitor sees, and a JS-rendering crawler sees the React page.
  // The previous two questions here appeared nowhere on that page. `html` is the same answer
  // with its link, for the crawler copy; the schema carries the plain `a`.
  const PRICING_FAQS = [
    {
      q: `How does the ${TRIAL_HYPHEN} free trial work?`,
      a: `Every account starts with a ${TRIAL_HYPHEN} free trial that includes full detection and tracking features, with no credit card required. When the trial ends, pick the monthly or yearly plan to keep going.`,
    },
    {
      q: 'What is the difference between Monthly and Yearly?',
      a: 'Both plans include the same features: detection for as long as you run it, current and best streak, full history with trigger tags, and sound, flash, or both. Yearly is billed once at $29.00 (about $2.42/month, saving 19% versus $2.99/month billing) and adds priority support.',
    },
    {
      q: 'How do payments work?',
      a: 'Payments are handled by Paddle, a secure merchant of record. Stop Biting never sees or stores your card details.',
    },
    {
      q: 'Can I cancel anytime?',
      a: 'Yes. Cancel anytime from the app settings and you keep access until the end of the paid period. See the refund policy for details.',
      html: 'Yes. Cancel anytime from the app settings and you keep access until the end of the paid period. See the <a href="/refund-policy">refund policy</a> for details.',
    },
  ];

  app.get('/pricing', (_req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    // LIFETIME.meta hands the object back untouched unless the Lifetime plan is for sale; the literals stay as they
    // were (scripts/sync-seo.mjs reads them for llms.txt).
    let injected = injectMeta(indexHtml, LIFETIME.meta({
      title: 'Pricing: $2.99/month or $29/year | Stop Biting',
      description: `Stop Biting pricing: ${TRIAL_HYPHEN} free trial, no card required. Then $2.99/month or $29/year (about $2.42/month, save 19%). Cancel anytime.`,
      canonical: 'https://stopbiting.today/pricing',
    }));
    // This page used to declare its own SoftwareApplication with its own copy of
    // the three Offers. The shell (index.html) already ships that entity on every
    // route, so the money page described the product as two unlinked nodes — and
    // the local copy was the poorer of the two (no billingIncrement). It now
    // REFERENCES the shell node by @id: one SoftwareApplication on the page,
    // whose offers ($0 trial / $2.99 monthly / $29.00 yearly) are the ones in
    // index.html and match the prose below and PricingSection.tsx.
    const pricingSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      // The money page was the one WebPage on the site without an @id, so it
      // could not be referenced or merged the way `/` and every article can.
      '@id': 'https://stopbiting.today/pricing',
      name: 'Stop Biting Pricing',
      url: 'https://stopbiting.today/pricing',
      description: LIFETIME.pageDescription(`Pricing for Stop Biting: ${TRIAL_HYPHEN} free trial, then $2.99/month or $29/year.`),
      isPartOf: { '@id': WEBSITE_ID },
      mainEntity: { '@id': APP_ID },
      // Selectors resolve against the SSR <h1> and the `article-summary`
      // standfirst injected below.
      speakable: SCHEMA_SPEAKABLE,
      inLanguage: 'en',
      // What the page is about, who wrote it (the "Why this exists" section is
      // signed by him), and its real screenshot (see public/shots provenance).
      about: { '@id': 'https://stopbiting.today/#app' },
      author: SCHEMA_AUTHOR,
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: 'https://stopbiting.today/shots/app-watch-1280.webp',
        width: 2560,
        height: 1584,
        caption: 'The Stop Biting Watch screen, shown with example data.',
      },
      // Same date sitemap.xml and the Last-Modified header carry.
      ...(pageLastmod('/pricing') ? { dateModified: pageLastmod('/pricing') } : {}),
    };
    const breadcrumb = breadcrumbSchema([
      ['Home', 'https://stopbiting.today/'],
      ['Pricing', 'https://stopbiting.today/pricing'],
    ]);
    // FAQPage as its own `#faq` node: pricingSchema is the page's WebPage and
    // its `mainEntity` is already the SoftwareApplication, so the Q&A cannot
    // hang off it without displacing the product.
    const pricingFaq = faqPageSchema(
      'https://stopbiting.today/pricing', 'Stop Biting pricing questions', PRICING_FAQS);
    injected = injected.replace('</head>', `    ${schemaTag(pricingSchema)}\n    ${schemaTag(pricingFaq)}\n    ${schemaTag(breadcrumb)}\n  </head>`);
    injected = injectSsrArticle(injected,
      '<h1>$2.99 a month, or $29 a year.</h1>' +
      `<p class="article-summary">Simple, honest pricing: start with a ${TRIAL_HYPHEN} free trial — no credit card required — ` +
      'then $2.99/month or $29.00/year, which is just $2.42/month and saves 19% versus monthly billing.</p>' +
      // Answer target first: the question verbatim as a heading, then the
      // answer in one self-contained paragraph, before any plan detail.
      PRICING_FAQS.map(f =>
        `<section><h2>${escapeHtml(f.q)}</h2><p>${f.html ?? escapeHtml(f.a)}</p></section>`).join('') +
      '<section><h2>Monthly — $2.99/month</h2>' +
      '<p>Billed monthly. Includes unlimited AI detection, streak and habit tracking, full incident history, and all alert types.</p></section>' +
      '<section><h2>Yearly — $29.00/year</h2>' +
      '<p>Billed once a year — just $2.42/month, saving 19% versus monthly billing. Includes everything in Monthly plus priority support.</p></section>' +
      '<section><h2>What every plan includes</h2><ul>' +
      '<li>Detection for as long as you run it</li>' +
      '<li>Current and best streak</li>' +
      '<li>Full history with trigger tags</li>' +
      '<li>Sound, flash, or both</li>' +
      '<li>Detection runs on your device; no camera data leaves it</li>' +
      '</ul></section>' +
      '<section><h2>Payments and cancellation</h2>' +
      '<p>Secure payment via Paddle. Cancel anytime, and you can ask for a full refund within 14 days of your first payment: see the <a href="/refund-policy">refund policy</a>. ' +
      `The ${TRIAL_HYPHEN} free trial includes full detection and tracking features with no credit card required.</p></section>` +
      testimonialsArticleHtml() +
      '<section><h2>Start free</h2>' +
      '<p><a href="/">Launch the app</a> to start your free trial, or read <a href="/how-it-works">how the AI detection works</a>. ' +
      'To see what biting costs you first, use the <a href="/tools/nail-biting-cost-calculator">nail biting cost calculator</a>.</p></section>');
    sendHtml(res, injectNoscriptNav(injected), 200, pageLastmod('/pricing'));
  });

  // The five questions this page answers under "Common questions", word for word as
  // HowItWorks.tsx renders them (a test compares the two). One source for the crawler
  // <h3>/<p> pairs AND for the FAQPage schema below, so an answer a machine reads is by
  // construction the answer a reader sees. It listed three of the five, and its second answer
  // used a dash where the page has a colon, so the schema did not match the page.
  const HOW_IT_WORKS_FAQS = [
    {
      q: 'What happens to my camera data?',
      a: 'It is processed frame by frame on your device by the MediaPipe WASM binary running locally. '
        + 'No camera data is sent while it runs. Signing in and paying use the network, and you can check this yourself by watching your network traffic while the app runs.',
    },
    {
      q: 'Does it work on Mac, Windows, and Linux?',
      a: 'The web app works on any device with a modern browser and webcam: Mac, Windows, Linux, and Chromebook.',
    },
    {
      q: 'Will it false-alarm when I\'m eating or touching my face?',
      a: 'The detection model distinguishes sustained hand-to-mouth proximity from brief touches, and sensitivity can be adjusted in settings.',
    },
    {
      q: 'Does it work if I\'m not at the camera?',
      a: 'Detection needs your face and hands in frame. At a desk you are usually in frame anyway.',
    },
    {
      q: 'Does it work in the dark?',
      a: 'Detection accuracy drops in poor lighting. A desk lamp or ordinary room light is enough; you don\'t need anything special.',
    },
  ];

  // How it works page.
  app.get('/how-it-works', (_req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    const howToSchema = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to Use Stop Biting for Nail Biting Detection',
      description: 'Set up real-time AI nail biting detection in under 2 minutes using your webcam.',
      totalTime: 'PT2M',
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Open the app', text: 'Visit stopbiting.today in Chrome, Edge, or Firefox. There is nothing to install.' },
        { '@type': 'HowToStep', position: 2, name: 'Grant camera access', text: 'Allow the app to use your webcam. The video is processed locally and no camera data is sent while it runs.' },
        { '@type': 'HowToStep', position: 3, name: 'Position your webcam', text: 'Make sure your face and hands are visible in the camera view. The AI tracks hand-to-mouth movements.' },
        { '@type': 'HowToStep', position: 4, name: 'Work normally', text: 'The app runs in the background. When it detects nail biting, an audible alarm fires immediately.' },
        { '@type': 'HowToStep', position: 5, name: 'Perform your competing response', text: 'When the alarm fires, do the hand exercise the app suggests, such as pressing your palms flat or clenching a fist: something your hands cannot do while biting.' },
      ],
    };
    // FAQPage IS a WebPage subtype, so this doubles as the page node rather
    // than sitting anonymously beside a second one: it carries the canonical as
    // its @id, the speakable spec (selectors resolve against the SSR <h1> and
    // the `article-summary` standfirst below) and the freshness date. The route
    // had no page-level identity at all before.
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': 'https://stopbiting.today/how-it-works',
      url: 'https://stopbiting.today/how-it-works',
      name: 'How AI nail biting detection works',
      description: 'Stop Biting uses MediaPipe and WebAssembly to detect nail biting in real time, on your device. No camera data is sent while it runs.',
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORG_ID },
      speakable: SCHEMA_SPEAKABLE,
      ...(pageLastmod('/how-it-works') ? { dateModified: pageLastmod('/how-it-works') } : {}),
      mainEntity: HOW_IT_WORKS_FAQS.map(f => ({
        '@type': 'Question',
        name: copyHtml(f.q),
        acceptedAnswer: { '@type': 'Answer', text: copyHtml(f.a) },
      })),
    };
    const breadcrumb = breadcrumbSchema([
      ['Home', 'https://stopbiting.today/'],
      ['How it works', 'https://stopbiting.today/how-it-works'],
    ]);
    // Crawler-visible summary — keep the copy in step with HowItWorks.tsx
    // (the steps mirror the HowTo schema above).
    const stepsHtml = howToSchema.step.map(s =>
      `<li><strong>${escapeHtml(s.name)}.</strong> ${escapeHtml(s.text)}</li>`).join('');
    const faqHtml = HOW_IT_WORKS_FAQS.map(f =>
      `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`).join('');
    const article =
      '<h1>How AI nail biting detection works</h1>' +
      '<p class="article-summary">Stop Biting uses MediaPipe and WebAssembly to detect nail biting in real time, entirely on your device. ' +
      'The MediaPipe Hand Landmarker tracks 21 hand landmarks, and the alarm fires about 0.6 seconds after it sees your hand approaching your mouth. ' +
      // "under two minutes" stays spelled out: nothing in this page's visible
      // body states a setup time, so the one claim here with no counterpart
      // below does not get made more quotable than the page can support.
      'Setup takes under two minutes.</p>' +
      // The same real capture, alt text and caption as the React page and the landing.
      '<figure><img src="/shots/app-watch-1280.webp" srcset="/shots/app-watch-1280@1x.webp 1280w, /shots/app-watch-1280.webp 2560w" ' +
      'sizes="(min-width: 1024px) 48rem, 100vw" width="1280" height="792" loading="lazy" decoding="async" ' +
      'alt="Stop Biting Watch screen with a large streak counter, alarms and bites today, and detection running.">' +
      '<figcaption>The Watch screen, shown with example data.</figcaption></figure>' +
      '<section><h2>Why awareness is the bottleneck</h2>' +
      '<p>Most biting episodes happen without you noticing: the habit is automatic, ' +
      'and it runs below the threshold of conscious awareness. ' +
      '<a href="/blog/habit-reversal-training-guide">Habit Reversal Training</a> (the gold-standard treatment) identifies ' +
      'awareness training as its most critical component. Stop Biting automates that component: it catches the episodes you don&#39;t notice.</p></section>' +
      `<section><h2>Getting started</h2><ol>${stepsHtml}</ol></section>` +
      '<section><h2>Technical specifications</h2><ul>' +
      '<li>Detection model: Google MediaPipe Hand Landmarker (21 landmarks)</li>' +
      '<li>Processing: WebAssembly — sandboxed, runs on your device</li>' +
      '<li>Alarm latency: about 0.6 seconds after your hand starts moving to your mouth</li>' +
      '<li>Incident logging: timestamped log stored locally — never transmitted</li>' +
      '</ul></section>' +
      `<section><h2>Common questions</h2>${faqHtml}</section>` +
      '<section><h2>Learn more</h2><ul>' +
      '<li><a href="/blog/habit-reversal-training-guide">Habit Reversal Training: the clinical method behind the app</a></li>' +
      '<li><a href="/blog/webcam-privacy-nail-biting-app">How we verified on-device processing</a></li>' +
      '<li><a href="/compare/bitter-polish-alternative">Stop Biting vs bitter nail polish</a></li>' +
      `<li><a href="/pricing">Pricing — $2.99/month or $29/year, ${TRIAL_HYPHEN} free trial</a></li>` +
      '</ul></section>';
    // This page describes the clinical mechanism but its prose never names
    // onychophagia as the MedicalCondition block defines it, so it does not
    // carry that entity — the rule decides, not the route.
    const condition = visibleConditionSchema(article);
    let injected = injectMeta(indexHtml, {
      title: 'How AI Nail Biting Detection Works | Stop Biting',
      description: 'Stop Biting uses MediaPipe and WebAssembly to detect nail biting in real time, on your device. No camera data is sent while it runs.',
      canonical: 'https://stopbiting.today/how-it-works',
    });
    if (condition) injected = injectSchema(injected, condition);
    injected = injected.replace('</head>', `    ${schemaTag(howToSchema)}\n    ${schemaTag(faqSchema)}\n    ${schemaTag(breadcrumb)}\n  </head>`);
    injected = injectSsrArticle(injected, article);
    sendHtml(res, injectNoscriptNav(injected), 200, pageLastmod('/how-it-works'));
  });

  // Comparison and solutions pages. Body content comes from COMPARE_CONTENT
  // (src/data/comparePages.ts via seo-content.json); the meta title/description
  // are the hand-tuned SERP variants. Each page gets Article + BreadcrumbList
  // schema (patterned on comparison-schema.json in the repo root).
  //
  // THESE ARE CLAIMS, AND NOTHING ELSE CHECKS THEM. Unlike a blog post, whose
  // `description` doubles as the on-page standfirst, these strings exist only
  // here: they are not derived from the page body, they never appear on the
  // page, and llms.txt quotes the page's `subtitle` instead — so a description
  // can contradict the body it summarises and every automated gate stays green.
  // Four corrections in a row have landed in a body while the SERP copy above
  // it kept the claim the body had just retracted, which is the version most
  // people actually read. When a competitor fact or a hedge changes in
  // src/data/comparePages.ts, re-read the matching entry here in the same edit.
  const COMPARE_META = {
    '/compare/bitter-polish-alternative': {
      title: 'Stop Biting vs Bitter Nail Polish: Which Works?',
      // "solves" was a totality claim the body refuses: detection "only covers
      // the time you spend in front of the camera", and the page's evidence
      // section now says the trial record "cuts both ways" rather than clearly
      // favouring either approach.
      description: 'AI detection catches what polish can\'t: unconscious biting. Polish has two small trials that disagree; habit reversal has 18 studies across habit disorders.',
    },
    '/compare/habit-tracking-apps': {
      title: 'Why Habit Apps Don\'t Work for Nail Biting | Stop Biting',
      // The old wording inverted the page's own argument — you cannot log an
      // episode you didn't notice, which is precisely why manual tracking
      // undercounts. The body says "you can only log episodes you notice".
      description: 'A manual log only records the episodes you notice. Stop Biting logs what the camera sees: after 7 days, your real frequency.',
    },
    '/solutions/for-desk-workers': {
      title: 'Stop Nail Biting at Your Desk | Stop Biting',
      // "catches every episode" survived the pass that softened the coverage
      // claims. The body is explicit that webcam detection covers only "the
      // time you spend in front of the camera" — "a large share of the habit"
      // for a desk worker, not all of it.
      description: 'Desk workers bite during deep focus, when self-monitoring goes offline. Stop Biting watches your webcam locally and alarms as your hand nears your mouth.',
    },
    '/solutions/for-adhd': {
      title: 'Nail Biting and ADHD: AI Detection That Works | Stop Biting',
      // The body names three mechanisms and attributes the awareness gap to
      // executive function and hyperfocus, not to dopamine-seeking, which it
      // says reinforces the habit. "Nearly impossible" also overstates the
      // body's "reduce awareness" — a clinical claim this page does not make.
      description: 'Executive function gaps, dopamine-seeking and hyperfocus each make ADHD nail biting harder to stop. Real-time AI detection externalises the awareness step.',
    },
    '/solutions/for-gamers': {
      title: 'Stop Nail Biting While Gaming | Stop Biting',
      description: 'Gaming flow state makes nail biting invisible. Stop Biting runs in the background and sounds an alarm without interrupting your session.',
    },
    '/solutions/for-students': {
      title: 'Stop Nail Biting as a Student | Stop Biting',
      description: 'Students bite most alone, at a laptop and on hard problems. Stop Biting uses your webcam and on-device AI to sound an alarm as your hand reaches your mouth.',
    },
    '/solutions/for-remote-workers': {
      title: 'Stop Nail Biting Working From Home | Stop Biting',
      description: 'Remote work means long focused stretches, idle hands and nobody watching. Stop Biting sounds an alarm the moment your hand reaches your mouth.',
    },
    '/solutions/for-mac': {
      title: 'Stop Nail Biting on a Mac | Stop Biting',
      description: `Stop Biting runs on a Mac in a browser tab, with no install. On-device webcam detection sounds an alarm as your hand reaches your mouth. ${TRIAL_HYPHEN} free trial.`,
    },
    '/solutions/for-windows': {
      title: 'Stop Nail Biting on Windows | Stop Biting',
      description: `Stop Biting runs on Windows in a browser tab, with no install. On-device webcam detection sounds an alarm as your hand reaches your mouth. ${TRIAL_HYPHEN} free trial.`,
    },
    // Competitor comparison pages. All competitor facts in the page bodies
    // (src/data/comparePages.ts) were verified against the competitors' own
    // sites on 2026-08-11 — see the FACT-CHECK LOG comment there. `date` is the
    // publish date and is fixed; `dateModified` is not set here at all — it
    // comes from the freshness ledger (src/data/pageUpdates.json).
    '/compare/stop-biting-vs-hands-off': {
      title: 'Stop Biting vs Hands Off: AI Nail Biting Apps Compared',
      description: 'Stop Biting ($2.99/mo, $29/yr) vs Hands Off (€2.99/mo, five BFRBs): two on-device AI webcam apps compared on platforms, price, privacy, 3-day trials.',
      date: '2026-08-11',
    },
    '/compare/stop-biting-vs-nailed': {
      // Two claims the body had already retracted survived here. The price:
      // nailedapp.io advertises "$4.99 · macOS only" while the Mac App Store
      // listing that is its only download button shows the app as Free
      // (offers.price 0, hasInAppPurchases false), so the page reports both
      // sources and asserts neither as the price a buyer pays — the title's
      // "One-Time" asserted it anyway. And tracking: that same listing is
      // subtitled "Offline nail-biting tracking", so "Stop Biting adds
      // tracking" understated a competitor that ships it.
      title: 'Stop Biting vs Nailed: Subscription vs Mac Menu Bar App',
      description: 'Nailed\'s site advertises $4.99, its App Store listing shows Free; we report both. Stop Biting adds Windows, the browser, deeper tracking. An honest comparison.',
      date: '2026-08-11',
    },
    '/compare/stop-biting-vs-smartbehavior': {
      // SmartBehavior ships a Windows app and its iPad app runs on Apple
      // Silicon Macs — the correction that removed "no macOS version" as a
      // differentiator from the body. Framing the split as "Desktop and Web vs
      // Mobile", and listing Windows only on our side, put that claim back.
      title: 'Stop Biting vs SmartBehavior: Which Fits Where You Bite?',
      description: 'SmartBehavior has native iPhone, Android and Windows apps and showed $0.99 on the US App Store; Stop Biting is $2.99/mo or $29/yr on Mac, Windows and browser.',
      date: '2026-08-11',
    },
    '/compare/stop-biting-vs-habitaware': {
      title: 'Stop Biting vs HabitAware (Keen): Wrist Sensor or Webcam?',
      description: 'HabitAware\'s Keen bracelet works anywhere you wear it and covers more behaviors; Stop Biting needs no hardware, $2.99/mo or $29/yr. An honest comparison.',
      date: '2026-10-05',
    },
    '/compare/stop-biting-vs-nailkeeper': {
      title: 'Stop Biting vs NailKeeper: Live Alarm or Photo Tracking?',
      description: 'NailKeeper describes photo tracking, a timer and reminders on iPhone and Android; Stop Biting is a real-time webcam alarm, $2.99/mo or $29/yr. Compared fairly.',
      date: '2026-10-06',
    },
    '/compare/stop-biting-vs-pavlok': {
      title: 'Stop Biting vs Pavlok: An Alert or a Shock?',
      description: 'Pavlok is a wearable whose site describes shock, vibration or chime feedback; Stop Biting is a webcam alarm, $2.99/mo or $29/yr. An honest comparison.',
      date: '2026-10-08',
    },
    '/compare/stop-biting-vs-biteless': {
      title: 'Stop Biting vs BiteLess: Apple Watch or Webcam?',
      description: 'BiteLess needs an Apple Watch and iPhone and alerts you on your wrist; Stop Biting is a webcam alarm with no hardware, $2.99/mo or $29/yr. An honest comparison.',
      date: '2026-10-08',
    },
    '/compare/stop-biting-vs-habitcam': {
      title: 'Stop Biting vs HabitCam: Subscription or Lifetime License?',
      description: 'HabitCam is a Windows and Linux program with a lifetime license; Stop Biting is a browser app with a free trial, $2.99/mo or $29/yr. An honest comparison.',
      date: '2026-10-13',
    },
    '/compare/stop-biting-vs-nailbitemenu': {
      title: 'Stop Biting vs NailBiteMenu: Browser or Open-Source Mac App?',
      description: 'NailBiteMenu is an open-source macOS 15.6+ menu bar app with no account; Stop Biting runs in a browser on Mac or Windows, $2.99/mo or $29/yr. Honest comparison.',
      date: '2026-10-13',
    },
    '/compare/ai-detection-apps': {
      title: 'Best AI Apps to Stop Nail Biting: 2026 Comparison',
      description: 'Every AI webcam app that detects nail biting in 2026 (Stop Biting, Hands Off, Nailed and SmartBehavior) compared on platforms, price and privacy.',
      date: '2026-08-11',
    },
    // The two entries below carry `flag`: the handler below answers 404 (the branded, noindex
    // page) until that flag is on, and sitemap.xml / the noscript nav list them only then. Their
    // copy is src/data/competitorPages.ts, facts marked NEEDS HUMAN VERIFICATION.
    '/compare/hands-off': {
      title: 'Hands Off Nail Biting App: Features, Price, Who It Suits',
      description: 'Hands Off is a Mac and Windows webcam app covering five behaviours, listed at €2.99 a month after 3 days free. What it does, who it suits, and where we differ.',
      date: '2026-10-23',
      flag: GATED_FLAG,
    },
    '/compare/habitaware-keen': {
      title: 'HabitAware Keen3 Bracelet: Price, How It Works, Who It Suits',
      description: 'Keen3 is HabitAware’s vibrating wrist bracelet: $199.00 with a year of Pro, shipping January 2027 per its site. Who it suits and where a webcam app fits.',
      date: '2026-10-23',
      flag: GATED_FLAG,
    },
    // WS11b: one page per feature, each behind the flag of the feature it describes. `gated: true`
    // means "closed unless dist/seo-gated.json names a flag for this path and that flag is on": the
    // flag is written once, in src/data/featurePagePaths.ts, and reaches here through that file, so
    // it cannot disagree with the sitemap, the llms files or the navigation. Copy:
    // src/data/featurePages.ts. `date` is the day they were written; set it to the day the flag
    // goes on (it is the Article's datePublished, and the page is not public until then).
    '/features/habit-reversal-coaching': {
      title: 'Habit Reversal-Style Coaching After the Alarm',
      description: 'An optional prompt for a competing response when the alarm sounds, and a four-week program of short lessons. Self-help, not a treatment.',
      date: '2026-10-23',
      gated: true,
    },
    '/features/phone-companion': {
      title: 'Log Nail Biting From Your Phone in Two Taps',
      description: 'Open Stop Biting on a phone to log a bite or an urge in two taps, see your streak and add it to your home screen. The alarm still needs a computer webcam.',
      date: '2026-10-23',
      gated: true,
    },
    '/features/share-with-therapist': {
      title: 'Share Your Progress With a Therapist or a Friend',
      description: 'Make a read-only link to a plain summary of your bites, triggers and streak. You pick the expiry, can revoke it, and it shows no photos and no account details.',
      date: '2026-10-23',
      gated: true,
    },
    '/features/referral-program': {
      title: 'Refer a Friend: You Both Get Bonus Access',
      description: 'Share your personal link. When someone you refer pays for the first time, you both get bonus access. How it works, when the days start and what is checked.',
      date: '2026-10-23',
      gated: true,
    },
    // Keep this flag off until desktop sign-in works against the hosted API and the macOS build is signed
    // (docs/agents/ws11b-notes.md, top of the file).
    '/features/desktop-app': {
      title: 'Stop Biting for Mac: A Desktop App That Keeps Watching',
      description: 'The Stop Biting web app in its own window for Mac, with a menu bar icon, pause controls and optional launch at login. Same detection, same account.',
      date: '2026-10-23',
      gated: true,
    },
    '/solutions/cuticle-biting': {
      title: 'Cuticle Biting: Same Mouth Alarm, Logged Under Its Own Name',
      description: 'Stop Biting uses one mouth alarm for nail biting and cuticle biting; you choose which name alerts are logged under. Early, tested on made-up scenes only.',
      date: '2026-10-23',
      gated: true,
    },
  };

  // The roundup hub also carries ItemList schema (comparison-schema.json) so AI
  // crawlers read it as the set of named apps it compares.
  //
  // UNORDERED deliberately. This used to claim ItemListOrderDescending — a
  // ranking — while the page it describes explicitly refuses to rank: its
  // standfirst says "including where ours loses" and every H2 segments by use
  // case ("best for nail biting at a computer", "best for multiple BFRBs on
  // desktop") rather than by position. The order of the entries is the page's
  // reading order, not a verdict, and the schema must not say otherwise.
  const AI_APPS_ITEMLIST = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'AI Apps That Detect Nail Biting (2026)',
    itemListOrder: 'https://schema.org/ItemListUnordered',
    numberOfItems: 4,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Stop Biting', url: 'https://stopbiting.today/' },
      { '@type': 'ListItem', position: 2, name: 'Hands Off', url: 'https://handsoffapp.com/' },
      { '@type': 'ListItem', position: 3, name: 'Nailed', url: 'https://nailedapp.io/' },
      { '@type': 'ListItem', position: 4, name: 'SmartBehavior', url: 'https://smart-behavior.com/en/' },
    ],
  };

  for (const [pagePath, meta] of Object.entries(COMPARE_META)) {
    app.get(pagePath, (_req, res) => {
      if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
      // A flagged page does not exist until its flag is on (and its copy was built): the same
      // branded, noindex 404 as any unknown URL, never the SPA shell.
      if (!isGateOpen(flags, meta) || ((meta.flag || meta.gated) && !GATED_CONTENT[pagePath])) {
        return sendHtml(res, NOT_FOUND_HTML, 404);
      }
      const canonical = `https://stopbiting.today${pagePath}`;
      const ogImage = routeImageUrl(pagePath);
      let injected = injectMeta(indexHtml, {
        title: meta.title,
        description: meta.description,
        canonical,
        ogType: 'article',
        ogImage,
      });
      const content = COMPARE_CONTENT[pagePath] ?? GATED_CONTENT[pagePath];
      const article = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        // Identity, for the same reason every BlogPosting now carries one:
        // these 9 nodes were part of the 152 anonymous content entities. The
        // fragment separates the article from its canonical WebPage below.
        '@id': `${canonical}#article`,
        headline: content?.title ?? meta.title,
        description: meta.description,
        url: canonical,
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        // `dateModified` used to be hardcoded equal to `datePublished`, which
        // froze five of these pages at 2026-04-28 no matter how often the copy
        // changed. It now comes from the freshness ledger — the same date
        // sitemap.xml and the Last-Modified header carry — which only advances
        // when the page's content actually changes.
        datePublished: meta.date ?? '2026-04-28',
        dateModified: pageLastmod(pagePath) ?? meta.date ?? '2026-04-28',
        author: SCHEMA_AUTHOR,
        publisher: SCHEMA_PUBLISHER,
        inLanguage: 'en',
        isAccessibleForFree: true,
        // Same card the og:image/twitter:image tags above carry — one URL per
        // page, or the shared fallback on both sides when there is no card.
        image: schemaImage(ogImage),
        // Only claimed when the SSR article is actually injected below — the
        // selectors (#ssr-page-content h1 / .article-summary) resolve against
        // compareArticleHtml()'s <h1> and its `article-summary` intro.
        ...(content ? { speakable: SCHEMA_SPEAKABLE } : {}),
      };
      const breadcrumb = breadcrumbSchema([
        ['Home', 'https://stopbiting.today/'],
        [content?.title ?? meta.title, canonical],
      ]);
      // FAQPage, but only for a page that actually renders question-headed
      // Q&A. The questions and the answer text are read back out of the same
      // `html` that compareArticleHtml() emits verbatim a few lines below, so
      // every `acceptedAnswer.text` is byte-identical to the paragraph a reader
      // sees — nothing here knows what any of the questions say.
      const faq = content ? visibleFaqSection(content) : null;
      const extraSchemas =
        (pagePath === '/compare/ai-detection-apps' ? `\n    ${schemaTag(AI_APPS_ITEMLIST)}` : '') +
        (faq ? `\n    ${schemaTag(faqPageSchema(canonical, faq.heading, faq.pairs))}` : '');
      injected = injected.replace('</head>', `    ${schemaTag(article)}\n    ${schemaTag(breadcrumb)}${extraSchemas}\n  </head>`);
      // A page whose flag is on renders in the browser from this same copy, so the visible page and the
      // crawler article are one text. (The JSON also answers at /page-data<path>.json for visitors whose
      // browser holds an older copy of the app shell.)
      if (GATED_CONTENT[pagePath]) {
        injected = injected.replace('</head>', () => `    <script type="application/json" id="sb-page-data">${jsonForScript({ path: pagePath, page: content })}</script>\n  </head>`);
      }
      if (content) injected = injectSsrArticle(injected, compareArticleHtml(content));
      sendHtml(res, injectNoscriptNav(injected), 200, pageLastmod(pagePath));
    });
  }

  // Free cost calculator. The arithmetic runs in the browser on the visitor's
  // own numbers (src/utils/costCalc.ts); this handler only supplies the head and
  // the crawler-visible description of what the tool does.
  app.get('/tools/nail-biting-cost-calculator', (_req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    const path = '/tools/nail-biting-cost-calculator';
    const description = 'Free calculator: add up what nail biting costs you each year in manicures and repairs, using your own numbers, and compare it with the $29 yearly plan.';
    let injected = injectMeta(indexHtml, {
      title: 'Nail Biting Cost Calculator: What It Costs You a Year',
      description,
      canonical: `https://stopbiting.today${path}`,
      ogImage: 'https://stopbiting.today/og/tools-nail-biting-cost-calculator.png',
    });
    const toolSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `https://stopbiting.today${path}`,
      url: `https://stopbiting.today${path}`,
      name: 'Nail Biting Cost Calculator',
      description,
      inLanguage: 'en',
      isPartOf: { '@id': WEBSITE_ID },
      speakable: SCHEMA_SPEAKABLE,
      // The tool itself, as the page describes it: a free calculator that runs
      // in the browser on the visitor's own numbers.
      mainEntity: {
        '@type': 'WebApplication',
        name: 'Nail Biting Cost Calculator',
        url: `https://stopbiting.today${path}`,
        operatingSystem: 'Any (web browser)',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      ...(pageLastmod(path) ? { dateModified: pageLastmod(path) } : {}),
    };
    const breadcrumb = breadcrumbSchema([
      ['Home', 'https://stopbiting.today/'],
      ['Nail biting cost calculator', `https://stopbiting.today${path}`],
    ]);
    injected = injected.replace('</head>', `    ${schemaTag(toolSchema)}\n    ${schemaTag(breadcrumb)}\n  </head>`);
    injected = injectSsrArticle(injected,
      '<h1>What does nail biting cost you each year?</h1>' +
      '<p class="article-summary">A free calculator: enter how many manicures or nail repairs you pay for each year, what each one costs, ' +
      'and anything else you spend on it, and it shows your yearly and five-year cost next to Stop Biting’s $29 yearly plan.</p>' +
      '<section><h2>What does the calculator use?</h2>' +
      '<p>Only the numbers you type and our two published prices: $2.99 a month, or $29 a year. It assumes no average cost of nail biting. ' +
      'It runs in your browser and sends nothing anywhere.</p></section>' +
      '<section><h2>What does it not count?</h2>' +
      '<p>Nail damage, infection risk and dental costs are not in the total, and Stop Biting is not a medical treatment. ' +
      'See <a href="/blog/nail-biting-cost">the real cost of nail biting</a> for the wider picture, or <a href="/pricing">pricing</a>.</p></section>');
    sendHtml(res, injectNoscriptNav(injected), 200, pageLastmod(path));
  });

  // Free nail growth timeline calculator. The arithmetic runs in the browser
  // (src/utils/nailGrowth.ts) on the visitor's own number; the only figures are
  // the two average rates from Yaemsiri et al. 2010 (PubMed 19744178), stated
  // on the page with their source and sample.
  app.get('/tools/nail-growth-timeline-calculator', (_req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    const path = '/tools/nail-growth-timeline-calculator';
    const description = 'Free calculator: how long to grow nails back, from the average rates in a 22-person study: 3.47 mm a month for fingernails, 1.62 for toenails.';
    let injected = injectMeta(indexHtml, {
      title: 'Nail Growth Timeline Calculator: How Long to Regrow Nails',
      description,
      canonical: `https://stopbiting.today${path}`,
      ogImage: 'https://stopbiting.today/og/tools-nail-growth-timeline-calculator.png',
    });
    const toolSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `https://stopbiting.today${path}`,
      url: `https://stopbiting.today${path}`,
      name: 'Nail Growth Timeline Calculator',
      description,
      inLanguage: 'en',
      isPartOf: { '@id': WEBSITE_ID },
      speakable: SCHEMA_SPEAKABLE,
      mainEntity: {
        '@type': 'WebApplication',
        name: 'Nail Growth Timeline Calculator',
        url: `https://stopbiting.today${path}`,
        operatingSystem: 'Any (web browser)',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      ...(pageLastmod(path) ? { dateModified: pageLastmod(path) } : {}),
    };
    const breadcrumb = breadcrumbSchema([
      ['Home', 'https://stopbiting.today/'],
      ['Nail growth timeline calculator', `https://stopbiting.today${path}`],
    ]);
    injected = injected.replace('</head>', `    ${schemaTag(toolSchema)}\n    ${schemaTag(breadcrumb)}\n  </head>`);
    injected = injectSsrArticle(injected,
      '<h1>How long will it take to grow your nails back?</h1>' +
      '<p class="article-summary">A free calculator: enter how much nail you want to grow, in millimetres, and it divides the length by the average growth rate ' +
      'measured in one published study. It is an estimate, not a promise.</p>' +
      '<section><h2>Where does the rate come from?</h2>' +
      '<p>A study of 22 healthy young adults in the United States who marked their nails and measured the distance one to three months later: ' +
      '3.47 mm a month for fingernails and 1.62 mm a month for toenails (Yaemsiri et al., 2010). It is a small sample of young, healthy people, ' +
      'and the little fingernail grew slower than the others. The same study found faster growth with younger age, male gender and onychophagia, ' +
      'but none of those differences was statistically significant.</p></section>' +
      '<section><h2>What does it leave out?</h2>' +
      '<p>The calculator knows nothing about how damaged your nails are. It only divides a length by an average, and it runs in your browser and sends nothing anywhere. ' +
      'Read <a href="/blog/grow-nails-after-nail-biting">how to grow your nails after nail biting</a> for what to expect week by week, or ' +
      '<a href="/tools/nail-biting-cost-calculator">work out what biting costs you</a>. Stop Biting is not a medical treatment.</p></section>');
    sendHtml(res, injectNoscriptNav(injected), 200, pageLastmod(path));
  });

  // Free printable tracker: a landing page for the downloadable sheet in
  // public/files (built from docs/tracker). The page is a real article for
  // crawlers, and the PDF and its preview image are same-origin files.
  app.get('/tools/nail-biting-tracker-printable', (_req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    const path = '/tools/nail-biting-tracker-printable';
    const description = 'A free one-page printable 30-day nail biting tracker (PDF): tally each catch, note what was going on, and see your patterns. No sign-up.';
    let injected = injectMeta(indexHtml, {
      title: 'Free Printable Nail Biting Tracker (30-Day PDF)',
      description,
      canonical: `https://stopbiting.today${path}`,
      ogImage: 'https://stopbiting.today/og/tools-nail-biting-tracker-printable.png',
    });
    const toolSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `https://stopbiting.today${path}`,
      url: `https://stopbiting.today${path}`,
      name: 'Free printable nail biting tracker',
      description,
      inLanguage: 'en',
      isPartOf: { '@id': WEBSITE_ID },
      speakable: SCHEMA_SPEAKABLE,
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: 'https://stopbiting.today/files/nail-biting-30-day-tracker-preview.png',
        width: 816,
        height: 1056,
        caption: 'Preview of the 30-day nail biting tracker sheet.',
      },
      // The sheet itself, so the PDF is described as a free document and not
      // only linked. Every field here is visible on the page.
      mainEntity: {
        '@type': 'DigitalDocument',
        name: 'Nail biting 30-day tracker',
        description: 'A one-page, 30-day log for noticing when you bite and what is going on at the time.',
        url: 'https://stopbiting.today/files/nail-biting-30-day-tracker.pdf',
        encodingFormat: 'application/pdf',
        isAccessibleForFree: true,
        inLanguage: 'en',
        thumbnailUrl: 'https://stopbiting.today/files/nail-biting-30-day-tracker-preview.png',
      },
      ...(pageLastmod(path) ? { dateModified: pageLastmod(path) } : {}),
    };
    const breadcrumb = breadcrumbSchema([
      ['Home', 'https://stopbiting.today/'],
      ['Printable nail biting tracker', `https://stopbiting.today${path}`],
    ]);
    injected = injected.replace('</head>', `    ${schemaTag(toolSchema)}\n    ${schemaTag(breadcrumb)}\n  </head>`);
    injected = injectSsrArticle(injected,
      '<h1>Free printable nail biting tracker</h1>' +
      '<p class="article-summary">A one-page, 30-day log for noticing when you bite and what is going on at the time. ' +
      'Print it, keep it on your desk, and tally each catch. It is free, with no sign-up.</p>' +
      '<p><a href="/files/nail-biting-30-day-tracker.pdf">Download the PDF</a> (one US Letter page).</p>' +
      '<section><h2>How to use it</h2><ol>' +
      '<li>Each time you notice your hand at your mouth, make a mark in that day’s tally box.</li>' +
      '<li>Tick what was going on: stress, deep focus, boredom or something else.</li>' +
      '<li>Tick the competing-response box if you did something else with your hands instead.</li>' +
      '<li>After a week, look for the moments that keep coming up.</li></ol>' +
      '<p>Keeping a self-monitoring log is the usual first step in awareness training, the first component of habit reversal training. ' +
      'Our <a href="/blog/habit-reversal-training-guide">habit reversal guide</a> covers the full method.</p></section>' +
      '<section><h2>What a paper log can and cannot do</h2>' +
      '<p>A paper log only records what you notice, and much nail biting happens without noticing. If you work at a computer, ' +
      'Stop Biting watches through your webcam and sounds an alarm the moment your hand reaches your mouth, so the catches are logged for you. ' +
      'It detects nail biting only, and only in front of your webcam. A log is a way to notice a habit, not a treatment.</p></section>');
    sendHtml(res, injectNoscriptNav(injected), 200, pageLastmod(path));
  });

  // Known valid routes for soft-404 protection
  const KNOWN_ROUTES = new Set([
    '/', '/blog', '/about', '/how-it-works', '/pricing', '/privacy',
    '/terms-and-conditions', '/refund-policy', EDITORIAL_POLICY_PATH, '/tools/nail-biting-cost-calculator', '/tools/nail-growth-timeline-calculator', '/tools/nail-biting-tracker-printable',
    ...Object.keys(COMPARE_META),
    ...Object.keys(BLOG_POSTS).map(slug => `/blog/${slug}`),
  ]);

  // Branded 404 in the sign system, light-only like every marketing page.
  // Self-contained: the SPA's stylesheet is content-hashed, so a static error
  // page cannot link to it without going stale on every build. The fonts and
  // logo live at stable /fonts and /logo.svg paths. Tokens mirror .sg-page.
  const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="color-scheme" content="light">
  <title>Page not found | Stop Biting</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>
    @font-face {
      font-family: 'Bricolage Grotesque'; font-style: normal; font-weight: 200 800; font-display: swap;
      src: url(/fonts/bricolage-latin.woff2) format('woff2');
    }
    @font-face {
      font-family: Geist; font-style: normal; font-weight: 100 900; font-display: swap;
      src: url(/fonts/geist-latin.woff2) format('woff2');
    }
    :root {
      --ground: oklch(97.6% 0.008 105); --ink: oklch(19% 0.03 160);
      --ink-2: oklch(42% 0.025 160); --rule: oklch(90% 0.01 130);
      --accent: oklch(25% 0.05 162); --accent-press: oklch(46% 0.13 148);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; background: var(--ground); color: var(--ink);
      font-family: Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    header { border-bottom: 1px solid var(--rule); }
    .bar, main { max-width: 64rem; margin: 0 auto; padding: 0 20px; }
    .bar { display: flex; align-items: center; gap: 10px; min-height: 64px; }
    .brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink);
      text-decoration: none; font-family: 'Bricolage Grotesque', Geist, sans-serif; font-weight: 800; font-size: 1.125rem; letter-spacing: -0.02em; }
    main { padding-top: clamp(4rem, 12vh, 8rem); padding-bottom: 6rem; }
    h1 { font-family: 'Bricolage Grotesque', Geist, sans-serif; font-size: clamp(2.4rem, 1.4rem + 4vw, 4.5rem); font-weight: 800;
      line-height: 0.96; letter-spacing: -0.045em; margin: 0; max-width: 16ch; }
    p { font-size: 1.0625rem; line-height: 1.6; color: var(--ink-2); margin: 1.25rem 0 0; max-width: 44ch; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 2rem; }
    .btn { display: inline-flex; align-items: center; min-height: 48px; padding: 0 22px;
      border-radius: 999px; font-family: 'Bricolage Grotesque', Geist, sans-serif; font-weight: 700; font-size: 1rem; text-decoration: none; }
    .btn-solid { background: var(--accent); color: #fff; }
    .btn-solid:hover { background: var(--accent-press); }
    .btn-line { color: var(--ink); border: 2px solid var(--ink); }
    .btn-line:hover { background: #fff; }
    a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <a class="brand" href="/"><img src="/logo.svg" alt="" width="28" height="28">Stop Biting</a>
    </div>
  </header>
  <main>
    <h1>This page doesn't exist.</h1>
    <p>The link may be broken or the page may have moved. The app, the guides and everything else are where they were.</p>
    <div class="actions">
      <a class="btn btn-solid" href="/">Go to the homepage</a>
      <a class="btn btn-line" href="/blog">Read the guides</a>
    </div>
  </main>
</body>
</html>`;

  // ── The localized marketing pages (WS12b) ─────────────────────────────────
  // /es, /es/pricing, /de/..., /pt-br/...: registered only for a language that is served (flag on). A language that is off
  // registers nothing, so its addresses fall through to the branded 404 below, exactly as before this block existed.
  if (indexHtml && servedLocales(LOCALE_STATES).length) {
    const { notices } = registerLocalePages({
      app, files: LOCALE_FILES, states: LOCALE_STATES, shell: indexHtml, notFoundHtml: NOT_FOUND_HTML,
      sendHtml, injectMeta, schemaTag, copyIsOn,
      injectSsrArticle: (html, article) => injectSsrArticle(html, article, { pageLinks: false }),
      noscriptNav: (html, data) => localizedNoscriptNav(html, data, [...SITE_NAV, ...GATED_NAV], escapeHtml),
      k: {
        WEBSITE_ID, ORG_ID, APP_ID, PERSON_ID, SCHEMA_AUTHOR, SCHEMA_SPEAKABLE, PERSON_KNOWS_ABOUT, breadcrumbSchema, faqPageSchema,
      },
    });
    for (const note of notices) console.warn(`[locale] ${note}`);
  }

  // SPA fallback. Every entry in KNOWN_ROUTES already has its own handler above,
  // so in practice this only ever 404s — the sendFile is a safety net for a
  // client-side route added without a matching server route, which would
  // otherwise become a hard 404 instead of rendering.
  app.get('/{*path}', (req, res) => {
    if (!KNOWN_ROUTES.has(req.path)) {
      return sendHtml(res, NOT_FOUND_HTML, 404);
    }
    res.sendFile(indexPath, HTML_SENDFILE_OPTS);
  });
}

// Web only: the desktop app's embedded server has its own local DB and must not send mail.
if (!ELECTRON_PROTOCOL) startTrialFollowupJob(db, sendFeedbackEmail);

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
