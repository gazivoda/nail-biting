// What the hand is doing relative to the mouth and chin, as a few numbers (WS3).
//
// This is how the app tells "a fingertip at the lips" from "the back of a fist under the chin" without
// storing any picture of either: six small numbers computed from the landmarks of ONE frame, then
// thrown away unless the person says "Not a bite" about that alarm (src/falsePositive). The numbers
// say nothing about who you are or what the room looks like; the landmarks themselves are never kept.
//
// Units are FACE WIDTHS (the distance between landmarks 234 and 454), so a pose looks the same
// whether you sit close to the camera or far from it. Distances are measured in a frame that is
// corrected for the camera's aspect ratio (x is scaled by width/height): the mouth rule itself
// measures in raw normalised units, these features do not.
//
// Pure, no DOM, no React, no storage, no network. src/detection/** is read under plain Node by the
// evaluation harness.

import type { Landmark } from './types.ts';
import { FACE } from './zones.ts';

/** Which part of the hand is nearest the middle of the mouth. */
export type NearestPart = 'fingertip' | 'finger' | 'knuckle' | 'palm';
export const PART_CODES: readonly NearestPart[] = ['fingertip', 'finger', 'knuckle', 'palm'];

export interface PoseFeatures {
  /** The part of the hand nearest the middle of the mouth. */
  part: NearestPart;
  /** The nearest FINGERTIP to the middle of the mouth, in face widths. */
  tipDist: number;
  /** The nearest knuckle, palm point or wrist to the chin, in face widths. */
  chinDist: number;
  /** The way the hand points (wrist to middle knuckle) relative to the face's own up axis, in 45 degree steps 0 to 7. */
  orient: number;
  /** 0 = fingers straight, 1 = a closed fist. */
  curl: number;
  /** The palm centre against the mouth along the face's own down axis, in face widths: positive = below the mouth. */
  below: number;
}

/**
 * The compact form that is stored locally: [part code, tipDist, chinDist, orient, curl, below], each
 * rounded to two decimals. Six numbers, about 30 bytes.
 */
export type PoseVector = [number, number, number, number, number, number];

// MediaPipe hand landmarks: 0 wrist; thumb 1 to 4; index 5 to 8; middle 9 to 12; ring 13 to 16; pinky 17 to 20.
const TIPS = [4, 8, 12, 16, 20] as const;
const JOINTS = [3, 6, 7, 10, 11, 14, 15, 18, 19] as const; // thumb IP and each finger's two middle joints
const KNUCKLES = [2, 5, 9, 13, 17] as const;               // the base of each finger (thumb MCP included)
const PALM_POINTS = [0, 5, 9, 13, 17] as const;            // wrist and the four finger bases: their mean is the palm centre
const REST_POINTS = [0, 2, 5, 9, 13, 17] as const;         // what rests on a chin: wrist, knuckles (and the palm centre, added in code)
const FINGERS = [[5, 8], [9, 12], [13, 16], [17, 20]] as const; // [base, tip]

const round2 = (v: number) => Math.round(v * 100) / 100;

export function poseToVector(p: PoseFeatures): PoseVector {
  return [PART_CODES.indexOf(p.part), round2(p.tipDist), round2(p.chinDist), p.orient, round2(p.curl), round2(p.below)];
}

/** Whatever was stored, checked: six finite numbers with a valid part code and orientation, or null. */
export function parsePoseVector(x: unknown): PoseVector | null {
  if (!Array.isArray(x) || x.length !== 6 || !x.every(n => typeof n === 'number' && Number.isFinite(n))) return null;
  const [part, tip, chin, orient, curl, below] = x as number[];
  if (!Number.isInteger(part) || part < 0 || part >= PART_CODES.length) return null;
  if (!Number.isInteger(orient) || orient < 0 || orient > 7) return null;
  if (tip < 0 || chin < 0 || tip > 20 || chin > 20) return null;
  return [part, tip, chin, orient, curl, below];
}

export function vectorToPose(v: PoseVector): PoseFeatures {
  return { part: PART_CODES[v[0]], tipDist: v[1], chinDist: v[2], orient: v[3], curl: v[4], below: v[5] };
}

/**
 * Computes the pose of one hand against one face. `aspect` is the video's width over its height
 * (4/3 for the app's 640x480 request). Returns null when the face is degenerate.
 */
export function extractPose(hand: readonly Landmark[], face: readonly Landmark[], aspect = 4 / 3): PoseFeatures | null {
  const ix = (p: Landmark) => p.x * aspect; // isotropic x; y is already in the same unit
  const iy = (p: Landmark) => p.y;
  const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

  const faceWidth = dist(ix(face[FACE.OVAL_SIDE_RIGHT]), iy(face[FACE.OVAL_SIDE_RIGHT]), ix(face[FACE.OVAL_SIDE_LEFT]), iy(face[FACE.OVAL_SIDE_LEFT]));
  if (!(faceWidth > 0)) return null;

  const mx = (ix(face[FACE.INNER_LIP_UPPER]) + ix(face[FACE.INNER_LIP_LOWER])) / 2;
  const my = (iy(face[FACE.INNER_LIP_UPPER]) + iy(face[FACE.INNER_LIP_LOWER])) / 2;
  const cx = (ix(face[FACE.OUTER_LIP_LOWER_BOTTOM]) + ix(face[FACE.OVAL_CHIN])) / 2;
  const cy = (iy(face[FACE.OUTER_LIP_LOWER_BOTTOM]) + iy(face[FACE.OVAL_CHIN])) / 2;

  // Palm centre.
  let px = 0;
  let py = 0;
  for (const k of PALM_POINTS) { px += ix(hand[k]); py += iy(hand[k]); }
  px /= PALM_POINTS.length;
  py /= PALM_POINTS.length;

  const nearest = (points: readonly number[], tx: number, ty: number) => {
    let best = Infinity;
    for (const k of points) {
      const d = dist(ix(hand[k]), iy(hand[k]), tx, ty);
      if (d < best) best = d;
    }
    return best;
  };

  // Which part is nearest the mouth. Ties go to the fingertip, then finger, knuckle, palm.
  const tip = nearest(TIPS, mx, my);
  const joint = nearest(JOINTS, mx, my);
  const knuckle = nearest(KNUCKLES, mx, my);
  const palm = Math.min(dist(px, py, mx, my), dist(ix(hand[0]), iy(hand[0]), mx, my), dist(ix(hand[1]), iy(hand[1]), mx, my));
  let part: NearestPart = 'fingertip';
  let best = tip;
  if (joint < best) { part = 'finger'; best = joint; }
  if (knuckle < best) { part = 'knuckle'; best = knuckle; }
  if (palm < best) { part = 'palm'; best = palm; }

  // What touches the chin: knuckles, wrist and palm centre.
  const chin = Math.min(nearest(REST_POINTS, cx, cy), dist(px, py, cx, cy));

  // The face's own up axis (chin to top of the forehead), so a tilted head is still "up".
  const ux = ix(face[FACE.OVAL_TOP]) - ix(face[FACE.OVAL_CHIN]);
  const uy = iy(face[FACE.OVAL_TOP]) - iy(face[FACE.OVAL_CHIN]);
  const ul = Math.hypot(ux, uy) || 1;
  const nux = ux / ul;
  const nuy = uy / ul;

  // Where the hand points: wrist to the middle finger's base.
  const dx = ix(hand[9]) - ix(hand[0]);
  const dy = iy(hand[9]) - iy(hand[0]);
  const angle = (Math.atan2(nux * dy - nuy * dx, nux * dx + nuy * dy) * 180) / Math.PI; // -180..180, 0 = along "up"
  const orient = (((Math.round(angle / 45) % 8) + 8) % 8);

  // Curl: how far the fingertips are from the wrist, against how far their bases are.
  let ratio = 0;
  for (const [base, tipIndex] of FINGERS) {
    const baseDist = dist(ix(hand[base]), iy(hand[base]), ix(hand[0]), iy(hand[0]));
    const tipDist = dist(ix(hand[tipIndex]), iy(hand[tipIndex]), ix(hand[0]), iy(hand[0]));
    ratio += baseDist > 0 ? tipDist / baseDist : 1;
  }
  ratio /= FINGERS.length;
  const curl = Math.min(1, Math.max(0, 1 - (ratio - 0.9) / 1.1));

  // Palm centre against the mouth, along the face's down axis.
  const below = ((px - mx) * -nux + (py - my) * -nuy) / faceWidth;

  return { part, tipDist: tip / faceWidth, chinDist: chin / faceWidth, orient, curl, below };
}

// ── matching two poses ────────────────────────────────────────────────────────

/**
 * Two poses are "the same pose" when the same part of the hand is nearest the mouth, the hand points
 * in about the same direction, and the distances are close. Plain steps, easy to explain to a person:
 *   fingertip distance to the lips  within 0.12 face widths
 *   knuckle or palm distance to the chin  within 0.15
 *   curl within 0.35, palm height against the mouth within 0.2
 *   direction within one 45 degree step
 */
export const POSE_MATCH = { tip: 0.12, chin: 0.15, curl: 0.35, below: 0.2, orient: 1 } as const;

export function posesMatch(a: PoseVector, b: PoseVector): boolean {
  if (a[0] !== b[0]) return false;
  const turn = Math.abs(a[3] - b[3]);
  if (Math.min(turn, 8 - turn) > POSE_MATCH.orient) return false;
  return Math.abs(a[1] - b[1]) <= POSE_MATCH.tip
    && Math.abs(a[2] - b[2]) <= POSE_MATCH.chin
    && Math.abs(a[4] - b[4]) <= POSE_MATCH.curl
    && Math.abs(a[5] - b[5]) <= POSE_MATCH.below;
}
