// Runs the sync engine for the signed-in person who opted in. A lazy chunk: it
// is only ever fetched when SyncHost finds an opt-in, so everyone else
// downloads none of the sync code.
//
// The effect is the whole lifecycle: mount starts the engine, unmount (sign-out,
// opt-out, leaving the app) stops it and removes its listeners. The flag is read
// here, not in SyncHost, so a person who never opted in never triggers the
// /api/features request on account of sync.

import { useEffect } from 'react';
import { useFeature } from '../features/useFeature';
import { createProductionController } from './ports';

export default function SyncRunner({ userId }: { userId: string }) {
  const flagOn = useFeature('event_sync');

  useEffect(() => {
    const controller = createProductionController();
    controller.update({ userId, flagOn, optInUserId: userId });
    return () => controller.dispose();
  }, [userId, flagOn]);

  return null;
}
