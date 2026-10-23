import { describe, it, expect } from 'vitest';
import { createSyncEngine, STATE_KEY, VERSIONS_KEY, type SyncEngine } from './engine';
import type { SyncRequest, SyncResponse, SyncTransport, TransportResult } from './types';
import { createFakeClock, type FakeClock } from '../../test-utils/fakeClock';
import { createMapKv, createTestBrowser, type TestBrowser } from '../../test-utils/syncHarness';

const T0 = 1_700_000_000_000;

type Responder = (req: SyncRequest, callNumber: number) => TransportResult | Promise<TransportResult>;

function okBody(over: Partial<SyncResponse> = {}): TransportResult {
  return { ok: true, body: { events: [], cursor: 1, hasMore: false, epoch: 'epoch-1', ...over } };
}

function setup(opts: {
  respond?: Responder;
  online?: () => boolean;
  enabled?: () => boolean;
  options?: Parameters<typeof createSyncEngine>[0]['options'];
  browser?: TestBrowser;
  userId?: string;
} = {}) {
  const clock: FakeClock = createFakeClock(T0 + 10_000);
  const browser = opts.browser ?? createTestBrowser('a');
  const calls: SyncRequest[] = [];
  const respond: Responder = opts.respond ?? (() => okBody());
  const transport: SyncTransport = {
    async sync(req) {
      calls.push(JSON.parse(JSON.stringify(req)));
      return respond(req, calls.length);
    },
  };
  const flags = { signedOut: 0, reset: 0 };
  const engine: SyncEngine = createSyncEngine({
    userId: opts.userId ?? 'u1',
    deviceId: browser.deviceId,
    store: browser.port,
    kv: browser.kv,
    transport,
    isEnabled: opts.enabled ?? (() => true),
    isOnline: opts.online ?? (() => true),
    now: clock.now,
    timers: clock.timers,
    random: () => 0.5,
    onSignedOut: () => { flags.signedOut++; },
    onServerReset: () => { flags.reset++; },
    options: opts.options,
  });
  return { clock, browser, calls, engine, flags };
}

describe('what is sent', () => {
  it('the first cycle sends everything the device has, oldest change first, and nothing twice', async () => {
    const { engine, browser, calls } = setup();
    browser.add({ id: 'b', triggers: ['focus'] }, T0 + 2000);
    browser.add({ id: 'a' }, T0 + 1000);
    browser.add({ id: 'c', source: 'alarm', confirmed: false }, T0 + 3000);
    engine.start();
    const out = await engine.syncNow();
    expect(out).toEqual({ kind: 'done', pushed: 3, pulled: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0].since).toBe(0);
    expect(calls[0].epoch).toBeNull();
    expect(calls[0].deviceId).toBe('dev-a');
    expect(calls[0].events.map(e => e.id)).toEqual(['a', 'b', 'c']);

    // Nothing changed: the next cycle still asks the server for news, but sends no events.
    await engine.syncNow();
    expect(calls).toHaveLength(2);
    expect(calls[1].events).toEqual([]);
    expect(calls[1].since).toBe(1);
    expect(calls[1].epoch).toBe('epoch-1');
  });

  it('after an edit or a delete only those events go out, the delete as a bare tombstone', async () => {
    const { engine, browser, calls } = setup();
    browser.add({ id: 'a' }, T0 + 1000);
    browser.add({ id: 'b' }, T0 + 2000);
    browser.add({ id: 'c' }, T0 + 3000);
    engine.start();
    await engine.syncNow();

    browser.edit('a', { triggers: ['boredom'] }, T0 + 20_000);
    browser.remove('c', T0 + 21_000);
    await engine.syncNow();
    expect(calls[1].events.map(e => e.id)).toEqual(['a', 'c']);
    expect(calls[1].events[0]).toMatchObject({ id: 'a', triggers: ['boredom'], updatedAt: T0 + 20_000 });
    expect(calls[1].events[1]).toEqual({
      id: 'c', ts: T0 + 3000, source: 'manual', behavior: 'nail_biting', updatedAt: T0 + 21_000, deviceId: 'dev-a', deleted: true,
    });
    await engine.syncNow();
    expect(calls[2].events).toEqual([]);
  });

  it('carries confirmed, falsePositive and competingResponse exactly', async () => {
    const { engine, browser, calls } = setup();
    browser.add({
      id: 'a', source: 'alarm', confirmed: true, falsePositive: false,
      competingResponse: { done: true, durationSec: 12.5 }, hand: 'left', behavior: 'cuticle_skin_biting',
    }, T0 + 1000);
    engine.start();
    await engine.syncNow();
    expect(calls[0].events[0]).toEqual({
      id: 'a', ts: T0 + 1000, source: 'alarm', behavior: 'cuticle_skin_biting', updatedAt: T0 + 1000,
      deviceId: 'dev-a', hand: 'left', triggers: ['stress'], falsePositive: false, confirmed: true,
      competingResponse: { done: true, durationSec: 12.5 },
    });
  });

  it('sends at most batchSize events per request and keeps going until all are sent', async () => {
    const { engine, browser, calls } = setup({ options: { batchSize: 3 } });
    for (let i = 0; i < 8; i++) browser.add({ id: `e${i}` }, T0 + 1000 + i);
    engine.start();
    const out = await engine.syncNow();
    expect(calls.map(c => c.events.length)).toEqual([3, 3, 2]);
    expect(out).toMatchObject({ kind: 'done', pushed: 8 });
    expect(engine.getStatus().pending).toBe(0);
  });

  it('stops after maxRequestsPerCycle and carries on in a later cycle', async () => {
    const { engine, browser, calls, clock } = setup({ options: { batchSize: 2, maxRequestsPerCycle: 2 } });
    for (let i = 0; i < 7; i++) browser.add({ id: `e${i}` }, T0 + 1000 + i);
    engine.start();
    const first = await engine.syncNow();
    expect(first).toMatchObject({ kind: 'partial', pushed: 4 });
    expect(engine.getStatus().pending).toBe(3);
    await clock.advance(60_000); // the follow-up cycle is scheduled one minimum gap later
    expect(calls.flatMap(c => c.events.map(e => e.id)).sort()).toEqual(['e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6']);
    expect(engine.getStatus().pending).toBe(0);
  });

  it('keeps pulling while the server says hasMore', async () => {
    const pages = [
      okBody({ events: [{ id: 'x1', ts: 1, source: 'manual', behavior: 'nail_biting', updatedAt: 1, triggers: ['stress'] }], cursor: 5, hasMore: true }),
      okBody({ events: [{ id: 'x2', ts: 2, source: 'manual', behavior: 'nail_biting', updatedAt: 2, triggers: ['stress'] }], cursor: 9, hasMore: false }),
    ];
    const { engine, browser, calls } = setup({ respond: (_r, n) => pages[n - 1] });
    engine.start();
    const out = await engine.syncNow();
    expect(out).toEqual({ kind: 'done', pushed: 0, pulled: 2 });
    expect(calls.map(c => c.since)).toEqual([0, 5]);
    expect(browser.snapshot().map(e => e.id)).toEqual(['x1', 'x2']);
  });

  it('does not spin if a server says "more" but does not move', async () => {
    const { engine, calls } = setup({ respond: () => okBody({ cursor: 0, hasMore: true }) });
    engine.start();
    const out = await engine.syncNow();
    expect(out.kind).toBe('done');
    expect(calls).toHaveLength(1);
  });
});

describe('privacy: nothing but the whitelisted fields is ever sent', () => {
  it('a field added to a stored event (landmarks, a frame, a photo, a calibration sample) never reaches the request', async () => {
    const { engine, browser, calls } = setup();
    browser.add({ id: 'a' }, T0 + 1000);
    // Somebody (a future feature, a bug) puts extra data on the stored record.
    browser.store.setState({
      incidents: browser.store.getState().incidents.map(i => ({
        ...i,
        landmarks: [[0.1, 0.2, 0.3]],
        frame: 'data:image/png;base64,SECRET-FRAME',
        photoRef: 'nail-photo-17',
        calibration: { chinRest: [1, 2, 3] },
        note: 'SECRET-NOTE',
      })),
    });
    engine.start();
    await engine.syncNow();
    const wire = JSON.stringify(calls);
    for (const secret of ['landmarks', 'SECRET-FRAME', 'nail-photo-17', 'calibration', 'chinRest', 'SECRET-NOTE', '"frame"', '"note"', 'photoRef']) {
      expect(wire, secret).not.toContain(secret);
    }
    expect(Object.keys(calls[0].events[0]).sort()).toEqual(
      ['behavior', 'deviceId', 'id', 'source', 'triggers', 'ts', 'updatedAt'].sort(),
    );
  });

  it('a record that cannot be sent as it is stays on the device, is counted, and does not hold up the others', async () => {
    const { engine, browser, calls } = setup();
    browser.add({ id: 'good' }, T0 + 1000);
    browser.add({ id: 'bad/id with spaces' }, T0 + 2000);
    browser.add({ id: 'also-good' }, T0 + 3000);
    engine.start();
    const out = await engine.syncNow();
    expect(out).toMatchObject({ kind: 'done', pushed: 2 });
    expect(calls[0].events.map(e => e.id)).toEqual(['good', 'also-good']);
    expect(engine.getStatus().skipped).toBe(1);
    expect(engine.getStatus().pending).toBe(0);
  });
});

describe('offline first', () => {
  it('makes no request while offline, then catches up when the network is back', async () => {
    let online = false;
    const { engine, browser, calls, clock } = setup({ online: () => online });
    browser.add({ id: 'a' }, T0 + 1000);
    engine.start();
    await clock.advance(10 * 60_000);
    expect(calls).toHaveLength(0);
    expect(engine.getStatus().phase).toBe('offline');
    expect(engine.getStatus().pending).toBe(1);

    browser.add({ id: 'b' }, T0 + 5000); // still offline: it queues
    online = true;
    engine.notifyOnline();
    await clock.advance(5000);
    expect(calls).toHaveLength(1);
    expect(calls[0].events.map(e => e.id)).toEqual(['a', 'b']);
    expect(engine.getStatus().phase).toBe('idle');
    expect(engine.getStatus().pending).toBe(0);
  });

  it('the queue survives a restart: a new engine on the same storage sends what the old one never got to', async () => {
    const first = setup({ respond: () => ({ ok: false, status: 0 }) });
    first.browser.add({ id: 'a' }, T0 + 1000);
    first.engine.start();
    await first.engine.syncNow();
    expect(first.engine.getStatus().phase).toBe('backoff');
    first.engine.stop();

    // "Reload the page": same device storage, brand-new engine, working network.
    const second = setup({ browser: first.browser });
    second.engine.start();
    const out = await second.engine.syncNow();
    expect(out).toMatchObject({ kind: 'done', pushed: 1 });
    expect(second.calls[0].events.map(e => e.id)).toEqual(['a']);

    // And a third start sends nothing.
    second.engine.stop();
    const third = setup({ browser: first.browser });
    third.engine.start();
    await third.engine.syncNow();
    expect(third.calls[0].events).toEqual([]);
    expect(third.calls[0].since).toBe(1);
    expect(third.calls[0].epoch).toBe('epoch-1');
  });

  it('an edit made while a request is in flight is not lost', async () => {
    let release!: (r: TransportResult) => void;
    const gate = new Promise<TransportResult>(resolve => { release = resolve; });
    const { engine, browser, calls, clock } = setup({ respond: (_r, n) => (n === 1 ? gate : okBody({ cursor: 2 })) });
    browser.add({ id: 'a' }, T0 + 1000);
    engine.start();
    const p = engine.syncNow();
    await clock.settle();
    browser.edit('a', { triggers: ['boredom'] }, T0 + 20_000); // while the first request is out
    release(okBody({ cursor: 1 }));
    await p;
    expect(engine.getStatus().pending).toBe(1); // the edit is still waiting, not marked as sent
    await clock.advance(60_000);
    expect(calls).toHaveLength(2);
    expect(calls[1].events[0]).toMatchObject({ id: 'a', triggers: ['boredom'] });
    expect(engine.getStatus().pending).toBe(0);
  });
});

describe('timing', () => {
  it('syncs at once on start, then every few minutes', async () => {
    const { engine, calls, clock } = setup();
    engine.start();
    await clock.advance(1);
    expect(calls).toHaveLength(1);
    await clock.advance(4 * 60_000);
    expect(calls).toHaveLength(1);
    await clock.advance(2 * 60_000); // 5 minutes +- 10% has passed
    expect(calls).toHaveLength(2);
    await clock.advance(5 * 60_000);
    expect(calls).toHaveLength(3);
  });

  it('batches local changes for the debounce period, and never starts two background attempts closer than the minimum gap', async () => {
    const { engine, browser, calls, clock } = setup();
    engine.start();
    await clock.advance(1);
    expect(calls).toHaveLength(1);

    await clock.advance(70_000); // well past the minimum gap
    browser.add({ id: 'a' }, clock.now());
    await clock.advance(20_000);
    expect(calls).toHaveLength(1); // 20 s after the change: still gathering
    browser.add({ id: 'b' }, clock.now());
    await clock.advance(11_000);
    expect(calls).toHaveLength(2); // 31 s after the first change; both go together
    expect(calls[1].events.map(e => e.id).sort()).toEqual(['a', 'b']);
  });

  it('a change soon after an attempt waits for the minimum gap', async () => {
    const { engine, browser, calls, clock } = setup();
    engine.start();
    await clock.advance(1);
    await clock.advance(5_000);
    browser.add({ id: 'a' }, clock.now());
    await clock.advance(40_000); // 30 s debounce has passed, but the last attempt was only 45 s ago
    expect(calls).toHaveLength(1);
    await clock.advance(20_000);
    expect(calls).toHaveLength(2);
  });

  it('returning to the tab syncs only if the last attempt was a while ago', async () => {
    const { engine, calls, clock } = setup();
    engine.start();
    await clock.advance(1);
    expect(calls).toHaveLength(1);
    await clock.advance(10_000);
    engine.notifyFocus();
    await clock.advance(1000);
    expect(calls).toHaveLength(1); // 11 s since the last attempt: too soon
    await clock.advance(60_000);
    engine.notifyFocus();
    await clock.advance(1000);
    expect(calls).toHaveLength(2);
  });

  it('a manual sync ignores the gap and the back-off', async () => {
    const { engine, calls } = setup({ respond: (_r, n) => (n === 1 ? { ok: false, status: 500 } : okBody()) });
    engine.start();
    await engine.syncNow();
    expect(engine.getStatus().phase).toBe('backoff');
    const out = await engine.syncNow();
    expect(out.kind).toBe('done');
    expect(calls).toHaveLength(2);
  });

  it('merging what the server sent does not schedule a sync of its own', async () => {
    const incoming = { id: 'x', ts: 5, source: 'manual', behavior: 'nail_biting', updatedAt: 5, triggers: ['stress'] };
    const { engine, calls, clock } = setup({ respond: (_r, n) => okBody({ events: n === 1 ? [incoming] : [], cursor: n }) });
    engine.start();
    await clock.advance(1);
    expect(calls).toHaveLength(1);
    await clock.advance(50_000);
    expect(calls).toHaveLength(1); // no debounce-timer follow-up from our own merge
    expect(engine.getStatus().pending).toBe(0); // the pulled event is not "waiting to be sent"
  });
});

describe('errors', () => {
  it('backs off exponentially on network errors and server errors, and recovers', async () => {
    const results: TransportResult[] = [{ ok: false, status: 0 }, { ok: false, status: 503 }, { ok: false, status: 500 }, okBody()];
    const times: number[] = [];
    const ref: { clock?: FakeClock } = {};
    const { engine, calls, clock } = setup({
      respond: (_r, n) => { times.push(ref.clock!.now()); return results[n - 1] ?? okBody(); },
      options: { backoffBaseMs: 30_000, backoffMaxMs: 10 * 60_000 },
    });
    ref.clock = clock;
    engine.start();
    await clock.advance(4 * 60_000);
    expect(calls).toHaveLength(4);
    // random() is 0.5, so the jitter factor is exactly 1: 30 s, 60 s, 120 s.
    expect(times.slice(1).map((t, i) => t - times[i])).toEqual([30_000, 60_000, 120_000]);
    expect(engine.getStatus().phase).toBe('idle');
    expect(engine.getStatus().retryAt).toBeNull();
  });

  it('reports when the next attempt is due while backing off', async () => {
    const { engine, clock } = setup({ respond: () => ({ ok: false, status: 500 }) });
    engine.start();
    await clock.advance(1);
    const st = engine.getStatus();
    expect(st.phase).toBe('backoff');
    expect(st.retryAt).not.toBeNull();
    expect(st.retryAt! - clock.now()).toBeGreaterThan(0);
  });

  it('caps the back-off', async () => {
    const { engine, clock } = setup({ respond: () => ({ ok: false, status: 500 }), options: { backoffBaseMs: 30_000, backoffMaxMs: 100_000 } });
    engine.start();
    for (let i = 0; i < 8; i++) await clock.advance(101_000);
    expect(engine.getStatus().retryAt! - clock.now()).toBeLessThanOrEqual(100_000);
  });

  it('obeys Retry-After on a 429 (but not less than the base delay)', async () => {
    const { engine, clock } = setup({ respond: () => ({ ok: false, status: 429, retryAfterMs: 120_000 }) });
    engine.start();
    await clock.advance(1);
    expect(Math.abs(engine.getStatus().retryAt! - clock.now() - 120_000)).toBeLessThanOrEqual(1);
  });

  it('401: reports signed-out, stops for good and makes no further request', async () => {
    const { engine, calls, clock, flags } = setup({ respond: () => ({ ok: false, status: 401 }) });
    engine.start();
    await clock.advance(1);
    expect(engine.getStatus().phase).toBe('signed_out');
    expect(flags.signedOut).toBe(1);
    await clock.advance(24 * 60 * 60_000);
    engine.notifyFocus();
    engine.notifyOnline();
    expect((await engine.syncNow()).kind).toBe('skipped');
    expect(calls).toHaveLength(1);
  });

  it('404: the server does not offer sync; waits a long time instead of hammering', async () => {
    const { engine, calls, clock } = setup({ respond: () => ({ ok: false, status: 404 }), options: { backoffMaxMs: 30 * 60_000 } });
    engine.start();
    await clock.advance(1);
    expect(engine.getStatus().phase).toBe('unavailable');
    await clock.advance(29 * 60_000);
    expect(calls).toHaveLength(1);
    await clock.advance(2 * 60_000);
    expect(calls).toHaveLength(2);
  });

  it('409: synced data was deleted elsewhere. Forgets its state, switches itself off, uploads nothing more', async () => {
    const { engine, browser, calls, clock, flags } = setup({ respond: (_r, n) => (n === 1 ? okBody() : { ok: false, status: 409 }) });
    browser.add({ id: 'a' }, T0 + 1000);
    engine.start();
    await engine.syncNow();
    expect(browser.kv.dump()[STATE_KEY]).toBeTruthy();
    browser.add({ id: 'b' }, T0 + 2000);
    await engine.syncNow();
    expect(engine.getStatus().phase).toBe('server_reset');
    expect(flags.reset).toBe(1);
    expect(browser.kv.dump()[STATE_KEY]).toBeUndefined();
    expect(browser.kv.dump()[VERSIONS_KEY]).toBeUndefined();
    await clock.advance(60 * 60_000);
    expect(calls).toHaveLength(2);
    // The device keeps its own history.
    expect(browser.snapshot().map(e => e.id)).toEqual(['a', 'b']);
  });

  it('400 (a batch the server refused): no retry loop; waits for the next local change or a manual sync', async () => {
    const { engine, browser, calls, clock } = setup({ respond: (_r, n) => (n <= 1 ? { ok: false, status: 400 } : okBody()) });
    browser.add({ id: 'a' }, T0 + 1000);
    engine.start();
    await clock.advance(1);
    expect(engine.getStatus().phase).toBe('rejected');
    await clock.advance(3 * 60 * 60_000);
    expect(calls).toHaveLength(1);

    browser.add({ id: 'b' }, clock.now());
    await clock.advance(31_000);
    expect(calls).toHaveLength(2);
    expect(engine.getStatus().phase).toBe('idle');
  });

  it('413 (account full): stops trying on its own, a manual sync tries again', async () => {
    const { engine, calls, clock } = setup({ respond: (_r, n) => (n <= 2 ? { ok: false, status: 413 } : okBody()) });
    engine.start();
    await clock.advance(1);
    expect(engine.getStatus().phase).toBe('quota');
    await clock.advance(60 * 60_000);
    expect(calls).toHaveLength(1);
    await engine.syncNow();
    expect(calls).toHaveLength(2);
    expect(engine.getStatus().phase).toBe('quota');
    await engine.syncNow();
    expect(engine.getStatus().phase).toBe('idle');
  });

  it('treats a malformed answer as a failure, not as success', async () => {
    const { engine, browser } = setup({ respond: () => ({ ok: true, body: { nope: true } as unknown as SyncResponse }) });
    browser.add({ id: 'a' }, T0 + 1000);
    engine.start();
    await engine.syncNow();
    expect(engine.getStatus().phase).toBe('backoff');
    expect(engine.getStatus().pending).toBe(1);
  });

  it('a transport that throws is a network error', async () => {
    const clock = createFakeClock(T0);
    const browser = createTestBrowser('a');
    const engine = createSyncEngine({
      userId: 'u1', deviceId: 'dev-a', store: browser.port, kv: browser.kv,
      transport: { sync: () => Promise.reject(new Error('boom')) },
      isEnabled: () => true, isOnline: () => true, now: clock.now, timers: clock.timers, random: () => 0.5,
    });
    browser.add({ id: 'a' }, T0 + 1000);
    engine.start();
    await engine.syncNow();
    expect(engine.getStatus().phase).toBe('backoff');
  });
});

describe('control', () => {
  it('stop() cancels everything: no timer fires, no request is made', async () => {
    const { engine, browser, calls, clock } = setup();
    engine.start();
    await clock.advance(1);
    engine.stop();
    browser.add({ id: 'a' }, clock.now());
    engine.notifyFocus();
    engine.notifyOnline();
    await clock.advance(24 * 60 * 60_000);
    expect(calls).toHaveLength(1);
    expect(clock.pending()).toBe(0);
    expect(engine.getStatus().phase).toBe('off');
    expect((await engine.syncNow()).kind).toBe('skipped');
  });

  it('an answer that arrives after stop() is thrown away (nothing is merged)', async () => {
    let release!: (r: TransportResult) => void;
    const gate = new Promise<TransportResult>(resolve => { release = resolve; });
    const { engine, browser, clock } = setup({ respond: () => gate });
    engine.start();
    const p = engine.syncNow();
    await clock.settle();
    engine.stop();
    release(okBody({ events: [{ id: 'late', ts: 1, source: 'manual', behavior: 'nail_biting', updatedAt: 1 }], cursor: 7 }));
    expect((await p).kind).toBe('skipped');
    expect(browser.snapshot()).toEqual([]);
    expect(browser.kv.dump()[STATE_KEY]).toMatchObject({ cursor: 0 });
  });

  it('while disabled it makes no request at all, and says it is off', async () => {
    let enabled = false;
    const { engine, browser, calls, clock } = setup({ enabled: () => enabled });
    browser.add({ id: 'a' }, T0 + 1000);
    engine.start();
    await clock.advance(60 * 60_000);
    engine.notifyFocus();
    engine.notifyOnline();
    browser.add({ id: 'b' }, clock.now());
    await clock.advance(60 * 60_000);
    expect(await engine.syncNow()).toEqual({ kind: 'skipped', why: 'disabled' });
    expect(calls).toHaveLength(0);
    expect(engine.getStatus().phase).toBe('off');
    enabled = true;
    await engine.syncNow();
    expect(calls).toHaveLength(1);
  });

  it('joins a cycle already running instead of starting a second one', async () => {
    let release!: (r: TransportResult) => void;
    const gate = new Promise<TransportResult>(resolve => { release = resolve; });
    const { engine, calls, clock } = setup({ respond: (_r, n) => (n === 1 ? gate : okBody()) });
    engine.start();
    const a = engine.syncNow();
    const b = engine.syncNow();
    await clock.settle();
    expect(calls).toHaveLength(1);
    release(okBody());
    await Promise.all([a, b]);
    expect(calls).toHaveLength(1);
  });

  it('another account on this browser starts from nothing (its cursor and versions are not reused)', async () => {
    const first = setup({ userId: 'alice' });
    first.browser.add({ id: 'a' }, T0 + 1000);
    first.engine.start();
    await first.engine.syncNow();
    first.engine.stop();

    const second = setup({ browser: first.browser, userId: 'bob' });
    second.engine.start();
    await second.engine.syncNow();
    expect(second.calls[0].since).toBe(0);
    expect(second.calls[0].epoch).toBeNull();
    expect(second.calls[0].events.map(e => e.id)).toEqual(['a']); // bob must opt in first in the UI; the engine itself treats it as a fresh account
  });

  it('forgetState() clears what it kept and does not write it back', async () => {
    const { engine, browser } = setup();
    browser.add({ id: 'a' }, T0 + 1000);
    engine.start();
    await engine.syncNow();
    engine.forgetState();
    engine.stop();
    expect(browser.kv.dump()).toEqual({});
  });

  it('keeps its kv small: versions only for events that still exist', async () => {
    const kv = createMapKv({ [VERSIONS_KEY]: { v: 1, userId: 'u1', map: { gone: 5, a: T0 + 1000 } } });
    const browser = createTestBrowser('a');
    const { engine } = setup({ browser: { ...browser, kv } as TestBrowser });
    browser.add({ id: 'a' }, T0 + 1000);
    engine.start();
    await engine.syncNow();
    const dump = kv.dump() as Record<string, { map: Record<string, number> }>;
    expect(Object.keys(dump[VERSIONS_KEY].map)).toEqual(['a']);
  });
});
