import { contextBridge, ipcRenderer } from "electron";
//#region electron/preload.ts
/**
* Electron Preload Script
*
* Runs in the renderer process with Node.js access but is isolated from the
* renderer via contextIsolation: true. Exposes a safe, narrow IPC bridge
* to the renderer via contextBridge.
*/
contextBridge.exposeInMainWorld("electronAPI", {
	notify: (title, body) => {
		ipcRenderer.send("notify", {
			title,
			body
		});
	},
	onBiteDetected: () => {
		ipcRenderer.send("bite-detected");
	},
	openExternal: (url) => {
		ipcRenderer.send("open-external", url);
	},
	openGoogleAuth: () => {
		return ipcRenderer.invoke("open-google-auth");
	},
	isElectron: true
});
//#endregion

//# sourceMappingURL=preload.js.map