import { describe, it, expect } from 'vitest';
import { compareEventVersions as serverCompare, canonicalEvent as serverCanonical } from './compare.js';
import { compareEventVersions as clientCompare, canonicalEvent as clientCanonical } from '../../src/storage/eventModel.ts';

// A tiny seeded generator so a failure can be reproduced.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomVersion(r) {
  const pick = list => list[Math.floor(r() * list.length)];
  const e = {
    id: 'x',
    ts: pick([1000, 1000, 2000]),
    source: pick(['alarm', 'manual']),
    behavior: pick(['nail_biting', 'cuticle_skin_biting']),
    // Few distinct times, so ties are common.
    updatedAt: pick([100, 100, 200, 300]),
  };
  if (r() < 0.6) e.deviceId = pick(['dev-a', 'dev-b', 'dev-b']);
  if (r() < 0.5) e.deleted = true;
  if (r() < 0.5) e.hand = pick(['left', 'right', 'unknown']);
  if (r() < 0.5) e.triggers = pick([['stress'], ['boredom'], ['stress', 'focus'], []]);
  if (r() < 0.4) e.falsePositive = r() < 0.5;
  if (r() < 0.4) e.confirmed = r() < 0.5;
  if (r() < 0.4) e.competingResponse = r() < 0.5 ? { done: r() < 0.5 } : { done: true, durationSec: pick([5, 12.5]) };
  return e;
}

describe('compareEventVersions', () => {
  it('the server and the client agree on 20,000 random pairs, ties included', () => {
    const r = rng(42);
    let ties = 0;
    for (let i = 0; i < 20000; i++) {
      const a = randomVersion(r);
      const b = randomVersion(r);
      expect(serverCompare(a, b)).toBe(clientCompare(a, b));
      expect(serverCanonical(a)).toBe(clientCanonical(a));
      if (a.updatedAt === b.updatedAt) ties++;
    }
    expect(ties).toBeGreaterThan(1000);
  });

  it('is antisymmetric, and 0 only for identical content', () => {
    const r = rng(7);
    for (let i = 0; i < 5000; i++) {
      const a = randomVersion(r);
      const b = randomVersion(r);
      expect(serverCompare(a, b) < 0).toBe(serverCompare(b, a) > 0);
      expect(serverCompare(a, b) > 0).toBe(serverCompare(b, a) < 0);
      if (serverCompare(a, b) === 0) expect(serverCanonical(a)).toBe(serverCanonical(b));
    }
  });

  it('any arrival order ends on the same version (so replicas converge)', () => {
    const r = rng(99);
    const foldAll = versions => versions.reduce((cur, v) => (cur === null || serverCompare(v, cur) > 0 ? v : cur), null);
    for (let round = 0; round < 300; round++) {
      const versions = Array.from({ length: 6 }, () => randomVersion(r));
      const reference = serverCanonical(foldAll(versions));
      for (let k = 0; k < 8; k++) {
        const shuffled = [...versions].sort(() => r() - 0.5);
        expect(serverCanonical(foldAll(shuffled))).toBe(reference);
      }
    }
  });

  it('orders by updatedAt first, then a delete, then the device id', () => {
    const base = { id: 'x', ts: 1, source: 'manual', behavior: 'nail_biting' };
    expect(serverCompare({ ...base, updatedAt: 2 }, { ...base, updatedAt: 1, deleted: true })).toBeGreaterThan(0);
    expect(serverCompare({ ...base, updatedAt: 1, deleted: true }, { ...base, updatedAt: 1 })).toBeGreaterThan(0);
    expect(serverCompare({ ...base, updatedAt: 1, deviceId: 'b' }, { ...base, updatedAt: 1, deviceId: 'a' })).toBeGreaterThan(0);
    expect(serverCompare({ ...base, updatedAt: 1 }, { ...base, updatedAt: 1 })).toBe(0);
  });

  it('two tombstones of the same moment are the same version whatever content they once had', () => {
    const base = { id: 'x', ts: 1, source: 'manual', behavior: 'nail_biting', updatedAt: 5, deleted: true };
    expect(serverCompare({ ...base, triggers: ['stress'], hand: 'left' }, base)).toBe(0);
    expect(clientCompare({ ...base, triggers: ['stress'], hand: 'left' }, base)).toBe(0);
  });
});
