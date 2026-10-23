// Replays a fixture through the app's own detection engine, the way useDetection
// drives it: one step per frame, with the same "already alarming" dedupe, so what
// comes out is the alarms a person would have heard.

import { createEngine } from '../../../src/detection/engine.ts';

/**
 * @param fixture  from parseFixture
 * @param options  { behaviors: Behavior[], sensitivity: 'low'|'medium'|'high' }
 * @returns { alarms: Array<{ t: number, behavior: string }>, stops: number[] }
 */
export function replay(fixture, { behaviors, sensitivity }) {
  const frames = fixture.frames;
  let current = frames[0];
  let alarming = false;
  const alarms = [];
  const stops = [];

  const engine = createEngine({
    getVideo: () => ({ readyState: 4 }),
    getSensitivity: () => sensitivity,
    getBehaviors: () => behaviors,
    source: {
      detectHands: () => current.hands,
      detectFace: () => (current.face ? [current.face] : []),
    },
    onBiteStart: behavior => {
      if (alarming) return; // useDetection.startBiting: one alarm until it stops
      alarming = true;
      alarms.push({ t: current.t, behavior });
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
  return { alarms, stops };
}
