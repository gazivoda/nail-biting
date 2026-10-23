/**
 * Electron Preload Script
 *
 * Runs in the renderer process with Node.js access but is isolated from the
 * page via contextIsolation: true. Exposes a safe, narrow IPC bridge to the
 * renderer via contextBridge:
 *
 *   window.electronAPI  the original API (notify, openExternal, sign-in, bite alert)
 *   window.desktop      the desktop shell API (tray commands and state, native
 *                       notifications, camera access), typed in src/desktop/ipc.ts
 *
 * Built as CommonJS (vite.electron.preload.config.ts, output preload.cjs).
 * Nothing from `electron` is handed to the page: every function below wraps one
 * channel, and what comes back from main is parsed first.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  DESKTOP_CHANNEL,
  parseCameraAccess,
  parseCameraPrompt,
  parseDesktopCommand,
  parseDesktopNotification,
  parseDesktopState,
  type CameraPrompt,
  type CameraStatus,
  type DesktopAPI,
  type DesktopCommand,
  type DesktopPlatform,
} from '../src/desktop/ipc';

// The API surface exposed to the React app at window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  /** Send a native OS notification */
  notify: (title: string, body: string) => {
    ipcRenderer.send('notify', { title, body });
  },

  /** Inform main process that a bite was detected (for tray notification when minimised) */
  onBiteDetected: () => {
    ipcRenderer.send('bite-detected');
  },

  /** Open a URL in the system browser */
  openExternal: (url: string) => {
    ipcRenderer.send('open-external', url);
  },

  /** Open Google OAuth in the system browser (avoids embedded webview block) */
  openGoogleAuth: (): Promise<void> => {
    return ipcRenderer.invoke('open-google-auth');
  },

  /** Whether we're running inside Electron (renderer can use this to detect desktop mode) */
  isElectron: true,
});

/** Subscribes to a main -> renderer channel; `parse` decides what the page may see. */
function subscribe<T>(channel: string, parse: (raw: unknown) => T | null, callback: (value: T) => void): () => void {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event: IpcRendererEvent, raw: unknown) => {
    const value = parse(raw);
    if (value !== null) callback(value);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const platform: DesktopPlatform =
  process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'linux';

const desktop: DesktopAPI = {
  platform,

  onCommand: (callback: (command: DesktopCommand) => void) =>
    subscribe(DESKTOP_CHANNEL.command, parseDesktopCommand, callback),

  sendState: (state) => {
    const parsed = parseDesktopState(state);
    if (parsed) ipcRenderer.send(DESKTOP_CHANNEL.state, parsed);
  },

  notify: (notification) => {
    const parsed = parseDesktopNotification(notification);
    if (parsed) ipcRenderer.send(DESKTOP_CHANNEL.notify, parsed);
  },

  camera: {
    status: async (): Promise<CameraStatus> => {
      const reply: unknown = await ipcRenderer.invoke(DESKTOP_CHANNEL.cameraStatus);
      const r = (typeof reply === 'object' && reply !== null ? reply : {}) as Record<string, unknown>;
      return { access: parseCameraAccess(r.access), pending: r.pending === true };
    },
    request: async (): Promise<boolean> => (await ipcRenderer.invoke(DESKTOP_CHANNEL.cameraRequest)) === true,
    decline: () => {
      ipcRenderer.send(DESKTOP_CHANNEL.cameraDecline);
    },
    openSettings: () => {
      ipcRenderer.send(DESKTOP_CHANNEL.cameraOpenSettings);
    },
    onPrompt: (callback: (prompt: CameraPrompt) => void) =>
      subscribe(DESKTOP_CHANNEL.cameraPrompt, parseCameraPrompt, callback),
  },
};

contextBridge.exposeInMainWorld('desktop', desktop);
