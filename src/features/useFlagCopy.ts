import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { flagAware } from '../../shared/flagCopy.js';
import { kv } from '../storage/kv';
import { useSignInProviders } from '../auth/useSignInProviders';
import { ensureFlags, FLAGS_TTL_MS, getFlags, subscribeFlags, type FeatureName } from './flags';

// Copy that changes with a feature flag (WS11b, shared/flagCopy.js).
//
//   const copy = useFlagCopy();
//   <p>{copy('Your history is stored in this browser, so it doesn\'t follow you to another computer.')}</p>
//
// The source text is what is true with every flag off, and `copy` hands it back as the same
// string until a flag changes it. The server applies the same function to the same text for
// the crawler copy and the structured data, so a reader and a crawler are told the same thing.
//
// Flags come from the last answer this browser has (src/features/flags.ts: kv first, then
// /api/features). Asking again is deferred to browser idle and skipped while the cached answer
// is younger than FLAGS_TTL_MS, so a marketing page does not make a request on every view.
// The three extra sign-in methods use the answer to GET /auth/providers instead, which already
// says "flag on AND keys configured" and which these pages fetch anyway for their buttons.

/** Runs `fn` when the browser is idle, so asking never competes with the first paint. */
function whenIdle(fn: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(fn);
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 800);
  return () => window.clearTimeout(id);
}

function cachedAnswerIsFresh(): boolean {
  const cached = kv.get<{ at?: number } | null>('flags', 'last-known', null);
  return typeof cached?.at === 'number' && Date.now() - cached.at < FLAGS_TTL_MS;
}

/**
 * One flag, read from the browser's last-known answer, asked again at idle only when that answer
 * is older than FLAGS_TTL_MS. For marketing pages, which must not make a request on every view.
 */
export function useLazyFeature(name: FeatureName): boolean {
  const flags = useSyncExternalStore(subscribeFlags, getFlags, getFlags);
  useEffect(() => whenIdle(() => { if (!cachedAnswerIsFresh()) ensureFlags(); }), []);
  return flags[name] === true;
}

/** `isOn` for copy: the flags this browser last heard, and the sign-in methods the server says are usable. */
export function useFlagIsOn(): (name: string) => boolean {
  const flags = useSyncExternalStore(subscribeFlags, getFlags, getFlags);
  const { providers } = useSignInProviders();

  useEffect(() => whenIdle(() => { if (!cachedAnswerIsFresh()) ensureFlags(); }), []);

  return useMemo(() => (name: string): boolean => {
    if (name === 'signin_magic_link') return providers.magic_link;
    if (name === 'signin_apple') return providers.apple;
    if (name === 'signin_microsoft') return providers.microsoft;
    return flags[name as FeatureName] === true;
  }, [flags, providers]);
}

export function useFlagCopy(): (text: string) => string {
  const isOn = useFlagIsOn();
  return useMemo(() => (text: string) => flagAware(text, isOn), [isOn]);
}
