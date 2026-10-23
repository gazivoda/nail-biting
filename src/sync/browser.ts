// The page side of sync: focus, visibility and connectivity, as the small
// interface the controller wants. The only DOM code in src/sync.

import type { SyncEnvironment } from './controller';

export function createBrowserEnvironment(): SyncEnvironment {
  return {
    isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,

    onFocus(cb) {
      const onVisible = () => { if (document.visibilityState === 'visible') cb(); };
      window.addEventListener('focus', cb);
      document.addEventListener('visibilitychange', onVisible);
      return () => {
        window.removeEventListener('focus', cb);
        document.removeEventListener('visibilitychange', onVisible);
      };
    },

    onOnline(cb) {
      window.addEventListener('online', cb);
      return () => window.removeEventListener('online', cb);
    },

    onOffline(cb) {
      window.addEventListener('offline', cb);
      return () => window.removeEventListener('offline', cb);
    },
  };
}
