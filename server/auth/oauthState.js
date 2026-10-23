// State for an in-flight OAuth sign-in (Apple, Microsoft).
//
// `state` is the unguessable value that goes to the provider and comes back; the
// matching row remembers the nonce (and the PKCE verifier for Microsoft). Only a
// SHA-256 of `state` is stored. A row is single use and expires after ten
// minutes. It lives in the database rather than in a cookie so that the flow also
// works when the browser that finishes sign-in is not the one that started it
// (the desktop app opens the system browser, which has no cookie from the app),
// and so that the PKCE verifier never travels through the browser.
//
// Browser binding (a cookie holding `state`) is layered on top by the route
// module for the web flow, exactly like the Google flow's oauth_state cookie.
//
// Apple returns by POSTing a form from appleid.apple.com (a cross-site POST, which
// browsers treat very differently from a GET: SameSite=Lax cookies are not sent
// with it). So the POST only parks what Apple sent on the row (`attach`) and
// redirects to a GET on our own site, which is where the cookie is checked and the
// sign-in finishes. The authorization code therefore never sits in a URL.

import { createHash, randomBytes } from 'node:crypto';

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const sha256 = value => createHash('sha256').update(value).digest('hex');
const shapeOk = state => typeof state === 'string' && state.length >= 16 && state.length <= 128;

export function createOAuthStateStore(db, { now = Date.now, ttlMs = OAUTH_STATE_TTL_MS } = {}) {
  const insert = db.prepare(`
    INSERT INTO auth_oauth_states (state_hash, provider, nonce, code_verifier, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const select = db.prepare('SELECT * FROM auth_oauth_states WHERE state_hash = ?');
  const remove = db.prepare('DELETE FROM auth_oauth_states WHERE state_hash = ?');
  const purge = db.prepare('DELETE FROM auth_oauth_states WHERE expires_at <= ?');
  const park = db.prepare(`
    UPDATE auth_oauth_states
       SET auth_code = ?, profile_name = ?, provider_error = ?, attached = 1
     WHERE state_hash = ? AND provider = ? AND attached = 0 AND expires_at > ?`);

  const consumeTx = db.transaction((state, provider) => {
    const hash = sha256(state);
    const row = select.get(hash);
    if (!row) return null;
    remove.run(hash); // single use, even if it turns out to be expired or for another provider
    if (row.provider !== provider) return null;
    if (row.expires_at <= now()) return null;
    return {
      nonce: row.nonce,
      codeVerifier: row.code_verifier ?? null,
      attached: row.attached === 1,
      authCode: row.auth_code ?? null,
      profileName: row.profile_name ?? null,
      providerError: row.provider_error ?? null,
    };
  });

  return {
    /** @returns {{ state: string, nonce: string }} */
    create({ provider, codeVerifier = null }) {
      purge.run(now());
      const state = randomBytes(24).toString('base64url');
      const nonce = randomBytes(24).toString('base64url');
      const t = now();
      insert.run(sha256(state), provider, nonce, codeVerifier, t, t + ttlMs);
      return { state, nonce };
    },

    /**
     * Apple only: remembers what the provider posted back, once, against a state
     * we issued. @returns {boolean} false when the state is unknown, expired,
     * for another provider, or already used for a return.
     */
    attach(state, provider, { code = null, name = null, error = null }) {
      if (!shapeOk(state)) return false;
      const clip = (v, n) => (typeof v === 'string' && v ? v.slice(0, n) : null);
      return park.run(clip(code, 2048), clip(name, 100), clip(error, 100), sha256(state), provider, now()).changes === 1;
    },

    /** @returns {object | null} null when unknown, used, expired or for another provider */
    consume(state, provider) {
      if (!shapeOk(state)) return null;
      return consumeTx(state, provider);
    },
  };
}
