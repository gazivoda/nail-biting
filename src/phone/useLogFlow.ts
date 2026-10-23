// Binds the pure log flow (./logFlow.ts) to the real storage module, WS2's urge
// logging and the browser clock, and exposes it to React.

import { useState, useSyncExternalStore } from 'react';
import { events } from '../storage';
import { logUrge, undoUrge } from '../coaching/urgeLog';
import { createLogFlow, type LogFlow, type LogToast } from './logFlow';

export function createBrowserLogFlow(): LogFlow {
  return createLogFlow({
    events,
    urge: { log: logUrge, undo: undoUrge },
    now: () => Date.now(),
    schedule: (fn, ms) => window.setTimeout(fn, ms),
    cancel: handle => window.clearTimeout(handle as number),
  });
}

/** One flow per mounted phone view, and the toast it is showing (null = none). */
export function useLogFlow(): { flow: LogFlow; toast: LogToast | null } {
  const [flow] = useState(createBrowserLogFlow);
  const toast = useSyncExternalStore(flow.subscribe, flow.getToast, () => null);
  return { flow, toast };
}
