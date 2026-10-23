/**
 * Renderer side of the desktop shell (WS7b): turns tray commands into a DOM
 * event and reports the app's state back so the tray menu can show it.
 *
 * Everything the bridge touches comes in through `BridgeDeps`, so the logic is
 * tested in node with fakes. `desktopHost.tsx` wires the real `window.desktop`,
 * `window` and the app store, and only runs when `window.desktop` exists.
 *
 * Commands:  tray -> `api.onCommand` -> 'stopbiting:desktop-command' (cancelable)
 *            -> unless a listener called preventDefault(): start/stop switch the
 *            camera on/off (what the Start/Stop buttons already do). `pause` and
 *            `resume` have no default action: the pause feature (WS7a) listens.
 * State:     the app store + 'stopbiting:desktop-state' -> `api.sendState`.
 */

import {
  DESKTOP_COMMAND_EVENT,
  DESKTOP_STATE_EVENT,
  parsePauseDetail,
} from './events';
import { sameDesktopState, type DesktopAPI, type DesktopCommand, type DesktopState } from './ipc';

export type AppSnapshot = {
  /** The user's on/off switch for the camera (store `cameraEnabled`). */
  cameraEnabled: boolean;
  /** The detection loop is running (store `detecting`). */
  detecting: boolean;
};

export type BridgeDeps = {
  api: Pick<DesktopAPI, 'onCommand' | 'sendState'>;
  target: EventTarget;
  getApp(): AppSnapshot;
  /** Calls `listener` whenever the app snapshot may have changed. Returns the unsubscribe. */
  subscribeApp(listener: () => void): () => void;
  setCameraEnabled(enabled: boolean): void;
  /** Overridable for tests. */
  schedule?: (fn: () => void, ms: number) => unknown;
};

export type DesktopBridge = {
  dispose(): void;
  /** The last state sent to the tray. */
  getState(): DesktopState;
};

/** Same pause CameraView's retry button waits before switching the camera back on. */
const RESTART_DELAY_MS = 300;

export function createDesktopBridge(deps: BridgeDeps): DesktopBridge {
  const { api, target, getApp, subscribeApp, setCameraEnabled } = deps;
  const schedule = deps.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));

  let pause = { paused: false, pausedUntil: null as number | null, supported: false };
  let last: DesktopState | null = null;

  function compute(): DesktopState {
    return {
      watching: getApp().detecting,
      paused: pause.paused,
      pausedUntil: pause.paused ? pause.pausedUntil : null,
      pauseSupported: pause.supported,
    };
  }

  function publish() {
    const next = compute();
    if (last && sameDesktopState(last, next)) return;
    last = next;
    api.sendState(next);
  }

  function defaultAction(command: DesktopCommand) {
    if (command.type === 'stop') {
      setCameraEnabled(false);
      return;
    }
    if (command.type === 'start') {
      const app = getApp();
      if (app.cameraEnabled && !app.detecting) {
        // Switched on but not running (camera error, models failed): the same
        // off-then-on the Retry button does, so Start from the tray really retries.
        setCameraEnabled(false);
        schedule(() => setCameraEnabled(true), RESTART_DELAY_MS);
      } else {
        setCameraEnabled(true);
      }
    }
    // 'pause' and 'resume': WS7a.
  }

  const stopCommands = api.onCommand((command) => {
    const event = new CustomEvent<DesktopCommand>(DESKTOP_COMMAND_EVENT, {
      detail: command,
      cancelable: true,
    });
    const notHandled = target.dispatchEvent(event);
    if (notHandled) defaultAction(command);
  });

  const onPauseState = (event: Event) => {
    const parsed = parsePauseDetail((event as CustomEvent).detail);
    if (!parsed) return;
    pause = { paused: parsed.paused, pausedUntil: parsed.pausedUntil, supported: true };
    publish();
  };
  target.addEventListener(DESKTOP_STATE_EVENT, onPauseState);

  const stopApp = subscribeApp(publish);

  publish();

  return {
    dispose() {
      stopCommands();
      stopApp();
      target.removeEventListener(DESKTOP_STATE_EVENT, onPauseState);
    },
    getState: () => last ?? compute(),
  };
}
