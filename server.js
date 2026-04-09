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

  // Publication dates for all blog posts — used in BlogPosting schema.
  // Mirrors src/data/blogPosts.ts — kept in sync manually.
  const BLOG_DATES = {
    'why-do-people-bite-their-nails':     { datePublished: '2026-04-03', dateModified: '2026-04-03' },
    'habit-reversal-training-guide':      { datePublished: '2026-04-03', dateModified: '2026-04-03' },
    'nail-biting-health-risks':           { datePublished: '2026-04-03', dateModified: '2026-04-03' },
    'nail-biting-in-children':            { datePublished: '2026-04-03', dateModified: '2026-04-03' },
    'best-nail-biting-remedies':          { datePublished: '2026-04-03', dateModified: '2026-04-03' },
    'stress-and-nail-biting':             { datePublished: '2026-04-03', dateModified: '2026-04-03' },
    'onychophagia-ocd-connection':        { datePublished: '2026-04-03', dateModified: '2026-04-03' },
    'how-ai-can-help-stop-nail-biting':   { datePublished: '2026-04-03', dateModified: '2026-04-03' },
    'nail-biting-during-focus-and-work':  { datePublished: '2026-04-03', dateModified: '2026-04-03' },
    'breaking-any-habit-science':         { datePublished: '2026-04-03', dateModified: '2026-04-03' },
    'nail-biting-vs-skin-picking':        { datePublished: '2026-04-07', dateModified: '2026-04-07' },
    'stopping-nail-biting-for-good':      { datePublished: '2026-04-07', dateModified: '2026-04-07' },
    'nail-biting-anxiety-treatment':      { datePublished: '2026-04-07', dateModified: '2026-04-07' },
    'how-long-to-stop-nail-biting':       { datePublished: '2026-04-07', dateModified: '2026-04-07' },
    'nail-biting-adults-why-persists':    { datePublished: '2026-04-07', dateModified: '2026-04-07' },
    'webcam-privacy-nail-biting-app':     { datePublished: '2026-04-07', dateModified: '2026-04-07' },
    'nail-biting-during-sleep':           { datePublished: '2026-04-07', dateModified: '2026-04-07' },
    'bitter-nail-polish-review':          { datePublished: '2026-04-07', dateModified: '2026-04-07' },
    'nail-biting-genetics':               { datePublished: '2026-04-07', dateModified: '2026-04-07' },
    'mediapipe-ai-detection-explained':   { datePublished: '2026-04-07', dateModified: '2026-04-07' },
  };

  // Full sections content for all blog posts — injected server-side so AI crawlers
  // (which do not execute JavaScript) can read article bodies in raw HTML.
  // Mirrors src/data/blogPosts.ts — kept in sync manually (no build step needed).
  const BLOG_SECTIONS_DATA = {
    'why-do-people-bite-their-nails': [
      { heading: 'What is onychophagia?', body: `Onychophagia is the clinical term for chronic nail biting — a body-focused repetitive behaviour (BFRB) classified alongside skin picking (excoriation) and hair pulling (trichotillomania). Unlike occasional casual nail biting, onychophagia is characterised by repetition, difficulty stopping despite wanting to, and often visible physical damage to the nails, cuticles, or surrounding skin.\n\nResearch suggests onychophagia affects between 20% and 30% of the general adult population, with prevalence peaking in adolescence (where estimates reach 45%) before declining — but often not disappearing — in adulthood. It is one of the most common nervous habits worldwide and is frequently underdiagnosed because sufferers tend to minimise the behaviour.` },
      { heading: 'What causes nail biting? The three main triggers', body: `The triggers for nail biting cluster consistently into three broad categories across the clinical literature, though individual patterns vary significantly.`, list: ['Stress and anxiety — The most frequently reported trigger. Biting activates the oral motor system and produces a brief calming effect through proprioceptive stimulation. The relief reinforces the behaviour, making the cue–routine–reward loop stronger with each repetition.', 'Deep focus and boredom — Many people bite during intense cognitive tasks (coding, reading, studying) or when under-stimulated. In these states, the prefrontal cortex is occupied elsewhere, reducing the self-monitoring capacity that would otherwise inhibit the behaviour.', 'Perfectionism and frustration — A 2015 study published in PLOS ONE found that nail biters were more likely to be perfectionists and to engage in the behaviour as a response to frustration with unmet high standards. The behaviour provides a physical outlet for emotional regulation.'] },
      { heading: 'Is nail biting a form of OCD?', body: `Nail biting is classified in the DSM-5 under "Other Specified Obsessive-Compulsive and Related Disorders" when it reaches clinical severity. However, most nail biters do not meet full OCD diagnostic criteria. The key distinction is that OCD is driven by intrusive obsessions that compulsions are performed to neutralise, whereas BFRB behaviours like nail biting are primarily automatic — triggered by states rather than thoughts.\n\nThat said, there is a meaningful overlap. Studies indicate that approximately 28–33% of OCD patients also exhibit BFRBs, and nail biters show elevated rates of anxiety sensitivity. The neurocircuitry involved — particularly the corticostriatal loops governing habitual behaviour — overlaps substantially between OCD and BFRBs.` },
      { heading: 'Why does nail biting become automatic?', body: `Habits form through a process of procedural memory consolidation in the basal ganglia. When a behaviour is repeated consistently in the presence of a stable cue (stress, a particular context, a particular emotion), the neural pathway becomes progressively more efficient through a process called long-term potentiation. Eventually, the cue alone is sufficient to trigger the routine — bypassing conscious deliberation entirely.\n\nFor nail biters, this means the hand moves to the mouth and biting begins before there is any conscious awareness that it is happening. This is why willpower alone rarely succeeds: the behaviour has been shifted from deliberate to automatic processing, and willpower only operates on deliberate processing. Effective intervention must work at the level of the automatic habit loop itself.` },
      { heading: 'What is the role of awareness in stopping nail biting?', body: `The core problem with automatic habits is the absence of awareness at the critical moment. Studies of habit reversal training — the gold-standard treatment for BFRBs — identify awareness training as the primary active ingredient. Participants who become reliably aware of each instance of their nail biting show substantially greater reductions than those who focus only on competing responses or motivation.\n\nThis is why real-time detection tools are therapeutically interesting: they introduce external awareness at precisely the moment when self-awareness is absent. The moment the alarm fires is the moment the automatic chain is broken — creating the neurological opening for a competing response and, over time, for the habit loop itself to weaken through non-reinforcement.` },
    ],
    'habit-reversal-training-guide': [
      { heading: 'What is Habit Reversal Training?', body: `Habit Reversal Training (HRT) is the most evidence-supported treatment for nail biting, clinically proven to reduce biting frequency by 70–90% in consistent practitioners. Originally developed by Nathan Azrin and R. Gregory Nunn in 1973 and validated across hundreds of clinical trials for body-focused repetitive behaviours (BFRBs), it remains the gold standard for onychophagia treatment.\n\nA 2012 Cochrane review of behavioural interventions for nail biting and other BFRBs found that HRT produced significantly greater reductions in habit frequency than control conditions, with effect sizes ranging from moderate to large. Studies using daily monitoring logs report 70–90% reductions in biting frequency among participants who complete all three HRT components consistently over a 4–8 week period.` },
      { heading: 'Component 1: Awareness training', body: `Awareness training is the foundational and most impactful component of HRT. Most nail biters report noticing fewer than half of their daily biting episodes — the behaviour has become so automatic that it occurs below the threshold of conscious attention. Awareness training systematically raises this threshold.\n\nThe protocol involves: (1) keeping a detailed habit diary recording every instance of biting, including the time, context, emotional state, and trigger; (2) practising noticing the precursor behaviours — the hand moving upward, the fingers touching the lips — that precede the bite itself; and (3) spending time in front of a mirror observing the habit while it happens, to break the automaticity through conscious observation. This phase alone produces measurable reductions before any competing response is introduced.` },
      { heading: 'Component 2: Competing response training', body: `A competing response is a behaviour that is physically incompatible with nail biting — it cannot be performed simultaneously. The competing response must be: (a) physically incompatible with the habit, (b) maintainable for at least one minute, (c) socially inconspicuous, and (d) easy to perform in any context.\n\nCommonly used competing responses for nail biting include: pressing fingertips firmly against a flat surface; clenching a fist; gripping a pen or other object; placing both hands palm-down on a table; or pressing the thumb and forefinger of one hand together. The competing response is performed immediately upon awareness of the urge or the beginning of the habit, and maintained for 1–3 minutes or until the urge passes.` },
      { heading: 'Component 3: Social support and sensory interruption', body: `The third component is external feedback — a signal from outside the individual that the habit is occurring. In clinical settings, this is typically a therapist or trained support person who gently flags each instance of the behaviour during sessions. The external signal serves as an awareness bridge during moments when self-monitoring fails.\n\nFor daily life, a sensory interruption such as an audible alarm provides equivalent function without requiring a social partner to be present. The alarm breaks the automatic chain at the moment of occurrence, creating the same neurological opening for the competing response that a therapist's signal would produce. This is the component that technology can most effectively automate — and where real-time AI detection becomes directly therapeutically relevant.` },
      { heading: 'How long does HRT take to work?', body: `Most clinical HRT protocols span 4–10 weeks of weekly sessions, with daily self-monitoring between sessions. Response tends to follow a characteristic curve: awareness increases rapidly in the first 1–2 weeks, often accompanied by an apparent increase in perceived biting frequency (because more incidents are being noticed, not because more are occurring). Actual biting frequency then decreases significantly between weeks 2 and 6 as the competing response becomes habitual.\n\nLong-term maintenance requires continued practice, particularly in high-stress periods when the original triggers intensify. A 12-month follow-up study by Deckersbach et al. found that 87% of HRT responders maintained their improvements at one year, compared to 26% in a psychoeducation-only control group, suggesting that the competing response becomes self-sustaining once established.` },
    ],
    'nail-biting-health-risks': [
      { heading: 'Is nail biting actually harmful?', body: `Nail biting is frequently dismissed as a harmless nervous habit, but chronic onychophagia causes a range of physical health problems that compound over years. The damage occurs across four primary systems: dental, dermatological, infectious, and psychological. Understanding the concrete risks is often more motivating for behaviour change than abstract concern — and the risks are more serious than most nail biters realise.` },
      { heading: 'Dental damage from chronic nail biting', body: `The teeth are not designed for the repeated shear force of biting hard nail material. Chronic nail biting causes several forms of dental damage. Tooth fractures and chipping are well-documented, particularly in the upper incisors which bear the primary biting load. A 2013 study in the Journal of Esthetic and Restorative Dentistry found that nail biters had significantly higher rates of tooth fractures and craze lines than controls.\n\nTemporomandibular joint (TMJ) dysfunction is a further risk. The repeated parafunctional jaw movement strains the muscles and ligaments of the TMJ, leading to jaw pain, clicking, and in severe cases, restricted movement. Nail biters also show accelerated incisor wear and an increased incidence of malocclusion, where the bite pattern is altered by years of asymmetric pressure.` },
      { heading: 'Nail infections: paronychia and beyond', body: `Paronychia — infection of the nail fold — is significantly more common in nail biters than in the general population. The repeated trauma of biting creates micro-abrasions in the cuticle and surrounding skin, providing entry points for bacteria (typically Staphylococcus aureus) and fungi (typically Candida species). Acute paronychia presents with redness, swelling, and pain around the nail; chronic paronychia can lead to permanent nail deformity.\n\nIn severe or untreated cases, nail infections can spread to deeper tissue (felon) or, rarely, to bone (osteomyelitis). The risk is elevated in immunocompromised individuals. Beyond paronychia, chronic nail biting can cause permanent changes to nail plate morphology — the nail grows back thinner, ridged, or with irregular edges even after the habit stops.` },
      { heading: 'How nail biting spreads pathogens', body: `The fingers are among the most heavily contaminated surfaces the body regularly contacts. Studies of hand microbial load consistently find hundreds of species of bacteria and fungi on the fingertips, including enteric pathogens that cause gastrointestinal illness. Nail biting creates a direct pathway from fingertips to oral mucosa — one of the body's most permeable infection entry points.\n\nA 2018 study found that nail biters were 58% more likely to have oral HPV than non-biters. Enterobacteriaceae — including E. coli strains — are routinely recovered from subungual spaces (under the nail), and biting transfers these directly into the mouth. For those who work in environments with high pathogen exposure (healthcare, food service, public transport), the infection transmission risk from nail biting is clinically significant.` },
      { heading: 'The psychological costs: shame, social anxiety, and the reinforcement loop', body: `The visible damage from chronic nail biting — short, ragged nails, damaged cuticles, scarred periungual skin — causes significant psychological distress in a substantial proportion of nail biters. A 2015 survey found that 48% of chronic nail biters reported avoiding handshakes or hiding their hands in social situations. This shame and social withdrawal are not trivial side effects; they represent a meaningful reduction in quality of life.\n\nParticularly insidious is the feedback loop: the shame of damaged nails increases anxiety, which intensifies the urge to bite, which worsens the visible damage, which increases shame. This self-reinforcing cycle is one reason why motivational approaches alone ("just decide to stop") are rarely successful — the psychological component of the habit has its own momentum independent of conscious intention.` },
    ],
    'nail-biting-in-children': [
      { heading: 'How common is nail biting in children?', body: `Nail biting is one of the most common nervous habits in childhood and adolescence. Prevalence studies estimate that approximately 30–45% of children between ages 7 and 10 bite their nails at some point, with rates peaking in early adolescence (11–14 years) before declining through the teenage years. Onset before age 3 is rare; the behaviour most commonly emerges between ages 4 and 6 when children begin school and encounter new sources of stress and social pressure.\n\nFor the majority of children, nail biting is a transient habit that resolves without intervention by mid-adolescence. However, for a meaningful minority — estimates range from 20–30% of childhood nail biters — the behaviour persists into adulthood and becomes more entrenched over time if not addressed.` },
      { heading: 'Why do children bite their nails?', body: `In children, nail biting serves similar psychological functions to those seen in adults, but the triggering contexts differ. Common triggers in children include: school-related anxiety (tests, social pressures, transitions); boredom, particularly during passive activities like watching television or riding in a car; excitement or anticipation (which can trigger the same oral motor activation as anxiety); and imitation of peers or family members who bite their nails.\n\nYounger children (4–7) are less likely to bite from true anxiety and more likely to bite from boredom or imitation. In older children and adolescents, the anxiety component becomes more prominent. The behaviour should be interpreted in the context of the child's overall emotional regulation — isolated nail biting in an otherwise well-adjusted child is very different from nail biting that accompanies pervasive anxiety, school refusal, or other concerning signs.` },
      { heading: 'When should parents be concerned about a child\'s nail biting?', body: `Most childhood nail biting does not require professional intervention. The following signs suggest a need for closer attention and potentially professional evaluation:`, list: ['The biting causes physical damage — significant shortening of nails, bleeding cuticles, infections, or visible pain.', 'The child is distressed about the habit, expresses shame or embarrassment, or has lost control of it despite wanting to stop.', 'The nail biting is accompanied by other BFRBs such as hair pulling, skin picking, or cheek chewing.', 'The habit appears linked to significant anxiety, sleep problems, school refusal, or other concerning behavioural changes.', 'The child is over 10 and the habit is intensifying rather than naturally fading.'] },
      { heading: 'What strategies work for children?', body: `For younger children (4–8), the most effective approaches are indirect and low-pressure. Drawing direct parental attention to the habit — particularly negative attention such as criticism or scolding — tends to increase anxiety and therefore increase biting. More effective approaches include: keeping fingernails short and smooth (removing the sensory trigger of a rough edge); providing alternative tactile stimulation (fidget tools, textured surfaces); and identifying the contexts where biting occurs and introducing alternative activities in those contexts.\n\nFor older children and adolescents, more direct awareness-based strategies become appropriate. Habit diaries, gentle self-monitoring, and discussion of triggers can be introduced with appropriate framing. Older children can engage with simple competing response training — for example, the child chooses their own competing response, which increases compliance. Bitter-tasting nail products are a useful adjunct and generally well-tolerated from age 7 upward.` },
      { heading: 'When is professional help appropriate for childhood nail biting?', body: `When nail biting meets clinical thresholds — significant physical damage, marked distress, or co-occurring anxiety disorder — referral to a child psychologist or behavioural therapist trained in BFRBs is appropriate. Habit Reversal Training adapted for children has good evidence for ages 8 and above.\n\nFor children with co-occurring OCD or anxiety disorder, treatment of the primary condition — typically CBT for childhood OCD/anxiety — often produces parallel reductions in nail biting without targeting the habit directly. Parents should avoid the common error of treating the nail biting as an isolated behaviour when it may be a symptom of a broader anxiety pattern that warrants its own assessment.` },
    ],
    'best-nail-biting-remedies': [
      { heading: 'Why do most nail biting remedies fail?', body: `Most products marketed to stop nail biting target the symptom — the act of biting — rather than the underlying habit loop. Bitter-tasting polishes, physical barriers, and reminder bands all work on a simple aversive conditioning model: make the behaviour unpleasant enough and the person will stop. This works for mild, low-frequency nail biting, but fails for established habits because it doesn't address the automaticity that makes the behaviour resistant to volitional control in the first place.\n\nEffective nail biting remedies share a common mechanism: they introduce awareness at the moment the habit occurs and provide a pathway to a competing behaviour. Methods that do this consistently and in the right contexts produce durable change. Methods that only work when the person is already aware — or that are easy to override — produce temporary suppression that often rebounds.` },
      { heading: 'Tier 1: Highest evidence — Habit Reversal Training (HRT)', body: `HRT is the evidence-based gold standard, with the strongest clinical research base of any nail biting remedy. Multiple randomised controlled trials and meta-analyses confirm its efficacy, with 70–90% reductions in biting frequency in participants who complete the protocol. HRT works by systematically building awareness and installing a competing response — addressing the habit at the level of the automatic loop rather than simply punishing the output.\n\nThe main limitation is investment: a full HRT protocol requires 4–8 weeks of structured practice, ideally with a trained therapist or at minimum a detailed self-help protocol. For mild habitual nail biters, this may feel disproportionate; for those with significant physical damage or psychological distress, it is the appropriate intervention. Self-administered HRT using workbooks or apps has also shown good results in several studies.` },
      { heading: 'Tier 2: Good adjuncts — Bitter nail polishes', body: `Bitter-tasting nail preparations (Mavala Stop, Orly No Bite, Control-It, Thum) contain denatonium benzoate — the world's most bitter substance — or similar aversive compounds. Applied to the nails, they produce an immediate, powerful bitter taste whenever the fingers enter the mouth, interrupting the behaviour through aversive conditioning.\n\nThe evidence for standalone use is modest: a Cochrane review noted methodological limitations in most trials, and real-world compliance is imperfect because users often wash their hands and fail to reapply. However, as an adjunct to HRT — particularly in the early stages when the competing response habit is not yet established — bitter polishes provide a useful secondary layer of interruption.` },
      { heading: 'Tier 3: Promising new approach — AI detection apps', body: `Real-time AI detection represents a new category of nail biting remedy that directly addresses the core problem of awareness. Using computer vision running on-device (preventing any privacy concerns), these applications monitor via webcam and sound an alarm the moment the hand approaches the mouth. This provides the sensory interruption component of HRT automatically, in real time, without requiring a therapist or social partner to be present.\n\nThe mechanism is therapeutically sound: the alarm fires at the exact moment the automatic chain can most effectively be broken, and the jarring interruption promotes the development of conscious awareness over time. Early users report significant reductions in biting frequency within 2–4 weeks, consistent with the HRT literature on awareness training timelines.` },
      { heading: 'Tier 4: Limited evidence — Mindfulness and stress reduction', body: `Mindfulness-based approaches — meditation, breathing exercises, body scanning — reduce the anxiety that drives stress-triggered nail biting. Several small studies have found reductions in BFRB frequency following MBSR (Mindfulness-Based Stress Reduction) programmes, likely through reduced reactivity to the emotional triggers that initiate biting.\n\nHowever, mindfulness does not address the automaticity of the habit and provides no mechanism for interrupting biting in the moment. It is best conceptualised as an upstream intervention that reduces trigger frequency, complementary to but not substitutable for direct habit intervention.` },
    ],
    'stress-and-nail-biting': [
      { heading: 'Why does stress cause nail biting?', body: `Stress activates the sympathetic nervous system, increasing physiological arousal and creating an urge to discharge that arousal through motor activity. Nail biting — like other oral motor behaviours (gum chewing, pen chewing, cheek biting) — activates the oral motor system in a way that produces a mild but genuine calming effect through proprioceptive feedback. The jaw muscles and perioral area are richly innervated, and their activation during low-level oral motor behaviour appears to partially counteract the physiological arousal response.\n\nThis is not purely psychological: EEG studies have found that rhythmic oral motor activity reduces cortical arousal markers associated with stress. In other words, nail biting genuinely works — in the very short term — as a stress management tool. This pharmacological-style reinforcement is precisely why it becomes a conditioned response to stress rather than remaining a conscious choice.` },
      { heading: 'What is the stress-habit feedback loop?', body: `Once nail biting is established as a stress response, it creates its own reinforcing loop. Stress triggers biting; biting briefly reduces arousal; reduced arousal reinforces biting as the go-to stress response; the next time stress occurs, the urge to bite is stronger. Over years, this loop becomes deeply encoded — the association between stress cues and the biting response becomes automatic and nearly immediate.\n\nA secondary feedback loop also operates: the visible damage from chronic biting (short, damaged nails) causes shame and social anxiety, which are themselves forms of stress, which intensifies the original trigger. Many chronic nail biters report that their self-consciousness about their nails generates as much biting-relevant anxiety as the original external stressors that initiated the habit.` },
      { heading: 'How can you identify your personal stress triggers?', body: `Effective intervention requires identifying the specific stress contexts that trigger your biting. Generic stress is too broad a target; the habit is linked to specific cues. A habit diary kept for one week — recording every biting episode with time, location, emotional state, and what you were doing — will reveal patterns that are rarely visible without systematic tracking.\n\nCommon stress-context patterns in nail biters include: pre-deadline periods (the 24 hours before a deadline shows the highest biting rates for many people); social evaluation situations (video calls, presentations, meetings where performance is observed); decision-making under uncertainty; and interpersonal conflict. Identifying your highest-risk contexts allows you to implement proactive interventions before the automatic response activates.` },
      { heading: 'Does reducing stress actually reduce nail biting?', body: `Stress reduction alone produces modest, inconsistent reductions in nail biting frequency. This is because the habit has been encoded as an automatic response — the trigger pathway exists independently of the overall stress level. Lowering baseline stress reduces trigger frequency but does not remove the conditioned response.\n\nThe analogy is a fire alarm connected to a thermostat: reducing the temperature (stress) makes the alarm go off less often, but the alarm itself (the habit response) still fires whenever the threshold is crossed. A complete intervention strategy requires both reducing triggers (stress management) and dismantling the automatic response (HRT, awareness training, competing response).` },
      { heading: 'What stress management techniques complement HRT for nail biting?', body: `For nail biters with clear stress-driven patterns, combining HRT with targeted stress reduction produces the best outcomes. Evidence-based stress management techniques that complement HRT include: diaphragmatic breathing (shown to reduce salivary cortisol and physiological arousal rapidly); progressive muscle relaxation (which specifically targets the motor tension component of stress); cognitive restructuring (addressing the perfectionism and catastrophising patterns that commonly drive nail biting anxiety); and structured worry time (containing rumination to specific periods).`, list: ['Diaphragmatic breathing — 5 minutes, 3× daily: reduces cortisol and provides an oral motor alternative.', 'Progressive muscle relaxation — targets the physical tension that drives motor habits.', 'Cognitive restructuring — addresses perfectionism patterns strongly linked to nail biting.', 'Structured worry time — reduces diffuse anxiety that raises baseline stress throughout the day.'] },
    ],
    'onychophagia-ocd-connection': [
      { heading: 'How is nail biting classified in the DSM-5?', body: `The DSM-5 classifies pathological nail biting under "Other Specified Obsessive-Compulsive and Related Disorder" when it reaches clinical severity — defined as causing significant distress or functional impairment. This classification places onychophagia within the OCD-spectrum, alongside trichotillomania (hair pulling), excoriation disorder (skin picking), and body dysmorphic disorder.\n\nHowever, DSM classification does not imply that nail biting is OCD. The vast majority of nail biters would not meet diagnostic criteria for any disorder. The clinical classification applies only to cases where the behaviour is significantly out of control, causes physical damage, and generates meaningful distress.` },
      { heading: 'What are body-focused repetitive behaviours (BFRBs)?', body: `Body-focused repetitive behaviours (BFRBs) are a cluster of conditions characterised by repetitive self-grooming behaviours — nail biting, hair pulling, skin picking, cheek biting — that cause physical damage and are performed compulsively despite attempts to stop. BFRBs share a common feature: they are not primarily driven by obsessions (as in OCD proper) but by urges, sensory experiences, and emotional states.\n\nThis distinction matters clinically: first-line OCD treatments such as ERP (Exposure and Response Prevention) are not as effective for BFRBs as HRT, and medication profiles also differ. Misclassifying a BFRB as OCD and treating it accordingly can delay effective treatment.` },
      { heading: 'What is the actual overlap between nail biting and OCD?', body: `Research consistently finds elevated rates of co-occurrence between BFRBs and OCD, though the relationship is complex. Approximately 28–33% of individuals with OCD also exhibit at least one BFRB; conversely, BFRB sufferers show higher rates of OCD than the general population. Several family and twin studies suggest shared genetic factors, and neuroimaging studies have found overlapping patterns of corticostriatal dysfunction in both OCD and BFRBs.\n\nHowever, shared neural substrates do not indicate identity of mechanism. The key functional distinction remains: OCD compulsions are performed to reduce obsession-related anxiety and are ego-dystonic (experienced as unwanted); BFRB behaviours are typically ego-syntonic (experienced as sensory relief or habit) and are driven by urge rather than thought.` },
      { heading: 'Does OCD treatment help nail biting?', body: `Standard OCD treatment — Exposure and Response Prevention (ERP) and SSRI medication — has mixed results for BFRBs. ERP is significantly less effective for BFRBs than for OCD proper, because the mechanism it targets does not map cleanly onto the urge-driven, sensory-reinforced pattern of BFRBs.\n\nSSRI medications show more modest and inconsistent results in BFRBs across clinical trials. N-acetylcysteine (NAC), a glutamate modulator, has shown promising results in BFRB treatment in several randomised trials. The treatment-of-choice for BFRBs — including clinical-level nail biting — remains Habit Reversal Training, with Comprehensive Behavioral Treatment (ComB) as a more recent evolution.` },
      { heading: 'Should I see a therapist about my nail biting?', body: `A mental health evaluation is appropriate when nail biting causes: significant physical damage (infections, tooth damage, permanent nail changes); meaningful distress or shame; functional impairment; or when the habit fails to respond to self-help HRT approaches after 8–12 weeks of consistent effort.\n\nWhen seeking treatment, it is important to find a therapist with specific experience in BFRBs — not simply OCD treatment, as the approaches differ meaningfully. The TLC Foundation for BFRBs maintains a therapist directory at bfrb.org. Telehealth has made BFRB-trained therapists substantially more accessible, and there is good evidence that HRT delivered via videoconference produces outcomes equivalent to in-person treatment.` },
    ],
    'how-ai-can-help-stop-nail-biting': [
      { heading: 'What is the core problem AI solves for nail biting?', body: `The central challenge in stopping nail biting is not motivation — most nail biters want to stop — it is the automaticity of the habit. Research on BFRB behaviour consistently finds that nail biters are unaware of the majority of their daily biting episodes. The hand-to-mouth movement is executed below the threshold of conscious attention before any opportunity for deliberate intervention.\n\nHabit Reversal Training's primary active ingredient is awareness training — systematically raising the threshold at which the person notices the habit occurring. But awareness training in its traditional form requires human support: a therapist, a partner, or an extremely disciplined self-monitoring practice. Real-time AI detection provides this awareness trigger automatically, at the exact moment the habit occurs, in any context where a camera is available.` },
      { heading: 'How does webcam-based nail biting detection actually work?', body: `Modern real-time nail biting detection uses a combination of hand landmark detection and face landmark detection to identify when fingers are near the mouth. The hand model tracks 21 key points on the hand with sub-centimetre precision; the face model tracks 468 facial landmarks including the precise location of the lips and mouth opening. When hand landmarks and mouth landmarks are simultaneously within a defined geometric proximity, the detection fires.\n\nThe underlying AI framework — MediaPipe, developed by Google — runs entirely in WebAssembly, a portable binary instruction format that executes at near-native speed inside browsers and desktop applications. This means the detection runs at 30+ frames per second entirely on the user's local CPU or GPU, with no network connection to any server required.` },
      { heading: 'Is AI detection as effective as human awareness training?', body: `The therapeutic mechanism is identical to the sensory interruption component of HRT — an external signal that breaks the automatic chain at the moment of occurrence. What AI detection adds over traditional methods is: real-time precision (the alarm fires at the exact moment, not after the bite has occurred); consistency (no lapses, no social awkwardness); and persistence (the system monitors continuously without fatigue).\n\nEarly user reports suggest a characteristic adaptation curve: weeks 1–2 see frequent alarms as the system captures the full scope of previously-unnoticed biting; weeks 3–4 show decreasing alarm frequency as awareness increases; weeks 5–8 show continued reductions as the competing response becomes habitual.` },
      { heading: 'What are the privacy implications of a webcam monitoring app?', body: `Privacy is the central concern for any application that operates a webcam continuously during work hours. Stop Biting addresses this through architecture rather than policy: because MediaPipe runs entirely in WebAssembly on the user's device, no camera data — not a single frame — is transmitted over the network. This can be independently verified by monitoring network traffic while the app runs; no camera-related packets will be observed.\n\nThe SQLite database storing incident logs and streaks is also local. Uninstalling the app removes all data. There is no cloud sync, no user analytics, no behavioural data collected. The camera feed is processed and discarded locally, frame by frame, with no persistence and no network transmission.` },
      { heading: 'What should I expect in the first month of using AI detection for nail biting?', body: `The first week is typically the most disorienting. The alarm fires frequently — often far more frequently than the user expected based on their subjective sense of how often they bit. This is the most therapeutically important period: the gap between perceived and actual biting frequency becomes concretely visible.\n\nBy week two, most users report becoming more aware of the urge before the hand moves — the beginning of genuine awareness training. By week three, they begin noticing their hand moving before it reaches the mouth, and can intercept the movement before the alarm fires. This progression from post-hoc alarm to proactive interception is the target outcome of the awareness training component of HRT.` },
    ],
    'nail-biting-during-focus-and-work': [
      { heading: 'Why does nail biting happen during focused work?', body: `Deep cognitive focus — the kind that occurs during coding, writing, reading, or detailed analytical work — involves a specific pattern of prefrontal cortex engagement. When the prefrontal cortex is heavily allocated to a demanding task, its capacity for self-monitoring and inhibitory control is temporarily reduced. This reduced inhibitory control is the neurological opening through which automatic behaviours like nail biting slip through.\n\nIn a resting state, the same prefrontal regions that suppress habitual behaviours are more available. During intense focus, they are recruited elsewhere. The result is that many nail biters bite exclusively — or far more frequently — during focused work, and have little to no problem in non-work contexts.` },
      { heading: 'What is the focus-habit loop?', body: `The focus-habit loop is a specific variant of the general habit loop that operates through the following sequence: the cue is the transition into deep focus (opening a code editor, starting a document, joining a meeting); the routine is the hand-to-mouth movement and biting action; and the reward is proprioceptive stimulation that provides low-level sensory input without disrupting cognitive flow.\n\nThis reward structure explains why nail biting during focus is so persistent. It does not compete with the primary task; in fact, for many people it feels like it enhances focus by providing peripheral sensory stimulation. Some research on oral motor behaviour and cognitive performance suggests this is not entirely illusory — oral motor activity can reduce cortical arousal in ways that may temporarily support sustained attention.` },
      { heading: 'How can you interrupt focus-triggered nail biting without breaking flow?', body: `The key constraint for work-context interventions is that they must not disrupt the cognitive flow state that is, paradoxically, when the intervention is most needed. Heavy-friction interventions — putting on gloves, applying bitter polish that must be reapplied after hand washing, wearing physical barriers — all impose conscious awareness overhead that interrupts the work.\n\nThe optimal intervention is one that requires minimal deliberate attention: an external signal (audible alarm) that provides awareness without requiring pre-emptive self-monitoring. This is why real-time AI detection is particularly well-suited to work-context nail biting. The camera monitors continuously; the alarm fires when detection occurs; the user applies a competing response and returns to work within seconds, without having to track or manage the habit consciously during focused periods.` },
      { heading: 'What competing responses work during deep focus?', body: `The competing response must be physically incompatible with nail biting, maintainable for 1–3 minutes, and low enough in cognitive cost that it does not derail the focus state.`, list: ['Pressing palms flat on the desk surface — physically incompatible, requires no conscious management, can be held for 1–3 minutes while continuing to think.', 'Gripping a textured object (stress ball, smooth stone) in the dominant hand — redirects the tactile seeking to a sanctioned target.', 'Interlacing fingers and pressing them together under the desk — invisible in video calls, low cognitive overhead.', 'Touch-typing deliberately — occupies both hands in a way that prevents hand-to-mouth movement, compatible with writing tasks.'] },
      { heading: 'Should I monitor my work sessions for nail biting frequency?', body: `Tracking bite frequency across work sessions provides data that is both therapeutically useful and often surprising. Most people who bite primarily during work estimate their daily frequency at 5–15 bites; systematic monitoring typically reveals 30–60+ biting events per session in chronic cases — most of which were entirely unconscious.\n\nThis data is valuable beyond its shock value: it allows identification of specific work types that trigger the most biting (meetings vs. solo coding vs. email vs. reading), time-of-day patterns, and correlation with workload intensity. With this data, targeted interventions can be deployed in the highest-risk contexts rather than attempting constant vigilance across all activities.` },
    ],
    'breaking-any-habit-science': [
      { heading: 'How does the brain form habits?', body: `Habits are formed through a process called procedural learning — a form of memory consolidation that occurs primarily in the basal ganglia, a set of subcortical structures involved in motor control and reward processing. When a behaviour is repeated consistently in the context of a stable cue and followed by a reward (even a minor one), the neural pathway strengthens through long-term potentiation — the repeated activation of the same synaptic connections increases their efficiency.\n\nThe process is not linear: early repetitions strengthen the pathway rapidly; later repetitions consolidate it against extinction. This is why habits formed over years are substantially more resistant to change than recently acquired ones. Nail biting practiced daily for a decade is encoded at a significantly deeper level than nail biting that began six months ago.` },
      { heading: 'What is the habit loop and how does it apply to nail biting?', body: `Charles Duhigg's popular formulation of the habit loop — cue, routine, reward — maps cleanly onto nail biting. The cue is typically an emotional state (stress, boredom, frustration) or a context (sitting at a desk, watching a screen). The routine is the hand-to-mouth movement and biting action. The reward is the proprioceptive stimulation and brief emotional regulation effect that biting produces.\n\nThe key insight from habit neuroscience is that the cue-routine-reward association is stored as a single chunk in basal ganglia memory. When the cue occurs, the entire routine is retrieved and executed as a unit, bypassing cortical deliberation. This chunking is what makes the habit automatic — and it explains why the habit continues even when the person consciously does not want to bite.` },
      { heading: 'Can habits be truly erased, or only suppressed?', body: `The neuroscience literature suggests that established habits are not erased — they are overridden. The original cue-routine-reward pathway in the basal ganglia remains encoded even after successful habit change; it is suppressed by a competing pathway that has been strengthened through consistent practice. This has a practical implication: nail biters who have successfully stopped often find that the habit resurfaces during high-stress periods.\n\nThis "habit relapse" is not a sign of failure or weakness; it is a predictable consequence of the neurological architecture of habit storage. The original pathway, though suppressed, remains available to be reactivated by sufficiently strong cues. Long-term success requires maintaining the competing response habit — not assuming that one period of successful change has permanently eliminated the original pathway.` },
      { heading: 'What conditions are necessary for successful habit change?', body: `The habit change literature identifies several conditions that predict successful outcome. Consistency of the new response across the full range of triggering contexts is the strongest predictor — partial habit change (stopping during some contexts but not others) tends to maintain the original pathway in the unaddressed contexts. Environmental modification — changing the physical or social context to reduce cue exposure — reduces trigger frequency and extends the window for competing response establishment.\n\nFeedback frequency and immediacy are also strong predictors. Delayed feedback (reviewing a daily log at the end of the day) is far less effective than immediate feedback (an alarm the moment biting occurs). This is consistent with basic reinforcement learning theory: the longer the delay between behaviour and consequence, the weaker the associative link.` },
      { heading: 'How long does it take to break the nail biting habit?', body: `The popular claim that habits take 21 days to change derives from a misreading of a 1960 book by plastic surgeon Maxwell Maltz. The actual evidence is more complex. A 2010 study by Phillippa Lally at University College London found that habit formation ranged from 18 to 254 days, with a median of 66 days — with simple behaviours at the lower end and complex, emotionally-loaded behaviours at the upper end.\n\nFor nail biting specifically, clinical HRT trials show meaningful reductions within 4–8 weeks of consistent practice, with continued improvements over the following 3–6 months as the competing response consolidates. Sustainable success strategies treat habit management as ongoing practice rather than a one-time cure.` },
    ],
    'nail-biting-vs-skin-picking': [
      { heading: 'What do nail biting and skin picking have in common?', body: `Nail biting (onychophagia) and skin picking (excoriation disorder) are both classified as Body-Focused Repetitive Behaviors (BFRBs) — a cluster of conditions involving repetitive, compulsive self-grooming actions that cause physical damage and persist despite attempts to stop. Both are classified in the DSM-5 under OCD-related disorders, both cause visible physical damage, and both generate significant shame in affected individuals.\n\nCritically, both share the same fundamental mechanism: an automatic habit loop triggered by emotional states or sensory cues, executed below the threshold of conscious awareness, and reinforced by a brief feeling of relief or stimulation. This shared mechanism is why both respond well to the same first-line treatment — Habit Reversal Training.` },
      { heading: 'How nail biting and skin picking differ', body: `Despite their similarities, the two behaviors differ in important ways that affect treatment approach. Nail biting is predominantly an oral motor behavior — the primary sensory reward comes from the proprioceptive feedback of the jaw and mouth. Skin picking is predominantly a tactile behavior — the primary reward is the sensory relief of finding and manipulating an "imperfection" on the skin surface.\n\nThis difference in sensory channel matters for competing response design. For nail biters, effective competing responses redirect oral motor activation. For skin pickers, effective competing responses redirect tactile seeking. Using the wrong type of competing response reduces effectiveness because it doesn't satisfy the underlying sensory need.` },
      { heading: 'Which triggers are more common for each?', body: `Both behaviors are triggered by stress, boredom, and focus states, but with different frequency distributions. Nail biters more commonly report biting during focused cognitive work — coding, reading, video calls — where the oral motor habit runs in parallel with prefrontal engagement. The habit is often described as helping maintain focus.\n\nSkin pickers more frequently report picking during states of low arousal (lying in bed, watching television, idle time) and during tactile exploration. Both behaviors intensify during high-stress periods, but nail biters show a clearer correlation with acute stress events, while skin pickers show more sensitivity to chronic stress and low mood states.` },
      { heading: 'Treatment differences: what works for each', body: `For nail biting, HRT with a physical competing response has the strongest evidence base. Real-time AI detection tools are particularly well-suited to nail biting because the detection event (hand near mouth) is geometrically precise and can be reliably identified by computer vision.\n\nFor skin picking, HRT remains first-line, but the competing response design requires more attention to the tactile seeking dimension — smooth textures, fidget tools, or barrier methods are commonly used. The ComB (Comprehensive Behavioral Treatment) framework provides more nuanced approaches than standard HRT for skin picking at clinical severity. N-acetylcysteine (NAC) has shown meaningful benefit in randomised trials for excoriation disorder.` },
      { heading: 'Can someone have both nail biting and skin picking?', body: `Yes — BFRB co-occurrence is common. Studies suggest that approximately 40–60% of individuals with one BFRB also engage in at least one other BFRB. The most common combinations are nail biting with skin picking, nail biting with cheek biting, and hair pulling with skin picking. This co-occurrence has a genetic basis: twin studies confirm a shared heritable component across the BFRB family.\n\nFor individuals with multiple BFRBs, treatment sequencing matters. Beginning with the most physically damaging or most distressing behavior is generally recommended. Attempting to address multiple BFRBs simultaneously typically produces inferior results compared to sequential treatment of individual behaviors.` },
    ],
    'stopping-nail-biting-for-good': [
      { heading: 'Why do people relapse after stopping nail biting?', body: `Relapse after a successful period of not biting is not a sign of weakness or failure — it is a predictable consequence of how the brain stores habits. Neuroscience research shows that established habits are not erased when suppressed; the original neural pathway in the basal ganglia remains encoded and can be reactivated by sufficiently strong cues.\n\nThe most common relapse triggers are stress escalation (a period of unusually high stress that overwhelms the competing response habit), context change (returning to an environment where biting was the norm), and lapse permissiveness (the "what the hell" effect, where a single instance of biting after a period of success is interpreted as total failure).` },
      { heading: 'The lapse vs. relapse distinction', body: `Cognitive behavioral therapy draws an important distinction between a lapse (a single instance of the old behavior) and a relapse (a return to pre-treatment levels over an extended period). The distinction matters because lapses are neurologically inevitable — the original habit pathway will be reactivated from time to time, particularly under high stress — but they only become relapses if the person responds with abandonment rather than recommitment.\n\nResearch on habit change consistently finds that how a person responds to a lapse is a stronger predictor of long-term outcome than whether a lapse occurs at all. Treating a lapse as data (what triggered it, what context made the competing response fail) rather than as failure dramatically improves long-term outcomes.` },
      { heading: 'What does a sustainable stopping strategy look like?', body: `Long-term success with nail biting requires treating the habit as an ongoing management challenge rather than a one-time fix. First, maintenance of the competing response: the competing response habit must itself be maintained through practice — it is not self-sustaining indefinitely without reinforcement. Periods of high stress are the most important times to actively practice the competing response.\n\nSecond, environmental engineering: reducing the presence of cues that trigger biting — particularly context cues and sensory cues (rough nail edges, hangnails) — reduces trigger frequency and extends the window between triggers and response. Third, monitoring: maintaining some form of ongoing self-monitoring, even at low intensity, provides the awareness bridge that prevents the habit from becoming fully automatic again.` },
      { heading: 'How long until the risk of relapse decreases significantly?', body: `The relapse risk curve for nail biting follows a pattern seen across behavioral habits: highest in the first 2–4 weeks, significantly reduced by 3 months of consistent competing response practice, and substantially lower (though never zero) after 6–12 months. The 2010 Lally et al. study on habit formation found that new behaviors take 18–254 days to become automatic, with a median of 66 days.\n\nAfter 12 months of maintained behavior change, the risk of relapse drops substantially, but high-stress periods continue to represent elevated risk indefinitely. Former nail biters who remain aware of their highest-risk contexts and maintain light touch self-monitoring report the best long-term outcomes.` },
      { heading: 'When should you seek professional support?', body: `Self-directed HRT using apps, workbooks, or structured self-help protocols is effective for the majority of nail biters. Professional support is appropriate when: self-directed efforts have failed after two or more sincere 8-week attempts; the habit is causing significant physical damage; nail biting is accompanied by significant anxiety, depression, or other BFRBs; or when the shame and distress associated with the habit is itself impairing quality of life.\n\nTherapists trained in BFRBs produce significantly better outcomes than generalist CBT therapists. The TLC Foundation for Body-Focused Repetitive Behaviors (bfrb.org) maintains a directory of BFRB-trained clinicians, and telehealth delivery is now well-validated for HRT.` },
    ],
    'nail-biting-anxiety-treatment': [
      { heading: 'Is your nail biting driven by anxiety?', body: `Not all nail biting is equally anxiety-driven. Research identifies three functional profiles: anxiety-regulatory biting (the habit primarily functions as a stress response), stimulation-seeking biting (the habit primarily functions to provide sensory input during under-stimulation), and automatic biting (the habit has become so overlearned that it occurs independent of emotional state).\n\nDistinguishing between these profiles matters for treatment because the most effective intervention differs. Anxiety-regulatory biters benefit most from combining HRT with anxiety reduction strategies. Stimulation-seeking biters respond best to environmental stimulation adjustments and sensory substitutes. Automatic biters need the full HRT protocol with particular emphasis on awareness training.` },
      { heading: 'How to identify if anxiety is your primary driver', body: `A one-week habit diary is the most reliable tool for identifying your dominant biting profile. Record each biting episode with: time, location, what you were doing, and your emotional state (on a 1–10 stress scale). After one week, pattern analysis typically reveals one of three dominant patterns: biting clusters around high-stress periods (anxiety-regulatory); biting clusters around passive, low-stimulation activities (stimulation-seeking); or biting is distributed relatively evenly across emotional states (automatic).\n\nAnxiety-regulatory biters also frequently report that the urge to bite is accompanied by a recognizable anxious arousal state — a feeling of tension, agitation, or the "need to do something" — that precedes the bite and is briefly relieved by it.` },
      { heading: 'Does treating anxiety reduce nail biting?', body: `For anxiety-regulatory biters, treating anxiety produces meaningful reductions in biting frequency — though rarely eliminates it entirely, because the habit pathway in the basal ganglia persists independently of the anxiety level. The analogy of a fire alarm connected to a thermostat remains apt: reducing the temperature (anxiety) makes the alarm fire less often, but the alarm circuit (habit response) still exists.\n\nClinical evidence supports this pattern. Studies of CBT for generalized anxiety disorder and social anxiety disorder consistently find parallel reductions in associated BFRB behaviors, including nail biting. The effect size is typically 30–50% reduction in BFRB frequency — meaningful, but not reaching the 70–90% reductions achieved by targeting the habit directly with HRT.` },
      { heading: 'Evidence-based anxiety treatments that reduce nail biting', body: `For nail biters whose habit is clearly anxiety-driven, the following treatments have the best evidence for anxiety reduction and, secondarily, BFRB reduction.`, list: ['CBT for anxiety — Cognitive Behavioral Therapy targets the thought patterns (catastrophising, overestimation of threat) that generate anxiety, reducing trigger frequency at the source.', 'Acceptance and Commitment Therapy (ACT) — ACT reduces experiential avoidance and increases psychological flexibility, reducing the emotional reactivity that triggers biting without requiring anxiety suppression.', 'MBSR (Mindfulness-Based Stress Reduction) — 8-week structured program with the strongest evidence for reducing anxiety-driven behavioral habits.', 'Diaphragmatic breathing — Activates the parasympathetic nervous system within 2–3 minutes, providing an immediate anxiety-reduction competing response compatible with most settings.'] },
      { heading: 'The optimal approach: treat both', body: `For most anxiety-driven nail biters, the optimal outcome comes from treating both the anxiety and the habit directly. Anxiety treatment reduces trigger frequency and intensity; HRT dismantles the automatic habit loop itself. Either alone produces partial results; both together produce the most durable and complete change.\n\nA practical sequencing recommendation: begin HRT immediately (awareness training and competing response practice), while simultaneously initiating an anxiety management practice. The HRT produces faster visible results — reducing biting frequency within 2–4 weeks — which itself reduces the shame-driven anxiety component, creating a positive feedback loop.` },
    ],
    'how-long-to-stop-nail-biting': [
      { heading: 'The honest answer: it varies widely', body: `The popular claim that habits take 21 days to break is not supported by research. The actual evidence suggests that for complex, emotionally-loaded behaviors like nail biting, meaningful and durable change takes 6–12 weeks of consistent effort, with the full consolidation of a new automatic response taking 3–6 months. Some individuals — particularly those with long-established habits, high baseline stress, or co-occurring anxiety — may require longer.\n\nThis is not discouraging; it is realistic. Understanding the timeline sets appropriate expectations and prevents the common pattern of abandoning effective treatment because it hasn't produced complete results within two weeks.` },
      { heading: 'Week 1–2: Awareness surge', body: `The first phase of effective nail biting treatment is characterised by a striking increase in perceived biting frequency. This is not because biting is increasing — it is because awareness is increasing. Most nail biters notice fewer than half of their daily biting episodes under normal conditions. When awareness training begins (habit diary, competing response practice, real-time detection), the full scope of the habit becomes visible for the first time.\n\nThis phase is often the most psychologically challenging. Reframing it as accurate data collection rather than evidence of severity helps. The awareness itself is therapeutically active — simply noticing the habit creates the neurological opening for the competing response and begins to weaken the automatic chain.` },
      { heading: 'Week 2–6: Active reduction', body: `Once awareness is established, the competing response begins to take effect. Biting frequency decreases — typically by 30–60% within the first four weeks of consistent HRT practice. The reduction is not linear: there are days of high biting (often correlating with elevated stress) and days of very low biting. The trend across the period is downward.\n\nBy week 4–6, most consistent practitioners report a qualitative shift: they begin noticing the urge to bite before the hand has moved, rather than only after the fact. This proactive interception — catching the urge rather than the behavior — is the target outcome of awareness training and signals that the competing response is beginning to compete with the original habit at the level of automaticity.` },
      { heading: 'Week 6–12: Consolidation', body: `Between weeks 6 and 12, biting frequency continues to decline toward baseline levels (near zero, or episodic rather than constant). The competing response becomes increasingly automatic — requiring less deliberate effort to initiate. Nail regrowth becomes visible for the first time in many cases, which provides its own positive reinforcement.\n\nThe primary risk in this phase is premature discontinuation. Once biting has reduced substantially and the competing response feels habitual, many people relax the monitoring and practice that produced the improvement. Maintaining light-touch monitoring substantially reduces relapse risk during this consolidation phase.` },
      { heading: 'What makes the timeline shorter or longer?', body: `Several factors reliably predict faster or slower progress. Factors that accelerate the timeline: high motivation and consistent daily practice, real-time external awareness feedback (detection apps, partners), low baseline stress levels, short habit duration (habit established within the last 2–3 years).\n\nFactors that extend the timeline: habit established in childhood (deeper encoding), high chronic stress (constant trigger activation), co-occurring anxiety disorder, previous failed attempts that have undermined self-efficacy. The single strongest predictor of timeline is consistency of competing response practice.` },
    ],
    'nail-biting-adults-why-persists': [
      { heading: 'Why does nail biting persist into adulthood?', body: `Nail biting that continues into adulthood has typically been practiced daily for 10–20+ years. This duration of practice produces a qualitatively different habit from one that has been established for months. Long-established habits are encoded more deeply in basal ganglia circuitry, are activated by a wider range of cues (through generalisation), and are more resistant to extinction because they have been reinforced tens of thousands of times.\n\nThere is also a developmental dimension. Habits formed during childhood and adolescence are encoded during periods of high neuroplasticity. Paradoxically, this means childhood habits are formed more efficiently and are more deeply embedded than habits formed in adulthood.` },
      { heading: 'The role of life stress in adult nail biting', body: `Adult life introduces stressors that are qualitatively different from childhood stressors — work pressure, financial stress, relationship demands, parenting — and that are more sustained and less escapable. These chronic stress conditions maintain the anxiety and arousal states that trigger nail biting at elevated levels.\n\nFor many adults, nail biting has also become embedded in specific adult-life contexts — desk work, video meetings, evening relaxation — that did not exist during childhood. Each new context becomes a cue, progressively widening the trigger profile. An adult nail biter who has been biting during focused work for 15 years has associated their entire work identity with the habit, making context modification substantially more challenging.` },
      { heading: 'What is different about treating adult nail biting?', body: `Adult nail biters generally have greater cognitive resources for treatment — better self-monitoring capacity, stronger ability to maintain a habit diary, better understanding of the habit loop mechanism. They also typically have stronger intrinsic motivation (the social and professional costs of damaged nails are more visible in adult life).\n\nHowever, adult treatment also faces specific challenges. The competing response must be compatible with professional contexts — it cannot be conspicuous during meetings or client interactions. The habit has typically been associated with multiple contexts that must each be addressed. And the longer timeline required for deeply encoded habits requires sustained effort over a period that many adults struggle to maintain alongside work and life demands.` },
      { heading: 'The most effective approaches for long-established adult habits', body: `For adult nail biters with habits of 10+ years, the evidence points to a combination approach. HRT remains first-line, but with specific adaptations for adult contexts: competing responses designed for desk-work and meeting environments, habit diaries integrated into digital tools, and awareness tools (including AI detection) that function during work hours without requiring behavioral overhead.\n\nFor deeply established habits in high-stress adults, augmenting HRT with stress management accelerates outcomes. Adults with habits established before age 10 may benefit from the longer treatment timelines recommended for deeply encoded behaviors — 16–24 weeks of consistent practice rather than the 8-week standard protocol.` },
    ],
    'webcam-privacy-nail-biting-app': [
      { heading: 'The core privacy concern with webcam habit apps', body: `The idea of running a webcam continuously during work hours raises an obvious and legitimate concern: where does the camera data go? Most people have an intuitive understanding that webcam footage is sensitive — it captures your face, your environment, and potentially other people in your space.\n\nThe answer depends entirely on whether the app processes video on-device or sends it to a server. Cloud-based processing — where video frames are transmitted to a server for analysis — creates genuine privacy risks regardless of the app developer's stated policies. On-device processing, where all analysis happens locally on the user's own hardware, eliminates the transmission risk by design.` },
      { heading: 'How on-device AI processing works', body: `Stop Biting uses MediaPipe, Google's open-source machine learning framework, compiled to WebAssembly — a portable binary format that runs at near-native speed inside browsers and desktop applications. The hand and face landmark detection models run entirely on the user's local CPU or GPU. No video frames, no landmark coordinates, and no detection events are transmitted to any server.\n\nThis can be independently verified by anyone using network monitoring tools (Charles Proxy, Wireshark, or the browser's built-in Network tab in Developer Tools). Running Stop Biting while monitoring network traffic will show zero camera-related network requests. The absence of data transmission is architectural — there is no server endpoint to send data to, because all processing is local.` },
      { heading: 'What data is and is not stored', body: `Stop Biting stores the following data locally on your device: bite count statistics (number of detections per session), streak data (consecutive days without biting), and session logs used to generate the 7-day frequency chart. None of this data includes video, images, or biometric data. It is equivalent to a manual tally in a notebook — counts and timestamps, not recordings.\n\nThis data is stored in a local SQLite database. It is not synced to any cloud service, not accessible to the app's servers, and is deleted permanently when the app is uninstalled. Your Google account is used only for authentication (to verify your subscription status) and does not store any habit data.` },
      { heading: 'The camera permission question', body: `Stop Biting requests camera permission, as any webcam-based application must. On macOS, Windows, and in the browser, this permission can be revoked at any time through system privacy settings. The app cannot access the camera without active permission.\n\nImportantly, granting camera permission does not mean your camera feed is being recorded or transmitted — it means the application has access to the camera stream for local processing. The distinction between access and transmission is the key architectural fact. MediaPipe receives each frame as a JavaScript object, performs landmark detection, and discards the frame. No frame is written to disk or sent over the network.` },
      { heading: 'How to verify the privacy claims yourself', body: `Independent verification is straightforward. Open your browser's Developer Tools (F12), navigate to the Network tab, and start a Stop Biting session. Filter network requests by "Media" or "WebSocket." During normal detection operation, you will see no camera-related traffic. The only outgoing requests will be to the authentication API (to verify your session token) — not camera data.\n\nFor desktop app users, tools like Little Snitch (macOS) or GlassWire (Windows) provide real-time network monitoring and will similarly show no camera-related outbound traffic during app operation. Privacy claims that can be independently verified by users are meaningfully different from privacy policies that must be taken on trust.` },
    ],
    'nail-biting-during-sleep': [
      { heading: 'Can nail biting happen during sleep?', body: `Sleep-related nail biting does occur in a subset of nail biters, though it is less common than waking nail biting and often goes unnoticed. Unlike waking nail biting, which involves purposeful hand-to-mouth movements, sleep-related nail biting typically occurs during light sleep stages (NREM stage 1 and 2) and during sleep-wake transitions, when motor inhibition is incomplete.\n\nDaytime nail biters who also bite during sleep often notice the evidence indirectly: nails that appear more damaged in the morning than they remember from the previous evening, cuticle soreness upon waking, or sleep partners who have observed the behavior. Without a deliberate attempt to monitor for it, sleep nail biting can account for a meaningful proportion of overall nail damage while remaining invisible to the person's waking awareness.` },
      { heading: 'What causes nail biting during sleep?', body: `Sleep-related nail biting has several proposed mechanisms. First, habitual automaticity: deeply encoded habits can be expressed during light sleep, when the habit circuitry in the basal ganglia operates without the inhibitory oversight of the fully conscious prefrontal cortex. The same mechanism underlies sleep talking, sleep walking, and other parasomnias.\n\nSecond, stress and anxiety: elevated cortisol levels and autonomic arousal — associated with high-stress periods — are linked to increased parasomnias and motor activity during sleep. Third, dental and oral factors: individuals with bruxism (sleep teeth grinding) appear to have elevated rates of sleep-related oral behaviors generally, suggesting a shared neurological propensity for oral motor activity during sleep.` },
      { heading: 'How to tell if you are biting during sleep', body: `Several indicators suggest sleep nail biting: nails that are shorter or more damaged in the morning than expected given recalled waking behavior; cuticle soreness or raw skin around the nails upon waking; reports from a sleep partner; or nail damage that cannot be accounted for by recalled waking behavior even with careful daytime monitoring.\n\nFor definitive identification, brief video monitoring during sleep — using a phone camera set to record for the first few hours after sleep onset — can capture the behavior directly. Finding sleep nail biting does not require treatment unless it is contributing to significant nail damage or causing sleep disruption.` },
      { heading: 'How to address sleep nail biting', body: `Physical barriers are the most effective intervention for sleep nail biting because behavioral awareness-based approaches cannot operate during sleep. Finger cots or gloves worn during sleep physically prevent the fingers from reaching the mouth in the habitual way. Bitter-tasting nail preparations applied before sleep provide aversive conditioning if the fingers do reach the mouth. Nail glue or acrylic overlays reduce the sensory reward of biting by altering the surface texture.\n\nAddressing underlying anxiety and improving sleep hygiene reduces the sleep arousal that facilitates sleep-related motor behaviors generally. Consistent sleep-wake timing, reducing alcohol consumption (which fragments sleep architecture and increases parasomnias), and stress management practices before bed all reduce the propensity for motor activity during light sleep.` },
    ],
    'bitter-nail-polish-review': [
      { heading: 'How does bitter nail polish work?', body: `Bitter nail preparations — the most well-known being Mavala Stop, Orly No Bite, Control-It, and Thum — contain denatonium benzoate, the most bitter substance known to science, detectable at concentrations as low as 10 parts per billion. Applied to the nails and allowed to dry, these preparations transfer an intensely bitter taste to the mouth whenever the fingers enter — interrupting the biting behavior through aversive conditioning.\n\nThe mechanism is technically that of classical aversive conditioning: a previously neutral stimulus (the nail entering the mouth) becomes associated with an unpleasant outcome (intensely bitter taste), reducing the probability of the behavior. This is distinct from the awareness-based mechanism of HRT — bitter polish works even without conscious awareness of the biting event, making it useful as an adjunct to awareness-based approaches.` },
      { heading: 'What does the evidence say?', body: `Clinical evidence for bitter nail preparations as a standalone treatment is modest. A Cochrane review of interventions for nail biting found that while bitter preparations produce short-term reductions in biting behavior, the evidence base is limited by small sample sizes and methodological heterogeneity. Real-world effectiveness is further constrained by compliance issues: the preparations wash off with hand washing, require daily reapplication, and are often forgotten or skipped.\n\nHowever, as an adjunct to HRT — particularly in the first 4–8 weeks when the competing response habit is not yet established — bitter preparations provide a useful secondary layer of interruption. The combination of HRT plus bitter preparation consistently outperforms either alone in head-to-head comparisons.` },
      { heading: 'Who benefits most from bitter nail polish?', body: `Bitter nail preparations work best for three specific groups. First, mild habitual nail biters whose habit is not deeply encoded and who respond to aversive feedback. For this group, a bitter preparation alone may be sufficient to break the habit, particularly if used consistently for 4–8 weeks.\n\nSecond, children aged 7–14, for whom the strong aversive feedback is more effective and for whom awareness-based protocols are harder to implement consistently. Third, motivated adults using HRT who want an additional behavioral safeguard during the early phase of treatment, before the competing response is sufficiently established to reliably override the automatic habit.` },
      { heading: 'Why bitter polish alone often fails for established habits', body: `For nail biters with established, automatic habits, bitter preparations frequently fail as a standalone treatment for a predictable reason: the behavior is executed below the threshold of conscious awareness, and the aversive taste arrives after the bite has already begun. The automatic habit chain — cue, hand movement, mouth contact, bite — is interrupted only at the last step. This late-stage interruption is less effective than early-stage interruption.\n\nAdditionally, many nail biters habituate to the bitterness over time, particularly if they are consuming the substance repeatedly throughout the day. For established habits, bitter preparations are best understood as a supplementary tool rather than a primary intervention.` },
    ],
    'nail-biting-genetics': [
      { heading: 'Does nail biting run in families?', body: `Nail biting does cluster in families, and the question of whether this reflects genetic transmission, modelling (children observing and imitating parental behavior), or shared environmental stress is an active area of research. The evidence points to a meaningful genetic contribution, though the full picture involves all three factors.\n\nFamily studies consistently find that nail biters are more likely to have at least one first-degree relative who also bites their nails — with estimates of familial clustering ranging from 2.5x to 4x the population base rate.` },
      { heading: 'What twin studies reveal about heritability', body: `Twin studies — which compare the concordance rates of a trait in identical (monozygotic) twins, who share 100% of their genes, versus fraternal (dizygotic) twins, who share 50% — provide the clearest evidence for genetic versus environmental contributions. Multiple twin studies of BFRBs find heritability estimates of 30–45% for BFRB behaviors generally.\n\nThis means that approximately 30–45% of the variation in BFRB risk across the population is attributable to genetic differences, with the remaining 55–70% attributable to environmental factors. A heritability of 40% places nail biting in the "moderately heritable" category — more heritable than most personality traits, less heritable than height or IQ.` },
      { heading: 'What genes are involved?', body: `The genetic architecture of nail biting and BFRBs generally is complex — involving many genes of small individual effect rather than a single "nail biting gene." Genome-wide association studies of OCD-spectrum disorders have identified several candidate loci, including genes involved in serotonergic signalling, glutamate regulation, and corticostriatal circuitry.\n\nOf particular interest are variants in the SAPAP3 gene, which encodes a postsynaptic scaffolding protein in corticostriatal synapses. Mouse models with SAPAP3 mutations show excessive repetitive self-grooming behaviors that closely parallel human BFRBs. SLC1A1, a glutamate transporter gene, has also been associated with OCD-spectrum behaviors in multiple cohorts.` },
      { heading: 'Does having a genetic risk mean you cannot stop?', body: `No. Genetic risk factors are probabilistic — they increase likelihood, not certainty. Having a genetic predisposition to nail biting means you are more likely to develop the habit under triggering conditions, and may find it somewhat more persistent once established, but it does not determine outcome. The 55–70% of nail biting variance that is environmental means that environmental interventions have substantial leverage even in genetically predisposed individuals.\n\nThe most useful framing of genetic risk is as explanation rather than limitation: understanding that one's nail biting has a meaningful inherited component can reduce self-blame and set more realistic expectations about treatment timeline. It does not change the treatment approach — HRT remains equally effective regardless of genetic predisposition.` },
      { heading: 'Implications for parents of nail-biting children', body: `For parents who themselves bite their nails, the 30–45% heritability figure has a practical implication: their children are at elevated risk of developing nail biting, making early environmental intervention more valuable. The behavioral modelling component is also real — children do learn nail biting partly by observing caregivers — making parental habit change doubly impactful.\n\nFor parents concerned about genetic transmission, the best evidence suggests that low-stress parenting environments, secure attachment, and avoidance of punitive responses to early nail biting substantially reduce the probability that genetic predisposition translates into established habit.` },
    ],
    'mediapipe-ai-detection-explained': [
      { heading: 'What is MediaPipe and why does it matter?', body: `MediaPipe is an open-source machine learning framework developed by Google Research, designed for real-time perception tasks — detecting, tracking, and understanding objects in camera streams. Originally developed for Google's own products (Pixel's portrait mode, Google Meet's background blur), it was open-sourced in 2019 and has become the dominant framework for on-device computer vision in web and mobile applications.\n\nThe key property that makes MediaPipe relevant for a nail biting detection app is its speed and its architecture: all models run locally on the user's device, with no cloud dependency, achieving 30–60 frames per second on standard consumer hardware.` },
      { heading: 'The two models used for detection', body: `Stop Biting uses two MediaPipe models in combination. The hand landmark model detects and tracks the hand in the camera frame, identifying 21 keypoints — fingertips, knuckle joints, wrist — with sub-centimetre accuracy. The face mesh model detects 468 facial landmarks including the precise location of the lips, mouth corners, and chin.\n\nThe detection logic computes the geometric distance between the fingertip landmarks and the mouth landmark cluster in real time. When this distance falls below a calibrated threshold — meaning the fingers are within typical nail-biting proximity of the mouth — the detection event fires. The threshold is designed to minimize both false positives and false negatives.` },
      { heading: 'WebAssembly: why the models run so fast', body: `MediaPipe's models are compiled to WebAssembly (WASM), a binary instruction format that executes at near-native speed in web browsers and Node.js environments. WASM provides roughly 50–80% of native C++ performance in the browser — fast enough to run both landmark detection models simultaneously at 30+ frames per second on a standard laptop.\n\nThe WASM binary includes SIMD (Single Instruction Multiple Data) optimizations for compatible CPUs, allowing multiple pixel operations to be performed in parallel in a single instruction cycle. The app includes both SIMD and non-SIMD WASM builds, selecting the appropriate version based on the browser's capability detection.` },
      { heading: 'Model size and loading time', body: `The face landmark model is approximately 3.9MB, and the hand landmark model is approximately 8.4MB. Both are loaded from local storage (bundled with the app) rather than from the network during each session. First-load time for model initialization is typically 1–3 seconds on modern hardware; subsequent loads use cached models and are near-instantaneous.\n\nThe WASM runtime itself adds approximately 6MB of runtime payload. Total cold-start overhead (loading WASM + both models) is typically under 5 seconds, after which detection runs continuously at full frame rate.` },
      { heading: 'Accuracy and detection limitations', body: `MediaPipe's hand and face landmark models are trained on diverse datasets and perform well across skin tones, lighting conditions, and camera angles. However, detection accuracy degrades in specific conditions: very low light, extreme camera angles (more than 45° off-axis from the face), and partial occlusion of the hand.\n\nThe most common source of false positives is touching the face in the mouth-adjacent area without biting — scratching the chin, resting a hand on the cheek, or eating. Users typically calibrate their mental model of the detection system within the first few sessions. False negatives most commonly occur when the hand approaches from below the camera frame or when lighting creates shadows that reduce landmark confidence below the detection threshold.` },
    ],
  };

  // Helper: escape HTML entities for safe server-side content injection.
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Helper: inject blog article body into the HTML as an off-screen <article> element.
  // AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not execute JavaScript and
  // therefore cannot read React-rendered body content. This injects the full article
  // text into the initial HTML response so it is visible in raw HTML.
  // The element is positioned off-screen (not display:none) so it is readable by
  // crawlers but does not appear visually before React hydrates.
  function injectBlogContent(html, { title, sections }) {
    const sectionHtml = sections.map(s => {
      const paras = s.body.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('');
      const listHtml = s.list
        ? `<ul>${s.list.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : '';
      return `<section><h2>${escapeHtml(s.heading)}</h2>${paras}${listHtml}</section>`;
    }).join('');

    const article = `<article id="ssr-blog-content" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden" aria-hidden="true"><h1>${escapeHtml(title)}</h1>${sectionHtml}</article>`;
    return html.replace('<div id="root">', `${article}<div id="root">`);
  }

  // Helper: inject page-specific <title>, <meta description>, <link canonical>,
  // and Open Graph tags into the SPA index.html shell before sending it.
  // This makes critical SEO elements visible to Googlebot and AI crawlers.
  function injectMeta(html, { title, description, canonical }) {
    return html
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${description}"`)
      .replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${canonical}"`)
      .replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${title}"`)
      .replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${description}"`)
      .replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${canonical}"`);
  }

  // Helper: inject BlogPosting + BreadcrumbList JSON-LD schemas into the <head>.
  // AI crawlers and Googlebot do not execute JavaScript, so useEffect-injected
  // schemas are invisible to them. Server-side injection ensures all crawlers
  // see correct structured data in the initial HTML response.
  function injectBlogSchemas(html, { slug, title, description, canonical }) {
    const dates = BLOG_DATES[slug] ?? {};
    const blogPosting = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      description,
      url: canonical,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      datePublished: dates.datePublished,
      dateModified: dates.dateModified,
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
    const sections = BLOG_SECTIONS_DATA[slug];
    if (sections) {
      injected = injectBlogContent(injected, { title: meta.title, sections });
    }
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
