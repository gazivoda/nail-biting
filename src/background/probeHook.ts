// A MEASUREMENT HOOK, present only in a build made with VITE_WS7A_PROBE=1 (scripts/background-probe/README in
// docs/agents/ws7a-notes.md). In every other build `import.meta.env.VITE_WS7A_PROBE` is replaced by `undefined` at
// build time, `withProbe` returns its argument, and the rest of this file is dropped by the bundler (after a build:
// `grep -l __sbProbe dist/assets/*.js` must print nothing, the same check as for the dev-only preview data).
//
// What it does in a probe build: lets a script outside the page (the DevTools protocol) make the detector see a
// hand on the mouth by setting `window.__sbProbe.inject = true`, so the time from "a hand is there" to "the alarm
// started" can be measured through the real loop, the real engine and the real alarm, in a hidden tab, with no
// real hand. It cannot be used to make the app alarm in production: it does not exist there.

import type { LandmarkSource } from '../detection/types';

interface ProbeState {
  /** While true the detector is shown a fingertip on the middle of the mouth instead of the camera's hands/face. */
  inject: boolean;
  /** Detection steps taken (a step calls detectHands once). */
  steps: number;
}

declare global {
  interface Window { __sbProbe?: ProbeState }
}

// 21 hand points and 478 face points, every one on the mouth: the fingertip is at distance 0 from the lips.
const MOUTH = { x: 0.5, y: 0.6 };
const FAKE_HAND = [Array.from({ length: 21 }, () => MOUTH)];
const FAKE_FACE = [Array.from({ length: 478 }, () => MOUTH)];

export function withProbe<S extends LandmarkSource>(source: S): S {
  if (import.meta.env.VITE_WS7A_PROBE !== '1') return source;
  const probe: ProbeState = (window.__sbProbe = { inject: false, steps: 0 });
  return {
    ...source,
    detectHands(video, ts) {
      probe.steps++;
      return probe.inject ? FAKE_HAND : source.detectHands(video, ts);
    },
    detectFace(video, ts) {
      return probe.inject ? FAKE_FACE : source.detectFace(video, ts);
    },
  } as S;
}
