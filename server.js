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
const PADDLE_API = process.env.PADDLE_ENV === 'production'
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

// H-1: Helmet — sets X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, etc.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'wasm-unsafe-eval'", "'unsafe-inline'", 'https://*.paddle.com', 'https://cdn.paddle.com', 'https://public.profitwell.com', 'https://www.googletagmanager.com'],
      frameSrc:    ["'self'", 'https://*.paddle.com'],
      connectSrc:  ["'self'", 'https://*.paddle.com', 'https://checkout.paddle.com', 'https://checkout-service.paddle.com', 'https://public.profitwell.com', 'https://www.google.com', 'https://www.googletagmanager.com', 'https://www.google-analytics.com', 'https://analytics.google.com', 'https://region1.google-analytics.com'],
      imgSrc:      ["'self'", 'data:', 'https://lh3.googleusercontent.com', 'https://*.paddle.com'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://cdn.paddle.com'],  // Tailwind + Paddle CSS
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
    paypal_subscription_id TEXT,
    paddle_subscription_id TEXT,
    paddle_customer_id     TEXT,
    created_at            TEXT NOT NULL
  )
`);

// Migration: add paddle columns to existing DB
try { db.exec('ALTER TABLE users ADD COLUMN paddle_subscription_id TEXT'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN paddle_customer_id TEXT'); } catch { /* already exists */ }

const stmtGet    = db.prepare('SELECT * FROM users WHERE id = ?');
const stmtFindByEmail = db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
const stmtUpsert = db.prepare(`
  INSERT INTO users (id, email, name, avatar, trial_end_date, subscription_status,
    subscription_plan, subscription_end_date, paypal_subscription_id, paddle_subscription_id, paddle_customer_id, created_at)
  VALUES (@id, @email, @name, @avatar, @trial_end_date, @subscription_status,
    @subscription_plan, @subscription_end_date, @paypal_subscription_id, @paddle_subscription_id, @paddle_customer_id, @created_at)
  ON CONFLICT(id) DO UPDATE SET
    email                  = excluded.email,
    name                   = excluded.name,
    avatar                 = excluded.avatar,
    trial_end_date         = excluded.trial_end_date,
    subscription_status    = excluded.subscription_status,
    subscription_plan      = excluded.subscription_plan,
    subscription_end_date  = excluded.subscription_end_date,
    paypal_subscription_id = excluded.paypal_subscription_id,
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
    paypal_subscription_id: user.paypal_subscription_id ?? null,
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
        paddle_subscription_id: null,
        paddle_customer_id: null,
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
    if (eventType === 'subscription.activated' || eventType === 'subscription.updated') {
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
app.post('/api/paddle/verify-subscription', authMiddleware, async (req, res) => {
  const { subscriptionId } = req.body;
  if (!subscriptionId) {
    return res.status(400).json({ error: 'subscriptionId is required' });
  }
  if (!PADDLE_API_KEY) {
    return res.status(503).json({ error: 'Paddle not configured on server' });
  }

  try {
    const paddleRes = await fetch(`${PADDLE_API}/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${PADDLE_API_KEY}` },
    });

    if (!paddleRes.ok) {
      throw new Error(`Paddle subscription lookup failed: ${paddleRes.status}`);
    }

    const { data } = await paddleRes.json();

    if (data.status !== 'active') {
      return res.status(402).json({ error: 'Subscription is not active yet' });
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

  // Blog post metadata for server-side meta tag injection.
  // Mirrors src/data/blogPosts.ts — kept in sync manually (no build step needed).
  const BLOG_META = {
    'why-do-people-bite-their-nails': {
      title: 'Why Do People Bite Their Nails? The Psychology and Science Behind Onychophagia',
      description: 'Nail biting (onychophagia) affects 20–30% of adults. This article explains the psychological triggers, habit loops, and brain mechanisms that drive the behaviour.',
    },
    'habit-reversal-training-guide': {
      title: 'Habit Reversal Training for Nail Biting: A Complete Evidence-Based Guide',
      description: 'Habit Reversal Training (HRT) reduces nail biting frequency by 70–90%. This guide explains the three components, the evidence behind them, and how to apply them.',
    },
    'nail-biting-health-risks': {
      title: 'The Real Health Risks of Nail Biting: What Onychophagia Actually Does to Your Body',
      description: 'Nail biting causes dental damage, nail infections, pathogen transfer, and social anxiety. This article details the evidence-based health risks of chronic onychophagia.',
    },
    'nail-biting-in-children': {
      title: 'Nail Biting in Children: Causes, When to Worry, and Effective Strategies for Parents',
      description: 'Nail biting affects up to 45% of children. This guide explains normal vs. concerning levels, age-appropriate interventions, and when to seek professional help.',
    },
    'best-nail-biting-remedies': {
      title: 'Best Remedies to Stop Nail Biting: Every Method Ranked by Evidence',
      description: 'From bitter nail polish to AI detection apps — a ranked review of every method to stop nail biting, with the evidence for each and who each approach suits best.',
    },
    'stress-and-nail-biting': {
      title: 'The Stress–Nail Biting Connection: Why Anxiety Drives the Habit and How to Break the Loop',
      description: 'Stress is the most cited nail biting trigger. This article explains the neuroscience of anxiety-driven nail biting and evidence-based strategies to interrupt the stress–bite cycle.',
    },
    'onychophagia-ocd-connection': {
      title: 'Onychophagia and OCD: Understanding the Link Between Nail Biting and Obsessive-Compulsive Disorder',
      description: 'Nail biting sits at the intersection of habit, anxiety, and OCD-spectrum disorders. This article explains the BFRB classification, diagnostic differences, and treatment implications.',
    },
    'how-ai-can-help-stop-nail-biting': {
      title: 'How AI Can Help You Stop Biting Your Nails: The Technology Behind Real-Time Detection',
      description: 'Real-time AI detection solves the awareness problem at the core of nail biting. This article explains how webcam-based AI works, the HRT mechanism it automates, and what to expect.',
    },
    'nail-biting-during-focus-and-work': {
      title: 'Nail Biting at Work: Why Deep Focus and Concentration Trigger the Habit',
      description: 'Many people bite their nails specifically during focused work — coding, reading, meetings. This article explains the focus-habit loop and how to interrupt it without breaking your flow state.',
    },
    'breaking-any-habit-science': {
      title: 'The Neuroscience of Habit Breaking: How to Apply It Specifically to Nail Biting',
      description: 'Why are habits so hard to break? This article explains the neuroscience of habit formation and extinction, and how those mechanisms apply to stopping nail biting.',
    },
    'nail-biting-vs-skin-picking': {
      title: 'Nail Biting vs Skin Picking: How BFRBs Compare and What Works for Each',
      description: 'Nail biting and skin picking are both BFRBs but have different triggers and treatments. This article explains the key differences and what intervention approaches work best for each.',
    },
    'stopping-nail-biting-for-good': {
      title: 'Stopping Nail Biting for Good: What Relapses Mean and How to Build Lasting Change',
      description: 'Most people who stop nail biting relapse at least once. This article explains why relapse is neurologically expected, what it tells you, and the evidence-based path to lasting change.',
    },
    'nail-biting-anxiety-treatment': {
      title: 'Nail Biting and Anxiety: When Treating Anxiety Is the Key to Stopping the Habit',
      description: 'For some nail biters, anxiety is the root cause — not just a trigger. This article explains how to identify anxiety-driven biting and when treating anxiety directly is the right approach.',
    },
    'how-long-to-stop-nail-biting': {
      title: 'How Long Does It Take to Stop Nail Biting? A Realistic Timeline',
      description: 'Most people want to know how long it takes to stop nail biting. The honest answer depends on habit severity and method. This article gives a research-based realistic timeline.',
    },
    'nail-biting-adults-why-persists': {
      title: 'Why Nail Biting Persists into Adulthood — and What Makes It Different to Childhood Habits',
      description: 'Nail biting that persists into adulthood is fundamentally different from childhood nail biting. This article explains why adult habits are harder to break and what approaches work best.',
    },
    'webcam-privacy-nail-biting-app': {
      title: 'Is It Safe to Use a Webcam App to Stop Nail Biting? Privacy Explained',
      description: 'Using a webcam app to track nail biting raises legitimate privacy questions. This article explains exactly what data is collected, how on-device AI works, and why no camera data leaves your device.',
    },
    'nail-biting-during-sleep': {
      title: 'Nail Biting During Sleep: Does It Happen and What Can You Do?',
      description: 'Some people bite their nails during sleep without knowing it. This article explains sleep-related nail biting, how to tell if it\'s happening, and evidence-based approaches to stop it.',
    },
    'bitter-nail-polish-review': {
      title: 'Bitter Nail Polish for Nail Biting: Does It Work? A Review of the Evidence',
      description: 'Bitter nail polish is one of the most popular nail biting remedies. This article reviews the evidence for products like Mavala Stop, how they work, and when they are and are not effective.',
    },
    'nail-biting-genetics': {
      title: 'Is Nail Biting Genetic? What the Research Says About Hereditary BFRB Risk',
      description: 'Studies show nail biting runs in families, but is it genetic or learned? This article reviews twin studies and genetic research on BFRB heritability and what it means for treatment.',
    },
    'mediapipe-ai-detection-explained': {
      title: 'How MediaPipe AI Detection Works in Stop Biting: A Technical Explainer',
      description: 'Stop Biting uses Google\'s MediaPipe framework running in WebAssembly to detect nail biting in real time. This article explains the technology stack for technically curious users.',
    },
  };

  // Helper: inject page-specific <title>, <meta description>, and <link canonical>
  // into the SPA index.html shell before sending it. This makes critical SEO
  // elements visible to Googlebot without a full SSR framework.
  function injectMeta(html, { title, description, canonical }) {
    return html
      .replace(
        /<title>[^<]*<\/title>/,
        `<title>${title}</title>`
      )
      .replace(
        /<meta name="description" content="[^"]*"/,
        `<meta name="description" content="${description}"`
      )
      .replace(
        /<link rel="canonical" href="[^"]*"/,
        `<link rel="canonical" href="${canonical}"`
      );
  }

  // Helper: inject BlogPosting + BreadcrumbList JSON-LD schemas into the <head>.
  // AI crawlers and Googlebot do not execute JavaScript, so useEffect-injected
  // schemas are invisible to them. Server-side injection ensures all crawlers
  // see correct structured data in the initial HTML response.
  function injectBlogSchemas(html, { slug, title, description, canonical }) {
    const blogPosting = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      description,
      url: canonical,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      author: {
        '@type': 'Organization',
        name: 'Stop Biting Editorial Team',
        url: 'https://stopbiting.today',
        description: 'Science-based editorial team covering onychophagia, body-focused repetitive behaviors (BFRBs), and habit reversal training.',
        knowsAbout: ['onychophagia', 'nail biting', 'body-focused repetitive behaviors', 'habit reversal training', 'BFRB treatment'],
      },
      publisher: {
        '@type': 'Organization',
        name: 'Stop Biting',
        url: 'https://stopbiting.today',
        logo: { '@type': 'ImageObject', url: 'https://stopbiting.today/icons/icon-512x512.png' },
      },
      inLanguage: 'en',
      isAccessibleForFree: true,
    };

    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://stopbiting.today/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://stopbiting.today/blog' },
        { '@type': 'ListItem', position: 3, name: title, item: canonical },
      ],
    };

    const schemas = [
      `<script type="application/ld+json">${JSON.stringify(blogPosting)}</script>`,
      `<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`,
    ].join('\n    ');

    // Inject before closing </head>
    return html.replace('</head>', `    ${schemas}\n  </head>`);
  }

  // Read index.html once at startup (it's static after build)
  let indexHtml = null;
  const indexPath = join(distPath, 'index.html');
  if (existsSync(indexPath)) {
    indexHtml = readFileSync(indexPath, 'utf-8');
  }

  // Blog post pages — inject per-post meta + structured data before serving the SPA shell
  app.get('/blog/:slug', (req, res) => {
    const { slug } = req.params;
    const meta = BLOG_META[slug];
    if (!indexHtml) return res.sendFile(indexPath);
    if (!meta) {
      // Unknown slug — serve shell with default meta (React will show 404)
      return res.type('html').send(indexHtml);
    }
    const canonical = `https://stopbiting.today/blog/${slug}`;
    const pageTitle = `${meta.title} | Stop Biting`;
    let injected = injectMeta(indexHtml, {
      title: pageTitle,
      description: meta.description,
      canonical,
    });
    injected = injectBlogSchemas(injected, {
      slug,
      title: meta.title,
      description: meta.description,
      canonical,
    });
    res.type('html').send(injected);
  });

  // Blog index page
  app.get('/blog', (req, res) => {
    if (!indexHtml) return res.sendFile(indexPath);
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
      hasPart: Object.entries(BLOG_META).map(([slug, m]) => ({
        '@type': 'BlogPosting',
        headline: m.title,
        description: m.description,
        url: `https://stopbiting.today/blog/${slug}`,
      })),
    };

    const schemaTag = `<script type="application/ld+json">${JSON.stringify(collectionSchema)}</script>`;
    injected = injected.replace('</head>', `    ${schemaTag}\n  </head>`);
    res.type('html').send(injected);
  });

  // Privacy policy page
  app.get('/privacy', (req, res) => {
    if (!indexHtml) return res.sendFile(indexPath);
    const injected = injectMeta(indexHtml, {
      title: 'Privacy Policy | Stop Biting',
      description: 'Stop Biting processes your webcam feed entirely on-device. No camera data is ever transmitted to any server. Read our full privacy policy.',
      canonical: 'https://stopbiting.today/privacy',
    });
    res.type('html').send(injected);
  });

  // Remaining static assets (icons, WASM, models, etc.)
  app.use(express.static(distPath));

  // SPA fallback — all other routes serve index.html with default meta
  app.get('/{*path}', (_req, res) => res.sendFile(indexPath));
}

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
