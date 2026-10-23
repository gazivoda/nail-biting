// The synthetic scenes behind the committed fixtures. Pure data: positions in pixels of a
// 640x480 frame, times in milliseconds. generate-fixtures.mjs renders them with
// src/detection/synthetic.ts (a neutral face and a stick-model hand) and writes
// fixtures/*.json. Change a scene, run `node scripts/eval-detection/generate-fixtures.mjs`,
// and the fixture and the report change with it.
//
// READ THIS BEFORE TRUSTING A NUMBER. These scenes were written by the person who wrote the
// rules. They show what a rule does when the geometry is what we imagine; they do not show
// how it behaves on a real face in real light. Where a scene says `knownIssue`, the rule is
// expected to be wrong there, and the report says so rather than hiding it.
//
// Hard negatives (things that are NOT the habit but look a bit like it): resting the chin or
// cheek on the hand, scratching the cheek, adjusting glasses, drinking, covering a yawn,
// talking with the hands, brushing hair back, holding a pen with a pinch.

import { facePoint } from '../../src/detection/synthetic.ts';
import { WS3_SCENES } from './scenes-ws3.mjs';

const P = (name, dx = 0, dy = 0) => { const [x, y] = facePoint(name); return [x + dx, y + dy]; };
const LAP = x => [x, 640];              // far below the frame: the hand is not in view
const MOUTH = ['nail_biting', 'cuticle_skin_biting'];

const POINT = { index: 1, middle: 0.3, ring: 0.3, pinky: 0.3, thumb: 0.4 };
const PINKY = { index: 0.3, middle: 0.3, ring: 0.3, pinky: 1, thumb: 0.4 };
const FLAT = { index: 1, middle: 1, ring: 1, pinky: 1, thumb: 1 };
const FIST = { index: 0.3, middle: 0.3, ring: 0.3, pinky: 0.3, thumb: 0.3 };
const PINCH = { index: 0.7, middle: 0.3, ring: 0.3, pinky: 0.3 };

// A hand going to the upper face comes up the SIDE of the head. Drawn straight from the lap, the path
// would cut across the mouth and set off the mouth rule on the way, which is not how people reach for
// an eyebrow or a nostril. `via` are two waypoints on the way up.
const SIDE_LEFT = [[190, 400], [235, 265]];   // up the left of the picture
const SIDE_RIGHT = [[470, 400], [430, 285]];  // up the right of the picture
const SIDE_NOSE = [[450, 400], [400, 290]];   // to the nose from below right, staying clear of the lips

/** Rest at `from`, travel in over 1.3 s via two waypoints, hold at `target`, travel back out the same way. */
function reach({ from, via, target, arrive, leave, end }) {
  const t0 = Math.max(0, arrive - 1300);
  return [
    { t: 0, at: from }, { t: t0, at: from },
    { t: arrive - 850, at: via[0] }, { t: arrive - 450, at: via[1] }, { t: arrive, at: target },
    { t: leave, at: target },
    { t: leave + 450, at: via[1] }, { t: leave + 850, at: via[0] }, { t: leave + 1300, at: from },
    { t: end, at: from },
  ];
}

const positive = (...more) => ['positive', ...more];
const negative = (...more) => ['negative', ...more];

const WS1_SCENES = [
  // ── hand at the mouth: nail biting and cuticle/skin biting (the same rule) ──────────────
  {
    id: 'mouth_bite_steady',
    description: 'Thumb and index held at the lips for 4.6 s, with a little natural wobble.',
    tags: positive('mouth'), seed: 1101, durationMs: 10000,
    hands: [{ side: 'right', pin: 8, angleDeg: -100, ext: { ...PINCH, index: 0.8 }, pinch: true,
      wobble: { amp: [2.5, 2], hz: 1.1, from: 2400, to: 7000 },
      path: [{ t: 0, at: LAP(430) }, { t: 1000, at: LAP(430) }, { t: 2400, at: P('mouth', 8, 3) }, { t: 7000, at: P('mouth', 6, 4) }, { t: 8400, at: LAP(430) }, { t: 10000, at: LAP(430) }] }],
    labels: [{ behaviors: MOUTH, startMs: 2400, endMs: 7000 }],
  },
  {
    id: 'mouth_bite_pulsing',
    description: 'Three separate bites, each about 1.8 s, with the hand dropping away between them.',
    tags: positive('mouth'), seed: 1102, durationMs: 14000,
    hands: [{ side: 'right', pin: 8, angleDeg: -100, ext: { ...PINCH, index: 0.8 }, pinch: true,
      path: [{ t: 0, at: LAP(430) }, { t: 1000, at: LAP(430) }, { t: 2000, at: P('mouth', 6, 3) }, { t: 4000, at: P('mouth', 6, 3) },
        { t: 4800, at: P('mouth', 40, 120) }, { t: 5400, at: P('mouth', 40, 120) }, { t: 6200, at: P('mouth', 6, 3) }, { t: 8000, at: P('mouth', 6, 3) },
        { t: 8800, at: P('mouth', 40, 120) }, { t: 9400, at: P('mouth', 40, 120) }, { t: 10200, at: P('mouth', 6, 3) }, { t: 12000, at: P('mouth', 6, 3) },
        { t: 12800, at: LAP(430) }, { t: 14000, at: LAP(430) }] }],
    labels: [
      { behaviors: MOUTH, startMs: 2000, endMs: 4000 },
      { behaviors: MOUTH, startMs: 6200, endMs: 8000 },
      { behaviors: MOUTH, startMs: 10200, endMs: 12000 },
    ],
  },
  {
    id: 'mouth_bite_left_hand_noisy',
    description: 'Left hand, index fingertip at the lips for 3.8 s, with a noisy tracker (2.2 px) and the head swaying.',
    tags: positive('mouth', 'noisy'), seed: 1103, durationMs: 11000,
    hands: [{ side: 'left', pin: 8, angleDeg: -80, ext: { ...POINT, index: 0.9 }, jitterPx: 2.2,
      path: [{ t: 0, at: LAP(250) }, { t: 1500, at: LAP(250) }, { t: 3000, at: P('mouth', -6, 4) }, { t: 6800, at: P('mouth', -6, 4) }, { t: 8200, at: LAP(250) }, { t: 11000, at: LAP(250) }] }],
    headSway: { amp: [5, 4], hz: 0.35 },
    labels: [{ behaviors: MOUTH, startMs: 3000, endMs: 6800 }],
  },
  {
    id: 'mouth_bite_two_hands',
    description: 'Right index at the lips from 2.2 s to 6 s; the left hand comes up beside the mouth for the last 2 s of it.',
    tags: positive('mouth', 'two-hands'), seed: 1104, durationMs: 10000,
    hands: [
      { side: 'right', pin: 8, angleDeg: -100, ext: { ...PINCH, index: 0.8 }, pinch: true,
        path: [{ t: 0, at: LAP(430) }, { t: 1000, at: LAP(430) }, { t: 2200, at: P('mouth', 6, 3) }, { t: 6000, at: P('mouth', 6, 3) }, { t: 7400, at: LAP(430) }, { t: 10000, at: LAP(430) }] },
      { side: 'left', pin: 12, angleDeg: -80, ext: { ...POINT, index: 0.4, middle: 0.9 },
        path: [{ t: 0, at: LAP(200) }, { t: 3600, at: LAP(200) }, { t: 4600, at: P('mouth', -48, 6) }, { t: 6000, at: P('mouth', -48, 6) }, { t: 7000, at: LAP(200) }, { t: 10000, at: LAP(200) }] },
    ],
    labels: [{ behaviors: MOUTH, startMs: 2200, endMs: 6000 }],
  },
  {
    id: 'cuticle_thumb_to_mouth',
    description: 'Thumb tip at the lips with the fingers curled, held for 4 s (biting at the skin beside the thumbnail).',
    tags: positive('mouth', 'cuticle'), seed: 1105, durationMs: 10000,
    hands: [{ side: 'right', pin: 4, angleDeg: -70, ext: { index: 0.45, middle: 0.35, ring: 0.3, pinky: 0.3, thumb: 1 },
      wobble: { amp: [2, 2], hz: 0.9, from: 2400, to: 6400 },
      path: [{ t: 0, at: LAP(470) }, { t: 1200, at: LAP(470) }, { t: 2400, at: P('mouth', 7, 2) }, { t: 6400, at: P('mouth', 7, 2) }, { t: 7800, at: LAP(470) }, { t: 10000, at: LAP(470) }] }],
    labels: [{ behaviors: MOUTH, startMs: 2400, endMs: 6400 }],
  },

  // hard negatives for the mouth rules
  {
    id: 'neg_pass_by_face',
    description: 'A hand sweeps across in front of the face and out of the other side in about a second.',
    tags: negative('mouth', 'brief'), seed: 1111, durationMs: 8000,
    hands: [{ side: 'right', pin: 8, angleDeg: 180, ext: POINT,
      path: [{ t: 0, at: [700, 300] }, { t: 1800, at: [700, 300] }, { t: 2800, at: [-60, 300] }, { t: 8000, at: [-60, 300] }] }],
    labels: [],
  },
  {
    id: 'neg_talking_with_hands',
    description: 'Both hands gesture in front of the chest for 12 s, now and then rising briefly towards the chin.',
    tags: negative('mouth', 'hard-negative', 'talking'), seed: 1112, durationMs: 12000,
    hands: [
      { side: 'right', pin: 8, angleDeg: 190, ext: POINT, path: [
        { t: 0, at: [500, 360] }, { t: 1500, at: [440, 340] }, { t: 3000, at: [520, 385] }, { t: 4200, at: [345, 352] },
        { t: 6000, at: [510, 370] }, { t: 8000, at: [440, 345] }, { t: 9200, at: [440, 345] }, { t: 9500, at: [345, 350] }, { t: 9800, at: [440, 345] }, { t: 11000, at: [500, 380] }, { t: 12000, at: [500, 360] }] },
      { side: 'left', pin: 8, angleDeg: -10, ext: POINT, path: [
        { t: 0, at: [180, 380] }, { t: 2000, at: [240, 350] }, { t: 4000, at: [160, 400] }, { t: 6500, at: [250, 355] }, { t: 8500, at: [170, 390] }, { t: 10500, at: [235, 350] }, { t: 12000, at: [180, 380] }] },
    ],
    labels: [],
  },
  {
    id: 'neg_chin_rest',
    description: 'Resting the cheek and chin on the fingers for 8 s: fingertips along the jaw, 0.09 from the mouth.',
    tags: negative('mouth', 'hard-negative', 'chin-rest'), seed: 1113, durationMs: 11000,
    knownIssue: 'The mouth rule reaches 0.12 of the frame from the lips, so fingertips resting on the jaw are inside it. This is the false alarm the site warns about; WS3 (chin-rest rule) is meant to remove it.',
    hands: [{ side: 'right', pin: 8, angleDeg: 190, ext: { index: 1, middle: 0.95, ring: 0.9, pinky: 0.85, thumb: 0.6 },
      wobble: { amp: [1.5, 1], hz: 0.2, from: 1500, to: 9500 },
      path: [{ t: 0, at: [700, 360] }, { t: 1000, at: [700, 360] }, { t: 2200, at: P('mouth', 52, 14) }, { t: 9800, at: P('mouth', 52, 14) }, { t: 11000, at: [700, 360] }] }],
    labels: [],
  },
  {
    id: 'neg_drinking',
    description: 'Taking a drink: a glass at the lips for 3.5 s with the fingertips wrapped around it, 0.1 from the mouth.',
    tags: negative('mouth', 'hard-negative', 'drinking'), seed: 1114, durationMs: 9000,
    knownIssue: 'Fingertips around a glass are inside the mouth rule\'s reach. Nothing in the landmarks says "glass".',
    hands: [{ side: 'right', pin: 8, angleDeg: 180, ext: { index: 0.7, middle: 0.65, ring: 0.6, pinky: 0.55, thumb: 0.5 },
      wobble: { amp: [3, 5], hz: 0.5, from: 2400, to: 5900 },
      path: [{ t: 0, at: [700, 420] }, { t: 1000, at: [700, 420] }, { t: 2400, at: P('mouth', 60, 8) }, { t: 5900, at: P('mouth', 60, 8) }, { t: 7200, at: [700, 420] }, { t: 9000, at: [700, 420] }] }],
    labels: [],
  },
  {
    id: 'neg_yawn_cover_mouth',
    description: 'Covering a yawn: the hand flat across the mouth for 1.8 s.',
    tags: negative('mouth', 'hard-negative', 'yawn'), seed: 1115, durationMs: 8000,
    knownIssue: 'A hand over the mouth has fingertips on the lips. The rule cannot tell a yawn from the habit.',
    hands: [{ side: 'right', pin: 12, angleDeg: 175, ext: FLAT,
      path: [{ t: 0, at: [700, 380] }, { t: 1400, at: [700, 380] }, { t: 2400, at: P('mouth', -8, 0) }, { t: 4200, at: P('mouth', -8, 0) }, { t: 5200, at: [700, 380] }, { t: 8000, at: [700, 380] }] }],
    labels: [],
  },
  {
    id: 'neg_scratch_cheek',
    description: 'Scratching the cheek for 1.2 s, then away.',
    tags: negative('mouth', 'face-skin', 'hard-negative', 'scratching'), seed: 1116, durationMs: 8000,
    knownIssue: 'The cheek is just inside the mouth rule\'s reach at medium and low sensitivity.',
    hands: [{ side: 'right', pin: 8, angleDeg: -60, ext: POINT,
      wobble: { amp: [14, 10], hz: 2, from: 2400, to: 3600 },
      path: [{ t: 0, at: [150, 640] }, { t: 1200, at: [150, 640] }, { t: 2400, at: P('cheekRight') }, { t: 3600, at: P('cheekRight') }, { t: 4800, at: [150, 640] }, { t: 8000, at: [150, 640] }] }],
    labels: [],
  },
  {
    id: 'neg_idle_no_hands',
    description: 'Sitting still, head swaying a little, no hands in view for 10 s.',
    tags: negative('idle'), seed: 1117, durationMs: 10000,
    hands: [], headSway: { amp: [6, 5], hz: 0.3 }, labels: [],
  },
  {
    id: 'neg_no_face_hand_up',
    description: 'The face is out of view for 6 s while a hand is held where the mouth would be.',
    tags: negative('mouth', 'no-face'), seed: 1118, durationMs: 6000,
    noFace: [[0, 6000]],
    hands: [{ side: 'right', pin: 8, angleDeg: -100, ext: POINT,
      path: [{ t: 0, at: P('mouth', 6, 3) }, { t: 6000, at: P('mouth', 6, 3) }] }],
    labels: [],
  },

  // ── nose picking ──────────────────────────────────────────────────────────────────────
  {
    id: 'nose_pick_index',
    description: 'Index fingertip at the nostril for 4.4 s with small movements.',
    tags: positive('nose'), seed: 1201, durationMs: 10000,
    hands: [{ side: 'right', pin: 8, angleDeg: -95, ext: POINT,
      wobble: { amp: [2.5, 2], hz: 1.2, from: 2200, to: 6600 },
      path: reach({ from: LAP(400), via: SIDE_NOSE, target: P('noseBase', 0, 1), arrive: 2200, leave: 6600, end: 10000 }) }],
    labels: [{ behaviors: ['nose_picking'], startMs: 2200, endMs: 6600 }],
  },
  {
    id: 'nose_pick_pinky',
    description: 'Little fingertip at the nostril for 3.4 s.',
    tags: positive('nose'), seed: 1202, durationMs: 9000,
    hands: [{ side: 'right', pin: 20, angleDeg: -95, ext: PINKY,
      wobble: { amp: [2, 1.5], hz: 1.0, from: 2200, to: 5600 },
      path: reach({ from: LAP(400), via: SIDE_NOSE, target: P('noseBase', 3, 0), arrive: 2200, leave: 5600, end: 9000 }) }],
    labels: [{ behaviors: ['nose_picking'], startMs: 2200, endMs: 5600 }],
  },
  {
    id: 'neg_nose_scratch_brief',
    description: 'A quick scratch at the side of the nose, 0.8 s.',
    tags: negative('nose', 'brief', 'hard-negative', 'scratching'), seed: 1203, durationMs: 8000,
    knownIssue: 'A fingertip at the nostril is about 0.05 from the lips, well inside the mouth rule\'s reach, so nail biting alarms after 0.6 s. The nose rule\'s longer dwell (1.6 s) correctly ignores it.',
    hands: [{ side: 'right', pin: 8, angleDeg: -95, ext: POINT,
      path: reach({ from: LAP(400), via: SIDE_NOSE, target: P('noseBase', 10, 2), arrive: 2200, leave: 3000, end: 8000 }) }],
    labels: [],
  },

  // ── eyelash and eyebrow pulling ───────────────────────────────────────────────────────
  {
    id: 'eye_pull_brow',
    description: 'Thumb and index pinched at the eyebrow for 3.6 s, drawing slightly outward.',
    tags: positive('eye'), seed: 1301, durationMs: 10000,
    hands: [{ side: 'right', pin: 8, angleDeg: -60, ext: PINCH, pinch: true,
      wobble: { amp: [3, 4], hz: 0.9, from: 2400, to: 6000 },
      path: reach({ from: [150, 640], via: SIDE_LEFT, target: P('browRight', 0, 2), arrive: 2400, leave: 6000, end: 10000 }) }],
    labels: [{ behaviors: ['eye_area_pulling'], startMs: 2400, endMs: 6000 }],
  },
  {
    id: 'eye_pull_lash',
    description: 'Thumb and index pinched at the upper lid line for 2.6 s.',
    tags: positive('eye'), seed: 1302, durationMs: 9000,
    hands: [{ side: 'right', pin: 8, angleDeg: -120, ext: PINCH, pinch: true,
      wobble: { amp: [1.5, 2.5], hz: 0.8, from: 2200, to: 4800 },
      path: reach({ from: [500, 640], via: SIDE_RIGHT, target: P('eyeLeft', 2, -7), arrive: 2200, leave: 4800, end: 9000 }) }],
    labels: [{ behaviors: ['eye_area_pulling'], startMs: 2200, endMs: 4800 }],
  },
  {
    id: 'neg_adjust_glasses',
    description: 'Pinching the frame of a pair of glasses at the temple for 1 s.',
    tags: negative('eye', 'hard-negative', 'glasses', 'brief'), seed: 1311, durationMs: 8000,
    hands: [{ side: 'right', pin: 8, angleDeg: -60, ext: PINCH, pinch: true,
      path: reach({ from: [150, 640], via: SIDE_LEFT, target: P('eyeRight', -22, -2), arrive: 2400, leave: 3400, end: 8000 }) }],
    labels: [],
  },
  {
    id: 'neg_adjust_glasses_long',
    description: 'Holding the glasses frame at the temple for 2.6 s (pushing them up while reading).',
    tags: negative('eye', 'hard-negative', 'glasses'), seed: 1312, durationMs: 9000,
    knownIssue: 'A pinch held at the temple for longer than the dwell looks the same as a pinch at the brow. Only a longer dwell or a real-footage threshold can separate them.',
    hands: [{ side: 'right', pin: 8, angleDeg: -60, ext: PINCH, pinch: true,
      path: reach({ from: [150, 640], via: SIDE_LEFT, target: P('eyeRight', -22, -2), arrive: 2400, leave: 5000, end: 9000 }) }],
    labels: [],
  },
  {
    id: 'neg_eye_rub_brief',
    description: 'Rubbing an eye with a loose fist for 1.2 s.',
    tags: negative('eye', 'hard-negative', 'brief'), seed: 1313, durationMs: 8000,
    knownIssue: 'With the index at the eye, the curled little finger of the fist sits about 0.07 from the lips, inside the mouth rule\'s reach, so nail biting alarms. The eye rule ignores it (no pinch, and 1.2 s is under its dwell).',
    hands: [{ side: 'right', pin: 8, angleDeg: -120, ext: FIST,
      wobble: { amp: [4, 3], hz: 1.5, from: 2200, to: 3400 },
      path: reach({ from: [500, 640], via: SIDE_RIGHT, target: P('eyeLeft'), arrive: 2200, leave: 3400, end: 8000 }) }],
    labels: [],
  },

  // ── face skin picking ─────────────────────────────────────────────────────────────────
  {
    id: 'skin_pick_cheek',
    description: 'Index fingertip working at the cheek for 5.2 s.',
    tags: positive('face-skin'), seed: 1401, durationMs: 11000,
    hands: [{ side: 'right', pin: 8, angleDeg: -60, ext: POINT,
      wobble: { amp: [10, 8], hz: 1.3, from: 2400, to: 7600 },
      path: [{ t: 0, at: [150, 640] }, { t: 1200, at: [150, 640] }, { t: 2400, at: P('cheekRight') }, { t: 7600, at: P('cheekRight') }, { t: 8800, at: [150, 640] }, { t: 11000, at: [150, 640] }] }],
    labels: [{ behaviors: ['face_skin_picking'], startMs: 2400, endMs: 7600 }],
  },
  {
    id: 'skin_pick_chin',
    description: 'Index fingertip working at the chin for 4.4 s.',
    tags: positive('face-skin'), seed: 1402, durationMs: 10000,
    hands: [{ side: 'right', pin: 8, angleDeg: -75, ext: POINT,
      wobble: { amp: [8, 6], hz: 1.5, from: 2200, to: 6600 },
      path: [{ t: 0, at: LAP(400) }, { t: 1000, at: LAP(400) }, { t: 2200, at: P('chinAnchor') }, { t: 6600, at: P('chinAnchor') }, { t: 7800, at: LAP(400) }, { t: 10000, at: LAP(400) }] }],
    labels: [{ behaviors: ['face_skin_picking'], startMs: 2200, endMs: 6600 }],
  },
  {
    id: 'skin_pick_forehead',
    description: 'Index fingertip working at the forehead for 4 s.',
    tags: positive('face-skin'), seed: 1403, durationMs: 10000,
    hands: [{ side: 'right', pin: 8, angleDeg: -60, ext: POINT,
      wobble: { amp: [9, 6], hz: 1.1, from: 2200, to: 6200 },
      path: reach({ from: [150, 640], via: SIDE_LEFT, target: P('foreheadAnchor'), arrive: 2200, leave: 6200, end: 10000 }) }],
    labels: [{ behaviors: ['face_skin_picking'], startMs: 2200, endMs: 6200 }],
  },
  {
    id: 'neg_cheek_rest_thinking',
    description: 'Resting the cheek on the hand while thinking, perfectly still for 9.5 s.',
    tags: negative('face-skin', 'mouth', 'hard-negative', 'chin-rest'), seed: 1411, durationMs: 12000,
    knownIssue: 'Like the chin rest, the fingertips are inside the mouth rule\'s reach (not the skin-picking rule: nothing moves).',
    hands: [{ side: 'right', pin: 8, angleDeg: -60, ext: POINT, jitterPx: 1.0,
      path: [{ t: 0, at: [150, 640] }, { t: 1000, at: [150, 640] }, { t: 1500, at: P('cheekRight', 12, 4) }, { t: 11000, at: P('cheekRight', 12, 4) }, { t: 12000, at: [150, 640] }] }],
    labels: [],
  },

  // ── hair pulling ──────────────────────────────────────────────────────────────────────
  {
    id: 'hair_pull_top',
    description: 'Thumb and index pinched at the top of the head for 3.6 s, tugging.',
    tags: positive('hair'), seed: 1501, durationMs: 10000,
    hands: [{ side: 'right', pin: 8, angleDeg: 150, ext: PINCH, pinch: [[2600, 6200]],
      wobble: { amp: [3, 5], hz: 1.0, from: 2600, to: 6200 },
      path: [{ t: 0, at: [800, 400] }, { t: 1000, at: [800, 400] }, { t: 1800, at: [470, 150] }, { t: 2600, at: P('scalpTop') }, { t: 6200, at: P('scalpTop') }, { t: 7600, at: [800, 400] }, { t: 10000, at: [800, 400] }] }],
    labels: [{ behaviors: ['hair_pulling'], startMs: 2600, endMs: 6200 }],
  },
  {
    id: 'hair_pull_side',
    description: 'Pinch at the upper side of the head for 2.8 s.',
    tags: positive('hair'), seed: 1502, durationMs: 9000,
    hands: [{ side: 'right', pin: 8, angleDeg: 160, ext: PINCH, pinch: [[2400, 5200]],
      wobble: { amp: [2, 4], hz: 0.9, from: 2400, to: 5200 },
      path: [{ t: 0, at: [800, 380] }, { t: 1000, at: [800, 380] }, { t: 1700, at: [520, 160] }, { t: 2400, at: P('scalpLeft') }, { t: 5200, at: P('scalpLeft') }, { t: 6600, at: [800, 380] }, { t: 9000, at: [800, 380] }] }],
    labels: [{ behaviors: ['hair_pulling'], startMs: 2400, endMs: 5200 }],
  },
  {
    id: 'neg_hair_brush_back',
    description: 'Brushing the hair back with an open hand, about 1 s.',
    tags: negative('hair', 'hard-negative', 'brief'), seed: 1511, durationMs: 7000,
    hands: [{ side: 'right', pin: 8, angleDeg: 150, ext: FLAT,
      path: [{ t: 0, at: [800, 400] }, { t: 1600, at: [800, 400] }, { t: 2400, at: [400, 130] }, { t: 3400, at: [300, 60] }, { t: 4600, at: [800, 400] }, { t: 7000, at: [800, 400] }] }],
    labels: [],
  },
  {
    id: 'neg_head_scratch',
    description: 'Scratching the top of the head with spread fingers for 3.4 s.',
    tags: negative('hair', 'hard-negative', 'scratching'), seed: 1512, durationMs: 9000,
    hands: [{ side: 'right', pin: 8, angleDeg: 150, ext: FLAT,
      wobble: { amp: [14, 8], hz: 2.4, from: 2200, to: 5600 },
      path: [{ t: 0, at: [800, 400] }, { t: 1000, at: [800, 400] }, { t: 1800, at: [470, 150] }, { t: 2200, at: P('scalpTop') }, { t: 5600, at: P('scalpTop') }, { t: 6800, at: [800, 400] }, { t: 9000, at: [800, 400] }] }],
    labels: [],
  },
  {
    id: 'neg_pinch_in_front_of_chest',
    description: 'A pinch held in front of the chest for 4 s (holding a pen, or an OK sign).',
    tags: negative('pinch', 'hard-negative'), seed: 1513, durationMs: 9000,
    hands: [{ side: 'right', pin: 8, angleDeg: 180, ext: PINCH, pinch: true,
      path: [{ t: 0, at: [800, 400] }, { t: 1000, at: [800, 400] }, { t: 2000, at: [400, 400] }, { t: 6000, at: [400, 400] }, { t: 7000, at: [800, 400] }, { t: 9000, at: [800, 400] }] }],
    labels: [],
  },
];

// WS1's scenes first (their fixtures must not change), then WS3's (scenes-ws3.mjs).
export const SCENES = [...WS1_SCENES, ...WS3_SCENES];
