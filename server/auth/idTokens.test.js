// Apple client secret and Apple / Microsoft id_token validation, with locally
// generated keys and a mocked JWKS endpoint. No network.

import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, createPublicKey, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { makeSigningKey, fakeFetch } from '../../test-utils/authHarness.js';
import { createJwksCache, verifyIdToken, IdTokenError } from './jwks.js';
import {
  APPLE_ISSUER, appleConfigFromEnv, buildAuthorizeUrl as appleUrl, buildClientSecret, createAppleClient,
  normalizePrivateKey, parseAppleUserName,
} from './apple.js';
import {
  buildAuthorizeUrl as msUrl, createMicrosoftClient, createPkcePair, microsoftConfigFromEnv, microsoftIssuerOk,
  microsoftSubject,
} from './microsoft.js';
import { MS_PERSONAL_TENANT } from './linkPolicy.js';

const NOW = 1_800_000_000_000;
const sec = Math.floor(NOW / 1000);

function appleKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return { pem: privateKey.export({ type: 'pkcs8', format: 'pem' }), publicKey };
}

describe('Apple: client secret', () => {
  const { pem, publicKey } = appleKeys();
  const cfg = { clientId: 'today.stopbiting.web', teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey: pem };

  it('is an ES256 JWT with the claims Apple documents, verifiable with the matching public key', () => {
    const secret = buildClientSecret(cfg, { now: () => NOW });
    const { header } = jwt.decode(secret, { complete: true });
    expect(header).toMatchObject({ alg: 'ES256', kid: 'KEY1234567' });
    const claims = jwt.verify(secret, publicKey, { algorithms: ['ES256'], audience: APPLE_ISSUER, issuer: 'TEAM123456', subject: 'today.stopbiting.web', clockTimestamp: sec });
    expect(claims.iat).toBe(sec);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(15777000); // Apple's 6 month cap
    expect(claims.exp - claims.iat).toBe(300);
  });

  it('is a raw (r||s) ES256 signature, as JOSE requires, so Apple accepts it', () => {
    const secret = buildClientSecret(cfg, { now: () => NOW });
    const sig = Buffer.from(secret.split('.')[2], 'base64url');
    expect(sig.length).toBe(64);
  });

  it('is rejected by a different key', () => {
    const other = appleKeys();
    const secret = buildClientSecret(cfg, { now: () => NOW });
    expect(() => jwt.verify(secret, other.publicKey, { algorithms: ['ES256'], clockTimestamp: sec })).toThrow();
  });

  it('config needs all four variables', () => {
    const env = { APPLE_CLIENT_ID: 'c', APPLE_TEAM_ID: 't', APPLE_KEY_ID: 'k', APPLE_PRIVATE_KEY: pem };
    expect(appleConfigFromEnv(env)).toMatchObject({ clientId: 'c', teamId: 't', keyId: 'k' });
    for (const missing of Object.keys(env)) {
      expect(appleConfigFromEnv({ ...env, [missing]: '' })).toBeNull();
    }
    expect(appleConfigFromEnv({})).toBeNull();
    expect(appleConfigFromEnv({ ...env, APPLE_PRIVATE_KEY: 'not a key' })).toBeNull();
  });

  it('accepts the private key with real newlines, with literal \\n, or base64 encoded', () => {
    const asLiteral = pem.trim().replace(/\n/g, '\\n');
    const asBase64 = Buffer.from(pem).toString('base64');
    for (const form of [pem, asLiteral, `"${asLiteral}"`, asBase64]) {
      const key = normalizePrivateKey(form);
      expect(key).toContain('BEGIN PRIVATE KEY');
      // and it actually signs
      expect(() => buildClientSecret({ ...cfg, privateKey: key }, { now: () => NOW })).not.toThrow();
    }
  });

  it('authorize URL asks for name+email with form_post, and carries state and nonce', () => {
    const url = new URL(appleUrl(cfg, { redirectUri: 'https://stopbiting.today/auth/apple/callback', state: 'S', nonce: 'N' }));
    expect(url.origin + url.pathname).toBe('https://appleid.apple.com/auth/authorize');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code', response_mode: 'form_post', client_id: 'today.stopbiting.web',
      scope: 'name email', state: 'S', nonce: 'N',
      redirect_uri: 'https://stopbiting.today/auth/apple/callback',
    });
  });
});

describe('Apple: the name Apple posts on first authorization', () => {
  it('builds a display name and strips markup', () => {
    expect(parseAppleUserName(JSON.stringify({ name: { firstName: 'Ann', lastName: 'Lee' }, email: 'a@x.com' }))).toBe('Ann Lee');
    expect(parseAppleUserName(JSON.stringify({ name: { firstName: '<b>Ann</b>' } }))).toBe('bAnn/b');
  });
  it('is null for missing, malformed or oversized input', () => {
    expect(parseAppleUserName(undefined)).toBeNull();
    expect(parseAppleUserName('{not json')).toBeNull();
    expect(parseAppleUserName(JSON.stringify({}))).toBeNull();
    expect(parseAppleUserName('x'.repeat(5000))).toBeNull();
  });
});

describe('id_token verification (shared by Apple and Microsoft)', () => {
  const key = makeSigningKey('k1');
  const jwksFetch = (extra = {}) => fakeFetch({ 'https://keys.test/': () => ({ body: { keys: [key.jwk] } }), ...extra });
  const base = { iss: 'https://issuer.test', aud: 'client-1', sub: 'sub-1', nonce: 'nonce-1', exp: sec + 600, iat: sec };
  const make = (jwks = createJwksCache({ url: 'https://keys.test/', fetchImpl: jwksFetch(), now: () => NOW })) => ({
    jwks,
    verify: (token, over = {}) => verifyIdToken(token, {
      jwks, audience: 'client-1', nonce: 'nonce-1', issuerOk: c => c.iss === 'https://issuer.test', clockToleranceSec: 0, now: () => NOW, ...over,
    }),
  });
  const reject = async (promise, code) => {
    const err = await promise.then(() => null, e => e);
    expect(err).toBeInstanceOf(IdTokenError);
    expect(err.code).toBe(code);
  };

  it('accepts a good token (jsonwebtoken takes the KeyObject built from the JWK)', async () => {
    const { verify } = make();
    const claims = await verify(key.sign({ ...base, email: 'a@x.com' }), {});
    expect(claims).toMatchObject({ sub: 'sub-1', email: 'a@x.com' });
  });

  it('rejects a bad signature (token signed by someone else)', async () => {
    const other = makeSigningKey('k1'); // same kid, different key
    await reject(make().verify(other.sign(base)), 'bad_signature');
  });

  it('rejects the wrong audience', async () => {
    await reject(make().verify(key.sign({ ...base, aud: 'someone-else' })), 'bad_audience');
  });

  it('rejects the wrong issuer', async () => {
    await reject(make().verify(key.sign({ ...base, iss: 'https://evil.test' })), 'bad_issuer');
  });

  it('rejects an expired token', async () => {
    await reject(make().verify(key.sign({ ...base, exp: sec - 10 })), 'expired');
  });

  it('rejects a nonce mismatch, and a missing nonce', async () => {
    await reject(make().verify(key.sign({ ...base, nonce: 'other' })), 'bad_nonce');
    const { nonce: _omit, ...noNonce } = base;
    await reject(make().verify(key.sign(noNonce)), 'bad_nonce');
  });

  it('rejects alg=none and HS256 "signed" with the public key (algorithm confusion)', async () => {
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none', kid: 'k1' })).toString('base64url')}.${Buffer.from(JSON.stringify(base)).toString('base64url')}.`;
    await reject(make().verify(unsigned), 'bad_algorithm');
    const pubPem = createPublicKey(key.privateKey).export({ type: 'spki', format: 'pem' });
    const hs = jwt.sign(base, pubPem, { algorithm: 'HS256', keyid: 'k1' });
    await reject(make().verify(hs), 'bad_algorithm');
  });

  it('rejects garbage and tokens with no kid', async () => {
    await reject(make().verify('not-a-jwt-at-all-really'), 'malformed');
    await reject(make().verify(jwt.sign(base, key.privateKey, { algorithm: 'RS256' })), 'malformed');
  });

  it('rejects a token with no subject', async () => {
    const { sub: _s, ...noSub } = base;
    await reject(make().verify(key.sign(noSub)), 'malformed');
  });

  it('an unknown kid triggers one refetch (key rotation), at most once a minute', async () => {
    let clock = NOW;
    const keys = [key.jwk];
    const f = fakeFetch({ 'https://keys.test/': () => ({ body: { keys } }) });
    const jwks = createJwksCache({ url: 'https://keys.test/', fetchImpl: f, now: () => clock });
    const { verify } = make(jwks);
    await verify(key.sign(base));
    expect(f.calls).toHaveLength(1);

    const rotated = makeSigningKey('k2');
    keys.push(rotated.jwk);
    clock += 61_000;
    await verify(rotated.sign(base)); // k2 unknown -> refetch -> found
    expect(f.calls).toHaveLength(2);

    // garbage kids cannot make us hammer the provider
    const ghost = makeSigningKey('ghost');
    await reject(verify(ghost.sign(base)), 'unknown_key');
    await reject(verify(ghost.sign(base)), 'unknown_key');
    expect(f.calls.length).toBeLessThanOrEqual(3);
  });

  it('keeps serving cached keys when the provider is unreachable', async () => {
    let clock = NOW;
    let down = false;
    const f = async () => { if (down) throw new Error('offline'); return new Response(JSON.stringify({ keys: [key.jwk] })); };
    const jwks = createJwksCache({ url: 'https://keys.test/', fetchImpl: f, now: () => clock });
    const { verify } = make(jwks);
    await verify(key.sign(base));
    down = true;
    clock += 2 * 60 * 60 * 1000; // cache is stale
    await expect(verify(key.sign({ ...base, exp: sec + 99999 }), {})).resolves.toBeTruthy();
  });

  it('fails closed when keys were never fetched and the provider is down', async () => {
    const jwks = createJwksCache({ url: 'https://keys.test/', fetchImpl: async () => { throw new Error('offline'); }, now: () => NOW });
    await reject(make(jwks).verify(key.sign(base)), 'jwks_unavailable');
  });

  it('ignores keys that are not RS256 signing keys', async () => {
    const f = fakeFetch({ 'https://keys.test/': () => ({ body: { keys: [{ ...key.jwk, use: 'enc' }, { ...key.jwk, kid: 'k9', alg: 'RS512' }, { kty: 'EC', kid: 'e1' }] } }) });
    const jwks = createJwksCache({ url: 'https://keys.test/', fetchImpl: f, now: () => NOW });
    await reject(make(jwks).verify(key.sign(base)), 'jwks_unavailable');
  });
});

describe('Apple: full code exchange against a mocked Apple', () => {
  const rsa = makeSigningKey('apple-key-1');
  const { pem, publicKey } = appleKeys();
  const cfg = { clientId: 'today.stopbiting.web', teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey: pem };
  const claims = { iss: APPLE_ISSUER, aud: cfg.clientId, sub: '001234.abc.5678', nonce: 'N1', exp: sec + 600, iat: sec, email: 'ann@example.com', email_verified: 'true' };

  function client(idToken) {
    const f = fakeFetch({
      'https://appleid.apple.com/auth/keys': () => ({ body: { keys: [rsa.jwk] } }),
      'https://appleid.apple.com/auth/token': (_url, init) => {
        const form = new URLSearchParams(init.body);
        // Apple would verify our client secret with the public half of the .p8 key
        jwt.verify(form.get('client_secret'), publicKey, { algorithms: ['ES256'], clockTimestamp: sec });
        expect(form.get('grant_type')).toBe('authorization_code');
        expect(form.get('code')).toBe('the-code');
        expect(form.get('client_id')).toBe(cfg.clientId);
        expect(form.get('redirect_uri')).toBe('https://stopbiting.today/auth/apple/callback');
        return { body: { id_token: idToken, access_token: 'x', token_type: 'Bearer' } };
      },
    });
    return { f, c: createAppleClient({ cfg, fetchImpl: f, now: () => NOW }) };
  }

  it('exchanges the code with a valid client secret and verifies the id_token', async () => {
    const { c } = client(rsa.sign(claims));
    const out = await c.exchangeCode({ code: 'the-code', redirectUri: 'https://stopbiting.today/auth/apple/callback', nonce: 'N1' });
    expect(out).toMatchObject({ sub: '001234.abc.5678', email: 'ann@example.com' });
  });

  it('fails when the nonce is not the one we sent', async () => {
    const { c } = client(rsa.sign({ ...claims, nonce: 'replayed' }));
    await expect(c.exchangeCode({ code: 'the-code', redirectUri: 'https://stopbiting.today/auth/apple/callback', nonce: 'N1' })).rejects.toMatchObject({ code: 'bad_nonce' });
  });

  it('fails when Apple answers with an error', async () => {
    const f = fakeFetch({ 'https://appleid.apple.com/auth/token': () => ({ status: 400, body: { error: 'invalid_grant' } }) });
    const c = createAppleClient({ cfg, fetchImpl: f, now: () => NOW });
    await expect(c.exchangeCode({ code: 'x', redirectUri: 'r', nonce: 'N1' })).rejects.toMatchObject({ code: 'token_exchange_failed' });
  });
});

describe('Microsoft', () => {
  const WORK = '11111111-2222-3333-4444-555555555555';
  const cfg = { clientId: 'ms-client', clientSecret: 'ms-secret', tenant: 'common' };
  const rsa = makeSigningKey('ms-key-1');
  const claimsFor = (tid, over = {}) => ({
    iss: `https://login.microsoftonline.com/${tid}/v2.0`, aud: 'ms-client', tid, oid: 'oid-1', sub: 'pairwise-sub',
    nonce: 'N1', exp: sec + 600, iat: sec, email: 'bob@outlook.com', name: 'Bob', ...over,
  });

  it('config: tenant defaults to common and bad tenants are refused', () => {
    expect(microsoftConfigFromEnv({ MICROSOFT_CLIENT_ID: 'a', MICROSOFT_CLIENT_SECRET: 'b' })).toEqual({ clientId: 'a', clientSecret: 'b', tenant: 'common' });
    expect(microsoftConfigFromEnv({ MICROSOFT_CLIENT_ID: 'a', MICROSOFT_CLIENT_SECRET: 'b', MICROSOFT_TENANT: WORK }).tenant).toBe(WORK);
    expect(microsoftConfigFromEnv({ MICROSOFT_CLIENT_ID: 'a' })).toBeNull();
    expect(microsoftConfigFromEnv({ MICROSOFT_CLIENT_ID: 'a', MICROSOFT_CLIENT_SECRET: 'b', MICROSOFT_TENANT: 'x/../y' })).toBeNull();
  });

  it('PKCE: the challenge is the S256 of the verifier', () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
  });

  it('authorize URL: code flow, PKCE S256, state, nonce, openid profile email', () => {
    const url = new URL(msUrl(cfg, { redirectUri: 'https://stopbiting.today/api/auth/microsoft/callback', state: 'S', nonce: 'N', challenge: 'C' }));
    expect(url.origin + url.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'ms-client', response_type: 'code', response_mode: 'query', scope: 'openid profile email',
      state: 'S', nonce: 'N', code_challenge: 'C', code_challenge_method: 'S256',
    });
  });

  it('issuer is checked against the token\'s own tid (it differs per tenant under "common")', () => {
    expect(microsoftIssuerOk(claimsFor(WORK), cfg)).toBe(true);
    expect(microsoftIssuerOk(claimsFor(MS_PERSONAL_TENANT), cfg)).toBe(true);
    expect(microsoftIssuerOk({ ...claimsFor(WORK), iss: `https://login.microsoftonline.com/${MS_PERSONAL_TENANT}/v2.0` }, cfg)).toBe(false);
    expect(microsoftIssuerOk({ ...claimsFor(WORK), iss: 'https://evil.test/v2.0' }, cfg)).toBe(false);
    expect(microsoftIssuerOk({ ...claimsFor(WORK), tid: 'not-a-guid' }, cfg)).toBe(false);
    expect(microsoftIssuerOk({ ...claimsFor(WORK), tid: undefined }, cfg)).toBe(false);
  });

  it('a configured tenant restricts who may sign in', () => {
    expect(microsoftIssuerOk(claimsFor(WORK), { ...cfg, tenant: WORK })).toBe(true);
    expect(microsoftIssuerOk(claimsFor('99999999-2222-3333-4444-555555555555'), { ...cfg, tenant: WORK })).toBe(false);
    expect(microsoftIssuerOk(claimsFor(MS_PERSONAL_TENANT), { ...cfg, tenant: 'consumers' })).toBe(true);
    expect(microsoftIssuerOk(claimsFor(WORK), { ...cfg, tenant: 'consumers' })).toBe(false);
    expect(microsoftIssuerOk(claimsFor(WORK), { ...cfg, tenant: 'organizations' })).toBe(true);
    expect(microsoftIssuerOk(claimsFor(MS_PERSONAL_TENANT), { ...cfg, tenant: 'organizations' })).toBe(false);
  });

  it('the identity key is tenant + oid, never the email; sub is only a fallback', () => {
    expect(microsoftSubject({ tid: WORK, oid: 'o1', sub: 's1', email: 'a@x.com' })).toBe(`${WORK}:o1`);
    expect(microsoftSubject({ tid: WORK, sub: 's1' })).toBe(`${WORK}:s1`);
  });

  function client(idToken) {
    const f = fakeFetch({
      'https://login.microsoftonline.com/common/discovery/v2.0/keys': () => ({ body: { keys: [rsa.jwk] } }),
      'https://login.microsoftonline.com/common/oauth2/v2.0/token': (_url, init) => {
        const form = new URLSearchParams(init.body);
        expect(form.get('code_verifier')).toBe('verifier-1');
        expect(form.get('client_secret')).toBe('ms-secret');
        expect(form.get('grant_type')).toBe('authorization_code');
        return { body: { id_token: idToken } };
      },
    });
    return createMicrosoftClient({ cfg, fetchImpl: f, now: () => NOW });
  }
  const exchange = c => c.exchangeCode({ code: 'c', redirectUri: 'r', codeVerifier: 'verifier-1', nonce: 'N1' });

  it('verifies a personal-account token', async () => {
    const out = await exchange(client(rsa.sign(claimsFor(MS_PERSONAL_TENANT))));
    expect(out).toMatchObject({ tid: MS_PERSONAL_TENANT, oid: 'oid-1' });
  });

  it('verifies a work-tenant token (different issuer, same keys)', async () => {
    const out = await exchange(client(rsa.sign(claimsFor(WORK))));
    expect(out.tid).toBe(WORK);
  });

  it('rejects wrong nonce, wrong audience, forged issuer, bad signature', async () => {
    await expect(exchange(client(rsa.sign(claimsFor(WORK, { nonce: 'x' }))))).rejects.toMatchObject({ code: 'bad_nonce' });
    await expect(exchange(client(rsa.sign(claimsFor(WORK, { aud: 'other-app' }))))).rejects.toMatchObject({ code: 'bad_audience' });
    await expect(exchange(client(rsa.sign(claimsFor(WORK, { iss: 'https://login.microsoftonline.com/other/v2.0' }))))).rejects.toMatchObject({ code: 'bad_issuer' });
    await expect(exchange(client(makeSigningKey('ms-key-1').sign(claimsFor(WORK))))).rejects.toMatchObject({ code: 'bad_signature' });
  });
});
