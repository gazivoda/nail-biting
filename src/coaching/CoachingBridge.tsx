// Connects the app's history to the coaching prompt (WS2). Mounted only while
// the hrt_coaching flag is on (CoachingDashboardSlot), inside the Dashboard,
// which is always mounted so it keeps working on every tab. Renders nothing.
//
// All of the behaviour, and the argument for why it cannot get in the way of the
// alarm, is in ./watcher.ts and is tested there.

import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { events } from '../storage';
import { startCoachingWatcher } from './watcher';

export function CoachingBridge() {
  useEffect(
    () =>
      startCoachingWatcher({
        getIncidents: () => useAppStore.getState().incidents,
        subscribe: listener => useAppStore.subscribe(() => listener()),
        // Saved through the storage module, as a change to the alarm's own event.
        save: (eventId, patch) => { events.update(eventId, { competingResponse: patch }); },
      }),
    [],
  );
  return null;
}
