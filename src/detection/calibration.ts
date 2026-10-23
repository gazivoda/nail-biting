// The optional one-minute calibration (WS3), as pure functions.
//
// Two short steps, plain instructions, the person's own live camera feed:
//   1. "Rest your chin on your hand as you normally would."  -> poses to treat as NOT a bite
//   2. "Bring a fingertip near your lips."                    -> poses to treat as a real one
// Each step collects pose numbers (src/detection/pose.ts) frame by frame. This file turns them into a
// small profile that tunes the two distances of the chin-rest rule and adds two short lists of poses:
//
//   chinRegionFw  how close to the chin counts as "resting on the chin": a little beyond where THIS
//                 person's resting hand actually sat
//   tipGuardFw    how close a fingertip must be to the lips to count as a real bite: a margin beyond
//                 where THIS person's real fingertip sat, but never beyond where their resting
//                 fingertips sit
//   rest          the distinct resting poses seen (up to 12)
//   real          the distinct fingertip-near-lips poses seen (up to 12): these are never suppressed
//
// Only these few numbers are kept (kv, this device, one click to delete). No frame, no landmark, no picture.

import { CONTROLS_CONFIG, type ChinRestSettings, type DetectionControls } from './controls.ts';
import { poseToVector, posesMatch, type PoseFeatures, type PoseVector } from './pose.ts';

export const CALIBRATION = {
  /** Seconds the camera watches in each step. About a minute with the introduction and the pause between them. */
  stepSeconds: 22,
  /** A step needs at least this many usable frames (about two seconds at 5 frames a second). */
  minFrames: 10,
  /** Distinct poses kept per step. */
  maxKept: 12,
} as const;

export interface CalibrationProfile {
  /** When it was recorded (epoch ms). */
  at: number;
  chinRegionFw: number;
  tipGuardFw: number;
  rest: PoseVector[];
  real: PoseVector[];
  /** How many frames each step produced, for the person to see and for tests. */
  restFrames: number;
  realFrames: number;
}

export type CalibrationResult =
  | { ok: true; profile: CalibrationProfile }
  | { ok: false; reason: 'no-rest' | 'no-real' | 'no-either' };

const clamp = (v: number, [lo, hi]: readonly [number, number] | readonly number[]) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
}

/** The distinct poses among `poses`: a pose is kept only if no kept pose already matches it. */
export function distinctPoses(poses: readonly PoseFeatures[], max: number = CALIBRATION.maxKept): PoseVector[] {
  const kept: PoseVector[] = [];
  for (const p of poses) {
    const v = poseToVector(p);
    if (kept.length >= max) break;
    if (!kept.some(k => posesMatch(k, v))) kept.push(v);
  }
  return kept;
}

/** Turns the two steps' frames into a profile, or says in a word why it cannot. */
export function deriveProfile(rest: readonly PoseFeatures[], real: readonly PoseFeatures[], now: number): CalibrationResult {
  const enoughRest = rest.length >= CALIBRATION.minFrames;
  const enoughReal = real.length >= CALIBRATION.minFrames;
  if (!enoughRest && !enoughReal) return { ok: false, reason: 'no-either' };
  if (!enoughRest) return { ok: false, reason: 'no-rest' };
  if (!enoughReal) return { ok: false, reason: 'no-real' };

  const restChin = rest.map(p => p.chinDist).sort((a, b) => a - b);
  const restTip = rest.map(p => p.tipDist).sort((a, b) => a - b);
  const realTip = real.map(p => p.tipDist).sort((a, b) => a - b);

  const cfg = CONTROLS_CONFIG.chinRest;
  // The region: a little beyond where the resting hand's knuckles and palm actually sat.
  const chinRegionFw = clamp(percentile(restChin, 0.9) * 1.15, cfg.chinRegionRange);
  // The guard: a margin beyond the real fingertip, but not beyond where the resting fingertips sit.
  const wanted = percentile(realTip, 0.9) * 1.5;
  const ceiling = percentile(restTip, 0.1) * 0.9;
  const tipGuardFw = clamp(Math.min(wanted, ceiling > 0 ? ceiling : wanted), cfg.tipGuardRange);

  return {
    ok: true,
    profile: {
      at: now,
      chinRegionFw: round2(chinRegionFw),
      tipGuardFw: round2(tipGuardFw),
      rest: distinctPoses(rest),
      real: distinctPoses(real),
      restFrames: rest.length,
      realFrames: real.length,
    },
  };
}

/** Whatever was stored, checked. Null when it is not a usable profile. */
export function parseProfile(raw: unknown): CalibrationProfile | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const at = num(r.at);
  const region = num(r.chinRegionFw);
  const guard = num(r.tipGuardFw);
  if (at === null || region === null || guard === null) return null;
  const vectors = (x: unknown): PoseVector[] | null => {
    if (!Array.isArray(x)) return null;
    const out: PoseVector[] = [];
    for (const item of x) {
      if (!Array.isArray(item) || item.length !== 6 || !item.every(n => typeof n === 'number' && Number.isFinite(n))) return null;
      out.push(item as PoseVector);
    }
    return out;
  };
  const rest = vectors(r.rest);
  const real = vectors(r.real);
  if (!rest || !real) return null;
  const cfg = CONTROLS_CONFIG.chinRest;
  return {
    at,
    chinRegionFw: clamp(region, cfg.chinRegionRange),
    tipGuardFw: clamp(guard, cfg.tipGuardRange),
    rest: rest.slice(0, CALIBRATION.maxKept),
    real: real.slice(0, CALIBRATION.maxKept),
    restFrames: num(r.restFrames) ?? 0,
    realFrames: num(r.realFrames) ?? 0,
  };
}

/** The parts of the controls that a calibration decides. */
export function controlsFromProfile(profile: CalibrationProfile | null, chinRestEnabled: boolean): Pick<DetectionControls, 'chinRest' | 'rest' | 'safe'> {
  const chinRest: ChinRestSettings = {
    enabled: chinRestEnabled,
    chinRegionFw: profile ? profile.chinRegionFw : CONTROLS_CONFIG.chinRest.chinRegionFw,
    tipGuardFw: profile ? profile.tipGuardFw : CONTROLS_CONFIG.chinRest.tipGuardFw,
  };
  return { chinRest, rest: profile ? profile.rest : [], safe: profile ? profile.real : [] };
}
