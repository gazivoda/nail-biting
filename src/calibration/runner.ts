// The camera and MediaPipe side of the calibration (WS3). Everything in the browser, on the person's own
// live picture; the only output is a pose (six numbers) per frame handed to the caller. No frame is stored,
// drawn on a canvas, or sent anywhere.
//
// It uses the models the detector already loaded (getModels, exported from useDetection.ts for this), and
// the view pauses the app's own detection while it runs, so the two never feed the same tracker at once.
//
// NOT TESTABLE WITHOUT A CAMERA: the logic that decides what to do with the poses is steps.ts (tested). The
// fake camera used in headless Chrome has no hands, so this file has run end to end there (models load,
// frames flow, "no hand seen" is reported) and has not seen a real hand.

import { getModels } from '../hooks/useDetection';
import { extractPose, type PoseFeatures } from '../detection/pose';
import { CAMERA_ERROR_MESSAGE } from '../components/detection/cameraErrorCopy';

export const FRAME_MS = 200;

export interface OpenedCamera {
  stop(): void;
}

function errorKind(err: unknown): keyof typeof CAMERA_ERROR_MESSAGE {
  const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission-denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-camera';
  return 'unavailable';
}

/** Opens the camera into `video` (the person's own picture, shown mirrored like the preview in the app). */
export async function openCamera(video: HTMLVideoElement): Promise<{ ok: true; camera: OpenedCamera } | { ok: false; message: string }> {
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, message: CAMERA_ERROR_MESSAGE['insecure-context'] };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play().catch(() => {});
    return {
      ok: true,
      camera: {
        stop() {
          stream.getTracks().forEach(t => t.stop());
          video.srcObject = null;
        },
      },
    };
  } catch (err) {
    return { ok: false, message: CAMERA_ERROR_MESSAGE[errorKind(err)] };
  }
}

export interface FrameReport {
  /** The pose of the first hand against the first face, or null when either is missing. */
  pose: PoseFeatures | null;
  handSeen: boolean;
  faceSeen: boolean;
}

/** Runs the models on the video five times a second and reports each frame. Resolves once the models are loaded. */
export async function startFrames(video: HTMLVideoElement, onFrame: (report: FrameReport) => void): Promise<{ stop(): void }> {
  const { hand, face } = await getModels();
  let stopped = false;
  let last = 0;
  const id = setInterval(() => {
    if (stopped || video.readyState < 2) return;
    // MediaPipe needs strictly increasing timestamps.
    const ts = Math.max(performance.now(), last + 1);
    last = ts;
    try {
      const hands = hand.detectForVideo(video, ts).landmarks ?? [];
      const faces = face.detectForVideo(video, ts + 0.1).faceLandmarks ?? [];
      const aspect = video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 4 / 3;
      const pose = hands.length > 0 && faces.length > 0 ? extractPose(hands[0], faces[0], aspect) : null;
      onFrame({ pose, handSeen: hands.length > 0, faceSeen: faces.length > 0 });
    } catch {
      onFrame({ pose: null, handSeen: false, faceSeen: false });
    }
  }, FRAME_MS);
  return { stop() { stopped = true; clearInterval(id); } };
}
