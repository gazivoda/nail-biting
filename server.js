import express from 'express';
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
import { sendWelcomeEmail, sendAdminNotification } from './email.js';

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
app.use((req, res, next) => {
  if (req.path === '/api/paddle/webhook') return next();
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
    const isNewUser = !user;
    if (!user) {
      const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
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
  res.json(user);
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

  console.log(`Paddle webhook: ${eventType}`);

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
  // slug → { title, seoTitle?, description, tag, readingMinutes, datePublished, dateModified, sections }
  const BLOG_POSTS = SEO_CONTENT.posts ?? {};
  // When the content file is absent/corrupt we must not 404 every real post —
  // unknown-slug detection is only trustworthy when the content actually loaded.
  const SEO_CONTENT_LOADED = Object.keys(BLOG_POSTS).length > 0;
  // path → { title, subtitle, intro, sections, relatedPosts }
  const COMPARE_CONTENT = SEO_CONTENT.comparePages ?? {};

  // Helper: escape HTML entities for safe server-side content injection.
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
    'font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
    'line-height:1.65;color:#292524}' +
    '#ssr-page-content h1{font-size:1.9rem;line-height:1.25}' +
    '#ssr-page-content h2{font-size:1.25rem;margin-top:2rem}' +
    '#ssr-page-content table{border-collapse:collapse;width:100%;font-size:.85rem}' +
    '#ssr-page-content th,#ssr-page-content td{border:1px solid #d6d3d1;padding:6px 8px;text-align:left;vertical-align:top}' +
    '@media (prefers-color-scheme:dark){#ssr-page-content{color:#d6d3d1}}' +
    'html.js #ssr-page-content{display:none}' +
    '</style>' +
    '<script>document.documentElement.classList.add("js")</script>';

  function injectSsrArticle(html, articleInnerHtml) {
    return html
      .replace('</head>', `  ${SSR_ARTICLE_HEAD}\n  </head>`)
      .replace('<div id="root">', `<div id="root"><article id="ssr-page-content">${articleInnerHtml}</article>`);
  }

  // Sections come straight from blogPosts.ts via seo-content.json. `body` and
  // `list` are plain text (the client renders them as text nodes), so they are
  // escaped; `html` is authored markup (e.g. comparison tables) that the client
  // injects with dangerouslySetInnerHTML, so it is emitted verbatim.
  function renderSectionsHtml(sections) {
    return sections.map(s => {
      const paras = s.body.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('');
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
    return `<h1>${escapeHtml(post.title)}</h1>` +
      `<p>${escapeHtml(post.tag)} · ${post.readingMinutes} min read · ${dates}</p>` +
      `<p>${escapeHtml(post.description)}</p>` +
      renderSectionsHtml(post.sections);
  }

  function compareArticleHtml(content) {
    const body = content.sections.map(s =>
      `<section><h2>${escapeHtml(s.heading)}</h2>${s.body.split('\n\n').map(t => `<p>${escapeHtml(t)}</p>`).join('')}</section>`,
    ).join('');
    const related = content.relatedPosts?.length
      ? `<section><h2>Related reading</h2><ul>${content.relatedPosts.map(r =>
          `<li><a href="${escapeHtml(r.href)}">${escapeHtml(r.label)}</a></li>`).join('')}</ul></section>`
      : '';
    return `<h1>${escapeHtml(content.title)}</h1>` +
      `<p>${escapeHtml(content.subtitle)}</p><p>${escapeHtml(content.intro)}</p>${body}${related}`;
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
    ['/', 'Stop Biting — AI nail biting detection'],
    ['/blog', 'Nail biting guides and research'],
    ['/how-it-works', 'How AI nail biting detection works'],
    ['/pricing', 'Pricing — free trial, $2.99/month or $29/year'],
    ['/about', 'About Stop Biting'],
    ['/compare/bitter-polish-alternative', 'Stop Biting vs bitter nail polish'],
    ['/compare/habit-tracking-apps', 'Why habit tracking apps do not work for nail biting'],
    ['/solutions/for-desk-workers', 'Stop nail biting at your desk'],
    ['/solutions/for-adhd', 'Nail biting and ADHD'],
    ['/solutions/for-gamers', 'Stop nail biting while gaming'],
    ['/privacy', 'Privacy policy'],
    ['/terms-and-conditions', 'Terms of service'],
    ['/refund-policy', 'Refund policy'],
  ];

  function injectNoscriptNav(html, extraLinks = []) {
    const link = ([href, label]) =>
      `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`;
    const extra = extraLinks.length
      ? `<h2>Articles</h2><ul>${extraLinks.map(link).join('')}</ul>`
      : '';
    const nav =
      `<noscript><nav aria-label="Site"><h2>Stop Biting</h2><ul>` +
      `${SITE_NAV.map(link).join('')}</ul>${extra}</nav></noscript>`;
    return html.replace('</body>', `    ${nav}\n  </body>`);
  }

  // Helper: inject page-specific <title>, <meta description>, <link canonical>,
  // Open Graph, and Twitter Card tags into the SPA index.html shell before sending it.
  // This makes critical SEO elements visible to Googlebot and AI crawlers.
  function injectMeta(html, { title, description, canonical, ogType = 'website' }) {
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
    return html
      .replace(/<title>[^<]*<\/title>/, () => `<title>${t}</title>`)
      .replace(/<meta name="description" content="[^"]*"/, () => `<meta name="description" content="${d}"`)
      .replace(/<link rel="canonical" href="[^"]*"/, () => `<link rel="canonical" href="${c}"`)
      .replace(/<meta property="og:type" content="[^"]*"/, () => `<meta property="og:type" content="${o}"`)
      .replace(/<meta property="og:title" content="[^"]*"/, () => `<meta property="og:title" content="${t}"`)
      .replace(/<meta property="og:description" content="[^"]*"/, () => `<meta property="og:description" content="${d}"`)
      .replace(/<meta property="og:url" content="[^"]*"/, () => `<meta property="og:url" content="${c}"`)
      .replace(/<meta name="twitter:title" content="[^"]*"/, () => `<meta name="twitter:title" content="${t}"`)
      .replace(/<meta name="twitter:description" content="[^"]*"/, () => `<meta name="twitter:description" content="${d}"`);
  }

  // ── JSON-LD helpers ────────────────────────────────────────────────────────
  // AI crawlers and Googlebot's first pass do not execute JavaScript, so
  // schemas are injected server-side. The server copy is CANONICAL — the
  // client injects no BlogPosting/BreadcrumbList of its own (it used to, which
  // left two BlogPosting entities under one @id with different headlines).
  const SCHEMA_AUTHOR = {
    '@type': 'Person',
    name: 'Igor Gazivoda',
    url: 'https://stopbiting.today/about',
    jobTitle: 'Founder',
    // Same GitHub property the Organization schema in index.html links to.
    sameAs: ['https://github.com/gazivoda/nail-biting'],
    knowsAbout: ['onychophagia', 'nail biting', 'body-focused repetitive behaviors', 'habit reversal training', 'MediaPipe', 'on-device AI'],
  };
  const SCHEMA_PUBLISHER = {
    '@type': 'Organization',
    name: 'Stop Biting',
    url: 'https://stopbiting.today',
    logo: { '@type': 'ImageObject', url: 'https://stopbiting.today/icons/icon-512x512.png' },
  };
  const SCHEMA_IMAGE = {
    '@type': 'ImageObject',
    url: 'https://stopbiting.today/og-image.png',
    width: 1200,
    height: 630,
  };

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

  function injectBlogSchemas(html, { slug, title, description, canonical, post }) {
    const blogPosting = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
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
      keywords: post.tag,
      image: SCHEMA_IMAGE,
    };

    const breadcrumb = breadcrumbSchema([
      ['Home', 'https://stopbiting.today/'],
      ['Blog', 'https://stopbiting.today/blog'],
      [title, canonical],
    ]);

    const schemaBlocks = [schemaTag(blogPosting), schemaTag(breadcrumb)];

    if (slug === 'habit-reversal-training-guide') {
      const howTo = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'How to Stop Nail Biting Using Habit Reversal Training',
        description: 'A three-step evidence-based protocol (HRT) shown in controlled trials to substantially reduce nail biting with consistent practice over 4–8 weeks.',
        totalTime: 'P8W',
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Start awareness training',
            text: 'Keep a habit diary for one week, recording every nail biting episode — time, context, emotional state, and trigger. Practise noticing the precursor movements (hand rising, fingers touching lips) before the bite. This phase alone produces measurable reductions and is the most impactful component of HRT.',
          },
          {
            '@type': 'HowToStep',
            position: 2,
            name: 'Choose and practise a competing response',
            text: 'Select a behaviour physically incompatible with nail biting that you can maintain for at least one minute in any context — pressing fingertips to a flat surface, clenching a fist, or gripping an object. At the moment you notice the urge or the habit beginning, immediately perform the competing response and hold it for 1–3 minutes until the urge passes.',
          },
          {
            '@type': 'HowToStep',
            position: 3,
            name: 'Add external awareness support',
            text: 'Use a real-time alert system — a support person, a phone habit tracker, or an AI-powered detection app — to flag instances you miss during the awareness gap. This closes the loop for automatic biting episodes that occur below conscious threshold, which account for the majority of daily biting in most people.',
          },
          {
            '@type': 'HowToStep',
            position: 4,
            name: 'Maintain practice for 4–8 weeks',
            text: 'Biting frequency typically decreases significantly between weeks 2 and 6, and the competing response becomes more automatic the longer it is practised. Continue daily monitoring during high-stress periods to prevent relapse.',
          },
        ],
      };
      schemaBlocks.push(schemaTag(howTo));
    }

    const schemas = schemaBlocks.join('\n    ');

    // Inject before closing </head>
    return html.replace('</head>', `    ${schemas}\n  </head>`);
  }

  // Read index.html once at startup (it's static after build)
  let indexHtml = null;
  let indexHtmlWithFaq = null;  // homepage-only copy that retains the FAQPage schema
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    const raw = readFileSync(indexPath, 'utf-8');
    indexHtmlWithFaq = raw;
    // Strip the FAQPage schema block from the shared shell so it is only emitted
    // for the homepage (see app.get('/') below). All other routes use indexHtml
    // and must not carry FAQPage structured data.
    indexHtml = raw.replace(
      /\n\n[ \t]*<!-- Structured Data: FAQPage -->[\s\S]*?<\/script>/,
      '',
    );
  }

  // HTML responses must not be cached: every route's HTML is assembled per
  // build (meta, schemas, article content), and a cached shell would keep
  // serving stale titles and content after a deploy. Hashed /assets keep their
  // 1-year immutable cache — the filenames change instead.
  const HTML_SENDFILE_OPTS = { headers: { 'Cache-Control': 'no-cache' } };
  function sendHtml(res, html, status = 200) {
    res.status(status).set('Cache-Control', 'no-cache').type('html').send(html);
  }

  // The 6 homepage FAQ answers, read from the FAQPage JSON-LD in index.html —
  // which Landing.tsx already mirrors (Google requires the visible counterpart)
  // — so the crawler prose, the schema, and the rendered page share one source.
  let HOME_FAQS = [];
  if (indexHtmlWithFaq) {
    const m = indexHtmlWithFaq.match(/<!-- Structured Data: FAQPage -->\s*<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (m) {
      try {
        HOME_FAQS = JSON.parse(m[1]).mainEntity.map(q => ({ q: q.name, a: q.acceptedAnswer.text }));
      } catch (err) {
        console.error('WARNING: could not parse FAQPage schema from index.html', err);
      }
    }
  }

  // Crawler-visible homepage summary. Keep the copy in step with Landing.tsx
  // (hero, how-it-works, pricing) — the FAQ block is parsed from the FAQPage
  // schema above and cannot drift.
  function homeArticleHtml() {
    const faqs = HOME_FAQS.map(f =>
      `<section><h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p></section>`).join('');
    return (
      '<h1>Stop Nail Biting with AI</h1>' +
      '<p>Stop Biting uses your webcam and on-device AI to detect nail biting in real time. ' +
      'The moment your hand moves toward your mouth, an audible alarm fires — catching the automatic episodes ' +
      'you never notice. All detection runs locally via MediaPipe and WebAssembly: no camera data ever leaves your device.</p>' +
      '<section><h2>How it works</h2>' +
      '<p>Open the app in your browser (or the macOS/Windows desktop app), grant camera access, and work normally. ' +
      'The AI tracks 21 hand landmarks and your face mesh at 30fps, entirely on-device. When it detects your hand ' +
      'approaching your mouth, the alarm fires within a second — the external awareness signal that Habit Reversal ' +
      'Training identifies as its most critical component. Each detection is logged locally so you can see your real ' +
      'biting frequency and triggers. Read more at <a href="/how-it-works">how it works</a>.</p></section>' +
      '<section><h2>Pricing</h2>' +
      '<p>Simple, honest pricing. Start with a 3-day free trial — no credit card required. ' +
      'Monthly: $2.99/month. Yearly: $29.00/year — just $2.42/month, saving 19%. ' +
      'Both plans include unlimited AI detection, streak and habit tracking, full incident history, and all alert types. ' +
      'Secure payment via Paddle, cancel anytime. See <a href="/pricing">pricing details</a>.</p></section>' +
      `<section><h2>Frequently asked questions</h2>${faqs}</section>` +
      '<section><h2>Learn more</h2><ul>' +
      '<li><a href="/blog">Evidence-based nail biting guides</a></li>' +
      '<li><a href="/how-it-works">How the AI detection works</a></li>' +
      '<li><a href="/about">About Stop Biting</a></li>' +
      '</ul></section>'
    );
  }

  // Homepage — serve with FAQPage schema (only this route should have it)
  app.get('/', (_req, res) => {
    if (!indexHtmlWithFaq) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    let injected = injectMeta(indexHtmlWithFaq, {
      title: 'Stop Nail Biting with AI | Stop Biting',
      description: 'Break the nail biting habit with on-device AI detection. Uses your webcam to catch onychophagia in real-time — 100% private, no data leaves your device. Science-backed habit reversal techniques included.',
      canonical: 'https://stopbiting.today/',
    });
    injected = injectSsrArticle(injected, homeArticleHtml());
    sendHtml(res, injectNoscriptNav(injected));
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
      // Unknown slug — return 404 so Googlebot doesn't treat it as a soft-404 duplicate
      return sendHtml(res, indexHtml, 404);
    }
    const canonical = `https://stopbiting.today/blog/${slug}`;
    // Same title the client sets on mount: buildPageTitle(seoTitle ?? title).
    const metaTitle = post.seoTitle ?? post.title;
    let injected = injectMeta(indexHtml, {
      title: buildPageTitle(metaTitle),
      description: post.description,
      canonical,
      ogType: 'article',
    });
    injected = injectBlogSchemas(injected, {
      slug,
      title: metaTitle,
      description: post.description,
      canonical,
      post,
    });
    injected = injectSsrArticle(injected, blogArticleHtml(post));
    sendHtml(res, injectNoscriptNav(injected));
  });

  // Blog index page
  app.get('/blog', (req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    let injected = injectMeta(indexHtml, {
      title: 'Nail Biting Resources — Evidence-Based Guides | Stop Biting',
      description: 'Research-backed articles on habit psychology, treatment options, and the science of breaking body-focused repetitive behaviours.',
      canonical: 'https://stopbiting.today/blog',
    });

    // Inject CollectionPage schema so AI crawlers can discover all blog posts
    const collectionSchema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Nail Biting Resources — Evidence-Based Guides',
      description: 'Research-backed articles on onychophagia, habit reversal training, and body-focused repetitive behaviors.',
      url: 'https://stopbiting.today/blog',
      publisher: {
        '@type': 'Organization',
        name: 'Stop Biting',
        url: 'https://stopbiting.today',
      },
      hasPart: Object.entries(BLOG_POSTS).map(([slug, p]) => ({
        '@type': 'BlogPosting',
        headline: p.seoTitle ?? p.title,
        description: p.description,
        url: `https://stopbiting.today/blog/${slug}`,
      })),
    };

    injected = injected.replace('</head>', `    ${schemaTag(collectionSchema)}\n  </head>`);
    // The index is the hub: listing every article as a real in-flow link is
    // what makes each one reachable — with anchor text — by crawlers that
    // never run the JS, in one hop from /.
    const postList = Object.entries(BLOG_POSTS).map(([slug, p]) =>
      `<li><a href="/blog/${slug}">${escapeHtml(p.title)}</a><br>${escapeHtml(p.description)}</li>`).join('');
    const articleHtml =
      '<h1>Nail Biting Resources</h1>' +
      '<p>Research-backed articles on habit psychology, treatment options, and the science of breaking body-focused repetitive behaviours.</p>' +
      `<section><h2>All articles</h2><ul>${postList}</ul></section>`;
    injected = injectSsrArticle(injected, articleHtml);
    sendHtml(res, injectNoscriptNav(injected));
  });

  // Privacy policy page
  app.get('/privacy', (req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    const injected = injectMeta(indexHtml, {
      title: 'Privacy Policy | Stop Biting',
      description: 'Stop Biting processes your webcam feed entirely on-device. No camera data is ever transmitted to any server. Read our full privacy policy.',
      canonical: 'https://stopbiting.today/privacy',
    });
    sendHtml(res, injectNoscriptNav(injected));
  });

  // Terms of Service page
  app.get('/terms-and-conditions', (req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    const injected = injectMeta(indexHtml, {
      title: 'Terms of Service | Stop Biting',
      description: 'Terms of Service for Stop Biting — the on-device AI nail biting detection app. Read our usage terms, subscription terms, and user rights.',
      canonical: 'https://stopbiting.today/terms-and-conditions',
    });
    sendHtml(res, injectNoscriptNav(injected));
  });

  // Refund Policy page
  app.get('/refund-policy', (req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    const injected = injectMeta(indexHtml, {
      title: 'Refund Policy | Stop Biting',
      description: 'Refund and cancellation policy for Stop Biting subscriptions. Cancel anytime — no questions asked.',
      canonical: 'https://stopbiting.today/refund-policy',
    });
    sendHtml(res, injectNoscriptNav(injected));
  });

  // Remaining static assets (icons, WASM, models, etc.)
  app.use(express.static(distPath));

  // Core app pages — each needs its own canonical and meta so they can be indexed separately
  app.get('/about', (_req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    let injected = injectMeta(indexHtml, {
      title: 'About Stop Biting | Built by Igor Gazivoda',
      description: 'Stop Biting was built by Igor Gazivoda — a developer who bit his nails for 20 years. On-device AI detection, 100% private, no data ever leaves your device.',
      canonical: 'https://stopbiting.today/about',
    });
    const personSchema = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Igor Gazivoda',
      url: 'https://stopbiting.today/about',
      jobTitle: 'Founder',
      worksFor: { '@type': 'Organization', name: 'Stop Biting', url: 'https://stopbiting.today' },
      knowsAbout: ['nail biting', 'onychophagia', 'habit reversal training', 'MediaPipe', 'WebAssembly', 'on-device AI'],
      description: 'Igor Gazivoda is the founder of Stop Biting, an on-device AI app for nail biting detection built with MediaPipe and WebAssembly.',
    };
    injected = injected.replace('</head>', `    ${schemaTag(personSchema)}\n  </head>`);
    // Crawler-visible summary — keep the copy in step with About.tsx.
    injected = injectSsrArticle(injected,
      '<h1>About Stop Biting</h1>' +
      '<p>Built by a nail biter, for nail biters.</p>' +
      '<section><h2>The founder&#39;s story</h2>' +
      '<p>I&#39;m Igor Gazivoda, a software developer. I bit my nails for over 20 years — constantly, automatically, ' +
      'without noticing until the damage was already done. I tried everything: bitter polish, reminder bands, sheer willpower. ' +
      'They all failed the same way, because the habit is automatic and happens below the threshold of conscious awareness.</p>' +
      '<p>When I read the research on Habit Reversal Training, I understood why everything else had failed. HRT&#39;s core ' +
      'insight is that awareness is the bottleneck — you can&#39;t interrupt a habit you don&#39;t know is happening. ' +
      'I had a webcam, I knew how to code, and I knew MediaPipe could run hand tracking on-device. So I built the awareness ' +
      'component — the part of HRT that is hardest to do alone.</p></section>' +
      '<section><h2>What Stop Biting does</h2>' +
      '<p>Stop Biting uses your computer&#39;s webcam and Google&#39;s MediaPipe framework — compiled to WebAssembly and ' +
      'running entirely in your browser — to detect when your hand moves toward your mouth. When it does, an audible alarm fires. ' +
      'That alarm is the external awareness signal HRT research identifies as the most critical component of treatment. ' +
      'The app also logs each detection with a timestamp, so you can see your actual biting frequency — not your estimated frequency.</p></section>' +
      '<section><h2>Privacy: the non-negotiable</h2>' +
      '<p>All video processing runs in WebAssembly on your device. Nothing is transmitted — not frames, not detections, ' +
      'not metadata. You can disconnect your internet connection after the app loads and it will function identically. ' +
      'The incident log is stored locally, and there are no analytics on how you use the app.</p></section>' +
      '<section><h2>The technology</h2>' +
      '<p>Detection is built on Google MediaPipe&#39;s Hand Landmarker, which tracks 21 hand landmarks in real time at 30fps. ' +
      'Mouth proximity detection compares hand landmark coordinates to facial landmark coordinates in each frame. ' +
      'The desktop apps (macOS and Windows) are Electron wrappers around the same web app with system-tray background running. ' +
      'Read the full explanation at <a href="/how-it-works">how it works</a>.</p></section>');
    sendHtml(res, injectNoscriptNav(injected));
  });

  // /faq has no client-side route and its content lives on the homepage —
  // redirect permanently and let the anchor do the scrolling.
  app.get('/faq', (_req, res) => res.redirect(301, '/#faq'));

  // Pricing — dedicated page. The client renders PricingPage.tsx here, which
  // reuses the same PricingSection component as the landing page, so crawler
  // view and user view carry the same figures. Prices in the prose and the
  // Offer schema below MUST match PricingSection.tsx exactly:
  // $2.99/month, $29.00/year, 3-day free trial.
  app.get('/pricing', (_req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    let injected = injectMeta(indexHtml, {
      title: 'Pricing — $2.99/month or $29/year | Stop Biting',
      description: 'Stop Biting pricing: 3-day free trial, no credit card required. Then $2.99/month or $29/year (about $2.42/month, save 19%). Unlimited AI detection, streak tracking, full incident history. Cancel anytime.',
      canonical: 'https://stopbiting.today/pricing',
    });
    const pricingSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Stop Biting Pricing',
      url: 'https://stopbiting.today/pricing',
      description: 'Pricing for Stop Biting — 3-day free trial, then $2.99/month or $29/year.',
      mainEntity: {
        '@type': 'SoftwareApplication',
        name: 'Stop Biting',
        url: 'https://stopbiting.today/',
        applicationCategory: 'HealthApplication',
        operatingSystem: 'Web, macOS 12+, Windows 10+',
        offers: [
          {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            name: 'Free trial',
            description: '3-day free trial with full detection and tracking features — no credit card required',
          },
          {
            '@type': 'Offer',
            price: '2.99',
            priceCurrency: 'USD',
            name: 'Monthly',
            description: 'Unlimited AI detection, streak and habit tracking, full incident history, all alert types. Billed monthly.',
          },
          {
            '@type': 'Offer',
            price: '29.00',
            priceCurrency: 'USD',
            name: 'Yearly',
            description: 'Everything in Monthly plus priority support — about $2.42/month, saving 19%. Billed once a year.',
          },
        ],
      },
    };
    const breadcrumb = breadcrumbSchema([
      ['Home', 'https://stopbiting.today/'],
      ['Pricing', 'https://stopbiting.today/pricing'],
    ]);
    injected = injected.replace('</head>', `    ${schemaTag(pricingSchema)}\n    ${schemaTag(breadcrumb)}\n  </head>`);
    injected = injectSsrArticle(injected,
      '<h1>Stop Biting Pricing</h1>' +
      '<p>Simple, honest pricing. Start with a 3-day free trial — no credit card required.</p>' +
      '<section><h2>Monthly — $2.99/month</h2>' +
      '<p>Billed monthly. Includes unlimited AI detection, streak and habit tracking, full incident history, and all alert types.</p></section>' +
      '<section><h2>Yearly — $29.00/year</h2>' +
      '<p>Billed once a year — just $2.42/month, saving 19% versus monthly billing. Includes everything in Monthly plus priority support.</p></section>' +
      '<section><h2>What every plan includes</h2><ul>' +
      '<li>Unlimited real-time AI nail biting detection via your webcam</li>' +
      '<li>Streak and habit tracking with all-time best record</li>' +
      '<li>Full incident history with trigger tagging</li>' +
      '<li>All alert types (sound and visual)</li>' +
      '<li>100% on-device processing — no camera data ever leaves your device</li>' +
      '</ul></section>' +
      '<section><h2>Payments and cancellation</h2>' +
      '<p>Secure payment via Paddle. Cancel anytime — see the <a href="/refund-policy">refund policy</a>. ' +
      'The 3-day free trial includes full detection and tracking features with no credit card required.</p></section>' +
      '<section><h2>Start free</h2>' +
      '<p><a href="/">Launch the app</a> to start your free trial, or read <a href="/how-it-works">how the AI detection works</a>.</p></section>');
    sendHtml(res, injectNoscriptNav(injected));
  });

  // How it works page
  app.get('/how-it-works', (_req, res) => {
    if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
    let injected = injectMeta(indexHtml, {
      title: 'How AI Nail Biting Detection Works | Stop Biting',
      description: 'Stop Biting uses MediaPipe and WebAssembly to detect nail biting in real time — entirely on your device. No cloud, no server, 100% private.',
      canonical: 'https://stopbiting.today/how-it-works',
    });
    const howToSchema = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to Use Stop Biting for Nail Biting Detection',
      description: 'Set up real-time AI nail biting detection in under 2 minutes using your webcam.',
      totalTime: 'PT2M',
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Open the app', text: 'Visit stopbiting.today in Chrome, Edge, or Firefox — or download the macOS/Windows desktop app.' },
        { '@type': 'HowToStep', position: 2, name: 'Grant camera access', text: 'Allow the app to use your webcam. The video is processed locally — nothing is ever transmitted.' },
        { '@type': 'HowToStep', position: 3, name: 'Position your webcam', text: 'Make sure your face and hands are visible in the camera view. The AI tracks hand-to-mouth movements.' },
        { '@type': 'HowToStep', position: 4, name: 'Work normally', text: 'The app runs in the background. When it detects nail biting, an audible alarm fires immediately.' },
        { '@type': 'HowToStep', position: 5, name: 'Perform your competing response', text: 'When the alarm fires, press both palms flat on your desk for 60 seconds — the physical incompatibility breaks the habit chain.' },
      ],
    };
    injected = injected.replace('</head>', `    ${schemaTag(howToSchema)}\n  </head>`);
    // Crawler-visible summary — keep the copy in step with HowItWorks.tsx
    // (the steps mirror the HowTo schema above).
    const stepsHtml = howToSchema.step.map(s =>
      `<li><strong>${escapeHtml(s.name)}.</strong> ${escapeHtml(s.text)}</li>`).join('');
    injected = injectSsrArticle(injected,
      '<h1>How AI Nail Biting Detection Works</h1>' +
      '<p>Stop Biting uses MediaPipe and WebAssembly to detect nail biting in real time — entirely on your device. Setup takes under two minutes.</p>' +
      '<section><h2>Why awareness is the bottleneck</h2>' +
      '<p>Most nail biters catch fewer than half of their daily biting episodes through self-monitoring alone. ' +
      'The habit is automatic — it runs below the threshold of conscious awareness. ' +
      '<a href="/blog/habit-reversal-training-guide">Habit Reversal Training</a> (the gold-standard treatment) identifies ' +
      'awareness training as its most critical component. Stop Biting automates that component: it catches the episodes you don&#39;t notice.</p></section>' +
      `<section><h2>Getting started</h2><ol>${stepsHtml}</ol></section>` +
      '<section><h2>Technical specifications</h2><ul>' +
      '<li>Detection model: Google MediaPipe Hand Landmarker (21 landmarks)</li>' +
      '<li>Processing: WebAssembly — sandboxed, on-device, no network access</li>' +
      '<li>Alarm latency: under 1 second from detection to alarm</li>' +
      '<li>Incident logging: timestamped log stored locally — never transmitted</li>' +
      '</ul></section>' +
      '<section><h2>Common questions</h2>' +
      '<h3>What happens to my camera data?</h3>' +
      '<p>Nothing. The video feed is processed frame-by-frame by the MediaPipe WASM binary running locally. ' +
      'No frames, no thumbnails, no data of any kind is sent to any server — you can verify this by watching your network traffic while the app runs.</p>' +
      '<h3>Does it work on Mac, Windows, and Linux?</h3>' +
      '<p>The web app works on any device with a modern browser and webcam — Mac, Windows, Linux, and Chromebook. ' +
      'Native desktop apps are available for macOS and Windows for system-tray background running.</p>' +
      '<h3>Will it false-alarm when I&#39;m eating or touching my face?</h3>' +
      '<p>The detection model distinguishes sustained hand-to-mouth proximity from brief touches, and sensitivity can be adjusted in settings.</p></section>' +
      '<section><h2>Learn more</h2><ul>' +
      '<li><a href="/blog/habit-reversal-training-guide">Habit Reversal Training: the clinical method behind the app</a></li>' +
      '<li><a href="/blog/webcam-privacy-nail-biting-app">How we verified on-device processing</a></li>' +
      '<li><a href="/compare/bitter-polish-alternative">Stop Biting vs bitter nail polish</a></li>' +
      '<li><a href="/pricing">Pricing — $2.99/month or $29/year, 3-day free trial</a></li>' +
      '</ul></section>');
    sendHtml(res, injectNoscriptNav(injected));
  });

  // Comparison and solutions pages. Body content comes from COMPARE_CONTENT
  // (src/data/comparePages.ts via seo-content.json); the meta title/description
  // are the hand-tuned SERP variants. Each page gets Article + BreadcrumbList
  // schema (patterned on comparison-schema.json in the repo root).
  const COMPARE_META = {
    '/compare/bitter-polish-alternative': {
      title: 'Stop Biting vs Bitter Nail Polish: Which Works?',
      description: 'AI detection solves the problem bitter nail polish can\'t: unconscious nail biting. Compare mechanisms, evidence, and who each approach works for.',
    },
    '/compare/habit-tracking-apps': {
      title: 'Why Habit Apps Don\'t Work for Nail Biting | Stop Biting',
      description: 'Manual habit trackers require you to log episodes you didn\'t notice. Stop Biting catches them automatically. Here\'s why automation changes outcomes.',
    },
    '/solutions/for-desk-workers': {
      title: 'Stop Nail Biting at Your Desk | Stop Biting',
      description: 'Desk workers bite their nails during deep focus — unconsciously. Stop Biting\'s AI detection runs in the background and catches every episode.',
    },
    '/solutions/for-adhd': {
      title: 'Nail Biting and ADHD: AI Detection That Works | Stop Biting',
      description: 'ADHD makes nail biting harder to stop — executive function gaps and dopamine-seeking make awareness nearly impossible. Real-time AI detection compensates.',
    },
    '/solutions/for-gamers': {
      title: 'Stop Nail Biting While Gaming | Stop Biting',
      description: 'Gaming flow state makes nail biting invisible. Stop Biting runs in the background and sounds an alarm — without interrupting your session.',
    },
  };

  for (const [pagePath, meta] of Object.entries(COMPARE_META)) {
    app.get(pagePath, (_req, res) => {
      if (!indexHtml) return res.sendFile(indexPath, HTML_SENDFILE_OPTS);
      const canonical = `https://stopbiting.today${pagePath}`;
      let injected = injectMeta(indexHtml, {
        title: meta.title,
        description: meta.description,
        canonical,
        ogType: 'article',
      });
      const content = COMPARE_CONTENT[pagePath];
      const article = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: content?.title ?? meta.title,
        description: meta.description,
        url: canonical,
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        // Matches the lastmod these pages declare in sitemap.xml
        // (CORE_PAGES in scripts/sync-seo.mjs).
        datePublished: '2026-04-28',
        dateModified: '2026-04-28',
        author: SCHEMA_AUTHOR,
        publisher: SCHEMA_PUBLISHER,
        inLanguage: 'en',
        isAccessibleForFree: true,
        image: SCHEMA_IMAGE,
      };
      const breadcrumb = breadcrumbSchema([
        ['Home', 'https://stopbiting.today/'],
        [content?.title ?? meta.title, canonical],
      ]);
      injected = injected.replace('</head>', `    ${schemaTag(article)}\n    ${schemaTag(breadcrumb)}\n  </head>`);
      if (content) injected = injectSsrArticle(injected, compareArticleHtml(content));
      sendHtml(res, injectNoscriptNav(injected));
    });
  }

  // Known valid routes for soft-404 protection
  const KNOWN_ROUTES = new Set([
    '/', '/blog', '/about', '/how-it-works', '/pricing', '/privacy',
    '/terms-and-conditions', '/refund-policy',
    ...Object.keys(COMPARE_META),
    ...Object.keys(BLOG_POSTS).map(slug => `/blog/${slug}`),
  ]);

  // Branded 404. Self-contained — the SPA's stylesheet is content-hashed, so a
  // static error page cannot link to it without going stale on every build.
  // Palette mirrors tailwind.config.js (cream/ink surfaces, forest accent).
  const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Page not found | Stop Biting</title>
  <style>
    :root {
      --bg: oklch(93% 0.016 80); --card: oklch(99% 0.005 80);
      --border: oklch(88% 0.014 120); --text: oklch(22% 0.012 120);
      --muted: oklch(50% 0.018 120); --accent: oklch(46% 0.130 148);
      --accent-contrast: oklch(97% 0.012 80);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: oklch(15% 0.010 200); --card: oklch(18% 0.010 200);
        --border: oklch(9% 0.005 200); --text: oklch(94% 0.010 120);
        --muted: oklch(62% 0.018 120); --accent: oklch(58% 0.130 148);
        --accent-contrast: oklch(15% 0.010 200);
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center;
      justify-content: center; padding: 24px; background: var(--bg);
      color: var(--text);
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.6;
    }
    main {
      background: var(--card); border: 1px solid var(--border); border-radius: 18px;
      padding: 40px 32px; max-width: 460px; width: 100%; text-align: center;
      box-shadow: 0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04);
    }
    .mark {
      width: 40px; height: 40px; border-radius: 11px; background: var(--accent);
      display: inline-flex; align-items: center; justify-content: center;
      margin-bottom: 20px;
    }
    .code {
      font-size: 11px; font-weight: 600; letter-spacing: 1.2px;
      text-transform: uppercase; color: var(--muted); margin: 0 0 8px;
    }
    h1 { font-size: 24px; letter-spacing: -0.4px; margin: 0 0 10px; }
    p { color: var(--muted); font-size: 14px; margin: 0 0 24px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
    a {
      text-decoration: none; font-size: 13.5px; font-weight: 500;
      padding: 10px 18px; border-radius: 11px; transition: opacity .15s;
    }
    a:hover { opacity: .85; }
    .primary { background: var(--accent); color: var(--accent-contrast); }
    .secondary { color: var(--muted); border: 1px solid var(--border); }
  </style>
</head>
<body>
  <main>
    <div class="mark">
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#fff"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 1.5l5 1.5v5c0 3-2.5 5.5-5 6.5-2.5-1-5-3.5-5-6.5v-5l5-1.5z"/>
      </svg>
    </div>
    <p class="code">Error 404</p>
    <h1>This page doesn't exist</h1>
    <p>The link may be broken or the page may have moved. Everything else is still here.</p>
    <div class="actions">
      <a class="primary" href="/">Go to the app</a>
      <a class="secondary" href="/blog">Read the guides</a>
    </div>
  </main>
</body>
</html>`;

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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
