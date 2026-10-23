// The few shapes the detection modules agree on. Types only: nothing here runs.
//
// src/detection/** must stay free of DOM, React, the app store and import.meta,
// because scripts/eval-detection runs these same files under plain Node (type
// stripping). Relative imports between them therefore carry an explicit ".ts".

/** Just the shape the geometry needs; MediaPipe's landmarks carry more. */
export interface Landmark {
  x: number;
  y: number;
}

/** Just the shape the readiness check needs; a real HTMLVideoElement fits. */
export interface VideoLike {
  readyState: number;
}

/** MediaPipe's two landmarkers, narrowed to the calls the detector makes. */
export interface LandmarkSource {
  detectHands(video: VideoLike, timestampMs: number): Landmark[][];
  detectFace(video: VideoLike, timestampMs: number): Landmark[][];
}
