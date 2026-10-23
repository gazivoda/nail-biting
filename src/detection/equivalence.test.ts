// The refactored nail-biting detector against the verbatim reference copy of the
// detector that shipped before WS1 (./__reference__/legacyBiteDetector.ts).
//
// Both are fed the SAME randomized frame sequences (seeded, so a failure
// reproduces) and must make identical decisions on every frame: the same
// onBiteStart / onBiteEnd calls at the same frame indices. The sequences are
// built to stress the places where a refactor could differ: fingertips sitting
// within a hair of each threshold, hands that come and go, a face that drops
// out, two hands, two faces, malformed landmark arrays, a video that stops, a
// source that throws, and sensitivity changing mid-run.
//
// A second comparison replays the same calls through the dedupe useDetection
// does (startBiting / stopBiting guarded by one boolean) and compares what the
// USER would see: when the alarm starts and stops.

import { describe, it, expect } from 'vitest';
import {
  createBiteDetector,
  isFingertipNearMouth,
  FINGERTIP_INDICES,
  THRESHOLDS,
  type Landmark,
  type LandmarkSource,
  type VideoLike,
} from '../hooks/biteDetector';
import { createBiteDetector as createLegacyDetector, isFingertipNearMouth as legacyNear } from './__reference__/legacyBiteDetector';
import type { DetectionSensitivity } from '../types';

// ── seeded randomness ───────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── frame generator ─────────────────────────────────────────────────────────

interface Frame {
  hands: Landmark[][];
  faces: Landmark[][];
  readyState: number;
  noVideo: boolean;
  throws: boolean;
  sensitivity: DetectionSensitivity;
}

const SENSITIVITIES: DetectionSensitivity[] = ['low', 'medium', 'high'];
const THRESHOLD_VALUES = [THRESHOLDS.low, THRESHOLDS.medium, THRESHOLDS.high];

function makeFace(rnd: () => number, mouth: Landmark): Landmark[] {
  const pts: Landmark[] = Array.from({ length: 478 }, () => ({ x: rnd(), y: rnd() }));
  // Lips a little apart so "the midpoint" is not the same as either lip point.
  const gap = rnd() * 0.04;
  pts[13] = { x: mouth.x, y: mouth.y - gap / 2 };
  pts[14] = { x: mouth.x, y: mouth.y + gap / 2 };
  return pts;
}

/** Fingertip distance: mostly uniform, but often within a hair of one of the three thresholds. */
function sampleDistance(rnd: () => number): number {
  const r = rnd();
  if (r < 0.45) return rnd() * 0.3;
  const t = THRESHOLD_VALUES[Math.floor(rnd() * 3)];
  return t + (rnd() - 0.5) * 0.004; // within +-0.002 of a threshold
}

function makeHand(rnd: () => number, mouth: Landmark, base: number): Landmark[] {
  const hand: Landmark[] = Array.from({ length: 21 }, () => ({ x: rnd(), y: rnd() }));
  for (const idx of FINGERTIP_INDICES) {
    // Each fingertip wanders around the hand's base distance, in a random direction.
    const d = Math.max(0, base + (rnd() - 0.5) * 0.06);
    const a = rnd() * Math.PI * 2;
    hand[idx] = { x: mouth.x + Math.cos(a) * d, y: mouth.y + Math.sin(a) * d };
  }
  // Non-fingertips sometimes sit right on the mouth, which must never count.
  if (rnd() < 0.2) hand[0] = { ...mouth };
  if (rnd() < 0.2) hand[9] = { ...mouth };
  return hand;
}

function generateFrames(seed: number, count: number): Frame[] {
  const rnd = mulberry32(seed);
  const frames: Frame[] = [];
  let near = false;                 // a two-state chain gives long runs of hits and of misses
  let sens: DetectionSensitivity = SENSITIVITIES[Math.floor(rnd() * 3)];
  let baseDistance = sampleDistance(rnd);

  for (let i = 0; i < count; i++) {
    if (rnd() < (near ? 0.15 : 0.12)) { near = !near; baseDistance = sampleDistance(rnd); }
    if (rnd() < 0.03) sens = SENSITIVITIES[Math.floor(rnd() * 3)];

    const mouth = { x: 0.3 + rnd() * 0.4, y: 0.3 + rnd() * 0.4 };
    const nHands = rnd() < 0.18 ? 0 : rnd() < 0.8 ? 1 : 2;
    const hands: Landmark[][] = [];
    for (let h = 0; h < nHands; h++) {
      const dist = near ? baseDistance : 0.25 + rnd() * 0.3;
      let hand = makeHand(rnd, mouth, h === 0 ? dist : 0.2 + rnd() * 0.3);
      if (rnd() < 0.015) hand = hand.slice(0, 5 + Math.floor(rnd() * 15)); // malformed: fewer than 21 points
      hands.push(hand);
    }

    let faces: Landmark[][] = [];
    const faceRoll = rnd();
    if (faceRoll > 0.06) faces = [makeFace(rnd, mouth)];
    if (faceRoll > 0.97) faces.push(makeFace(rnd, { x: rnd(), y: rnd() })); // a second face, ignored
    if (rnd() < 0.004 && faces.length > 0) faces = [faces[0].slice(0, 10)];  // malformed face

    frames.push({
      hands,
      faces,
      readyState: rnd() < 0.04 ? Math.floor(rnd() * 2) : 4,
      noVideo: rnd() < 0.01,
      throws: rnd() < 0.01,
      sensitivity: sens,
    });
  }
  return frames;
}

// ── running a detector over frames ──────────────────────────────────────────

type Create = typeof createBiteDetector;

interface Outcome {
  /** One entry per frame: '' when nothing was called, otherwise the calls in order, e.g. 'S', 'E'. */
  calls: string[];
  /** Frame indices at which the user-visible alarm starts and stops (useDetection's dedupe). */
  alarmStarts: number[];
  alarmStops: number[];
  /** Every timestamp the landmark source was asked about, in order. */
  asked: Array<[string, number]>;
}

function run(create: Create, frames: Frame[], tamper?: (f: Frame) => Frame): Outcome {
  let current: Frame = frames[0];
  let frameCalls = '';
  const video: VideoLike = { readyState: 4 };
  const asked: Array<[string, number]> = [];

  const source: LandmarkSource = {
    detectHands: (_v, ts) => {
      asked.push(['hands', ts]);
      if (current.throws) throw new Error('inference exploded');
      return current.hands;
    },
    detectFace: (_v, ts) => { asked.push(['face', ts]); return current.faces; },
  };

  let isBiting = false;
  const alarmStarts: number[] = [];
  const alarmStops: number[] = [];
  let index = 0;

  const detector = create({
    getVideo: () => {
      if (current.noVideo) return null;
      video.readyState = current.readyState;
      return video;
    },
    getSensitivity: () => current.sensitivity,
    source,
    onBiteStart: () => {
      frameCalls += 'S';
      if (!isBiting) { isBiting = true; alarmStarts.push(index); }
    },
    onBiteEnd: () => {
      frameCalls += 'E';
      if (isBiting) { isBiting = false; alarmStops.push(index); }
    },
  });

  const calls: string[] = [];
  for (index = 0; index < frames.length; index++) {
    current = tamper ? tamper(frames[index]) : frames[index];
    frameCalls = '';
    detector.step(1000 + index * 200 + (index % 7) * 3); // slightly uneven clock, like a real one
    calls.push(frameCalls);
  }
  return { calls, alarmStarts, alarmStops, asked };
}

const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i * 7919);
const FRAMES_PER_SEED = 3000;

describe('refactored detector vs the verbatim pre-WS1 reference', () => {
  it('makes identical decisions on every frame of 120,000 randomized frames', { timeout: 60_000 }, () => {
    let totalFrames = 0;
    let starts = 0;
    let ends = 0;
    for (const seed of SEEDS) {
      const frames = generateFrames(seed, FRAMES_PER_SEED);
      const before = run(createLegacyDetector, frames);
      const after = run(createBiteDetector, frames);

      // Frame by frame, so a failure names the first frame that differs.
      const firstDiff = before.calls.findIndex((c, i) => c !== after.calls[i]);
      expect(firstDiff, `seed ${seed}: first differing frame`).toBe(-1);
      expect(after.alarmStarts, `seed ${seed}: alarm starts`).toEqual(before.alarmStarts);
      expect(after.alarmStops, `seed ${seed}: alarm stops`).toEqual(before.alarmStops);
      expect(after.asked, `seed ${seed}: timestamps handed to the source`).toEqual(before.asked);

      totalFrames += frames.length;
      for (const c of before.calls) { starts += (c.match(/S/g) ?? []).length; ends += (c.match(/E/g) ?? []).length; }
    }
    expect(totalFrames).toBe(120_000);
    // The corpus must actually exercise both outcomes, or "identical" proves little.
    expect(starts).toBeGreaterThan(2000);
    expect(ends).toBeGreaterThan(2000);
  });

  it('agrees on the pure fingertip check, including when it throws', () => {
    const rnd = mulberry32(42);
    let hits = 0;
    let throwsSeen = 0;
    for (let i = 0; i < 20_000; i++) {
      const mouth = { x: rnd(), y: rnd() };
      const hands: Landmark[][] = [];
      const n = Math.floor(rnd() * 3);
      for (let h = 0; h < n; h++) {
        let hand = makeHand(rnd, mouth, sampleDistance(rnd));
        if (rnd() < 0.03) hand = hand.slice(0, 5 + Math.floor(rnd() * 15));
        hands.push(hand);
      }
      const faces = rnd() < 0.1 ? [] : [makeFace(rnd, mouth)];
      const threshold = THRESHOLD_VALUES[Math.floor(rnd() * 3)];

      const outcome = (fn: typeof isFingertipNearMouth): boolean | 'throws' => {
        try { return fn(hands, faces, threshold); } catch { return 'throws'; }
      };
      const a = outcome(legacyNear);
      const b = outcome(isFingertipNearMouth);
      expect(b, `case ${i}`).toBe(a);
      if (a === true) hits++;
      if (a === 'throws') throwsSeen++;
    }
    expect(hits).toBeGreaterThan(500);
    expect(throwsSeen).toBeGreaterThan(5);
  });

  // The comparison above is only worth something if it can fail. These two
  // "mutants" change the detector slightly; the same comparison must catch them.
  describe('the comparison itself is sensitive (mutants must be caught)', () => {
    it('catches landmarks shifted 3 percent toward the image centre', () => {
      let caught = false;
      for (const seed of SEEDS.slice(0, 10)) {
        const frames = generateFrames(seed, FRAMES_PER_SEED);
        const reference = run(createLegacyDetector, frames);
        const mutant = run(createBiteDetector, frames, f => ({
          ...f,
          hands: f.hands.map(h => h.map(p => ({ x: (p.x - 0.5) * 0.97 + 0.5, y: (p.y - 0.5) * 0.97 + 0.5 }))),
        }));
        if (reference.calls.some((c, i) => c !== mutant.calls[i])) { caught = true; break; }
      }
      expect(caught).toBe(true);
    });

    it('catches a dwell that is one frame longer', () => {
      const frames = generateFrames(SEEDS[0], FRAMES_PER_SEED);
      const reference = run(createLegacyDetector, frames);
      const slow: Create = options => {
        let streak = 0;
        const inner = createBiteDetector({
          ...options,
          onBiteStart: () => { if (++streak >= 2) options.onBiteStart(); }, // swallow the first start of each run
          onBiteEnd: () => { streak = 0; options.onBiteEnd(); },
        });
        return inner;
      };
      const mutant = run(slow, frames);
      expect(reference.calls.some((c, i) => c !== mutant.calls[i])).toBe(true);
    });
  });
});
