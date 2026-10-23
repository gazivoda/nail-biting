import type { DetectionSensitivity } from '../types';
import type { Behavior } from '../storage/eventModel';
import { createEngine } from '../detection/engine.ts';
import type { DetectionControls } from '../detection/controls.ts';
import { getDetectionControls } from '../detection/controlsRegistry.ts';
import {
  FINGERTIP_INDICES as RULE_FINGERTIP_INDICES,
  NAIL_BITING_RULE,
  fingertipContact,
  framesForDwell,
} from '../detection/rules.ts';
import { ZONES, createResolvedZone } from '../detection/zones.ts';
import type { Landmark, LandmarkSource, VideoLike } from '../detection/types.ts';

// The per-frame detection logic, pulled out of useDetection's effect closure so
// it can be exercised without a camera, MediaPipe, or React. Everything the
// detector touches is injected; it has no DOM or module dependencies of its own.
//
// WS1: the counting now lives in src/detection (a ZoneRule per behaviour, one
// engine that runs the ones being monitored). With the default selection, nail
// biting alone, this file behaves exactly as it did before: see
// src/detection/characterization.test.ts and equivalence.test.ts.

export type { Landmark, LandmarkSource, VideoLike };

// Only fingertips count — a wrist or palm drifting past the face shouldn't fire.
// MediaPipe hand landmark indices: 4=thumb, 8=index, 12=middle, 16=ring, 20=pinky
export const FINGERTIP_INDICES = RULE_FINGERTIP_INDICES;

// Consecutive positive frames required before alerting. At 5fps, 3 frames =
// 600ms dwell time — enough to reject brief pass-by false positives.
export const REQUIRED_CONSECUTIVE_FRAMES = framesForDwell(NAIL_BITING_RULE.dwellMs);

// Consecutive negative frames required before calling the episode over.
export { REQUIRED_MISSES_TO_CLEAR } from '../detection/engine.ts';

// Normalised-coordinate distance from the mouth that counts as contact.
export const THRESHOLDS: Record<DetectionSensitivity, number> = NAIL_BITING_RULE.distanceThreshold;

const mouthZone = createResolvedZone();

/** True when any detected fingertip is within `threshold` of the mouth centre. */
export function isFingertipNearMouth(
  hands: Landmark[][],
  faces: Landmark[][],
  threshold: number,
): boolean {
  if (hands.length === 0 || faces.length === 0) return false;
  ZONES.mouth.resolve(faces[0], mouthZone);
  return fingertipContact(NAIL_BITING_RULE.fingerFilter, hands, mouthZone, threshold);
}

export interface BiteDetectorOptions {
  getVideo: () => VideoLike | null;
  getSensitivity: () => DetectionSensitivity;
  source: LandmarkSource;
  /**
   * The behaviours to watch for, read on every frame. Leave it out for nail biting alone,
   * which is the whole of what this detector did before behaviours existed.
   */
  getBehaviors?: () => readonly Behavior[];
  /**
   * The false-alarm controls (WS3). Leave it out and the detector reads the app's registered
   * controls (src/detection/controlsRegistry), which are empty unless the `false_positive_controls`
   * flag is on: so by default this is exactly the detector that has always shipped.
   */
  getControls?: () => DetectionControls | null;
  /** Called on every frame once the dwell threshold is met — dedupe upstream. */
  onBiteStart: (behavior: Behavior) => void;
  /** Called once the episode has cleared. */
  onBiteEnd: () => void;
}

export interface BiteDetector {
  /** Process one frame. `timestampMs` is a monotonic clock for MediaPipe. */
  step(timestampMs: number): void;
}

export function createBiteDetector(options: BiteDetectorOptions): BiteDetector {
  return createEngine({ ...options, getControls: options.getControls ?? getDetectionControls });
}
