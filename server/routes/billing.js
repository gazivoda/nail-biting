// WS9: lifetime plan, gift purchases, referrals, free tier. The module that plugs the logic in
// server/billing/ into the app. Everything user-visible is behind a flag; the webhook hooks work
// whenever the matching Paddle price id is configured (money that was taken is always honoured).
//
// Flags: free_tier, lifetime_plan, gift_plan, referrals (regional_pricing is client-only).
//
//   GET  /api/referrals/me                 [referrals]   my code, my link, how it is going
//   POST /api/referrals/attach             [referrals]   {code}  tie a new account to the link that brought it
//   GET  /api/billing/gift-info            [gift_plan]   {days}  how long one gift lasts (public; the site words its copy from it)
//   POST /api/billing/gift/redeem          [gift_plan]   {code}  add a gift to my account (once per code)
//   POST /api/billing/verify-transaction   [lifetime_plan] {transactionId}  grant a lifetime purchase right away
//   GET  /redeem                           [gift_plan]   the app shell for the redeem page (noindex); 404 while off
//
// It also installs two things on `app.locals` for the existing server.js handlers (set when the server
// boots, read when a request arrives):
//   app.locals.billingWebhook.take(event, res)   called by POST /api/paddle/webhook after the signature check
//   app.locals.decorateUser(user)                called by GET /api/user/me
//
// See docs/agents/ws9-notes.md for the design, the env vars and the owner's steps.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { sendEmail as defaultSendEmail } from '../../email.js';
import { TRIAL_DAYS, trialDaysProblem } from '../../shared/plans.js';
import { clientIp } from '../auth/session.js';
import { billingConfig, priceIdsMissingFromFilter, subscriptionPricesKnown } from '../billing/config.js';
import { createEntitlements } from '../billing/entitlements.js';
import { createGifts } from '../billing/gift.js';
import { buildGiftEmail } from '../billing/giftEmail.js';
import { createPurchases } from '../billing/purchases.js';
import { createReferrals } from '../billing/referrals.js';
import { BILLING_MIGRATIONS } from '../billing/schema.js';
import { createUserDecorator } from '../billing/userDecorator.js';
import { createBillingWebhook } from '../billing/webhook.js';

const DEFAULT_SHELL_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist', 'index.html');

/**
 * The redeem page is the app's own HTML shell (React renders it): not indexable, no canonical, and a tiny
 * script FIRST in <head> that moves the gift code out of the URL fragment (#code=...) into a page variable
 * and clears the address bar before analytics or anything else can read it.
 */
export function prepareRedeemShell(html) {
  const mover = "<script>(function(){var h=location.hash;if(h.indexOf('#code=')===0){window.__sbGiftCode=h.slice(6);history.replaceState(null,'',location.pathname+location.search);}})();</script>";
  let out = html
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/i, '')
    .replace(/<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex, nofollow">');
  if (!/<meta\s+name=["']robots["']/i.test(out)) out = out.replace(/<\/head>/i, '<meta name="robots" content="noindex, nofollow"></head>');
  return /<head[^>]*>/i.test(out) ? out.replace(/<head[^>]*>/i, m => `${m}${mover}`) : mover + out;
}

/**
 * Warnings the owner should see in the boot log. Returns them (and logs them) so a test can read them.
 * @returns {string[]}
 */
export function bootChecks({ env = process.env, flags, shellPath = DEFAULT_SHELL_PATH, log = console.warn } = {}) {
  const out = [];
  const warn = msg => { out.push(msg); log(`[billing] ${msg}`); };

  const bad = trialDaysProblem(env.TRIAL_DAYS);
  if (bad) warn(bad);

  // The client bundle and the generated pages were built with some TRIAL_DAYS; the running server has its own.
  try {
    const shell = readFileSync(shellPath, 'utf8');
    const built = /"eligibleDuration":\s*\{[^}]*"value":\s*(\d+)/.exec(shell);
    if (built && Number(built[1]) !== TRIAL_DAYS) {
      warn(`dist was built with TRIAL_DAYS=${built[1]} but this server runs with TRIAL_DAYS=${TRIAL_DAYS}: the site copy and new accounts disagree. Set the same value as the build arg and as the runtime variable, then rebuild.`);
    }
  } catch { /* no dist (dev, tests): nothing to compare */ }

  const config = billingConfig(env);
  for (const name of priceIdsMissingFromFilter(env)) {
    warn(`PADDLE_PRICE_IDS is set but does not include ${name}. List every price id of this app there; the lifetime and gift ids too.`);
  }
  if (flags?.isOn('lifetime_plan') && !config.lifetimePriceId) warn('lifetime_plan is on but PADDLE_PRICE_ID_LIFETIME is not set: no lifetime payment can be recognised.');
  if (flags?.isOn('gift_plan') && !config.giftPriceId) warn('gift_plan is on but PADDLE_PRICE_ID_GIFT is not set: no gift payment can be recognised.');
  if (flags?.isOn('referrals') && !subscriptionPricesKnown(env)) warn('referrals is on but the server does not know the monthly and yearly price ids (set PADDLE_PRICE_IDS, or PADDLE_PRICE_ID_MONTHLY and PADDLE_PRICE_ID_YEARLY as RUNTIME variables; the VITE_ ones are build arguments): a payment is only rewarded when its price is known to be ours, so nothing will be rewarded.');
  if (flags?.isOn('gift_plan') && !config.paddleApiKey) warn('gift_plan is on but PADDLE_API_KEY is not set: the email address of a gift buyer who is not signed in cannot be looked up, so those gift emails fail and Paddle retries them until it gives up.');
  return out;
}

export function registerBilling(ctx, deps = {}) {
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? console.log;
  const logError = deps.logError ?? console.error;
  const shellPath = deps.shellPath ?? DEFAULT_SHELL_PATH;
  const { app, db, flags, requireFeature, authMiddleware } = ctx;
  const appUrl = ctx.config?.APP_URL || `http://localhost:${env.PORT || 3000}`;

  const config = billingConfig(env);
  const entitlements = createEntitlements(db, { now });
  const gifts = createGifts(db, { entitlements, giftDays: config.giftDays, expiryDays: config.giftCodeExpiryDays, now });
  const referrals = createReferrals({ db, entitlements, getUser: ctx.getUser, config, flags, now, log });
  const purchases = createPurchases({
    db, entitlements, gifts, referrals, config,
    getUser: ctx.getUser, findUserByEmail: ctx.findUserByEmail,
    sendEmail: deps.sendEmail ?? ctx.sendEmail ?? defaultSendEmail, buildGiftEmail,
    appUrl, fetchImpl: deps.fetchImpl ?? fetch, now, log, logError,
  });
  const webhook = createBillingWebhook({ db, purchases, now, log, logError });
  webhook.prune();

  app.locals.billingWebhook = webhook;
  app.locals.decorateUser = createUserDecorator({ entitlements, flags, env, now });
  app.locals.billing = { entitlements, gifts, referrals, purchases };   // for tests and later workstreams

  bootChecks({ env, flags, shellPath, log: deps.warn ?? console.warn });

  const limiter = (windowMs, max) => rateLimit({
    windowMs, max, standardHeaders: true, legacyHeaders: false,
    keyGenerator: req => ipKeyGenerator(clientIp(req)),
    validate: false,
    message: { error: 'too_many_requests' },
  });
  const redeemLimiter = limiter(15 * 60 * 1000, 10);
  const attachLimiter = limiter(60 * 60 * 1000, 20);
  const verifyLimiter = limiter(15 * 60 * 1000, 30);

  // ── Referrals ──────────────────────────────────────────────────────────────
  app.get('/api/referrals/me', requireFeature('referrals'), authMiddleware, (req, res) => {
    if (!ctx.getUser(req.userId)) return res.status(404).json({ error: 'User not found' });
    res.json(referrals.summaryFor(req.userId, appUrl));
  });

  app.post('/api/referrals/attach', requireFeature('referrals'), authMiddleware, attachLimiter, (req, res) => {
    const code = req.body?.code;
    if (typeof code !== 'string') return res.status(400).json({ error: 'code is required' });
    const result = referrals.attach({ userId: req.userId, code });
    // A refusal is an answer, not a failure: the app just forgets the stored code.
    res.json(result);
  });

  // ── Gifts ──────────────────────────────────────────────────────────────────
  app.get('/api/billing/gift-info', requireFeature('gift_plan'), (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ days: config.giftDays });
  });

  app.post('/api/billing/gift/redeem', requireFeature('gift_plan'), authMiddleware, redeemLimiter, (req, res) => {
    const code = req.body?.code;
    if (typeof code !== 'string') return res.status(400).json({ error: 'code is required' });
    if (!ctx.getUser(req.userId)) return res.status(404).json({ error: 'User not found' });
    const result = gifts.redeem({ userId: req.userId, code });
    if (result.ok) log(`[billing] gift redeemed by ${req.userId}`);
    res.json(result);
  });

  app.get('/redeem', (req, res, next) => {
    if (!flags.isOn('gift_plan')) return next();   // falls through to the branded 404
    let html;
    try { html = readFileSync(shellPath, 'utf8'); } catch { return next(); }
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' });
    res.type('html').send(prepareRedeemShell(html));
  });

  // ── Lifetime ───────────────────────────────────────────────────────────────
  app.post('/api/billing/verify-transaction', requireFeature('lifetime_plan'), authMiddleware, verifyLimiter, async (req, res) => {
    const transactionId = req.body?.transactionId;
    if (typeof transactionId !== 'string' || !/^txn_[A-Za-z0-9]+$/.test(transactionId)) return res.status(400).json({ error: 'transactionId is required' });
    try {
      const result = await purchases.verifyTransaction({ userId: req.userId, transactionId });
      if (result.ok) return res.json(result);
      // Not completed yet: the webhook will do it; tell the client to keep polling.
      return res.status(result.reason === 'not_completed' ? 202 : 409).json(result);
    } catch (err) {
      logError('[billing] verify-transaction failed:', err.message);
      res.status(502).json({ error: 'Failed to verify the payment with Paddle' });
    }
  });
}

export default {
  name: 'billing',
  migrations: BILLING_MIGRATIONS,
  register(ctx) { registerBilling(ctx); },
};
