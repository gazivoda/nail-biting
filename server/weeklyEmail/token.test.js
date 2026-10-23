import { describe, it, expect } from 'vitest';
import { signUnsubscribeToken, verifyUnsubscribeToken, readUnsubscribeToken, newUnsubscribeSecret } from './token.js';

const secretA = newUnsubscribeSecret();
const secretB = newUnsubscribeSecret();

describe('unsubscribe token', () => {
  it('a secret is long, random and different every time', () => {
    expect(secretA).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(secretA).not.toBe(secretB);
  });

  it('signs and verifies for the user it names, with that user\'s secret', () => {
    const t = signUnsubscribeToken('1234567890', secretA);
    expect(t).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(readUnsubscribeToken(t)?.userId).toBe('1234567890');
    expect(verifyUnsubscribeToken(t, secretA)).toBe(true);
  });

  it('is stable (the same inputs give the same link)', () => {
    expect(signUnsubscribeToken('u1', secretA)).toBe(signUnsubscribeToken('u1', secretA));
  });

  it('does not verify with another person\'s secret, or after the secret was rotated', () => {
    const t = signUnsubscribeToken('u1', secretA);
    expect(verifyUnsubscribeToken(t, secretB)).toBe(false);
    expect(verifyUnsubscribeToken(t, newUnsubscribeSecret())).toBe(false);
  });

  it('a token made for one user cannot be pointed at another', () => {
    const [, mac] = signUnsubscribeToken('victim', secretA).split('.');
    const forged = `${Buffer.from('attacker').toString('base64url')}.${mac}`;
    expect(readUnsubscribeToken(forged)?.userId).toBe('attacker');
    expect(verifyUnsubscribeToken(forged, secretA)).toBe(false);
    expect(verifyUnsubscribeToken(forged, secretB)).toBe(false);
  });

  it('rejects a tampered MAC, a truncated token and wrong-shaped input without throwing', () => {
    const t = signUnsubscribeToken('u1', secretA);
    const [id, mac] = t.split('.');
    const flipped = mac.slice(0, -1) + (mac.endsWith('A') ? 'B' : 'A');
    const bad = [
      `${id}.${flipped}`,
      t.slice(0, -4),
      t.slice(0, t.indexOf('.')),
      `${id}.`,
      `.${mac}`,
      `${id}.${mac}.${mac}`,
      `${id}.${mac}=`,
      `${id} .${mac}`,
      '',
      '.',
      'not a token',
      'x'.repeat(500),
      `${'A'.repeat(300)}.${mac}`,
    ];
    for (const b of bad) {
      expect(verifyUnsubscribeToken(b, secretA), JSON.stringify(b)).toBe(false);
      expect(readUnsubscribeToken(b) === null || verifyUnsubscribeToken(b, secretA) === false).toBe(true);
    }
    for (const nonString of [undefined, null, 12, {}, [], true]) {
      expect(verifyUnsubscribeToken(nonString, secretA)).toBe(false);
      expect(readUnsubscribeToken(nonString)).toBeNull();
    }
  });

  it('refuses a missing or short secret instead of signing with nothing', () => {
    expect(() => signUnsubscribeToken('u1', '')).toThrow();
    expect(() => signUnsubscribeToken('u1', 'short')).toThrow();
    expect(() => signUnsubscribeToken('u1', undefined)).toThrow();
    expect(verifyUnsubscribeToken(signUnsubscribeToken('u1', secretA), '')).toBe(false);
    expect(verifyUnsubscribeToken(signUnsubscribeToken('u1', secretA), undefined)).toBe(false);
  });

  it('works for unusual but legal ids (uuid, non-ASCII) and refuses an absurdly long one', () => {
    for (const id of ['3f2b8c1e-9d4a-4c0e-8a53-0a1b2c3d4e5f', 'Zoë-1', 'a.b-c_d']) {
      const t = signUnsubscribeToken(id, secretA);
      expect(readUnsubscribeToken(t)?.userId).toBe(id);
      expect(verifyUnsubscribeToken(t, secretA)).toBe(true);
    }
    expect(() => signUnsubscribeToken('x'.repeat(200), secretA)).toThrow();
  });

  it('the link carries no secret: the secret does not appear in the token', () => {
    const t = signUnsubscribeToken('u1', secretA);
    expect(t).not.toContain(secretA);
    expect(t).not.toContain(secretA.slice(0, 12));
  });
});
