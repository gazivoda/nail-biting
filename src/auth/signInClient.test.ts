import { describe, it, expect } from 'vitest';
import {
  errorMessage, isSafeRedirect, linkFailureMessage, parseErrorCode, requestMagicLink, takeMagicToken, verifyMagicLink,
} from './signInClient';

const TOKEN = 'A'.repeat(43);
const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

function fakeWindow(hash: string, preset?: string) {
  const calls: string[] = [];
  const win = {
    __sbMagicToken: preset,
    location: { hash, pathname: '/signin', search: '' },
    history: { replaceState: (_s: unknown, _t: string, url: string) => { calls.push(url); } },
  } as unknown as Parameters<typeof takeMagicToken>[0];
  return { win, calls };
}

describe('error messages', () => {
  it('parses known codes, maps unknown ones, ignores empty', () => {
    expect(parseErrorCode('cancelled')).toBe('cancelled');
    expect(parseErrorCode('email_unverified')).toBe('email_unverified');
    expect(parseErrorCode('whatever')).toBe('unknown');
    expect(parseErrorCode('')).toBeNull();
    expect(parseErrorCode(null)).toBeNull();
  });

  it('every message says nothing was set up and what to do, with no privacy overclaims', () => {
    for (const code of ['cancelled', 'state_mismatch', 'no_code', 'callback_failed', 'unknown'] as const) {
      expect(errorMessage(code)).toMatch(/nothing was set up/);
    }
    for (const text of [errorMessage('email_unverified', 'microsoft'), linkFailureMessage('expired'), linkFailureMessage('used')]) {
      expect(text).not.toMatch(/100% private|no cloud|nothing leaves/i);
    }
  });

  it('the Microsoft unverified-email message names Microsoft and offers the emailed link', () => {
    const text = errorMessage('email_unverified', 'microsoft');
    expect(text).toMatch(/Microsoft/);
    expect(text).toMatch(/emailed sign-in link/);
    expect(errorMessage('email_unverified', 'apple')).toMatch(/Apple/);
    expect(errorMessage('email_unverified', null)).toMatch(/Your sign-in provider/);
  });

  it('link failures: expired, used and invalid each say what happened and offer a new link', () => {
    expect(linkFailureMessage('expired')).toMatch(/expired/);
    expect(linkFailureMessage('used')).toMatch(/already used/);
    expect(linkFailureMessage('invalid')).toMatch(/isn't valid/);
    for (const r of ['expired', 'used', 'invalid'] as const) expect(linkFailureMessage(r)).toMatch(/new one/);
  });
});

describe('isSafeRedirect', () => {
  it('accepts our own origin, a path and the desktop deep link', () => {
    expect(isSafeRedirect('https://stopbiting.today/', 'https://stopbiting.today')).toBe(true);
    expect(isSafeRedirect('/', 'https://stopbiting.today')).toBe(true);
    expect(isSafeRedirect('stopbiting://auth?token=abc', 'https://stopbiting.today')).toBe(true);
  });
  it('refuses everything else (open redirects, scripts, protocol-relative)', () => {
    for (const bad of ['https://evil.example/', '//evil.example', 'javascript:alert(1)', 'data:text/html,x', '', undefined, null, 5, 'stopbiting://other']) {
      expect(isSafeRedirect(bad, 'https://stopbiting.today')).toBe(false);
    }
  });
});

describe('takeMagicToken', () => {
  it('takes the token the server-side shell parked on the window, and clears it', () => {
    const { win } = fakeWindow('', TOKEN);
    expect(takeMagicToken(win)).toBe(TOKEN);
    expect((win as { __sbMagicToken?: string }).__sbMagicToken).toBeUndefined();
    expect(takeMagicToken(win)).toBeNull(); // only once
  });

  it('falls back to the URL fragment (Vite dev server) and removes it from the address bar', () => {
    const { win, calls } = fakeWindow(`#t=${TOKEN}`);
    expect(takeMagicToken(win)).toBe(TOKEN);
    expect(calls).toEqual(['/signin']);
  });

  it('refuses anything that is not a 43 character token', () => {
    expect(takeMagicToken(fakeWindow('#t=short').win)).toBeNull();
    expect(takeMagicToken(fakeWindow('', 'x'.repeat(44)).win)).toBeNull();
    expect(takeMagicToken(fakeWindow('#other=1').win)).toBeNull();
    expect(takeMagicToken(fakeWindow('').win)).toBeNull();
  });
});

describe('requestMagicLink', () => {
  it('posts JSON to the request endpoint', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const r = await requestMagicLink('a@example.com', ((url: string, init: RequestInit) => { seen = { url, init }; return reply({ ok: true }); }) as unknown as typeof fetch);
    expect(r).toEqual({ ok: true });
    expect(seen!.url).toBe('/api/auth/magic-link/request');
    expect(seen!.init.method).toBe('POST');
    expect((seen!.init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(JSON.parse(seen!.init.body as string)).toEqual({ email: 'a@example.com' });
  });
  it('maps 400, 429, other failures and network errors', async () => {
    const f = (status: number) => (() => reply({}, status)) as unknown as typeof fetch;
    expect(await requestMagicLink('x', f(400))).toEqual({ ok: false, reason: 'invalid_email' });
    expect(await requestMagicLink('x', f(429))).toEqual({ ok: false, reason: 'too_many' });
    expect(await requestMagicLink('x', f(502))).toEqual({ ok: false, reason: 'failed' });
    expect(await requestMagicLink('x', (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch)).toEqual({ ok: false, reason: 'failed' });
  });
});

describe('verifyMagicLink', () => {
  const origin = 'https://stopbiting.today';
  const f = (body: unknown, status = 200) => (() => reply(body, status)) as unknown as typeof fetch;

  it('returns the redirect on success', async () => {
    expect(await verifyMagicLink(TOKEN, origin, f({ ok: true, redirect: 'https://stopbiting.today/' }))).toEqual({ ok: true, redirect: 'https://stopbiting.today/' });
  });
  it('refuses a success that points somewhere else', async () => {
    expect(await verifyMagicLink(TOKEN, origin, f({ ok: true, redirect: 'https://evil.example/' }))).toEqual({ ok: false, reason: 'failed' });
  });
  it('reports expired, used and invalid separately', async () => {
    expect(await verifyMagicLink(TOKEN, origin, f({ ok: false, reason: 'expired' }, 410))).toEqual({ ok: false, reason: 'expired' });
    expect(await verifyMagicLink(TOKEN, origin, f({ ok: false, reason: 'used' }, 410))).toEqual({ ok: false, reason: 'used' });
    expect(await verifyMagicLink(TOKEN, origin, f({ ok: false, reason: 'invalid' }, 400))).toEqual({ ok: false, reason: 'invalid' });
  });
  it('anything else is a generic failure', async () => {
    expect(await verifyMagicLink(TOKEN, origin, f({}, 500))).toEqual({ ok: false, reason: 'failed' });
    expect(await verifyMagicLink(TOKEN, origin, (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch)).toEqual({ ok: false, reason: 'failed' });
  });
});
