// The phone companion over the real sync server (WS6): two browsers on one account, the "phone" logging
// through the phone view's own log flow (src/phone/logFlow.ts) and the "computer" being any other browser.
// Nothing here re-implements sync: the phone's writes are ordinary events, and WS4's engine and the real
// /api/events routes (in-memory SQLite, real HTTP) do the rest.

import { describe, it, expect, afterEach } from 'vitest';
import { makeEventsHarness } from '../../test-utils/eventsHarness.js';
import { createSyncEngine } from '../../src/sync/engine.ts';
import { createEngineTransport } from '../../src/sync/api.ts';
import { SYNC_EVENT_FIELDS } from '../../src/sync/payload.ts';
import { createFakeClock } from '../../test-utils/fakeClock.ts';
import { createTestBrowser, httpRequestFor } from '../../test-utils/syncHarness.ts';
import { createLogFlow } from '../../src/phone/logFlow.ts';
import { fromHabitEvent, isUrge } from '../../src/storage/eventModel.ts';
import { isBite } from '../../src/store/useAppStore.ts';

const T0 = 1_700_000_000_000;

let open = [];
afterEach(async () => {
  await Promise.all(open.map(h => h.close()));
  open = [];
});

async function world({ user = 'alice' } = {}) {
  const h = await makeEventsHarness();
  open.push(h);
  const requests = [];
  const clock = createFakeClock(T0 + 1_000_000);
  const joined = [];

  /** A browser; `sync: true` also runs WS4's engine on it, as SyncHost does for a person who opted in. */
  function browser(name, { sync = true } = {}) {
    const b = createTestBrowser(name);
    const state = { online: true };
    let engine = null;
    if (sync) {
      engine = createSyncEngine({
        userId: user,
        deviceId: b.deviceId,
        store: b.port,
        kv: b.kv,
        transport: createEngineTransport(httpRequestFor(h.url, user, (method, path, body) => requests.push({ by: name, method, path, body }))),
        isEnabled: () => true,
        isOnline: () => state.online,
        now: clock.now,
        timers: clock.timers,
        random: () => 0.5,
        onServerReset: () => {},
        onSignedOut: () => {},
      });
      engine.start();
    }
    const dev = { name, browser: b, engine, state };
    joined.push(dev);
    return dev;
  }

  /** The phone view's log flow over this browser's own store: the same writes `events.add / update / softDelete` make. */
  function phoneFlow(dev, at) {
    const store = dev.browser.store;
    let n = 0;
    return createLogFlow({
      events: {
        add: input => {
          const e = { id: `${dev.name}-${++n}`, ts: at(), source: input.source, behavior: 'nail_biting', updatedAt: at(), deviceId: dev.browser.deviceId, triggers: [...input.triggers] };
          store.getState().insertEvent(fromHabitEvent(e));
          return { id: e.id };
        },
        update: (id, patch) => dev.browser.edit(id, patch, at()),
        softDelete: id => { dev.browser.remove(id, at()); return true; },
      },
      urge: {
        log: () => {
          const id = `${dev.name}-u${++n}`;
          store.getState().insertEvent(fromHabitEvent({ id, ts: at(), source: 'manual', behavior: 'nail_biting', updatedAt: at(), deviceId: dev.browser.deviceId, triggers: ['urge'] }));
          return id;
        },
        undo: id => { dev.browser.remove(id, at()); },
      },
      now: at,
      schedule: () => 0,
      cancel: () => {},
    });
  }

  const serverEvents = () => h.rows(user);
  const syncAll = async (...devs) => { for (const d of devs) await d.engine.syncNow(); };
  return { h, browser, phoneFlow, requests, serverEvents, syncAll, clock };
}

const live = dev => dev.browser.snapshot().filter(e => !e.deleted);

describe('sync ON: what the phone logs reaches the computer', () => {
  it('a bite with a tag, and an urge, arrive on the other device as the same normal events', async () => {
    const w = await world();
    const phone = w.browser('phone');
    const desktop = w.browser('desktop');
    let t = T0 + 10_000;
    const flow = w.phoneFlow(phone, () => t);

    flow.tapBite();                // tap 1: logged
    t += 2_000;
    flow.tapTrigger('stress');     // tap 2 (optional): the same entry gets its tag
    t += 60_000;
    flow.tapUrge();                // the urge timer's entry shape (WS2): manual, trigger "urge"

    await w.syncAll(phone, desktop, phone);

    expect(desktop.browser.snapshot()).toEqual(phone.browser.snapshot());
    const events = live(desktop);
    expect(events).toHaveLength(2);
    const bite = events.find(e => e.id === 'phone-1');
    expect(bite).toMatchObject({ source: 'manual', behavior: 'nail_biting', triggers: ['stress'], deviceId: 'dev-phone' });
    expect(bite.updatedAt).toBe(T0 + 12_000); // the tag tap was the later write, so that is the version that travelled
    expect(events.find(e => e.id.startsWith('phone-u'))).toMatchObject({ triggers: ['urge'], source: 'manual' });
  });

  it('on the computer the phone\'s bite is a bite and the urge is not: streak and counts follow the shared predicates', async () => {
    const w = await world();
    const phone = w.browser('phone');
    const desktop = w.browser('desktop');
    let t = T0 + 5_000;
    const flow = w.phoneFlow(phone, () => t);
    flow.tapBite();
    t += 10_000;
    flow.tapUrge();
    await w.syncAll(phone, desktop);

    const incidents = desktop.browser.store.getState().incidents;
    expect(incidents).toHaveLength(2);
    expect(incidents.filter(isBite)).toHaveLength(1);
    expect(incidents.filter(isUrge)).toHaveLength(1);
    expect(desktop.browser.store.getState().lastBiteTime).toBe(T0 + 5_000); // the bite ended the streak there; the urge did not
  });

  it('a tag changed after the first sync, and an Undo, both reach the computer', async () => {
    const w = await world();
    const phone = w.browser('phone');
    const desktop = w.browser('desktop');
    let t = T0 + 1_000;
    const flow = w.phoneFlow(phone, () => t);
    flow.tapBite();
    await w.syncAll(phone, desktop);
    expect(live(desktop)[0].triggers).toEqual(['unknown']);

    t += 3_000;
    flow.tapTrigger('boredom');
    await w.syncAll(phone, desktop);
    expect(live(desktop)[0].triggers).toEqual(['boredom']);

    t += 3_000;
    flow.undo();
    await w.syncAll(phone, desktop);
    expect(live(desktop)).toHaveLength(0);
    expect(desktop.browser.store.getState().lastBiteTime).toBeNull(); // the streak is back, on the computer too
  });

  it('logged with no connection, then it arrives when the phone is back online', async () => {
    const w = await world();
    const phone = w.browser('phone');
    const desktop = w.browser('desktop');
    phone.state.online = false;
    let t = T0 + 1_000;
    const flow = w.phoneFlow(phone, () => t);
    flow.tapBite();
    t += 61_000;
    flow.tapBite();
    const before = w.requests.length;
    await phone.engine.syncNow();
    expect(w.requests.length).toBe(before);        // offline: no request at all
    expect(live(phone)).toHaveLength(2);           // and nothing lost
    await w.syncAll(desktop);
    expect(live(desktop)).toHaveLength(0);

    phone.state.online = true;
    await w.syncAll(phone, desktop);
    expect(live(desktop).map(e => e.id)).toEqual(['phone-1', 'phone-2']);
  });

  it('only HabitEvent fields leave the phone: nothing the phone view keeps for itself is in a request', async () => {
    const w = await world();
    const phone = w.browser('phone');
    let t = T0 + 1_000;
    w.phoneFlow(phone, () => t).tapBite();
    await w.syncAll(phone);
    const pushed = w.requests.filter(r => r.by === 'phone').flatMap(r => r.body.events);
    expect(pushed).toHaveLength(1);
    for (const e of pushed) {
      for (const k of Object.keys(e)) expect(SYNC_EVENT_FIELDS, k).toContain(k);
    }
    expect(JSON.stringify(w.requests.map(r => r.body))).not.toMatch(/grant|firstName|entitlement|phone-view|shortcut/i);
  });
});

describe('sync OFF: what the phone logs stays on the phone', () => {
  it('the phone logs with no engine: no request is made, the server holds nothing, the computer sees nothing', async () => {
    const w = await world();
    const phone = w.browser('phone', { sync: false }); // never opted in: SyncHost renders nothing
    const desktop = w.browser('desktop');
    let t = T0 + 1_000;
    const flow = w.phoneFlow(phone, () => t);
    flow.tapBite();
    flow.tapTrigger('focus');
    t += 90_000;
    flow.tapUrge();

    await w.syncAll(desktop, desktop);
    await w.clock.advance(60 * 60 * 1000); // an hour of timers: still nothing from the phone

    expect(live(phone)).toHaveLength(2);
    expect(w.requests.filter(r => r.by === 'phone')).toEqual([]);
    expect(w.serverEvents()).toHaveLength(0);
    expect(live(desktop)).toHaveLength(0);
  });

  it('turning sync on later sends the history that was waiting (nothing logged while it was off is lost)', async () => {
    const w = await world();
    const phoneOff = w.browser('phone', { sync: false });
    const desktop = w.browser('desktop');
    let t = T0 + 1_000;
    w.phoneFlow(phoneOff, () => t).tapBite();
    await w.syncAll(desktop);
    expect(live(desktop)).toHaveLength(0);

    // The same browser profile after the person turns sync on: its history is what the engine starts from.
    const phoneOn = w.browser('phone-on');
    for (const e of phoneOff.browser.snapshot()) phoneOn.browser.store.getState().insertEvent(fromHabitEvent(e));
    await w.syncAll(phoneOn, desktop);
    expect(live(desktop).map(e => e.id)).toEqual(['phone-1']);
  });
});
