// The false-alarm controls (WS3): what the detector does DIFFERENTLY when the
// `false_positive_controls` flag is on. Everything here is pure; the engine calls it, the app
// (src/falsePositive) fills it in from what the person chose and taught, and the evaluation harness
// fills it in from fixtures.
//
// WITH THE FLAG OFF NONE OF THIS RUNS. The engine only looks at a controls object when one is
// registered (controlsRegistry.ts) and nothing registers one until the flag is on, so the shipped
// detector's decisions are untouched (src/detection/equivalence.test.ts still proves that frame by
// frame against the pre-WS1 code).
//
// Three controls, each explainable in one sentence:
//
//  1. HAND FILTER   Watch both hands, only the left, or only the right (as the person sees it).
//  2. CHIN-REST     If the back of the hand or the palm is resting on the chin and no fingertip is
//                   within `tipGuardFw` of the lips, it is a chin rest, not a bite: do not fire.
//  3. LEARNED       Each time the person says "Not a bite", the pose at that moment is remembered
//                   (six numbers, on this device only). When the hand is in a pose like ones they
//                   rejected, the alarm waits a little longer, and after enough rejections of that
//                   pose it wants a fingertip right at the lips before it fires.
//
// And one thing that cannot be turned off by anything above: a pose the person recorded as "a
// fingertip near my lips" in calibration is always treated as real.

import type { Hand } from '../storage/eventModel.ts';
import { posesMatch, type PoseFeatures, type PoseVector, poseToVector } from './pose.ts';

export type { Hand };
export type HandFilter = 'both' | 'left' | 'right';
export const HAND_FILTERS: readonly HandFilter[] = ['both', 'left', 'right'];

/** The thresholds, in one place. Distances are in face widths (src/detection/pose.ts). */
export const CONTROLS_CONFIG = {
  chinRest: {
    /** A knuckle, the wrist or the palm centre this close to the chin anchor is "touching the chin". */
    chinRegionFw: 0.25,
    /** A fingertip this close to the middle of the lips means real contact: the chin-rest rule never applies. */
    tipGuardFw: 0.15,
    /**
     * Once a hand has been judged a chin rest, the chin region is this much wider for the next frame,
     * so a hand resting right at the edge of the region does not flicker in and out of it.
     */
    hysteresis: 1.25,
    /** Calibration may move the two values above, but only within these limits. */
    chinRegionRange: [0.15, 0.4],
    tipGuardRange: [0.08, 0.25],
  },
  learned: {
    /** Samples kept (the oldest go first). */
    maxSamples: 40,
    /** A sample older than this is forgotten. */
    ttlDays: 30,
    /** One or more matching rejections: wait this many extra frames (2 frames = 0.4 s at 5 frames a second). */
    extraFramesOne: 2,
    /** This many matching rejections: wait longer, AND require a fingertip close to the lips. */
    strongAt: 2,
    extraFramesStrong: 4,
    /** With a strong match, the nearest fingertip must be within this many face widths of the lips. */
    strongTipFw: 0.2,
  },
} as const;

export const DAY_MS = 24 * 60 * 60 * 1000;

/** A pose the person rejected (or rested in, during calibration), kept as six numbers. */
export interface LearnedSample {
  /** When it was recorded (epoch ms). */
  at: number;
  v: PoseVector;
  /** The History entry it came from, so undoing "Not a bite" can forget it. Never leaves the device. */
  eventId?: string;
}

export interface ChinRestSettings {
  enabled: boolean;
  chinRegionFw: number;
  tipGuardFw: number;
}

export interface FireInfo {
  /** When the alarm started (epoch ms, the engine's clock). */
  at: number;
  behavior: string;
  hand: Hand;
  /** Null for rules that do not read the pose (everything except the mouth rules). */
  pose: PoseFeatures | null;
}

export interface DetectionControls {
  handFilter: HandFilter;
  chinRest: ChinRestSettings;
  /** Poses to be wary of, newest first or in any order. */
  learned: readonly LearnedSample[];
  /** Poses the person recorded as "a fingertip near my lips": never suppressed. */
  safe: readonly PoseVector[];
  /** Poses the person recorded as "how I rest my chin": treated as if they had said "Not a bite" about them twice. They do not expire. */
  rest?: readonly PoseVector[];
  /** Milliseconds, for the learned samples' expiry. Default Date.now. The harness passes the fixture clock. */
  now?: () => number;
  /** Called on the frame an alarm starts, wrapped in try/catch by the engine. */
  onFire?: (info: FireInfo) => void;
}

export const DEFAULT_CHIN_REST: ChinRestSettings = {
  enabled: true,
  chinRegionFw: CONTROLS_CONFIG.chinRest.chinRegionFw,
  tipGuardFw: CONTROLS_CONFIG.chinRest.tipGuardFw,
};

/** The controls a person gets the moment they switch the feature on: both hands, chin-rest rule, nothing learned yet. */
export function defaultControls(overrides: Partial<DetectionControls> = {}): DetectionControls {
  return { handFilter: 'both', chinRest: { ...DEFAULT_CHIN_REST }, learned: [], safe: [], ...overrides };
}

// ── the verdict on one frame's contact ───────────────────────────────────────

export type VetoReason = 'chin-rest' | 'learned';

export interface ContactVerdict {
  /** False = treat this hand on this frame as NOT touching (a miss). */
  ok: boolean;
  /** Frames to wait on top of the rule's own dwell. */
  extraFrames: number;
  reason?: VetoReason;
  /** How many remembered rejections this pose matched. */
  matches: number;
}

const ALLOW: ContactVerdict = { ok: true, extraFrames: 0, matches: 0 };

/** Samples still inside their lifetime. */
export function liveSamples(samples: readonly LearnedSample[], now: number): LearnedSample[] {
  const cutoff = now - CONTROLS_CONFIG.learned.ttlDays * DAY_MS;
  return samples.filter(s => s.at >= cutoff);
}

/**
 * Whether a hand that the base rule says is touching the mouth really is, given the controls. Called
 * only for frames where the base rule already has contact (so it can only ever remove or delay an
 * alarm, never add one).
 */
export function judgeContact(pose: PoseFeatures, controls: DetectionControls, now: number, wasChinRest = false): ContactVerdict {
  const vector = poseToVector(pose);

  // A pose the person said is a real fingertip-near-lips pose wins over everything below.
  for (const safe of controls.safe) if (posesMatch(vector, safe)) return ALLOW;

  const chin = controls.chinRest;
  const region = chin.chinRegionFw * (wasChinRest ? CONTROLS_CONFIG.chinRest.hysteresis : 1);
  if (chin.enabled && pose.chinDist <= region && pose.tipDist > chin.tipGuardFw) {
    return { ok: false, extraFrames: 0, reason: 'chin-rest', matches: 0 };
  }

  const cfg = CONTROLS_CONFIG.learned;
  let matches = 0;
  const cutoff = now - cfg.ttlDays * DAY_MS;
  for (const s of controls.learned) if (s.at >= cutoff && posesMatch(vector, s.v)) matches++;
  if (controls.rest) for (const r of controls.rest) if (posesMatch(vector, r)) { matches += cfg.strongAt; break; }
  if (matches === 0) return ALLOW;

  if (matches >= cfg.strongAt) {
    // The person has said "Not a bite" to this pose more than once. Wait longer, and want a fingertip at the lips.
    if (pose.part !== 'fingertip' || pose.tipDist > cfg.strongTipFw) return { ok: false, extraFrames: 0, reason: 'learned', matches };
    return { ok: true, extraFrames: cfg.extraFramesStrong, matches };
  }
  return { ok: true, extraFrames: cfg.extraFramesOne, matches };
}

// ── the hand filter ──────────────────────────────────────────────────────────

/** Whether a hand on `side` is watched under `filter`. A hand whose side is unknown is always watched: not knowing must never switch the alarm off. */
export function handIsWatched(filter: HandFilter, side: Hand | undefined): boolean {
  if (filter === 'both' || side === undefined || side === 'unknown') return true;
  return side === filter;
}
