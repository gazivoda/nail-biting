// Client logic for the sign-in page that needs no React: the messages for
// failed sign-ins, reading the emailed token out of the page address, and the
// two calls to the emailed-link endpoints. Tested in node.

import { t } from '../i18n/scopes/auth';

export type SignInErrorCode =
  | 'cancelled' | 'state_mismatch' | 'no_code' | 'callback_failed' | 'email_unverified' | 'unknown';

const KNOWN_ERRORS: readonly string[] = ['cancelled', 'state_mismatch', 'no_code', 'callback_failed', 'email_unverified'];

export function parseErrorCode(value: string | null | undefined): SignInErrorCode | null {
  if (!value) return null;
  return (KNOWN_ERRORS.includes(value) ? value : 'unknown') as SignInErrorCode;
}

const PROVIDER_NAMES: Record<string, string> = { apple: 'Apple', microsoft: 'Microsoft' };

/** The words shown above the buttons after a sign-in that did not finish. */
export function errorMessage(code: SignInErrorCode, provider?: string | null): string {
  switch (code) {
    case 'cancelled':
      return t('error.cancelled');
    case 'email_unverified':
      return t('error.unverified', { who: (provider && PROVIDER_NAMES[provider]) || t('error.who.default') });
    default:
      return t('error.generic');
  }
}

/** The state of the emailed link the visitor just opened. */
export type LinkFailure = 'expired' | 'used' | 'invalid';

export function linkFailureMessage(reason: LinkFailure): string {
  switch (reason) {
    case 'expired': return t('link.expired');
    case 'used': return t('link.used');
    default: return t('link.invalid');
  }
}

/** Why asking for the emailed link did not work. */
export type SendFailure = 'invalid_email' | 'too_many' | 'failed';

/** The words for it (looked up at each render, so a language change applies). */
export function sendFailureMessage(reason: SendFailure): string {
  return reason === 'invalid_email' ? t('error.invalidEmail') : reason === 'too_many' ? t('error.tooMany') : t('error.sendFailed');
}

/** The note above the buttons: what the emailed link did, else what the provider redirect reported. */
export function signInNotice(
  linkFailure: LinkFailure | 'failed' | null, errorCode: SignInErrorCode | null, provider?: string | null,
): string | null {
  if (linkFailure) return linkFailure === 'failed' ? t('error.finishFailed') : linkFailureMessage(linkFailure);
  return errorCode ? errorMessage(errorCode, provider) : null;
}

/** Only addresses the server could have produced: our own site, a path, or the desktop app's deep link. */
export function isSafeRedirect(url: unknown, origin: string): url is string {
  if (typeof url !== 'string' || url === '') return false;
  if (url.startsWith('stopbiting://auth')) return true;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

declare global {
  interface Window { __sbMagicToken?: string }
}

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/**
 * The emailed token lives in the URL fragment (#t=...), which is never sent to a
 * server. The server-rendered shell moves it into window.__sbMagicToken before
 * anything else runs; on the Vite dev server (no such shell) it is read from the
 * fragment here. Either way it is removed from the address bar and from memory
 * after it has been taken.
 */
export function takeMagicToken(win: Pick<Window, 'location' | 'history'> & { __sbMagicToken?: string } = window): string | null {
  let raw = win.__sbMagicToken;
  if (raw === undefined && win.location.hash.startsWith('#t=')) raw = win.location.hash.slice(3);
  if (raw !== undefined) {
    delete win.__sbMagicToken;
    if (win.location.hash) win.history.replaceState(null, '', win.location.pathname + win.location.search);
  }
  return typeof raw === 'string' && TOKEN_SHAPE.test(raw) ? raw : null;
}

export type RequestLinkResult = { ok: true } | { ok: false; reason: SendFailure };

export async function requestMagicLink(email: string, doFetch: typeof fetch = fetch): Promise<RequestLinkResult> {
  try {
    const res = await doFetch('/api/auth/magic-link/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 400) return { ok: false, reason: 'invalid_email' };
    if (res.status === 429) return { ok: false, reason: 'too_many' };
    return { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export type VerifyLinkResult = { ok: true; redirect: string } | { ok: false; reason: LinkFailure | 'failed' };

export async function verifyMagicLink(token: string, origin: string, doFetch: typeof fetch = fetch): Promise<VerifyLinkResult> {
  try {
    const res = await doFetch('/api/auth/magic-link/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ token }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; redirect?: unknown; reason?: string };
    if (res.ok && body.ok && isSafeRedirect(body.redirect, origin)) return { ok: true, redirect: body.redirect };
    if (body.reason === 'expired' || body.reason === 'used' || body.reason === 'invalid') return { ok: false, reason: body.reason };
    return { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
