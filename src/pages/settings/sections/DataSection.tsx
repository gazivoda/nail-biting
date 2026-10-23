// Settings > Data   (section id "data")
//
// OWNER: WS4 (with WS5 photo diary). Nobody else edits this file.
// SHOWN WHEN: data_backup, event_sync, photo_diary (see ../meta.ts; the page does the flag check, not this file).
// WILL HOLD: Export, import, delete synced data, delete photos. The existing "Clear all data" card stays in Settings.tsx.
//
// Empty on purpose: it renders nothing, so Settings looks exactly as it did
// before this workstream. To add content, build a card with the page's own
// pieces and keep it flagged:
//
//   import { Database } from 'lucide-react';
//   import { Section, Row, Toggle } from '../ui';
//   import { kv } from '../../../storage/kv';         // light entry; never localStorage directly
//
//   export function DataSection() {
//     return (
//       <Section title="Data" icon={Database} fullWidth>
//         <Row label="..." description="..."> ... </Row>
//       </Section>
//     );
//   }
//
// Use `fullWidth` unless the card is meant to pair with another half-width one,
// and follow DESIGN.md: pills, hairlines, no shadows, no illustrations of the habit.
// For gating INSIDE the card (one control behind a second flag) use
// useFeature('...') from '../../../features/useFeature'.

export function DataSection() {
  return null;
}
