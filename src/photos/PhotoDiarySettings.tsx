// Mounted by sections/DataSection.tsx with one line. Self-gating: nothing renders and
// nothing is downloaded while the `photo_diary` flag is off.

import { Suspense, lazy } from 'react';
import { useFeature } from '../features/useFeature';

const Card = lazy(() => import('./PhotoDiarySettingsCard').then(m => ({ default: m.PhotoDiarySettingsCard })));

export function PhotoDiarySettings() {
  const on = useFeature('photo_diary');
  if (!on) return null;
  return (
    <Suspense fallback={null}>
      <Card />
    </Suspense>
  );
}
