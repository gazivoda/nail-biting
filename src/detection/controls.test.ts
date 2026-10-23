// The false-alarm controls (WS3): the pose numbers, the chin-rest rule, learned poses, the hand
// filter, the handedness mapping and "Not a bite" silencing, on synthetic landmarks.
//
// The shipped detector's decisions are NOT tested here: with no controls registered they are pinned
// frame by frame by equivalence.test.ts and characterization.test.ts, which this work leaves alone.
// What IS tested here is the difference the controls make, in both directions: what they remove or
// delay, and (as important) what they must leave alone.

import { describe, it, expect, afterEach } from 'vitest';
import { createEngine } from './engine.ts';
import { createBiteDetector } from '../hooks/biteDetector';
import { buildHand, facePoint, neutralFace, mulberry32 } from './synthetic.ts';
import { extractPose, parsePoseVector, poseToVector, posesMatch, vectorToPose, type PoseVector } from './pose.ts';
import {
  CONTROLS_CONFIG, DAY_MS, defaultControls, handIsWatched, judgeContact,
  type DetectionControls, type FireInfo, type LearnedSample,
} from './controls.ts';
import { attachSides, detectHandsWithSides, userHandFromLabel } from './handedness.ts';
import { getDetectionControls, recentFire, requestSilence, setDetectionControls } from './controlsRegistry.ts';
import type { Behavior } from '../storage/eventModel.ts';
import type { Landmark } from './types.ts';

afterEach(() => setDetectionControls(null));

const face = neutralFace();
const chin = facePoint('chinAnchor');
const mouth = facePoint('mouth');
const FIST = { index: 0.3, middle: 0.3, ring: 0.3, pinky: 0.3, thumb: 0.3 };

/** The back of a fist resting under the chin: knuckles on the chin, fingers curled along the jaw. */
const chinFist = (angleDeg = 180) => buildHand({ side: 'right', pin: 9, at: [chin[0], chin[1] + 18], angleDeg, ext: FIST });
/** A thumb tip at the lips, other fingers curled, the palm hanging below (chin region, but a fingertip is AT the lips). */
const thumbAtLips = () => buildHand({
  side: 'right', pin: 4, at: [mouth[0] + 6, mouth[1] + 3], angleDeg: -100,
  ext: { index: 0.45, middle: 0.35, ring: 0.3, pinky: 0.3, thumb: 1 },
});
/** An index fingertip at the lips. */
const indexAtLips = () => buildHand({ side: 'right', pin: 8, at: [mouth[0] + 6, mouth[1] + 3], angleDeg: -100, ext: { index: 0.9, middle: 0.3, ring: 0.3, pinky: 0.3, thumb: 0.4 } });
/** The extended fingers lying along the jaw, 0.3 face widths from the lips (the existing neg_chin_rest scene). */
const jawRest = () => buildHand({ side: 'right', pin: 8, at: [mouth[0] + 52, mouth[1] + 14], angleDeg: 190, ext: { index: 1, middle: 0.95, ring: 0.9, pinky: 0.85, thumb: 0.6 } });

const pose = (hand: Landmark[]) => extractPose(hand, face, 640 / 480)!;

describe('pose numbers', () => {
  it('a fingertip at the lips: the fingertip is nearest and about 0.04 face widths away', () => {
    const p = pose(indexAtLips());
    expect(p.part).toBe('fingertip');
    expect(p.tipDist).toBeLessThan(0.08);
  });

  it('a fist under the chin: a knuckle is nearest, it touches the chin, and no fingertip is near the lips', () => {
    const p = pose(chinFist());
    expect(p.part).toBe('knuckle');
    expect(p.chinDist).toBeLessThan(0.1);
    expect(p.tipDist).toBeGreaterThan(CONTROLS_CONFIG.chinRest.tipGuardFw);
    expect(p.curl).toBeGreaterThan(0.5);
  });

  it('is in face widths: the same scene twice as far from the camera gives the same numbers', () => {
    const near = pose(chinFist());
    const faceFar = neutralFace({ width: 85, height: 97.5, cx: 320, cy: 240 });
    const chinFar = facePoint('chinAnchor', { width: 85, height: 97.5, cx: 320, cy: 240 });
    const handFar = buildHand({ side: 'right', pin: 9, at: [chinFar[0], chinFar[1] + 9], angleDeg: 180, size: 0.5, ext: FIST });
    const far = extractPose(handFar, faceFar, 640 / 480)!;
    expect(far.part).toBe(near.part);
    expect(far.tipDist).toBeCloseTo(near.tipDist, 1);
    expect(far.chinDist).toBeCloseTo(near.chinDist, 1);
  });

  it('is corrected for the camera shape: the same landmarks read on a wider picture are further apart sideways', () => {
    const hand = chinFist();
    const four3 = extractPose(hand, face, 4 / 3)!;
    const wide = extractPose(hand, face, 16 / 9)!;
    expect(wide.tipDist).not.toBeCloseTo(four3.tipDist, 3);
  });

  it('gives nothing for a face with no width', () => {
    const flat = face.map(() => ({ x: 0.5, y: 0.5 }));
    expect(extractPose(indexAtLips(), flat)).toBeNull();
  });

  it('keeps only six rounded numbers (nothing that identifies a picture), and round-trips', () => {
    const v = poseToVector(pose(chinFist()));
    expect(v).toHaveLength(6);
    expect(v.every(n => Number.isFinite(n))).toBe(true);
    expect(v.slice(1).every(n => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9)).toBe(true);
    expect(poseToVector(vectorToPose(v))).toEqual(v);
  });

  it('parsePoseVector refuses anything that is not six sane numbers', () => {
    expect(parsePoseVector([0, 0.1, 0.2, 3, 0.5, 0.1])).toEqual([0, 0.1, 0.2, 3, 0.5, 0.1]);
    for (const bad of [null, [], [0, 1], [9, 0.1, 0.2, 3, 0.5, 0.1], [0, 0.1, 0.2, 9, 0.5, 0.1], [0, -1, 0.2, 3, 0.5, 0.1], ['a', 1, 1, 1, 1, 1], [0, NaN, 0.2, 3, 0.5, 0.1], [0, 0.1, 0.2, 3, 0.5, 0.1, 1]]) {
      expect(parsePoseVector(bad as unknown), JSON.stringify(bad)).toBeNull();
    }
  });

  it('two poses match when the same part is nearest and the numbers are close; not otherwise', () => {
    const a = poseToVector(pose(chinFist(180)));
    expect(posesMatch(a, a)).toBe(true);
    expect(posesMatch(a, poseToVector(pose(chinFist(160))))).toBe(true);         // a little different angle
    expect(posesMatch(a, poseToVector(pose(indexAtLips())))).toBe(false);          // a fingertip at the lips is not it
    const turned = [...a] as PoseVector; turned[3] = (a[3] + 4) % 8;               // pointing the other way
    expect(posesMatch(a, turned)).toBe(false);
    const wrap = [...a] as PoseVector; wrap[3] = 0;
    const wrapB = [...a] as PoseVector; wrapB[3] = 7;
    expect(posesMatch(wrap, wrapB)).toBe(true);                                     // 7 and 0 are neighbours
  });
});

describe('judging contact', () => {
  const NOW = 1_800_000_000_000;
  const sampleOf = (hand: Landmark[], at = NOW - 1000): LearnedSample => ({ at, v: poseToVector(pose(hand)) });

  it('the chin-rest rule: knuckles on the chin and no fingertip near the lips is not a bite', () => {
    const verdict = judgeContact(pose(chinFist()), defaultControls(), NOW);
    expect(verdict).toMatchObject({ ok: false, reason: 'chin-rest' });
  });

  it('...but a fingertip at the lips always counts, even with the palm on the chin', () => {
    const p = pose(thumbAtLips());
    expect(p.chinDist).toBeLessThan(CONTROLS_CONFIG.chinRest.chinRegionFw);
    expect(judgeContact(p, defaultControls(), NOW)).toMatchObject({ ok: true, extraFrames: 0 });
  });

  it('...and a hand that is not on the chin is left to the shipped rule', () => {
    expect(judgeContact(pose(jawRest()), defaultControls(), NOW)).toMatchObject({ ok: true, extraFrames: 0 });
  });

  it('the rule can be switched off, and its two distances come from the settings', () => {
    const off = defaultControls({ chinRest: { enabled: false, chinRegionFw: 0.25, tipGuardFw: 0.15 } });
    expect(judgeContact(pose(chinFist()), off, NOW).ok).toBe(true);
    const looser = defaultControls({ chinRest: { enabled: true, chinRegionFw: 0.25, tipGuardFw: 0.3 } });
    expect(judgeContact(pose(chinFist()), looser, NOW).ok).toBe(true); // the fingertips are 0.2 away: inside a 0.3 guard
    const smallRegion = defaultControls({ chinRest: { enabled: true, chinRegionFw: 0.005, tipGuardFw: 0.15 } });
    expect(judgeContact(pose(chinFist()), smallRegion, NOW).ok).toBe(true); // the knuckles are not that close to the chin anchor
  });

  it('a pose the person recorded as a real fingertip-near-lips pose is never suppressed', () => {
    const fistVector = poseToVector(pose(chinFist()));
    const controls = defaultControls({ safe: [fistVector] });
    expect(judgeContact(pose(chinFist()), controls, NOW)).toMatchObject({ ok: true, extraFrames: 0 });
  });

  describe('learned rejections', () => {
    const c = CONTROLS_CONFIG.learned;
    const off = { enabled: false, chinRegionFw: 0.25, tipGuardFw: 0.15 }; // isolate the learned part

    it('nothing learned: no change', () => {
      expect(judgeContact(pose(jawRest()), defaultControls({ chinRest: off }), NOW)).toMatchObject({ ok: true, extraFrames: 0, matches: 0 });
    });

    it('one rejection of a like pose: wait a little longer', () => {
      const controls = defaultControls({ chinRest: off, learned: [sampleOf(jawRest())] });
      expect(judgeContact(pose(jawRest()), controls, NOW)).toMatchObject({ ok: true, extraFrames: c.extraFramesOne, matches: 1 });
    });

    it('two rejections of a like pose, with the fingertip far from the lips: not a bite', () => {
      const controls = defaultControls({ chinRest: off, learned: [sampleOf(jawRest()), sampleOf(jawRest())] });
      expect(judgeContact(pose(jawRest()), controls, NOW)).toMatchObject({ ok: false, reason: 'learned', matches: 2 });
    });

    it('...but with a fingertip right at the lips it waits longer instead of going quiet', () => {
      const p = pose(indexAtLips());
      const like: LearnedSample = { at: NOW, v: poseToVector(p) };
      const controls = defaultControls({ chinRest: off, learned: [like, like, like] });
      expect(judgeContact(p, controls, NOW)).toMatchObject({ ok: true, extraFrames: c.extraFramesStrong });
    });

    it('a different pose is not affected by what was rejected', () => {
      const controls = defaultControls({ chinRest: off, learned: [sampleOf(jawRest()), sampleOf(jawRest()), sampleOf(jawRest())] });
      expect(judgeContact(pose(indexAtLips()), controls, NOW)).toMatchObject({ ok: true, extraFrames: 0, matches: 0 });
    });

    it('rejections are forgotten after their lifetime', () => {
      const old = sampleOf(jawRest(), NOW - (c.ttlDays + 1) * DAY_MS);
      const fresh = sampleOf(jawRest(), NOW - (c.ttlDays - 1) * DAY_MS);
      const controls = defaultControls({ chinRest: off, learned: [old, old, fresh] });
      expect(judgeContact(pose(jawRest()), controls, NOW)).toMatchObject({ ok: true, matches: 1 });
    });

    it('a calibrated real pose beats a rejection of the same pose', () => {
      const p = pose(jawRest());
      const controls = defaultControls({ chinRest: off, learned: [sampleOf(jawRest()), sampleOf(jawRest())], safe: [poseToVector(p)] });
      expect(judgeContact(p, controls, NOW)).toMatchObject({ ok: true, extraFrames: 0 });
    });
  });
});

describe('the hand filter', () => {
  it('watches the named hand, and any hand whose side is not known', () => {
    expect(handIsWatched('both', 'left')).toBe(true);
    expect(handIsWatched('both', 'right')).toBe(true);
    expect(handIsWatched('left', 'left')).toBe(true);
    expect(handIsWatched('left', 'right')).toBe(false);
    expect(handIsWatched('right', 'right')).toBe(true);
    expect(handIsWatched('right', 'left')).toBe(false);
    expect(handIsWatched('left', 'unknown')).toBe(true);
    expect(handIsWatched('right', undefined)).toBe(true);
  });
});

describe('which hand is which (MediaPipe labels a mirrored picture; the app gives it the raw one)', () => {
  it('swaps the label for the raw camera frame: MediaPipe "Left" is the person\'s right hand', () => {
    expect(userHandFromLabel('Left')).toBe('right');
    expect(userHandFromLabel('Right')).toBe('left');
  });
  it('keeps it when the picture really is mirrored', () => {
    expect(userHandFromLabel('Left', true)).toBe('left');
    expect(userHandFromLabel('Right', true)).toBe('right');
  });
  it('anything else is unknown', () => {
    for (const x of [undefined, '', 'left', 'RIGHT', 'Both']) expect(userHandFromLabel(x)).toBe('unknown');
  });
});

describe('the hand source seam', () => {
  const fake = (labels: string[], calls: string[] = []) => ({
    calls,
    detectForVideo: () => { calls.push('detect'); return { landmarks: labels.map(() => indexAtLips()), handedness: labels.map(l => [{ categoryName: l }]) }; },
    setOptions: (o: { numHands: number }) => { calls.push(`numHands:${o.numHands}`); return Promise.resolve(); },
  });

  it('with no controls registered it is the plain landmarks and nothing else (the flag-off path)', () => {
    const model = fake(['Left']);
    const hands = detectHandsWithSides(model, {}, 1);
    expect(hands).toHaveLength(1);
    expect('sides' in hands).toBe(false);
    expect(model.calls).toEqual(['detect']);
  });

  it('with controls it attaches each hand\'s side as the person sees it', () => {
    setDetectionControls(defaultControls());
    const hands = detectHandsWithSides(fake(['Left', 'Right']), {}, 1) as ReturnType<typeof attachSides>;
    expect(hands.sides).toEqual(['right', 'left']);
  });

  it('asks the tracker for two hands while the filter is left or right only, and back to one for both', () => {
    const model = fake(['Left']);
    setDetectionControls(defaultControls({ handFilter: 'left' }));
    detectHandsWithSides(model, {}, 1);
    detectHandsWithSides(model, {}, 2);
    expect(model.calls.filter(c => c.startsWith('numHands'))).toEqual(['numHands:2']); // once, not every frame
    setDetectionControls(defaultControls({ handFilter: 'both' }));
    detectHandsWithSides(model, {}, 3);
    expect(model.calls.filter(c => c.startsWith('numHands'))).toEqual(['numHands:2', 'numHands:1']);
  });

  it('a tracker that refuses the option does not break the frame', () => {
    const model = { ...fake(['Right']), setOptions: () => { throw new Error('nope'); } };
    setDetectionControls(defaultControls({ handFilter: 'right' }));
    expect(() => detectHandsWithSides(model, {}, 1)).not.toThrow();
  });
});

// ── the engine with controls ─────────────────────────────────────────────────

interface Frame { hands: Landmark[][]; sides?: Array<'left' | 'right' | 'unknown'> }
type Ev = { frame: number; kind: 'start'; behavior: Behavior } | { frame: number; kind: 'end' };

function run(frames: Frame[], controls: DetectionControls | null, options: { onFrame?: (i: number) => void; behaviors?: Behavior[] } = {}) {
  const events: Ev[] = [];
  let index = 0;
  let alarming = false;
  let current = frames[0];
  const engine = createEngine({
    getVideo: () => ({ readyState: 4, videoWidth: 640, videoHeight: 480 }),
    getSensitivity: () => 'medium',
    getBehaviors: options.behaviors ? () => options.behaviors! : undefined,
    getControls: () => controls,
    source: {
      detectHands: () => (current.sides ? attachSides(current.hands.map(h => h), current.sides) : current.hands),
      detectFace: () => [face],
    },
    // The same dedupe useDetection does: one alarm until the engine says it is over.
    onBiteStart: behavior => { if (alarming) return; alarming = true; events.push({ frame: index, kind: 'start', behavior }); },
    onBiteEnd: () => { if (!alarming) return; alarming = false; events.push({ frame: index, kind: 'end' }); },
  });
  for (index = 0; index < frames.length; index++) {
    current = frames[index];
    options.onFrame?.(index);
    engine.step(1000 + index * 200);
  }
  return events;
}
const hold = (hand: Landmark[], n: number, sides?: Frame['sides']): Frame[] => Array.from({ length: n }, () => ({ hands: [hand], sides }));
const away: Frame = { hands: [] };
const startsAt = (events: Ev[]) => events.filter(e => e.kind === 'start').map(e => e.frame);

describe('the engine with the controls on', () => {
  it('controls that change nothing make the same decisions as no controls, frame by frame (random scenes)', () => {
    const rnd = mulberry32(77);
    const neutral = defaultControls({ chinRest: { enabled: false, chinRegionFw: 0.25, tipGuardFw: 0.15 } });
    let alarms = 0;
    for (let trial = 0; trial < 40; trial++) {
      const frames: Frame[] = [];
      for (let i = 0; i < 120; i++) {
        if (rnd() < 0.25) { frames.push(away); continue; }
        const near = rnd() < 0.6;
        const at: [number, number] = near ? [mouth[0] + (rnd() - 0.5) * 130, mouth[1] + (rnd() - 0.5) * 110] : [100 + rnd() * 440, 330 + rnd() * 130];
        frames.push({ hands: [buildHand({ side: 'right', pin: [4, 8, 12, 20][Math.floor(rnd() * 4)], at, angleDeg: -150 + rnd() * 300, ext: { index: 0.3 + rnd() * 0.7, middle: 0.3, ring: 0.3, pinky: 0.3, thumb: 0.4 } })] });
      }
      const withControls = run(frames, neutral);
      expect(withControls, `trial ${trial}`).toEqual(run(frames, null));
      alarms += startsAt(withControls).length;
    }
    expect(alarms, 'the scenes must actually contain alarms, or this proves nothing').toBeGreaterThan(30);
  });

  it('a fist resting under the chin fires without the controls and is quiet with them', () => {
    const frames = [away, ...hold(chinFist(), 20), away, away];
    expect(startsAt(run(frames, null)).length).toBeGreaterThan(0);
    expect(startsAt(run(frames, defaultControls()))).toEqual([]);
  });

  it('a bite with the palm near the chin still fires, on the same frame as without the controls', () => {
    const frames = [away, ...hold(thumbAtLips(), 8), away, away];
    const without = startsAt(run(frames, null));
    expect(without.length).toBeGreaterThan(0);
    expect(startsAt(run(frames, defaultControls()))).toEqual(without);
  });

  it('the fingers-along-the-jaw scene (fingertips 0.3 face widths from the lips) is NOT changed by the chin-rest rule: the palm is nowhere near the chin', () => {
    const frames = [away, ...hold(jawRest(), 12), away, away];
    expect(startsAt(run(frames, defaultControls()))).toEqual(startsAt(run(frames, null)));
  });

  it('an alarm that is vetoed mid-hold ends like a hand that went away (two misses), and a later bite fires normally', () => {
    const frames = [away, ...hold(indexAtLips(), 6), ...hold(chinFist(), 6), away, away, ...hold(indexAtLips(), 6), away, away];
    const events = run(frames, defaultControls());
    expect(startsAt(events)).toHaveLength(2);
    expect(events.filter(e => e.kind === 'end').length).toBeGreaterThanOrEqual(2);
  });

  describe('hand filter', () => {
    it('left only ignores a right hand at the mouth; right only ignores the left; both watches both', () => {
      const frames = [away, ...hold(indexAtLips(), 6, ['right']), away, away];
      expect(startsAt(run(frames, defaultControls({ handFilter: 'left' })))).toEqual([]);
      expect(startsAt(run(frames, defaultControls({ handFilter: 'right' }))).length).toBeGreaterThan(0);
      expect(startsAt(run(frames, defaultControls({ handFilter: 'both' }))).length).toBeGreaterThan(0);
      const leftFrames = [away, ...hold(indexAtLips(), 6, ['left']), away, away];
      expect(startsAt(run(leftFrames, defaultControls({ handFilter: 'left' }))).length).toBeGreaterThan(0);
      expect(startsAt(run(leftFrames, defaultControls({ handFilter: 'right' })))).toEqual([]);
    });

    it('with two hands, the filtered one is ignored and the other still counts', () => {
      const resting = chinFist();
      const biting = indexAtLips();
      const frames: Frame[] = [{ hands: [] }, ...Array.from({ length: 8 }, () => ({ hands: [resting, biting], sides: ['left', 'right'] as Frame['sides'] })), away, away];
      expect(startsAt(run(frames, defaultControls({ handFilter: 'right', chinRest: { enabled: false, chinRegionFw: 0.25, tipGuardFw: 0.15 } }))).length).toBeGreaterThan(0);
      const onlyLeft = [{ hands: [] }, ...Array.from({ length: 8 }, () => ({ hands: [resting, biting], sides: ['left', 'right'] as Frame['sides'] })), away, away];
      // Left only: the biting right hand is out, the resting left fist is watched (and, with the chin-rest rule on, quiet).
      expect(startsAt(run(onlyLeft, defaultControls({ handFilter: 'left' })))).toEqual([]);
    });

    it('a hand whose side is not known is still watched (not knowing never switches the alarm off)', () => {
      const frames = [away, ...hold(indexAtLips(), 6), away, away]; // no sides at all
      expect(startsAt(run(frames, defaultControls({ handFilter: 'left' }))).length).toBeGreaterThan(0);
      const unknown = [away, ...hold(indexAtLips(), 6, ['unknown']), away, away];
      expect(startsAt(run(unknown, defaultControls({ handFilter: 'right' }))).length).toBeGreaterThan(0);
    });

    it('applies to every behaviour, not just the mouth', () => {
      const nose = buildHand({ side: 'right', pin: 8, at: facePoint('noseBase'), angleDeg: -95, ext: { index: 1, middle: 0.3, ring: 0.3, pinky: 0.3, thumb: 0.4 } });
      const frames = [away, ...hold(nose, 14, ['right']), away, away];
      const nosePick: Behavior[] = ['nose_picking'];
      expect(startsAt(run(frames, defaultControls({ handFilter: 'right' }), { behaviors: nosePick })).length).toBeGreaterThan(0);
      expect(startsAt(run(frames, defaultControls({ handFilter: 'left' }), { behaviors: nosePick }))).toEqual([]);
    });
  });

  describe('learned rejections in the engine', () => {
    const off = { enabled: false, chinRegionFw: 0.25, tipGuardFw: 0.15 };
    const sample = (hand: Landmark[]): LearnedSample => ({ at: Date.now(), v: poseToVector(pose(hand)) });

    it('one like rejection: the alarm comes two frames later (0.4 s)', () => {
      const frames = [away, ...hold(jawRest(), 12), away, away];
      const base = startsAt(run(frames, defaultControls({ chinRest: off })))[0];
      const after = startsAt(run(frames, defaultControls({ chinRest: off, learned: [sample(jawRest())] })))[0];
      expect(after - base).toBe(CONTROLS_CONFIG.learned.extraFramesOne);
    });

    it('two like rejections: this pose no longer sounds an alarm', () => {
      const frames = [away, ...hold(jawRest(), 40), away, away];
      expect(startsAt(run(frames, defaultControls({ chinRest: off, learned: [sample(jawRest()), sample(jawRest())] })))).toEqual([]);
    });

    it('...while a real bite right afterwards is on time', () => {
      const learned = [sample(jawRest()), sample(jawRest())];
      const frames = [away, ...hold(jawRest(), 10), away, away, ...hold(indexAtLips(), 6), away, away];
      const starts = startsAt(run(frames, defaultControls({ chinRest: off, learned })));
      expect(starts).toHaveLength(1);
      expect(starts[0]).toBe(1 + 10 + 2 + 3 - 1 + 0); // 3 frames after the bite begins
    });
  });

  describe('"Not a bite" silences the alarm that is sounding', () => {
    it('the alarm ends within two frames and does not come back while the hand stays', () => {
      const controls = defaultControls({ chinRest: { enabled: false, chinRegionFw: 0.25, tipGuardFw: 0.15 } });
      setDetectionControls(controls);
      const frames = [away, ...hold(jawRest(), 30), away, away];
      const events = run(frames, controls, { onFrame: i => { if (i === 8) requestSilence(); } });
      expect(startsAt(events)).toHaveLength(1);
      const end = events.find(e => e.kind === 'end');
      expect(end).toBeDefined();
      expect(end!.frame).toBeLessThanOrEqual(8 + 2);
      expect(startsAt(events)).toEqual([startsAt(events)[0]]); // never again for this hold
    });

    it('after the hand has gone and come back, the alarm works again', () => {
      const controls = defaultControls({ chinRest: { enabled: false, chinRegionFw: 0.25, tipGuardFw: 0.15 } });
      setDetectionControls(controls);
      const frames = [away, ...hold(jawRest(), 10), away, away, away, ...hold(jawRest(), 10), away, away];
      const events = run(frames, controls, { onFrame: i => { if (i === 8) requestSilence(); } });
      expect(startsAt(events)).toHaveLength(2);
    });

    it('a request when no alarm is sounding is dropped: it cannot swallow a later alarm', () => {
      const controls = defaultControls();
      setDetectionControls(controls);
      requestSilence(); // nothing is sounding
      const frames = [away, away, ...hold(indexAtLips(), 8), away, away];
      expect(startsAt(run(frames, controls)).length).toBeGreaterThan(0);
    });

    it('is not even queued without registered controls (the flag off)', () => {
      requestSilence();
      const frames = [away, ...hold(indexAtLips(), 8), away, away];
      setDetectionControls(defaultControls());
      expect(startsAt(run(frames, getDetectionControls())).length).toBeGreaterThan(0);
    });
  });

  describe('telling the app about the alarm', () => {
    it('onFire is called once, on the frame the alarm starts, with the hand and the pose', () => {
      const fires: FireInfo[] = [];
      const controls = defaultControls({ onFire: f => fires.push(f), now: () => 5000 });
      const events = run([away, ...hold(indexAtLips(), 10, ['left']), away, away], controls);
      expect(fires).toHaveLength(1);
      expect(fires[0]).toMatchObject({ behavior: 'nail_biting', hand: 'left', at: 5000 });
      expect(fires[0].pose?.part).toBe('fingertip');
      expect(startsAt(events)).toHaveLength(1);
    });

    it('the engine also leaves the latest alarm start where the app can find it', () => {
      const controls = defaultControls({ now: () => Date.now() });
      run([away, ...hold(indexAtLips(), 6, ['right']), away, away], controls);
      expect(recentFire(Date.now())).toMatchObject({ hand: 'right', behavior: 'nail_biting' });
    });

    it('a throwing onFire cannot stop or delay the alarm', () => {
      const throwing = defaultControls({ onFire: () => { throw new Error('app bug'); } });
      const frames = [away, ...hold(indexAtLips(), 8), away, away];
      expect(startsAt(run(frames, throwing))).toEqual(startsAt(run(frames, null)));
    });

    it('createBiteDetector reads the registered controls by default, and nothing when none is registered', () => {
      const events: string[] = [];
      let current: Landmark[][] = [];
      const detector = createBiteDetector({
        getVideo: () => ({ readyState: 4 }),
        getSensitivity: () => 'medium',
        source: { detectHands: () => current, detectFace: () => [face] },
        onBiteStart: () => events.push('start'),
        onBiteEnd: () => events.push('end'),
      });
      const feed = (hand: Landmark[], n: number) => { for (let i = 0; i < n; i++) { current = [hand]; detector.step(i); } };
      feed(chinFist(), 6);
      expect(events).toContain('start');            // no controls registered: the shipped decision
      current = [];
      for (let i = 0; i < 3; i++) detector.step(100 + i); // the hand goes away, the alarm ends
      events.length = 0;
      setDetectionControls(defaultControls());
      feed(chinFist(), 8);
      expect(events).not.toContain('start');        // registered: the chin-rest rule applies
    });
  });

  it('a pose that cannot be worked out falls back to the shipped decision (never silently quiet)', () => {
    const degenerate = face.map(p => ({ ...p }));
    degenerate[234] = { ...degenerate[454] }; // zero face width
    const events: number[] = [];
    let i = 0;
    const engine = createEngine({
      getVideo: () => ({ readyState: 4 }), getSensitivity: () => 'medium', getControls: () => defaultControls(),
      source: { detectHands: () => [chinFist()], detectFace: () => [degenerate] },
      onBiteStart: () => events.push(i), onBiteEnd: () => {},
    });
    for (i = 0; i < 8; i++) engine.step(i * 200);
    expect(events.length).toBeGreaterThan(0);
  });
});
