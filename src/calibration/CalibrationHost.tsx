// Shows the calibration when it is opened (WS3). Mounted by the FalsePositiveBridge, i.e. only while the
// `false_positive_controls` flag is on. The view itself, with the camera and MediaPipe code, is a lazy chunk
// fetched only when someone opens it.

import { Suspense, lazy, useSyncExternalStore } from 'react';
import { isCalibrationOpen, subscribeCalibration } from './state';

const CalibrationView = lazy(() => import('./CalibrationView').then(m => ({ default: m.CalibrationView })));

export function CalibrationHost() {
  const open = useSyncExternalStore(subscribeCalibration, isCalibrationOpen, () => false);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <CalibrationView />
    </Suspense>
  );
}
