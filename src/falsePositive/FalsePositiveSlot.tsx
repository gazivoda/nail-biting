// The one line Dashboard.tsx adds for WS3. Behind the `false_positive_controls` flag: with it off this
// renders nothing at all, and the bridge (which registers the controls and arms the toast) is not mounted.
//
// Reading a flag asks the server once per page load (GET /api/features), which the coaching slot beside
// it already does, then uses the last answer cached by the storage module, so it also works offline.

import { useFeature } from '../features/useFeature';
import { FalsePositiveBridge } from './FalsePositiveBridge';

export function FalsePositiveSlot() {
  const on = useFeature('false_positive_controls');
  return on ? <FalsePositiveBridge /> : null;
}
