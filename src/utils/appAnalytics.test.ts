import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { claimFreshSignIn, trackApp, trackSignInComplete, resetAppAnalyticsForTests } from './appAnalytics';
import { kv } from '../storage/kv';
import { setStorageAdapter } from '../storage/adapter';
import { resetFlagsForTests } from '../features/flags';
import { FEATURES } from '../features/registry';
import { createFlakyAdapter, createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    has: (k: string) => data.has(k),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('claimFreshSignIn', () => {
  it('is true once for a browser with no session marker, and records the marker', () => {
    const store = memoryStore();
    expect(claimFreshSignIn(store, 'sb_has_session', true)).toBe(true);
    expect(store.has('sb_has_session')).toBe(true);
  });

  it('is false the second time: StrictMode runs the lookup twice, refreshProfile and every later load see the marker', () => {
    const store = memoryStore();
    expect(claimFreshSignIn(store, 'sb_has_session', true)).toBe(true);
    expect(claimFreshSignIn(store, 'sb_has_session', true)).toBe(false);
    expect(claimFreshSignIn(store, 'sb_has_session', true)).toBe(false);
  });

  it('is false for a returning session that is restored silently', () => {
    expect(claimFreshSignIn(memoryStore({ sb_has_session: '1' }), 'sb_has_session', true)).toBe(false);
  });

  it('is false when the server did not confirm a session (the offline grant, the dev preview), but still records the marker as before', () => {
    const store = memoryStore();
    expect(claimFreshSignIn(store, 'sb_has_session', false)).toBe(false);
    expect(store.has('sb_has_session')).toBe(true);
    // ...so a real sign-in on the same browser afterwards is not counted either: the marker says it was seen.
    expect(claimFreshSignIn(store, 'sb_has_session', true)).toBe(false);
  });

  it('counts again after sign-out, which clears the marker', () => {
    const store = memoryStore();
    expect(claimFreshSignIn(store, 'sb_has_session', true)).toBe(true);
    store.removeItem('sb_has_session');
    expect(claimFreshSignIn(store, 'sb_has_session', true)).toBe(true);
  });
});

describe('trackSignInComplete', () => {
  it('sends signin_complete to gtag with no parameters when the page has loaded', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });
    vi.stubGlobal('document', { readyState: 'complete' });
    trackSignInComplete();
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0]).toEqual(['event', 'signin_complete', undefined]);
  });

  it('waits for the load event (that is when the Google Analytics tag is defined), then sends once', () => {
    const gtag = vi.fn();
    let onLoad: (() => void) | undefined;
    const addEventListener = vi.fn((type: string, fn: () => void, opts?: { once?: boolean }) => {
      expect(type).toBe('load');
      expect(opts).toEqual({ once: true });
      onLoad = fn;
    });
    // The tag is not there yet at the moment of the call.
    const win: { gtag?: typeof gtag; addEventListener: typeof addEventListener } = { addEventListener };
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', { readyState: 'interactive' });
    trackSignInComplete();
    expect(gtag).not.toHaveBeenCalled();
    win.gtag = gtag; // index.html's load handler runs first and defines it
    onLoad!();
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0]).toEqual(['event', 'signin_complete', undefined]);
  });

  it('never throws, with or without gtag', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', { readyState: 'complete' });
    expect(() => trackSignInComplete()).not.toThrow();
    vi.stubGlobal('window', { gtag: () => { throw new Error('boom'); } });
    expect(() => trackSignInComplete()).not.toThrow();
  });
});

describe('the sign-in wiring in AuthContext (a source guard: the provider cannot be rendered in a node test)', () => {
  const auth = read('src/contexts/AuthContext.tsx');

  it('counts a sign-in only where the server has just confirmed a session', () => {
    // The lookup on load and the two Electron token paths.
    expect(auth.match(/applyUser\(profile, true\)/g)).toHaveLength(3);
    // The offline grant, the dev preview and refreshProfile must NOT count.
    expect(auth).toMatch(/if \(offline\) applyUser\(offline\);/);
    expect(auth).toMatch(/applyUser\(previewUser\(kind\)\);/);
    expect(auth).toMatch(/const profile = await apiFetch\('\/api\/user\/me'\);\s*applyUser\(profile\);/);
  });

  it('fires through the helper, once, after the session marker is recorded', () => {
    expect(auth.match(/trackSignInComplete\(\)/g)).toHaveLength(1);
    expect(auth).toMatch(/claimFreshSignIn\(localStorage, SESSION_FLAG, countSignIn\)/);
  });

  it('sends nothing derived from the user: the event has no argument', () => {
    expect(auth).not.toMatch(/track\(/);
    expect(auth).not.toMatch(/trackSignInComplete\([^)]/);
  });
});

// ── trackApp: detection_start and first_alarm, behind the app_analytics flag ─────────────────────────────

const FIRST_ALARM_KEY = 'sb:app:first-alarm-sent';

/** The last answer the server gave for /api/features, as the client caches it (src/features/flags.ts). */
function setFlags(...on: string[]) {
  kv.set('flags', 'last-known', { at: Date.now(), flags: Object.fromEntries(on.map(n => [n, true])) });
  resetFlagsForTests();
}

describe('trackApp', () => {
  let gtag: ReturnType<typeof vi.fn>;
  let store: ReturnType<typeof createMemoryAdapter>;

  beforeEach(() => {
    store = createMemoryAdapter();
    setStorageAdapter(store);
    resetFlagsForTests();
    resetAppAnalyticsForTests();
    gtag = vi.fn();
    vi.stubGlobal('window', { gtag });
  });
  afterEach(() => {
    resetStorage();
    resetFlagsForTests();
    resetAppAnalyticsForTests();
  });

  /** A new page load: nothing remembered in memory, the same browser storage. */
  const reload = () => { resetAppAnalyticsForTests(); resetFlagsForTests(); };

  describe('flag off', () => {
    it('sends nothing and writes nothing, whichever event, however often (the flag is not known yet, so it reads as off)', () => {
      const before = [...store.keys!()];
      for (let i = 0; i < 3; i++) { trackApp('detection_start'); trackApp('first_alarm'); }
      expect(gtag).not.toHaveBeenCalled();
      expect([...store.keys!()]).toEqual(before);
      expect(kv.get('app', 'first-alarm-sent', false)).toBe(false);
    });

    it('stays silent when the server said false, and when only other flags are on', () => {
      kv.set('flags', 'last-known', { at: Date.now(), flags: { app_analytics: false } });
      resetFlagsForTests();
      trackApp('detection_start');
      setFlags('event_sync', 'insights', 'hrt_coaching');
      trackApp('first_alarm');
      expect(gtag).not.toHaveBeenCalled();
      expect(store.getItem(FIRST_ALARM_KEY)).toBeNull();
    });

    it('does not use up first_alarm: a device that alarmed while the flag was off still sends it once the flag is on', () => {
      trackApp('first_alarm');
      trackApp('first_alarm');
      expect(gtag).not.toHaveBeenCalled();
      setFlags('app_analytics');
      trackApp('first_alarm');
      expect(gtag).toHaveBeenCalledTimes(1);
    });
  });

  describe('flag on', () => {
    beforeEach(() => setFlags('app_analytics'));

    it('detection_start sends once per page load, however many times detection is started or paused and resumed', () => {
      trackApp('detection_start');
      trackApp('detection_start');
      trackApp('detection_start');
      expect(gtag).toHaveBeenCalledTimes(1);
      expect(gtag).toHaveBeenCalledWith('event', 'detection_start', undefined);
    });

    it('detection_start sends again in the next page load', () => {
      trackApp('detection_start');
      reload();
      trackApp('detection_start');
      expect(gtag).toHaveBeenCalledTimes(2);
    });

    it('first_alarm sends once and records that this device has sent it', () => {
      trackApp('first_alarm');
      trackApp('first_alarm');
      expect(gtag).toHaveBeenCalledTimes(1);
      expect(gtag).toHaveBeenCalledWith('event', 'first_alarm', undefined);
      expect(store.getItem(FIRST_ALARM_KEY)).toBe('true');
    });

    it('first_alarm does not send again in a later page load of the same device', () => {
      trackApp('first_alarm');
      reload();
      trackApp('first_alarm');
      trackApp('first_alarm');
      expect(gtag).toHaveBeenCalledTimes(1);
    });

    it('first_alarm does not send when the device already sent it before', () => {
      store.setItem(FIRST_ALARM_KEY, 'true');
      trackApp('first_alarm');
      expect(gtag).not.toHaveBeenCalled();
    });

    it('the two events are independent of each other', () => {
      trackApp('detection_start');
      trackApp('first_alarm');
      expect(gtag.mock.calls.map(c => c[1])).toEqual(['detection_start', 'first_alarm']);
    });

    it('never passes a parameter: every call is exactly (\'event\', name, undefined)', () => {
      trackApp('detection_start');
      trackApp('first_alarm');
      for (const call of gtag.mock.calls) {
        expect(call).toHaveLength(3);
        expect(call[0]).toBe('event');
        expect(call[2]).toBeUndefined();
      }
    });

    it('never throws: a throwing gtag, no gtag, and storage that refuses to read or write', () => {
      vi.stubGlobal('window', { gtag: () => { throw new Error('boom'); } });
      expect(() => { trackApp('detection_start'); trackApp('first_alarm'); }).not.toThrow();

      resetAppAnalyticsForTests();
      vi.stubGlobal('window', {});
      expect(() => { trackApp('detection_start'); trackApp('first_alarm'); }).not.toThrow();

      resetAppAnalyticsForTests();
      const flaky = createFlakyAdapter();
      setStorageAdapter(flaky.adapter);
      setFlags('app_analytics');
      flaky.control.failReads = true;
      flaky.control.failWrites = true;
      vi.stubGlobal('window', { gtag });
      expect(() => { trackApp('detection_start'); trackApp('first_alarm'); }).not.toThrow();
    });

    it('with storage that refuses writes, first_alarm still goes out at most once per page load', () => {
      const flaky = createFlakyAdapter();
      setStorageAdapter(flaky.adapter);
      setFlags('app_analytics');
      flaky.control.failWrites = true;
      trackApp('first_alarm');
      trackApp('first_alarm');
      expect(gtag).toHaveBeenCalledTimes(1);
    });
  });
});

describe('where the app events are wired (a source guard: the camera view cannot be rendered with effects in a node test)', () => {
  const camera = read('src/components/detection/CameraView.tsx');

  it('detection_start fires from the effect on `running`, which is "the camera is on and the detector is running"', () => {
    expect(camera).toMatch(/useEffect\(\(\) => \{ if \(running\) trackApp\('detection_start'\); \}, \[running\]\);/);
    expect(camera).toMatch(/const running = isDetecting\(/);
  });

  it('first_alarm fires from handleAlert, after the alarm is logged, and the existing log call is unchanged', () => {
    const handler = /const handleAlert = \(behavior: Behavior\) => \{([\s\S]*?)\n  \};/.exec(camera)?.[1] ?? '';
    expect(handler).toContain("logIncident('auto-detected', true, { behavior, ...alarmHandExtras() });");
    expect(handler.indexOf('logIncident(')).toBeLessThan(handler.indexOf("trackApp('first_alarm')"));
    expect(handler.match(/trackApp\(/g)).toHaveLength(1);
  });

  it('trackApp is called from CameraView only: not from the shared detector or the landing demo, which would count visitors', () => {
    const callers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(new URL(`../../${dir}`, import.meta.url), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) && /\btrackApp\(/.test(read(rel))) callers.push(rel);
      }
    };
    walk('src');
    expect(callers.sort()).toEqual(['src/components/detection/CameraView.tsx', 'src/utils/appAnalytics.ts']);
  });

  it('trackApp calls track with the event name alone', () => {
    const src = read('src/utils/appAnalytics.ts');
    expect(src.match(/^\s+track\(name\);$/gm)).toHaveLength(1); // the call, not the comment about it
    expect(src).not.toMatch(/\btrack\(name,/);
    expect(src).toMatch(/export function trackApp\(name: AppEvent\): void/);
  });
});

describe('the app_analytics flag', () => {
  it('is registered, and its "do first" note points at a privacy draft that exists', () => {
    const info = FEATURES.app_analytics;
    expect(info).toBeDefined();
    expect(info.before).toContain('docs/agents/legal/in-app-analytics-privacy.md');
    expect(existsSync(new URL('../../docs/agents/legal/in-app-analytics-privacy.md', import.meta.url))).toBe(true);
  });
});
