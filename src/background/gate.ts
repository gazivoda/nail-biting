// What the Watch tab, the camera and the mini window read to know about a pause or a meeting (WS7a).
//
// `useWatchGate()` is the whole interface. With the `background_watching` flag off it returns one shared constant
// ("running, not paused, not silent") and subscribes to nothing, so the flag-off app renders and behaves as it always
// did and the stored state is never even read.

import { useMemo, useSyncExternalStore } from 'react';
import { useFeatures } from '../features/useFeature';
import { useLocaleVersion } from '../i18n/hooks';
import { getWatchStamp, getWatchState, subscribeWatch } from './watchStore';
import { INITIAL_WATCH_STATE, type WatchState } from './pauseMachine';
import { watchNote, type WatchNote } from './watchText';

export interface WatchGate {
  /** The flag is on. */
  on: boolean;
  state: WatchState;
  paused: boolean;
  /** Meeting mode: alarms are silent. */
  silent: boolean;
  /** The words for a pause or meeting (headline, sentence, short form), or null. */
  note: WatchNote | null;
}

const OFF: WatchGate = { on: false, state: INITIAL_WATCH_STATE, paused: false, silent: false, note: null };

const noSubscribe = () => () => {};
const offSnapshot = () => INITIAL_WATCH_STATE;
const offStamp = () => 0;

export function useWatchGate(): WatchGate {
  const on = useFeatures().background_watching;
  // The app is rendered on the client only (createRoot), so the server snapshot is the same as the client one.
  // That also lets the tests render it with react-dom/server.
  const read = on ? getWatchState : offSnapshot;
  const readStamp = on ? getWatchStamp : offStamp;
  const state = useSyncExternalStore(on ? subscribeWatch : noSubscribe, read, read);
  const stamp = useSyncExternalStore(on ? subscribeWatch : noSubscribe, readStamp, readStamp);
  // The words of the note are made in the language shown now, so a language change makes them again.
  const language = useLocaleVersion();
  return useMemo<WatchGate>(
    () => (on ? { on, state, paused: state.kind === 'paused', silent: state.kind === 'meeting', note: watchNote(state, stamp) } : OFF),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `language` is a dependency on purpose: the note's words change with it
    [on, state, stamp, language],
  );
}
