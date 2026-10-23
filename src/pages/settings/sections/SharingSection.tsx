// Settings > Sharing   (section id "sharing")
//
// OWNER: WS10. Nobody else edits this file.
// SHOWN WHEN: share_links (see ../meta.ts; the page does the flag check, not this file).
// HOLDS: create, copy, list and revoke read-only share links (../SharingSettings.tsx, flag share_links).
//
// The card is a lazy chunk, fetched only while the flag is on, so with the flag off opening
// Settings downloads nothing extra and renders nothing from this section.
//
// Use `fullWidth` unless the card is meant to pair with another half-width one,
// and follow DESIGN.md: pills, hairlines, no shadows, no illustrations of the habit.

import { Suspense, lazy } from 'react';
import { useFeatures } from '../../../features/useFeature';

const SharingSettings = lazy(() => import('../SharingSettings').then(m => ({ default: m.SharingSettings })));

export function SharingSection() {
  const flags = useFeatures();
  return (
    <>
      {flags.share_links && (
        <Suspense fallback={null}>
          <SharingSettings />
        </Suspense>
      )}
    </>
  );
}
