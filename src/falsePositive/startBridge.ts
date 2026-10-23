// What the FalsePositiveBridge does while it is mounted, as a plain function so it can be tested in node
// (the component only calls it from an effect). See FalsePositiveBridge.tsx for the argument.
//
// Returns the cleanup, which undoes everything: nothing stays registered with the engine, the toast is
// disarmed and its offer cleared.

import { useAppStore } from '../store/useAppStore';
import { setDetectionControls } from '../detection/controlsRegistry';
import { newestAlarmId, newestFreshAlarm } from '../coaching/alarmWatcher';
import { notABite } from './controller';
import { markNotABite, undoNotABite } from './actions';
import { buildControls, poseOfFire } from './controls';
import { markCalibrationOffered, reconcileLearned, rememberAlarmPose, shouldOfferCalibration, subscribeStore } from './poseStore';
import { openCalibration } from '../calibration/state';

export function startFalsePositiveBridge(): () => void {
  // 1 and 2: the controls, and the pose of each alarm.
  const onFire = (info: Parameters<typeof poseOfFire>[0]) => {
    queueMicrotask(() => {
      try {
        const entry = poseOfFire(info);
        if (entry) rememberAlarmPose(entry);
      } catch { /* a bonus: it must never surface */ }
    });
  };
  const apply = () => setDetectionControls(buildControls(onFire));
  apply();
  const offStore = subscribeStore(apply);

  // 3: the toast.
  notABite.arm({
    mark: id => {
      const marked = markNotABite(id);
      // The very first "Not a bite": offer the optional calibration, once, never forced.
      if (marked && shouldOfferCalibration()) {
        markCalibrationOffered();
        return { suggestCalibration: true };
      }
    },
    undo: undoNotABite,
    calibrate: openCalibration,
  });

  // 3 and 4: watch the history.
  let lastIncidents = useAppStore.getState().incidents;
  let seenId: string | null = null;
  try { seenId = newestAlarmId(lastIncidents); } catch { /* the freshness check still protects us */ }
  const offHistory = useAppStore.subscribe(state => {
    if (state.incidents === lastIncidents) return; // camera toggles and settings do not concern us
    lastIncidents = state.incidents;
    try {
      const alarm = newestFreshAlarm(state.incidents, seenId, Date.now());
      if (alarm) {
        seenId = alarm.id;
        queueMicrotask(() => { try { notABite.offer(alarm.id); } catch { /* optional */ } });
      }
      reconcileLearned(id => state.incidents.some(i => i.id === id && i.falsePositive === true));
    } catch { /* never let this travel back into logIncident and the alarm path */ }
  });

  return () => {
    offStore();
    offHistory();
    notABite.disarm();
    setDetectionControls(null);
  };
}
