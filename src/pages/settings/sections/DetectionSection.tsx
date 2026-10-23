// Settings > Detection   (section id "detection")
//
// OWNER: WS3. Nobody else edits this file.
// SHOWN WHEN: false_positive_controls (see ../meta.ts; the page does the flag check, not this file).
// WILL HOLD: Hand filter, chin-rest rule, calibration, false-positive rate.
//
// Empty on purpose: it renders nothing, so Settings looks exactly as it did
// before this workstream. To add content, build a card with the page's own
// pieces and keep it flagged:
//
//   import { Sliders } from 'lucide-react';
//   import { Section, Row, Toggle } from '../ui';
//   import { kv } from '../../../storage/kv';         // light entry; never localStorage directly
//
//   export function DetectionSection() {
//     return (
//       <Section title="Detection" icon={Sliders} fullWidth>
//         <Row label="..." description="..."> ... </Row>
//       </Section>
//     );
//   }
//
// Use `fullWidth` unless the card is meant to pair with another half-width one,
// and follow DESIGN.md: pills, hairlines, no shadows, no illustrations of the habit.
// For gating INSIDE the card (one control behind a second flag) use
// useFeature('...') from '../../../features/useFeature'.

export function DetectionSection() {
  return null;
}
