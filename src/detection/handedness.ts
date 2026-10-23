// Which hand is which (WS3's hand filter, and the `hand` recorded on an alarm).
//
// MEANING. 'left' and 'right' are the PERSON'S OWN hands, as they see them in the preview, which
// is shown mirrored (the video element is flipped with CSS, so your left hand is on the left of the
// picture). Not "the hand on the left of the raw camera frame".
//
// THE TRAP. MediaPipe assumes it is given a MIRRORED (selfie) image and labels hands on that basis;
// its own documentation says to swap the label if the image is not mirrored. The app gives it the
// raw camera frame (only the on-screen copy is flipped), so MediaPipe's "Left" is the person's RIGHT
// hand and the other way round. One pure function, one constant, one test (handedness.test.ts).
//
// NOT VERIFIED ON A REAL CAMERA. The direction above follows MediaPipe's documentation and could
// not be checked here (the fake camera has no hands). If left and right turn out to be swapped on a
// real device, flip HANDEDNESS_INPUT_IS_MIRRORED and nothing else.

import type { Hand } from '../storage/eventModel.ts';
import { getDetectionControls } from './controlsRegistry.ts';
import type { Landmark } from './types.ts';

/** False: the image given to MediaPipe is the raw camera frame, not a mirrored one. */
export const HANDEDNESS_INPUT_IS_MIRRORED = false;

/** MediaPipe's label ("Left" / "Right") to the person's own hand. */
export function userHandFromLabel(label: string | undefined, inputIsMirrored: boolean = HANDEDNESS_INPUT_IS_MIRRORED): Hand {
  if (label !== 'Left' && label !== 'Right') return 'unknown';
  const labelledLeft = label === 'Left';
  return (inputIsMirrored ? labelledLeft : !labelledLeft) ? 'left' : 'right';
}

/** The hands of a frame, with the side of each riding along as a property of the array. */
export type HandsWithSides = Landmark[][] & { sides?: readonly Hand[] };

export function attachSides(hands: Landmark[][], sides: readonly Hand[]): HandsWithSides {
  const out = hands as HandsWithSides;
  out.sides = sides;
  return out;
}

export function sidesOf(hands: readonly Landmark[][]): readonly Hand[] | undefined {
  return (hands as HandsWithSides).sides;
}

// ── the MediaPipe seam ────────────────────────────────────────────────────────

/** The part of MediaPipe's HandLandmarker this file uses. */
export interface HandModelLike<V> {
  detectForVideo(video: V, timestampMs: number): {
    landmarks?: Landmark[][];
    handedness?: ReadonlyArray<ReadonlyArray<{ categoryName?: string }>>;
  };
  setOptions(options: { numHands: number }): Promise<void> | void;
}

// The app creates the hand model with numHands: 1 (src/hooks/useDetection.ts, getModels).
let configuredHands = 1;

/**
 * The one line useDetection calls in place of `hand.detectForVideo(...).landmarks ?? []`.
 *
 * With no controls registered (the flag off) it is exactly that, and nothing else: no extra call, no
 * property on the array. With controls registered it also (a) attaches the side of each hand, and
 * (b) lets MediaPipe track two hands while the filter is left or right only, because with one tracked
 * hand "left only" would watch nothing whenever the tracker happened to pick the other hand.
 */
export function detectHandsWithSides<V>(model: HandModelLike<V>, video: V, timestampMs: number): Landmark[][] {
  const controls = getDetectionControls();
  if (controls === null) return model.detectForVideo(video, timestampMs).landmarks ?? [];

  const wanted = controls.handFilter === 'both' ? 1 : 2;
  if (wanted !== configuredHands) {
    const previous = configuredHands;
    configuredHands = wanted;
    try {
      const pending = model.setOptions({ numHands: wanted });
      if (pending && typeof pending.catch === 'function') pending.catch(() => { configuredHands = previous; });
    } catch {
      configuredHands = previous;
    }
  }

  const result = model.detectForVideo(video, timestampMs);
  const landmarks = result.landmarks ?? [];
  const labels = result.handedness ?? [];
  return attachSides(landmarks, landmarks.map((_, i) => userHandFromLabel(labels[i]?.[0]?.categoryName)));
}
