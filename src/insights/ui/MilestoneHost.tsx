// Mounted once in App.tsx, inside the signed-in app (the "route" line). With `insights` off it renders
// nothing and downloads nothing: the runner, the celebration card and the milestone maths are a lazy chunk
// that is only fetched while the flag is on. The flag check is the only thing in the main bundle.

import { Suspense, lazy } from 'react';
import { useFeature } from '../../features/useFeature';

const MilestoneRunner = lazy(() => import('./MilestoneRunner').then(m => ({ default: m.MilestoneRunner })));

export function MilestoneHost() {
  const on = useFeature('insights');
  if (!on) return null;
  return (
    <Suspense fallback={null}>
      <MilestoneRunner />
    </Suspense>
  );
}
