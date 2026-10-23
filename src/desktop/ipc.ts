/**
 * The contract between the Electron main process, the preload script and the
 * renderer (WS7b). One small module, shared by all three, so the channel names
 * and the payload shapes cannot drift.
 *
 * Plain TypeScript: no DOM, no Node, no `electron` import. It is compiled by
 * the app config (DOM lib) and by tsconfig.electron.json (no DOM lib), and run
 * by vitest in a node environment. Keep it that way.
 *
 * Everything that crosses the boundary is parsed by one of the `parse*`
 * functions below, on the receiving side. A payload that does not parse is
 * dropped; it never throws.
 */

/** IPC channel names. All carry the `desktop:` prefix. */
export const DESKTOP_CHANNEL = {
  // main -> renderer
  command: 'desktop:command',
  cameraPrompt: 'desktop:camera-prompt',
  // renderer -> main (fire and forget)
  state: 'desktop:state',
  notify: 'desktop:notify',
  cameraDecline: 'desktop:camera-decline',
  cameraOpenSettings: 'desktop:camera-open-settings',
  // renderer -> main (request / reply)
  cameraStatus: 'desktop:camera-status',
  cameraRequest: 'desktop:camera-request',
} as const;

/** A request from the tray (or a notification click) to the web app. */
export type DesktopCommand =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'resume' }
  | { type: 'pause'; minutes: number };

export type DesktopCommandType = DesktopCommand['type'];

/**
 * What the web app tells the tray. `watching` is "the detection loop is
 * running" (the store's `detecting`). `pauseSupported` stays false until the
 * pause feature (WS7a) reports at least once, so the tray shows the pause items
 * disabled rather than offering a control that does nothing.
 */
export type DesktopState = {
  watching: boolean;
  paused: boolean;
  /** Epoch ms when the pause ends, or null (not paused, or no end). */
  pausedUntil: number | null;
  pauseSupported: boolean;
};

export const INITIAL_DESKTOP_STATE: DesktopState = {
  watching: false,
  paused: false,
  pausedUntil: null,
  pauseSupported: false,
};

export function sameDesktopState(a: DesktopState, b: DesktopState): boolean {
  return (
    a.watching === b.watching &&
    a.paused === b.paused &&
    a.pausedUntil === b.pausedUntil &&
    a.pauseSupported === b.pauseSupported
  );
}

/** macOS and Windows camera privacy status, as `systemPreferences` reports it. */
export type CameraAccess = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';

/** Reply to `cameraStatus`. `pending` = a camera request is waiting for the explanation. */
export type CameraStatus = { access: CameraAccess; pending: boolean };

/** Main -> renderer: show the camera card. */
export type CameraPrompt =
  | { kind: 'explain' }
  | { kind: 'blocked'; access: CameraAccess };

/** A native notification the web app asks main to show. */
export type DesktopNotification = {
  title: string;
  body: string;
  /** What a click does. `start` also sends the `start` command. */
  clickAction: 'open' | 'start';
};

export type DesktopPlatform = 'darwin' | 'win32' | 'linux';

/** The API preload exposes at `window.desktop` (declared on Window in src/types/electron.d.ts). */
export interface DesktopAPI {
  readonly platform: DesktopPlatform;
  /** Tray and notification commands. Returns the unsubscribe function. */
  onCommand(callback: (command: DesktopCommand) => void): () => void;
  /** Tell the tray what the app is doing. Call on every change. */
  sendState(state: DesktopState): void;
  /** Show a native notification. */
  notify(notification: { title: string; body: string; clickAction?: 'open' | 'start' }): void;
  readonly camera: {
    status(): Promise<CameraStatus>;
    /** Ask the OS for camera access (macOS shows its prompt). Resolves true when granted. */
    request(): Promise<boolean>;
    /** The user chose not to continue: answer the held camera request with a refusal. */
    decline(): void;
    /** Open the system camera privacy page. */
    openSettings(): void;
    onPrompt(callback: (prompt: CameraPrompt) => void): () => void;
  };
}

// ─── Limits ───────────────────────────────────────────────────────────────────

/** Longest pause main will forward: "until tomorrow" is at most 26 h away; one more covers a DST change. */
export const MAX_PAUSE_MINUTES = 27 * 60;
export const MAX_NOTIFICATION_TITLE = 80;
export const MAX_NOTIFICATION_BODY = 240;

// ─── Parsers ──────────────────────────────────────────────────────────────────

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function parseDesktopCommand(raw: unknown): DesktopCommand | null {
  if (!isRecord(raw)) return null;
  switch (raw.type) {
    case 'start':
    case 'stop':
    case 'resume':
      return { type: raw.type };
    case 'pause': {
      const m = raw.minutes;
      if (typeof m !== 'number' || !Number.isInteger(m) || m < 1 || m > MAX_PAUSE_MINUTES) return null;
      return { type: 'pause', minutes: m };
    }
    default:
      return null;
  }
}

export function parseDesktopState(raw: unknown): DesktopState | null {
  if (!isRecord(raw)) return null;
  const { watching, paused, pausedUntil, pauseSupported } = raw;
  if (typeof watching !== 'boolean' || typeof paused !== 'boolean' || typeof pauseSupported !== 'boolean') {
    return null;
  }
  let until: number | null = null;
  if (pausedUntil !== null && pausedUntil !== undefined) {
    if (typeof pausedUntil !== 'number' || !Number.isFinite(pausedUntil) || pausedUntil < 0) return null;
    until = pausedUntil;
  }
  return { watching, paused, pausedUntil: paused ? until : null, pauseSupported };
}

const CAMERA_ACCESS: readonly CameraAccess[] = ['granted', 'denied', 'not-determined', 'restricted', 'unknown'];

export function parseCameraAccess(raw: unknown): CameraAccess {
  return CAMERA_ACCESS.includes(raw as CameraAccess) ? (raw as CameraAccess) : 'unknown';
}

export function parseCameraPrompt(raw: unknown): CameraPrompt | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'explain') return { kind: 'explain' };
  if (raw.kind === 'blocked') return { kind: 'blocked', access: parseCameraAccess(raw.access) };
  return null;
}

/** Strips control characters (including newlines) and trims. */
function cleanText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
}

export function parseDesktopNotification(raw: unknown): DesktopNotification | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.title !== 'string' || typeof raw.body !== 'string') return null;
  const title = cleanText(raw.title);
  const body = cleanText(raw.body);
  if (!title || !body) return null;
  if (title.length > MAX_NOTIFICATION_TITLE || body.length > MAX_NOTIFICATION_BODY) return null;
  const click = raw.clickAction;
  if (click !== undefined && click !== 'open' && click !== 'start') return null;
  return { title, body, clickAction: click ?? 'open' };
}

/**
 * The older `window.electronAPI.notify(title, body)` call. Same limits, but a
 * title or body that is too long is cut instead of dropped, because existing
 * callers (the hands-check reminder) build their text at run time.
 */
export function parseLegacyNotify(raw: unknown): DesktopNotification | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.title !== 'string' || typeof raw.body !== 'string') return null;
  const title = cleanText(raw.title).slice(0, MAX_NOTIFICATION_TITLE);
  const body = cleanText(raw.body).slice(0, MAX_NOTIFICATION_BODY);
  if (!title || !body) return null;
  return { title, body, clickAction: 'open' };
}

/** Only web links may be opened in the system browser. */
export function parseExternalUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Whether an IPC message came from our own page. The packaged app loads
 * `file://` and dev loads the Vite server; every other navigation is blocked in
 * main, so this is a second lock, not the first.
 */
export function isTrustedRendererUrl(url: string | null | undefined, devOrigin: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('file://')) return true;
  if (devOrigin && (url === devOrigin || url.startsWith(`${devOrigin}/`))) return true;
  return false;
}
