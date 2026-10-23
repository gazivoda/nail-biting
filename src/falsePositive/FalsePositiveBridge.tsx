// Connects the app to the false-alarm controls (WS3). Mounted only while the `false_positive_controls`
// flag is on (FalsePositiveSlot), inside the Dashboard, which is always mounted for a signed-in person so
// it keeps working on every tab. Renders nothing, apart from the calibration view when it is opened.
//
// It does four things (startBridge.ts) and undoes all of them when it goes away (the flag turned off, or
// sign-out), which is what makes the flag a real off switch: with this component unmounted nothing is
// registered with the engine and the detector takes the path it always had.
//
//   1. Registers the DetectionControls (hand filter, chin-rest rule, learned poses, calibration) with the
//      engine, and re-registers them whenever one of them changes.
//   2. Remembers, for a few days and only on this device, the pose at the start of each alarm, so a later
//      "Not a bite" can learn from it.
//   3. Arms the "Not a bite" toast and offers it for each new alarm (the same fresh-alarm test the coaching
//      prompt uses, so a restored or synced old alarm never prompts).
//   4. Keeps what was learned honest: a remembered pose is dropped as soon as its History entry is no
//      longer marked "Not a bite" (undo, delete, "this was a bite", a sync from another device).
//
// Nothing here runs inside the detection loop except the engine's own call to `onFire`, which only queues
// a microtask.

import { useEffect } from 'react';
import { CalibrationHost } from '../calibration/CalibrationHost';
import { startFalsePositiveBridge } from './startBridge';

export function FalsePositiveBridge() {
  useEffect(() => startFalsePositiveBridge(), []);
  // The calibration view, when someone opens it (Settings > Detection, or the toast after the first "Not a bite").
  return <CalibrationHost />;
}
