// Zone rules: one per behaviour. A rule says WHICH part of the hand must be at
// WHICH part of the face, how close, for how long, and (optionally) with what
// hand shape or movement.
//
//   zone               which face zone (zones.ts)
//   fingerFilter       hand landmarks that count as the contact point
//                      (MediaPipe hand: 4 thumb tip, 8 index, 12 middle, 16 ring, 20 pinky)
//   distanceThreshold  how close, per sensitivity, in the zone's unit
//   dwellMs            how long the contact must last before an alarm
//   gesture            an extra condition on the hand: a pinch, or small repeated movement
//
// Only the thresholds of nail_biting are tuned values that ship today. The
// others are first guesses, marked experimental in registry.ts, and exist so the
// owner can record real footage and tune them (scripts/eval-detection).
//
// DWELL IS COUNTED IN FRAMES. The shipped detector asks for 3 hits in a row, "about
// 600 ms at 5 fps", and ignores the clock. That is kept exactly: `dwellMs` is
// turned into frames at the nominal inference interval, so 600 ms is 3 frames.
// (When the tab is hidden the loop runs at ~2 fps and the same 3 frames take
// longer; that is existing behaviour and WS7a's to revisit.)

import type { DetectionSensitivity } from '../types';
import type { Behavior } from '../storage/eventModel.ts';
import type { Landmark } from './types.ts';
import type { ResolvedZone, ZoneId } from './zones.ts';

/** The nominal gap between inference frames. Keep equal to INFERENCE_INTERVAL_MS in src/hooks/useDetection.ts. */
export const FRAME_INTERVAL_MS = 200;

export function framesForDwell(dwellMs: number): number {
  return Math.max(1, Math.round(dwellMs / FRAME_INTERVAL_MS));
}

// Only fingertips count for the mouth: a wrist or palm drifting past the face shouldn't fire.
// MediaPipe hand landmark indices: 4=thumb, 8=index, 12=middle, 16=ring, 20=pinky
export const FINGERTIP_INDICES: readonly number[] = [4, 8, 12, 16, 20];

export type GestureSpec =
  /** Thumb tip (4) and index tip (8) together. The contact point is their midpoint. */
  | { kind: 'pinch'; /** Thumb-to-index distance as a fraction of the palm length (wrist 0 to middle knuckle 9). */ maxRatio: number }
  /**
   * The contact point moves a little, back and forth, instead of resting: over the
   * last `windowFrames` frames it travels at least `minPath`, never strays more than
   * `maxExtent` from where it started (both in the zone's unit) and changes direction
   * at least `minReversals` times. A resting hand and a sweeping hand both fail.
   */
  | { kind: 'repeated-motion'; windowFrames: number; minPath: number; maxExtent: number; minReversals: number };

export interface ZoneRule {
  behavior: Behavior;
  zone: ZoneId;
  fingerFilter: readonly number[];
  distanceThreshold: Readonly<Record<DetectionSensitivity, number>>;
  dwellMs: number;
  gesture?: GestureSpec;
}

/** Same ratios as the shipped mouth thresholds: low is 1.5x medium, high is 2/3 of medium. */
function bySensitivity(medium: number): Record<DetectionSensitivity, number> {
  return { low: medium * 1.5, medium, high: medium * (2 / 3) };
}

// ── nail biting: the shipped rule, unchanged ───────────────────────────────

export const NAIL_BITING_RULE: ZoneRule = {
  behavior: 'nail_biting',
  zone: 'mouth',
  fingerFilter: FINGERTIP_INDICES,
  distanceThreshold: { low: 0.18, medium: 0.12, high: 0.08 },
  dwellMs: 600,
};

/** Cuticle and skin biting: the same mouth check, logged under its own name (the user picks which). */
export const CUTICLE_SKIN_BITING_RULE: ZoneRule = { ...NAIL_BITING_RULE, behavior: 'cuticle_skin_biting' };

// ── experimental rules: first guesses, to be tuned on real footage ─────────

export const NOSE_PICKING_RULE: ZoneRule = {
  behavior: 'nose_picking',
  zone: 'nose',
  fingerFilter: [8, 20], // index or pinky tip
  distanceThreshold: bySensitivity(0.11), // face widths
  dwellMs: 1600,
};

export const EYE_AREA_PULLING_RULE: ZoneRule = {
  behavior: 'eye_area_pulling',
  zone: 'eye_area',
  fingerFilter: [4, 8], // the pinch
  distanceThreshold: bySensitivity(0.2), // face widths
  dwellMs: 1400,
  gesture: { kind: 'pinch', maxRatio: 0.35 },
};

export const FACE_SKIN_PICKING_RULE: ZoneRule = {
  behavior: 'face_skin_picking',
  zone: 'face_skin',
  fingerFilter: [4, 8, 12], // thumb, index, middle tips
  distanceThreshold: bySensitivity(0.2), // face widths
  dwellMs: 3000,
  gesture: { kind: 'repeated-motion', windowFrames: 8, minPath: 0.3, maxExtent: 0.7, minReversals: 3 },
};

export const HAIR_PULLING_RULE: ZoneRule = {
  behavior: 'hair_pulling',
  zone: 'scalp',
  fingerFilter: [4, 8], // the pinch
  distanceThreshold: bySensitivity(0.24), // face heights
  dwellMs: 2000,
  gesture: { kind: 'pinch', maxRatio: 0.35 },
};

export const RULES: Readonly<Record<Behavior, ZoneRule>> = {
  nail_biting: NAIL_BITING_RULE,
  cuticle_skin_biting: CUTICLE_SKIN_BITING_RULE,
  nose_picking: NOSE_PICKING_RULE,
  eye_area_pulling: EYE_AREA_PULLING_RULE,
  face_skin_picking: FACE_SKIN_PICKING_RULE,
  hair_pulling: HAIR_PULLING_RULE,
};

// ── evaluating a rule on one frame ─────────────────────────────────────────

/** What a rule remembers between frames: the dwell counter and, for movement rules, the recent contact points. */
export interface RuleState {
  /** Consecutive frames with contact. */
  hits: number;
  /**
   * Whether the rule's extra condition holds right now. Always true for rules without one;
   * for a movement rule it turns true once the last `windowFrames` contact points look like
   * small repeated movement. An alarm needs the dwell met AND the gate open.
   */
  gate: boolean;
  trackX: number[];
  trackY: number[];
  trackCount: number;
}

export function createRuleState(): RuleState {
  return { hits: 0, gate: true, trackX: [], trackY: [], trackCount: 0 };
}

export function resetRuleState(state: RuleState) {
  state.hits = 0;
  state.gate = true;
  state.trackCount = 0;
}

function nearAnchor(px: number, py: number, zone: ResolvedZone, threshold: number): boolean {
  for (let k = 0; k < zone.count; k++) {
    // Same expression, same order, as the shipped dist2d(fingertip, mouth) < threshold.
    if (Math.sqrt((px - zone.x[k]) ** 2 + (py - zone.y[k]) ** 2) < threshold) return true;
  }
  return false;
}

/**
 * True when any of `fingerFilter` on any hand is within `threshold` of the zone.
 * Hands are visited in order and fingers in filter order, stopping at the first hit,
 * exactly like the shipped isFingertipNearMouth (which matters when a hand is malformed).
 */
export function fingertipContact(
  fingerFilter: readonly number[],
  hands: readonly Landmark[][],
  zone: ResolvedZone,
  threshold: number,
): boolean {
  for (let h = 0; h < hands.length; h++) {
    const handPoints = hands[h];
    for (let k = 0; k < fingerFilter.length; k++) {
      const p = handPoints[fingerFilter[k]];
      if (nearAnchor(p.x, p.y, zone, threshold)) return true;
    }
  }
  return false;
}

const dist = (a: Landmark, b: Landmark) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

/** Distance from a point to the nearest anchor of the zone. */
function distanceToZone(px: number, py: number, zone: ResolvedZone): number {
  let best = Infinity;
  for (let k = 0; k < zone.count; k++) {
    const d = Math.sqrt((px - zone.x[k]) ** 2 + (py - zone.y[k]) ** 2);
    if (d < best) best = d;
  }
  return best;
}

/**
 * The contact point of a rule on this frame: the candidate (a pinch midpoint, or a fingertip
 * of the rule's filter) nearest to the zone, if it is within the threshold. The NEAREST, not
 * the first in range, matters for movement rules, which follow this point from frame to frame:
 * "the first finger in range" can flip between two fingertips and look like movement that is
 * not there. Writes the point to `point` when found.
 */
function findContact(
  rule: ZoneRule,
  hands: readonly Landmark[][],
  zone: ResolvedZone,
  threshold: number,
  point: { x: number; y: number },
): boolean {
  const gesture = rule.gesture;
  let bestDistance = Infinity;

  for (const hand of hands) {
    if (gesture && gesture.kind === 'pinch') {
      const thumb = hand[rule.fingerFilter[0]];
      const index = hand[rule.fingerFilter[1]];
      const palm = dist(hand[0], hand[9]);
      if (palm <= 0 || dist(thumb, index) / palm > gesture.maxRatio) continue;
      const mx = (thumb.x + index.x) / 2;
      const my = (thumb.y + index.y) / 2;
      const d = distanceToZone(mx, my, zone);
      if (d < bestDistance) { bestDistance = d; point.x = mx; point.y = my; }
    } else {
      for (let k = 0; k < rule.fingerFilter.length; k++) {
        const p = hand[rule.fingerFilter[k]];
        const d = distanceToZone(p.x, p.y, zone);
        if (d < bestDistance) { bestDistance = d; point.x = p.x; point.y = p.y; }
      }
    }
  }
  return bestDistance < threshold;
}

/** Does the recent track of the contact point look like small repeated movement? */
export function movesRepeatedly(
  state: RuleState,
  spec: Extract<GestureSpec, { kind: 'repeated-motion' }>,
  unit: number,
): boolean {
  const n = state.trackCount;
  if (n < spec.windowFrames) return false;
  const xs = state.trackX;
  const ys = state.trackY;
  let path = 0;
  let minX = xs[0], maxX = xs[0], minY = ys[0], maxY = ys[0];
  let reversals = 0;
  let prevDx = 0;
  let prevDy = 0;
  for (let i = 1; i < n; i++) {
    const dx = xs[i] - xs[i - 1];
    const dy = ys[i] - ys[i - 1];
    path += Math.sqrt(dx * dx + dy * dy);
    if (i > 1 && dx * prevDx + dy * prevDy < 0) reversals++;
    prevDx = dx;
    prevDy = dy;
    if (xs[i] < minX) minX = xs[i];
    if (xs[i] > maxX) maxX = xs[i];
    if (ys[i] < minY) minY = ys[i];
    if (ys[i] > maxY) maxY = ys[i];
  }
  const extent = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
  return path >= spec.minPath * unit && extent <= spec.maxExtent * unit && reversals >= spec.minReversals;
}

const scratchPoint = { x: 0, y: 0 };

/**
 * Whether the hand is in contact with the rule's zone on this frame (a pinch rule also needs the
 * pinch, because the pinch is what makes a contact point). The dwell is applied by the caller.
 * Sets `state.gate` and, for movement rules, `state.track*`. `zone` must already be resolved for
 * the rule's zone, and `hands` must be non-empty.
 */
export function evaluateRule(
  rule: ZoneRule,
  hands: readonly Landmark[][],
  zone: ResolvedZone,
  sensitivity: DetectionSensitivity,
  state: RuleState,
): boolean {
  const threshold = rule.distanceThreshold[sensitivity] * zone.unit;
  const gesture = rule.gesture;

  if (!gesture) return fingertipContact(rule.fingerFilter, hands, zone, threshold);

  if (!findContact(rule, hands, zone, threshold, scratchPoint)) {
    state.trackCount = 0;
    state.gate = gesture.kind === 'pinch';
    return false;
  }
  if (gesture.kind === 'pinch') return true;

  // repeated-motion: keep the last `windowFrames` contact points.
  const cap = gesture.windowFrames;
  if (state.trackCount >= cap) {
    state.trackX.copyWithin(0, 1, cap);
    state.trackY.copyWithin(0, 1, cap);
    state.trackCount = cap - 1;
  }
  state.trackX[state.trackCount] = scratchPoint.x;
  state.trackY[state.trackCount] = scratchPoint.y;
  state.trackCount++;
  state.gate = movesRepeatedly(state, gesture, zone.unit);
  return true;
}
