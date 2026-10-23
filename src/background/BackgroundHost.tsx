// Mounted once in the signed-in app (App.tsx, one line). Renders nothing, and costs nothing, unless the
// `background_watching` flag is on: it only reads the flag (which the app asks the server for anyway), and only then
// fetches the chunk that runs the pause clock, the desktop bridge and the reminders.

import { Suspense, lazy } from 'react';
import { useFeature } from '../features/useFeature';

const BackgroundRunner = lazy(() => import('./BackgroundRunner'));

export function BackgroundHost() {
  const on = useFeature('background_watching');
  if (!on) return null;
  return (
    <Suspense fallback={null}>
      <BackgroundRunner />
    </Suspense>
  );
}
