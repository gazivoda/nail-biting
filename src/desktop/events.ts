/**
 * The two DOM events that connect the desktop shell to the web app (WS7b).
 * Nothing here knows about Electron, so any module may import it; in a browser
 * the events simply have no listener.
 *
 *   tray / notification click -> bridge -> 'stopbiting:desktop-command' on `window`
 *   pause feature (WS7a)      -> 'stopbiting:desktop-state'   on `window` -> bridge -> tray
 *
 * Contract and ownership: docs/agents/ws7b-notes.md.
 */

import type { DesktopCommand } from './ipc';

/** `detail` is a `DesktopCommand`. Cancelable: `preventDefault()` means "I handled it". */
export const DESKTOP_COMMAND_EVENT = 'stopbiting:desktop-command';

/** `detail` is a `DesktopPauseDetail`. */
export const DESKTOP_STATE_EVENT = 'stopbiting:desktop-state';

export type DesktopCommandDetail = DesktopCommand;

/**
 * What the pause feature reports. The first report also tells the tray that
 * pausing exists, which enables its pause items.
 */
export type DesktopPauseDetail = {
  paused: boolean;
  /** Epoch ms when the pause ends. Omit or null when not paused. */
  pausedUntil?: number | null;
};

/** Report the pause state to the tray. Safe to call in a browser: nothing listens. */
export function reportPauseState(
  detail: DesktopPauseDetail,
  target: EventTarget = window,
): void {
  target.dispatchEvent(new CustomEvent<DesktopPauseDetail>(DESKTOP_STATE_EVENT, { detail }));
}

/** Parses a `DESKTOP_STATE_EVENT` detail. */
export function parsePauseDetail(raw: unknown): { paused: boolean; pausedUntil: number | null } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { paused, pausedUntil } = raw as Record<string, unknown>;
  if (typeof paused !== 'boolean') return null;
  if (pausedUntil !== undefined && pausedUntil !== null) {
    if (typeof pausedUntil !== 'number' || !Number.isFinite(pausedUntil) || pausedUntil < 0) return null;
    return { paused, pausedUntil: paused ? pausedUntil : null };
  }
  return { paused, pausedUntil: null };
}
