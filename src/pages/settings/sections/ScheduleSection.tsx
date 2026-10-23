// Settings > Schedule   (section id "schedule")
//
// OWNER: WS7a. Nobody else edits this file.
// SHOWN WHEN: background_watching (see ../meta.ts; the page does the flag check, not this file).
// WILL HOLD: Work-hours reminders, pause controls, meeting mode.
//
// Empty on purpose: it renders nothing, so Settings looks exactly as it did
// before this workstream. To add content, build a card with the page's own
// pieces and keep it flagged:
//
//   import { CalendarClock } from 'lucide-react';
//   import { Section, Row, Toggle } from '../ui';
//   import { kv } from '../../../storage/kv';         // light entry; never localStorage directly
//
//   export function ScheduleSection() {
//     return (
//       <Section title="Schedule" icon={CalendarClock} fullWidth>
//         <Row label="..." description="..."> ... </Row>
//       </Section>
//     );
//   }
//
// Use `fullWidth` unless the card is meant to pair with another half-width one,
// and follow DESIGN.md: pills, hairlines, no shadows, no illustrations of the habit.
// For gating INSIDE the card (one control behind a second flag) use
// useFeature('...') from '../../../features/useFeature'.

export function ScheduleSection() {
  return null;
}
