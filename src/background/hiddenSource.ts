// Who ticks the detection loop while the main tab is hidden (WS7a). Chosen in this order:
//
//   1. the Document Picture-in-Picture window, when the person has the mini window open: its timers belong to a
//      window the browser treats as visible, so they keep their rate (and so does the opener, measured);
//   2. a dedicated worker (src/background/ticker.ts): worker timers keep their rate in a hidden tab even without
//      the mini window;
//   3. nothing better: `onLost` tells the caller, which then uses what it always had (a 500 ms setInterval on the
//      page, which the browser slows to once a second).
//
// It never runs two sources at once, and it creates no worker unless it is asked to start (the loop only asks
// while the tab is hidden and the flag is on), so a visible tab pays nothing.

import type { Ticker } from './ticker';
import type { TimerHost } from './tickHost';

export type HiddenSourceKind = 'pip' | 'worker';

export interface HiddenSourceDeps {
  intervalMs: number;
  tick: () => void;
  ticker: Ticker;
  getPip: () => TimerHost | null;
  subscribePip: (fn: () => void) => () => void;
  /** No source is left: the caller should fall back to its own timer. Called at most once per start. */
  onLost: () => void;
}

export interface HiddenSource {
  start(): void;
  stop(): void;
  /** Which source is ticking right now, or null. */
  kind(): HiddenSourceKind | null;
}

export function createHiddenSource(deps: HiddenSourceDeps): HiddenSource {
  const { intervalMs, tick, ticker, getPip, subscribePip, onLost } = deps;
  let started = false;
  let current: { kind: HiddenSourceKind; stop: () => void } | null = null;
  let unsubscribe: (() => void) | null = null;
  let generation = 0;

  function release() {
    current?.stop();
    current = null;
  }

  function arm() {
    release();
    const mine = ++generation;
    const pip = getPip();
    if (pip) {
      try {
        const id = pip.setInterval(tick, intervalMs);
        current = { kind: 'pip', stop: () => { try { pip.clearInterval(id); } catch { /* window already gone */ } } };
        return;
      } catch {
        // a window that refuses timers: use the worker instead
      }
    }
    const stop = ticker.every(intervalMs, tick, () => {
      if (mine !== generation || !started) return; // an old arming, or stopped meanwhile
      current = null;
      onLost();
    });
    current = { kind: 'worker', stop };
  }

  return {
    start() {
      if (started) return;
      started = true;
      unsubscribe = subscribePip(() => { if (started) arm(); });
      arm();
    },
    stop() {
      if (!started) return;
      started = false;
      generation++;
      unsubscribe?.();
      unsubscribe = null;
      release();
    },
    kind: () => current?.kind ?? null,
  };
}
