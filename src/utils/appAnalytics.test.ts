import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { claimFreshSignIn, trackSignInComplete } from './appAnalytics';

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
