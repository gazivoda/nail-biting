// Sign in with Microsoft (Microsoft identity platform v2.0, authorization code + PKCE).
//
// Owner setup (docs/agents/ws8-notes.md): an app registration with a web redirect
// URI and a client secret. From the environment:
//
//   MICROSOFT_CLIENT_ID      Application (client) ID
//   MICROSOFT_CLIENT_SECRET  a client secret VALUE
//   MICROSOFT_TENANT         common (default) | consumers | organizations | a tenant GUID/domain
//
// Identity: a person is (tid, oid), never their email. Microsoft's docs: the
// `email` claim "isn't guaranteed to be correct and is mutable over time. Never use
// it for authorization or to save data for a user" (the "nOAuth" problem: an admin
// of any work tenant can put any address in it). `oid` is the immutable user id
// within a tenant, `tid` the tenant; `sub` is pairwise per app and only a fallback.
// Whether the email may be used to join an existing account is decided in
// linkPolicy.js (personal account tenant, or the optional `xms_edov` claim).

import { createHash, randomBytes } from 'node:crypto';
import { createJwksCache, verifyIdToken } from './jwks.js';
import { MS_PERSONAL_TENANT } from './linkPolicy.js';

const LOGIN_HOST = 'https://login.microsoftonline.com';
/** The "common" key set contains the signing keys for every tenant and for personal accounts. */
export const MICROSOFT_KEYS_URL = `${LOGIN_HOST}/common/discovery/v2.0/keys`;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TENANT_OK = /^(common|consumers|organizations|[0-9a-f-]{36}|[A-Za-z0-9.-]{3,253})$/;

/** @returns {{ clientId: string, clientSecret: string, tenant: string } | null} null when not configured */
export function microsoftConfigFromEnv(env = process.env) {
  const clientId = env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = env.MICROSOFT_CLIENT_SECRET?.trim();
  const tenant = (env.MICROSOFT_TENANT?.trim() || 'common');
  if (!clientId || !clientSecret || !TENANT_OK.test(tenant)) return null;
  return { clientId, clientSecret, tenant };
}

/** PKCE (RFC 7636), S256. */
export function createPkcePair() {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildAuthorizeUrl(cfg, { redirectUri, state, nonce, challenge }) {
  const url = new URL(`${LOGIN_HOST}/${cfg.tenant}/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

/**
 * The issuer of a v2.0 id token is https://login.microsoftonline.com/<tid>/v2.0,
 * so with the "common" endpoint it differs per tenant. Validate it against the
 * token's own `tid`, then apply the tenant restriction configured by the owner.
 */
export function microsoftIssuerOk(claims, cfg) {
  const tid = claims?.tid;
  if (typeof tid !== 'string' || !GUID.test(tid)) return false;
  if (claims.iss !== `${LOGIN_HOST}/${tid}/v2.0`) return false;
  const t = cfg.tenant.toLowerCase();
  if (GUID.test(t)) return tid.toLowerCase() === t;
  if (t === 'consumers') return tid === MS_PERSONAL_TENANT;
  if (t === 'organizations') return tid !== MS_PERSONAL_TENANT;
  return true; // common, or a verified-domain tenant name (Microsoft routes it; the signature + iss check still hold)
}

/** The stable identity key for a verified Microsoft id token. */
export function microsoftSubject(claims) {
  return `${claims.tid}:${claims.oid || claims.sub}`;
}

export function createMicrosoftClient({ cfg, fetchImpl = fetch, now = Date.now, jwks } = {}) {
  const keys = jwks ?? createJwksCache({ url: MICROSOFT_KEYS_URL, fetchImpl, now });

  const verify = (idToken, nonce) => verifyIdToken(idToken, {
    jwks: keys,
    audience: cfg.clientId,
    nonce,
    now,
    issuerOk: claims => microsoftIssuerOk(claims, cfg),
  });

  return {
    verifyIdToken: verify,

    async exchangeCode({ code, redirectUri, codeVerifier, nonce }) {
      const res = await fetchImpl(`${LOGIN_HOST}/${cfg.tenant}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
          scope: 'openid profile email',
        }).toString(),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.id_token !== 'string') {
        const err = new Error(`microsoft token exchange failed (${res.status} ${body?.error ?? ''})`.trim());
        err.code = 'token_exchange_failed';
        throw err;
      }
      return verify(body.id_token, nonce);
    },
  };
}
