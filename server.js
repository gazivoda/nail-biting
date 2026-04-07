import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';

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
const PAYPAL_CLIENT_ID     = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_API = process.env.PAYPAL_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

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

// H-1: Helmet — sets X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, etc.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'wasm-unsafe-eval'", "'unsafe-inline'", 'https://www.paypal.com', 'https://www.paypalobjects.com'],
      frameSrc:    ["'self'", 'https://www.paypal.com', 'https://www.sandbox.paypal.com'],
      connectSrc:  ["'self'", 'https://www.paypal.com', 'https://www.sandbox.paypal.com', 'https://api-m.paypal.com', 'https://api-m.sandbox.paypal.com'],
      imgSrc:      ["'self'", 'data:', 'https://lh3.googleusercontent.com', 'https://www.paypalobjects.com'],
      styleSrc:    ["'self'", "'unsafe-inline'"],  // Tailwind needs inline styles
      fontSrc:     ["'self'", 'data:'],
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
app.use(express.json({ limit: '10kb' }));  // M-8: explicit body size limit

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
    paypal_subscription_id TEXT,
    created_at            TEXT NOT NULL
  )
`);

const stmtGet    = db.prepare('SELECT * FROM users WHERE id = ?');
const stmtUpsert = db.prepare(`
  INSERT INTO users (id, email, name, avatar, trial_end_date, subscription_status,
    subscription_plan, subscription_end_date, paypal_subscription_id, created_at)
  VALUES (@id, @email, @name, @avatar, @trial_end_date, @subscription_status,
    @subscription_plan, @subscription_end_date, @paypal_subscription_id, @created_at)
  ON CONFLICT(id) DO UPDATE SET
    email                  = excluded.email,
    name                   = excluded.name,
    avatar                 = excluded.avatar,
    trial_end_date         = excluded.trial_end_date,
    subscription_status    = excluded.subscription_status,
    subscription_plan      = excluded.subscription_plan,
    subscription_end_date  = excluded.subscription_end_date,
    paypal_subscription_id = excluded.paypal_subscription_id
`);

function getUser(id) { return stmtGet.get(id) ?? null; }

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
    paypal_subscription_id: user.paypal_subscription_id ?? null,
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
    if (!user) {
      const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      user = {
        id: googleId,
        email: googlePayload.email,
        name: googlePayload.name,
        avatar: googlePayload.picture,
        trial_end_date: trialEnd,
        subscription_status: 'trial',
        subscription_plan: null,
        subscription_end_date: null,
        paypal_subscription_id: null,
        created_at: new Date().toISOString(),
      };
    }
    saveUser(user);

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
// by the server-side PayPal verification endpoint, never by the client.

// ─── PayPal helpers ──────────────────────────────────────────────────────────

async function getPayPalAccessToken() {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal token request failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function getPayPalSubscription(subscriptionId) {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${PAYPAL_API}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`PayPal subscription lookup failed: ${res.status}`);
  return res.json();
}

// ─── PayPal verify endpoint ───────────────────────────────────────────────────
app.post('/api/paypal/verify-subscription', authMiddleware, async (req, res) => {
  const { subscriptionId, plan } = req.body;
  if (!subscriptionId || !plan) {
    return res.status(400).json({ error: 'subscriptionId and plan are required' });
  }
  if (!['monthly', 'yearly'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  // M-3: Validate subscriptionId format before passing to PayPal API
  if (!/^I-[A-Z0-9]{5,30}$/.test(subscriptionId)) {
    return res.status(400).json({ error: 'Invalid subscriptionId format' });
  }
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    return res.status(503).json({ error: 'PayPal not configured on server' });
  }

  try {
    const subscription = await getPayPalSubscription(subscriptionId);

    if (subscription.status !== 'ACTIVE') {
      return res.status(402).json({ error: `Subscription is not active` });
    }

    // H-6: Verify the subscription belongs to the authenticated user.
    // We check the subscriber email against the user's stored email.
    const user = getUser(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const subscriberEmail = subscription.subscriber?.email_address;
    if (subscriberEmail && user.email && subscriberEmail.toLowerCase() !== user.email.toLowerCase()) {
      console.warn(`PayPal subscription ${subscriptionId} belongs to ${subscriberEmail}, not ${user.email}`);
      return res.status(403).json({ error: 'Subscription does not belong to this account' });
    }

    // M-4: Use next_billing_time from PayPal if available, otherwise fall back to duration.
    const nextBilling = subscription.billing_info?.next_billing_time;
    const durationDays = plan === 'monthly' ? 30 : 365;
    const endDate = nextBilling
      ? new Date(nextBilling).toISOString()
      : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    user.subscription_status   = 'active';
    user.subscription_plan     = plan;
    user.subscription_end_date = endDate;
    user.paypal_subscription_id = subscriptionId;
    saveUser(user);

    res.json(user);
  } catch (err) {
    // M-5: Don't log PayPal response bodies — log only the message.
    console.error('PayPal verify error:', err.message);
    res.status(502).json({ error: 'Failed to verify subscription with PayPal' });
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
  app.use(express.static(distPath));
  app.get('/{*path}', (_req, res) => res.sendFile(join(distPath, 'index.html')));
}

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
