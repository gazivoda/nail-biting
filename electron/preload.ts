/**
 * Electron Preload Script
 *
 * Runs in the renderer process with Node.js access but is isolated from the
 * renderer via contextIsolation: true. Exposes a safe, narrow IPC bridge
 * to the renderer via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

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
