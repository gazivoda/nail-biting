// Replays a fixture through the app's own detection engine, the way useDetection
// drives it: one step per frame, with the same "already alarming" dedupe, so what
// comes out is the alarms a person would have heard.
//
// Three ways to play it (WS3):
//   shipped    no controls: the engine the app runs with the false_positive_controls flag off.
//   controls   `controls` given: the flag on, a person who has not yet said "Not a bite" to anything.
//   learning   `controls` and `learn` given: as above, and after every alarm that is NOT inside a
//              labelled event the simulated person taps "Not a bite" at once, which remembers the
//              pose (six numbers) exactly as the app does. Each fixture is one sitting: what is
//              learned in one fixture is not carried into the next.

import { createEngine } from '../../../src/detection/engine.ts';
import { poseToVector } from '../../../src/detection/pose.ts';

/**
 * @param fixture  from parseFixture
 * @param options  { behaviors, sensitivity, controls?: DetectionControls, learn?: { isCorrect(tMs, behavior): boolean } }
 * @returns { alarms: Array<{ t: number, behavior: string }>, stops: number[], taps: number }
 */
export function replay(fixture, { behaviors, sensitivity, controls = null, learn = null }) {
  const frames = fixture.frames;
  let current = frames[0];
  let alarming = false;
  const alarms = [];
  const stops = [];
  let taps = 0;
  let lastFire = null;

  // The engine reads the controls every frame, so a tap can replace them.
  let live = controls && { ...controls, now: () => current.t, onFire: info => { lastFire = info; } };

  const aspect = fixture.image ? { videoWidth: fixture.image.width, videoHeight: fixture.image.height } : {};
  const engine = createEngine({
    getVideo: () => ({ readyState: 4, ...aspect }),
    getSensitivity: () => sensitivity,
    getBehaviors: () => behaviors,
    getControls: () => live,
    source: {
      detectHands: () => current.hands,
      detectFace: () => (current.face ? [current.face] : []),
    },
    onBiteStart: behavior => {
      if (alarming) return; // useDetection.startBiting: one alarm until it stops
      alarming = true;
      alarms.push({ t: current.t, behavior });
      if (learn && live && lastFire && lastFire.pose && !learn.isCorrect(current.t, behavior)) {
        taps++;
        live = { ...live, learned: [...live.learned, { at: current.t, v: poseToVector(lastFire.pose) }] };
      }
    },
    onBiteEnd: () => {
      if (!alarming) return;
      alarming = false;
      stops.push(current.t);
    },
  });

  for (const frame of frames) {
    current = frame;
    engine.step(frame.t);
  }
  return { alarms, stops, taps };
}
