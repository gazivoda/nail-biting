import { describe, it, expect, vi } from 'vitest';
import {
  createBiteDetector,
  isFingertipNearMouth,
  REQUIRED_CONSECUTIVE_FRAMES,
  REQUIRED_MISSES_TO_CLEAR,
  THRESHOLDS,
  FINGERTIP_INDICES,
  type Landmark,
} from './biteDetector';

const MOUTH = { x: 0.5, y: 0.5 };

/** A face whose lip landmarks sit at MOUTH. */
function face(): Landmark[] {
  const points: Landmark[] = Array.from({ length: 24 }, () => ({ x: 0, y: 0 }));
  points[13] = { ...MOUTH };
  points[14] = { ...MOUTH };
  return points;
}

/** A hand with every fingertip parked `distance` away from the mouth. */
function hand(distance: number): Landmark[] {
  const points: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  for (const idx of FINGERTIP_INDICES) {
    points[idx] = { x: MOUTH.x + distance, y: MOUTH.y };
  }
  return points;
}

/** Rig with a controllable video and landmark source. */
function rig(opts: { hands?: () => Landmark[][]; throws?: boolean } = {}) {
  const onBiteStart = vi.fn();
  const onBiteEnd = vi.fn();
  const video = { readyState: 4 };
  let ts = 0;

  const detector = createBiteDetector({
    getVideo: () => video,
    getSensitivity: () => 'medium',
    source: {
      detectHands: () => {
        if (opts.throws) throw new Error('inference exploded');
        return opts.hands ? opts.hands() : [];
      },
      detectFace: () => [face()],
    },
    onBiteStart,
    onBiteEnd,
  });

  return {
    video,
    onBiteStart,
    onBiteEnd,
    frames: (n: number) => { for (let i = 0; i < n; i++) detector.step((ts += 200)); },
  };
}

const biting = () => [hand(THRESHOLDS.medium / 2)];   // well inside the threshold
const notBiting = () => [hand(THRESHOLDS.medium * 4)]; // well outside

describe('isFingertipNearMouth', () => {
  it('is false with no hands or no face', () => {
    expect(isFingertipNearMouth([], [face()], THRESHOLDS.medium)).toBe(false);
    expect(isFingertipNearMouth(biting(), [], THRESHOLDS.medium)).toBe(false);
  });

  it('respects the sensitivity threshold', () => {
    const hands = [hand(0.1)];
    expect(isFingertipNearMouth(hands, [face()], THRESHOLDS.low)).toBe(true);   // 0.18
    expect(isFingertipNearMouth(hands, [face()], THRESHOLDS.high)).toBe(false); // 0.08
  });

  it('ignores non-fingertip landmarks near the mouth', () => {
    const points: Landmark[] = Array.from({ length: 21 }, () => ({ x: 10, y: 10 }));
    points[0] = { ...MOUTH };  // wrist resting on the chin
    expect(isFingertipNearMouth([points], [face()], THRESHOLDS.medium)).toBe(false);
  });
});

describe('createBiteDetector', () => {
  it('requires a dwell period before firing', () => {
    const r = rig({ hands: biting });

    r.frames(REQUIRED_CONSECUTIVE_FRAMES - 1);
    expect(r.onBiteStart).not.toHaveBeenCalled();

    r.frames(1);
    expect(r.onBiteStart).toHaveBeenCalled();
  });

  it('does not fire on a brief pass-by', () => {
    const r = rig({ hands: biting });
    r.frames(REQUIRED_CONSECUTIVE_FRAMES - 1); // hand near mouth, but not long enough
    expect(r.onBiteStart).not.toHaveBeenCalled();
  });

  it('ends the episode once the hand moves away', () => {
    const r = rig({ hands: biting });
    r.frames(REQUIRED_CONSECUTIVE_FRAMES);
    expect(r.onBiteStart).toHaveBeenCalled();

    const moved = rig({ hands: notBiting });
    moved.frames(REQUIRED_MISSES_TO_CLEAR);
    expect(moved.onBiteEnd).toHaveBeenCalled();
  });

  // Regression: runInference used to `return` early when the video had no
  // usable frame, which skipped the miss accounting entirely. An alarm that was
  // already firing could then never be told to stop — it looped until the user
  // closed the app.
  it('ends the episode when the camera stalls mid-bite', () => {
    const r = rig({ hands: biting });

    r.frames(REQUIRED_CONSECUTIVE_FRAMES);
    expect(r.onBiteStart).toHaveBeenCalled();
    expect(r.onBiteEnd).not.toHaveBeenCalled();

    // Another app grabs the webcam: readyState drops and never recovers.
    r.video.readyState = 0;
    r.frames(40);

    expect(r.onBiteEnd).toHaveBeenCalled();
  });

  it('ends the episode when inference keeps throwing mid-bite', () => {
    const good = rig({ hands: biting });
    good.frames(REQUIRED_CONSECUTIVE_FRAMES);
    expect(good.onBiteStart).toHaveBeenCalled();

    const broken = rig({ throws: true });
    broken.frames(REQUIRED_MISSES_TO_CLEAR);
    expect(broken.onBiteEnd).toHaveBeenCalled();
  });

  it('treats a missing video element as a miss rather than a crash', () => {
    const onBiteEnd = vi.fn();
    const detector = createBiteDetector({
      getVideo: () => null,
      getSensitivity: () => 'medium',
      source: { detectHands: () => [], detectFace: () => [] },
      onBiteStart: vi.fn(),
      onBiteEnd,
    });

    expect(() => detector.step(0)).not.toThrow();
    detector.step(200);
    expect(onBiteEnd).toHaveBeenCalled();
  });

  it('a single stray miss does not end an ongoing episode', () => {
    const onBiteStart = vi.fn();
    const onBiteEnd = vi.fn();
    let near = true;
    const detector = createBiteDetector({
      getVideo: () => ({ readyState: 4 }),
      getSensitivity: () => 'medium',
      source: {
        detectHands: () => (near ? biting() : notBiting()),
        detectFace: () => [face()],
      },
      onBiteStart,
      onBiteEnd,
    });

    let ts = 0;
    const step = () => detector.step((ts += 200));

    for (let i = 0; i < REQUIRED_CONSECUTIVE_FRAMES; i++) step();
    expect(onBiteStart).toHaveBeenCalled();

    near = false;
    step();                       // one dropped frame — below the clear threshold
    expect(onBiteEnd).not.toHaveBeenCalled();

    near = true;
    step();
    expect(onBiteEnd).not.toHaveBeenCalled();
  });
});
