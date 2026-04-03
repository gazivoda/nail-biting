import { useRef, useEffect, useCallback, useState } from 'react';
import {
  HandLandmarker,
  FaceLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';
import type { DetectionSensitivity } from '../types';

// --------------------------------------------------------------------------
// Module-level model cache — init once, reuse across React remounts
// --------------------------------------------------------------------------
let cachedHand: HandLandmarker | null = null;
let cachedFace: FaceLandmarker | null = null;
let modelInitPromise: Promise<{ hand: HandLandmarker; face: FaceLandmarker }> | null = null;

// Resolve a path relative to this module's location, which works correctly
// under both http:// (web/dev) and file:// (Electron packaged) origins.
// In Electron, import.meta.url is something like:
//   file:///Applications/Nail Habit Tracker.app/Contents/Resources/app.asar/dist/assets/index-xxx.js
// Going up two levels from assets/ lands us in dist/, where mediapipe-wasm/ lives.
function assetUrl(relativePath: string): string {
  try {
    const base = new URL('..', import.meta.url).href
      .replace('/app.asar/', '/app.asar.unpacked/');
    return new URL(relativePath, base).href;
  } catch {
    return relativePath;
  }
}

async function getModels() {
  if (cachedHand && cachedFace) return { hand: cachedHand, face: cachedFace };
  if (modelInitPromise) return modelInitPromise;

  modelInitPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        assetUrl('mediapipe-wasm')
      );

      const hand = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: assetUrl('mediapipe-models/hand_landmarker.task'),
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });

      const face = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: assetUrl('mediapipe-models/face_landmarker.task'),
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });

      cachedHand = hand;
      cachedFace = face;
      return { hand, face };
    } catch (err) {
      modelInitPromise = null;
      throw err;
    }
  })();

  return modelInitPromise;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

// 5fps — plenty for nail-biting detection, ~12x less CPU than 60fps
const INFERENCE_INTERVAL_MS = 200;

// Only check fingertip landmarks — wrist/palm near the face shouldn't count
// MediaPipe hand landmark indices: 4=thumb, 8=index, 12=middle, 16=ring, 20=pinky
const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

// How many consecutive positive frames required before alerting.
// At 5fps, 3 frames = 600ms dwell time — eliminates brief pass-by false positives.
const REQUIRED_CONSECUTIVE_FRAMES = 3;

const THRESHOLDS: Record<DetectionSensitivity, number> = {
  low: 0.18,
  medium: 0.12,
  high: 0.08,
};

function dist2d(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Starts a rapid repeating beep alarm. Returns a stop function.
function startAlarm(): (() => void) {
  let ctx: AudioContext;
  let intervalId: ReturnType<typeof setInterval>;

  try {
    ctx = new AudioContext();

    function beep() {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        // Alternates 1000Hz / 800Hz each beep for a more jarring alarm tone
        osc.frequency.value = ctx.currentTime % 0.6 < 0.3 ? 1000 : 800;
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } catch { /* ignore */ }
    }

    beep(); // fire immediately
    intervalId = setInterval(beep, 250); // then every 250ms — 4 beeps/second
  } catch {
    return () => {};
  }

  return () => {
    clearInterval(intervalId);
    try { ctx.close(); } catch { /* ignore */ }
  };
}

// --------------------------------------------------------------------------
// Hook
// --------------------------------------------------------------------------

export type DetectionStatus = 'idle' | 'loading' | 'watching' | 'alert' | 'error';

export function useDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  sensitivity: DetectionSensitivity,
  alertType: 'sound' | 'flash' | 'both',
  onAlert: () => void,
) {
  const [status, setStatus] = useState<DetectionStatus>('idle');

  // Refs for values that change without needing inference restart
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;
  const alertTypeRef = useRef(alertType);
  alertTypeRef.current = alertType;
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  const stopAlarmRef = useRef<(() => void) | null>(null);
  const isBitingRef = useRef(false);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalTitleRef = useRef(document.title);

  const startBiting = useCallback(() => {
    if (isBitingRef.current) return; // already alarming
    isBitingRef.current = true;
    const type = alertTypeRef.current;
    if (type === 'sound' || type === 'both') {
      stopAlarmRef.current = startAlarm();
    }
    setStatus('alert');
    onAlertRef.current(); // log the incident once when biting starts

    // Tab title flash
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    document.title = '⚠️ Stop biting! – Nail Habit';
    titleTimerRef.current = setTimeout(() => {
      document.title = originalTitleRef.current;
    }, 3000);

    // Electron: notify the main process so it can show a system notification
    // when the app window is minimised to tray
    window.electronAPI?.onBiteDetected?.();
  }, []);

  const stopBiting = useCallback(() => {
    if (!isBitingRef.current) return;
    isBitingRef.current = false;
    stopAlarmRef.current?.();
    stopAlarmRef.current = null;
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    alertTimeoutRef.current = setTimeout(() => setStatus('watching'), 300);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    if (!cachedHand || !cachedFace) setStatus('loading');

    let cancelled = false;
    let rafId = 0;

    getModels()
      .then(({ hand, face }) => {
        if (cancelled) return;
        setStatus('watching');

        let lastInferenceTs = 0;
        let consecutiveHits = 0;
        let missedFrames = 0; // consecutive frames with no fingertip near mouth

        function processFrame() {
          if (cancelled) return;
          rafId = requestAnimationFrame(processFrame);

          // Skip when tab hidden — rAF already pauses but be explicit
          if (document.hidden) return;

          const now = performance.now();
          // Throttle to ~5fps: only infer every INFERENCE_INTERVAL_MS
          if (now - lastInferenceTs < INFERENCE_INTERVAL_MS) return;
          lastInferenceTs = now;

          const video = videoRef.current;
          if (!video || video.readyState < 2) return;

          try {
            // Run both models every tick so temporal tracking stays warm.
            // Skipping face on "no-hand" frames breaks face re-detection.
            const handResult = hand.detectForVideo(video, now);
            const faceResult = face.detectForVideo(video, now + 0.1);

            const hands = handResult.landmarks ?? [];
            const faces = faceResult.faceLandmarks ?? [];

            // Compute whether a fingertip is near the mouth (false if models found nothing)
            let fingertipNearMouth = false;
            if (hands.length > 0 && faces.length > 0) {
              const facePoints = faces[0];
              const mouth = {
                x: (facePoints[13].x + facePoints[14].x) / 2,
                y: (facePoints[13].y + facePoints[14].y) / 2,
              };
              const threshold = THRESHOLDS[sensitivityRef.current];
              outer: for (const handPoints of hands) {
                for (const idx of FINGERTIP_INDICES) {
                  if (dist2d(handPoints[idx], mouth) < threshold) {
                    fingertipNearMouth = true;
                    break outer;
                  }
                }
              }
            }

            // Always update alarm state — never early-return before this block
            if (fingertipNearMouth) {
              missedFrames = 0;
              consecutiveHits++;
              if (consecutiveHits >= REQUIRED_CONSECUTIVE_FRAMES) {
                startBiting();
              }
            } else {
              consecutiveHits = 0;
              missedFrames++;
              // 2 missed frames (~400ms) grace before stopping — avoids cutting
              // out during brief occlusion mid-bite
              if (missedFrames >= 2) {
                stopBiting();
                missedFrames = 0;
              }
            }
          } catch {
            // Skip frames with transient errors silently
          }
        }

        rafId = requestAnimationFrame(processFrame);
      })
      .catch(err => {
        console.error('MediaPipe init failed:', err);
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      stopAlarmRef.current?.();
      stopAlarmRef.current = null;
      isBitingRef.current = false;
      document.title = originalTitleRef.current;
      // Don't close cached models — they're reused across mounts
    };
  }, [enabled, videoRef, startBiting, stopBiting]);

  return { status };
}
