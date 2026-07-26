import type { DetectionSensitivity } from '../types';

// The per-frame detection logic, pulled out of useDetection's effect closure so
// it can be exercised without a camera, MediaPipe, or React. Everything the
// detector touches is injected; it has no DOM or module dependencies of its own.

/** Just the shape the geometry needs — MediaPipe's landmarks carry more. */
export interface Landmark {
  x: number;
  y: number;
}

/** Just the shape the readiness check needs — a real HTMLVideoElement fits. */
export interface VideoLike {
  readyState: number;
}

/** MediaPipe's two landmarkers, narrowed to the calls this module makes. */
export interface LandmarkSource {
  detectHands(video: VideoLike, timestampMs: number): Landmark[][];
  detectFace(video: VideoLike, timestampMs: number): Landmark[][];
}

// Only fingertips count — a wrist or palm drifting past the face shouldn't fire.
// MediaPipe hand landmark indices: 4=thumb, 8=index, 12=middle, 16=ring, 20=pinky
export const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

// Consecutive positive frames required before alerting. At 5fps, 3 frames =
// 600ms dwell time — enough to reject brief pass-by false positives.
export const REQUIRED_CONSECUTIVE_FRAMES = 3;

// Consecutive negative frames required before calling the episode over.
export const REQUIRED_MISSES_TO_CLEAR = 2;

// Normalised-coordinate distance from the mouth that counts as contact.
export const THRESHOLDS: Record<DetectionSensitivity, number> = {
  low: 0.18,
  medium: 0.12,
  high: 0.08,
};

// MediaPipe face mesh: 13 and 14 are the inner upper and lower lip centres.
const UPPER_LIP = 13;
const LOWER_LIP = 14;

function dist2d(a: Landmark, b: Landmark) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** True when any detected fingertip is within `threshold` of the mouth centre. */
export function isFingertipNearMouth(
  hands: Landmark[][],
  faces: Landmark[][],
  threshold: number,
): boolean {
  if (hands.length === 0 || faces.length === 0) return false;

  const facePoints = faces[0];
  const mouth = {
    x: (facePoints[UPPER_LIP].x + facePoints[LOWER_LIP].x) / 2,
    y: (facePoints[UPPER_LIP].y + facePoints[LOWER_LIP].y) / 2,
  };

  for (const handPoints of hands) {
    for (const idx of FINGERTIP_INDICES) {
      if (dist2d(handPoints[idx], mouth) < threshold) return true;
    }
  }
  return false;
}

export interface BiteDetectorOptions {
  getVideo: () => VideoLike | null;
  getSensitivity: () => DetectionSensitivity;
  source: LandmarkSource;
  /** Called on every frame once the dwell threshold is met — dedupe upstream. */
  onBiteStart: () => void;
  /** Called once the episode has cleared. */
  onBiteEnd: () => void;
}

export interface BiteDetector {
  /** Process one frame. `timestampMs` is a monotonic clock for MediaPipe. */
  step(timestampMs: number): void;
}

export function createBiteDetector(options: BiteDetectorOptions): BiteDetector {
  const { getVideo, getSensitivity, source, onBiteStart, onBiteEnd } = options;

  let consecutiveHits = 0;
  let missedFrames = 0;

  function registerHit() {
    missedFrames = 0;
    consecutiveHits++;
    if (consecutiveHits >= REQUIRED_CONSECUTIVE_FRAMES) onBiteStart();
  }

  function registerMiss() {
    consecutiveHits = 0;
    missedFrames++;
    if (missedFrames >= REQUIRED_MISSES_TO_CLEAR) {
      onBiteEnd();
      missedFrames = 0;
    }
  }

  return {
    step(timestampMs: number) {
      const video = getVideo();

      // No usable frame — the stream stalled, ended, or another app took the
      // camera. This must count as a miss, not an early return: skipping the
      // accounting would leave an already-firing alarm with no way to stop.
      if (!video || video.readyState < 2) return registerMiss();

      try {
        const hands = source.detectHands(video, timestampMs) ?? [];
        const faces = source.detectFace(video, timestampMs + 0.1) ?? [];
        const threshold = THRESHOLDS[getSensitivity()];

        if (isFingertipNearMouth(hands, faces, threshold)) registerHit();
        else registerMiss();
      } catch {
        // Transient inference error. Also a miss — swallowing it outright would
        // wedge a firing alarm on indefinitely.
        registerMiss();
      }
    },
  };
}
