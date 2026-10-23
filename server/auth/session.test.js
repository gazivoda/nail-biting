import { describe, it, expect } from 'vitest';
import {
  clientIp, completeSignIn, failureRedirect, isPrivateAddress, safeEqual, sameOriginOk, sessionCookieOptions,
} from './session.js';
import { readFileSync } from 'node:fs';

const req = (peer, xff, ip) => ({ socket: { remoteAddress: peer }, headers: xff === undefined ? {} : { 'x-forwarded-for': xff }, ip });

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.0.3.4', '172.16.0.1', '172.31.255.255', '192.168.1.9', '169.254.1.1', '100.64.0.1', '::1', 'fd12:3456::1', 'fe80::1', '::ffff:172.18.0.5'])(
    '%s is private', a => expect(isPrivateAddress(a)).toBe(true));
  it.each(['8.8.8.8', '172.32.0.1', '172.15.0.1', '192.169.0.1', '100.128.0.1', '2001:db8::1', '::ffff:8.8.8.8', '', undefined, null])(
    '%j is not', a => expect(isPrivateAddress(a)).toBe(false));
});

describe('clientIp', () => {
  it('behind a proxy on a private network: the last X-Forwarded-For entry (what the proxy saw), not a client-supplied one', () => {
    expect(clientIp(req('172.18.0.2', '6.6.6.6, 203.0.113.7', '172.18.0.2'))).toBe('203.0.113.7');
    expect(clientIp(req('::ffff:172.18.0.2', '203.0.113.7'))).toBe('203.0.113.7');
  });
  it('a request that reaches the app directly from the internet cannot spoof it', () => {
    expect(clientIp(req('198.51.100.9', '6.6.6.6', '198.51.100.9'))).toBe('198.51.100.9');
  });
  it('no header: the socket address', () => {
    expect(clientIp(req('172.18.0.2', undefined, '172.18.0.2'))).toBe('172.18.0.2');
    expect(clientIp(req('198.51.100.9', ''))).toBe('198.51.100.9');
  });
  it('works without NODE_ENV (the Dockerfile does not set it)', () => {
    const before = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      expect(clientIp(req('172.18.0.2', '203.0.113.7'))).toBe('203.0.113.7');
    } finally {
      if (before !== undefined) process.env.NODE_ENV = before;
    }
  });
});

describe('session cookie', () => {
  it('has exactly the options the Google callback sets in server.js', () => {
    const opts = sessionCookieOptions('https://stopbiting.today');
    expect(opts).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', maxAge: 14 * 24 * 60 * 60 * 1000 });
    expect(sessionCookieOptions('http://localhost:3000').secure).toBe(false);
    // Drift guard: server.js still sets the same four options for the Google flow.
    const server = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');
    const block = server.slice(server.indexOf("res.cookie('nh_session'"), server.indexOf("res.redirect(`${APP_URL}/`)"));
    expect(block).toMatch(/httpOnly: true/);
    expect(block).toMatch(/secure: APP_URL\.startsWith\('https'\)/);
    expect(block).toMatch(/sameSite: 'lax'/);
    expect(block).toMatch(/maxAge: 14 \* 24 \* 60 \* 60 \* 1000/);
  });

  it('completeSignIn: cookie on the web, deep link with ELECTRON_PROTOCOL', () => {
    const set = [];
    const res = { cookie: (...a) => set.push(a) };
    const web = completeSignIn({ signToken: id => `t:${id}`, config: { APP_URL: 'https://x.test', ELECTRON_PROTOCOL: null }, res, userId: 'u1' });
    expect(web).toBe('https://x.test/');
    expect(set[0][0]).toBe('nh_session');
    expect(set[0][1]).toBe('t:u1');

    set.length = 0;
    const desktop = completeSignIn({ signToken: id => `t:${id}`, config: { APP_URL: 'https://x.test', ELECTRON_PROTOCOL: 'stopbiting' }, res, userId: 'u1' });
    expect(desktop).toBe('stopbiting://auth?token=t%3Au1');
    expect(set).toHaveLength(0);
  });

  it('failureRedirect goes to the sign-in page, or the deep link with ELECTRON_PROTOCOL', () => {
    expect(failureRedirect({ APP_URL: 'https://x.test' }, 'cancelled')).toBe('https://x.test/signin?error=cancelled');
    expect(failureRedirect({ APP_URL: 'https://x.test' }, 'email_unverified', { provider: 'microsoft' }))
      .toBe('https://x.test/signin?error=email_unverified&provider=microsoft');
    expect(failureRedirect({ APP_URL: 'https://x.test', ELECTRON_PROTOCOL: 'stopbiting' }, 'cancelled')).toBe('stopbiting://auth?error=cancelled');
  });
});

describe('sameOriginOk / safeEqual', () => {
  const cfg = { APP_URL: 'https://stopbiting.today', ELECTRON_PROTOCOL: null };
  it('allows our origin and no Origin, refuses others', () => {
    expect(sameOriginOk({ headers: { origin: 'https://stopbiting.today' } }, cfg)).toBe(true);
    expect(sameOriginOk({ headers: {} }, cfg)).toBe(true);
    expect(sameOriginOk({ headers: { origin: 'https://evil.example' } }, cfg)).toBe(false);
    expect(sameOriginOk({ headers: { origin: 'null' } }, cfg)).toBe(false);
    expect(sameOriginOk({ headers: { origin: 'null' } }, { ...cfg, ELECTRON_PROTOCOL: 'stopbiting' })).toBe(true);
  });
  it('safeEqual compares strings of any length and rejects non-strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual(undefined, 'abc')).toBe(false);
    expect(safeEqual('abc', null)).toBe(false);
  });
});
