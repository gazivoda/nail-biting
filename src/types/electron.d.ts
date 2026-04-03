/**
 * Type declarations for the Electron preload API exposed via contextBridge.
 * Available at window.electronAPI when running inside the Electron shell.
 * Undefined in the browser / PWA context.
 */

interface ElectronAPI {
  /** Send a native OS notification */
  notify: (title: string, body: string) => void;
  /** Inform main process of a detected nail bite */
  onBiteDetected: () => void;
  /** Open a URL in the system browser */
  openExternal: (url: string) => void;
  /** Open Google OAuth in the system browser (main process fetches the URL) */
  openGoogleAuth: () => Promise<void>;
  /** Always true — used to detect the Electron runtime */
  isElectron: true;
}

interface Window {
  electronAPI?: ElectronAPI;
}
