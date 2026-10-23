import {
  app,
  BrowserWindow,
  nativeImage,
  shell,
  ipcMain,
  Notification,
  powerSaveBlocker,
  session,
  systemPreferences,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import {
  DESKTOP_CHANNEL,
  INITIAL_DESKTOP_STATE,
  isTrustedRendererUrl,
  parseCameraAccess,
  parseDesktopNotification,
  parseDesktopState,
  parseExternalUrl,
  parseLegacyNotify,
  sameDesktopState,
  type CameraAccess,
  type CameraPrompt,
  type CameraStatus,
  type DesktopCommand,
  type DesktopNotification,
  type DesktopState,
} from '../src/desktop/ipc';
import { cameraGate, cameraSettingsUrl, wantsVideo } from '../src/desktop/cameraGate';
import {
  HIDDEN_ARG,
  loginItemSupport,
  reconcileLoginPref,
  shouldStartHidden,
  type DesktopPrefs,
  type LoginItemSupport,
} from '../src/desktop/prefs';
import { pauseMinutes, shouldPreventSuspension, type PauseChoice, type TrayItemId } from '../src/desktop/trayModel';
import { loadPrefs, savePrefs } from './prefsFile';
import { createTray, type TrayController } from './tray';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load .env early so secrets are available before anything else ────────────
// Dev only: the .env sits at the project root. It is deliberately not packaged
// into the app, so a release build carries no secrets.
function loadEnv() {
  const candidates = [
    path.join(__dirname, '..', '..', '.env'),
  ];
  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!(key in process.env)) process.env[key] = val;
      }
      console.log('[main] Loaded env from', envPath);
      break;
    }
  }
}
loadEnv();

// ─── Environment ─────────────────────────────────────────────────────────────

const isDev = !app.isPackaged;
const DEV_ORIGIN = 'http://localhost:5173';
// In prod, load via loadFile() so relative asset paths (./assets/...) resolve correctly
const RENDERER_FILE = path.join(__dirname, '..', 'dist', 'index.html');
// The backend server — hosted in production, local in dev
const API_BASE = isDev
  ? `http://localhost:${process.env.PORT || 3000}`
  : (process.env.API_BASE_URL || 'https://stopbiting.today');

// Custom protocol for OAuth deep-link redirect
const PROTOCOL = 'stopbiting';

// Permissions the page may use. Camera requests additionally go through the
// gate in setupSession(): on macOS the first one waits for the in-app explanation.
const ALLOWED_PERMISSIONS = ['media', 'camera', 'microphone', 'notifications'];

// ─── Keep detection alive while the window is hidden in the tray ─────────────
// Chromium throttles timers, animation frames and media in background and
// covered windows. These switches turn that off for the whole app; the window
// also sets backgroundThrottling: false. Must run before the app is ready.
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
if (process.platform === 'win32') {
  // Windows marks a fully covered window as occluded and stops painting it.
  // appendSwitch replaces an earlier value, so keep whatever was already disabled.
  const alreadyDisabled = app.commandLine.getSwitchValue('disable-features');
  app.commandLine.appendSwitch(
    'disable-features',
    [alreadyDisabled, 'CalculateNativeWinOcclusion'].filter(Boolean).join(','),
  );
}

// ─── Globals ─────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let trayController: TrayController | null = null;
let quitting = false;
let trayHintShown = false;

let desktopState: DesktopState = { ...INITIAL_DESKTOP_STATE };
let prefs: DesktopPrefs = { launchAtLogin: false };
let loginItem: LoginItemSupport = 'unsupported';
let suspendBlockerId: number | null = null;

/** Camera requests from the page that are waiting for the user to read the explanation. */
const heldCameraRequests: Array<(granted: boolean) => void> = [];
/** Notifications still on screen; Electron drops the click handler if the object is collected. */
const liveNotifications = new Set<Notification>();
let lastNotification: { key: string; at: number } | null = null;

// ─── Deep-link / protocol ────────────────────────────────────────────────────

// Register custom protocol so the OAuth callback can redirect to stopbiting://...
// This lets us use the same Google OAuth flow in the desktop app.
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// ─── Single-instance lock ────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  // A second launch (the Start menu, a deep link) brings up the existing window,
  // which may be hidden in the tray.
  app.on('second-instance', (_event, commandLine) => {
    showWindow();
    // On Windows, deep-link URL arrives as the last argv
    const deepLink = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (deepLink) handleDeepLink(deepLink);
  });
}

// ─── Backend server ───────────────────────────────────────────────────────────
// None is started here. Dev runs the server separately (`npm run dev`); the
// packaged app talks to the hosted API (API_BASE above), so no server code or
// secrets ship inside the app bundle.

// ─── Deep-link handler ───────────────────────────────────────────────────────

// Delivers a token to the renderer. Waits for the page to finish loading first
// so executeJavaScript doesn't fire into a blank document.
function deliverTokenToRenderer(token: string) {
  if (!mainWindow) return;

  const inject = () => {
    mainWindow!.webContents.executeJavaScript(
      `(function() {
        localStorage.setItem('nh_token', ${JSON.stringify(token)});
        window.dispatchEvent(new CustomEvent('electron-auth', { detail: { token: ${JSON.stringify(token)} } }));
      })()`
    ).catch((err: unknown) => console.error('[main] executeJavaScript failed:', err));
  };

  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', inject);
  } else {
    inject();
  }
}

function handleDeepLink(url: string) {
  if (!mainWindow) return;

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'auth') return;

    const token = parsed.searchParams.get('token');
    const error = parsed.searchParams.get('error');

    showWindow();

    if (token) {
      deliverTokenToRenderer(token);
    } else if (error) {
      const inject = () => {
        mainWindow!.webContents.executeJavaScript(
          `window.dispatchEvent(new CustomEvent('electron-auth', { detail: { error: ${JSON.stringify(error)} } }))`
        ).catch((err: unknown) => console.error('[main] executeJavaScript failed:', err));
      };
      if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', inject);
      } else {
        inject();
      }
    }
  } catch (err) {
    console.error('Failed to parse deep link URL:', url, err);
  }
}

// ─── Window ───────────────────────────────────────────────────────────────────

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    void createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/** Sends a command to the web app once its page is loaded. */
function sendCommand(command: DesktopCommand) {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  const send = () => win.webContents.send(DESKTOP_CHANNEL.command, command);
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

function sendCameraPrompt(prompt: CameraPrompt) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(DESKTOP_CHANNEL.cameraPrompt, prompt);
  }
}

async function createWindow(startHidden = false) {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 800,
    minHeight: 600,
    title: 'Stop Biting',
    // Use default traffic lights on Mac; we can customise later
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#020617', // matches app background
    webPreferences: {
      // Built as CommonJS (vite.electron.preload.config.ts): a preload script
      // loaded as an ES module runs late and cannot use `require('electron')`.
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload needs `require`; the page never gets Node.
      sandbox: false,
      // Detection must keep running while the window is hidden in the tray.
      backgroundThrottling: false,
    },
    show: false, // show after ready-to-show to avoid white flash
  });

  // Registered before loading: ready-to-show can fire before the load promise resolves.
  mainWindow.once('ready-to-show', () => {
    if (!startHidden) mainWindow?.show();
  });

  // Load the app
  if (isDev) {
    await mainWindow.loadURL(DEV_ORIGIN);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(RENDERER_FILE);
  }

  // When the renderer triggers a Google OAuth navigation, open it in the
  // system browser instead of Electron. Google blocks sign-in inside embedded
  // webviews; using the system browser avoids that and lets us receive the
  // result via the stopbiting:// deep-link callback.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http://localhost') || url.startsWith('file://')) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  // Also handle window.open() calls that try to open external URLs
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // A reload drops the page that asked for the camera.
  mainWindow.webContents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => {
    if (isMainFrame) resolveHeldCameraRequests(false);
  });

  // Hide to the tray instead of closing. Quit (tray menu, Cmd+Q) really quits.
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow?.hide();
      if (!trayHintShown) {
        trayHintShown = true;
        trayController?.balloon('Stop Biting', 'Still watching in the background. Click the tray icon to open it.');
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Session: API redirect and permissions ───────────────────────────────────

function currentCameraAccess(): CameraAccess {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return 'unknown';
  try {
    return parseCameraAccess(systemPreferences.getMediaAccessStatus('camera'));
  } catch {
    return 'unknown';
  }
}

function resolveHeldCameraRequests(granted: boolean) {
  for (const answer of heldCameraRequests.splice(0)) {
    try {
      answer(granted);
    } catch {
      // The page that asked is already gone.
    }
  }
}

function setupSession() {
  // In production the renderer is loaded via file:// so relative fetch('/api/...')
  // calls won't reach the Express server. Intercept them and proxy to the API.
  if (!isDev) {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['file://*'] },
      (details, callback) => {
        const url = new URL(details.url);
        if (url.pathname.startsWith('/api/')) {
          callback({ redirectURL: `${API_BASE}${url.pathname}${url.search}` });
        } else {
          callback({});
        }
      }
    );
  }

  // Grant camera + notification permission inside the app. The macOS camera
  // prompt must not arrive before the in-app explanation, and getUserMedia is
  // what triggers it, so a first request is held here until the user has read
  // the card (see DesktopCameraNotice). Nothing is asked at launch.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (permission === 'media' && wantsVideo(details as { mediaTypes?: readonly string[] })) {
      const access = currentCameraAccess();
      const gate = cameraGate(process.platform, access);
      if (gate === 'explain') {
        heldCameraRequests.push(callback);
        showWindow();
        sendCameraPrompt({ kind: 'explain' });
        return;
      }
      if (gate === 'blocked') {
        sendCameraPrompt({ kind: 'blocked', access });
        if (!mainWindow?.isVisible()) {
          showNotification({
            title: 'Stop Biting',
            body: 'Camera access is off. Open Stop Biting to see how to turn it on.',
            clickAction: 'open',
          });
        }
        callback(false);
        return;
      }
    }
    callback(ALLOWED_PERMISSIONS.includes(permission));
  });

  // Check for permission check handler (Electron 20+)
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return ALLOWED_PERMISSIONS.includes(permission);
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────

const NOTIFICATION_MIN_GAP_MS = 1500;

function showNotification(n: DesktopNotification) {
  if (!Notification.isSupported()) return;
  // The same text twice in a row is a loop in the page, not two events.
  const key = `${n.title}\n${n.body}`;
  const now = Date.now();
  if (lastNotification && lastNotification.key === key && now - lastNotification.at < NOTIFICATION_MIN_GAP_MS) return;
  lastNotification = { key, at: now };

  const note = new Notification({ title: n.title, body: n.body });
  liveNotifications.add(note);
  note.on('click', () => {
    liveNotifications.delete(note);
    showWindow();
    if (n.clickAction === 'start') sendCommand({ type: 'start' });
  });
  note.on('close', () => liveNotifications.delete(note));
  note.show();
}

// ─── Desktop state, tray and login item ──────────────────────────────────────

function refreshTray() {
  trayController?.update({
    state: desktopState,
    launchAtLogin: prefs.launchAtLogin,
    loginItem,
    now: Date.now(),
  });
}

/** Keep the OS from suspending the app while detection runs, so a hidden window keeps watching. */
function syncPowerBlocker() {
  const want = shouldPreventSuspension(desktopState);
  if (want && suspendBlockerId === null) {
    suspendBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  } else if (!want && suspendBlockerId !== null) {
    powerSaveBlocker.stop(suspendBlockerId);
    suspendBlockerId = null;
  }
}

function setDesktopState(next: DesktopState) {
  if (sameDesktopState(desktopState, next)) return;
  desktopState = next;
  refreshTray();
  syncPowerBlocker();
}

/** Windows starts us with --hidden at login so the window stays in the tray. */
function loginItemOptions() {
  return process.platform === 'win32' ? { args: [HIDDEN_ARG] } : {};
}

function readLoginItem(): boolean | null {
  try {
    return app.getLoginItemSettings(loginItemOptions()).openAtLogin;
  } catch {
    return null;
  }
}

function setLaunchAtLogin(on: boolean) {
  if (loginItem !== 'supported') return;
  try {
    app.setLoginItemSettings({ openAtLogin: on, ...loginItemOptions() });
  } catch (err) {
    console.error('[main] setLoginItemSettings failed:', err);
  }
  prefs = { launchAtLogin: on };
  savePrefs(prefs);
  refreshTray();
}

function onTrayAction(id: TrayItemId) {
  switch (id) {
    case 'open':
      showWindow();
      break;
    case 'toggle':
      if (desktopState.watching || desktopState.paused) {
        sendCommand({ type: 'stop' });
      } else {
        // Starting may need the window: sign-in, or the camera explanation.
        showWindow();
        sendCommand({ type: 'start' });
      }
      break;
    case 'pause-15m':
    case 'pause-1h':
    case 'pause-tomorrow': {
      const choice: PauseChoice = id === 'pause-15m' ? '15m' : id === 'pause-1h' ? '1h' : 'tomorrow';
      sendCommand({ type: 'pause', minutes: pauseMinutes(choice, new Date()) });
      break;
    }
    case 'resume':
      sendCommand({ type: 'resume' });
      break;
    case 'login':
      setLaunchAtLogin(!prefs.launchAtLogin);
      break;
    case 'quit':
      quitting = true;
      app.quit();
      break;
    case 'status':
      break;
  }
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

/** Only our own window, showing our own page, may talk to main. */
function fromOurPage(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  if (!mainWindow || event.sender !== mainWindow.webContents) return false;
  return isTrustedRendererUrl(event.senderFrame?.url, isDev ? DEV_ORIGIN : null);
}

function setupIPC() {
  // Renderer asks to send a native OS notification (the older electronAPI.notify)
  ipcMain.on('notify', (event, payload: unknown) => {
    if (!fromOurPage(event)) return;
    const note = parseLegacyNotify(payload);
    if (note) showNotification(note);
  });

  // Renderer asks to open an external URL (e.g. Paddle checkout). Web links only.
  ipcMain.on('open-external', (event, url: unknown) => {
    if (!fromOurPage(event)) return;
    const safe = parseExternalUrl(url);
    if (safe) shell.openExternal(safe);
  });

  // Renderer asks to start Google OAuth — fetch the redirect URL from the
  // API server and open it in the system browser (never inside Electron).
  ipcMain.handle('open-google-auth', async (event) => {
    if (!fromOurPage(event)) return;
    try {
      // Follow the redirect from /api/auth/google to get the actual Google URL
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        redirect: 'manual',
      });
      const googleUrl = res.headers.get('location');
      if (googleUrl) {
        shell.openExternal(googleUrl);
      }
    } catch (err) {
      console.error('Failed to get Google auth URL:', err);
    }
  });

  // Renderer reports a bite alert so we can show tray notification when window is hidden
  ipcMain.on('bite-detected', (event) => {
    if (!fromOurPage(event)) return;
    if (!mainWindow?.isVisible()) {
      showNotification({ title: 'Stop Biting', body: 'Stop biting your nails!', clickAction: 'open' });
    }
  });

  // ── Desktop shell (src/desktop/ipc.ts) ────────────────────────────────────
  ipcMain.on(DESKTOP_CHANNEL.state, (event, payload: unknown) => {
    if (!fromOurPage(event)) return;
    const next = parseDesktopState(payload);
    if (next) setDesktopState(next);
  });

  ipcMain.on(DESKTOP_CHANNEL.notify, (event, payload: unknown) => {
    if (!fromOurPage(event)) return;
    const note = parseDesktopNotification(payload);
    if (note) showNotification(note);
  });

  ipcMain.handle(DESKTOP_CHANNEL.cameraStatus, (event): CameraStatus => {
    if (!fromOurPage(event)) return { access: 'unknown', pending: false };
    return { access: currentCameraAccess(), pending: heldCameraRequests.length > 0 };
  });

  // The user pressed Continue on the explanation: now the OS may ask.
  ipcMain.handle(DESKTOP_CHANNEL.cameraRequest, async (event): Promise<boolean> => {
    if (!fromOurPage(event)) return false;
    let granted = true;
    if (process.platform === 'darwin') {
      try {
        granted = await systemPreferences.askForMediaAccess('camera');
      } catch {
        granted = false;
      }
    }
    resolveHeldCameraRequests(granted);
    if (!granted) sendCameraPrompt({ kind: 'blocked', access: currentCameraAccess() });
    return granted;
  });

  // The user pressed Not now.
  ipcMain.on(DESKTOP_CHANNEL.cameraDecline, (event) => {
    if (!fromOurPage(event)) return;
    resolveHeldCameraRequests(false);
  });

  ipcMain.on(DESKTOP_CHANNEL.cameraOpenSettings, (event) => {
    if (!fromOurPage(event)) return;
    const url = cameraSettingsUrl(process.platform);
    if (url) shell.openExternal(url);
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.on('ready', async () => {
  if (!gotLock) return; // a second instance is quitting
  // Set dock icon explicitly on macOS (prevents white square)
  if (process.platform === 'darwin') {
    const iconPath = isDev
      ? path.join(__dirname, '..', 'public', 'icons', 'icon-512x512.png')
      : path.join(__dirname, '..', 'dist', 'icons', 'icon-512x512.png');
    if (existsSync(iconPath)) {
      app.dock?.setIcon(nativeImage.createFromPath(iconPath));
    }
  }

  // Launch at login: default off. The OS is the truth when it can answer.
  loginItem = loginItemSupport({ platform: process.platform, isPackaged: app.isPackaged, env: process.env });
  prefs = loadPrefs();
  if (loginItem === 'supported') {
    const reconciled = reconcileLoginPref(prefs.launchAtLogin, readLoginItem());
    if (reconciled !== prefs.launchAtLogin) {
      prefs = { launchAtLogin: reconciled };
      savePrefs(prefs);
    }
  }
  const startHidden = shouldStartHidden({
    argv: process.argv,
    wasOpenedAtLogin: process.platform === 'darwin' ? app.getLoginItemSettings().wasOpenedAtLogin : false,
  });

  setupSession();
  setupIPC();
  trayController = createTray({
    onAction: onTrayAction,
    onClick: () => {
      if (mainWindow?.isVisible()) mainWindow.focus();
      else showWindow();
    },
    initial: { state: desktopState, launchAtLogin: prefs.launchAtLogin, loginItem, now: Date.now() },
  });
  await createWindow(startHidden);
});

// macOS: re-create window when dock icon is clicked and no windows exist
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  } else {
    showWindow();
  }
});

// macOS: handle deep-link from protocol (launched via stopbiting://...)
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

app.on('before-quit', () => {
  quitting = true;
});

// On Windows/Linux, quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    quitting = true;
    app.quit();
  }
});
