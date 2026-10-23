// The urge timer's breathing guide (WS2), as pure functions of elapsed time.
//
// A calm, fixed pattern: breathe in for 4 seconds, out for 6. One cycle is 10
// seconds, so the 60 and 90 second sessions are exactly 6 and 9 cycles. It is a
// pacing aid for the person's attention; it makes no claim about what it does
// to the body, and the text never says it will remove an urge.

export const INHALE_SEC = 4;
export const EXHALE_SEC = 6;
export const CYCLE_SEC = INHALE_SEC + EXHALE_SEC;

export const URGE_DURATIONS_SEC = [60, 90] as const;
export type UrgeDuration = (typeof URGE_DURATIONS_SEC)[number];
export const DEFAULT_URGE_DURATION: UrgeDuration = 60;

export type BreathPhase = 'in' | 'out';

export interface BreathState {
  phase: BreathPhase;
  /** Whole seconds left in this phase, counting down to 1. */
  secondsLeft: number;
  /** Length of this phase in seconds (for the circle's transition). */
  phaseSec: number;
  /** Which target size the circle is heading to: 1 (full) when breathing in, 0 (small) when out. */
  target: 0 | 1;
}

/** Where in the pattern we are `elapsedMs` after the start. Negative counts as the start. */
export function breathAt(elapsedMs: number): BreathState {
  const t = Math.max(0, elapsedMs) / 1000;
  const inCycle = t % CYCLE_SEC;
  if (inCycle < INHALE_SEC) {
    return { phase: 'in', secondsLeft: Math.max(1, Math.ceil(INHALE_SEC - inCycle)), phaseSec: INHALE_SEC, target: 1 };
  }
  return { phase: 'out', secondsLeft: Math.max(1, Math.ceil(CYCLE_SEC - inCycle)), phaseSec: EXHALE_SEC, target: 0 };
}

export function isUrgeDuration(x: unknown): x is UrgeDuration {
  return x === 60 || x === 90;
}
