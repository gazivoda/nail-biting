import { describe, expect, it } from 'vitest';
import { TOKEN_BYTES, generateToken, hashToken, isWellFormedToken } from './tokens.js';

describe('tokens', () => {
  it('are 32 random bytes as 43 base64url characters', () => {
    const t = generateToken();
    expect(TOKEN_BYTES).toBe(32);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(t, 'base64url')).toHaveLength(32);
  });

  it('do not repeat', () => {
    const seen = new Set(Array.from({ length: 5000 }, () => generateToken()));
    expect(seen.size).toBe(5000);
  });

  it('use all 256 bits: a token can contain both cases (so a lower-casing redirect would break it)', () => {
    const tokens = Array.from({ length: 50 }, () => generateToken());
    expect(tokens.some(t => /[A-Z]/.test(t) && /[a-z]/.test(t))).toBe(true);
  });

  it('hash to a stable 64-character hex SHA-256 that does not contain the token', () => {
    const t = generateToken();
    const h = hashToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(h);
    expect(h).not.toContain(t);
    expect(hashToken(t + 'x')).not.toBe(h);
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'); // SHA-256 test vector
  });

  it('are recognised by shape, and nothing else is', () => {
    expect(isWellFormedToken(generateToken())).toBe(true);
    for (const bad of ['', 'abc', 'a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}=`, `${'a'.repeat(42)}+`, `${'a'.repeat(42)}/`,
      `${'a'.repeat(42)} `, `${'a'.repeat(42)}\n`, null, undefined, 5, {}, [], ['a'.repeat(43)]]) {
      expect(isWellFormedToken(bad), String(bad)).toBe(false);
    }
  });
});
