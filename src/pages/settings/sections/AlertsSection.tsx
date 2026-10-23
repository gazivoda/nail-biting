// Settings > Alerts   (section id "alerts")
//
// OWNER: WS2. Nobody else edits this file.
// SHOWN WHEN: hrt_coaching (see ../meta.ts; the page does the flag check, not this file).
// WILL HOLD: Competing responses, when to prompt after an alarm, program reminders.
//
// Empty on purpose: it renders nothing, so Settings looks exactly as it did
// before this workstream. To add content, build a card with the page's own
// pieces and keep it flagged:
//
//   import { Bell } from 'lucide-react';
//   import { Section, Row, Toggle } from '../ui';
//   import { kv } from '../../../storage/kv';         // light entry; never localStorage directly
//
//   export function AlertsSection() {
//     return (
//       <Section title="Alerts" icon={Bell} fullWidth>
//         <Row label="..." description="..."> ... </Row>
//       </Section>
//     );
//   }
//
// Use `fullWidth` unless the card is meant to pair with another half-width one,
// and follow DESIGN.md: pills, hairlines, no shadows, no illustrations of the habit.
// For gating INSIDE the card (one control behind a second flag) use
// useFeature('...') from '../../../features/useFeature'.

export function AlertsSection() {
  return null;
}
