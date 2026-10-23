// The referral link, on the visitor's side (flag referrals).
//
//   <site>/?ref=CODE  ->  the code is remembered in this browser  ->  after sign-up the app sends it to
//   POST /api/referrals/attach, which ties the new account to the link's owner  ->  the reward itself
//   is decided by the server from Paddle's webhooks (server/billing/referrals.js).
//
// The code is a short public identifier, not a secret; it is kept for 30 days and then forgotten.
// Storage goes through the kv module (no direct localStorage).

import { kv } from '../storage/kv';

const KEY = 'pending-referral';
export const REFERRAL_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

interface Pending { code: string; at: number }

/** The code in a query string ("?ref=ab2cd3ef"), upper-cased, or null. Same alphabet as the server's. */
export function parseRefParam(search: string): string | null {
  const raw = new URLSearchParams(search).get('ref');
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return /^[2-9A-HJ-NP-Z]{8}$/.test(code) ? code : null;
}

export function rememberReferral(code: string, now = Date.now()): boolean {
  return kv.set<Pending>('billing', KEY, { code, at: now });
}

export function pendingReferral(now = Date.now()): string | null {
  const p = kv.get<Pending | null>('billing', KEY, null);
  if (!p || typeof p.code !== 'string' || typeof p.at !== 'number') return null;
  if (now - p.at > REFERRAL_KEEP_MS) { kv.remove('billing', KEY); return null; }
  return p.code;
}

export function forgetReferral(): void {
  kv.remove('billing', KEY);
}
