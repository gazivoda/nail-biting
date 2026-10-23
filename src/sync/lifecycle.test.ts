// "Sync off means zero event network calls", proven the hard way: run a whole
// page lifecycle (sign in, edits, tab focus, going offline and online, a day of
// timers, sign out) against a fetch spy, with sync disabled in each of the ways
// it can be disabled. The spy must hear nothing. Then the same lifecycle with
// sync enabled must make calls, so the spy is known to work.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSyncController, type SyncController, type SyncEnvironment } from './controller';
import { createSyncEngine } from './engine';
import { createEngineTransport, type HttpRequest } from './api';
import { createFakeClock } from '../../test-utils/fakeClock';
import { createTestBrowser } from '../../test-utils/syncHarness';

const T0 = 1_700_000_000_000;

/** An HttpRequest that goes through whatever `fetch` is right now (so a global spy hears it). */
const requestViaGlobalFetch: HttpRequest = async (method, path, body) => {
  const res = await fetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
};

function fakeEnv() {
  const handlers = { focus: new Set<() => void>(), online: new Set<() => void>(), offline: new Set<() => void>() };
  let online = true;
  const env: SyncEnvironment = {
    isOnline: () => online,
    onFocus: cb => { handlers.focus.add(cb); return () => handlers.focus.delete(cb); },
    onOnline: cb => { handlers.online.add(cb); return () => handlers.online.delete(cb); },
    onOffline: cb => { handlers.offline.add(cb); return () => handlers.offline.delete(cb); },
  };
  return {
    env,
    focus: () => handlers.focus.forEach(f => f()),
    goOffline: () => { online = false; handlers.offline.forEach(f => f()); },
    goOnline: () => { online = true; handlers.online.forEach(f => f()); },
    listeners: () => handlers.focus.size + handlers.online.size + handlers.offline.size,
  };
}

function rig(opts: { isEnabled?: () => boolean } = {}) {
  const clock = createFakeClock(T0);
  const browser = createTestBrowser('a');
  const page = fakeEnv();
  const created: string[] = [];
  const controller: SyncController = createSyncController({
    env: page.env,
    createEngine: userId => {
      created.push(userId);
      return createSyncEngine({
        userId, deviceId: browser.deviceId, store: browser.port, kv: browser.kv,
        transport: createEngineTransport(requestViaGlobalFetch),
        isEnabled: opts.isEnabled ?? (() => true),
        isOnline: page.env.isOnline,
        now: clock.now, timers: clock.timers, random: () => 0.5,
      });
    },
  });
  return { clock, browser, page, controller, created };
}

/** Everything a page does over a day. */
async function liveADay(r: ReturnType<typeof rig>) {
  r.browser.add({ id: 'e1' }, r.clock.now());
  await r.clock.advance(60_000);
  r.page.focus();
  r.browser.add({ id: 'e2' }, r.clock.now());
  r.browser.edit('e1', { triggers: ['boredom'] }, r.clock.now());
  await r.clock.advance(5 * 60_000);
  r.page.goOffline();
  r.browser.remove('e2', r.clock.now());
  await r.clock.advance(60 * 60_000);
  r.page.goOnline();
  r.page.focus();
  await r.clock.advance(24 * 60 * 60_000);
}

const calls = () => (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;

describe('sync off: zero event network calls', () => {
  const realFetch = globalThis.fetch;
  const spy = () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ events: [], cursor: 1, hasMore: false, epoch: 'e' }), { status: 200 })) as unknown as typeof fetch;
  };
  afterEach(() => { globalThis.fetch = realFetch; });

  it('nobody opted in', async () => {
    spy();
    const r = rig();
    r.controller.update({ userId: 'u1', flagOn: true, optInUserId: null });
    await liveADay(r);
    r.controller.update({ userId: null, flagOn: true, optInUserId: null }); // sign out
    r.controller.update({ userId: 'u2', flagOn: true, optInUserId: null }); // someone else signs in
    await liveADay(r);
    r.controller.dispose();
    expect(calls()).toHaveLength(0);
    expect(r.created).toEqual([]);          // not even an engine exists
    expect(r.clock.pending()).toBe(0);      // no timer waiting
    expect(r.page.listeners()).toBe(0);     // no page listener installed
  });

  it('opted in, but the feature flag is off', async () => {
    spy();
    const r = rig();
    r.controller.update({ userId: 'u1', flagOn: false, optInUserId: 'u1' });
    await liveADay(r);
    r.controller.dispose();
    expect(calls()).toHaveLength(0);
    expect(r.created).toEqual([]);
  });

  it('a different person opted in on this browser', async () => {
    spy();
    const r = rig();
    r.controller.update({ userId: 'u2', flagOn: true, optInUserId: 'u1' });
    await liveADay(r);
    r.controller.dispose();
    expect(calls()).toHaveLength(0);
    expect(r.created).toEqual([]);
  });

  it('signed out', async () => {
    spy();
    const r = rig();
    r.controller.update({ userId: null, flagOn: true, optInUserId: 'u1' });
    await liveADay(r);
    r.controller.dispose();
    expect(calls()).toHaveLength(0);
    expect(r.created).toEqual([]);
  });

  it('even an engine that exists makes no request while its isEnabled() says no', async () => {
    spy();
    const r = rig({ isEnabled: () => false });
    r.controller.update({ userId: 'u1', flagOn: true, optInUserId: 'u1' });
    expect(r.created).toEqual(['u1']);
    await liveADay(r);
    await r.controller.active()!.syncNow();
    r.controller.dispose();
    expect(calls()).toHaveLength(0);
  });

  it('switching sync off in the middle of a session stops everything at once', async () => {
    spy();
    const r = rig();
    r.controller.update({ userId: 'u1', flagOn: true, optInUserId: 'u1' });
    await r.clock.advance(1000);
    const before = calls().length;
    expect(before).toBeGreaterThan(0);

    r.controller.update({ userId: 'u1', flagOn: true, optInUserId: null }); // the toggle goes off
    expect(r.controller.active()).toBeNull();
    expect(r.page.listeners()).toBe(0);
    expect(r.clock.pending()).toBe(0);
    await liveADay(r);
    expect(calls()).toHaveLength(before);
  });

  it('signing out stops everything at once', async () => {
    spy();
    const r = rig();
    r.controller.update({ userId: 'u1', flagOn: true, optInUserId: 'u1' });
    await r.clock.advance(1000);
    const before = calls().length;
    r.controller.update({ userId: null, flagOn: true, optInUserId: 'u1' });
    await liveADay(r);
    expect(calls()).toHaveLength(before);
    expect(r.created).toEqual(['u1']);
  });

  it('control: the same day with sync ON does make calls (so the spy works) and only to the sync endpoint', async () => {
    spy();
    const r = rig();
    r.controller.update({ userId: 'u1', flagOn: true, optInUserId: 'u1' });
    await liveADay(r);
    expect(calls().length).toBeGreaterThan(3);
    for (const [url] of calls()) expect(url).toBe('/api/events/sync');
    r.controller.dispose();
  });

  it('switching on creates exactly one engine and one set of listeners, however often it is told', async () => {
    spy();
    const r = rig();
    for (let i = 0; i < 5; i++) r.controller.update({ userId: 'u1', flagOn: true, optInUserId: 'u1' });
    expect(r.created).toEqual(['u1']);
    expect(r.page.listeners()).toBe(3);
    r.controller.dispose();
    expect(r.page.listeners()).toBe(0);
  });

  it('a different account signing in replaces the engine, never shares it', async () => {
    spy();
    const r = rig();
    r.controller.update({ userId: 'u1', flagOn: true, optInUserId: 'u1' });
    r.controller.update({ userId: 'u2', flagOn: true, optInUserId: 'u1' });
    expect(r.controller.active()).toBeNull();
    r.controller.update({ userId: 'u2', flagOn: true, optInUserId: 'u2' });
    expect(r.created).toEqual(['u1', 'u2']);
    r.controller.dispose();
  });
});
