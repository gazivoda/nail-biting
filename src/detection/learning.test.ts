// What is remembered from "Not a bite" taps, and the calibration profile (WS3): bounded, expiring,
// forgettable, and only ever six numbers per pose.

import { describe, it, expect } from 'vitest';
import {
  ALARM_POSE_LIMITS, addSample, parseAlarmPoses, parseSamples, poseForAlarm, pruneSamples, pushAlarmPose,
  reconcileSamples, removeSampleForEvent, type AlarmPose,
} from './learning.ts';
import { CALIBRATION, controlsFromProfile, deriveProfile, distinctPoses, parseProfile } from './calibration.ts';
import { CONTROLS_CONFIG, DAY_MS, defaultControls, judgeContact, type LearnedSample } from './controls.ts';
import type { PoseFeatures, PoseVector } from './pose.ts';

const NOW = 1_800_000_000_000;
const v = (part = 2, tip = 0.2, chin = 0.05, orient = 6, curl = 0.6, below = 0.3): PoseVector => [part, tip, chin, orient, curl, below];
const sample = (at: number, eventId?: string, vector: PoseVector = v()): LearnedSample => ({ at, v: vector, ...(eventId ? { eventId } : {}) });

describe('learned samples are bounded', () => {
  it('keeps the newest 40 and drops the rest', () => {
    let list: LearnedSample[] = [];
    for (let i = 0; i < 55; i++) list = addSample(list, sample(NOW - (55 - i) * 1000, `e${i}`), NOW);
    expect(list).toHaveLength(CONTROLS_CONFIG.learned.maxSamples);
    expect(list[0].eventId).toBe('e54');                 // newest first
    expect(list.some(s => s.eventId === 'e0')).toBe(false); // the oldest went
  });

  it('forgets a sample after its lifetime', () => {
    const old = sample(NOW - (CONTROLS_CONFIG.learned.ttlDays + 1) * DAY_MS, 'old');
    const fresh = sample(NOW - 1000, 'fresh');
    expect(pruneSamples([old, fresh], NOW).map(s => s.eventId)).toEqual(['fresh']);
  });

  it('a second tap about the same entry replaces the first instead of counting twice', () => {
    const list = addSample(addSample([], sample(NOW - 5000, 'a'), NOW), sample(NOW - 1000, 'a'), NOW);
    expect(list).toHaveLength(1);
    expect(list[0].at).toBe(NOW - 1000);
  });

  it('ignores a sample stamped far in the future (a wrong clock must not pin it for ever)', () => {
    expect(pruneSamples([sample(NOW + 400 * DAY_MS)], NOW)).toEqual([]);
  });

  it('forgets the pose of an entry when asked, and keeps the others', () => {
    const list = [sample(NOW, 'a'), sample(NOW, 'b'), sample(NOW)];
    expect(removeSampleForEvent(list, 'a').map(s => s.eventId)).toEqual(['b', undefined]);
  });

  it('reconcile keeps a sample only while its entry is still marked Not a bite (undo, delete, "was a bite", sync)', () => {
    const list = [sample(NOW, 'still'), sample(NOW, 'undone'), sample(NOW, undefined)];
    expect(reconcileSamples(list, id => id === 'still').map(s => s.eventId)).toEqual(['still', undefined]);
  });
});

describe('reading what was stored', () => {
  it('parseSamples keeps only well-formed samples and never throws', () => {
    const raw = [
      { at: NOW, v: v(), eventId: 'ok' },
      { at: 'x', v: v() },
      { at: NOW, v: [1, 2, 3] },
      { at: NOW, v: [9, 0.1, 0.1, 1, 0.5, 0] },
      null, 'text', 7,
      { at: NOW, v: v(), eventId: 5, extra: { landmarks: [[0, 0]] } },
    ];
    const out = parseSamples(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ at: NOW, v: v(), eventId: 'ok' });
    expect(out[1]).toEqual({ at: NOW, v: v() });        // the bad eventId and the extra field are dropped
    expect(parseSamples('nope')).toEqual([]);
    expect(parseSamples(undefined)).toEqual([]);
  });

  it('only the six numbers survive: a sample cannot carry landmarks or anything else', () => {
    const [s] = parseSamples([{ at: NOW, v: v(), landmarks: [[0.1, 0.2]], image: 'data:...', hand: Array(21).fill([0, 0]) }]);
    expect(Object.keys(s).sort()).toEqual(['at', 'v']);
    expect(s.v).toHaveLength(6);
  });

  it('parseAlarmPoses is just as strict', () => {
    expect(parseAlarmPoses([{ at: NOW, v: v() }, { at: NOW }, 1])).toEqual([{ at: NOW, v: v() }]);
  });
});

describe('alarm poses (kept briefly so a later "Not a bite" can learn)', () => {
  it('keeps the newest 30 and drops week-old ones', () => {
    let ring: AlarmPose[] = [];
    for (let i = 0; i < 40; i++) ring = pushAlarmPose(ring, { at: NOW - (40 - i) * 1000, v: v() }, NOW);
    expect(ring).toHaveLength(ALARM_POSE_LIMITS.max);
    const later = NOW + (ALARM_POSE_LIMITS.ttlDays + 1) * DAY_MS;
    ring = pushAlarmPose(ring, { at: later, v: v() }, later);
    expect(ring).toHaveLength(1); // everything from a week ago is gone, the new one stays
  });

  it('finds the pose of the alarm that started nearest the entry, within a few seconds', () => {
    const ring: AlarmPose[] = [{ at: NOW, v: v(1) }, { at: NOW + 2000, v: v(3) }, { at: NOW - 60_000, v: v(0) }];
    expect(poseForAlarm(ring, NOW + 1600)?.[0]).toBe(3);
    expect(poseForAlarm(ring, NOW + 300)?.[0]).toBe(1);
    expect(poseForAlarm(ring, NOW + 30_000)).toBeNull();
    expect(poseForAlarm([], NOW)).toBeNull();
  });
});

// ── calibration ──────────────────────────────────────────────────────────────

const pose = (over: Partial<PoseFeatures>): PoseFeatures => ({ part: 'knuckle', tipDist: 0.25, chinDist: 0.06, orient: 6, curl: 0.65, below: 0.3, ...over });
const many = (n: number, make: (i: number) => PoseFeatures) => Array.from({ length: n }, (_, i) => make(i));

describe('calibration', () => {
  const rest = many(40, i => pose({ tipDist: 0.22 + (i % 5) * 0.01, chinDist: 0.04 + (i % 4) * 0.02 }));
  const real = many(40, i => pose({ part: 'fingertip', tipDist: 0.03 + (i % 5) * 0.01, chinDist: 0.3, orient: 0, curl: 0.55, below: 0.55 }));

  it('needs both steps to have produced enough frames, and says which one did not', () => {
    expect(deriveProfile(rest.slice(0, 3), real, NOW)).toEqual({ ok: false, reason: 'no-rest' });
    expect(deriveProfile(rest, real.slice(0, 3), NOW)).toEqual({ ok: false, reason: 'no-real' });
    expect(deriveProfile([], [], NOW)).toEqual({ ok: false, reason: 'no-either' });
    expect(deriveProfile(rest.slice(0, CALIBRATION.minFrames), real.slice(0, CALIBRATION.minFrames), NOW).ok).toBe(true);
  });

  it('tunes the chin region to this person\'s resting hand, and the fingertip guard to their real one', () => {
    const result = deriveProfile(rest, real, NOW);
    if (!result.ok) throw new Error('expected a profile');
    const p = result.profile;
    expect(p.chinRegionFw).toBeGreaterThan(0.1);                    // a little beyond where the resting hand sat (<= 0.10)
    expect(p.chinRegionFw).toBeLessThanOrEqual(0.4);
    expect(p.tipGuardFw).toBeGreaterThanOrEqual(0.08);
    expect(p.tipGuardFw).toBeLessThanOrEqual(0.25);
    expect(p.tipGuardFw).toBeGreaterThan(0.07);                      // above where the real fingertip sat (<= 0.07)
    expect(p.tipGuardFw).toBeLessThan(0.22 * 0.9 + 1e-9);            // and below where the resting fingertips sat
    expect(p.restFrames).toBe(40);
    expect(p.realFrames).toBe(40);
  });

  it('a person whose resting fingertips sit close to the lips gets a tighter guard (it never reaches the resting fingertips)', () => {
    const closeRest = many(30, () => pose({ tipDist: 0.12, chinDist: 0.05 }));
    const result = deriveProfile(closeRest, real, NOW);
    if (!result.ok) throw new Error('expected a profile');
    expect(result.profile.tipGuardFw).toBeLessThan(0.12);
    expect(result.profile.tipGuardFw).toBeGreaterThanOrEqual(CONTROLS_CONFIG.chinRest.tipGuardRange[0]);
  });

  it('keeps only a few distinct poses (not every frame), and only numbers', () => {
    const result = deriveProfile(rest, real, NOW);
    if (!result.ok) throw new Error('expected a profile');
    expect(result.profile.rest.length).toBeGreaterThan(0);
    expect(result.profile.rest.length).toBeLessThanOrEqual(CALIBRATION.maxKept);
    expect(result.profile.real.length).toBeLessThanOrEqual(CALIBRATION.maxKept);
    for (const vec of [...result.profile.rest, ...result.profile.real]) expect(vec).toHaveLength(6);
    expect(distinctPoses(many(30, () => pose({})))).toHaveLength(1);
  });

  it('round-trips through storage and rejects a damaged profile', () => {
    const result = deriveProfile(rest, real, NOW);
    if (!result.ok) throw new Error('expected a profile');
    expect(parseProfile(JSON.parse(JSON.stringify(result.profile)))).toEqual(result.profile);
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile({ at: 1 })).toBeNull();
    expect(parseProfile({ ...result.profile, rest: [[1, 2]] })).toBeNull();
    expect(parseProfile({ ...result.profile, chinRegionFw: 99 })?.chinRegionFw).toBe(CONTROLS_CONFIG.chinRest.chinRegionRange[1]); // clamped, not trusted
  });

  describe('what it changes in the controls', () => {
    const profileOf = () => {
      const result = deriveProfile(rest, real, NOW);
      if (!result.ok) throw new Error('expected a profile');
      return result.profile;
    };

    it('without a profile: the defaults', () => {
      expect(controlsFromProfile(null, true)).toEqual({ chinRest: { enabled: true, chinRegionFw: 0.25, tipGuardFw: 0.15 }, rest: [], safe: [] });
    });

    it('a calibrated resting pose is treated as rejected twice: a fingertip right at the lips is needed', () => {
      const profile = profileOf();
      const controls = defaultControls({ ...controlsFromProfile(profile, false) }); // chin-rest rule off to isolate the rest poses
      const resting = pose({ tipDist: 0.25, chinDist: 0.06 });
      expect(judgeContact(resting, controls, NOW)).toMatchObject({ ok: false, reason: 'learned' });
    });

    it('a calibrated real pose is never suppressed, even where the chin-rest rule would have said no', () => {
      const profile = profileOf();
      const controls = defaultControls({ ...controlsFromProfile(profile, true) });
      const bite = pose({ part: 'fingertip', tipDist: 0.04, chinDist: 0.05, orient: 0, curl: 0.55, below: 0.55 });
      expect(judgeContact(bite, controls, NOW)).toMatchObject({ ok: true, extraFrames: 0 });
    });

    it('the person\'s own region and guard replace the defaults', () => {
      const profile = profileOf();
      const c = controlsFromProfile(profile, true);
      expect(c.chinRest).toEqual({ enabled: true, chinRegionFw: profile.chinRegionFw, tipGuardFw: profile.tipGuardFw });
    });
  });
});
