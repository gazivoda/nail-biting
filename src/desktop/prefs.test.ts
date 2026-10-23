import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  HIDDEN_ARG,
  loginItemSupport,
  parsePrefs,
  reconcileLoginPref,
  serializePrefs,
  shouldStartHidden,
} from './prefs';

describe('parsePrefs / serializePrefs', () => {
  it('defaults to launch at login OFF when there is no file', () => {
    expect(DEFAULT_PREFS.launchAtLogin).toBe(false);
    expect(parsePrefs(null)).toEqual({ launchAtLogin: false });
    expect(parsePrefs(undefined)).toEqual({ launchAtLogin: false });
    expect(parsePrefs('')).toEqual({ launchAtLogin: false });
  });

  it('reads a saved choice', () => {
    expect(parsePrefs('{"launchAtLogin": true}')).toEqual({ launchAtLogin: true });
    expect(parsePrefs('{"launchAtLogin": false}')).toEqual({ launchAtLogin: false });
  });

  it('a damaged or hostile file means the defaults, not a crash', () => {
    for (const raw of ['{', 'null', '[]', '7', '"yes"', '{"launchAtLogin":"true"}', '{"launchAtLogin":1}', '{"other":true}']) {
      expect(parsePrefs(raw)).toEqual({ launchAtLogin: false });
    }
  });

  it('round-trips and writes only the known key', () => {
    for (const launchAtLogin of [true, false]) {
      const text = serializePrefs({ launchAtLogin });
      expect(parsePrefs(text)).toEqual({ launchAtLogin });
      expect(Object.keys(JSON.parse(text))).toEqual(['launchAtLogin']);
    }
  });

  it('does not hand out a shared defaults object', () => {
    const a = parsePrefs(null);
    a.launchAtLogin = true;
    expect(parsePrefs(null).launchAtLogin).toBe(false);
  });
});

describe('loginItemSupport', () => {
  const env = {};
  it('macOS and Windows installs are supported', () => {
    expect(loginItemSupport({ platform: 'darwin', isPackaged: true, env })).toBe('supported');
    expect(loginItemSupport({ platform: 'win32', isPackaged: true, env })).toBe('supported');
  });

  it('an unpackaged build would register the bare Electron binary', () => {
    expect(loginItemSupport({ platform: 'darwin', isPackaged: false, env })).toBe('dev-only');
    expect(loginItemSupport({ platform: 'win32', isPackaged: false, env })).toBe('dev-only');
  });

  it('the Windows portable build runs from a temporary folder', () => {
    expect(loginItemSupport({ platform: 'win32', isPackaged: true, env: { PORTABLE_EXECUTABLE_FILE: 'C:\\x.exe' } })).toBe('dev-only');
    expect(loginItemSupport({ platform: 'darwin', isPackaged: true, env: { PORTABLE_EXECUTABLE_FILE: 'x' } })).toBe('supported');
  });

  it('Linux has no login item API here', () => {
    expect(loginItemSupport({ platform: 'linux', isPackaged: true, env })).toBe('unsupported');
  });
});

describe('reconcileLoginPref', () => {
  it('the OS wins when it can answer: a login item removed in System Settings stays removed', () => {
    expect(reconcileLoginPref(true, false)).toBe(false);
    expect(reconcileLoginPref(false, true)).toBe(true);
    expect(reconcileLoginPref(true, true)).toBe(true);
    expect(reconcileLoginPref(false, false)).toBe(false);
  });

  it('the stored choice stands when the OS cannot say', () => {
    expect(reconcileLoginPref(true, null)).toBe(true);
    expect(reconcileLoginPref(false, null)).toBe(false);
  });
});

describe('shouldStartHidden', () => {
  it('Windows passes --hidden from the login item', () => {
    expect(shouldStartHidden({ argv: ['C:\\app.exe', HIDDEN_ARG], wasOpenedAtLogin: false })).toBe(true);
  });

  it('macOS reports it instead', () => {
    expect(shouldStartHidden({ argv: ['/Applications/Stop Biting'], wasOpenedAtLogin: true })).toBe(true);
  });

  it('a normal launch shows the window', () => {
    expect(shouldStartHidden({ argv: ['/Applications/Stop Biting'], wasOpenedAtLogin: false })).toBe(false);
    expect(shouldStartHidden({ argv: ['a', '--hidden-ish'], wasOpenedAtLogin: false })).toBe(false);
  });
});
