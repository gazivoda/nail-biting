import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeEventsHarness, ev } from '../../test-utils/eventsHarness.js';
import { createEventStore } from '../events/store.js';
import { ROUTE_MODULES } from './index.js';
import eventsModule from './events.js';
import { LIMITS, BEHAVIORS } from '../events/limits.js';
import { BEHAVIORS as CLIENT_BEHAVIORS } from '../../src/storage/eventModel.ts';

let open = [];
async function boot(opts) {
  const h = await makeEventsHarness(opts);
  open.push(h);
  return h;
}
afterEach(async () => {
  await Promise.all(open.map(h => h.close()));
  open = [];
});

const body = (events, over = {}) => ({ since: 0, deviceId: 'dev-a', events, ...over });

describe('registration', () => {
  it('is in the route registry, once', () => {
    expect(ROUTE_MODULES.filter(m => m.name === 'events')).toHaveLength(1);
    expect(ROUTE_MODULES).toContain(eventsModule);
  });

  it('server.js skips the 10 kb JSON parser for exactly /api/events/sync (and still has it for the rest)', () => {
    const src = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');
    const block = src.slice(src.indexOf('app.use(cookieParser());'), src.indexOf('// H-3: Rate limiting'));
    expect(block).toContain("req.path === '/api/events/sync'");
    expect(block).toContain("express.json({ limit: '10kb' })");
    expect(block).toContain("req.path === '/api/paddle/webhook'");
    // Only the one path is exempt: nothing broader such as startsWith('/api/events').
    expect(block).not.toMatch(/startsWith\(['"]\/api\/events/);
  });

  it('knows the same behaviours as the app', () => {
    expect([...BEHAVIORS]).toEqual([...CLIENT_BEHAVIORS]);
  });

  it('applies its migrations twice without harm', async () => {
    const h = await boot();
    const { runMigrations } = await import('../db/migrate.js');
    const { EVENTS_MIGRATIONS } = await import('../events/store.js');
    expect(runMigrations(h.db, EVENTS_MIGRATIONS)).toEqual([]);
    const tables = h.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name);
    expect(tables).toContain('habit_events');
    expect(tables).toContain('habit_event_epochs');
  });
});

describe('flag and auth', () => {
  it('answers 404 to every path while event_sync is off, signed in or not', async () => {
    const h = await boot({ flags: '' });
    for (const user of [undefined, 'u1']) {
      expect((await h.call('POST', '/api/events/sync', { user, body: body([ev('a')]) })).status).toBe(404);
      expect((await h.call('GET', '/api/events/status', { user })).status).toBe(404);
      expect((await h.call('DELETE', '/api/events', { user })).status).toBe(404);
    }
    // Nothing was written, and the table is there but empty.
    expect(h.db.prepare('SELECT COUNT(*) AS n FROM habit_events').get().n).toBe(0);
  });

  it('with the flag on, every path needs a signed-in user', async () => {
    const h = await boot();
    expect((await h.call('POST', '/api/events/sync', { body: body([ev('a')]) })).status).toBe(401);
    expect((await h.call('GET', '/api/events/status')).status).toBe(401);
    expect((await h.call('DELETE', '/api/events')).status).toBe(401);
    expect(h.db.prepare('SELECT COUNT(*) AS n FROM habit_events').get().n).toBe(0);
  });

  it('a flag-off 404 happens before the body is read (an over-size body is still a plain 404)', async () => {
    const h = await boot({ flags: '' });
    const huge = JSON.stringify({ events: 'x'.repeat(2_000_000) });
    expect((await h.call('POST', '/api/events/sync', { user: 'u1', raw: huge })).status).toBe(404);
  });
});

describe('a basic round trip', () => {
  it('stores what is pushed and hands it to another device, oldest change first', async () => {
    const h = await boot();
    const pushed = [
      ev('a', { ts: 1000, updatedAt: 1000, triggers: ['stress'], hand: 'left', behavior: 'cuticle_skin_biting', deviceId: 'dev-a' }),
      ev('b', { ts: 2000, updatedAt: 2000, source: 'alarm', confirmed: true, falsePositive: false, competingResponse: { done: true, durationSec: 12.5 } }),
    ];
    const first = await h.sync('u1', body(pushed));
    expect(first.status).toBe(200);
    expect(first.body.events).toEqual([]); // no echo of its own writes
    expect(first.body.cursor).toBeGreaterThan(0);
    expect(first.body.hasMore).toBe(false);
    expect(typeof first.body.epoch).toBe('string');

    const pulled = await h.sync('u1', { since: 0, deviceId: 'dev-b', events: [], epoch: first.body.epoch });
    expect(pulled.status).toBe(200);
    expect(pulled.body.events).toEqual(pushed); // exact, including absent vs false vs true
    expect(pulled.body.cursor).toBe(first.body.cursor);
  });

  it('keeps tri-state fields exact: absent stays absent, false stays false', async () => {
    const h = await boot();
    await h.sync('u1', body([
      ev('absent'),
      ev('f', { confirmed: false, falsePositive: false }),
      ev('t', { confirmed: true, falsePositive: true, competingResponse: { done: false } }),
    ]));
    const { body: out } = await h.sync('u1', { since: 0, deviceId: 'dev-b' });
    const by = Object.fromEntries(out.events.map(e => [e.id, e]));
    expect('confirmed' in by.absent).toBe(false);
    expect('falsePositive' in by.absent).toBe(false);
    expect(by.f.confirmed).toBe(false);
    expect(by.f.falsePositive).toBe(false);
    expect(by.t.competingResponse).toEqual({ done: false });
  });

  it('pages a long pull with hasMore and a cursor that resumes where it stopped', async () => {
    const h = await boot({ module: { limits: { pageSize: 3 } } });
    await h.sync('u1', body(Array.from({ length: 8 }, (_, i) => ev(`e${i}`, { ts: 1000 + i, updatedAt: 1000 + i }))));
    const seen = [];
    let since = 0;
    for (let i = 0; i < 10; i++) {
      const r = await h.sync('u1', { since, deviceId: 'dev-b', events: [] });
      seen.push(...r.body.events.map(e => e.id));
      since = r.body.cursor;
      if (!r.body.hasMore) break;
    }
    expect(seen).toEqual(['e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7']);
    expect((await h.sync('u1', { since, deviceId: 'dev-b', events: [] })).body.events).toEqual([]);
  });
});

describe('the privacy whitelist', () => {
  const FORBIDDEN = ['landmarks', 'frame', 'frames', 'image', 'photo', 'video', 'calibration', 'samples', 'imageData', 'note', 'tag', 'timestamp', 'autoDetected'];

  it.each(FORBIDDEN)('refuses an event carrying "%s" with a 400 and stores nothing', async key => {
    const h = await boot();
    const secret = 'SECRET-PIXELS-0123456789';
    const r = await h.sync('u1', body([ev('ok'), ev('bad', { [key]: secret })]));
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('invalid_request');
    expect(r.body.index).toBe(1);
    expect(r.body.field).toBe(key);
    expect(JSON.stringify(r.body)).not.toContain(secret); // never echoes a value
    // Nothing from the batch was stored, not even the valid event before it.
    expect(h.rows('u1')).toEqual([]);
  });

  it('refuses landmark-shaped payloads however they are nested', async () => {
    const h = await boot();
    const landmarks = Array.from({ length: 21 }, (_, i) => ({ x: i / 21, y: 0.5, z: 0 }));
    for (const evil of [
      ev('a', { landmarks }),
      ev('b', { competingResponse: { done: true, landmarks } }),
      ev('c', { triggers: [landmarks] }),
      ev('d', { hand: { landmarks } }),
      ev('e', { triggers: ['data:image/png;base64,' + 'A'.repeat(500)] }),
    ]) {
      const r = await h.sync('u1', body([evil]));
      expect(r.status, JSON.stringify(Object.keys(evil))).toBe(400);
    }
    expect(h.rows('u1')).toEqual([]);
  });

  it('refuses unknown fields on the request itself', async () => {
    const h = await boot();
    const r = await h.sync('u1', { ...body([ev('a')]), frames: ['x'] });
    expect(r.status).toBe(400);
    expect(r.body.field).toBe('frames');
    expect(h.rows('u1')).toEqual([]);
  });

  it('refuses a __proto__ key', async () => {
    const h = await boot();
    const res = await h.call('POST', '/api/events/sync', { user: 'u1', raw: '{"since":0,"deviceId":"d","events":[{"__proto__":{"x":1},"id":"a"}]}' });
    expect(res.status).toBe(400);
  });

  it('stores nothing but the whitelisted columns (the table has no room for anything else)', async () => {
    const h = await boot();
    const cols = h.db.prepare('PRAGMA table_info(habit_events)').all().map(c => c.name).sort();
    expect(cols).toEqual([
      'behavior', 'competing_response', 'confirmed', 'deleted', 'device_id', 'false_positive', 'hand', 'id',
      'seq', 'server_updated_at', 'source', 'triggers', 'ts', 'updated_at', 'user_id',
    ]);
  });
});

describe('validation and limits', () => {
  it.each([
    ['a non-object event', [5]],
    ['a missing id', [{ ...ev('a'), id: undefined }]],
    ['an id with a slash', [ev('a/b')]],
    ['an id that is too long', [ev('a'.repeat(LIMITS.maxIdLength + 1))]],
    ['an unknown behavior', [ev('a', { behavior: 'tooth_grinding' })]],
    ['an unknown source', [ev('a', { source: 'robot' })]],
    ['a hand that is not a hand', [ev('a', { hand: 'both' })]],
    ['too many triggers', [ev('a', { triggers: Array.from({ length: LIMITS.maxTriggers + 1 }, (_, i) => `t${i}`) })]],
    ['a trigger that is too long', [ev('a', { triggers: ['x'.repeat(LIMITS.maxTriggerLength + 1)] })]],
    ['a trigger with a control character', [ev('a', { triggers: ['a\u0000b'] })]],
    ['a non-string trigger', [ev('a', { triggers: [1] })]],
    ['a ts that is not a number', [ev('a', { ts: '1000' })]],
    ['a negative ts', [ev('a', { ts: -1 })]],
    ['an updatedAt after the year 2100', [ev('a', { updatedAt: LIMITS.maxTime + 1 })]],
    ['a null updatedAt (what JSON makes of NaN)', [ev('a', { updatedAt: null })]],
    ['a non-boolean confirmed', [ev('a', { confirmed: 'yes' })]],
    ['a non-boolean falsePositive', [ev('a', { falsePositive: 1 })]],
    ['a competingResponse without done', [ev('a', { competingResponse: { durationSec: 3 } })]],
    ['an absurd duration', [ev('a', { competingResponse: { done: true, durationSec: LIMITS.maxDurationSec + 1 } })]],
  ])('400 for %s', async (_name, events) => {
    const h = await boot();
    const r = await h.sync('u1', body(events));
    expect(r.status).toBe(400);
    expect(h.rows('u1')).toEqual([]);
  });

  it.each([
    ['since below zero', { since: -1 }],
    ['since that is not a whole number', { since: 1.5 }],
    ['a missing deviceId', { deviceId: undefined }],
    ['a deviceId with spaces', { deviceId: 'my laptop' }],
    ['events that is not a list', { events: {} }],
    ['an epoch that is not text', { epoch: 5 }],
  ])('400 for %s', async (_name, over) => {
    const h = await boot();
    const r = await h.sync('u1', { ...body([ev('a')]), ...over });
    expect(r.status).toBe(400);
  });

  it('accepts a batch of exactly the maximum and refuses one more', async () => {
    const h = await boot();
    const make = n => Array.from({ length: n }, (_, i) => ev(`e${i}`, { ts: 1000 + i, updatedAt: 1000 + i }));
    expect((await h.sync('u1', body(make(LIMITS.maxBatch)))).status).toBe(200);
    const r = await h.sync('u2', body(make(LIMITS.maxBatch + 1)));
    expect(r.status).toBe(400);
    expect(r.body.max).toBe(LIMITS.maxBatch);
    expect(h.rows('u2')).toEqual([]);
  });

  it('takes a body larger than the global 10 kb limit, up to its own limit', async () => {
    const h = await boot();
    const events = Array.from({ length: 400 }, (_, i) => ev(`event-${i}`, { ts: 1000 + i, updatedAt: 1000 + i, triggers: ['stress', 'boredom'], deviceId: 'dev-a' }));
    const raw = JSON.stringify(body(events));
    expect(raw.length).toBeGreaterThan(10 * 1024);
    expect((await h.call('POST', '/api/events/sync', { user: 'u1', raw })).status).toBe(200);
    // The global parser still guards every other route.
    const other = await h.call('DELETE', '/api/events', { user: 'u1', raw: JSON.stringify({ pad: 'x'.repeat(20_000) }) });
    expect(other.status).toBe(413);
  });

  it('answers 413 beyond its own body limit and 400 to broken JSON', async () => {
    const h = await boot({ module: { limits: { bodyLimit: '2kb' } } });
    const big = JSON.stringify(body(Array.from({ length: 50 }, (_, i) => ev(`event-${i}`))));
    expect((await h.call('POST', '/api/events/sync', { user: 'u1', raw: big })).status).toBe(413);
    expect((await h.call('POST', '/api/events/sync', { user: 'u1', raw: '{not json' })).status).toBe(400);
  });

  it('wants a JSON content type', async () => {
    const h = await boot();
    const res = await fetch(`${h.url}/api/events/sync`, { method: 'POST', headers: { 'x-user': 'u1', 'content-type': 'text/plain' }, body: JSON.stringify(body([ev('a')])) });
    expect(res.status).toBe(400);
    expect(h.rows('u1')).toEqual([]);
  });
});

describe('quota', () => {
  it('refuses a batch that would pass the quota, whole, and writes none of it', async () => {
    const h = await boot({ module: { limits: { quotaPerUser: 5 } } });
    expect((await h.sync('u1', body([ev('a'), ev('b'), ev('c')]))).status).toBe(200);
    const r = await h.sync('u1', body([ev('d'), ev('e'), ev('f')]));
    expect(r.status).toBe(413);
    expect(r.body).toMatchObject({ error: 'quota_exceeded', limit: 5, count: 3 });
    expect(h.rows('u1').map(x => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('lets an update of an existing event through at the limit (it is not a new row)', async () => {
    const h = await boot({ module: { limits: { quotaPerUser: 2 } } });
    await h.sync('u1', body([ev('a'), ev('b')]));
    const r = await h.sync('u1', body([ev('a', { updatedAt: 1_700_000_000_500, triggers: ['stress'] })]));
    expect(r.status).toBe(200);
    expect((await h.sync('u1', body([ev('c')]))).status).toBe(413);
  });

  it('counts tombstones, and is per user', async () => {
    const h = await boot({ module: { limits: { quotaPerUser: 2 } } });
    await h.sync('u1', body([ev('a'), ev('b', { deleted: true })]));
    expect((await h.sync('u1', body([ev('c')]))).status).toBe(413);
    expect((await h.sync('u2', body([ev('a'), ev('b')]))).status).toBe(200);
  });

  it('counts a duplicate id inside one batch once', async () => {
    const h = await boot({ module: { limits: { quotaPerUser: 1 } } });
    expect((await h.sync('u1', body([ev('a'), ev('a', { updatedAt: 1_700_000_000_001 })]))).status).toBe(200);
  });

  it('reports usage on the status endpoint', async () => {
    const h = await boot({ module: { limits: { quotaPerUser: 10 } } });
    await h.sync('u1', body([ev('a'), ev('b'), ev('c', { deleted: true })]));
    const { body: s } = await h.status('u1');
    expect(s).toMatchObject({ count: 3, live: 2, deleted: 1, quota: 10 });
    expect(typeof s.epoch).toBe('string');
    expect(typeof s.lastChangeAt).toBe('number');
  });
});

describe('rate limiting', () => {
  it('limits sync per signed-in user, not per address', async () => {
    const h = await boot({ module: { syncRateLimit: { limit: 3, windowMs: 60_000 } } });
    for (let i = 0; i < 3; i++) expect((await h.sync('u1', body([ev(`e${i}`)]))).status).toBe(200);
    const limited = await h.sync('u1', body([ev('x')]));
    expect(limited.status).toBe(429);
    expect(limited.body.error).toMatch(/too many/i);
    // Another account from the same address is not affected.
    expect((await h.sync('u2', body([ev('a')]))).status).toBe(200);
    expect(h.rows('u1').map(r => r.id)).toEqual(['e0', 'e1', 'e2']);
  });

  it('limits the wipe and status calls too', async () => {
    const h = await boot({ module: { manageRateLimit: { limit: 2, windowMs: 60_000 } } });
    expect((await h.status('u1')).status).toBe(200);
    expect((await h.wipe('u1')).status).toBe(200);
    expect((await h.status('u1')).status).toBe(429);
  });
});

describe('last write wins', () => {
  it('a newer version replaces an older one and shows up for other devices', async () => {
    const h = await boot();
    const a = await h.sync('u1', body([ev('x', { updatedAt: 100, triggers: ['stress'] })]));
    await h.sync('u1', body([ev('x', { updatedAt: 200, triggers: ['boredom'] })], { deviceId: 'dev-b' }));
    const pulled = await h.sync('u1', { since: a.body.cursor, deviceId: 'dev-a', events: [] });
    expect(pulled.body.events).toEqual([ev('x', { updatedAt: 200, triggers: ['boredom'] })]);
  });

  it('an older version is ignored and the pusher is handed the newer one', async () => {
    const h = await boot();
    await h.sync('u1', body([ev('x', { updatedAt: 200, triggers: ['boredom'] })], { deviceId: 'dev-b' }));
    const before = h.maxSeq();
    const r = await h.sync('u1', { since: before, deviceId: 'dev-a', events: [ev('x', { updatedAt: 100, triggers: ['stress'] })] });
    expect(r.status).toBe(200);
    expect(r.body.events).toEqual([ev('x', { updatedAt: 200, triggers: ['boredom'] })]); // the server's version, even though seq <= since
    expect(h.maxSeq()).toBe(before); // nothing was written
  });

  it('a tie on updatedAt is settled the same way whatever the arrival order', async () => {
    const v1 = ev('x', { updatedAt: 500, triggers: ['stress'], deviceId: 'dev-a' });
    const v2 = ev('x', { updatedAt: 500, triggers: ['boredom'], deviceId: 'dev-b' });
    const winners = [];
    for (const order of [[v1, v2], [v2, v1]]) {
      const h = await boot();
      for (const v of order) await h.sync('u1', body([v]));
      winners.push((await h.sync('u1', { since: 0, deviceId: 'dev-c', events: [] })).body.events);
    }
    expect(winners[0]).toEqual(winners[1]);
    expect(winners[0]).toHaveLength(1);
    expect(winners[0][0].deviceId).toBe('dev-b'); // the higher device id
  });

  it('a delete beats a live edit made at the same instant', async () => {
    const h = await boot();
    await h.sync('u1', body([ev('x', { updatedAt: 500, triggers: ['stress'] })]));
    await h.sync('u1', body([ev('x', { updatedAt: 500, deleted: true })]));
    const out = (await h.sync('u1', { since: 0, deviceId: 'd', events: [] })).body.events;
    expect(out).toHaveLength(1);
    expect(out[0].deleted).toBe(true);
  });

  it('a tombstone is kept, carries no content, and an older live edit cannot undo it', async () => {
    const h = await boot();
    await h.sync('u1', body([ev('x', { updatedAt: 100, triggers: ['stress'], hand: 'left', competingResponse: { done: true } })]));
    await h.sync('u1', body([ev('x', { updatedAt: 300, deleted: true, triggers: ['stress'], hand: 'left' })]));
    // an older live edit arrives late (an offline device)
    await h.sync('u1', body([ev('x', { updatedAt: 200, triggers: ['boredom'] })], { deviceId: 'dev-b' }));
    const out = (await h.sync('u1', { since: 0, deviceId: 'd', events: [] })).body.events;
    expect(out).toEqual([{ id: 'x', ts: 1_700_000_000_000, source: 'manual', behavior: 'nail_biting', updatedAt: 300, deleted: true }]);
    const row = h.rows('u1')[0];
    expect(row).toMatchObject({ deleted: 1, hand: null, triggers: null, competing_response: null, confirmed: null, false_positive: null });
  });

  it('a newer live edit brings a deleted event back (the user edited it after it was deleted elsewhere)', async () => {
    const h = await boot();
    await h.sync('u1', body([ev('x', { updatedAt: 300, deleted: true })]));
    await h.sync('u1', body([ev('x', { updatedAt: 400, triggers: ['focus'] })]));
    const out = (await h.sync('u1', { since: 0, deviceId: 'd', events: [] })).body.events;
    expect(out).toEqual([ev('x', { updatedAt: 400, triggers: ['focus'] })]);
  });

  it('the same id from two accounts is two separate events', async () => {
    const h = await boot();
    await h.sync('u1', body([ev('x', { updatedAt: 100, triggers: ['stress'] })]));
    await h.sync('u2', body([ev('x', { updatedAt: 900, triggers: ['boredom'] })]));
    expect((await h.sync('u1', { since: 0, deviceId: 'd', events: [] })).body.events[0].triggers).toEqual(['stress']);
    expect((await h.sync('u2', { since: 0, deviceId: 'd', events: [] })).body.events[0].triggers).toEqual(['boredom']);
  });
});

describe('idempotency and the cursor', () => {
  it('re-sending the same batch changes nothing: same rows, same seqs, same cursor, no events back', async () => {
    const h = await boot();
    const batch = [
      ev('a', { updatedAt: 100, triggers: ['stress'] }),
      ev('b', { updatedAt: 200, deleted: true }),
      ev('c', { updatedAt: 300, competingResponse: { done: true, durationSec: 9 } }),
    ];
    const first = await h.sync('u1', body(batch));
    const rowsBefore = h.rows('u1');
    const maxBefore = h.maxSeq();

    for (let i = 0; i < 3; i++) {
      const again = await h.sync('u1', body(batch, { since: first.body.cursor }));
      expect(again.status).toBe(200);
      expect(again.body.events).toEqual([]);
      expect(again.body.cursor).toBe(first.body.cursor);
    }
    expect(h.rows('u1')).toEqual(rowsBefore);
    expect(h.maxSeq()).toBe(maxBefore);

    // Replayed from cursor 0 the rows still do not change; the events just come back as an ordinary pull.
    const fresh = await h.sync('u1', body(batch, { since: 0 }));
    expect(fresh.body.events.map(e => e.id)).toEqual(['a', 'b', 'c']);
    expect(h.rows('u1')).toEqual(rowsBefore);
    expect(h.maxSeq()).toBe(maxBefore);
  });

  it('seq only grows: a rewrite gets a higher seq, a no-op keeps its own', async () => {
    const h = await boot();
    await h.sync('u1', body([ev('a', { updatedAt: 100 }), ev('b', { updatedAt: 100 })]));
    const [a1, b1] = h.rows('u1').map(r => r.seq);
    await h.sync('u1', body([ev('a', { updatedAt: 200 })]));
    const bySeq = Object.fromEntries(h.rows('u1').map(r => [r.id, r.seq]));
    expect(bySeq.b).toBe(b1);
    expect(bySeq.a).toBeGreaterThan(Math.max(a1, b1));
  });

  it('seq keeps growing after a wipe, so a cursor held from before never skips new events', async () => {
    const h = await boot();
    const first = await h.sync('u1', body([ev('a'), ev('b'), ev('c')]));
    const oldMax = h.maxSeq();
    await h.wipe('u1');
    expect(h.rows('u1')).toEqual([]);
    await h.sync('u1', body([ev('n1')]));
    expect(h.maxSeq()).toBeGreaterThan(oldMax);
    // A client with the old cursor but no epoch (it forgot) still sees the new event.
    const pulled = await h.sync('u1', { since: first.body.cursor, deviceId: 'dev-z', events: [] });
    expect(pulled.body.events.map(e => e.id)).toEqual(['n1']);
  });

  it('a pull sees events another device pushed after the cursor, and not before it', async () => {
    const h = await boot();
    const a = await h.sync('u1', body([ev('a')]));
    await h.sync('u1', body([ev('b')], { deviceId: 'dev-b' }));
    const pulled = await h.sync('u1', { since: a.body.cursor, deviceId: 'dev-a', events: [] });
    expect(pulled.body.events.map(e => e.id)).toEqual(['b']);
  });

  it('a push and a pull in one request: the pusher gets the others\' changes, not its own', async () => {
    const h = await boot();
    await h.sync('u1', body([ev('theirs')], { deviceId: 'dev-b' }));
    const r = await h.sync('u1', body([ev('mine')], { deviceId: 'dev-a' }));
    expect(r.body.events.map(e => e.id)).toEqual(['theirs']);
    expect(r.body.cursor).toBe(h.maxSeq());
  });
});

describe('wiping synced data and the epoch', () => {
  it('DELETE removes the caller\'s events and tombstones, and says how many', async () => {
    const h = await boot();
    await h.sync('u1', body([ev('a'), ev('b', { deleted: true }), ev('c')]));
    const w = await h.wipe('u1');
    expect(w.status).toBe(200);
    expect(w.body.deleted).toBe(3);
    expect(h.rows('u1')).toEqual([]);
    expect((await h.status('u1')).body).toMatchObject({ count: 0, live: 0, deleted: 0 });
  });

  it('a device that held the old epoch is refused with 409 and nothing is stored', async () => {
    const h = await boot();
    const first = await h.sync('u1', body([ev('a')]));
    const oldEpoch = first.body.epoch;
    const w = await h.wipe('u1');
    expect(w.body.epoch).not.toBe(oldEpoch);

    const stale = await h.sync('u1', body([ev('uploaded-again')], { epoch: oldEpoch, since: first.body.cursor }));
    expect(stale.status).toBe(409);
    expect(stale.body.error).toBe('epoch_changed');
    expect(h.rows('u1')).toEqual([]);

    // With the current epoch (or none, as a fresh device has) it works.
    expect((await h.sync('u1', body([ev('fresh')], { epoch: w.body.epoch }))).status).toBe(200);
  });

  it('an epoch the server has never issued is refused too (the server lost its data)', async () => {
    const h = await boot();
    const r = await h.sync('u1', body([ev('a')], { epoch: 'made-up-epoch' }));
    expect(r.status).toBe(409);
    expect(h.rows('u1')).toEqual([]);
  });

  it('the epoch is stable between syncs', async () => {
    const h = await boot();
    const a = await h.sync('u1', body([ev('a')]));
    const b = await h.sync('u1', { since: a.body.cursor, deviceId: 'd', events: [], epoch: a.body.epoch });
    expect(b.body.epoch).toBe(a.body.epoch);
  });
});

describe('one user can never see or touch another user\'s events', () => {
  it('sync, status and wipe are all scoped to the caller', async () => {
    const h = await boot();
    await h.sync('alice', body([ev('a1', { triggers: ['stress'] }), ev('a2')]));
    await h.sync('bob', body([ev('b1')]));

    // Bob pulls from cursor 0: only his own, never Alice's.
    expect((await h.sync('bob', { since: 0, deviceId: 'd2', events: [] })).body.events.map(e => e.id)).toEqual(['b1']);

    // Bob's status counts only his rows.
    expect((await h.status('bob')).body.count).toBe(1);

    // Bob wipes: Alice's data is untouched.
    expect((await h.wipe('bob')).body.deleted).toBe(1);
    expect(h.rows('alice').map(r => r.id)).toEqual(['a1', 'a2']);
    expect((await h.sync('alice', { since: 0, deviceId: 'd3', events: [] })).body.events.map(e => e.id)).toEqual(['a1', 'a2']);
  });

  it('Bob cannot delete or overwrite Alice\'s event by pushing its id', async () => {
    const h = await boot();
    await h.sync('alice', body([ev('shared-id', { updatedAt: 100, triggers: ['stress'] })]));
    await h.sync('bob', body([ev('shared-id', { updatedAt: 999, deleted: true })]));
    const alice = (await h.sync('alice', { since: 0, deviceId: 'd', events: [] })).body.events;
    expect(alice).toEqual([ev('shared-id', { updatedAt: 100, triggers: ['stress'] })]);
  });

  it('a user id with SQL in it is just a string', async () => {
    const h = await boot();
    const nasty = "x' OR '1'='1";
    await h.sync(nasty, body([ev('a')]));
    await h.sync('alice', body([ev('b')]));
    expect((await h.sync(nasty, { since: 0, deviceId: 'd', events: [] })).body.events.map(e => e.id)).toEqual(['a']);
  });
});

describe('the server-side contract for later features (listUserEvents)', () => {
  it('lists a user\'s live events as canonical wire events, oldest first, optionally bounded', async () => {
    const h = await boot();
    await h.sync('u1', body([
      ev('c', { ts: 3000, updatedAt: 3000 }),
      ev('a', { ts: 1000, updatedAt: 1000, triggers: ['stress'] }),
      ev('b', { ts: 2000, updatedAt: 2000, deleted: true }),
    ]));
    await h.sync('u2', body([ev('other', { ts: 1500, updatedAt: 1500 })]));
    const store = createEventStore(h.db);
    expect(store.listUserEvents('u1').map(e => e.id)).toEqual(['a', 'c']);
    expect(store.listUserEvents('u1', { includeDeleted: true }).map(e => e.id)).toEqual(['a', 'b', 'c']);
    expect(store.listUserEvents('u1', { since: 1500, until: 3000 }).map(e => e.id)).toEqual([]);
    expect(store.listUserEvents('u1', { since: 1000, until: 3000 }).map(e => e.id)).toEqual(['a']);
    expect(store.listUserEvents('u1')[0]).toEqual(ev('a', { ts: 1000, updatedAt: 1000, triggers: ['stress'] }));
  });
});
