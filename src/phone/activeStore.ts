// The few facts about the phone view that more than one component must agree on
// (Dashboard shows it, the tab bar and the install guide word themselves for
// it). Module state, no flags or storage import, so the tab bar that sits in the
// main bundle can read it without pulling the flag registry in with it.
//
// Nothing here is persisted: "the phone view is showing", "the person chose the
// full app" and "the browser said there is no webcam" are all per page load.

import { useSyncExternalStore } from 'react';

interface PhoneViewState {
  /** The phone view is what Dashboard is rendering right now. */
  active: boolean;
  /** "Open the full app" was pressed in this page load. */
  fullApp: boolean;
  /** hasNoWebcam's answer; null = not asked yet. */
  noWebcam: boolean | null;
}

let state: PhoneViewState = { active: false, fullApp: false, noWebcam: null };
const listeners = new Set<() => void>();

function set(patch: Partial<PhoneViewState>) {
  const next = { ...state, ...patch };
  if (next.active === state.active && next.fullApp === state.fullApp && next.noWebcam === state.noWebcam) return;
  state = next;
  listeners.forEach(fn => fn());
}

export const getPhoneViewState = (): PhoneViewState => state;
export function subscribePhoneView(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export const setPhoneViewActive = (active: boolean) => set({ active });
export const setFullApp = (fullApp: boolean) => set({ fullApp });
export const setNoWebcam = (noWebcam: boolean | null) => set({ noWebcam });

const SERVER_STATE: PhoneViewState = { active: false, fullApp: false, noWebcam: null };

export function usePhoneViewState(): PhoneViewState {
  return useSyncExternalStore(subscribePhoneView, getPhoneViewState, () => SERVER_STATE);
}

/** True while the phone view is showing. For chrome that words itself for it (tab label, install guide). */
export function usePhoneViewActive(): boolean {
  return usePhoneViewState().active;
}

/** Tests only. */
export function resetPhoneViewForTests(): void {
  state = { active: false, fullApp: false, noWebcam: null };
  listeners.clear();
}
