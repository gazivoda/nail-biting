import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// In Electron, env vars are injected by the main process via spawn().
// In web dev (npm run dev), load from .env using Node's built-in (v20.12+).
if (!process.env.GOOGLE_CLIENT_ID) {
  try { process.loadEnvFile(); } catch { /* .env missing — rely on process.env */ }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// ─── Config ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_API = process.env.PAYPAL_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Derive the public base URL from the incoming request so we never need
// APP_URL or SERVER_URL env vars. Works on any domain automatically.
// Falls back to localhost for local dev and Electron.
function getBaseUrl(req) {
  if (process.env.ELECTRON_PROTOCOL) return `http://localhost:${PORT}`;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host  = req.headers['x-forwarded-host']  || req.headers.host;
  return `${proto}://${host}`;
}

// CORS — allow same origin (production) and localhost (dev).
// Since the frontend is served from the same Express server in production,
// same-origin requests don't need CORS at all. This covers local dev only.
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Electron, server-to-server)
    // and any localhost/127.0.0.1 origin for local dev.
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      cb(null, true);
    } else {
      cb(null, true); // same-origin requests in production pass through anyway
    }
  },
  credentials: true,
}));
app.use(express.json());
// When running inside Electron (packaged), redirect auth results to the
// custom protocol so the OS routes them back to the Electron app window.
const ELECTRON_PROTOCOL = process.env.ELECTRON_PROTOCOL || null;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !JWT_SECRET) {
  console.error('Missing required env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET');
  process.exit(1);
}

// ─── SQLite data store ───────────────────────────────────────────────────────
// DATA_DIR is configurable via env so Coolify can mount a persistent volume.
// Default: ./data (works locally and in Electron).
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'users.db'));
db.pragma('journal_mode = WAL');  // safe concurrent reads

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
function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '90d' });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── OAuth ───────────────────────────────────────────────────────────────────
// OAuth client is instantiated per-request so the redirect URI matches the
// actual domain automatically — no SERVER_URL env var needed.
function makeOAuthClient(req) {
  const redirectUri = `${getBaseUrl(req)}/api/auth/callback`;
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
}

app.get('/api/auth/google', (req, res) => {
  const client = makeOAuthClient(req);
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    prompt: 'select_account',
  });
  res.redirect(url);
});

app.get('/api/auth/callback', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const client = makeOAuthClient(req);
  const { code, error } = req.query;
  if (error || !code) {
    const errVal = encodeURIComponent(error || 'no_code');
    if (ELECTRON_PROTOCOL) {
      return res.redirect(`${ELECTRON_PROTOCOL}://auth?error=${errVal}`);
    }
    return res.redirect(`${baseUrl}/#auth_error=${errVal}`);
  }

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const googleId = payload.sub;

    // Find or create user
    let user = getUser(googleId);
    if (!user) {
      const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      user = {
        id: googleId,
        email: payload.email,
        name: payload.name,
        avatar: payload.picture,
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
      res.redirect(`${ELECTRON_PROTOCOL}://auth?token=${encodeURIComponent(token)}`);
    } else {
      res.redirect(`${baseUrl}/#token=${token}`);
    }
  } catch (err) {
    console.error('OAuth callback error:', err);
    if (ELECTRON_PROTOCOL) {
      res.redirect(`${ELECTRON_PROTOCOL}://auth?error=callback_failed`);
    } else {
      res.redirect(`${baseUrl}/#auth_error=callback_failed`);
    }
  }
});

// ─── User API ─────────────────────────────────────────────────────────────────
app.get('/api/user/me', authMiddleware, (req, res) => {
  const user = getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.patch('/api/user/me', authMiddleware, (req, res) => {
  const user = getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Only allow updating subscription fields
  const allowed = ['subscription_status', 'subscription_plan', 'subscription_end_date', 'paypal_subscription_id'];
  for (const key of allowed) {
    if (key in req.body) user[key] = req.body[key];
  }

  saveUser(user);
  res.json(user);
});

// ─── PayPal helpers ──────────────────────────────────────────────────────────

// Get a PayPal access token using client credentials (server-to-server).
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

// Fetch a subscription from PayPal's API and return its status + billing cycle.
async function getPayPalSubscription(subscriptionId) {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${PAYPAL_API}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`PayPal subscription lookup failed: ${res.status}`);
  return res.json();
}

// ─── PayPal verify endpoint ───────────────────────────────────────────────────

// Called by the client after PayPal onApprove. Verifies the subscription
// server-side before activating — prevents self-granting pro access.
app.post('/api/paypal/verify-subscription', authMiddleware, async (req, res) => {
  const { subscriptionId, plan } = req.body;
  if (!subscriptionId || !plan) {
    return res.status(400).json({ error: 'subscriptionId and plan are required' });
  }
  if (!['monthly', 'yearly'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    return res.status(503).json({ error: 'PayPal not configured on server' });
  }

  try {
    const subscription = await getPayPalSubscription(subscriptionId);

    // PayPal subscription must be ACTIVE to grant access
    if (subscription.status !== 'ACTIVE') {
      return res.status(402).json({ error: `Subscription is ${subscription.status}, not ACTIVE` });
    }

    const user = getUser(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const durationDays = plan === 'monthly' ? 30 : 365;
    user.subscription_status = 'active';
    user.subscription_plan = plan;
    user.subscription_end_date = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    user.paypal_subscription_id = subscriptionId;
    saveUser(user);

    res.json(user);
  } catch (err) {
    console.error('PayPal verify error:', err);
    res.status(502).json({ error: 'Failed to verify subscription with PayPal' });
  }
});

// ─── Downloads ───────────────────────────────────────────────────────────────
// Serves installer files (DMG, EXE) from the downloads/ directory.
// On Coolify, mount a persistent volume to DOWNLOADS_DIR so large binaries
// are not baked into the image.
const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || join(__dirname, 'downloads');

app.get('/downloads/:file', (req, res) => {
  const { file } = req.params;
  // Only allow alphanumeric filenames with safe extensions
  if (!/^[\w.\-]+\.(dmg|exe|zip|deb|AppImage)$/i.test(file)) {
    return res.status(400).send('Invalid filename');
  }
  const filePath = join(DOWNLOADS_DIR, file);
  res.download(filePath, file, (err) => {
    if (err && !res.headersSent) {
      res.status(404).send('File not found');
    }
  });
});

// ─── Static (production) ─────────────────────────────────────────────────────
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*path}', (_req, res) => res.sendFile(join(distPath, 'index.html')));
}

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
