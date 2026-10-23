// HTTP-level tests for the WS8 sign-in routes: flag gating, the emailed link end
// to end, Apple and Microsoft callbacks against mocked providers, and "two
// methods, one account". Real providers and real email are NOT involved.

import { describe, it, expect, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ALL_FLAGS, cookieHeader, cookiesFrom, fakeFetch, makeHarness, makeSigningKey, postJson, seedUser,
} from '../../test-utils/authHarness.js';
import { ROUTE_MODULES } from './index.js';
import { prepareSigninShell } from './authProviders.js';
import { APPLE_ISSUER } from '../auth/apple.js';
import { MS_PERSONAL_TENANT } from '../auth/linkPolicy.js';

const APP = 'http://localhost:5199';
const GOOGLE_SUB = '112233445566778899001';
const open = [];
const harness = async opts => { const h = await makeHarness(opts); open.push(h); return h; };
afterEach(async () => { while (open.length) await open.pop().close(); });

const tokenFrom = mail => /#t=([A-Za-z0-9_-]{43})/.exec(mail.text)[1];
const get = (h, path, init = {}) => fetch(`${h.url}${path}`, { redirect: 'manual', ...init });
const userCount = h => h.db.prepare('SELECT COUNT(*) AS n FROM users').get().n;

const post = (h, body, jar = {}) => fetch(`${h.url}/auth/apple/callback`, {
  method: 'POST', redirect: 'manual',
  headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader(jar), origin: 'https://appleid.apple.com' },
  body: new URLSearchParams(body).toString(),
});

/**
 * Apple's return the way a browser performs it: Apple's page POSTs the form (no
 * cookies of ours travel with it), we answer 303 to a GET on our own site, and
 * the browser follows with our Lax cookies. Returns the last response; when the
 * POST itself is refused that refusal is the result.
 */
async function appleReturn(h, body, jar = {}) {
  const first = await post(h, body, {}); // the cross-site POST carries no cookies
  const loc = first.headers.get('location') ?? '';
  if (!loc.startsWith(`${APP}/api/auth/apple/finish`)) return first;
  return get(h, loc.slice(APP.length), { headers: { cookie: cookieHeader(jar) } });
}

describe('registration', () => {
  it('the module is in the registry with its three migrations', () => {
    const mod = ROUTE_MODULES.find(m => m.name === 'authProviders');
    expect(mod).toBeTruthy();
    expect(mod.migrations.map(m => m.id)).toEqual(['ws8_001_auth_identities', 'ws8_002_magic_link_tokens', 'ws8_003_auth_oauth_states']);
  });
});

describe('with every flag off nothing exists', () => {
  const dead = [
    ['GET', '/auth/providers'],
    ['POST', '/api/auth/magic-link/request'],
    ['POST', '/api/auth/magic-link/verify'],
    ['GET', '/api/auth/apple'],
    ['POST', '/auth/apple/callback'],
    ['GET', '/api/auth/apple/finish'],
    ['GET', '/api/auth/microsoft'],
    ['GET', '/api/auth/microsoft/callback'],
    ['GET', '/signin'],
  ];
  it.each(dead)('%s %s answers 404', async (method, path) => {
    const h = await harness({
      flags: '',
      env: { APPLE_CLIENT_ID: 'c', APPLE_TEAM_ID: 't', APPLE_KEY_ID: 'k', MICROSOFT_CLIENT_ID: 'a', MICROSOFT_CLIENT_SECRET: 'b' },
    });
    const res = await fetch(`${h.url}${path}`, { method, redirect: 'manual', headers: { 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
    expect(res.status).toBe(404);
  });

  it('writes nothing to the database and sends nothing', async () => {
    const h = await harness({ flags: '' });
    await postJson(`${h.url}/api/auth/magic-link/request`, { email: 'a@example.com' });
    expect(h.db.prepare('SELECT COUNT(*) AS n FROM magic_link_tokens').get().n).toBe(0);
    expect(h.sent).toHaveLength(0);
  });

  it('one flag only enables that provider', async () => {
    const h = await harness({ flags: 'signin_magic_link' });
    expect((await get(h, '/api/auth/apple')).status).toBe(404);
    expect((await get(h, '/api/auth/microsoft')).status).toBe(404);
    expect((await postJson(`${h.url}/api/auth/magic-link/request`, { email: 'a@example.com' })).status).toBe(200);
  });
});

describe('GET /auth/providers', () => {
  const full = {
    APPLE_CLIENT_ID: 'today.stopbiting.web', APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567',
    APPLE_PRIVATE_KEY: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'pem' }),
    MICROSOFT_CLIENT_ID: 'ms-client', MICROSOFT_CLIENT_SECRET: 'ms-super-secret-value',
  };

  it('offers a provider only when its flag is on AND its variables are set; reveals no secrets', async () => {
    const h = await harness({ env: full });
    const res = await get(h, '/auth/providers');
    expect(res.status).toBe(200);
    expect(await res.clone().json()).toEqual({ magic_link: true, apple: true, microsoft: true });
    const text = await res.text();
    for (const secret of ['ms-super-secret-value', 'TEAM123456', 'KEY1234567', 'BEGIN PRIVATE KEY']) expect(text).not.toContain(secret);
    expect(res.headers.get('cache-control')).toMatch(/max-age=60/);
  });

  it('a flag on without configuration is not offered', async () => {
    const h = await harness({ flags: ALL_FLAGS, env: { RESEND_API_KEY: '' } });
    expect(await (await get(h, '/auth/providers')).json()).toEqual({ magic_link: false, apple: false, microsoft: false });
  });

  it('a configured provider whose flag is off is not offered', async () => {
    const h = await harness({ flags: 'signin_magic_link', env: full });
    expect(await (await get(h, '/auth/providers')).json()).toEqual({ magic_link: true, apple: false, microsoft: false });
  });

  it('start endpoints of an unconfigured provider answer 404 even with the flag on', async () => {
    const h = await harness({ flags: ALL_FLAGS });
    expect((await get(h, '/api/auth/apple')).status).toBe(404);
    expect((await get(h, '/api/auth/microsoft')).status).toBe(404);
  });
});

describe('emailed link', () => {
  const request = (h, email, headers) => postJson(`${h.url}/api/auth/magic-link/request`, { email }, headers);
  const verify = (h, token, headers) => postJson(`${h.url}/api/auth/magic-link/verify`, { token }, headers);

  it('gives the same answer for an address with an account and one without (no enumeration)', async () => {
    const h = await harness();
    seedUser(h.db, { id: GOOGLE_SUB, email: 'known@example.com' });
    const a = await request(h, 'known@example.com');
    const b = await request(h, 'stranger@example.com');
    expect(a.status).toBe(b.status);
    expect(await a.text()).toBe(await b.text());
    expect(h.sent.map(m => m.to)).toEqual(['known@example.com', 'stranger@example.com']);
  });

  it('answers a rate-limited address exactly like a sent one, but sends nothing', async () => {
    const clock = { t: 1_800_000_000_000 };
    const h = await harness({ deps: { now: () => clock.t } });
    const first = await request(h, 'a@example.com');
    clock.t += 1000; // inside the 30 s minimum gap
    const second = await request(h, 'a@example.com');
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual({ ok: true });
    expect(h.sent).toHaveLength(1);
  });

  it('caps links per address per hour', async () => {
    const clock = { t: 1_800_000_000_000 };
    const h = await harness({ deps: { now: () => clock.t } });
    for (let i = 0; i < 8; i++) { await request(h, 'a@example.com'); clock.t += 31_000; }
    expect(h.sent.length).toBe(5);
  });

  it('limits each caller by IP (429), whatever addresses they try', async () => {
    const h = await harness();
    let limited = 0;
    for (let i = 0; i < 24; i++) {
      const res = await request(h, `user${i}@example.com`);
      if (res.status === 429) limited++;
    }
    expect(limited).toBeGreaterThan(0);
    expect(h.sent.length).toBe(20);
  });

  it('rejects a malformed address, a non-JSON body and a foreign Origin', async () => {
    const h = await harness();
    expect((await request(h, 'not-an-email')).status).toBe(400);
    expect((await request(h, 'a@example.com\nBcc: x@y.com')).status).toBe(400);
    const form = await fetch(`${h.url}/api/auth/magic-link/request`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ email: 'a@example.com' }) });
    expect(form.status).toBe(400);
    const cross = await request(h, 'a@example.com', { origin: 'https://evil.example' });
    expect(cross.status).toBe(403);
    expect((await request(h, 'a@example.com', { origin: APP })).status).toBe(200);
    expect(h.sent).toHaveLength(1);
  });

  it('reports a send failure the same way for every address', async () => {
    const h = await harness();
    h.ctx.sendEmail = async () => { throw new Error('resend down'); };
    // the module captured ctx.sendEmail by reference to ctx, so replacing it takes effect
    const res = await request(h, 'a@example.com');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'send_failed' });
  });

  it('treats the Resend SDK\'s { error } return (it does not throw) as a failed send', async () => {
    const h = await harness();
    h.ctx.sendEmail = async () => ({ data: null, error: { name: 'validation_error', message: 'domain not verified' } });
    const res = await request(h, 'a@example.com');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'send_failed' });
    expect(h.logged.join(' ')).toMatch(/domain not verified/);
  });

  it('the email carries a one-time link with the token in the fragment', async () => {
    const h = await harness();
    await request(h, 'Ann@Example.com');
    expect(h.sent).toHaveLength(1);
    const [mail] = h.sent;
    expect(mail.to).toBe('ann@example.com');
    expect(mail.text).toContain(`${APP}/signin#t=`);
    expect(mail.text).not.toMatch(/signin\?/);
  });

  it('signing in: creates the account, sets the session cookie, welcome mail once', async () => {
    const h = await harness();
    await request(h, 'ann@example.com');
    const token = tokenFrom(h.sent[0]);

    const res = await verify(h, token, { origin: APP });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, redirect: `${APP}/` });

    const user = h.db.prepare('SELECT * FROM users').get();
    expect(user).toMatchObject({ email: 'ann@example.com', subscription_status: 'trial' });
    const setCookie = res.headers.getSetCookie().find(c => c.startsWith('nh_session='));
    expect(setCookie).toContain(encodeURIComponent(`session-for:${user.id}`));
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Max-Age=1209600/);
    expect(h.welcomed).toHaveLength(1);
  });

  it('the token works once', async () => {
    const h = await harness();
    await request(h, 'ann@example.com');
    const token = tokenFrom(h.sent[0]);
    expect((await verify(h, token)).status).toBe(200);
    const again = await verify(h, token);
    expect(again.status).toBe(410);
    expect(await again.json()).toEqual({ ok: false, reason: 'used' });
    expect(userCount(h)).toBe(1);
  });

  it('a returning person gets the same account and no second welcome mail', async () => {
    const clock = { t: 1_800_000_000_000 };
    const h = await harness({ deps: { now: () => clock.t } });
    await request(h, 'ann@example.com');
    await verify(h, tokenFrom(h.sent[0]));
    clock.t += 60_000;
    await request(h, 'ann@example.com');
    await verify(h, tokenFrom(h.sent[1]));
    expect(userCount(h)).toBe(1);
    expect(h.welcomed).toHaveLength(1);
  });

  it('an expired token is refused with "expired"', async () => {
    const clock = { t: 1_800_000_000_000 };
    const h = await harness({ deps: { now: () => clock.t } });
    await request(h, 'ann@example.com');
    clock.t += 15 * 60 * 1000 + 1;
    const res = await verify(h, tokenFrom(h.sent[0]));
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ ok: false, reason: 'expired' });
    expect(userCount(h)).toBe(0);
  });

  it('a wrong or malformed token is refused with 400 and creates nothing', async () => {
    const h = await harness();
    await request(h, 'ann@example.com');
    for (const bad of ['x'.repeat(43), 'nope', '', null, undefined, 12]) {
      const res = await verify(h, bad);
      expect(res.status).toBe(400);
      expect((await res.json()).reason).toBe('invalid');
    }
    expect(userCount(h)).toBe(0);
  });

  it('verify refuses a foreign Origin and non-JSON bodies, without spending the token', async () => {
    const h = await harness();
    await request(h, 'ann@example.com');
    const token = tokenFrom(h.sent[0]);
    expect((await verify(h, token, { origin: 'https://evil.example' })).status).toBe(403);
    const form = await fetch(`${h.url}/api/auth/magic-link/verify`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `token=${token}`,
    });
    expect(form.status).toBe(400);
    expect((await verify(h, token)).status).toBe(200); // still unspent
  });

  it('opening the link (GET /signin) spends nothing: a mail scanner cannot burn it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ws8-shell-'));
    const shellPath = join(dir, 'index.html');
    writeFileSync(shellPath, '<!doctype html><html><head><title>x</title><link rel="canonical" href="https://stopbiting.today/"><meta name="robots" content="index, follow"></head><body><div id="root"></div></body></html>');
    const h = await harness({ deps: { shellPath } });
    await request(h, 'ann@example.com');
    const token = tokenFrom(h.sent[0]);

    for (let i = 0; i < 3; i++) {
      const page = await get(h, '/signin', { headers: { 'user-agent': 'MailScanner/1.0' } });
      expect(page.status).toBe(200);
      expect(page.headers.get('x-robots-tag')).toMatch(/noindex/);
      expect(page.headers.get('cache-control')).toBe('no-store');
      expect(page.headers.get('referrer-policy')).toBe('no-referrer');
      const html = await page.text();
      expect(html).toContain('<div id="root">');
      expect(html).not.toContain(token);
    }
    const res = await verify(h, token);
    expect(res.status).toBe(200);
  });

  it('with ELECTRON_PROTOCOL set the token goes in a deep link, not a cookie (same as Google)', async () => {
    const h = await harness({ config: { ELECTRON_PROTOCOL: 'stopbiting' } });
    await request(h, 'ann@example.com');
    const res = await verify(h, tokenFrom(h.sent[0]));
    const { redirect } = await res.json();
    expect(redirect).toMatch(/^stopbiting:\/\/auth\?token=session-for%3A/);
    expect(res.headers.getSetCookie().some(c => c.startsWith('nh_session='))).toBe(false);
  });
});

describe('Apple domain verification file', () => {
  const PATH = '/.well-known/apple-developer-domain-association.txt';
  it('is served as plain text exactly as pasted into APPLE_DOMAIN_VERIFICATION', async () => {
    const h = await harness({ flags: '', env: { APPLE_DOMAIN_VERIFICATION: 'abc123verification-token' } });
    const res = await get(h, PATH);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/plain/);
    expect(await res.text()).toBe('abc123verification-token');
  });
  it('does not exist while the variable is unset or blank', async () => {
    for (const value of [undefined, '', '   ']) {
      const h = await harness({ flags: '', env: { APPLE_DOMAIN_VERIFICATION: value } });
      expect((await get(h, PATH)).status).toBe(404);
      await h.close();
    }
  });
});

describe('the sign-in page shell', () => {
  it('prepareSigninShell: noindex, no canonical, and a first-in-head script that moves the fragment token', () => {
    const out = prepareSigninShell('<html><head><meta charset="utf-8"><link rel="canonical" href="https://x/"><meta name="robots" content="index"><script async src="gtag.js"></script></head><body></body></html>');
    expect(out).not.toMatch(/canonical/);
    expect(out).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(out.indexOf('__sbMagicToken')).toBeLessThan(out.indexOf('gtag.js'));
    expect(out.indexOf('__sbMagicToken')).toBeLessThan(out.indexOf('<meta charset'));
  });

  it('adds a robots tag when the shell has none', () => {
    expect(prepareSigninShell('<html><head></head></html>')).toContain('noindex');
  });

  it('is a 404 (not a blank page) when there is no build output', async () => {
    const h = await harness({ deps: { shellPath: '/nonexistent/index.html' } });
    expect((await get(h, '/signin')).status).toBe(404);
  });
});

describe('Sign in with Apple', () => {
  const ecPem = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  const appleEnv = { APPLE_CLIENT_ID: 'today.stopbiting.web', APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567', APPLE_PRIVATE_KEY: ecPem };
  const rsa = makeSigningKey('apple-key-1');

  /** Mocked Apple: `setNext(claims)` is what its token endpoint will sign next. */
  function setup() {
    const m = { tokenRequests: 0, next: null };
    m.f = fakeFetch({
      'https://appleid.apple.com/auth/keys': () => ({ body: { keys: [rsa.jwk] } }),
      'https://appleid.apple.com/auth/token': () => { m.tokenRequests++; return { body: { id_token: rsa.sign(m.next) } }; },
    });
    m.setNext = claims => { m.next = claims; };
    return m;
  }

  async function begin(h) {
    const res = await get(h, '/api/auth/apple');
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get('location'));
    return { url, jar: cookiesFrom(res), state: url.searchParams.get('state'), nonce: url.searchParams.get('nonce') };
  }
  const idClaims = (nonce, over = {}) => ({
    iss: APPLE_ISSUER, aud: 'today.stopbiting.web', sub: '001234.abc.5678', nonce,
    exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000),
    email: 'ann@example.com', email_verified: 'true', ...over,
  });
  const callback = appleReturn;

  it('starts at Apple with form_post, name+email, state and nonce, a binding cookie, and a callback outside /api/ (Apple\'s Origin would fail the /api CORS check)', async () => {
    const m = setup();
    const h = await harness({ env: appleEnv, deps: { fetchImpl: m.f } });
    const { url, jar } = await begin(h);
    expect(url.origin + url.pathname).toBe('https://appleid.apple.com/auth/authorize');
    expect(url.searchParams.get('response_mode')).toBe('form_post');
    expect(url.searchParams.get('scope')).toBe('name email');
    expect(url.searchParams.get('redirect_uri')).toBe(`${APP}/auth/apple/callback`);
    expect(url.searchParams.get('redirect_uri')).not.toContain('/api/');
    expect(jar.sb_oauth_apple).toBe(url.searchParams.get('state'));
  });

  it('the binding cookie is HttpOnly, SameSite=Lax (the return is handled in two hops so Lax is enough), Secure on https, scoped to /api/auth/apple', async () => {
    const m = setup();
    const h = await harness({ env: appleEnv, config: { APP_URL: 'https://stopbiting.test' }, deps: { fetchImpl: m.f } });
    const res = await get(h, '/api/auth/apple');
    const cookie = res.headers.getSetCookie().find(c => c.startsWith('sb_oauth_apple='));
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth\/apple/);
  });

  it('the POST from Apple carries no cookie and completes nothing: it parks the result and redirects to a same-site GET, with no code in the URL', async () => {
    const m = setup();
    const h = await harness({ env: appleEnv, deps: { fetchImpl: m.f } });
    const { state, nonce } = await begin(h);
    m.setNext(idClaims(nonce));
    const first = await post(h, { code: 'SECRET-AUTH-CODE', state, user: JSON.stringify({ name: { firstName: 'Ann' }, email: 'ann@example.com' }) });
    expect(first.status).toBe(303);
    const loc = first.headers.get('location');
    expect(loc).toBe(`${APP}/api/auth/apple/finish?${new URLSearchParams({ state })}`);
    expect(loc).not.toContain('SECRET-AUTH-CODE');
    expect(loc).not.toContain('ann');
    expect(first.headers.getSetCookie().some(c => c.startsWith('nh_session='))).toBe(false); // no session set in a cross-site POST response
    expect(userCount(h)).toBe(0);
    expect(m.tokenRequests).toBe(0);
  });

  it('the second hop refuses a state that was never parked by Apple\'s POST', async () => {
    const m = setup();
    const h = await harness({ env: appleEnv, deps: { fetchImpl: m.f } });
    const { jar, state } = await begin(h);
    const res = await get(h, `/api/auth/apple/finish?${new URLSearchParams({ state })}`, { headers: { cookie: cookieHeader(jar) } });
    expect(res.headers.get('location')).toBe(`${APP}/signin?error=state_mismatch`);
  });

  it('a state can be parked once: a second POST for it is refused', async () => {
    const m = setup();
    const h = await harness({ env: appleEnv, deps: { fetchImpl: m.f } });
    const { state } = await begin(h);
    expect((await post(h, { code: 'a', state })).headers.get('location')).toContain('/api/auth/apple/finish');
    expect((await post(h, { code: 'b', state })).headers.get('location')).toBe(`${APP}/signin?error=state_mismatch`);
  });

  it('completes: verifies state, nonce and id_token, creates the account, sets the session', async () => {
    const m = setup();
    const h = await harness({ env: appleEnv, deps: { fetchImpl: m.f } });
    const { jar, state, nonce } = await begin(h);
    m.setNext(idClaims(nonce));
    const res = await callback(h, { code: 'c1', state, user: JSON.stringify({ name: { firstName: 'Ann', lastName: 'Lee' }, email: 'ann@example.com' }) }, jar);
    expect(res.status).toBe(302); // the second hop is a plain GET that sets the cookie
    expect(res.headers.get('location')).toBe(`${APP}/`);
    expect(res.headers.getSetCookie().some(c => c.startsWith('nh_session='))).toBe(true);
    expect(h.db.prepare('SELECT email, name FROM users').get()).toEqual({ email: 'ann@example.com', name: 'Ann Lee' });
    expect(h.welcomed).toHaveLength(1);
    expect(m.tokenRequests).toBe(1);
  });

  it('a returning Apple user (no `user` field, no email in the token) signs in to the same account', async () => {
    const m = setup();
    const h = await harness({ env: appleEnv, deps: { fetchImpl: m.f } });
    let s = await begin(h);
    m.setNext(idClaims(s.nonce));
    await callback(h, { code: 'c', state: s.state }, s.jar);
    s = await begin(h);
    const { email: _e, email_verified: _v, ...noEmail } = idClaims(s.nonce);
    m.setNext(noEmail);
    const res = await callback(h, { code: 'c', state: s.state }, s.jar);
    expect(res.headers.get('location')).toBe(`${APP}/`);
    expect(userCount(h)).toBe(1);
  });

  it('a private relay address creates an account carrying the relay address', async () => {
    const m = setup();
    const h = await harness({ env: appleEnv, deps: { fetchImpl: m.f } });
    const { jar, state, nonce } = await begin(h);
    m.setNext(idClaims(nonce, { email: 'x7k2@privaterelay.appleid.com', is_private_email: 'true' }));
    await callback(h, { code: 'c', state }, jar);
    expect(h.db.prepare('SELECT email FROM users').get().email).toBe('x7k2@privaterelay.appleid.com');
  });

  it('refuses a return without the binding cookie (login CSRF), and the state is spent', async () => {
    const m = setup();
    const h = await harness({ env: appleEnv, deps: { fetchImpl: m.f } });
    const { jar, state, nonce } = await begin(h);
    m.setNext(idClaims(nonce));
    const res = await appleReturn(h, { code: 'c', state }, {}); // a victim's browser: no cookie for this state
    expect(res.headers.get('location')).toBe(`${APP}/signin?error=state_mismatch`);
    // the genuine browser cannot reuse a state that was already presented
    const retry = await appleReturn(h, { code: 'c', state }, jar);
    expect(retry.headers.get('location')).toBe(`${APP}/signin?error=state_mismatch`);
    expect(m.tokenRequests).toBe(0);
    expect(userCount(h)).toBe(0);
  });

  it('refuses an unknown state and replays', async () => {
    const m = setup();
    const h = await harness({ env: appleEnv, deps: { fetchImpl: m.f } });
    const { jar, state, nonce } = await begin(h);
    m.setNext(idClaims(nonce));
    expect((await callback(h, { code: 'c', state: 'forged-state-value-0000' }, { sb_oauth_apple: 'forged-state-value-0000' })).headers.get('location')).toContain('state_mismatch');
    expect((await callback(h, { code: 'c', state }, jar)).headers.get('location')).toBe(`${APP}/`);
    expect((await callback(h, { code: 'c', state }, jar)).headers.get('location')).toContain('state_mismatch');
    expect(userCount(h)).toBe(1);
  });

  it('refuses an id_token whose nonce is not the one we sent', async () => {
    const m = setup();
    const h = await harness({ env: appleEnv, deps: { fetchImpl: m.f } });
    const { jar, state } = await begin(h);
    m.setNext(idClaims('a-different-nonce'));
    const res = await callback(h, { code: 'c', state }, jar);
    expect(res.headers.get('location')).toBe(`${APP}/signin?error=callback_failed`);
    expect(userCount(h)).toBe(0);
  });

  it('maps the user pressing Cancel to "cancelled"', async () => {
    const m = setup();
    const h = await harness({ env: appleEnv, deps: { fetchImpl: m.f } });
    const { jar, state } = await begin(h);
    const res = await callback(h, { error: 'user_cancelled_authorize', state }, jar);
    expect(res.headers.get('location')).toBe(`${APP}/signin?error=cancelled`);
  });

  it('with ELECTRON_PROTOCOL: no binding cookie is needed and results go to the deep link', async () => {
    const m = setup();
    const h = await harness({ env: appleEnv, config: { ELECTRON_PROTOCOL: 'stopbiting' }, deps: { fetchImpl: m.f } });
    const started = await get(h, '/api/auth/apple');
    expect(started.headers.getSetCookie().some(c => c.startsWith('sb_oauth_apple='))).toBe(false);
    const url = new URL(started.headers.get('location'));
    m.setNext(idClaims(url.searchParams.get('nonce')));
    const res = await callback(h, { code: 'c', state: url.searchParams.get('state') });
    expect(res.headers.get('location')).toMatch(/^stopbiting:\/\/auth\?token=/);
    const bad = await callback(h, { code: 'c', state: 'nope-nope-nope-nope' });
    expect(bad.headers.get('location')).toBe('stopbiting://auth?error=state_mismatch');
  });
});

describe('Sign in with Microsoft', () => {
  const WORK = '11111111-2222-3333-4444-555555555555';
  const msEnv = { MICROSOFT_CLIENT_ID: 'ms-client', MICROSOFT_CLIENT_SECRET: 'ms-secret' };
  const rsa = makeSigningKey('ms-key-1');

  function setup() {
    const state = { claims: null, verifierSeen: null };
    const f = fakeFetch({
      'https://login.microsoftonline.com/common/discovery/v2.0/keys': () => ({ body: { keys: [rsa.jwk] } }),
      'https://login.microsoftonline.com/common/oauth2/v2.0/token': (_u, init) => {
        state.verifierSeen = new URLSearchParams(init.body).get('code_verifier');
        return { body: { id_token: rsa.sign(state.claims) } };
      },
    });
    return { f, state };
  }
  const idClaims = (nonce, tid, over = {}) => ({
    iss: `https://login.microsoftonline.com/${tid}/v2.0`, aud: 'ms-client', tid, oid: 'oid-1', sub: 'pairwise',
    nonce, exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000),
    email: 'bob@outlook.com', name: 'Bob', ...over,
  });
  async function begin(h) {
    const res = await get(h, '/api/auth/microsoft');
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get('location'));
    return { url, jar: cookiesFrom(res), state: url.searchParams.get('state'), nonce: url.searchParams.get('nonce') };
  }
  const callback = (h, query, jar = {}) => get(h, `/api/auth/microsoft/callback?${new URLSearchParams(query)}`, { headers: { cookie: cookieHeader(jar) } });

  it('starts with PKCE (S256), state, nonce and a binding cookie', async () => {
    const m = setup();
    const h = await harness({ env: msEnv, deps: { fetchImpl: m.f } });
    const { url, jar, state } = await begin(h);
    expect(url.origin + url.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('code_verifier')).toBeNull(); // the verifier never goes through the browser
    expect(url.searchParams.get('redirect_uri')).toBe(`${APP}/api/auth/microsoft/callback`);
    expect(jar.sb_oauth_microsoft).toBe(state);
  });

  it('completes with the PKCE verifier that matches the challenge, creating the account', async () => {
    const m = setup();
    const h = await harness({ env: msEnv, deps: { fetchImpl: m.f } });
    const { url, jar, state, nonce } = await begin(h);
    m.state.claims = idClaims(nonce, MS_PERSONAL_TENANT);
    const res = await callback(h, { code: 'c', state }, jar);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${APP}/`);
    const { createHash } = await import('node:crypto');
    expect(createHash('sha256').update(m.state.verifierSeen).digest('base64url')).toBe(url.searchParams.get('code_challenge'));
    expect(h.db.prepare('SELECT email, name FROM users').get()).toEqual({ email: 'bob@outlook.com', name: 'Bob' });
    expect(h.db.prepare("SELECT provider_subject FROM auth_identities WHERE provider = 'microsoft'").get().provider_subject).toBe(`${MS_PERSONAL_TENANT}:oid-1`);
  });

  it('personal account with the same email as a Google user: ONE account', async () => {
    const m = setup();
    const h = await harness({ env: msEnv, deps: { fetchImpl: m.f } });
    seedUser(h.db, { id: GOOGLE_SUB, email: 'bob@outlook.com' });
    const { jar, state, nonce } = await begin(h);
    m.state.claims = idClaims(nonce, MS_PERSONAL_TENANT);
    const res = await callback(h, { code: 'c', state }, jar);
    expect(res.headers.get('location')).toBe(`${APP}/`);
    expect(userCount(h)).toBe(1);
    const cookie = res.headers.getSetCookie().find(c => c.startsWith('nh_session='));
    expect(cookie).toContain(encodeURIComponent(`session-for:${GOOGLE_SUB}`));
  });

  it('work tenant, email NOT verified, an account has that email: refused with a clear code, nothing linked or created', async () => {
    const m = setup();
    const h = await harness({ env: msEnv, deps: { fetchImpl: m.f } });
    seedUser(h.db, { id: GOOGLE_SUB, email: 'victim@example.com' });
    const { jar, state, nonce } = await begin(h);
    m.state.claims = idClaims(nonce, WORK, { email: 'victim@example.com' });
    const res = await callback(h, { code: 'c', state }, jar);
    expect(res.headers.get('location')).toBe(`${APP}/signin?error=email_unverified&provider=microsoft`);
    expect(res.headers.getSetCookie().some(c => c.startsWith('nh_session='))).toBe(false);
    expect(userCount(h)).toBe(1);
    expect(h.db.prepare('SELECT COUNT(*) AS n FROM auth_identities').get().n).toBe(0);
  });

  it('work tenant WITH xms_edov joins the account by email', async () => {
    const m = setup();
    const h = await harness({ env: msEnv, deps: { fetchImpl: m.f } });
    seedUser(h.db, { id: GOOGLE_SUB, email: 'bob@corp.com' });
    const { jar, state, nonce } = await begin(h);
    m.state.claims = idClaims(nonce, WORK, { email: 'bob@corp.com', xms_edov: true });
    const res = await callback(h, { code: 'c', state }, jar);
    expect(res.headers.get('location')).toBe(`${APP}/`);
    expect(userCount(h)).toBe(1);
  });

  it('work tenant, unverified email, nobody has it: a new account WITHOUT the email stored', async () => {
    const m = setup();
    const h = await harness({ env: msEnv, deps: { fetchImpl: m.f } });
    const { jar, state, nonce } = await begin(h);
    m.state.claims = idClaims(nonce, WORK, { email: 'new@corp.com' });
    await callback(h, { code: 'c', state }, jar);
    expect(h.db.prepare('SELECT email FROM users').get().email).toBeNull();
  });

  it('refuses a forged issuer, a missing cookie and a replayed state', async () => {
    const m = setup();
    const h = await harness({ env: msEnv, deps: { fetchImpl: m.f } });
    let s = await begin(h);
    m.state.claims = idClaims(s.nonce, WORK, { iss: 'https://login.microsoftonline.com/other-tenant/v2.0' });
    expect((await callback(h, { code: 'c', state: s.state }, s.jar)).headers.get('location')).toBe(`${APP}/signin?error=callback_failed`);

    s = await begin(h);
    m.state.claims = idClaims(s.nonce, MS_PERSONAL_TENANT);
    expect((await callback(h, { code: 'c', state: s.state }, {})).headers.get('location')).toContain('state_mismatch');
    expect((await callback(h, { code: 'c', state: s.state }, s.jar)).headers.get('location')).toContain('state_mismatch');
    expect(userCount(h)).toBe(0);
  });

  it('maps access_denied to "cancelled"', async () => {
    const m = setup();
    const h = await harness({ env: msEnv, deps: { fetchImpl: m.f } });
    const { jar, state } = await begin(h);
    expect((await callback(h, { error: 'access_denied', state }, jar)).headers.get('location')).toBe(`${APP}/signin?error=cancelled`);
  });

  it('with ELECTRON_PROTOCOL: redirect URI is the local server, results go to the deep link', async () => {
    const m = setup();
    const h = await harness({ env: { ...msEnv, PORT: '3208' }, config: { ELECTRON_PROTOCOL: 'stopbiting' }, deps: { fetchImpl: m.f } });
    const { url, state, nonce } = await begin(h);
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3208/api/auth/microsoft/callback');
    m.state.claims = idClaims(nonce, MS_PERSONAL_TENANT);
    const res = await callback(h, { code: 'c', state });
    expect(res.headers.get('location')).toMatch(/^stopbiting:\/\/auth\?token=/);
  });
});

describe('one person, several methods, one account', () => {
  it('Google user -> emailed link -> Apple -> Microsoft (personal): still one user, same session subject', async () => {
    const rsaApple = makeSigningKey('a1');
    const rsaMs = makeSigningKey('m1');
    const ecPem = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
    let appleClaims; let msClaims;
    const f = fakeFetch({
      'https://appleid.apple.com/auth/keys': () => ({ body: { keys: [rsaApple.jwk] } }),
      'https://appleid.apple.com/auth/token': () => ({ body: { id_token: rsaApple.sign(appleClaims) } }),
      'https://login.microsoftonline.com/common/discovery/v2.0/keys': () => ({ body: { keys: [rsaMs.jwk] } }),
      'https://login.microsoftonline.com/common/oauth2/v2.0/token': () => ({ body: { id_token: rsaMs.sign(msClaims) } }),
    });
    const clock = { t: Date.now() };
    const h = await harness({
      env: {
        APPLE_CLIENT_ID: 'today.stopbiting.web', APPLE_TEAM_ID: 'TEAM123456', APPLE_KEY_ID: 'KEY1234567', APPLE_PRIVATE_KEY: ecPem,
        MICROSOFT_CLIENT_ID: 'ms-client', MICROSOFT_CLIENT_SECRET: 's',
      },
      deps: { fetchImpl: f, now: () => clock.t },
    });
    seedUser(h.db, { id: GOOGLE_SUB, email: 'ann@example.com', name: 'Ann' });
    const subjects = [];
    const subjectOf = res => decodeURIComponent(res.headers.getSetCookie().find(c => c.startsWith('nh_session=')).split(';')[0].split('=')[1]);

    // 1. emailed link
    await postJson(`${h.url}/api/auth/magic-link/request`, { email: 'Ann@Example.com' });
    subjects.push(subjectOf(await postJson(`${h.url}/api/auth/magic-link/verify`, { token: tokenFrom(h.sent[0]) })));

    // 2. Apple, real address, verified
    let res = await get(h, '/api/auth/apple');
    let url = new URL(res.headers.get('location'));
    appleClaims = {
      iss: APPLE_ISSUER, aud: 'today.stopbiting.web', sub: 'apple-sub', nonce: url.searchParams.get('nonce'),
      exp: Math.floor(clock.t / 1000) + 600, iat: Math.floor(clock.t / 1000), email: 'ann@example.com', email_verified: true, is_private_email: false,
    };
    res = await appleReturn(h, { code: 'c', state: url.searchParams.get('state') }, cookiesFrom(res));
    subjects.push(subjectOf(res));

    // 3. Microsoft personal account
    res = await get(h, '/api/auth/microsoft');
    url = new URL(res.headers.get('location'));
    msClaims = {
      iss: `https://login.microsoftonline.com/${MS_PERSONAL_TENANT}/v2.0`, aud: 'ms-client', tid: MS_PERSONAL_TENANT, oid: 'ms-oid',
      sub: 'ms-sub', nonce: url.searchParams.get('nonce'), exp: Math.floor(clock.t / 1000) + 600, iat: Math.floor(clock.t / 1000), email: 'ann@example.com',
    };
    res = await get(h, `/api/auth/microsoft/callback?${new URLSearchParams({ code: 'c', state: url.searchParams.get('state') })}`, { headers: { cookie: cookieHeader(cookiesFrom(res)) } });
    subjects.push(subjectOf(res));

    expect(subjects).toEqual([`session-for:${GOOGLE_SUB}`, `session-for:${GOOGLE_SUB}`, `session-for:${GOOGLE_SUB}`]);
    expect(userCount(h)).toBe(1);
    const identities = h.db.prepare('SELECT provider FROM auth_identities ORDER BY provider').all().map(r => r.provider);
    expect(identities).toEqual(['apple', 'email', 'google', 'microsoft']);
    expect(h.welcomed).toHaveLength(0); // nobody was new
  });
});
