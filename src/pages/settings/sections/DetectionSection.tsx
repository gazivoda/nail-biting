// Settings > Detection   (section id "detection")
//
// OWNER: WS3. Nobody else edits this file.
// SHOWN WHEN: false_positive_controls (see ../meta.ts; the page does the flag check, not this file).
// HOLDS: hand filter, chin-rest rule, what has been learned from "Not a bite", the optional calibration and
// the false-alarm rate. The card itself is src/falsePositive/DetectionSettings.tsx.

import { DetectionSettings } from '../../../falsePositive/DetectionSettings';

export function DetectionSection() {
  return <DetectionSettings />;
}
