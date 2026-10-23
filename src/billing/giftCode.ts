// The gift code on the recipient's side (flag gift_plan).
//
// The emailed link is <site>/redeem#code=XXXX. The server's /redeem page moves the code out of the address
// bar into window.__sbGiftCode before anything else runs (server/routes/billing.js, prepareRedeemShell), so
// it is never in a request, a log or a Referer header. Here it is taken from there and kept in this browser
// until it is redeemed, because the recipient usually has to sign in first and the sign-in leaves the page.
//
// It is a bearer secret, so it is kept only as long as needed: 7 days, and removed the moment it is used
// or refused.

import { kv } from '../storage/kv';

const KEY = 'pending-gift';
export const GIFT_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

interface Pending { code: string; at: number }

declare global {
  interface Window { __sbGiftCode?: string }
}

/** Letters and digits only, 20 to 24 characters once hyphens and spaces are gone. Anything else is not a code. */
export function cleanGiftCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const compact = input.replace(/[\s-]/g, '').toUpperCase();
  return /^[0-9A-Z]{20}$/.test(compact) ? compact : null;
}

/** Moves a code that arrived in the address (window.__sbGiftCode) into storage. Returns the code in storage, if any. */
export function takeGiftCode(now = Date.now()): string | null {
  if (typeof window !== 'undefined' && window.__sbGiftCode !== undefined) {
    let decoded = window.__sbGiftCode;
    try { decoded = decodeURIComponent(decoded); } catch { /* use it as it came */ }
    const code = cleanGiftCode(decoded);
    delete window.__sbGiftCode;
    if (code) kv.set<Pending>('billing', KEY, { code, at: now });
  }
  return pendingGiftCode(now);
}

export function pendingGiftCode(now = Date.now()): string | null {
  const p = kv.get<Pending | null>('billing', KEY, null);
  if (!p || typeof p.code !== 'string' || typeof p.at !== 'number') return null;
  if (now - p.at > GIFT_KEEP_MS) { kv.remove('billing', KEY); return null; }
  return p.code;
}

export function rememberGiftCode(code: string, now = Date.now()): void {
  kv.set<Pending>('billing', KEY, { code, at: now });
}

export function forgetGiftCode(): void {
  kv.remove('billing', KEY);
}
