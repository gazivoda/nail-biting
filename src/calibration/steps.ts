// The calibration as a pure state machine (WS3). No DOM, no camera, no clock of its own: every function
// takes `now`, so the whole life of it is tested in node (steps.test.ts).
//
//   intro --start--> rest (22 s) --time up--> between (5 s) --time up--> real (22 s) --time up--> result
//      \________________ cancel from anywhere: back to nothing, nothing saved ________________/
//
// "rest"    step 1: "Rest your chin on your hand as you normally would."   -> poses that are NOT a bite
// "real"    step 2: "Bring a fingertip near your lips."                    -> poses that ARE one
// "between" a short breather so the person can take their hand away and read step 2.
//
// Frames are only counted when the pose says they belong to the step (a hand in the lower face for step 1,
// a fingertip near the lips for step 2), so a hand resting in the lap or out of view adds nothing and the
// person can see "I do not see your hand yet".
//
// Nothing is saved until the result is accepted. The only things ever kept are the few numbers the profile
// holds (src/detection/calibration.ts).

import { CALIBRATION, deriveProfile, type CalibrationProfile } from '../detection/calibration';
import type { PoseFeatures } from '../detection/pose';
import { t } from '../i18n/scopes/calibration';

/** A frame only counts toward "resting on the chin" if the hand is at least this close to the lower face. */
export const REST_MAX_CHIN_FW = 0.6;
/** A frame only counts toward "fingertip near the lips" if a fingertip is at least this close. */
export const REAL_MAX_TIP_FW = 0.4;
/** The pause between the two steps. */
export const BETWEEN_SECONDS = 5;

export type CalibrationState =
  | { phase: 'intro' }
  | { phase: 'rest'; startedAt: number; rest: PoseFeatures[] }
  | { phase: 'between'; startedAt: number; rest: PoseFeatures[] }
  | { phase: 'real'; startedAt: number; rest: PoseFeatures[]; real: PoseFeatures[] }
  | { phase: 'result'; outcome: ReturnType<typeof deriveProfile>; restFrames: number; realFrames: number }
  | { phase: 'cancelled' };

export const START: CalibrationState = { phase: 'intro' };

export const belongsToRest = (p: PoseFeatures) => p.chinDist <= REST_MAX_CHIN_FW;
export const belongsToReal = (p: PoseFeatures) => p.tipDist <= REAL_MAX_TIP_FW;

export function begin(state: CalibrationState, now: number): CalibrationState {
  return state.phase === 'intro' || state.phase === 'result' || state.phase === 'cancelled'
    ? { phase: 'rest', startedAt: now, rest: [] }
    : state;
}

/** Adds one frame's pose to the step in progress. Frames that do not belong are ignored. */
export function addFrame(state: CalibrationState, pose: PoseFeatures | null): CalibrationState {
  if (pose === null) return state;
  if (state.phase === 'rest' && belongsToRest(pose)) return { ...state, rest: [...state.rest, pose] };
  if (state.phase === 'real' && belongsToReal(pose)) return { ...state, real: [...state.real, pose] };
  return state;
}

/** Moves on when a step's time is up. */
export function tick(state: CalibrationState, now: number): CalibrationState {
  if (state.phase === 'rest' && now - state.startedAt >= CALIBRATION.stepSeconds * 1000) {
    return { phase: 'between', startedAt: now, rest: state.rest };
  }
  if (state.phase === 'between' && now - state.startedAt >= BETWEEN_SECONDS * 1000) {
    return { phase: 'real', startedAt: now, rest: state.rest, real: [] };
  }
  if (state.phase === 'real' && now - state.startedAt >= CALIBRATION.stepSeconds * 1000) {
    return {
      phase: 'result',
      outcome: deriveProfile(state.rest, state.real, now),
      restFrames: state.rest.length,
      realFrames: state.real.length,
    };
  }
  return state;
}

/** Whole seconds left in the step in progress (rounded up), or null when no step is timing. */
export function secondsLeft(state: CalibrationState, now: number): number | null {
  const total = state.phase === 'rest' || state.phase === 'real' ? CALIBRATION.stepSeconds : state.phase === 'between' ? BETWEEN_SECONDS : null;
  if (total === null || !('startedAt' in state)) return null;
  return Math.max(0, Math.ceil(total - (now - state.startedAt) / 1000));
}

/** Frames counted so far in the step in progress. */
export function framesSoFar(state: CalibrationState): number {
  if (state.phase === 'rest') return state.rest.length;
  if (state.phase === 'real') return state.real.length;
  return 0;
}

/** Cancel works from every phase and ends with nothing saved. */
export function cancel(): CalibrationState {
  return { phase: 'cancelled' };
}

/** The profile to save, only from a successful result. */
export function profileToSave(state: CalibrationState): CalibrationProfile | null {
  return state.phase === 'result' && state.outcome.ok ? state.outcome.profile : null;
}

/** A step that is enough on its own would be a half calibration; say in words why a result failed. */
export function failureMessage(reason: 'no-rest' | 'no-real' | 'no-either'): string {
  switch (reason) {
    case 'no-rest': return t('failure.noRest');
    case 'no-real': return t('failure.noReal');
    case 'no-either': return t('failure.noEither');
  }
}
