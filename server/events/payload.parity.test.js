// The client builds a payload (src/sync/payload.ts) and the server validates it
// (server/events/validate.js). They are written twice, in two languages, because
// the server cannot import the app's TypeScript. This test is what keeps them
// the same: same limits, same field list, and on thousands of random events they
// make the same accept/refuse decision.

import { describe, it, expect } from 'vitest';
import { toSyncEvent, SYNC_EVENT_FIELDS, SYNC_LIMITS } from '../../src/sync/payload.ts';
import { parseEvent, EVENT_KEYS } from './validate.js';
import { LIMITS } from './limits.js';
import { canonicalEvent } from './compare.js';

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

describe('client payload and server validator agree', () => {
  it('on the limits', () => {
    for (const key of Object.keys(SYNC_LIMITS)) expect(SYNC_LIMITS[key], key).toBe(LIMITS[key]);
  });

  it('on the list of fields an event may carry', () => {
    expect([...SYNC_EVENT_FIELDS].sort()).toEqual([...EVENT_KEYS].sort());
  });

  it('on 20,000 random events, valid and invalid: same decision, and same bytes when accepted', () => {
    const r = rng(2024);
    const pick = list => list[Math.floor(r() * list.length)];
    const weird = [undefined, null, '', 'x', 'a/b', 'a'.repeat(65), 0, -1, NaN, Infinity, 5.5, 4102444800001, true, false, [], {}, ['stress'], 'left'];
    const field = (valid, invalid) => (r() < 0.9 ? pick(valid) : pick([...invalid, ...weird]));
    let accepted = 0;
    let refused = 0;
    for (let i = 0; i < 20000; i++) {
      const e = {
        id: field(['a', 'evt-1', 'b.c_d:e'], ['', 'a b']),
        ts: field([0, 1_700_000_000_000, 123.5], []),
        source: field(['alarm', 'manual'], ['robot']),
        behavior: field(['nail_biting', 'hair_pulling'], ['other']),
        updatedAt: field([1, 1_700_000_000_000, 4102444800000], []),
      };
      if (r() < 0.5) e.hand = field(['left', 'right', 'unknown'], ['both']);
      if (r() < 0.5) e.triggers = field([['stress'], [], ['a', 'b', 'c'], Array.from({ length: 10 }, (_, k) => `t${k}`)], [Array.from({ length: 11 }, (_, k) => `t${k}`), ['x'.repeat(65)]]);
      if (r() < 0.4) e.falsePositive = field([true, false], []);
      if (r() < 0.4) e.confirmed = field([true, false], []);
      if (r() < 0.4) e.competingResponse = field([{ done: true }, { done: false, durationSec: 12.5 }, { done: true, durationSec: 86400 }], [{ done: true, durationSec: 86401 }, { durationSec: 3 }]);
      if (r() < 0.4) e.deviceId = field(['dev-1', 'x'], ['', 'a b']);
      if (r() < 0.3) e.deleted = field([true, false], []);
      // Remove keys that came out as undefined, as JSON would.
      for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k];

      const json = JSON.parse(JSON.stringify(e, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v)));
      const client = toSyncEvent(JSON.parse(JSON.stringify(json)));
      const server = parseEvent(json, 0);

      // 1. Whatever the client would send, the server accepts, and keeps exactly that.
      if (client !== null) {
        const check = parseEvent(JSON.parse(JSON.stringify(client)), 0);
        expect(check.ok, `server refused the client's own payload ${JSON.stringify(client)}`).toBe(true);
        expect(canonicalEvent(check.event)).toBe(canonicalEvent(client));
        // A tombstone from the client carries no content.
        if (client.deleted) {
          expect(Object.keys(client).every(k => ['id', 'ts', 'source', 'behavior', 'updatedAt', 'deviceId', 'deleted'].includes(k))).toBe(true);
        }
      }
      // 2. An event the server would accept as it stands is one the client would send.
      if (server.ok) {
        accepted++;
        expect(client, JSON.stringify(e)).not.toBeNull();
        expect(canonicalEvent(client)).toBe(canonicalEvent(server.event));
      } else {
        refused++;
      }
    }
    expect(accepted).toBeGreaterThan(2000);
    expect(refused).toBeGreaterThan(2000);
  });
});
