// Every alarm records the behaviour that set it off, through logIncident's `extras`
// (the call CameraView.handleAlert makes). The 30 second episode merge is per behaviour.

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { useAppStore, AUTO_EPISODE_MS } from '../store/useAppStore';

const T0 = 1_700_000_000_000;
const at = (ms: number) => vi.setSystemTime(T0 + ms);
const store = () => useAppStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  at(0);
  store().clearAllData();
});
afterAll(() => vi.useRealTimers());

describe('alarms carry their behaviour', () => {
  it('records the behaviour on the alarm and nothing else different', () => {
    at(1000); store().logIncident('auto-detected', true, { behavior: 'nose_picking' });
    const [rec] = store().incidents;
    expect(rec).toMatchObject({ autoDetected: true, source: 'alarm', behavior: 'nose_picking', tag: 'auto-detected' });
  });

  it('an alarm passed the default behaviour is stored exactly like one passed nothing', () => {
    at(1000); store().logIncident('auto-detected', true);
    at(1000 + AUTO_EPISODE_MS + 5000); store().logIncident('auto-detected', true, { behavior: 'nail_biting' });
    const [withExtras, without] = store().incidents;
    const strip = (r: Record<string, unknown>) => {
      const { id: _id, timestamp: _t, ts: _ts, updatedAt: _u, ...rest } = r; // eslint-disable-line @typescript-eslint/no-unused-vars
      return rest;
    };
    expect(Object.keys(withExtras).sort()).toEqual(Object.keys(without).sort());
    expect(strip(withExtras as unknown as Record<string, unknown>)).toEqual(strip(without as unknown as Record<string, unknown>));
  });
});

describe('episodes are merged per behaviour', () => {
  it('two alarms of one behaviour inside 30 seconds are one entry', () => {
    at(0); store().logIncident('auto-detected', true, { behavior: 'nose_picking' });
    at(10_000); store().logIncident('auto-detected', true, { behavior: 'nose_picking' });
    expect(store().incidents).toHaveLength(1);
  });

  it('an alarm of another behaviour inside 30 seconds is its own entry', () => {
    at(0); store().logIncident('auto-detected', true, { behavior: 'nail_biting' });
    at(10_000); store().logIncident('auto-detected', true, { behavior: 'nose_picking' });
    expect(store().incidents.map(i => i.behavior).sort()).toEqual(['nail_biting', 'nose_picking']);
    // and each still merges with its own kind
    at(15_000); store().logIncident('auto-detected', true, { behavior: 'nail_biting' });
    at(16_000); store().logIncident('auto-detected', true, { behavior: 'nose_picking' });
    expect(store().incidents).toHaveLength(2);
  });

  it('after 30 seconds the same behaviour logs again', () => {
    at(0); store().logIncident('auto-detected', true, { behavior: 'hair_pulling' });
    at(AUTO_EPISODE_MS + 1000); store().logIncident('auto-detected', true, { behavior: 'hair_pulling' });
    expect(store().incidents).toHaveLength(2);
  });
});
