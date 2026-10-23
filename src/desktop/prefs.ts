/**
 * Desktop preferences and the decisions around them (WS7b). Pure: the file and
 * the OS calls live in electron/; this module only decides.
 */

export type DesktopPrefs = {
  /** Open Stop Biting when the user logs in. Off until the user turns it on. */
  launchAtLogin: boolean;
};

export const DEFAULT_PREFS: DesktopPrefs = { launchAtLogin: false };

/** Passed to the OS login item (Windows), and looked for in argv at startup. */
export const HIDDEN_ARG = '--hidden';

/** Parses the preferences file. Anything unreadable gives the defaults. */
export function parsePrefs(raw: string | null | undefined): DesktopPrefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_PREFS };
    const value = (parsed as Record<string, unknown>).launchAtLogin;
    return { launchAtLogin: value === true };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function serializePrefs(prefs: DesktopPrefs): string {
  return `${JSON.stringify({ launchAtLogin: prefs.launchAtLogin }, null, 2)}\n`;
}

export type LoginItemSupport = 'supported' | 'dev-only' | 'unsupported';

/**
 * `app.setLoginItemSettings` works on macOS and Windows only. An unpackaged
 * build would register the bare Electron binary, and the Windows portable build
 * runs from a temporary folder, so neither may be offered as a real toggle.
 */
export function loginItemSupport(opts: {
  platform: string;
  isPackaged: boolean;
  env: Record<string, string | undefined>;
}): LoginItemSupport {
  if (opts.platform !== 'darwin' && opts.platform !== 'win32') return 'unsupported';
  if (!opts.isPackaged) return 'dev-only';
  if (opts.platform === 'win32' && opts.env.PORTABLE_EXECUTABLE_FILE) return 'dev-only';
  return 'supported';
}

/**
 * The stored choice against what the OS says. The user can change a login item
 * in System Settings or Task Manager without us, and an app that quietly puts
 * itself back is worse than one that follows. So the OS wins whenever it can
 * answer; the file is the answer when it cannot (`null`).
 */
export function reconcileLoginPref(stored: boolean, osOpenAtLogin: boolean | null): boolean {
  return osOpenAtLogin ?? stored;
}

/**
 * Start in the tray, without showing the window, when the OS launched us at
 * login. Windows passes our `--hidden` argument; macOS 13 and later reports
 * `wasOpenedAtLogin` instead of honouring `openAsHidden`.
 */
export function shouldStartHidden(opts: { argv: readonly string[]; wasOpenedAtLogin: boolean }): boolean {
  return opts.wasOpenedAtLogin || opts.argv.includes(HIDDEN_ARG);
}
