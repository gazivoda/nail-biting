import { useRef, useEffect, useCallback, useState } from 'react';
import {
  HandLandmarker,
  FaceLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';
import type { DetectionSensitivity, AlertSound } from '../types';
import type { Behavior } from '../storage/eventModel';
import { createBiteDetector } from './biteDetector';
import { detectHandsWithSides } from '../detection/handedness';
import { isFeatureOn } from '../features/flags';
import { getAppTicker } from '../background/appTicker';
import { createHiddenSource, type HiddenSource } from '../background/hiddenSource';
import { getPipTickWindow, subscribePipTickWindow } from '../background/tickHost';
import { silentNow } from '../background/silent';
import { withProbe } from '../background/probeHook';
import { judgeHidden, saveCadence } from '../background/cadence';

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

// Exported for the optional calibration (WS3, src/calibration/runner.ts), which reuses the loaded models while detection is paused.
export async function getModels() {
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

// WS7a (flag background_watching): a tick from the hidden-tab source that arrives sooner than this after the last
// inference is dropped. The source ticks every INFERENCE_INTERVAL_MS, so a normal tick is never this early; a burst of
// ticks queued behind a busy main thread is.
const HIDDEN_MIN_GAP_MS = 150;

// What is watched when the caller names no behaviours: nail biting alone, as before WS1.
// One shared array, so the engine can tell "unchanged" by identity.
const DEFAULT_BEHAVIOR_LIST: readonly Behavior[] = ['nail_biting'];

// The per-frame detection logic lives in ./biteDetector so it can be tested
// without a camera or MediaPipe.

// How the alarm sound repeats. A plain setInterval, which a hidden tab slows to once a second.
type Repeat = (fn: () => void, ms: number) => () => void;
const repeatOnPage: Repeat = (fn, ms) => {
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
};

// Starts a repeating alert sound based on the selected AlertSound profile.
// Returns a stop function.
function startAlarm(sound: AlertSound, volume: number, repeat: Repeat = repeatOnPage): (() => void) {
  let ctx: AudioContext;
  let stopRepeat: () => void;
  let stopFn: (() => void) | null = null;

  try {
    ctx = new AudioContext();

    // The alarm starts from a detection event, not a click. If the browser's
    // autoplay policy leaves the context suspended, every beep below is
    // scheduled into a dead context and the user gets no alert at all —
    // silently, which is the worst possible failure for an alarm.
    if (ctx.state === 'suspended') ctx.resume().catch(() => { /* ignore */ });

    // ── alarm: rapid alternating 1000/800 Hz beep (original) ──────────────
    function playAlarm() {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = ctx.currentTime % 0.6 < 0.3 ? 1000 : 800;
        gain.gain.setValueAtTime(0.5 * volume, ctx.currentTime);
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
        gain.gain.setValueAtTime(0.4 * volume, ctx.currentTime);
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
        gain.gain.setValueAtTime(0.35 * volume, ctx.currentTime);
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
        gain.gain.setValueAtTime(0.45 * volume, ctx.currentTime);
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
        gain.gain.setValueAtTime(0.4 * volume, ctx.currentTime);
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
    stopRepeat = repeat(playFn, intervalMs);
  } catch {
    return () => {};
  }

  stopFn = () => {
    stopRepeat();
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
  alertVolume: number,
  // Told which behaviour set the alarm off (WS1). Existing callers that ignore it still type-check.
  onAlert: (behavior: Behavior) => void,
  // The behaviours to watch for (WS1). Leave out for nail biting alone, exactly as before.
  behaviors?: readonly Behavior[],
) {
  const [status, setStatus] = useState<DetectionStatus>('idle');

  // Refs for values that change without needing inference restart
  const sensitivityRef = useRef(sensitivity);
  const alertTypeRef = useRef(alertType);
  const alertSoundRef = useRef(alertSound);
  const alertVolumeRef = useRef(alertVolume);
  const onAlertRef = useRef(onAlert);
  const behaviorsRef = useRef(behaviors);

  // Writing to a ref during render is not allowed. No dep array, so this runs
  // after every render — same cadence as the old inline assignments. These
  // values are only ever read from the rAF/interval loop, which cannot observe
  // the difference between "during render" and "immediately after commit".
  useEffect(() => {
    sensitivityRef.current = sensitivity;
    alertTypeRef.current = alertType;
    alertSoundRef.current = alertSound;
    alertVolumeRef.current = alertVolume;
    onAlertRef.current = onAlert;
    behaviorsRef.current = behaviors;
  });

  const stopAlarmRef = useRef<(() => void) | null>(null);
  const isBitingRef = useRef(false);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalTitleRef = useRef(document.title);

  const startBiting = useCallback((behavior: Behavior = 'nail_biting') => {
    if (isBitingRef.current) return; // already alarming
    isBitingRef.current = true;
    // WS7a: meeting mode is silent. No sound, no notification, no native alert: the flash and the log remain.
    // silentNow() is false whenever the background_watching flag is off, so nothing changes without it.
    const silent = silentNow();
    const type = silent ? 'flash' : alertTypeRef.current;
    if (type === 'sound' || type === 'both') {
      // WS7a: with the flag on, a hidden tab repeats the alarm from the worker's timer (4 beeps a second, not 1).
      const repeat: Repeat | undefined = document.hidden && isFeatureOn('background_watching')
        ? (fn, ms) => getAppTicker().every(ms, fn)
        : undefined;
      stopAlarmRef.current = startAlarm(alertSoundRef.current, alertVolumeRef.current, repeat);
    }
    setStatus('alert');
    onAlertRef.current(behavior); // log the incident once when biting starts

    // Tab title flash
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    document.title = '⚠️ Stop biting! – Stop Biting';
    titleTimerRef.current = setTimeout(() => {
      document.title = originalTitleRef.current;
    }, 3000);

    // Background notifications: when the tab is hidden (PiP detection),
    // notify via app badge + OS notification so the user knows.
    if (document.hidden && !silent) {
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
    if (!silent) window.electronAPI?.onBiteDetected?.();
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
    let hiddenSource: HiddenSource | null = null; // WS7a, only ever made with the background_watching flag on

    getModels()
      .then(({ hand, face }) => {
        if (cancelled) return;
        setStatus('watching');

        let lastInferenceTs = 0;

        const detector = createBiteDetector({
          getVideo: () => videoRef.current,
          getSensitivity: () => sensitivityRef.current,
          getBehaviors: () => behaviorsRef.current ?? DEFAULT_BEHAVIOR_LIST,
          source: withProbe({ // WS7a: identity unless this is a VITE_WS7A_PROBE measurement build
            // SEAM (WS3): with the false-alarm controls off this is exactly `.landmarks ?? []`; see src/detection/handedness.ts.
            detectHands: (video, ts) => detectHandsWithSides(hand, video as HTMLVideoElement, ts),
            detectFace: (video, ts) =>
              face.detectForVideo(video as HTMLVideoElement, ts).faceLandmarks ?? [],
          }),
          onBiteStart: startBiting,
          onBiteEnd: stopBiting,
        });

        // WS7a: while the tab is in the background (flag on), count the checks so the app can say if they were slow.
        const hiddenStats = { tracking: false, from: 0, steps: 0 };

        function runInference() {
          const now = performance.now();
          lastInferenceTs = now;
          if (hiddenStats.tracking) hiddenStats.steps += 1;
          detector.step(now);
        }

        // WS7a: true while a hidden-tab source (the mini window's timers, or a worker) is driving the loop.
        let hiddenDriven = false;

        function processFrame() {
          if (cancelled) return;
          // WS7a: while a hidden-tab source drives the loop, do not keep waking 60 times a second for nothing
          // (a hidden tab with the mini window open still gets every frame). visibilityHandler re-arms it.
          if (hiddenDriven && document.hidden) { rafId = 0; return; }
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

        // WS7a. With the background_watching flag on, a hidden tab is kept at the visible rate (5 checks a second)
        // by a source the browser does not slow down; see src/background/hiddenSource.ts and ARCHITECTURE section 15.
        // The 500 ms interval above stays as the fallback (flag off, no worker, a worker that died): the two never
        // run together, so there is still exactly one inference per tick.
        function hiddenTick() {
          if (cancelled || !document.hidden) return;
          if (performance.now() - lastInferenceTs < HIDDEN_MIN_GAP_MS) return;
          runInference();
        }

        function startHidden() {
          if (isFeatureOn('background_watching')) {
            hiddenStats.tracking = true;
            hiddenStats.from = performance.now();
            hiddenStats.steps = 0;
            const source = hiddenSource ?? createHiddenSource({
              intervalMs: INFERENCE_INTERVAL_MS,
              tick: hiddenTick,
              ticker: getAppTicker(),
              getPip: getPipTickWindow,
              subscribePip: subscribePipTickWindow,
              onLost: () => { hiddenDriven = false; if (document.hidden) startBgInterval(); },
            });
            hiddenSource = source;
            hiddenDriven = true;
            source.start();
            return;
          }
          startBgInterval();
        }

        function stopHidden() {
          stopBgInterval();
          hiddenSource?.stop();
          hiddenDriven = false;
          if (hiddenStats.tracking) {
            hiddenStats.tracking = false;
            const report = judgeHidden(hiddenStats.steps, (performance.now() - hiddenStats.from) / 1000, Date.now());
            if (report) saveCadence(report);
          }
        }

        visibilityHandler = () => {
          if (document.hidden) {
            startHidden();
          } else {
            stopHidden();
            // Clear app badge when user returns to the tab
            navigator.clearAppBadge?.().catch(() => {});
            if (!rafId) rafId = requestAnimationFrame(processFrame); // parked while a hidden source drove the loop
          }
        };

        document.addEventListener('visibilitychange', visibilityHandler);
        // If tab is already hidden when detection starts, start the hidden-tab source (or the interval)
        if (document.hidden) startHidden();

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
      hiddenSource?.stop();
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
