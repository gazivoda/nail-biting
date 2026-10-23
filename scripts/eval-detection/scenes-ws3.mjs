// Synthetic scenes added for WS3 (fewer false alarms). Same rules as scenes.mjs: drawn by the person who
// wrote the controls, from a stick-model hand and a neutral face. They show what the controls do on poses
// drawn to match the plan's words; they say nothing about real people. Every scene here is tagged 'ws3'.
//
// Two groups:
//
//  CHIN REST (the literal rule: the back of the hand, the knuckles or the palm rests on the chin, and no
//  fingertip is near the lips). The two older chin-rest scenes (neg_chin_rest, neg_cheek_rest_thinking) are
//  drawn with the FINGERS along the jaw and the palm far from the chin, so that rule rightly does not touch
//  them; these scenes put the knuckles on the chin, where the rule applies. Beside them, bites with the hand
//  close to the chin and a fingertip at the lips, which the rule must leave alone.
//
//  LEARNED POSES (a pose the person rejects over and over, then a real bite). In the evaluation the
//  "person" taps Not a bite after every false alarm, so the sequences show how much the learning helps and
//  whether the real bite at the end still gets through.

import { facePoint } from '../../src/detection/synthetic.ts';

const P = (name, dx = 0, dy = 0) => { const [x, y] = facePoint(name); return [x + dx, y + dy]; };
const LAP = x => [x, 640];
const MOUTH = ['nail_biting', 'cuticle_skin_biting'];

const FIST = { index: 0.3, middle: 0.3, ring: 0.3, pinky: 0.3, thumb: 0.3 };
const PINCH = { index: 0.7, middle: 0.3, ring: 0.3, pinky: 0.3 };

const positive = (...more) => ['positive', 'ws3', ...more];
const negative = (...more) => ['negative', 'ws3', ...more];

/** Out of view, in over 1 s, hold, out over 1 s; `count` times with `gapMs` between. Returns the path and when the next visit would begin. */
function visits({ rest, target, firstArrive, holdMs, count, gapMs }) {
  const path = [{ t: 0, at: rest }];
  let t = firstArrive;
  for (let i = 0; i < count; i++) {
    path.push({ t: t - 1000, at: rest }, { t, at: target }, { t: t + holdMs, at: target }, { t: t + holdMs + 1000, at: rest });
    t += holdMs + 1000 + gapMs + 1000;
  }
  return { path, next: t };
}

/** A real bite (index fingertip at the lips) from `at` to `at + holdMs`, as its own hand track. */
function biteTrack(at, holdMs) {
  return {
    side: 'right', pin: 8, angleDeg: -100, ext: { ...PINCH, index: 0.8 }, pinch: true,
    path: [{ t: at - 1000, at: LAP(430) }, { t: at, at: P('mouth', 6, 3) }, { t: at + holdMs, at: P('mouth', 6, 3) }, { t: at + holdMs + 1000, at: LAP(430) }],
  };
}

/** Five visits of one pose, then a bite: the sequence behind the learning scenes. */
function sequence({ id, description, seed, track }) {
  const { path, next } = visits({ rest: track.rest, target: track.target, firstArrive: 2000, holdMs: 4000, count: 5, gapMs: 1600 });
  const biteAt = next + 800;
  const biteHold = 3200;
  const { rest: _rest, target: _target, ...hand } = track;
  return {
    id, description, tags: ['negative', 'ws3', 'learn', 'hard-negative', 'sequence'], seed, durationMs: biteAt + biteHold + 2000,
    hands: [{ ...hand, path }, biteTrack(biteAt, biteHold)],
    labels: [{ behaviors: MOUTH, startMs: biteAt, endMs: biteAt + biteHold }],
  };
}

export const WS3_SCENES = [
  // ── chin rest: the knuckles or the back of the hand on the chin ─────────────────────────
  {
    id: 'neg_chin_rest_fist_under_chin',
    description: 'Resting the chin on the back of a loosely closed right fist for 8 s: the knuckles on the chin, the curled fingers along the jaw.',
    tags: negative('mouth', 'hard-negative', 'chin-rest', 'chin-rest-rule'), seed: 3101, durationMs: 11000,
    knownIssue: 'Drawn to match the chin-rest rule: knuckles on the chin, the nearest fingertip about 0.2 face widths from the lips. The shipped mouth rule fires on it.',
    hands: [{ side: 'right', pin: 9, angleDeg: 180, ext: FIST, wobble: { amp: [1.5, 1], hz: 0.2, from: 2200, to: 9800 },
      path: [{ t: 0, at: LAP(330) }, { t: 1000, at: LAP(330) }, { t: 2200, at: P('chinAnchor', 0, 18) }, { t: 9800, at: P('chinAnchor', 0, 18) }, { t: 11000, at: LAP(330) }] }],
    labels: [],
  },
  {
    id: 'neg_chin_rest_fist_angled',
    description: 'The same rest with the fist turned a little, the head swaying as the person reads, 9 s.',
    tags: negative('mouth', 'hard-negative', 'chin-rest', 'chin-rest-rule'), seed: 3102, durationMs: 12000,
    hands: [{ side: 'right', pin: 9, angleDeg: 160, ext: FIST, jitterPx: 1.2, wobble: { amp: [2, 1.5], hz: 0.25, from: 2200, to: 10200 },
      path: [{ t: 0, at: LAP(320) }, { t: 1000, at: LAP(320) }, { t: 2200, at: P('chinAnchor', 0, 20) }, { t: 10200, at: P('chinAnchor', 0, 20) }, { t: 11400, at: LAP(320) }, { t: 12000, at: LAP(320) }] }],
    headSway: { amp: [5, 3], hz: 0.3 },
    labels: [],
  },
  {
    id: 'neg_chin_rest_fist_left_hand',
    description: 'The same rest on the left fist, 7 s.',
    tags: negative('mouth', 'hard-negative', 'chin-rest', 'chin-rest-rule'), seed: 3103, durationMs: 10000,
    hands: [{ side: 'left', pin: 9, angleDeg: 170, ext: FIST, wobble: { amp: [1.5, 1], hz: 0.2, from: 2000, to: 8200 },
      path: [{ t: 0, at: LAP(310) }, { t: 1000, at: LAP(310) }, { t: 2000, at: P('chinAnchor', -2, 18) }, { t: 8200, at: P('chinAnchor', -2, 18) }, { t: 9400, at: LAP(310) }, { t: 10000, at: LAP(310) }] }],
    labels: [],
  },

  // ── bites with the hand close to the chin: the rule must leave these alone ──────────────
  {
    id: 'mouth_bite_thumb_palm_low',
    description: 'Thumb tip at the lips for 4 s with the other fingers curled and the palm hanging just under the chin.',
    tags: positive('mouth', 'chin-rest-rule', 'hand-near-chin'), seed: 3111, durationMs: 10000,
    hands: [{ side: 'right', pin: 4, angleDeg: -100, ext: { index: 0.45, middle: 0.35, ring: 0.3, pinky: 0.3, thumb: 1 },
      wobble: { amp: [2, 1.5], hz: 0.9, from: 2400, to: 6400 },
      path: [{ t: 0, at: LAP(470) }, { t: 1200, at: LAP(470) }, { t: 2400, at: P('mouth', 6, 3) }, { t: 6400, at: P('mouth', 6, 3) }, { t: 7800, at: LAP(470) }, { t: 10000, at: LAP(470) }] }],
    labels: [{ behaviors: MOUTH, startMs: 2400, endMs: 6400 }],
  },
  {
    id: 'mouth_bite_fist_fingertip_at_lips',
    description: 'A closed fist held up under the mouth, the middle fingertip touching the lips, 3.6 s.',
    tags: positive('mouth', 'chin-rest-rule', 'hand-near-chin'), seed: 3112, durationMs: 9000,
    hands: [{ side: 'right', pin: 12, angleDeg: -110, ext: { ...FIST, middle: 0.5 },
      wobble: { amp: [2, 1.5], hz: 1.0, from: 2200, to: 5800 },
      path: [{ t: 0, at: LAP(380) }, { t: 1000, at: LAP(380) }, { t: 2200, at: P('mouth', 10, 8) }, { t: 5800, at: P('mouth', 10, 8) }, { t: 7000, at: LAP(380) }, { t: 9000, at: LAP(380) }] }],
    labels: [{ behaviors: MOUTH, startMs: 2200, endMs: 5800 }],
  },

  // ── a pose rejected again and again, then a real bite ────────────────────────────────────
  sequence({
    id: 'learn_jaw_rest_x5_then_bite',
    description: 'Five rests with the fingers along the jaw (the older neg_chin_rest pose), 4 s each, then a real bite. In the evaluation the person taps Not a bite after each false alarm.',
    seed: 3201,
    track: { rest: [700, 360], target: P('mouth', 52, 14), side: 'right', pin: 8, angleDeg: 190, ext: { index: 1, middle: 0.95, ring: 0.9, pinky: 0.85, thumb: 0.6 }, wobble: { amp: [1.5, 1], hz: 0.2, from: 0, to: 60000 } },
  }),
  sequence({
    id: 'learn_drinking_x5_then_bite',
    description: 'Five sips from a glass (the older neg_drinking pose), 4 s each, then a real bite.',
    seed: 3202,
    track: { rest: [700, 420], target: P('mouth', 60, 8), side: 'right', pin: 8, angleDeg: 180, ext: { index: 0.7, middle: 0.65, ring: 0.6, pinky: 0.55, thumb: 0.5 }, wobble: { amp: [3, 5], hz: 0.5, from: 0, to: 60000 } },
  }),
];
