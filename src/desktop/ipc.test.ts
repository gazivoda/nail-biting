import { describe, expect, it } from 'vitest';
import {
  DESKTOP_CHANNEL,
  MAX_NOTIFICATION_BODY,
  MAX_NOTIFICATION_TITLE,
  MAX_PAUSE_MINUTES,
  isTrustedRendererUrl,
  parseCameraAccess,
  parseCameraPrompt,
  parseDesktopCommand,
  parseDesktopNotification,
  parseDesktopState,
  parseExternalUrl,
  parseLegacyNotify,
  sameDesktopState,
  INITIAL_DESKTOP_STATE,
} from './ipc';

describe('channels', () => {
  it('all carry the desktop: prefix and are unique', () => {
    const names = Object.values(DESKTOP_CHANNEL);
    expect(names.every((n) => n.startsWith('desktop:'))).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('parseDesktopCommand', () => {
  it('accepts the four command types', () => {
    expect(parseDesktopCommand({ type: 'start' })).toEqual({ type: 'start' });
    expect(parseDesktopCommand({ type: 'stop' })).toEqual({ type: 'stop' });
    expect(parseDesktopCommand({ type: 'resume' })).toEqual({ type: 'resume' });
    expect(parseDesktopCommand({ type: 'pause', minutes: 15 })).toEqual({ type: 'pause', minutes: 15 });
  });

  it('drops extra fields instead of passing them on', () => {
    expect(parseDesktopCommand({ type: 'start', url: 'javascript:1', minutes: 5 })).toEqual({ type: 'start' });
  });

  it('rejects a pause without a usable duration', () => {
    expect(parseDesktopCommand({ type: 'pause' })).toBeNull();
    expect(parseDesktopCommand({ type: 'pause', minutes: 0 })).toBeNull();
    expect(parseDesktopCommand({ type: 'pause', minutes: -5 })).toBeNull();
    expect(parseDesktopCommand({ type: 'pause', minutes: 1.5 })).toBeNull();
    expect(parseDesktopCommand({ type: 'pause', minutes: Number.NaN })).toBeNull();
    expect(parseDesktopCommand({ type: 'pause', minutes: Infinity })).toBeNull();
    expect(parseDesktopCommand({ type: 'pause', minutes: '15' })).toBeNull();
    expect(parseDesktopCommand({ type: 'pause', minutes: MAX_PAUSE_MINUTES + 1 })).toBeNull();
    expect(parseDesktopCommand({ type: 'pause', minutes: MAX_PAUSE_MINUTES })).toEqual({
      type: 'pause',
      minutes: MAX_PAUSE_MINUTES,
    });
  });

  it('rejects anything that is not a command object', () => {
    for (const bad of [null, undefined, 'start', 7, [], { type: 'quit' }, { type: 5 }, {}]) {
      expect(parseDesktopCommand(bad)).toBeNull();
    }
  });
});

describe('parseDesktopState', () => {
  const ok = { watching: true, paused: false, pausedUntil: null, pauseSupported: true };

  it('accepts a well-formed state', () => {
    expect(parseDesktopState(ok)).toEqual(ok);
    expect(parseDesktopState({ ...ok, paused: true, pausedUntil: 1_700_000_000_000 })).toEqual({
      ...ok,
      paused: true,
      pausedUntil: 1_700_000_000_000,
    });
  });

  it('forgets pausedUntil when not paused', () => {
    expect(parseDesktopState({ ...ok, pausedUntil: 5 })?.pausedUntil).toBeNull();
  });

  it('treats a missing pausedUntil as none', () => {
    expect(parseDesktopState({ watching: false, paused: true, pauseSupported: true })).toEqual({
      watching: false,
      paused: true,
      pausedUntil: null,
      pauseSupported: true,
    });
  });

  it('rejects wrong types', () => {
    expect(parseDesktopState({ ...ok, watching: 'yes' })).toBeNull();
    expect(parseDesktopState({ ...ok, paused: 1 })).toBeNull();
    expect(parseDesktopState({ ...ok, pauseSupported: undefined })).toBeNull();
    expect(parseDesktopState({ ...ok, paused: true, pausedUntil: 'tomorrow' })).toBeNull();
    expect(parseDesktopState({ ...ok, paused: true, pausedUntil: Number.NaN })).toBeNull();
    expect(parseDesktopState({ ...ok, paused: true, pausedUntil: -1 })).toBeNull();
    expect(parseDesktopState(null)).toBeNull();
    expect(parseDesktopState('x')).toBeNull();
  });
});

describe('sameDesktopState', () => {
  it('compares every field', () => {
    const a = { ...INITIAL_DESKTOP_STATE };
    expect(sameDesktopState(a, { ...a })).toBe(true);
    expect(sameDesktopState(a, { ...a, watching: true })).toBe(false);
    expect(sameDesktopState(a, { ...a, paused: true })).toBe(false);
    expect(sameDesktopState(a, { ...a, pausedUntil: 1 })).toBe(false);
    expect(sameDesktopState(a, { ...a, pauseSupported: true })).toBe(false);
  });
});

describe('parseDesktopNotification', () => {
  it('accepts a normal notification and defaults the click action to open', () => {
    expect(parseDesktopNotification({ title: 'Start watching?', body: 'Detection is off.' })).toEqual({
      title: 'Start watching?',
      body: 'Detection is off.',
      clickAction: 'open',
    });
    expect(parseDesktopNotification({ title: 'a', body: 'b', clickAction: 'start' })?.clickAction).toBe('start');
  });

  it('rejects a click action it does not know', () => {
    expect(parseDesktopNotification({ title: 'a', body: 'b', clickAction: 'quit' })).toBeNull();
    expect(parseDesktopNotification({ title: 'a', body: 'b', clickAction: 1 })).toBeNull();
  });

  it('rejects empty, missing, non-string and oversized text', () => {
    expect(parseDesktopNotification({ title: '', body: 'b' })).toBeNull();
    expect(parseDesktopNotification({ title: '   ', body: 'b' })).toBeNull();
    expect(parseDesktopNotification({ title: 'a' })).toBeNull();
    expect(parseDesktopNotification({ title: 1, body: 'b' })).toBeNull();
    expect(parseDesktopNotification({ title: 'a'.repeat(MAX_NOTIFICATION_TITLE + 1), body: 'b' })).toBeNull();
    expect(parseDesktopNotification({ title: 'a', body: 'b'.repeat(MAX_NOTIFICATION_BODY + 1) })).toBeNull();
    expect(parseDesktopNotification({ title: 'a'.repeat(MAX_NOTIFICATION_TITLE), body: 'b' })).not.toBeNull();
    expect(parseDesktopNotification(null)).toBeNull();
    expect(parseDesktopNotification('hi')).toBeNull();
  });

  it('replaces control characters, so a notification cannot carry a newline trick', () => {
    expect(parseDesktopNotification({ title: 'a\nb', body: 'x\u0000y' })).toEqual({
      title: 'a b',
      body: 'x y',
      clickAction: 'open',
    });
  });
});

describe('parseLegacyNotify', () => {
  it('cuts overlong text instead of dropping the notification', () => {
    const n = parseLegacyNotify({ title: 'T'.repeat(500), body: 'B'.repeat(900) });
    expect(n?.title).toHaveLength(MAX_NOTIFICATION_TITLE);
    expect(n?.body).toHaveLength(MAX_NOTIFICATION_BODY);
    expect(n?.clickAction).toBe('open');
  });

  it('still rejects non-strings and empty text', () => {
    expect(parseLegacyNotify({ title: 'a', body: 5 })).toBeNull();
    expect(parseLegacyNotify({ title: '', body: 'b' })).toBeNull();
    expect(parseLegacyNotify(undefined)).toBeNull();
  });
});

describe('parseExternalUrl', () => {
  it('allows web links only', () => {
    expect(parseExternalUrl('https://stopbiting.today/pricing')).toBe('https://stopbiting.today/pricing');
    expect(parseExternalUrl('http://localhost:3000/x')).toBe('http://localhost:3000/x');
    for (const bad of [
      'file:///etc/passwd',
      'javascript:alert(1)',
      'ms-settings:privacy-webcam',
      'x-apple.systempreferences:com.apple.preference.security',
      'stopbiting://auth?token=x',
      'not a url',
      '',
      42,
      null,
    ]) {
      expect(parseExternalUrl(bad)).toBeNull();
    }
    expect(parseExternalUrl(`https://a.example/${'x'.repeat(3000)}`)).toBeNull();
  });
});

describe('isTrustedRendererUrl', () => {
  it('trusts the packaged page and the dev server, nothing else', () => {
    expect(isTrustedRendererUrl('file:///Applications/Stop Biting.app/Contents/Resources/app.asar/dist/index.html', null)).toBe(true);
    expect(isTrustedRendererUrl('http://localhost:5173/', 'http://localhost:5173')).toBe(true);
    expect(isTrustedRendererUrl('http://localhost:5173', 'http://localhost:5173')).toBe(true);
    expect(isTrustedRendererUrl('http://localhost:5173/#x', 'http://localhost:5173')).toBe(true);
  });

  it('refuses other origins, look-alikes, an unknown frame, and the dev server when packaged', () => {
    expect(isTrustedRendererUrl('https://stopbiting.today/', null)).toBe(false);
    expect(isTrustedRendererUrl('https://evil.example/', 'http://localhost:5173')).toBe(false);
    expect(isTrustedRendererUrl('http://localhost:51730/', 'http://localhost:5173')).toBe(false);
    expect(isTrustedRendererUrl('http://localhost:5173.evil.example/', 'http://localhost:5173')).toBe(false);
    expect(isTrustedRendererUrl('http://localhost:5173/', null)).toBe(false);
    expect(isTrustedRendererUrl(undefined, null)).toBe(false);
    expect(isTrustedRendererUrl(null, 'http://localhost:5173')).toBe(false);
    expect(isTrustedRendererUrl('', null)).toBe(false);
  });
});

describe('camera parsers', () => {
  it('maps unknown access values to unknown', () => {
    expect(parseCameraAccess('granted')).toBe('granted');
    expect(parseCameraAccess('not-determined')).toBe('not-determined');
    expect(parseCameraAccess('whatever')).toBe('unknown');
    expect(parseCameraAccess(undefined)).toBe('unknown');
  });

  it('parses the two prompt kinds', () => {
    expect(parseCameraPrompt({ kind: 'explain' })).toEqual({ kind: 'explain' });
    expect(parseCameraPrompt({ kind: 'blocked', access: 'denied' })).toEqual({ kind: 'blocked', access: 'denied' });
    expect(parseCameraPrompt({ kind: 'blocked', access: 7 })).toEqual({ kind: 'blocked', access: 'unknown' });
    expect(parseCameraPrompt({ kind: 'other' })).toBeNull();
    expect(parseCameraPrompt(null)).toBeNull();
  });
});
