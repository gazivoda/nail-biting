// Connects the history to the coaching prompt (WS2). No React and no store
// import: the app's store is passed in (CoachingBridge), so the logic is tested
// in node against a fake history and the real controller.
//
// Why this can never block, delay or silence the alarm:
//  1. Order. useDetection.startBiting starts the sound, sets the alert status,
//     and only THEN calls onAlert -> logIncident -> the store. We hear about the
//     alarm after it is already sounding. We hold no code on the alarm path.
//  2. The listener below is the only code that runs inside the store's `set()`
//     (i.e. inside onAlert, before the tab-title flash and notification). It does
//     one cheap pure check and schedules the rest with `defer` (a microtask), so
//     nothing slow or fallible runs there, and it is wrapped in try/catch: a throw
//     here must not travel back up through logIncident into the detector.
//  3. Everything the deferred part does is wrapped as well.

import { alarmCoaching, type CoachingController } from './controller';
import { newestAlarmId, newestFreshAlarm, type WatchedEvent } from './alarmWatcher';
import { shouldPrompt } from './promptPolicy';
import { getCoachingSettings, getLastPromptAt, selectedResponseText, setLastPromptAt, type CoachingSettings } from './settings';
import type { CoachingPatch } from './session';

export interface WatcherDeps {
  /** The history, newest first. */
  getIncidents(): readonly WatchedEvent[];
  /** Calls `listener` after every change to the history. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Persists a finished session on the alarm's event. */
  save(eventId: string, patch: CoachingPatch): void;
  controller?: CoachingController;
  now?: () => number;
  /** Runs `fn` after the current call stack (default: a microtask). */
  defer?: (fn: () => void) => void;
  getSettings?: () => CoachingSettings;
  getLastPromptAt?: () => number | null;
  setLastPromptAt?: (ts: number) => void;
}

/** Starts watching. Returns `stop`, which also disarms the controller. */
export function startCoachingWatcher(deps: WatcherDeps): () => void {
  const controller = deps.controller ?? alarmCoaching;
  const now = deps.now ?? Date.now;
  const defer = deps.defer ?? ((fn: () => void) => queueMicrotask(fn));
  const readSettings = deps.getSettings ?? getCoachingSettings;
  const readLast = deps.getLastPromptAt ?? getLastPromptAt;
  const writeLast = deps.setLastPromptAt ?? setLastPromptAt;

  controller.setResultHandler(({ eventId, patch }) => deps.save(eventId, patch));
  controller.arm();

  // Alarms that were already in the history when we started are never "new".
  let seenId: string | null = null;
  try { seenId = newestAlarmId(deps.getIncidents()); } catch { /* unreadable history: the freshness check still protects us */ }
  let stopped = false;

  const unsubscribe = deps.subscribe(() => {
    try {
      const alarm = newestFreshAlarm(deps.getIncidents(), seenId, now());
      if (!alarm) return;
      seenId = alarm.id;
      defer(() => {
        if (stopped) return;
        try {
          const settings = readSettings();
          const at = now();
          if (!shouldPrompt(settings.promptMode, readLast(), at)) return;
          const started = controller.offer({
            eventId: alarm.id,
            text: selectedResponseText(settings),
            durationSec: settings.durationSec,
          });
          if (started) writeLast(at);
        } catch { /* coaching is optional; it must never surface an error */ }
      });
    } catch { /* never let this travel back into logIncident and the alarm path */ }
  });

  return () => {
    stopped = true;
    unsubscribe();
    controller.setResultHandler(null);
    controller.disarm();
  };
}
