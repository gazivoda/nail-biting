// WS8: more ways to sign in. Emailed link, Sign in with Apple, Sign in with
// Microsoft. Google stays where it is, in server.js.
//
// Flags (all default off): signin_magic_link, signin_apple, signin_microsoft.
// A provider is also only offered once its environment variables are present.
//
//   GET  /auth/providers                    which of the three are usable now (booleans only; not under /api/, see below)
//   POST /api/auth/magic-link/request       {email}  -> always {ok:true}; sends the link
//   POST /api/auth/magic-link/verify        {token}  -> starts the session   (JSON only)
//   GET  /api/auth/apple                    redirect to Apple
//   POST /auth/apple/callback               Apple's form_post return (NOT under /api/, see below); parks the result
//   GET  /api/auth/apple/finish             same-site second hop: checks the cookie, completes the sign-in
//   GET  /api/auth/microsoft                redirect to Microsoft
//   GET  /api/auth/microsoft/callback       Microsoft's return
//   GET  /signin                            the sign-in page (the SPA shell); 404 while all flags are off
//   GET  /.well-known/apple-developer-domain-association.txt   only when APPLE_DOMAIN_VERIFICATION is set
//
// Why Apple's callback is not under /api/: Apple posts back from appleid.apple.com,
// and the browser sends `Origin: https://appleid.apple.com` with that POST. The
// /api/ CORS middleware in server.js rejects unknown origins with an error, so a
// callback under /api/ would never run. /auth/apple/callback sits outside it and
// is protected by state + nonce + a binding cookie instead.
//
// See docs/agents/ws8-notes.md for the security reasoning and the owner's setup steps.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { sendWelcomeEmail, sendAdminNotification } from '../../email.js';
import { AUTH_MIGRATIONS } from '../auth/schema.js';
import { normalizeEmail } from '../auth/emailAddress.js';
import { createAccounts } from '../auth/accounts.js';
import { appleAssertion, microsoftAssertion } from '../auth/linkPolicy.js';
import { createMagicLinkStore } from '../auth/magicLink.js';
import { buildMagicLinkEmail } from '../auth/magicLinkEmail.js';
import { createOAuthStateStore } from '../auth/oauthState.js';
import { completeSignIn, failureRedirect, clientIp, sameOriginOk, safeEqual } from '../auth/session.js';
import {
  appleConfigFromEnv, buildAuthorizeUrl as appleAuthorizeUrl, createAppleClient, parseAppleUserName,
} from '../auth/apple.js';
import {
  microsoftConfigFromEnv, buildAuthorizeUrl as microsoftAuthorizeUrl, createMicrosoftClient,
  createPkcePair, microsoftSubject,
} from '../auth/microsoft.js';

const SIGNIN_FLAGS = ['signin_magic_link', 'signin_apple', 'signin_microsoft'];
const APPLE_CALLBACK_PATH = '/auth/apple/callback';
// Under /api/ on purpose: the service worker's navigation fallback (vite.config.ts) skips /api/, so
// this GET reaches the server instead of being answered with the cached app shell. It is a plain
// navigation after a 303, so it carries no Origin header and passes the /api/ CORS check.
const APPLE_FINISH_PATH = '/api/auth/apple/finish';
const APPLE_DOMAIN_PATH = '/.well-known/apple-developer-domain-association.txt';
const MICROSOFT_CALLBACK_PATH = '/api/auth/microsoft/callback';
const STATE_COOKIE_MS = 10 * 60 * 1000;
const DEFAULT_SHELL_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist', 'index.html');

/**
 * The sign-in page is the app's own HTML shell (React renders it). Served with
 * noindex and no canonical, and with a tiny script FIRST in <head> that moves the
 * emailed token out of the URL fragment (#t=...) into a page variable and clears
 * the address bar before analytics or anything else can read it.
 */
export function prepareSigninShell(html) {
  const mover = "<script>(function(){var h=location.hash;if(h.indexOf('#t=')===0){window.__sbMagicToken=h.slice(3);history.replaceState(null,'',location.pathname+location.search);}})();</script>";
  let out = html
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/i, '')
    .replace(/<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex, nofollow">');
  if (!/<meta\s+name=["']robots["']/i.test(out)) out = out.replace(/<\/head>/i, '<meta name="robots" content="noindex, nofollow"></head>');
  return /<head[^>]*>/i.test(out) ? out.replace(/<head[^>]*>/i, m => `${m}${mover}`) : mover + out;
}

export function registerAuthProviders(ctx, deps = {}) {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? console.error;
  const welcome = deps.sendWelcomeEmail ?? sendWelcomeEmail;
  const notifyAdmin = deps.sendAdminNotification ?? sendAdminNotification;
  const shellPath = deps.shellPath ?? DEFAULT_SHELL_PATH;

  const { app, db, flags, requireFeature } = ctx;
  const port = env.PORT || 3000;
  // server.js always supplies both; the fallbacks keep a bare test context bootable.
  const config = { ELECTRON_PROTOCOL: null, ...ctx.config, APP_URL: ctx.config?.APP_URL || `http://localhost:${port}` };
  const accounts = createAccounts({ db, getUser: ctx.getUser, saveUser: ctx.saveUser, now });
  const magic = createMagicLinkStore(db, { now });
  const states = createOAuthStateStore(db, { now });

  const appleCfg = appleConfigFromEnv(env);
  const appleClient = appleCfg ? (deps.appleClient ?? createAppleClient({ cfg: appleCfg, fetchImpl, now })) : null;
  const msCfg = microsoftConfigFromEnv(env);
  const msClient = msCfg ? (deps.microsoftClient ?? createMicrosoftClient({ cfg: msCfg, fetchImpl, now })) : null;
  const emailConfigured = () => !!env.RESEND_API_KEY?.trim();

  const anyFlagOn = () => SIGNIN_FLAGS.some(f => flags.isOn(f));
  const available = () => ({
    magic_link: flags.isOn('signin_magic_link') && emailConfigured(),
    apple: flags.isOn('signin_apple') && !!appleCfg,
    microsoft: flags.isOn('signin_microsoft') && !!msCfg,
  });

  const secureCookies = config.APP_URL.startsWith('https');
  // Same rule as the Google flow: with ELECTRON_PROTOCOL the redirect URI is the local server's.
  const microsoftRedirectUri = config.ELECTRON_PROTOCOL
    ? `http://localhost:${port}${MICROSOFT_CALLBACK_PATH}`
    : `${config.APP_URL}${MICROSOFT_CALLBACK_PATH}`;
  const appleRedirectUri = `${config.APP_URL}${APPLE_CALLBACK_PATH}`; // Apple requires https on a verified domain

  const limiter = (windowMs, max) => rateLimit({
    windowMs, max, standardHeaders: true, legacyHeaders: false,
    keyGenerator: req => ipKeyGenerator(clientIp(req)),
    validate: false,
    message: { error: 'too_many_requests' },
  });
  const requestLimiter = limiter(60 * 60 * 1000, 20);   // 20 links an hour per address of the caller
  const verifyLimiter = limiter(10 * 60 * 1000, 30);
  const callbackLimiter = limiter(10 * 60 * 1000, 60);
  const providersLimiter = limiter(10 * 60 * 1000, 120);

  const notFound = (_req, res) => res.status(404).json({ error: 'Not found' });

  function afterSignIn(result) {
    if (!result.isNewUser) return;
    const { user } = result;
    // Same emails the Google callback sends for a new account.
    if (user.email) welcome(user).catch(err => log('[email] welcome failed:', err));
    notifyAdmin(user).catch(err => log('[email] admin notification failed:', err));
  }

  function stateCookieName(provider) { return `sb_oauth_${provider}`; }
  function setStateCookie(res, provider, state, path) {
    if (config.ELECTRON_PROTOCOL) return; // the desktop app starts the flow in a different browser; same as Google's
    res.cookie(stateCookieName(provider), state, {
      httpOnly: true,
      maxAge: STATE_COOKIE_MS,
      secure: secureCookies,
      sameSite: 'lax', // Apple's cross-site POST is handled in two hops so Lax is enough (see the Apple routes)
      path,
    });
  }
  function stateBindingOk(req, provider, state) {
    if (config.ELECTRON_PROTOCOL) return true;
    return safeEqual(req.cookies?.[stateCookieName(provider)], state);
  }

  // ── What can this visitor use? ──────────────────────────────────────────────
  // Deliberately NOT under /api/: marketing pages call this on every visit, and
  // everything under /api/ counts against server.js's shared rate limits (100 per
  // 15 minutes for /api/, 10 per minute for /api/auth/). Behind a proxy that
  // counts every visitor as one client, so these calls could use up the budget
  // that real sign-ins and /api/user/me need. It has its own, per-caller limit.
  app.get('/auth/providers', providersLimiter, (_req, res) => {
    if (!anyFlagOn()) return notFound(_req, res);
    res.set('Cache-Control', 'public, max-age=60');
    res.json(available());
  });

  // ── Emailed link ────────────────────────────────────────────────────────────
  // One door for new and returning people: a valid address always gets a link, so
  // the response can never reveal whether an account exists.
  app.post('/api/auth/magic-link/request', requireFeature('signin_magic_link'), requestLimiter, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!emailConfigured()) return notFound(req, res);
    if (!sameOriginOk(req, config)) return res.status(403).json({ error: 'forbidden' });
    if (!req.is('application/json')) return res.status(400).json({ error: 'bad_request' });
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'invalid_email' });

    // Over the per-address limit: answer exactly as if it had been sent.
    if (magic.checkEmailAllowance(email).allowed) {
      const { token } = magic.issue({ email, ip: clientIp(req) });
      try {
        // The Resend SDK does not throw on an API error (bad key, unverified sender
        // domain, rejected address): it returns { data: null, error }. Treat that as a failure.
        const result = await ctx.sendEmail({ to: email, ...buildMagicLinkEmail({ appUrl: config.APP_URL, token }) });
        if (result?.error) throw new Error(result.error.message || result.error.name || 'email provider error');
      } catch (err) {
        log('[auth] magic link email failed:', err?.message);
        return res.status(502).json({ error: 'send_failed' });
      }
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/magic-link/verify', requireFeature('signin_magic_link'), verifyLimiter, (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!sameOriginOk(req, config)) return res.status(403).json({ error: 'forbidden' });
    if (!req.is('application/json')) return res.status(400).json({ error: 'bad_request' });

    const spent = magic.consume(req.body?.token);
    if (!spent.ok) {
      return res.status(spent.reason === 'invalid' ? 400 : 410).json({ ok: false, reason: spent.reason });
    }
    const result = accounts.signIn({
      provider: 'email',
      subject: spent.email,
      assertion: { email: spent.email, verified: true }, // the link was delivered to this address
      profile: {},
    });
    afterSignIn(result);
    const redirect = completeSignIn({ signToken: ctx.signToken, config, res, userId: result.user.id });
    res.json({ ok: true, redirect });
  });

  // ── Apple ───────────────────────────────────────────────────────────────────
  // Apple returns by POSTing a form from appleid.apple.com. That request is a
  // cross-site POST, where browsers do not send SameSite=Lax cookies (and may not
  // accept them from the response). So the return is handled in two hops:
  //   1. POST /auth/apple/callback   parks what Apple sent against our `state`
  //                                  (database row, not a URL) and 303-redirects to
  //   2. GET  /api/auth/apple/finish an ordinary same-site GET, where the binding
  //                                  cookie is checked and the sign-in completes.
  app.get('/api/auth/apple', requireFeature('signin_apple'), (req, res) => {
    if (!appleCfg) return notFound(req, res);
    const { state, nonce } = states.create({ provider: 'apple' });
    setStateCookie(res, 'apple', state, '/api/auth/apple');
    res.redirect(appleAuthorizeUrl(appleCfg, { redirectUri: appleRedirectUri, state, nonce }));
  });

  app.post(
    APPLE_CALLBACK_PATH,
    requireFeature('signin_apple'),
    callbackLimiter,
    express.urlencoded({ extended: false, limit: '16kb' }),
    (req, res) => {
      if (!appleCfg) return notFound(req, res);
      const { code, state, error, user: userField } = req.body ?? {};
      // Apple sends the name only with the first authorization, in a form field the browser carries.
      const parked = states.attach(state, 'apple', { code, name: parseAppleUserName(userField), error });
      if (!parked) return res.redirect(303, failureRedirect(config, 'state_mismatch'));
      res.redirect(303, `${config.APP_URL}${APPLE_FINISH_PATH}?${new URLSearchParams({ state })}`);
    },
  );

  app.get(APPLE_FINISH_PATH, requireFeature('signin_apple'), callbackLimiter, async (req, res) => {
    const fail = (code, extra) => res.redirect(failureRedirect(config, code, extra));
    if (!appleCfg) return notFound(req, res);
    res.set('Referrer-Policy', 'no-referrer');
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    const pending = states.consume(state, 'apple'); // single use, consumed whatever happens next
    res.clearCookie(stateCookieName('apple'), { path: '/api/auth/apple' });
    if (!pending || !pending.attached || !stateBindingOk(req, 'apple', state)) return fail('state_mismatch');
    if (pending.providerError || !pending.authCode) {
      return fail(pending.providerError === 'user_cancelled_authorize' ? 'cancelled' : 'no_code');
    }

    try {
      const claims = await appleClient.exchangeCode({ code: pending.authCode, redirectUri: appleRedirectUri, nonce: pending.nonce });
      const result = accounts.signIn({
        provider: 'apple',
        subject: claims.sub,
        assertion: appleAssertion(claims),
        profile: { name: pending.profileName },
      });
      if (result.status !== 'ok') return fail('email_unverified', { provider: 'apple' });
      afterSignIn(result);
      return res.redirect(completeSignIn({ signToken: ctx.signToken, config, res, userId: result.user.id }));
    } catch (err) {
      log('[auth] apple callback failed:', err?.code ?? err?.message);
      return fail('callback_failed');
    }
  });

  // ── Microsoft ───────────────────────────────────────────────────────────────
  app.get('/api/auth/microsoft', requireFeature('signin_microsoft'), (req, res) => {
    if (!msCfg) return notFound(req, res);
    const pkce = createPkcePair();
    const { state, nonce } = states.create({ provider: 'microsoft', codeVerifier: pkce.verifier });
    setStateCookie(res, 'microsoft', state, '/api/auth/microsoft');
    res.redirect(microsoftAuthorizeUrl(msCfg, { redirectUri: microsoftRedirectUri, state, nonce, challenge: pkce.challenge }));
  });

  app.get(MICROSOFT_CALLBACK_PATH, requireFeature('signin_microsoft'), callbackLimiter, async (req, res) => {
    const fail = (code, extra) => res.redirect(failureRedirect(config, code, extra));
    if (!msCfg) return notFound(req, res);
    const { code, state, error } = req.query;

    const pending = states.consume(typeof state === 'string' ? state : '', 'microsoft');
    res.clearCookie(stateCookieName('microsoft'), { path: '/api/auth/microsoft' });
    if (!pending || !stateBindingOk(req, 'microsoft', state)) return fail('state_mismatch');
    if (error || typeof code !== 'string' || !code) {
      return fail(error === 'access_denied' ? 'cancelled' : 'no_code');
    }

    try {
      const claims = await msClient.exchangeCode({
        code, redirectUri: microsoftRedirectUri, codeVerifier: pending.codeVerifier, nonce: pending.nonce,
      });
      const assertion = microsoftAssertion(claims);
      const result = accounts.signIn({
        provider: 'microsoft',
        subject: microsoftSubject(claims),
        assertion,
        profile: { name: typeof claims.name === 'string' ? claims.name.slice(0, 100) : null },
      });
      // An address Microsoft does not vouch for belongs to an existing account: do not join it.
      if (result.status !== 'ok') return fail('email_unverified', { provider: 'microsoft' });
      afterSignIn(result);
      return res.redirect(completeSignIn({ signToken: ctx.signToken, config, res, userId: result.user.id }));
    } catch (err) {
      log('[auth] microsoft callback failed:', err?.code ?? err?.message);
      return fail('callback_failed');
    }
  });

  // ── Apple domain verification ───────────────────────────────────────────────
  // Apple makes the owner prove the domain by serving a file at this exact path
  // before it accepts a Return URL. server.js's static handler ignores dot
  // directories (express.static default), so a file in public/.well-known would
  // 404. The owner pastes the file's contents into APPLE_DOMAIN_VERIFICATION; with
  // it unset the route does not exist. Not behind the flag on purpose: the owner
  // needs it live BEFORE registering with Apple, and it exposes nothing but that text.
  app.get(APPLE_DOMAIN_PATH, (_req, res, next) => {
    const body = env.APPLE_DOMAIN_VERIFICATION;
    if (typeof body !== 'string' || body.trim() === '') return next();
    res.set('Cache-Control', 'public, max-age=300').type('text/plain').send(body);
  });

  // ── The page ────────────────────────────────────────────────────────────────
  // Serving this never consumes anything: the emailed token lives in the URL
  // fragment (never sent to a server) and is only spent by an explicit button
  // press that POSTs it. A mail scanner that opens the link spends nothing.
  let shell = null;
  app.get('/signin', (_req, res, next) => {
    if (!anyFlagOn()) return next(); // falls through to the normal 404
    try {
      shell ??= prepareSigninShell(readFileSync(shellPath, 'utf8'));
    } catch {
      return next(); // no build output (dev server: Vite serves /signin itself)
    }
    res.set({
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    });
    res.type('html').send(shell);
  });
}

export default {
  name: 'authProviders',
  migrations: AUTH_MIGRATIONS,
  register: ctx => registerAuthProviders(ctx),
};
