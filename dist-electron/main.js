import { app, BrowserWindow, ipcMain, Notification, shell, systemPreferences, session, nativeImage, Tray, Menu } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  const candidates = [
    // Production: Resources/.env (next to app.asar)
    path.join(__dirname$1, "..", ".env"),
    // Dev: project root
    path.join(__dirname$1, "..", "..", ".env")
  ];
  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (!(key in process.env)) process.env[key] = val;
      }
      console.log("[main] Loaded env from", envPath);
      break;
    }
  }
}
loadEnv();
const isDev = !app.isPackaged;
const RENDERER_FILE = path.join(__dirname$1, "..", "dist", "index.html");
const API_BASE = isDev ? `http://localhost:${process.env.PORT || 3e3}` : process.env.API_BASE_URL || "http://localhost:3000";
const SERVER_PORT = 3e3;
const PROTOCOL = "nailhabit";
let mainWindow = null;
let tray = null;
let serverProcess = null;
let quitting = false;
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const deepLink = commandLine.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (deepLink) handleDeepLink(deepLink);
  });
}
function startBackendServer() {
  var _a, _b;
  if (isDev) return;
  if (process.env.API_BASE_URL) {
    console.log("[main] Using hosted API at", process.env.API_BASE_URL);
    return;
  }
  const serverPath = path.join(__dirname$1, "server.js");
  if (!existsSync(serverPath)) {
    console.error("Bundled server not found at", serverPath);
    return;
  }
  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      APP_URL: `http://localhost:${SERVER_PORT}`,
      ELECTRON_PROTOCOL: PROTOCOL
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  (_a = serverProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
    console.log("[server]", data.toString().trim());
  });
  (_b = serverProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
    console.error("[server]", data.toString().trim());
  });
  serverProcess.on("exit", (code) => {
    console.log("[server] exited with code", code);
    serverProcess = null;
  });
}
function stopBackendServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}
function deliverTokenToRenderer(token) {
  if (!mainWindow) return;
  const inject = () => {
    mainWindow.webContents.executeJavaScript(
      `(function() {
        localStorage.setItem('nh_token', ${JSON.stringify(token)});
        window.dispatchEvent(new CustomEvent('electron-auth', { detail: { token: ${JSON.stringify(token)} } }));
      })()`
    ).catch((err) => console.error("[main] executeJavaScript failed:", err));
  };
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once("did-finish-load", inject);
  } else {
    inject();
  }
}
function handleDeepLink(url) {
  if (!mainWindow) return;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "auth") return;
    const token = parsed.searchParams.get("token");
    const error = parsed.searchParams.get("error");
    mainWindow.show();
    mainWindow.focus();
    if (token) {
      deliverTokenToRenderer(token);
    } else if (error) {
      const inject = () => {
        mainWindow.webContents.executeJavaScript(
          `window.dispatchEvent(new CustomEvent('electron-auth', { detail: { error: ${JSON.stringify(error)} } }))`
        ).catch((err) => console.error("[main] executeJavaScript failed:", err));
      };
      if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once("did-finish-load", inject);
      } else {
        inject();
      }
    }
  } catch (err) {
    console.error("Failed to parse deep link URL:", url, err);
  }
}
async function createWindow() {
  if (process.platform === "darwin") {
    const status = systemPreferences.getMediaAccessStatus("camera");
    if (status !== "granted") {
      await systemPreferences.askForMediaAccess("camera");
    }
  }
  if (!isDev) {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["file://*"] },
      (details, callback) => {
        const url = new URL(details.url);
        if (url.pathname.startsWith("/api/")) {
          callback({ redirectURL: `${API_BASE}${url.pathname}${url.search}` });
        } else {
          callback({});
        }
      }
    );
  }
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 800,
    minHeight: 600,
    title: "Nail Habit Tracker",
    // Use default traffic lights on Mac; we can customise later
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#020617",
    // matches app background
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow camera access from the renderer
      // (Electron 22+ requires explicit permission grants)
      sandbox: false
    },
    show: false
    // show after ready-to-show to avoid white flash
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ["media", "camera", "microphone", "notifications"];
    callback(allowed.includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ["media", "camera", "microphone", "notifications"];
    return allowed.includes(permission);
  });
  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(RENDERER_FILE);
  }
  mainWindow.once("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("http://localhost") || url.startsWith("file://")) return;
    event.preventDefault();
    shell.openExternal(url);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith("http://localhost") && !url.startsWith("file://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow == null ? void 0 : mainWindow.hide();
      if (process.platform === "win32") {
        tray == null ? void 0 : tray.displayBalloon({
          title: "Nail Habit Tracker",
          content: "Still watching in the background. Click the tray icon to restore."
        });
      }
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function createTray() {
  const iconPath = isDev ? path.join(__dirname$1, "..", "public", "icons", "icon-32x32.png") : path.join(__dirname$1, "..", "dist", "icons", "icon-32x32.png");
  const iconExists = existsSync(iconPath);
  const img = iconExists ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  if (process.platform === "darwin" && !img.isEmpty()) {
    img.setTemplateImage(true);
  }
  tray = new Tray(img);
  tray.setToolTip("Nail Habit Tracker");
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show App",
      click: () => {
        mainWindow == null ? void 0 : mainWindow.show();
        mainWindow == null ? void 0 : mainWindow.focus();
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        quitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow == null ? void 0 : mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow == null ? void 0 : mainWindow.show();
    }
  });
}
function setupIPC() {
  ipcMain.on("notify", (_event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });
  ipcMain.on("open-external", (_event, url) => {
    shell.openExternal(url);
  });
  ipcMain.handle("open-google-auth", async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        redirect: "manual"
      });
      const googleUrl = res.headers.get("location");
      if (googleUrl) {
        shell.openExternal(googleUrl);
      }
    } catch (err) {
      console.error("Failed to get Google auth URL:", err);
    }
  });
  ipcMain.on("bite-detected", () => {
    if (!(mainWindow == null ? void 0 : mainWindow.isVisible())) {
      if (Notification.isSupported()) {
        new Notification({
          title: "Nail Habit Tracker",
          body: "Stop biting your nails!"
        }).show();
      }
    }
  });
}
app.on("ready", async () => {
  startBackendServer();
  setupIPC();
  await createWindow();
  createTray();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow == null ? void 0 : mainWindow.show();
  }
});
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});
app.on("before-quit", () => {
  quitting = true;
  stopBackendServer();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    quitting = true;
    app.quit();
  }
});
//# sourceMappingURL=main.js.map
