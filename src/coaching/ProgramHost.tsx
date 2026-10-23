// Shows the 4-week program full screen when it is opened (WS2). Mounted once in
// App.tsx (the "route" line).
//
// This file is in the main bundle, which every landing-page visitor downloads, so
// it imports nothing but React and the tiny open/close store: no flags, no
// program text, no portal code. Everything else is in ProgramView, a lazy chunk
// that is fetched only when the view is opened, and opening is only possible from
// links that exist while hrt_coaching is on. So with the flag off this renders
// nothing and downloads nothing.

import { Suspense, lazy, useSyncExternalStore } from 'react';
import { isProgramOpen, subscribeProgramView } from './programViewState';

const ProgramView = lazy(() => import('./ProgramView').then(m => ({ default: m.ProgramView })));

export function ProgramHost() {
  const open = useSyncExternalStore(subscribeProgramView, isProgramOpen, () => false);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <ProgramView />
    </Suspense>
  );
}
