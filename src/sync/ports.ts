// Connects the engine to the real app: history through the `events` facade of
// the storage module (never the store or localStorage directly), the transport
// through the app's `apiFetch`, the clock and timers from the browser.
//
// This file pulls in the app store (via src/storage), so it is only imported by
// code that runs for a signed-in app session that has already opted in (the lazy
// SyncRunner chunk) and by the Settings sections.

import { events, getDeviceId } from '../storage';
import { isFeatureOn } from '../features/flags';
import { createSyncEngine, type SyncEngine } from './engine';
import { createEngineTransport } from './api';
import { apiFetchRequest } from './apiFetchRequest';
import { createBrowserEnvironment } from './browser';
import { createSyncController, type SyncController } from './controller';
import { clearSyncOptIn, getOptedInUserId, setSyncNotice, syncKv } from './optIn';
import { setActiveEngine } from './runtime';
import type { SyncStorePort } from './types';

/** The `events` facade as the engine's history port. */
export function createFacadePort(facade: Pick<typeof events, 'list' | 'merge' | 'subscribe'>): SyncStorePort {
  return {
    listAll: () => facade.list({ includeDeleted: true }),
    merge: incoming => facade.merge(incoming),
    subscribe: fn => facade.subscribe(fn),
  };
}

export function createProductionEngine(userId: string): SyncEngine {
  const env = createBrowserEnvironment();
  return createSyncEngine({
    userId,
    deviceId: getDeviceId(),
    store: createFacadePort(events),
    kv: syncKv,
    transport: createEngineTransport(apiFetchRequest),
    // Checked before every cycle: switching sync off, or the owner switching the
    // feature off, stops the very next attempt.
    isEnabled: () => getOptedInUserId() === userId && isFeatureOn('event_sync'),
    isOnline: env.isOnline,
    now: () => Date.now(),
    timers: {
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      clearTimeout: handle => window.clearTimeout(handle as number),
    },
    onServerReset: () => {
      // Synced data was deleted from another device. Do not upload again by stealth:
      // switch sync off and tell the person next time they open Settings.
      setSyncNotice('server_reset');
      clearSyncOptIn();
    },
  });
}

export function createProductionController(): SyncController {
  return createSyncController({
    createEngine: createProductionEngine,
    env: createBrowserEnvironment(),
    onActiveChange: setActiveEngine,
  });
}
