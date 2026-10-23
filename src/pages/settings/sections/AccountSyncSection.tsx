// Settings > Account & Sync   (section id "account-sync")
//
// OWNER: WS4 (with WS8 sign-in methods, WS5 weekly email, WS9 referral link). Nobody else edits this file.
// SHOWN WHEN: event_sync, signin_*, weekly_email, referrals (see ../meta.ts; the page does the flag check, not this file).
// WILL HOLD: Sync opt-in and status, linked sign-in methods, email preferences.
//
// Empty on purpose: it renders nothing, so Settings looks exactly as it did
// before this workstream. To add content, build a card with the page's own
// pieces and keep it flagged:
//
//   import { RefreshCw } from 'lucide-react';
//   import { Section, Row, Toggle } from '../ui';
//   import { kv } from '../../../storage/kv';         // light entry; never localStorage directly
//
//   export function AccountSyncSection() {
//     return (
//       <Section title="Account & Sync" icon={RefreshCw} fullWidth>
//         <Row label="..." description="..."> ... </Row>
//       </Section>
//     );
//   }
//
// Use `fullWidth` unless the card is meant to pair with another half-width one,
// and follow DESIGN.md: pills, hairlines, no shadows, no illustrations of the habit.
// For gating INSIDE the card (one control behind a second flag) use
// useFeature('...') from '../../../features/useFeature'.

import { ReferralCard } from '../../../components/billing/ReferralCard';

export function AccountSyncSection() {
  // WS9: the referral card (flag referrals; it draws nothing while the flag is off). WS4: add the sync
  // controls above it; keep this line.
  return <ReferralCard />;
}
