import { useRef, useEffect, useCallback, useState } from 'react';
import {
  HandLandmarker,
  FaceLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';
import type { DetectionSensitivity, AlertSound } from '../types';

// --------------------------------------------------------------------------
// Module-level model cache — init once, reuse across React remounts
// --------------------------------------------------------------------------
let cachedHand: HandLandmarker | null = null;
let cachedFace: FaceLandmarker | null = null;
let modelInitPromise: Promise<{ hand: HandLandmarker; face: FaceLandmarker }> | null = null;

// Resolve a path relative to this module's location, which works correctly
// under both http:// (web/dev) and file:// (Electron packaged) origins.
// In Electron, import.meta.url is something like:
//   file:///Applications/Stop Biting.app/Contents/Resources/app.asar/dist/assets/index-xxx.js
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

// Starts a repeating alert sound based on the selected AlertSound profile.
// Returns a stop function.
function startAlarm(sound: AlertSound): (() => void) {
  let ctx: AudioContext;
  let intervalId: ReturnType<typeof setInterval>;
  let stopFn: (() => void) | null = null;

  try {
    ctx = new AudioContext();

    // ── alarm: rapid alternating 1000/800 Hz beep (original) ──────────────
    function playAlarm() {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = ctx.currentTime % 0.6 < 0.3 ? 1000 : 800;
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } catch { /* ignore */ }
    }

    // ── chime: soft decaying bell strike at 880 Hz ─────────────────────────
    function playChime() {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1.2);
      } catch { /* ignore */ }
    }

    // ── buzz: harsh low sawtooth rumble at 120 Hz ──────────────────────────
    function playBuzz() {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 120;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.18);
      } catch { /* ignore */ }
    }

    // ── chirp: ascending FM sweep 400→1200 Hz over 200ms ──────────────────
    function playChirp() {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.45, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      } catch { /* ignore */ }
    }

    // ── whistle: descending pure tone 1400→600 Hz over 300ms ──────────────
    function playWhistle() {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } catch { /* ignore */ }
    }

    const playFn = {
      alarm: playAlarm,
      chime: playChime,
      buzz: playBuzz,
      chirp: playChirp,
      whistle: playWhistle,
    }[sound];

    const intervalMs = {
      alarm: 250,   // 4/s
      chime: 1400,  // one bell per decay
      buzz: 220,    // rapid buzz pulses
      chirp: 300,   // quick repeating sweep
      whistle: 400, // descending tone loop
    }[sound];

    playFn(); // fire immediately
    intervalId = setInterval(playFn, intervalMs);
  } catch {
    return () => {};
  }

  stopFn = () => {
    clearInterval(intervalId);
    try { ctx.close(); } catch { /* ignore */ }
  };

  return () => stopFn?.();
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
  alertSound: AlertSound,
  onAlert: () => void,
) {
  const [status, setStatus] = useState<DetectionStatus>('idle');

  // Refs for values that change without needing inference restart
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;
  const alertTypeRef = useRef(alertType);
  alertTypeRef.current = alertType;
  const alertSoundRef = useRef(alertSound);
  alertSoundRef.current = alertSound;
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
      stopAlarmRef.current = startAlarm(alertSoundRef.current);
    }
    setStatus('alert');
    onAlertRef.current(); // log the incident once when biting starts

    // Tab title flash
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    document.title = '⚠️ Stop biting! – Stop Biting';
    titleTimerRef.current = setTimeout(() => {
      document.title = originalTitleRef.current;
    }, 3000);

    // Background notifications: when the tab is hidden (PiP detection),
    // notify via app badge + OS notification so the user knows.
    if (document.hidden) {
      // App icon badge (PWA Badging API — no permission required)
      navigator.setAppBadge?.().catch(() => {});

      // OS notification (uses existing permission from reminders toggle)
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Stop biting!', {
          body: 'Nail biting detected — take your hands away.',
          icon: '/icons/icon-192x192.png',
          tag: 'bite-alert', // deduplicates — only one notification at a time
          requireInteraction: false,
        });
      }
    }

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
    let bgIntervalId: ReturnType<typeof setInterval> | null = null;
    let visibilityHandler: (() => void) | null = null;

    getModels()
      .then(({ hand, face }) => {
        if (cancelled) return;
        setStatus('watching');

        let lastInferenceTs = 0;
        let consecutiveHits = 0;
        let missedFrames = 0; // consecutive frames with no fingertip near mouth

        function runInference() {
          const now = performance.now();
          lastInferenceTs = now;

          const video = videoRef.current;
          if (!video || video.readyState < 2) return;

          try {
            const handResult = hand.detectForVideo(video, now);
            const faceResult = face.detectForVideo(video, now + 0.1);

            const hands = handResult.landmarks ?? [];
            const faces = faceResult.faceLandmarks ?? [];

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

            if (fingertipNearMouth) {
              missedFrames = 0;
              consecutiveHits++;
              if (consecutiveHits >= REQUIRED_CONSECUTIVE_FRAMES) {
                startBiting();
              }
            } else {
              consecutiveHits = 0;
              missedFrames++;
              if (missedFrames >= 2) {
                stopBiting();
                missedFrames = 0;
              }
            }
          } catch {
            // Skip frames with transient errors silently
          }
        }

        function processFrame() {
          if (cancelled) return;
          rafId = requestAnimationFrame(processFrame);

          // When tab is hidden, rAF is throttled/paused. The background
          // setInterval fallback (below) handles detection instead.
          if (document.hidden) return;

          const now = performance.now();
          if (now - lastInferenceTs < INFERENCE_INTERVAL_MS) return;

          runInference();
        }

        // Background detection fallback: when the tab is hidden but PiP keeps
        // the video stream alive, use setInterval (~1fps) instead of rAF.
        // Browsers throttle setInterval to ~1/second for hidden tabs, which is
        // enough to catch biting episodes.
        function startBgInterval() {
          if (bgIntervalId) return;
          bgIntervalId = setInterval(() => {
            if (!cancelled && document.hidden) runInference();
          }, 500);
        }

        function stopBgInterval() {
          if (bgIntervalId) {
            clearInterval(bgIntervalId);
            bgIntervalId = null;
          }
        }

        visibilityHandler = () => {
          if (document.hidden) {
            startBgInterval();
          } else {
            stopBgInterval();
            // Clear app badge when user returns to the tab
            navigator.clearAppBadge?.().catch(() => {});
          }
        };

        document.addEventListener('visibilitychange', visibilityHandler);
        // If tab is already hidden when detection starts, start the interval
        if (document.hidden) startBgInterval();

        rafId = requestAnimationFrame(processFrame);
      })
      .catch(err => {
        console.error('MediaPipe init failed:', err);
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      if (bgIntervalId) clearInterval(bgIntervalId);
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
