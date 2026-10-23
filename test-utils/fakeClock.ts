// A clock and a timer queue that only move when a test says so. The sync engine
// is handed `now` and `timers` from here, so "five minutes later" is one line
// and nothing in a test depends on real time.

export interface FakeClock {
  now(): number;
  timers: { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void };
  /** Moves time forward, running every timer that falls due, in order, letting promises settle in between. */
  advance(ms: number): Promise<void>;
  /** Lets already-resolved promises run (no time passes). */
  settle(): Promise<void>;
  /** How many timers are waiting. */
  pending(): number;
  /** When the next timer is due, or null. */
  nextDue(): number | null;
  set(ms: number): void;
}

export function createFakeClock(start = 1_700_000_000_000): FakeClock {
  let t = start;
  let nextId = 0;
  const queue = new Map<number, { at: number; fn: () => void }>();

  const settle = async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  };

  const earliest = () => {
    let best: { id: number; at: number } | null = null;
    for (const [id, q] of queue) if (!best || q.at < best.at || (q.at === best.at && id < best.id)) best = { id, at: q.at };
    return best;
  };

  return {
    now: () => t,
    timers: {
      setTimeout(fn, ms) {
        const id = ++nextId;
        queue.set(id, { at: t + Math.max(0, ms), fn });
        return id;
      },
      clearTimeout(handle) {
        queue.delete(handle as number);
      },
    },
    async advance(ms) {
      const end = t + ms;
      await settle();
      for (;;) {
        const next = earliest();
        if (!next || next.at > end) break;
        const q = queue.get(next.id)!;
        queue.delete(next.id);
        t = Math.max(t, q.at);
        q.fn();
        await settle();
      }
      t = end;
      await settle();
    },
    settle,
    pending: () => queue.size,
    nextDue: () => earliest()?.at ?? null,
    set(ms) { t = ms; },
  };
}
