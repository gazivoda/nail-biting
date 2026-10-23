// The app's one ticker, backed by the real worker (src/background/tickWorker.ts). Separate from ticker.ts so the
// logic there stays testable in node: the `new Worker(new URL(...))` form below is what Vite recognises and turns
// into a same-origin file under /assets/ (the page's CSP, `worker-src 'self'`, refuses blob: workers).

import { createTicker, type Ticker, type WorkerLike } from './ticker';

let ticker: Ticker | null = null;

export function getAppTicker(): Ticker {
  if (!ticker) {
    ticker = createTicker(() => {
      if (typeof Worker === 'undefined') throw new Error('no Worker');
      return new Worker(new URL('./tickWorker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
    });
  }
  return ticker;
}
