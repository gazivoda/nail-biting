// What "Not a bite" learns stays on the device (WS3). The pose numbers are NOT a field of the event, so
// they are not in the history file, not in an export, and not in anything that syncs events.
//
// The sync contract (WS4): only HabitEvent fields travel. In this codebase that is enforced by two
// functions, the whitelist that builds a record for the outside world (toHabitEvent, used by export and
// by the sync facade) and the strict reader for anything arriving from outside (parseWireEvent). These
// tests pin both against a record that tries to carry a pose, and check that a full "Not a bite" flow
// writes the pose nowhere but the feature's own key-value area.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAppStore, STATE_VERSION } from '../store/useAppStore';
import { createStatePersistStorage } from '../storage/persistStorage';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import { toHabitEvent, fromHabitEvent, type HabitEventWire } from '../storage/eventModel';
import { parseWireEvent } from '../storage';
import { learnFromRejection, rememberAlarmPose, writeCalibration, writeSettings } from './poseStore';
import type { PoseVector } from '../detection/pose';
import { KV_NAMESPACES } from '../storage/kv';

// Every field a HabitEvent may have (docs/agents/PLAN.md WS0), plus `confirmed`, which travels beside it
// (docs/agents/ARCHITECTURE.md section 3). Nothing else may be in a record that leaves the device.
const HABIT_EVENT_FIELDS = [
  'id', 'ts', 'source', 'behavior', 'hand', 'triggers', 'falsePositive', 'competingResponse',
  'deviceId', 'updatedAt', 'deleted', 'confirmed',
].sort();

const POSE: PoseVector = [2, 0.2437, 0.0551, 6, 0.6512, 0.3033];
const SMUGGLED = {
  pose: POSE, poses: [POSE], features: { part: 'knuckle' }, learned: [{ at: 1, v: POSE }], calibration: { tipGuardFw: 0.12 },
  landmarks: [[0.1, 0.2]], hand21: Array(21).fill([0, 0]), image: 'data:image/png;base64,AAAA', v: POSE,
};

let adapter: ReturnType<typeof createMemoryAdapter>;
beforeEach(() => {
  adapter = createMemoryAdapter();
  setStorageAdapter(adapter);
});
afterEach(() => resetStorage());

describe('the event record has no room for a pose', () => {
  const maximal: HabitEventWire = {
    id: 'a', ts: 1, source: 'alarm', behavior: 'nail_biting', hand: 'left', triggers: ['stress'], falsePositive: true,
    competingResponse: { done: true, durationSec: 20 }, deviceId: 'd', updatedAt: 2, deleted: false, confirmed: true,
  };

  it('a fully populated event has exactly the HabitEvent fields (a live event is never `deleted`: that is for tombstones)', () => {
    expect(Object.keys(toHabitEvent(fromHabitEvent(maximal))).sort()).toEqual(HABIT_EVENT_FIELDS.filter(f => f !== 'deleted'));
  });

  it('a stored record that somehow carries a pose is exported without it', () => {
    const dirty = { ...fromHabitEvent(maximal), ...SMUGGLED };
    const out = toHabitEvent(dirty);
    expect(Object.keys(out).every(k => HABIT_EVENT_FIELDS.includes(k))).toBe(true);
    expect(JSON.stringify(out)).not.toMatch(/data:image|landmarks|0\.2437|hand21|tipGuardFw/);
  });

  it('an event arriving from outside (an import, a sync) is read strictly: a smuggled pose is dropped', () => {
    const parsed = parseWireEvent({ ...maximal, ...SMUGGLED });
    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed!).every(k => HABIT_EVENT_FIELDS.includes(k))).toBe(true);
    expect(JSON.stringify(parsed)).not.toMatch(/data:image|landmarks|0\.2437|hand21|tipGuardFw/);
  });

  it('there is no pose field in the type the sync talks about', () => {
    // A type-level fact turned into a runtime one: the whitelist above is the contract, and none of the
    // feature's data names is on it.
    for (const name of ['pose', 'poses', 'features', 'learned', 'calibration', 'landmarks', 'v']) expect(HABIT_EVENT_FIELDS).not.toContain(name);
  });
});

describe('a whole "Not a bite" flow writes the pose only to its own keys', () => {
  it('the history payload and the event list never contain it; the feature\'s key-value area does', () => {
    const store = createAppStore(createStatePersistStorage(STATE_VERSION));
    store.getState().logIncident('auto-detected', true, { behavior: 'nail_biting', hand: 'right' });
    const id = store.getState().incidents[0].id;
    const ts = store.getState().incidents[0].timestamp;

    // What the bridge and the actions do, with the same storage:
    rememberAlarmPose({ at: ts, v: POSE });
    store.getState().patchEvent(id, { falsePositive: true });
    learnFromRejection(id, POSE);
    writeSettings({ handFilter: 'left' });
    writeCalibration({ at: ts, chinRegionFw: 0.3, tipGuardFw: 0.12, rest: [POSE], real: [POSE], restFrames: 30, realFrames: 30 });

    const history = adapter.getItem('stop-biting-state')!;
    expect(history).toContain('"falsePositive":true');                      // the mark IS part of the event
    expect(history).not.toMatch(/0\.2437|0\.6512|0\.3033/);                  // the pose is NOT
    const eventKeys = Object.keys((JSON.parse(history) as { state: { incidents: Array<Record<string, unknown>> } }).state.incidents[0]);
    expect(eventKeys.every(k => ['id', 'timestamp', 'tag', 'autoDetected', 'ts', 'source', 'behavior', 'updatedAt', 'deviceId', 'hand', 'falsePositive', 'triggers', 'competingResponse', 'confirmed'].includes(k))).toBe(true);

    // The pose is in the feature's own keys, and nowhere else.
    const keysWithPose = adapter.keys!().filter(k => (adapter.getItem(k) ?? '').includes('0.2437'));
    expect(keysWithPose.sort()).toEqual(['sb:falsePositive:alarm-poses', 'sb:falsePositive:calibration', 'sb:falsePositive:learned']);
    expect(keysWithPose.every(k => k.startsWith('sb:falsePositive:'))).toBe(true);
  });

  it('the feature uses one reserved namespace of the key-value area, and no other', () => {
    expect(KV_NAMESPACES).toContain('falsePositive');
    writeSettings({ handFilter: 'right' });
    rememberAlarmPose({ at: 1, v: POSE }, 1);
    for (const key of adapter.keys!()) expect(key.startsWith('sb:falsePositive:'), key).toBe(true);
  });
});
