// Builds the detection controls from what is stored (WS3). Pure apart from reading poseStore.

import { defaultControls, type DetectionControls, type FireInfo } from '../detection/controls';
import { controlsFromProfile } from '../detection/calibration';
import { poseToVector } from '../detection/pose';
import { readCalibration, readLearned, readSettings } from './poseStore';

/** The controls for right now: the person's settings, their calibration, and the poses they have rejected. */
export function buildControls(onFire?: (info: FireInfo) => void): DetectionControls {
  const settings = readSettings();
  const profile = readCalibration();
  return defaultControls({
    handFilter: settings.handFilter,
    ...controlsFromProfile(profile, settings.chinRest),
    learned: readLearned(),
    onFire,
  });
}

/** What the bridge does when an alarm starts: nothing for the alarm itself, a few numbers kept for a possible "Not a bite". */
export function poseOfFire(info: FireInfo) {
  return info.pose ? { at: info.at, v: poseToVector(info.pose) } : null;
}
