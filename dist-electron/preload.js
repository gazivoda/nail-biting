import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  /** Send a native OS notification */
  notify: (title, body) => {
    ipcRenderer.send("notify", { title, body });
  },
  /** Inform main process that a bite was detected (for tray notification when minimised) */
  onBiteDetected: () => {
    ipcRenderer.send("bite-detected");
  },
  /** Open a URL in the system browser */
  openExternal: (url) => {
    ipcRenderer.send("open-external", url);
  },
  /** Open Google OAuth in the system browser (avoids embedded webview block) */
  openGoogleAuth: () => {
    return ipcRenderer.invoke("open-google-auth");
  },
  /** Whether we're running inside Electron (renderer can use this to detect desktop mode) */
  isElectron: true
});
//# sourceMappingURL=preload.js.map
