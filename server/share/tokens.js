// Share-link tokens (WS10).
//
// A token is 32 random bytes written as base64url (43 characters). It is a bearer
// secret: whoever has it can read the summary. It is shown to the owner ONCE, when
// the link is created, and only its SHA-256 is ever stored (the database cannot
// give the token back, and a leaked database does not leak working links). Lookup
// is by that hash, so there is no comparison of a secret against a stored secret.

import { createHash, randomBytes } from 'node:crypto';

export const TOKEN_BYTES = 32;

/** 32 random bytes as 43 base64url characters. */
export function generateToken(bytes = randomBytes) {
  return bytes(TOKEN_BYTES).toString('base64url');
}

/** Hex SHA-256 of the token text, which is what the table stores. */
export function hashToken(token) {
  return createHash('sha256').update(String(token), 'utf8').digest('hex');
}

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/**
 * True for the exact shape generateToken() makes. Anything else cannot be a token we
 * issued, so the caller answers it with the same 404 as an unknown one (never with a
 * different error: the shape must not tell a guesser anything).
 */
export function isWellFormedToken(token) {
  return typeof token === 'string' && TOKEN_SHAPE.test(token);
}
