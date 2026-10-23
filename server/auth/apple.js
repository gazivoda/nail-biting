// Sign in with Apple (web, authorization-code flow).
//
// Owner setup (see docs/agents/ws8-notes.md): a Services ID, a Sign in with Apple
// key (.p8) and the Team ID. Everything is read from the environment:
//
//   APPLE_CLIENT_ID    the Services ID, e.g. today.stopbiting.web
//   APPLE_TEAM_ID      10-character team id
//   APPLE_KEY_ID       10-character id of the .p8 key
//   APPLE_PRIVATE_KEY  the .p8 contents (newlines may be written as \n, or the
//                      whole PEM may be base64 encoded)
//
// Facts this file relies on (Apple's OpenID configuration at
// https://appleid.apple.com/.well-known/openid-configuration, read 2026-10-23):
// issuer https://appleid.apple.com, authorization_endpoint /auth/authorize,
// token_endpoint /auth/token, jwks_uri /auth/keys, id tokens signed with RS256,
// response modes query / fragment / form_post. Asking for the `name` or `email`
// scope REQUIRES form_post, which makes the callback a cross-site POST.
// `email_verified` and `is_private_email` arrive as booleans OR as the strings
// "true"/"false". The user's name is only ever delivered in the `user` form
// field of the FIRST authorization, never in the token.

import jwt from 'jsonwebtoken';
import { createJwksCache, verifyIdToken } from './jwks.js';

export const APPLE_ISSUER = 'https://appleid.apple.com';
export const APPLE_AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize';
export const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
export const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';

/** Apple allows a client secret to live up to six months; we mint one per exchange and let it live minutes. */
const CLIENT_SECRET_TTL_SEC = 5 * 60;

/** Accepts a PEM with real newlines, with literal "\n", or base64 of the PEM. */
export function normalizePrivateKey(raw) {
  if (typeof raw !== 'string') return null;
  let key = raw.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
  if (!key.includes('BEGIN')) {
    try { key = Buffer.from(key, 'base64').toString('utf8'); } catch { return null; }
  }
  return key.includes('BEGIN') && key.includes('PRIVATE KEY') ? key : null;
}

/** @returns {{ clientId: string, teamId: string, keyId: string, privateKey: string } | null} null when not (fully) configured */
export function appleConfigFromEnv(env = process.env) {
  const clientId = env.APPLE_CLIENT_ID?.trim();
  const teamId = env.APPLE_TEAM_ID?.trim();
  const keyId = env.APPLE_KEY_ID?.trim();
  const privateKey = normalizePrivateKey(env.APPLE_PRIVATE_KEY);
  if (!clientId || !teamId || !keyId || !privateKey) return null;
  return { clientId, teamId, keyId, privateKey };
}

/** The `client_secret` Apple wants: a short-lived ES256 JWT signed with the .p8 key. */
export function buildClientSecret(cfg, { now = Date.now } = {}) {
  const iat = Math.floor(now() / 1000);
  return jwt.sign(
    { iss: cfg.teamId, iat, exp: iat + CLIENT_SECRET_TTL_SEC, aud: APPLE_ISSUER, sub: cfg.clientId },
    cfg.privateKey,
    { algorithm: 'ES256', keyid: cfg.keyId },
  );
}

export function buildAuthorizeUrl(cfg, { redirectUri, state, nonce }) {
  const url = new URL(APPLE_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: 'code',
    response_mode: 'form_post', // required when asking for name / email
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    scope: 'name email',
    state,
    nonce,
  }).toString();
  return url.toString();
}

/**
 * Parses the `user` form field Apple posts on the first authorization only.
 * It is supplied via the browser, so it is only ever used as a display name.
 * @returns {string | null}
 */
export function parseAppleUserName(userField) {
  if (typeof userField !== 'string' || userField.length > 2000) return null;
  try {
    const user = JSON.parse(userField);
    const first = typeof user?.name?.firstName === 'string' ? user.name.firstName : '';
    const last = typeof user?.name?.lastName === 'string' ? user.name.lastName : '';
    const name = `${first} ${last}`.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
    return name || null;
  } catch {
    return null;
  }
}

export function createAppleClient({ cfg, fetchImpl = fetch, now = Date.now, jwks } = {}) {
  const keys = jwks ?? createJwksCache({ url: APPLE_KEYS_URL, fetchImpl, now });

  /** Verifies an Apple ID token we received from the token endpoint. @returns {Promise<object>} claims */
  const verify = (idToken, nonce) => verifyIdToken(idToken, {
    jwks: keys,
    audience: cfg.clientId,
    nonce,
    now,
    issuerOk: claims => claims.iss === APPLE_ISSUER,
  });

  return {
    verifyIdToken: verify,

    /** Exchanges the authorization code (back channel) and verifies the id_token it returns. */
    async exchangeCode({ code, redirectUri, nonce }) {
      const res = await fetchImpl(APPLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: buildClientSecret(cfg, { now }),
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }).toString(),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.id_token !== 'string') {
        const err = new Error(`apple token exchange failed (${res.status} ${body?.error ?? ''})`.trim());
        err.code = 'token_exchange_failed';
        throw err;
      }
      return verify(body.id_token, nonce);
    },
  };
}
