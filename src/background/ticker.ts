// A timer that a hidden tab does not slow down (WS7a).
//
// WHY. Measured in Chrome 155 (docs/agents/ws7a-notes.md): with the camera on and the tab hidden, the page's own
// timers are clamped to one a second and requestAnimationFrame stops; a dedicated worker's timer keeps its rate
// (a 100 ms timer delivered 10 a second, a 200 ms chain 4.9 a second, for 11 minutes). So the loop asks a
// worker to tick and does its work on the page's main thread when the tick arrives.
//
// This file is the logic only: it is given a function that makes the worker, so it runs in node tests with a
// fake. The real worker is src/background/tickWorker.ts, made by appTicker.ts.
//
// Protocol (main -> worker): { cmd: 'start', id, ms } and { cmd: 'stop', id }.  Worker -> main: the number `id`.

export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type CreateWorker = () => WorkerLike;

export interface Ticker {
  /**
   * Calls `fn` about every `ms` milliseconds, from the worker. Returns the function that stops it.
   * If a worker cannot be had (blocked by the page's security policy, unsupported, crashed):
   *   with `onLost` the subscription ends and `onLost` is called once, so the caller can fall back to what it
   *   used before; without it the subscription continues on a plain `setInterval`, which is slower in a hidden tab.
   */
  every(ms: number, fn: () => void, onLost?: () => void): () => void;
  /** 'worker' while a worker is running, 'timer' once the worker proved unavailable, 'idle' with nothing subscribed. */
  kind(): 'worker' | 'timer' | 'idle';
  dispose(): void;
}

interface Timers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

const realTimers: Timers = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
};

interface Sub { id: number; ms: number; fn: () => void; onLost?: () => void; timer?: unknown }

export function createTicker(createWorker: CreateWorker | null, timers: Timers = realTimers): Ticker {
  const subs = new Map<number, Sub>();
  let worker: WorkerLike | null = null;
  let broken = createWorker === null;
  let nextId = 1;

  function runOnTimer(sub: Sub) {
    sub.timer = timers.setInterval(sub.fn, sub.ms);
  }

  function lose() {
    // The worker is not usable. Subscribers with an `onLost` hand over; the rest continue on plain timers.
    broken = true;
    try { worker?.terminate(); } catch { /* already gone */ }
    worker = null;
    for (const sub of [...subs.values()]) {
      if (sub.onLost) {
        subs.delete(sub.id);
        try { sub.onLost(); } catch { /* the caller's problem */ }
      } else {
        runOnTimer(sub);
      }
    }
  }

  function ensureWorker(): boolean {
    if (broken) return false;
    if (worker) return true;
    try {
      const w = createWorker!();
      w.onmessage = (event) => {
        const sub = subs.get(event.data as number);
        if (sub && !sub.timer) {
          try { sub.fn(); } catch { /* a tick must not stop the clock */ }
        }
      };
      w.onerror = () => lose();
      worker = w;
      return true;
    } catch {
      lose();
      return false;
    }
  }

  return {
    every(ms, fn, onLost) {
      const sub: Sub = { id: nextId++, ms, fn, onLost };
      if (!ensureWorker()) {
        if (onLost) {
          // Answer after `every` has returned, so the caller has its stop function in hand when it hears.
          queueMicrotask(() => { try { onLost(); } catch { /* ignore */ } });
          return () => {};
        }
        runOnTimer(sub);
        subs.set(sub.id, sub);
      } else {
        subs.set(sub.id, sub);
        worker!.postMessage({ cmd: 'start', id: sub.id, ms });
      }
      return () => {
        if (!subs.has(sub.id)) return;
        subs.delete(sub.id);
        if (sub.timer !== undefined) timers.clearInterval(sub.timer);
        else worker?.postMessage({ cmd: 'stop', id: sub.id });
        // Nothing left to tick: do not keep an idle worker around.
        if (subs.size === 0 && worker) {
          try { worker.terminate(); } catch { /* already gone */ }
          worker = null;
        }
      };
    },
    kind() {
      if (subs.size === 0) return 'idle';
      return worker ? 'worker' : 'timer';
    },
    dispose() {
      for (const sub of subs.values()) if (sub.timer !== undefined) timers.clearInterval(sub.timer);
      subs.clear();
      try { worker?.terminate(); } catch { /* already gone */ }
      worker = null;
    },
  };
}
