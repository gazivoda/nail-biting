// Settings > Sharing   (section id "sharing")
//
// OWNER: WS10. Nobody else edits this file.
// SHOWN WHEN: share_links (see ../meta.ts; the page does the flag check, not this file).
// WILL HOLD: Create, list and revoke read-only share links.
//
// Empty on purpose: it renders nothing, so Settings looks exactly as it did
// before this workstream. To add content, build a card with the page's own
// pieces and keep it flagged:
//
//   import { Share2 } from 'lucide-react';
//   import { Section, Row, Toggle } from '../ui';
//   import { kv } from '../../../storage/kv';         // light entry; never localStorage directly
//
//   export function SharingSection() {
//     return (
//       <Section title="Sharing" icon={Share2} fullWidth>
//         <Row label="..." description="..."> ... </Row>
//       </Section>
//     );
//   }
//
// Use `fullWidth` unless the card is meant to pair with another half-width one,
// and follow DESIGN.md: pills, hairlines, no shadows, no illustrations of the habit.
// For gating INSIDE the card (one control behind a second flag) use
// useFeature('...') from '../../../features/useFeature'.

export function SharingSection() {
  return null;
}
