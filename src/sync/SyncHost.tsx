// Mounted once in the signed-in app (App.tsx, one line). Renders nothing, and
// costs nothing, unless the person signed in right now has switched sync on:
//   - it reads one local value (no network, no feature-flag request);
//   - only then does it fetch the SyncRunner chunk, which checks the flag and
//     starts the engine.
// So with every flag off, or with sync never switched on, this is a no-op.

import { Suspense, lazy, useSyncExternalStore } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getOptedInUserId, subscribeSyncOptIn } from './optIn';

const SyncRunner = lazy(() => import('./SyncRunner'));

export function SyncHost() {
  const { user } = useAuth();
  const optedIn = useSyncExternalStore(subscribeSyncOptIn, getOptedInUserId, () => null);
  if (!user || optedIn !== user.id) return null;
  return (
    <Suspense fallback={null}>
      <SyncRunner userId={user.id} />
    </Suspense>
  );
}
