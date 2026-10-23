// Mounted by sections/AccountSyncSection.tsx with one line. Self-gating: nothing
// renders and nothing is downloaded while the `weekly_email` flag is off (the card
// is a separate lazy chunk, like the sync card next to it).

import { Suspense, lazy } from 'react';
import { useFeature } from '../../features/useFeature';

const Card = lazy(() => import('./WeeklyEmailCard').then(m => ({ default: m.WeeklyEmailCard })));

export function WeeklyEmailSettings() {
  const on = useFeature('weekly_email');
  if (!on) return null;
  return (
    <Suspense fallback={null}>
      <Card />
    </Suspense>
  );
}
