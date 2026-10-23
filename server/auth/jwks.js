// ID token verification against a provider's published keys (JWKS).
//
// Used for Apple and Microsoft. No dependencies beyond node:crypto and
// jsonwebtoken (already installed): each JWK becomes a KeyObject with
// createPublicKey, and jsonwebtoken checks signature, algorithm, audience and
// expiry. Issuer, nonce and anything provider-specific are checked here.
//
// Keys are cached for an hour. A token signed with a key we have not seen
// triggers ONE re-fetch (providers rotate keys), but never more often than once a
// minute, so garbage tokens cannot make us hammer the provider. If the provider
// cannot be reached, keys we already hold keep working.

import { createPublicKey, createHash, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';

export class IdTokenError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.name = 'IdTokenError';
    this.code = code;
  }
}

/**
 * @param {object} opts
 * @param {string} opts.url  the provider's jwks_uri
 */
export function createJwksCache({ url, fetchImpl = fetch, now = Date.now, ttlMs = 60 * 60 * 1000, minRefetchMs = 60 * 1000 }) {
  let keys = new Map();
  let fetchedAt = 0;
  let inflight = null;

  async function refresh() {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`jwks http ${res.status}`);
        const body = await res.json();
        const next = new Map();
        for (const jwk of body?.keys ?? []) {
          if (jwk?.kty !== 'RSA' || typeof jwk.kid !== 'string') continue;
          if (jwk.use && jwk.use !== 'sig') continue;
          if (jwk.alg && jwk.alg !== 'RS256') continue;
          try { next.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' })); } catch { /* skip a malformed key */ }
        }
        if (next.size === 0) throw new Error('jwks has no usable keys');
        keys = next;
        fetchedAt = now();
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  return {
    /** @returns {Promise<import('node:crypto').KeyObject>} */
    async getKey(kid) {
      const t = now();
      const fresh = keys.size > 0 && t - fetchedAt < ttlMs;
      if (fresh && keys.has(kid)) return keys.get(kid);

      // Stale, empty, or unknown kid: re-fetch, rate limited.
      const mayFetch = keys.size === 0 || t - fetchedAt >= minRefetchMs;
      if (mayFetch) {
        try { await refresh(); } catch (err) {
          if (keys.size === 0) throw new IdTokenError('jwks_unavailable', err.message);
          // keep serving the keys we have
        }
      }
      const key = keys.get(kid);
      if (!key) throw new IdTokenError('unknown_key', 'no signing key with that kid');
      return key;
    },
  };
}

const sameString = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  // Hash first so the comparison is constant-time whatever the lengths.
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
};

/**
 * Verifies an OpenID Connect ID token and returns its claims.
 * Throws IdTokenError (never returns unverified claims).
 *
 * @param {string} idToken
 * @param {object} opts
 * @param {{ getKey(kid: string): Promise<import('node:crypto').KeyObject> }} opts.jwks
 * @param {string} opts.audience              our client id
 * @param {string} opts.nonce                 the nonce we sent
 * @param {(claims: object) => boolean} opts.issuerOk   provider-specific issuer rule
 * @param {number} [opts.clockToleranceSec]
 * @param {() => number} [opts.now]   clock in ms (tests)
 */
export async function verifyIdToken(idToken, { jwks, audience, nonce, issuerOk, clockToleranceSec = 60, now = Date.now }) {
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 16384) {
    throw new IdTokenError('malformed');
  }
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded.header?.kid !== 'string') throw new IdTokenError('malformed');
  // Pin the algorithm before touching a key: never "none", never HS* (which would
  // let a token be "signed" with the public key as an HMAC secret).
  if (decoded.header.alg !== 'RS256') throw new IdTokenError('bad_algorithm');

  const key = await jwks.getKey(decoded.header.kid);

  let claims;
  try {
    claims = jwt.verify(idToken, key, {
      algorithms: ['RS256'], audience, clockTolerance: clockToleranceSec, clockTimestamp: Math.floor(now() / 1000),
    });
  } catch (err) {
    const code = err?.name === 'TokenExpiredError' ? 'expired'
      : /audience/i.test(err?.message ?? '') ? 'bad_audience'
        : 'bad_signature';
    throw new IdTokenError(code, err?.message);
  }
  if (typeof claims !== 'object' || claims === null) throw new IdTokenError('malformed');
  if (!issuerOk(claims)) throw new IdTokenError('bad_issuer');
  if (typeof claims.sub !== 'string' || claims.sub === '') throw new IdTokenError('malformed');
  if (!sameString(claims.nonce, nonce)) throw new IdTokenError('bad_nonce');
  return claims;
}
