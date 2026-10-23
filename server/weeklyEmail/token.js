// The unsubscribe token in every weekly email (WS5).
//
//   token = base64url(userId) + '.' + base64url(HMAC-SHA256(secret, 'weekly-summary-unsubscribe:v1:' + userId))
//
// `secret` is that person's own random value (email_preferences.unsubscribe_secret),
// so a token proves "this server issued a link for this person" and nothing else:
// it cannot sign in, read data or do anything but switch the weekly email off.
// Rotating the secret retires every link already sent. Tokens do not expire (an
// unsubscribe link must keep working for as long as the email can be found).
//
// Pure functions: the secret is passed in, there is no clock and no database.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const CONTEXT = 'weekly-summary-unsubscribe:v1:';
/** Longest user id we will put in a link (Google subjects are about 21 digits, WS8 ids are uuids). */
const MAX_USER_ID_BYTES = 128;
const MAC_BYTES = 32;
const PART = /^[A-Za-z0-9_-]+$/;

/** A fresh per-person secret. */
export function newUnsubscribeSecret() {
  return randomBytes(32).toString('base64url');
}

function mac(secret, userId) {
  return createHmac('sha256', secret).update(CONTEXT + userId).digest();
}

export function signUnsubscribeToken(userId, secret) {
  const id = String(userId);
  if (Buffer.byteLength(id) > MAX_USER_ID_BYTES) throw new Error('user id too long for an unsubscribe token');
  if (typeof secret !== 'string' || secret.length < 16) throw new Error('unsubscribe secret missing or too short');
  return `${Buffer.from(id).toString('base64url')}.${mac(secret, id).toString('base64url')}`;
}

/**
 * Splits a token into its claimed user id and MAC without trusting either.
 * Returns null for anything that is not shaped like a token.
 */
export function readUnsubscribeToken(token) {
  if (typeof token !== 'string' || token.length === 0 || token.length > 400) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !PART.test(parts[0]) || !PART.test(parts[1])) return null;
  const idBytes = Buffer.from(parts[0], 'base64url');
  const macBytes = Buffer.from(parts[1], 'base64url');
  if (idBytes.length === 0 || idBytes.length > MAX_USER_ID_BYTES || macBytes.length !== MAC_BYTES) return null;
  // Round trip: reject encodings that decode to the same bytes but are not canonical.
  if (idBytes.toString('base64url') !== parts[0] || macBytes.toString('base64url') !== parts[1]) return null;
  const userId = idBytes.toString('utf8');
  if (Buffer.from(userId).compare(idBytes) !== 0) return null; // not valid UTF-8
  return { userId, mac: macBytes };
}

/**
 * True only if `token` was made for the user it names with exactly this `secret`.
 * Use readUnsubscribeToken first to learn whose secret to look up.
 */
export function verifyUnsubscribeToken(token, secret) {
  const parsed = readUnsubscribeToken(token);
  if (!parsed || typeof secret !== 'string' || secret.length < 16) return false;
  const expected = mac(secret, parsed.userId);
  return expected.length === parsed.mac.length && timingSafeEqual(expected, parsed.mac);
}
