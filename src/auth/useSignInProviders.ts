import { useEffect, useSyncExternalStore } from 'react';
import {
  anyExtraProvider, ensureProviders, getProviders, providersLoaded, subscribeProviders, type ProviderAvailability,
} from './providers';

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

/** Which extra sign-in methods are usable now, and whether the server has answered yet. */
export function useSignInProviders(): { providers: ProviderAvailability; ready: boolean } {
  useEffect(() => whenIdle(() => { void ensureProviders(); }), []);
  const providers = useSyncExternalStore(subscribeProviders, getProviders, getProviders);
  const ready = useSyncExternalStore(subscribeProviders, providersLoaded, providersLoaded);
  return { providers, ready };
}

/**
 * Where the site's "Sign in" and "Start free trial" buttons point. Google's own
 * address, exactly as before, unless the owner has switched another method on and
 * configured it; then the sign-in page, which offers every method including Google.
 */
export function useSignInHref(): string {
  const { providers } = useSignInProviders();
  return anyExtraProvider(providers) ? '/signin' : '/api/auth/google';
}
