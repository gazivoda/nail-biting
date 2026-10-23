// Settings > Behaviors   (section id "behaviors")
//
// OWNER: WS1. Nobody else edits this file.
// SHOWN WHEN: detection_behaviors (see ../meta.ts; the page does the flag check, not this file).
// WILL HOLD: Which behaviours to monitor. Experimental ones only while the `experimental` flag is on.
//
// Empty on purpose: it renders nothing, so Settings looks exactly as it did
// before this workstream. To add content, build a card with the page's own
// pieces and keep it flagged:
//
//   import { ListChecks } from 'lucide-react';
//   import { Section, Row, Toggle } from '../ui';
//   import { kv } from '../../../storage/kv';         // light entry; never localStorage directly
//
//   export function BehaviorsSection() {
//     return (
//       <Section title="Behaviors" icon={ListChecks} fullWidth>
//         <Row label="..." description="..."> ... </Row>
//       </Section>
//     );
//   }
//
// Use `fullWidth` unless the card is meant to pair with another half-width one,
// and follow DESIGN.md: pills, hairlines, no shadows, no illustrations of the habit.
// For gating INSIDE the card (one control behind a second flag) use
// useFeature('...') from '../../../features/useFeature'.

export function BehaviorsSection() {
  return null;
}
