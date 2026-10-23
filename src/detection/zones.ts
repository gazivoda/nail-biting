// Face zones: where on the face a fingertip counts as "at" a behaviour's target,
// worked out from the MediaPipe face mesh (478 landmarks) one frame at a time.
//
// A zone is a handful of anchor points plus a unit. A rule says "within
// `distanceThreshold` units of any anchor", so zones scale with the size of the
// face and with head tilt for free, and a frame costs a few subtractions.
//
// UNITS. The mouth zone is in normalised image coordinates (unit = 1) because
// that is what the shipped nail-biting rule has always used (0.18 / 0.12 / 0.08
// by sensitivity) and it must not change. Every other zone is in face sizes:
// the face width (landmarks 234 to 454) or, for the scalp, the face height
// (10 to 152). Distances are measured in normalised x/y, so on a 16:9 camera a
// "circle" is an ellipse; that is true of the mouth rule today as well.
//
// WHERE THE INDICES COME FROM. @mediapipe/tasks-vision ships the connection
// sets FaceLandmarker.FACE_LANDMARKS_LIPS / _LEFT_EYE / _RIGHT_EYE /
// _LEFT_EYEBROW / _RIGHT_EYEBROW / _FACE_OVAL. Every index marked "set" below
// was read out of those sets (docs/agents/ws1-notes.md shows how to dump them),
// so the meaning is MediaPipe's own, not recalled from memory. "Right" and
// "left" are MediaPipe's names for the subject's right and left; in an
// un-mirrored camera frame the subject's right is on the image's left.
// Indices marked NEEDS HUMAN VERIFICATION are not in those sets (the library
// exports no nose set) and were not checked against a rendered mesh.

import type { Landmark } from './types.ts';

export const FACE = {
  // Lips (set LIPS). 13 and 14 are the centres of the inner upper and lower lip,
  // i.e. the middle of the mouth opening. 17 is the bottom centre of the outer
  // lower lip. 0 (outer upper lip, top centre) and 61/291 (mouth corners) are listed
  // for the fixtures and the notes; the rules use 13, 14 and 17.
  INNER_LIP_UPPER: 13,
  INNER_LIP_LOWER: 14,
  OUTER_LIP_LOWER_BOTTOM: 17,

  // Face oval (set FACE_OVAL). 10 is the top of the forehead on the midline and
  // 152 the bottom of the chin. 234 and 454 are the widest points of the oval,
  // level with the ears (right and left); their distance is "face width".
  OVAL_TOP: 10,
  OVAL_CHIN: 152,
  OVAL_SIDE_RIGHT: 234,
  OVAL_SIDE_LEFT: 454,

  // Eyes (sets RIGHT_EYE / LEFT_EYE). Outer and inner corners, and a point on
  // the middle of the lower lid.
  EYE_RIGHT_OUTER: 33,
  EYE_RIGHT_INNER: 133,
  EYE_RIGHT_LOWER_LID: 145,
  EYE_LEFT_INNER: 362,
  EYE_LEFT_OUTER: 263,
  EYE_LEFT_LOWER_LID: 374,

  // Eyebrows (sets RIGHT_EYEBROW / LEFT_EYEBROW). 105 / 334 are on the middle of
  // each brow's lower row; 107 / 336 are the inner ends, nearest the nose.
  BROW_RIGHT_MID: 105,
  BROW_LEFT_MID: 334,
  BROW_RIGHT_INNER: 107,
  BROW_LEFT_INNER: 336,

  // Mouth corners (set LIPS), on the same side as the matching eye corner.
  MOUTH_CORNER_RIGHT: 61,
  MOUTH_CORNER_LEFT: 291,

  // Nose. NEEDS HUMAN VERIFICATION: not in any exported set. 1 is the tip of
  // the nose (the same index head-pose code uses for "nose tip"); 2 is the
  // point just under it, at the base of the nose between the nostrils.
  NOSE_TIP: 1,
  NOSE_BASE: 2,
} as const;

export type ZoneId = 'mouth' | 'nose' | 'eye_area' | 'face_skin' | 'scalp';

/** Up to this many anchors per zone. */
export const MAX_ANCHORS = 4;

/** A zone resolved for one face in one frame. Reused between frames: no allocation per frame. */
export interface ResolvedZone {
  count: number;
  x: number[];
  y: number[];
  /** Multiplies the rule's distance threshold to give normalised image distance. 1 for the mouth. */
  unit: number;
}

export function createResolvedZone(): ResolvedZone {
  return { count: 0, x: new Array<number>(MAX_ANCHORS).fill(0), y: new Array<number>(MAX_ANCHORS).fill(0), unit: 1 };
}

type Resolver = (face: readonly Landmark[], out: ResolvedZone) => void;

export interface ZoneDefinition {
  /** What the zone is, in words. */
  description: string;
  /** Every face-mesh index the resolver reads. Fixtures must carry all of them. */
  landmarks: readonly number[];
  resolve: Resolver;
}

const dist = (a: Landmark, b: Landmark) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

function faceWidth(face: readonly Landmark[]): number {
  return dist(face[FACE.OVAL_SIDE_RIGHT], face[FACE.OVAL_SIDE_LEFT]);
}

function faceHeight(face: readonly Landmark[]): number {
  return dist(face[FACE.OVAL_TOP], face[FACE.OVAL_CHIN]);
}

function set(out: ResolvedZone, i: number, x: number, y: number) {
  out.x[i] = x;
  out.y[i] = y;
}

export const ZONES: Record<ZoneId, ZoneDefinition> = {
  mouth: {
    description: 'The middle of the mouth opening: the midpoint of the inner lip centres (13 and 14). In normalised image units.',
    landmarks: [FACE.INNER_LIP_UPPER, FACE.INNER_LIP_LOWER],
    resolve(face, out) {
      // Written exactly as the shipped detector wrote it (src/hooks/biteDetector.ts at cec2120).
      out.count = 1;
      out.unit = 1;
      out.x[0] = (face[FACE.INNER_LIP_UPPER].x + face[FACE.INNER_LIP_LOWER].x) / 2;
      out.y[0] = (face[FACE.INNER_LIP_UPPER].y + face[FACE.INNER_LIP_LOWER].y) / 2;
    },
  },

  nose: {
    description: 'The nostril area: the midpoint between the nose tip (1) and the base of the nose (2). Unit: face width.',
    landmarks: [FACE.NOSE_TIP, FACE.NOSE_BASE, FACE.OVAL_SIDE_RIGHT, FACE.OVAL_SIDE_LEFT],
    resolve(face, out) {
      out.count = 1;
      out.unit = faceWidth(face);
      set(out, 0, (face[FACE.NOSE_TIP].x + face[FACE.NOSE_BASE].x) / 2, (face[FACE.NOSE_TIP].y + face[FACE.NOSE_BASE].y) / 2);
    },
  },

  eye_area: {
    description: 'Both eyes and both eyebrows: four anchors, the middle of each eye (between its corners) and the middle of each brow. Unit: face width.',
    landmarks: [
      FACE.EYE_RIGHT_OUTER, FACE.EYE_RIGHT_INNER, FACE.EYE_LEFT_INNER, FACE.EYE_LEFT_OUTER,
      FACE.BROW_RIGHT_MID, FACE.BROW_LEFT_MID, FACE.OVAL_SIDE_RIGHT, FACE.OVAL_SIDE_LEFT,
    ],
    resolve(face, out) {
      out.count = 4;
      out.unit = faceWidth(face);
      set(out, 0, (face[FACE.EYE_RIGHT_OUTER].x + face[FACE.EYE_RIGHT_INNER].x) / 2, (face[FACE.EYE_RIGHT_OUTER].y + face[FACE.EYE_RIGHT_INNER].y) / 2);
      set(out, 1, (face[FACE.EYE_LEFT_OUTER].x + face[FACE.EYE_LEFT_INNER].x) / 2, (face[FACE.EYE_LEFT_OUTER].y + face[FACE.EYE_LEFT_INNER].y) / 2);
      set(out, 2, face[FACE.BROW_RIGHT_MID].x, face[FACE.BROW_RIGHT_MID].y);
      set(out, 3, face[FACE.BROW_LEFT_MID].x, face[FACE.BROW_LEFT_MID].y);
    },
  },

  face_skin: {
    description:
      'Cheeks, chin and forehead: four anchors. Each cheek is the centre of the triangle (lower eyelid, mouth corner, widest point of the face oval); '
      + 'the chin is halfway between the lower lip (17) and the bottom of the chin (152); the forehead is halfway between the top of the face oval (10) and the inner brow ends. Unit: face width.',
    landmarks: [
      FACE.EYE_RIGHT_LOWER_LID, FACE.MOUTH_CORNER_RIGHT, FACE.OVAL_SIDE_RIGHT,
      FACE.EYE_LEFT_LOWER_LID, FACE.MOUTH_CORNER_LEFT, FACE.OVAL_SIDE_LEFT,
      FACE.OUTER_LIP_LOWER_BOTTOM, FACE.OVAL_CHIN,
      FACE.OVAL_TOP, FACE.BROW_RIGHT_INNER, FACE.BROW_LEFT_INNER,
    ],
    resolve(face, out) {
      out.count = 4;
      out.unit = faceWidth(face);
      const r = [face[FACE.EYE_RIGHT_LOWER_LID], face[FACE.MOUTH_CORNER_RIGHT], face[FACE.OVAL_SIDE_RIGHT]];
      const l = [face[FACE.EYE_LEFT_LOWER_LID], face[FACE.MOUTH_CORNER_LEFT], face[FACE.OVAL_SIDE_LEFT]];
      set(out, 0, (r[0].x + r[1].x + r[2].x) / 3, (r[0].y + r[1].y + r[2].y) / 3);
      set(out, 1, (l[0].x + l[1].x + l[2].x) / 3, (l[0].y + l[1].y + l[2].y) / 3);
      set(out, 2, (face[FACE.OUTER_LIP_LOWER_BOTTOM].x + face[FACE.OVAL_CHIN].x) / 2, (face[FACE.OUTER_LIP_LOWER_BOTTOM].y + face[FACE.OVAL_CHIN].y) / 2);
      const browX = (face[FACE.BROW_RIGHT_INNER].x + face[FACE.BROW_LEFT_INNER].x) / 2;
      const browY = (face[FACE.BROW_RIGHT_INNER].y + face[FACE.BROW_LEFT_INNER].y) / 2;
      set(out, 3, (face[FACE.OVAL_TOP].x + browX) / 2, (face[FACE.OVAL_TOP].y + browY) / 2);
    },
  },

  scalp: {
    description:
      'The hair above the forehead, ESTIMATED: the face mesh stops at the top of the forehead, so three anchors are placed above landmark 10 along the chin-to-forehead axis '
      + '(one centred, two towards the sides). Needs the camera framed high enough to see the top of the head. Unit: face height (10 to 152).',
    landmarks: [FACE.OVAL_TOP, FACE.OVAL_CHIN, FACE.OVAL_SIDE_RIGHT, FACE.OVAL_SIDE_LEFT],
    resolve(face, out) {
      const top = face[FACE.OVAL_TOP];
      const chin = face[FACE.OVAL_CHIN];
      const h = faceHeight(face);
      const w = faceWidth(face);
      out.count = 3;
      out.unit = h;
      if (h === 0) { set(out, 0, top.x, top.y); set(out, 1, top.x, top.y); set(out, 2, top.x, top.y); return; }
      const ux = (top.x - chin.x) / h; // unit vector from the chin to the top of the head
      const uy = (top.y - chin.y) / h;
      const vx = -uy;                  // its perpendicular, across the head
      const vy = ux;
      set(out, 0, top.x + 0.35 * h * ux, top.y + 0.35 * h * uy);
      set(out, 1, top.x + 0.22 * h * ux + 0.32 * w * vx, top.y + 0.22 * h * uy + 0.32 * w * vy);
      set(out, 2, top.x + 0.22 * h * ux - 0.32 * w * vx, top.y + 0.22 * h * uy - 0.32 * w * vy);
    },
  },
};

/** Every face-mesh index any zone reads, sorted. A fixture's `faceIndices` must include all of them. */
export const FACE_LANDMARKS_USED: readonly number[] = [...new Set(Object.values(ZONES).flatMap(z => z.landmarks))].sort((a, b) => a - b);
