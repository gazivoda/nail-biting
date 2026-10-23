// Two browsers on one account, talking to the real server routes over real HTTP
// (in-memory SQLite). Each browser has its OWN app store, its own storage and its
// own device id; the only thing they share is the server. The question is always
// the same: after they have synced, do they hold exactly the same history, and is
// it the history the server holds?

import { describe, it, expect, afterEach } from 'vitest';
import { makeEventsHarness } from '../../test-utils/eventsHarness.js';
import { createEventStore } from '../events/store.js';
import { createSyncEngine } from '../../src/sync/engine.ts';
import { createEngineTransport } from '../../src/sync/api.ts';
import { SYNC_EVENT_FIELDS } from '../../src/sync/payload.ts';
import { createFakeClock } from '../../test-utils/fakeClock.ts';
import { createTestBrowser, httpRequestFor } from '../../test-utils/syncHarness.ts';

const T0 = 1_700_000_000_000;

let open = [];
afterEach(async () => {
  await Promise.all(open.map(h => h.close()));
  open = [];
});

async function world({ user = 'alice', harnessOpts } = {}) {
  const h = await makeEventsHarness(harnessOpts);
  open.push(h);
  const requests = [];
  const clock = createFakeClock(T0 + 1_000_000);

  function join(name, { engineOptions } = {}) {
    const browser = createTestBrowser(name);
    const state = { online: true, resets: 0, signedOut: 0 };
    const engine = createSyncEngine({
      userId: user,
      deviceId: browser.deviceId,
      store: browser.port,
      kv: browser.kv,
      transport: createEngineTransport(httpRequestFor(h.url, user, (method, path, body) => requests.push({ by: name, method, path, body }))),
      isEnabled: () => true,
      isOnline: () => state.online,
      now: clock.now,
      timers: clock.timers,
      random: () => 0.5,
      onServerReset: () => { state.resets++; },
      onSignedOut: () => { state.signedOut++; },
      options: engineOptions,
    });
    engine.start();
    return { browser, engine, state, name };
  }

  /** Everything the server holds for the user, live and deleted, canonical, ordered by id. */
  const serverState = () =>
    createEventStore(h.db).listUserEvents(user, { includeDeleted: true }).sort((a, b) => (a.id < b.id ? -1 : 1));

  const syncAll = async (...devs) => { for (const d of devs) await d.engine.syncNow(); };

  return { h, join, requests, serverState, syncAll, clock, user };
}

const ids = list => list.map(e => e.id);

describe('two browsers on one account converge', () => {
  it('each browser\'s own history reaches the other', async () => {
    const w = await world();
    const a = w.join('a');
    const b = w.join('b');
    a.browser.add({ id: 'a1', triggers: ['stress'] }, T0 + 100);
    a.browser.add({ id: 'a2', source: 'alarm', confirmed: true, competingResponse: { done: true, durationSec: 20 } }, T0 + 200);
    b.browser.add({ id: 'b1', behavior: 'cuticle_skin_biting', hand: 'right' }, T0 + 300);

    await w.syncAll(a, b, a); // a pushes, b pushes and pulls a's, a pulls b's
    expect(ids(a.browser.snapshot())).toEqual(['a1', 'a2', 'b1']);
    expect(b.browser.snapshot()).toEqual(a.browser.snapshot());
    expect(w.serverState()).toEqual(a.browser.snapshot());
  });

  it('a brand-new browser (first sync merges local and server by id) ends up with the same history', async () => {
    const w = await world();
    const a = w.join('a');
    for (let i = 0; i < 5; i++) a.browser.add({ id: `old${i}` }, T0 + i * 10);
    a.browser.remove('old1', T0 + 500);
    await w.syncAll(a);

    // c already has its own local history, including one event that a also has (same id, same content).
    const c = w.join('c');
    c.browser.add({ id: 'old3', ts: T0 + 30, updatedAt: T0 + 30, deviceId: 'dev-a' }, T0 + 30);
    c.browser.add({ id: 'only-c' }, T0 + 700);
    await w.syncAll(c, a);
    expect(ids(c.browser.snapshot())).toEqual(['old0', 'old1', 'old2', 'old3', 'old4', 'only-c']);
    expect(c.browser.snapshot().find(e => e.id === 'old1').deleted).toBe(true); // the tombstone came too
    expect(a.browser.snapshot()).toEqual(c.browser.snapshot());
    expect(w.serverState()).toEqual(c.browser.snapshot());
  });

  it('interleaved edits, deletes and an offline period: the later write wins everywhere', async () => {
    const w = await world();
    const a = w.join('a');
    const b = w.join('b');
    for (const id of ['shared', 'gone', 'untouched', 'revived']) a.browser.add({ id }, T0 + 100);
    await w.syncAll(a, b);
    expect(b.browser.snapshot()).toHaveLength(4);

    // a goes offline and works.
    a.state.online = false;
    a.browser.edit('shared', { triggers: ['a-offline'] }, T0 + 1_000);
    a.browser.remove('gone', T0 + 1_100);
    a.browser.edit('revived', { triggers: ['a-edit-after-delete'] }, T0 + 1_300);
    a.browser.add({ id: 'a-new' }, T0 + 1_400);

    // b works online, meanwhile, and syncs.
    b.browser.edit('shared', { triggers: ['b-later'] }, T0 + 2_000); // later than a's edit
    b.browser.edit('gone', { triggers: ['b-edit'] }, T0 + 900);      // earlier than a's delete
    b.browser.remove('revived', T0 + 1_200);                         // earlier than a's edit
    b.browser.add({ id: 'b-new' }, T0 + 1_500);
    await w.syncAll(b);

    // a comes back.
    a.state.online = true;
    await w.syncAll(a, b, a, b);

    const snap = a.browser.snapshot();
    expect(b.browser.snapshot()).toEqual(snap);
    expect(w.serverState()).toEqual(snap);
    const by = Object.fromEntries(snap.map(e => [e.id, e]));
    expect(by.shared.triggers).toEqual(['b-later']);           // b wrote last
    expect(by.gone.deleted).toBe(true);                         // a's delete came after b's edit
    expect(by.revived.deleted).toBeUndefined();                 // a's edit came after b's delete
    expect(by.revived.triggers).toEqual(['a-edit-after-delete']);
    expect(ids(snap)).toEqual(['a-new', 'b-new', 'gone', 'revived', 'shared', 'untouched']);
  });

  it('the reverse: a\'s write is the later one', async () => {
    const w = await world();
    const a = w.join('a');
    const b = w.join('b');
    a.browser.add({ id: 'x' }, T0 + 100);
    await w.syncAll(a, b);
    b.browser.edit('x', { triggers: ['b'] }, T0 + 1_000);
    a.browser.edit('x', { triggers: ['a'] }, T0 + 2_000);
    await w.syncAll(b, a, b, a);
    expect(a.browser.snapshot()[0].triggers).toEqual(['a']);
    expect(b.browser.snapshot()).toEqual(a.browser.snapshot());
  });

  it('two edits in the very same millisecond still converge (deterministic tie-break, same on server and clients)', async () => {
    const w = await world();
    const a = w.join('a');
    const b = w.join('b');
    a.browser.add({ id: 'x' }, T0 + 100);
    await w.syncAll(a, b);
    a.browser.edit('x', { triggers: ['from-a'] }, T0 + 5_000);
    b.browser.edit('x', { triggers: ['from-b'] }, T0 + 5_000);
    // Both orders of arrival, and a stray extra round.
    await w.syncAll(a, b, a, b, a);
    const sa = a.browser.snapshot();
    expect(b.browser.snapshot()).toEqual(sa);
    expect(w.serverState()).toEqual(sa);
    expect(sa).toHaveLength(1);
  });

  it('a delete and an edit in the same millisecond: the delete wins on every device', async () => {
    const w = await world();
    const a = w.join('a');
    const b = w.join('b');
    a.browser.add({ id: 'x' }, T0 + 100);
    await w.syncAll(a, b);
    a.browser.remove('x', T0 + 5_000);
    b.browser.edit('x', { triggers: ['edit'] }, T0 + 5_000);
    await w.syncAll(b, a, b, a);
    expect(a.browser.snapshot()[0].deleted).toBe(true);
    expect(b.browser.snapshot()).toEqual(a.browser.snapshot());
    expect(w.serverState()).toEqual(a.browser.snapshot());
  });

  it('syncing again changes nothing: no rows rewritten, no cursor moved, nothing re-sent', async () => {
    const w = await world();
    const a = w.join('a');
    const b = w.join('b');
    a.browser.add({ id: 'x' }, T0 + 100);
    a.browser.add({ id: 'y' }, T0 + 200);
    a.browser.remove('y', T0 + 300);
    await w.syncAll(a, b, a, b);

    const rows = w.h.rows('alice');
    const maxSeq = w.h.maxSeq();
    const before = a.browser.snapshot();
    const countBefore = w.requests.length;
    await w.syncAll(a, b, a, b);
    expect(w.h.rows('alice')).toEqual(rows);
    expect(w.h.maxSeq()).toBe(maxSeq);
    expect(a.browser.snapshot()).toEqual(before);
    // Every request in the quiet rounds carried no events at all.
    expect(w.requests.slice(countBefore).every(r => r.body.events.length === 0)).toBe(true);
  });

  it('a long history crosses several requests in both directions', async () => {
    const w = await world();
    const a = w.join('a', { engineOptions: { batchSize: 200 } });
    const b = w.join('b');
    for (let i = 0; i < 1300; i++) a.browser.add({ id: `e${String(i).padStart(4, '0')}` }, T0 + i);
    await w.syncAll(a);
    expect(w.h.rows('alice')).toHaveLength(1300);
    await w.syncAll(b);
    expect(b.browser.snapshot()).toHaveLength(1300);
    expect(b.browser.snapshot()).toEqual(a.browser.snapshot());
    // 1300 events at the server's page size of 1000 is two pulls.
    expect(w.requests.filter(r => r.by === 'b').length).toBe(2);
  });

  it('survives random work on both devices: many seeds, random offline stretches, same end state', async () => {
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
    for (let seed = 1; seed <= 12; seed++) {
      const r = rng(seed);
      const pick = list => list[Math.floor(r() * list.length)];
      const w = await world();
      const devs = [w.join('a'), w.join('b')];
      let t = T0;
      let n = 0;
      for (let step = 0; step < 60; step++) {
        const d = pick(devs);
        // Mostly distinct times; sometimes the very same instant on both devices.
        t += r() < 0.15 ? 0 : 1 + Math.floor(r() * 50);
        const live = d.browser.snapshot().filter(e => !e.deleted);
        const roll = r();
        if (roll < 0.35 || live.length === 0) {
          d.browser.add({ id: `ev-${seed}-${n++}`, triggers: [pick(['stress', 'boredom', 'focus'])] }, t);
        } else if (roll < 0.7) {
          const target = pick(live);
          d.browser.edit(target.id, pick([
            { triggers: [pick(['stress', 'boredom', 'focus', 'x'])] },
            { falsePositive: r() < 0.5 },
            { competingResponse: { done: r() < 0.5, durationSec: pick([5, 12.5, 30]) } },
            { hand: pick(['left', 'right']) },
          ]), Math.max(t, target.updatedAt));
        } else if (roll < 0.8) {
          const target = pick(live);
          d.browser.remove(target.id, Math.max(t, target.updatedAt));
        } else if (roll < 0.9) {
          d.state.online = !d.state.online;
        } else {
          await d.engine.syncNow();
        }
      }
      for (const d of devs) d.state.online = true;
      await w.syncAll(...devs, ...devs, ...devs); // a few rounds is enough for two devices
      const [a, b] = devs;
      const snapA = a.browser.snapshot();
      expect(b.browser.snapshot(), `seed ${seed}`).toEqual(snapA);
      expect(w.serverState(), `seed ${seed} server`).toEqual(snapA);
      // Both devices consider themselves fully in step.
      expect(a.engine.getStatus().pending, `seed ${seed}`).toBe(0);
      expect(b.engine.getStatus().pending, `seed ${seed}`).toBe(0);
    }
  });
});

describe('what actually goes over the wire', () => {
  it('every request body and every stored column is within the whitelist, nothing else', async () => {
    const w = await world();
    const a = w.join('a');
    a.browser.add({ id: 'x', source: 'alarm', confirmed: true, hand: 'left', falsePositive: false, competingResponse: { done: true, durationSec: 9 } }, T0 + 100);
    a.browser.store.setState({
      incidents: a.browser.store.getState().incidents.map(i => ({ ...i, landmarks: [[1, 2, 3]], frame: 'data:image/jpeg;base64,SECRET', calibration: { s: 1 } })),
    });
    await w.syncAll(a);
    expect(w.requests.length).toBeGreaterThan(0);
    for (const req of w.requests) {
      expect(Object.keys(req.body).sort()).toEqual(['deviceId', 'epoch', 'events', 'since']);
      for (const e of req.body.events) {
        for (const key of Object.keys(e)) expect(SYNC_EVENT_FIELDS, key).toContain(key);
      }
      expect(JSON.stringify(req.body)).not.toMatch(/SECRET|landmarks|calibration/);
    }
    const stored = JSON.stringify(w.h.db.prepare('SELECT * FROM habit_events').all());
    expect(stored).not.toMatch(/SECRET|landmarks|calibration/);
  });
});

describe('deleting synced data', () => {
  it('a device that held the old epoch stops instead of uploading its history again; it keeps its own history', async () => {
    const w = await world();
    const a = w.join('a');
    const b = w.join('b');
    a.browser.add({ id: 'x' }, T0 + 100);
    a.browser.add({ id: 'y' }, T0 + 200);
    await w.syncAll(a, b);

    // a wipes the server copy (the Data > "Delete synced data" button).
    expect((await w.h.wipe('alice')).body.deleted).toBe(2);
    expect(w.serverState()).toEqual([]);

    // b still has sync on and a new edit. Its next sync is refused; nothing goes back to the server.
    b.browser.add({ id: 'z' }, T0 + 900);
    await b.engine.syncNow();
    expect(b.state.resets).toBe(1);
    expect(b.engine.getStatus().phase).toBe('server_reset');
    expect(w.serverState()).toEqual([]);
    expect(ids(b.browser.snapshot())).toEqual(['x', 'y', 'z']);
  });
});

describe('accounts stay apart', () => {
  it('two accounts using the same server never see each other\'s events', async () => {
    const w1 = await world({ user: 'alice' });
    const a = w1.join('a');
    a.browser.add({ id: 'secret-alice' }, T0 + 100);
    await w1.syncAll(a);

    // Bob, on the same server (same database), with his own browser.
    const bobBrowser = createTestBrowser('bob-laptop');
    const bobEngine = createSyncEngine({
      userId: 'bob', deviceId: bobBrowser.deviceId, store: bobBrowser.port, kv: bobBrowser.kv,
      transport: createEngineTransport(httpRequestFor(w1.h.url, 'bob')),
      isEnabled: () => true, isOnline: () => true, now: w1.clock.now, timers: w1.clock.timers, random: () => 0.5,
    });
    bobEngine.start();
    bobBrowser.add({ id: 'bob-1' }, T0 + 200);
    await bobEngine.syncNow();
    expect(ids(bobBrowser.snapshot())).toEqual(['bob-1']);
    expect(ids(w1.serverState())).toEqual(['secret-alice']);
  });
});
