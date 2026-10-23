import { describe, it, expect } from 'vitest';
import { BETWEEN_SECONDS, START, addFrame, begin, belongsToReal, belongsToRest, cancel, failureMessage, framesSoFar, profileToSave, secondsLeft, tick } from './steps';
import { CALIBRATION } from '../detection/calibration';
import type { PoseFeatures } from '../detection/pose';

const T0 = 1_800_000_000_000;
const pose = (over: Partial<PoseFeatures> = {}): PoseFeatures => ({ part: 'knuckle', tipDist: 0.25, chinDist: 0.06, orient: 6, curl: 0.65, below: 0.3, ...over });
const restPose = () => pose();
const realPose = () => pose({ part: 'fingertip', tipDist: 0.04, chinDist: 0.3, orient: 0, curl: 0.55, below: 0.55 });
const STEP_MS = CALIBRATION.stepSeconds * 1000;

function feed(state: ReturnType<typeof begin>, n: number, make: () => PoseFeatures) {
  let s = state;
  for (let i = 0; i < n; i++) s = addFrame(s, make());
  return s;
}

describe('calibration steps', () => {
  it('walks intro, rest, between, real, result, by the clock', () => {
    let s = begin(START, T0);
    expect(s.phase).toBe('rest');
    s = tick(s, T0 + STEP_MS - 1);
    expect(s.phase).toBe('rest');
    s = tick(s, T0 + STEP_MS);
    expect(s.phase).toBe('between');
    s = tick(s, T0 + STEP_MS + BETWEEN_SECONDS * 1000);
    expect(s.phase).toBe('real');
    s = tick(s, T0 + STEP_MS * 2 + BETWEEN_SECONDS * 1000);
    expect(s.phase).toBe('result');
  });

  it('counts only frames that belong to the step in progress', () => {
    let s = begin(START, T0);
    s = addFrame(s, pose({ chinDist: 0.9 }));      // a hand in the lap: not resting on the chin
    s = addFrame(s, null);                          // no hand seen
    expect(framesSoFar(s)).toBe(0);
    s = addFrame(s, restPose());
    expect(framesSoFar(s)).toBe(1);
    expect(belongsToRest(restPose())).toBe(true);
    expect(belongsToReal(restPose())).toBe(true);   // (a resting hand 0.25 from the lips is also "near" enough to be listened to in step 2)
    s = tick(s, T0 + STEP_MS);
    expect(framesSoFar(s)).toBe(0);                 // nothing counts while the breather is on
    expect(addFrame(s, restPose())).toBe(s);
  });

  it('a good run ends in a profile that can be saved', () => {
    let s = begin(START, T0);
    s = feed(s, 30, restPose);
    s = tick(s, T0 + STEP_MS);
    s = tick(s, T0 + STEP_MS + BETWEEN_SECONDS * 1000);
    s = feed(s, 30, realPose);
    s = tick(s, T0 + STEP_MS * 2 + BETWEEN_SECONDS * 1000);
    expect(s.phase).toBe('result');
    const profile = profileToSave(s);
    expect(profile).not.toBeNull();
    expect(profile!.restFrames).toBe(30);
    expect(profile!.realFrames).toBe(30);
  });

  it('a run in which the camera never saw a hand says so and offers nothing to save', () => {
    let s = begin(START, T0);
    s = tick(s, T0 + STEP_MS);
    s = tick(s, T0 + STEP_MS + BETWEEN_SECONDS * 1000);
    s = tick(s, T0 + STEP_MS * 2 + BETWEEN_SECONDS * 1000);
    expect(s.phase).toBe('result');
    expect(profileToSave(s)).toBeNull();
    if (s.phase === 'result' && !s.outcome.ok) expect(failureMessage(s.outcome.reason)).toMatch(/did not see your hand/);
    else throw new Error('expected a failed result');
  });

  it('one step short is named', () => {
    let s = begin(START, T0);
    s = feed(s, 30, restPose);
    s = tick(tick(s, T0 + STEP_MS), T0 + STEP_MS + BETWEEN_SECONDS * 1000);
    s = tick(s, T0 + STEP_MS * 2 + BETWEEN_SECONDS * 1000);
    if (s.phase === 'result' && !s.outcome.ok) expect(s.outcome.reason).toBe('no-real');
    else throw new Error('expected a failed result');
  });

  it('cancel works from every phase and keeps nothing', () => {
    let s = begin(START, T0);
    for (const phase of ['rest', 'between', 'real', 'result'] as const) {
      expect(cancel().phase).toBe('cancelled');
      expect(profileToSave(cancel())).toBeNull();
      if (phase === 'rest') s = tick(feed(s, 5, restPose), T0 + STEP_MS);
    }
    expect(profileToSave(START)).toBeNull();
  });

  it('can be started again after a result or a cancel', () => {
    expect(begin({ phase: 'cancelled' }, T0 + 5).phase).toBe('rest');
    let s = begin(START, T0);
    s = tick(tick(tick(s, T0 + STEP_MS), T0 + STEP_MS + BETWEEN_SECONDS * 1000), T0 + 2 * STEP_MS + BETWEEN_SECONDS * 1000);
    expect(begin(s, T0 + 99).phase).toBe('rest');
    expect(begin(begin(START, T0), T0 + 1)).toEqual(begin(START, T0)); // pressing Start twice does not restart the step
  });

  it('seconds left count down and never go negative', () => {
    const s = begin(START, T0);
    expect(secondsLeft(s, T0)).toBe(CALIBRATION.stepSeconds);
    expect(secondsLeft(s, T0 + 1500)).toBe(CALIBRATION.stepSeconds - 1);
    expect(secondsLeft(s, T0 + STEP_MS * 3)).toBe(0);
    expect(secondsLeft(START, T0)).toBeNull();
  });

  it('about a minute in all', () => {
    const total = CALIBRATION.stepSeconds * 2 + BETWEEN_SECONDS;
    expect(total).toBeGreaterThanOrEqual(45);
    expect(total).toBeLessThanOrEqual(60);
  });
});
