// Pure-function tests of the v1 -> v2 event schema migration. No DOM, no
// storage, no store instance: just `migrateState` on fixtures of what v1
// actually persisted. The point of every test here is the same sentence: an
// existing user's history, streak and statistics must not change.

import { describe, it, expect } from 'vitest';
import {
  migrateState,
  computeBestStreak,
  deriveStreakState,
  isBite,
  STATE_VERSION,
} from '../store/useAppStore';
import { useAppStore } from '../store/useAppStore';
import { seedPreviewData } from '../dev/preview';
import { topTrigger, peakHour } from '../utils/insights';
import type { Incident } from '../types';
import {
  upgradeIncident,
  toHabitEvent,
  fromHabitEvent,
  type StoredEvent,
} from './eventModel';
import {
  basicState, emptyState, largeState, prunedState, v0State, persistedJson, T0, DAY,
} from './fixtures/v1State';

type State = Record<string, unknown>;
const incidentsOf = (s: unknown) => (s as { incidents: Incident[] }).incidents;
const migrate = (s: State, version = 1) => migrateState(JSON.parse(JSON.stringify(s)), version) as State;

/** Recursively freezes, so any in-place mutation by the migration throws. */
function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object') {
    Object.values(x as object).forEach(deepFreeze);
    Object.freeze(x);
  }
  return x;
}

const withoutIncidents = (s: State) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'incidents'));

const LEGACY_FIELDS = ['id', 'timestamp', 'tag', 'autoDetected', 'confirmed'] as const;
const legacyView = (i: Incident) => Object.fromEntries(LEGACY_FIELDS.filter(k => k in i).map(k => [k, (i as unknown as Record<string, unknown>)[k]]));

describe('STATE_VERSION', () => {
  it('is 2, and the persisted key name is untouched', () => {
    expect(STATE_VERSION).toBe(2);
  });
});

describe('v1 -> v2: nothing is lost or changed', () => {
  const cases: [string, State][] = [
    ['a realistic history with manual logs, tags, custom tags and gaps', basicState()],
    ['an empty history', emptyState()],
    ['a pruned history (advanced anchor, banked record)', prunedState()],
  ];

  for (const [name, v1] of cases) {
    describe(name, () => {
      const v2 = migrate(v1);
      const before = incidentsOf(v1);
      const after = incidentsOf(v2);

      it('keeps every event: same count, same order, same ids and timestamps', () => {
        expect(after).toHaveLength(before.length);
        expect(after.map(i => i.id)).toEqual(before.map(i => i.id));
        expect(after.map(i => i.timestamp)).toEqual(before.map(i => i.timestamp));
      });

      it('leaves every v1 field of every event exactly as it was (tags, confirmed, autoDetected)', () => {
        expect(after.map(legacyView)).toEqual(before.map(legacyView));
      });

      it('fills the v2 defaults', () => {
        for (let k = 0; k < after.length; k++) {
          expect(after[k].ts).toBe(before[k].timestamp);
          expect(after[k].source).toBe(before[k].autoDetected ? 'alarm' : 'manual');
          expect(after[k].behavior).toBe('nail_biting');
          expect(after[k].updatedAt).toBe(before[k].timestamp);
          expect(after[k].deviceId).toBeUndefined(); // never invented by a pure migration
        }
      });

      it('preserves every other persisted field (streak inputs and settings)', () => {
        expect(withoutIncidents(v2)).toEqual(withoutIncidents(v1));
      });
    });
  }

  it('does not mutate its input', () => {
    const frozen = deepFreeze(JSON.parse(JSON.stringify(basicState())));
    expect(() => migrateState(frozen, 1)).not.toThrow();
  });

  it('keeps unknown extra fields, on events and on the state', () => {
    const state = basicState();
    const first = (state.incidents as State[])[0];
    first.note = 'felt anxious';
    first.future = { nested: [1, 2, 3] };
    state.someFutureSetting = 'keep me';

    const out = migrate(state);
    expect(incidentsOf(out)[0]).toMatchObject({ note: 'felt anxious', future: { nested: [1, 2, 3] } });
    expect(out.someFutureSetting).toBe('keep me');
  });

  it('survives a 10,000 event history intact', () => {
    const v1 = largeState(10_000);
    const before = incidentsOf(v1);
    expect(before).toHaveLength(10_000);

    const after = incidentsOf(migrate(v1));
    expect(after).toHaveLength(10_000);
    expect(after.map(i => i.id)).toEqual(before.map(i => i.id));
    expect(after.map(i => i.timestamp)).toEqual(before.map(i => i.timestamp));
    expect(after.map(legacyView)).toEqual(before.map(legacyView));
    // No pruning on the migration path: that only happens when a new event is logged.
    expect(new Set(after.map(i => i.id)).size).toBe(10_000);
  });
});

describe('v1 -> v2: idempotent', () => {
  it('migrating twice equals migrating once', () => {
    for (const v1 of [basicState(), emptyState(), prunedState(), largeState(2_000)]) {
      const once = migrate(v1);
      const twice = migrate(once, 1); // e.g. a rollback bundle re-labelled the payload v1
      expect(twice).toEqual(once);
    }
  });

  it('is a no-op for a payload already at the current version', () => {
    const once = migrate(basicState());
    expect(migrateState(once, STATE_VERSION)).toEqual(once);
  });

  it('does not overwrite v2 fields that are already set', () => {
    const once = migrate(basicState());
    const first = incidentsOf(once)[0];
    first.behavior = 'nose_picking';
    first.updatedAt = 999;
    first.hand = 'left';
    const again = migrate(once, 1);
    expect(incidentsOf(again)[0]).toMatchObject({ behavior: 'nose_picking', updatedAt: 999, hand: 'left' });
  });
});

describe('v0 -> v2 in one step', () => {
  it('adds the retention fields, then the event fields', () => {
    const v0 = v0State();
    const out = migrate(v0, 0);
    expect(out.historyStartTime).toBe(v0.firstOpenTime);
    expect(out.bestStreakFloorMs).toBe(0);
    expect(incidentsOf(out).every(i => i.ts !== undefined && i.behavior === 'nail_biting')).toBe(true);
    expect(incidentsOf(out)).toHaveLength(incidentsOf(v0).length);
  });
});

describe('ids', () => {
  it('keeps a usable string id, even an odd one', () => {
    const rec = upgradeIncident({ id: 'p0-1', timestamp: 5, tag: 'stress', autoDetected: false });
    expect(rec.id).toBe('p0-1');
  });

  it('stringifies a numeric id and generates one only when there is nothing usable', () => {
    expect(upgradeIncident({ id: 42 as unknown as string, timestamp: 5, tag: 'x', autoDetected: false }).id).toBe('42');
    const gen = upgradeIncident({ id: '' as string, timestamp: 5, tag: 'x', autoDetected: false }, () => 'generated');
    expect(gen.id).toBe('generated');
    const missing = upgradeIncident({ timestamp: 5, tag: 'x', autoDetected: false } as unknown as Incident, () => 'g2');
    expect(missing.id).toBe('g2');
  });

  it('does not drop or throw on odd entries', () => {
    const state = { incidents: [null, 7, { id: 'a', timestamp: 1, tag: 't', autoDetected: false }] };
    const out = migrateState(state, 1) as { incidents: unknown[] };
    expect(out.incidents).toHaveLength(3);
    expect(out.incidents[0]).toBeNull();
    expect(out.incidents[1]).toBe(7);
  });
});

// ── Streaks and statistics are identical ────────────────────────────────────

/** Everything the screens derive from history, computed the way they do. */
function statsOf(state: State) {
  const incidents = incidentsOf(state);
  const historyStartTime = state.historyStartTime as number;
  const bites = incidents.filter(isBite);
  const dayKey = (t: number) => Math.floor((t - T0) / DAY);
  const perDay = new Map<number, { all: number; bites: number }>();
  for (const i of incidents) {
    const k = dayKey(i.timestamp);
    const d = perDay.get(k) ?? { all: 0, bites: 0 };
    d.all++;
    if (isBite(i)) d.bites++;
    perDay.set(k, d);
  }
  return {
    best: computeBestStreak(incidents, historyStartTime),
    derived: deriveStreakState({
      incidents,
      historyStartTime,
      bestStreakFloorMs: state.bestStreakFloorMs as number,
    }),
    bites: bites.length,
    pendingAlarms: incidents.filter(i => i.autoDetected && !i.confirmed).length,
    topTrigger: topTrigger(bites),
    peakHour: peakHour(bites),
    perDay: [...perDay.entries()].sort(([a], [b]) => a - b),
    // Today's-stats style counts used by the dashboard.
    todayAlarms: incidents.filter(i => i.timestamp >= T0 + 38 * DAY && i.autoDetected && !i.confirmed).length,
    todayBites: incidents.filter(i => i.timestamp >= T0 + 38 * DAY && (!i.autoDetected || i.confirmed)).length,
  };
}

describe('streak and statistics are identical before and after migration', () => {
  const histories: [string, State][] = [
    ['basic', basicState()],
    ['empty', emptyState()],
    ['pruned', prunedState()],
    ['10,000 events', largeState(10_000)],
  ];

  for (const [name, v1] of histories) {
    it(`${name}: streak, best streak, counts, top trigger and peak hour all match`, () => {
      const before = statsOf(v1);
      const after = statsOf(migrate(v1));
      expect(after).toEqual(before);
    });
  }

  it('the stored streak fields still agree with what is derived from the migrated history', () => {
    const v2 = migrate(basicState());
    const derived = deriveStreakState({
      incidents: incidentsOf(v2),
      historyStartTime: v2.historyStartTime as number,
      bestStreakFloorMs: v2.bestStreakFloorMs as number,
    });
    expect(derived.lastBiteTime).toBe(v2.lastBiteTime);
    expect(derived.bestStreakMs).toBe(v2.bestStreakMs);
  });
});

// ── The persisted JSON itself ───────────────────────────────────────────────

describe('the exact persisted payload', () => {
  it('a v1 payload parses, migrates and re-serialises without losing a byte of v1 data', () => {
    const raw = persistedJson(basicState(), 1);
    const parsed = JSON.parse(raw) as { state: State; version: number };
    expect(parsed.version).toBe(1);

    const migrated = migrateState(parsed.state, parsed.version) as State;
    const roundTripped = JSON.parse(JSON.stringify({ state: migrated, version: STATE_VERSION })) as { state: State };
    expect(incidentsOf(roundTripped.state).map(legacyView)).toEqual(incidentsOf(parsed.state).map(legacyView));
  });
});

// ── Canonical event conversions ─────────────────────────────────────────────

describe('toHabitEvent / fromHabitEvent', () => {
  it('round-trips every legacy field for every shape of v1 event', () => {
    const migrated = incidentsOf(migrate(basicState())) as StoredEvent[];
    for (const rec of migrated) {
      const back = fromHabitEvent(toHabitEvent(rec));
      expect(legacyView(back)).toEqual(legacyView(rec));
    }
  });

  it('maps tags to triggers without inventing one for an untagged alarm', () => {
    const migrated = incidentsOf(migrate(basicState())) as StoredEvent[];
    const byId = new Map(migrated.map(r => [r.id, toHabitEvent(r)]));
    expect(byId.get('00000000-0000-4000-8000-000000000011')?.triggers).toEqual(['stress']);
    expect(byId.get('00000000-0000-4000-8000-000000000010')?.triggers).toBeUndefined(); // pending alarm
    expect(byId.get('00000000-0000-4000-8000-000000000009')?.triggers).toEqual(['custom-ab12cd34']);
    expect(byId.get('00000000-0000-4000-8000-000000000007')?.confirmed).toBe(true);
  });

  it('gives a record that has no v2 fields the defaults', () => {
    const e = toHabitEvent({ id: 'x', timestamp: 100, tag: 'focus', autoDetected: false });
    expect(e).toEqual({ id: 'x', ts: 100, source: 'manual', behavior: 'nail_biting', updatedAt: 100, triggers: ['focus'] });
  });
});

// ── The dev preview fixture (src/dev/preview.ts) ────────────────────────────
// A fortnight of v1-shaped history, written straight into the store the way the
// ?preview= screens do. It is the closest thing to real persisted data in the
// repo, so it goes through the migration as well.

describe('the dev preview fixture', () => {
  it('migrates with identical streak and statistics', () => {
    useAppStore.getState().clearAllData();
    seedPreviewData();
    const seeded = useAppStore.getState();
    expect(seeded.incidents.length).toBeGreaterThan(20);

    // Exactly what would have been persisted: the store minus actions and the
    // three keys partialize drops.
    const persisted = JSON.parse(JSON.stringify(seeded)) as State;
    for (const k of ['cameraEnabled', 'showCameraFeed', 'detecting', 'tombstones']) delete persisted[k];

    const v2 = migrateState(persisted, 1) as State;
    expect(incidentsOf(v2)).toHaveLength(seeded.incidents.length);
    expect(incidentsOf(v2).map(i => i.id)).toEqual(seeded.incidents.map(i => i.id));
    expect(incidentsOf(v2).map(i => i.timestamp)).toEqual(seeded.incidents.map(i => i.timestamp));

    const stats = (s: State) => {
      const incidents = incidentsOf(s);
      const bites = incidents.filter(isBite);
      return {
        best: computeBestStreak(incidents, s.historyStartTime as number),
        derived: deriveStreakState({
          incidents,
          historyStartTime: s.historyStartTime as number,
          bestStreakFloorMs: (s.bestStreakFloorMs as number) ?? 0,
        }),
        bites: bites.length,
        alarms: incidents.filter(i => i.autoDetected && !i.confirmed).length,
        topTrigger: topTrigger(bites),
        peakHour: peakHour(bites),
      };
    };
    expect(stats(v2)).toEqual(stats(persisted));
    expect(v2.lastBiteTime).toBe(persisted.lastBiteTime);
    expect(v2.bestStreakMs).toBe(persisted.bestStreakMs);
    useAppStore.getState().clearAllData();
  });
});
