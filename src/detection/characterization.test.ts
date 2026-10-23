// Golden tests that pin what the nail-biting detector DOES today, on synthetic
// landmark sequences. They were written (and passed) against the original
// src/hooks/biteDetector.ts BEFORE WS1 refactored it, and they run against both
// the current detector and the verbatim reference copy, so a pin that holds for
// the reference but not for the current code is a regression.
//
// Reading a sequence: one letter per frame, at 5 fps (200 ms apart).
//   H  one hand, every fingertip well inside every sensitivity's threshold
//   M  one hand, every fingertip well outside
//   N  no hand detected                F  hand at the mouth but no face detected
//   V  video not ready (readyState 0)  T  no video element at all
//   X  the landmark source throws
// Output, one character per frame:  S = onBiteStart called, E = onBiteEnd called, . = neither.
// onBiteStart is called on EVERY hit frame once the dwell is met and onBiteEnd on
// every second consecutive miss; the caller (useDetection) dedupes both.

import { describe, it, expect } from 'vitest';
import {
  createBiteDetector,
  isFingertipNearMouth,
  FINGERTIP_INDICES,
  REQUIRED_CONSECUTIVE_FRAMES,
  REQUIRED_MISSES_TO_CLEAR,
  THRESHOLDS,
  type Landmark,
  type LandmarkSource,
  type VideoLike,
} from '../hooks/biteDetector';
import { createBiteDetector as createLegacyDetector } from './__reference__/legacyBiteDetector';
import type { DetectionSensitivity } from '../types';

type Create = typeof createBiteDetector;

const MOUTH = { x: 0.5, y: 0.5 };

function face(upper = MOUTH, lower = MOUTH): Landmark[] {
  const points: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  points[13] = { ...upper };
  points[14] = { ...lower };
  return points;
}

/** A hand whose five fingertips all sit `distance` to the right of MOUTH; the other 16 landmarks are far away. */
function handAt(distance: number, tips: readonly number[] = FINGERTIP_INDICES): Landmark[] {
  const points: Landmark[] = Array.from({ length: 21 }, () => ({ x: 9, y: 9 }));
  for (const idx of tips) points[idx] = { x: MOUTH.x + distance, y: MOUTH.y };
  return points;
}

const NEAR = 0.06; // inside low (0.18), medium (0.12) and high (0.08)
const FAR = 0.48;  // outside all three

interface Frame {
  hands?: Landmark[][];
  faces?: Landmark[][];
  readyState?: number;
  noVideo?: boolean;
  throws?: boolean;
  sensitivity?: DetectionSensitivity;
  ts?: number;
}

function letter(c: string): Frame {
  switch (c) {
    case 'H': return { hands: [handAt(NEAR)] };
    case 'M': return { hands: [handAt(FAR)] };
    case 'N': return { hands: [] };
    case 'F': return { hands: [handAt(NEAR)], faces: [] };
    case 'V': return { hands: [handAt(NEAR)], readyState: 0 };
    case 'T': return { hands: [handAt(NEAR)], noVideo: true };
    case 'X': return { throws: true };
    default: throw new Error(`unknown frame letter ${c}`);
  }
}

/** Plays frames through a detector and returns the S/E/. string plus the raw call log. */
function play(create: Create, frames: Frame[], defaultSensitivity: DetectionSensitivity = 'medium') {
  let current: Frame = {};
  const out: string[] = [];
  let mark = '.';
  const calls: Array<{ kind: 'hands' | 'face'; ts: number }> = [];
  const video: VideoLike = { readyState: 4 };

  const source: LandmarkSource = {
    detectHands: (_v, ts) => {
      calls.push({ kind: 'hands', ts });
      if (current.throws) throw new Error('inference exploded');
      return current.hands ?? [];
    },
    detectFace: (_v, ts) => {
      calls.push({ kind: 'face', ts });
      return current.faces ?? [face()];
    },
  };

  const detector = create({
    getVideo: () => {
      if (current.noVideo) return null;
      video.readyState = current.readyState ?? 4;
      return video;
    },
    getSensitivity: () => current.sensitivity ?? defaultSensitivity,
    source,
    onBiteStart: () => { mark = 'S'; },
    onBiteEnd: () => { mark = 'E'; },
  });

  let ts = 0;
  for (const f of frames) {
    current = f;
    mark = '.';
    ts = f.ts ?? ts + 200;
    detector.step(ts);
    out.push(mark);
  }
  return { out: out.join(''), calls };
}

const playLetters = (create: Create, seq: string, sens?: DetectionSensitivity) =>
  play(create, [...seq].map(letter), sens).out;

describe.each([
  ['current detector', createBiteDetector],
  ['verbatim reference (cec2120)', createLegacyDetector],
] as Array<[string, Create]>)('nail-biting characterization: %s', (_name, create) => {

  describe('constants', () => {
    it('are the shipped values', () => {
      expect(REQUIRED_CONSECUTIVE_FRAMES).toBe(3);
      expect(REQUIRED_MISSES_TO_CLEAR).toBe(2);
      expect(THRESHOLDS).toEqual({ low: 0.18, medium: 0.12, high: 0.08 });
      expect([...FINGERTIP_INDICES]).toEqual([4, 8, 12, 16, 20]);
    });
  });

  describe('dwell (3 hit frames, about 600 ms at 5 fps)', () => {
    it('does not fire before the third consecutive hit and fires on every hit after it', () => {
      expect(playLetters(create, 'H')).toBe('.');
      expect(playLetters(create, 'HH')).toBe('..');
      expect(playLetters(create, 'HHH')).toBe('..S');
      expect(playLetters(create, 'HHHHH')).toBe('..SSS');
    });

    it('counts frames, not milliseconds: irregular timestamps change nothing', () => {
      const at = (ts: number[]) => play(create, ts.map(t => ({ ...letter('H'), ts: t }))).out;
      expect(at([200, 400, 600])).toBe('..S');          // exactly 600 ms
      expect(at([10, 20, 30])).toBe('..S');             // 20 ms of wall clock
      expect(at([0, 5000, 90000])).toBe('..S');         // minutes apart
      expect(at([200, 400, 590])).toBe('..S');          // just under 600 ms still fires
    });

    it('a miss restarts the count', () => {
      expect(playLetters(create, 'HHMHHH')).toBe('.....S');
      expect(playLetters(create, 'HHMHH')).toBe('.....');
    });
  });

  describe('ending an episode (2 consecutive misses)', () => {
    it('calls onBiteEnd on every second consecutive miss', () => {
      expect(playLetters(create, 'HHHMMMMM')).toBe('..S.E.E.');
      expect(playLetters(create, 'MM')).toBe('.E');
      expect(playLetters(create, 'MMMMMM')).toBe('.E.E.E');
    });

    it('a single stray miss neither ends the episode nor keeps the alarm firing', () => {
      // After the miss the dwell starts again: three more hits are needed.
      expect(playLetters(create, 'HHHMHHH')).toBe('..S...S');
      expect(playLetters(create, 'HHHMH')).toBe('..S..');
    });

    it('two misses end it and the dwell starts from zero', () => {
      expect(playLetters(create, 'HHMMHHH')).toBe('...E..S');
    });
  });

  describe('the hand leaving and coming back', () => {
    it('hand out of frame (no detection) is a miss', () => {
      expect(playLetters(create, 'HHHNNHHH')).toBe('..S.E..S');
      expect(playLetters(create, 'NNNHHHNNN')).toBe('.E.' + '..S' + '.E.');
    });

    it('a hand that returns within one frame continues the episode without ending it', () => {
      // The miss resets the dwell, so the alarm is silent for three frames before it fires again.
      expect(playLetters(create, 'HHHNHHHH')).toBe('..S...SS');
    });
  });

  describe('when there is no usable input', () => {
    it('no face detected is a miss even with a hand at the mouth', () => {
      expect(playLetters(create, 'FFFFF')).toBe('.E.E.');
      expect(playLetters(create, 'HHHFF')).toBe('..S.E');
    });

    it('video not ready, no video element and a throwing source are each a miss', () => {
      expect(playLetters(create, 'HHHVV')).toBe('..S.E');
      expect(playLetters(create, 'HHHTT')).toBe('..S.E');
      expect(playLetters(create, 'HHHXX')).toBe('..S.E');
      expect(playLetters(create, 'VVVVV')).toBe('.E.E.');
    });

    it('the landmark source is not asked for anything while the video is not ready', () => {
      const r = play(create, [{ ...letter('V') }, { ...letter('T') }]);
      expect(r.calls).toEqual([]);
    });
  });

  describe('sensitivity', () => {
    const at = (sens: DetectionSensitivity, d: number) =>
      play(create, [0, 1, 2].map(() => ({ hands: [handAt(d)] })), sens).out;

    it('low reaches about 0.18 from the mouth', () => {
      expect(at('low', 0.179)).toBe('..S');
      expect(at('low', 0.181)).toBe('.E.');
    });
    it('medium reaches about 0.12', () => {
      expect(at('medium', 0.119)).toBe('..S');
      expect(at('medium', 0.121)).toBe('.E.');
    });
    it('high reaches about 0.08', () => {
      expect(at('high', 0.079)).toBe('..S');
      expect(at('high', 0.081)).toBe('.E.');
    });

    it('a hand 0.1 away is caught by low and medium and ignored by high', () => {
      expect(at('low', 0.1)).toBe('..S');
      expect(at('medium', 0.1)).toBe('..S');
      expect(at('high', 0.1)).toBe('.E.');
    });

    it('is read on every frame, so a change applies from the next frame', () => {
      const frames: Frame[] = (['low', 'low', 'low', 'high', 'high'] as const)
        .map(s => ({ hands: [handAt(0.1)], sensitivity: s }));
      expect(play(create, frames).out).toBe('..S.E');
    });
  });

  describe('jitter around the threshold (medium, 0.12)', () => {
    // Distances in the order they arrive; hits are the ones below 0.12.
    const distances = [0.11, 0.125, 0.115, 0.118, 0.13, 0.119, 0.1, 0.11, 0.09, 0.1201, 0.119, 0.118, 0.117, 0.121, 0.121];
    it('only unbroken runs of three or more hits fire; two misses in a row end it', () => {
      const frames = distances.map(d => ({ hands: [handAt(d)] }));
      // hit/miss: H M H H M H H H H M H H H M M
      expect(play(create, frames).out).toBe('.......SS...S.E');
    });
  });

  describe('which landmarks count', () => {
    it('each fingertip on its own is enough', () => {
      for (const tip of FINGERTIP_INDICES) {
        const frames = [0, 1, 2].map(() => ({ hands: [handAt(NEAR, [tip])] }));
        expect(play(create, frames).out, `tip ${tip}`).toBe('..S');
      }
    });

    it('no other landmark counts, wherever it is', () => {
      for (let idx = 0; idx < 21; idx++) {
        if (FINGERTIP_INDICES.includes(idx)) continue;
        const hand = handAt(FAR);
        hand[idx] = { ...MOUTH };
        const frames = [0, 1, 2].map(() => ({ hands: [hand] }));
        expect(play(create, frames).out, `landmark ${idx}`).toBe('.E.');
      }
    });

    it('the mouth is the midpoint of the inner lip landmarks 13 and 14', () => {
      // The two lip points are 0.4 apart, so the midpoint (0.5, 0.5) is 0.2 from each of them.
      const upper = { x: 0.5, y: 0.3 };
      const lower = { x: 0.5, y: 0.7 };
      const tipAt = (y: number): Landmark[] => { const h = handAt(FAR); h[8] = { x: 0.5, y }; return h; };
      const run = (y: number) =>
        play(create, [0, 1, 2].map(() => ({ hands: [tipAt(y)], faces: [face(upper, lower)] }))).out;
      expect(run(0.5)).toBe('..S');   // on the midpoint: a hit, though 0.2 from either lip point
      expect(run(0.31)).toBe('.E.');  // on the upper lip point: 0.19 from the midpoint, a miss
      expect(run(0.69)).toBe('.E.');  // on the lower lip point: a miss
    });
  });

  describe('several hands and faces', () => {
    it('any one hand at the mouth is enough', () => {
      const frames = [0, 1, 2].map(() => ({ hands: [handAt(FAR), handAt(NEAR)] }));
      expect(play(create, frames).out).toBe('..S');
      const swapped = [0, 1, 2].map(() => ({ hands: [handAt(NEAR), handAt(FAR)] }));
      expect(play(create, swapped).out).toBe('..S');
    });

    it('two hands that are both away is a miss', () => {
      const frames = [0, 1].map(() => ({ hands: [handAt(FAR), handAt(FAR)] }));
      expect(play(create, frames).out).toBe('.E');
    });

    it('the dwell may be met by different hands on different frames', () => {
      const frames: Frame[] = [
        { hands: [handAt(NEAR), handAt(FAR)] },
        { hands: [handAt(FAR), handAt(NEAR)] },
        { hands: [handAt(NEAR), handAt(NEAR)] },
      ];
      expect(play(create, frames).out).toBe('..S');
    });

    it('only the first face is used', () => {
      const farFace = face({ x: 0.9, y: 0.9 }, { x: 0.9, y: 0.9 });
      const frames = [0, 1, 2].map(() => ({ hands: [handAt(NEAR)], faces: [farFace, face()] }));
      expect(play(create, frames).out).toBe('.E.');
      const ok = [0, 1, 2].map(() => ({ hands: [handAt(NEAR)], faces: [face(), farFace] }));
      expect(play(create, ok).out).toBe('..S');
    });
  });

  describe('timestamps handed to the landmark source', () => {
    it('hands get the frame timestamp, the face the same plus 0.1 ms', () => {
      const r = play(create, [{ hands: [], ts: 1000 }, { hands: [], ts: 1200 }]);
      expect(r.calls).toEqual([
        { kind: 'hands', ts: 1000 }, { kind: 'face', ts: 1000.1 },
        { kind: 'hands', ts: 1200 }, { kind: 'face', ts: 1200.1 },
      ]);
    });
  });

  describe('malformed landmarks', () => {
    // A hand with only 5 points: index 4 exists, 8 and above do not.
    const short = (nearThumb: boolean): Landmark[] => {
      const p: Landmark[] = Array.from({ length: 5 }, () => ({ x: 9, y: 9 }));
      if (nearThumb) p[4] = { x: MOUTH.x + NEAR, y: MOUTH.y };
      return p;
    };

    it('a thumb hit is found before the missing landmarks are touched', () => {
      expect(isFingertipNearMouth([short(true)], [face()], THRESHOLDS.medium)).toBe(true);
    });

    it('a missing fingertip landmark throws from the pure check ...', () => {
      expect(() => isFingertipNearMouth([short(false)], [face()], THRESHOLDS.medium)).toThrow();
    });

    it('... and the detector treats that as a miss instead of crashing', () => {
      const frames = [0, 1, 2].map(() => ({ hands: [short(false)] }));
      expect(play(create, frames).out).toBe('.E.');
    });
  });
});

describe('isFingertipNearMouth (pure check)', () => {
  it('is strictly "closer than"', () => {
    expect(isFingertipNearMouth([handAt(0.119)], [face()], 0.12)).toBe(true);
    expect(isFingertipNearMouth([handAt(0.121)], [face()], 0.12)).toBe(false);
  });
  it('is false for no hands and for no face, even with a hand at the mouth', () => {
    expect(isFingertipNearMouth([], [face()], 0.12)).toBe(false);
    expect(isFingertipNearMouth([handAt(0)], [], 0.12)).toBe(false);
  });
  it('measures in normalised image coordinates, so x and y count equally', () => {
    const h = handAt(FAR);
    h[8] = { x: MOUTH.x, y: MOUTH.y + 0.1 };
    expect(isFingertipNearMouth([h], [face()], 0.12)).toBe(true);
    h[8] = { x: MOUTH.x + 0.09, y: MOUTH.y + 0.09 }; // diagonal: 0.127
    expect(isFingertipNearMouth([h], [face()], 0.12)).toBe(false);
  });
});
