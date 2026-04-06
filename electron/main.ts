import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  shell,
  ipcMain,
  Notification,
  session,
  systemPreferences,
} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { existsSync, readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load .env early so secrets are available before anything else ────────────
// In dev the .env sits at the project root; in production it's copied into
// the app's Resources directory alongside the asar by electron-builder.
function loadEnv() {
  const candidates = [
    // Production: Resources/.env (next to app.asar)
    path.join(__dirname, '..', '.env'),
    // Dev: project root
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
// In prod, load via loadFile() so relative asset paths (./assets/...) resolve correctly
const RENDERER_FILE = path.join(__dirname, '..', 'dist', 'index.html');
// The backend server — hosted in production, local in dev
const API_BASE = isDev
  ? `http://localhost:${process.env.PORT || 3000}`
  : (process.env.API_BASE_URL || 'https://stopbiting.today');
// Derive port for local dev proxy
const SERVER_PORT = 3000;

// Custom protocol for OAuth deep-link redirect
const PROTOCOL = 'stopbiting';

// ─── Globals ─────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: ChildProcess | null = null;
let quitting = false;

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
  // If a second instance is launched (e.g. OS deep-link), focus the existing window
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // On Windows, deep-link URL arrives as the last argv
    const deepLink = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (deepLink) handleDeepLink(deepLink);
  });
}

// ─── Backend server ───────────────────────────────────────────────────────────

function startBackendServer() {
  // In development, assume the server is started separately with `npm run dev`
  if (isDev) return;

  // In production, if API_BASE_URL is set, we use the hosted server — no local process needed.
  if (process.env.API_BASE_URL) {
    console.log('[main] Using hosted API at', process.env.API_BASE_URL);
    return;
  }

  // Fallback: spawn a local server (only if no hosted API is configured)
  const serverPath = path.join(__dirname, 'server.js');
  if (!existsSync(serverPath)) {
    console.error('Bundled server not found at', serverPath);
    return;
  }

  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      APP_URL: `http://localhost:${SERVER_PORT}`,
      ELECTRON_PROTOCOL: PROTOCOL,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout?.on('data', (data: Buffer) => {
    console.log('[server]', data.toString().trim());
  });
  serverProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[server]', data.toString().trim());
  });
  serverProcess.on('exit', (code) => {
    console.log('[server] exited with code', code);
    serverProcess = null;
  });
}

function stopBackendServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

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

    mainWindow.show();
    mainWindow.focus();

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

async function createWindow() {
  // Request camera permission before the window opens on macOS
  // (on Windows this is handled by the OS permission dialog when getUserMedia fires)
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('camera');
    if (status !== 'granted') {
      await systemPreferences.askForMediaAccess('camera');
    }
  }

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow camera access from the renderer
      // (Electron 22+ requires explicit permission grants)
      sandbox: false,
    },
    show: false, // show after ready-to-show to avoid white flash
  });

  // Grant camera + microphone permission automatically inside the app
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'camera', 'microphone', 'notifications'];
    callback(allowed.includes(permission));
  });

  // Check for permission check handler (Electron 20+)
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ['media', 'camera', 'microphone', 'notifications'];
    return allowed.includes(permission);
  });

  // Load the app
  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(RENDERER_FILE);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // When the renderer triggers a Google OAuth navigation, open it in the
  // system browser instead of Electron. Google blocks sign-in inside embedded
  // webviews; using the system browser avoids that and lets us receive the
  // result via the nailhabit:// deep-link callback.
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

  // Minimise to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow?.hide();
      // Show a one-time balloon/notification telling the user the app is in the tray
      if (process.platform === 'win32') {
        tray?.displayBalloon({
          title: 'Stop Biting',
          content: 'Still watching in the background. Click the tray icon to restore.',
        });
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── System tray ──────────────────────────────────────────────────────────────

function createTray() {
  // Use a simple fallback icon; replace with proper .ico / .icns files for production
  // In packaged app: icons are in dist/icons/ (copied from public/ by Vite)
  // In dev: icons are in public/icons/
  const iconPath = isDev
    ? path.join(__dirname, '..', 'public', 'icons', 'icon-32x32.png')
    : path.join(__dirname, '..', 'dist', 'icons', 'icon-32x32.png');
  const iconExists = existsSync(iconPath);
  const img = iconExists
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(img);
  tray.setToolTip('Stop Biting');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow?.show();
    }
  });
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

function setupIPC() {
  // Renderer asks to send a native OS notification
  ipcMain.on('notify', (_event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  // Renderer asks to open an external URL (e.g. PayPal, Chrome Web Store)
  ipcMain.on('open-external', (_event, url: string) => {
    shell.openExternal(url);
  });

  // Renderer asks to start Google OAuth — fetch the redirect URL from the
  // API server and open it in the system browser (never inside Electron).
  ipcMain.handle('open-google-auth', async () => {
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
  ipcMain.on('bite-detected', () => {
    if (!mainWindow?.isVisible()) {
      if (Notification.isSupported()) {
        new Notification({
          title: 'Stop Biting',
          body: 'Stop biting your nails!',
        }).show();
      }
    }
  });
}
// ─── App lifecycle ────────────────────────────────────────────────────────────

app.on('ready', async () => {
  // Set dock icon explicitly on macOS (prevents white square)
  if (process.platform === 'darwin') {
    const iconPath = isDev
      ? path.join(__dirname, '..', 'public', 'icons', 'icon-512x512.png')
      : path.join(__dirname, '..', 'dist', 'icons', 'icon-512x512.png');
    if (existsSync(iconPath)) {
      app.dock?.setIcon(nativeImage.createFromPath(iconPath));
    }
  }
  startBackendServer();
  setupIPC();
  await createWindow();
  createTray();
});

// macOS: re-create window when dock icon is clicked and no windows exist
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }
});

// macOS: handle deep-link from protocol (launched via stopbiting://...)
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

app.on('before-quit', () => {
  quitting = true;
  stopBackendServer();
});

// On Windows/Linux, quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    quitting = true;
    app.quit();
  }
});
