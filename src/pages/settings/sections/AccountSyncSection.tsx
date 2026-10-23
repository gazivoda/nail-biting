// Settings > Account & Sync   (section id "account-sync")
//
// OWNER: WS4 (with WS8 sign-in methods, WS5 weekly email, WS9 referral link). Nobody else edits this file.
// SHOWN WHEN: event_sync, signin_*, weekly_email, referrals (see ../meta.ts; the page does the flag check, not this file).
// HOLDS: the sync opt-in, its status and the device name (WS4; ../SyncSettings.tsx, flag event_sync).
//
// WS8, WS5 and WS9: add your own cards below the sync card, each behind its own
// flag with useFeature('...') from '../../../features/useFeature'. The sync card
// renders nothing while event_sync is off, so a section that is open for another
// flag shows only that flag's card.
//
// Use `fullWidth` unless the card is meant to pair with another half-width one,
// and follow DESIGN.md: pills, hairlines, no shadows, no illustrations of the habit.

import { Suspense, lazy } from 'react';
import { useFeatures } from '../../../features/useFeature';

// The sync card pulls in the sync client and the storage facade. It is fetched only
// while event_sync is on, so with the flag off opening Settings downloads nothing extra.
const SyncSettings = lazy(() => import('../SyncSettings').then(m => ({ default: m.SyncSettings })));

export function AccountSyncSection() {
  const flags = useFeatures();
  return (
    <>
      {flags.event_sync && (
        <Suspense fallback={null}>
          <SyncSettings />
        </Suspense>
      )}
    </>
  );
}
