import { describe, it, expect, vi } from 'vitest';
import { createTicker, type WorkerLike } from './ticker';
import { createHiddenSource } from './hiddenSource';
import { getPipTickWindow, setPipTickWindow, subscribePipTickWindow, type TimerHost } from './tickHost';

// A worker that records what it was told and lets the test play the ticks it would post.
function fakeWorker() {
  const w = {
    sent: [] as unknown[],
    terminated: false,
    onmessage: null as WorkerLike['onmessage'],
    onerror: null as WorkerLike['onerror'],
    postMessage(m: unknown) { w.sent.push(m); },
    terminate() { w.terminated = true; },
    tick(id: number) { w.onmessage?.({ data: id }); },
    crash() { w.onerror?.(new Error('boom')); },
  };
  return w;
}

function fakeTimers() {
  const live = new Map<number, { fn: () => void; ms: number }>();
  let n = 0;
  return {
    live,
    setInterval: (fn: () => void, ms: number) => { live.set(++n, { fn, ms }); return n; },
    clearInterval: (id: unknown) => { live.delete(id as number); },
    fire: () => live.forEach((t) => t.fn()),
  };
}

describe('ticker', () => {
  it('starts a timer in the worker and calls back on its ticks', () => {
    const w = fakeWorker();
    const ticker = createTicker(() => w);
    const fn = vi.fn();
    ticker.every(200, fn);
    expect(w.sent).toEqual([{ cmd: 'start', id: 1, ms: 200 }]);
    expect(ticker.kind()).toBe('worker');
    w.tick(1);
    w.tick(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('routes each tick to its own subscriber', () => {
    const w = fakeWorker();
    const ticker = createTicker(() => w);
    const a = vi.fn(), b = vi.fn();
    ticker.every(200, a);
    ticker.every(1000, b);
    w.tick(2);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('creates the worker only when something subscribes, and ends it when nothing is left', () => {
    const made = vi.fn(() => fakeWorker());
    const ticker = createTicker(made);
    expect(made).not.toHaveBeenCalled();
    expect(ticker.kind()).toBe('idle');
    const w = fakeWorker();
    const t2 = createTicker(() => w);
    const stop = t2.every(200, () => {});
    stop();
    expect(w.sent.at(-1)).toEqual({ cmd: 'stop', id: 1 });
    expect(w.terminated).toBe(true);
    expect(t2.kind()).toBe('idle');
  });

  it('stopping twice, or after dispose, is harmless', () => {
    const w = fakeWorker();
    const ticker = createTicker(() => w);
    const stop = ticker.every(200, () => {});
    stop();
    expect(() => stop()).not.toThrow();
    ticker.dispose();
    expect(() => ticker.dispose()).not.toThrow();
  });

  it('keeps ticking when one callback throws', () => {
    const w = fakeWorker();
    const ticker = createTicker(() => w);
    const good = vi.fn();
    ticker.every(200, () => { throw new Error('bad tick'); });
    ticker.every(200, good);
    expect(() => { w.tick(1); w.tick(2); }).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('with no worker available a plain subscriber runs on a timer', () => {
    const timers = fakeTimers();
    const ticker = createTicker(null, timers);
    const fn = vi.fn();
    const stop = ticker.every(1000, fn);
    expect(ticker.kind()).toBe('timer');
    timers.fire();
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
    expect(timers.live.size).toBe(0);
  });

  it('with no worker available a subscriber with onLost is told, and no timer is made for it', async () => {
    const timers = fakeTimers();
    const ticker = createTicker(null, timers);
    const lost = vi.fn();
    const fn = vi.fn();
    ticker.every(200, fn, lost);
    await Promise.resolve();
    expect(lost).toHaveBeenCalledTimes(1);
    expect(timers.live.size).toBe(0);
    timers.fire();
    expect(fn).not.toHaveBeenCalled();
  });

  it('a worker that cannot be created (blocked by policy) is the same as none', async () => {
    const timers = fakeTimers();
    const ticker = createTicker(() => { throw new Error('SecurityError'); }, timers);
    const lost = vi.fn();
    ticker.every(200, () => {}, lost);
    await Promise.resolve();
    expect(lost).toHaveBeenCalledTimes(1);
    // and the next subscriber, which cannot lose anything, falls back to a timer
    const fn = vi.fn();
    ticker.every(1000, fn);
    timers.fire();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a worker that crashes later hands over: onLost subscribers are told, others move to timers', () => {
    const timers = fakeTimers();
    const w = fakeWorker();
    const ticker = createTicker(() => w, timers);
    const lost = vi.fn(), keep = vi.fn(), plain = vi.fn();
    ticker.every(200, keep, lost);
    ticker.every(1000, plain);
    w.crash();
    expect(w.terminated).toBe(true);
    expect(lost).toHaveBeenCalledTimes(1);
    expect(timers.live.size).toBe(1); // only the plain one
    timers.fire();
    expect(plain).toHaveBeenCalledTimes(1);
    expect(keep).not.toHaveBeenCalled();
    expect(ticker.kind()).toBe('timer');
  });
});

describe('who ticks while the tab is hidden', () => {
  function pipWindow(): TimerHost & { ticks: Map<number, () => void>; cleared: number[] } {
    const ticks = new Map<number, () => void>();
    const cleared: number[] = [];
    let n = 100;
    return {
      closed: false,
      ticks,
      cleared,
      setInterval(fn) { ticks.set(++n, fn); return n; },
      clearInterval(id) { ticks.delete(id); cleared.push(id); },
    };
  }

  function setup(opts: { pip?: TimerHost | null; worker?: ReturnType<typeof fakeWorker> | null } = {}) {
    let pip: TimerHost | null = opts.pip ?? null;
    const listeners = new Set<() => void>();
    const w = opts.worker === undefined ? fakeWorker() : opts.worker;
    const ticker = createTicker(w ? () => w : null, fakeTimers());
    const tick = vi.fn();
    const onLost = vi.fn();
    const source = createHiddenSource({
      intervalMs: 200,
      tick,
      ticker,
      getPip: () => pip,
      subscribePip: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      onLost,
    });
    return { source, tick, onLost, w, ticker, setPip(next: TimerHost | null) { pip = next; listeners.forEach((fn) => fn()); }, listeners };
  }

  it('uses a worker when there is no mini window', () => {
    const { source, w, tick } = setup();
    source.start();
    expect(source.kind()).toBe('worker');
    w!.tick(1);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('uses the mini window\'s timers when it is open, and creates no worker at all', () => {
    const pip = pipWindow();
    const made = vi.fn(() => fakeWorker());
    let current: TimerHost | null = pip;
    const ticker = createTicker(made);
    const tick = vi.fn();
    const source = createHiddenSource({ intervalMs: 200, tick, ticker, getPip: () => current, subscribePip: () => () => {}, onLost: vi.fn() });
    source.start();
    expect(source.kind()).toBe('pip');
    expect(made).not.toHaveBeenCalled();
    [...pip.ticks.values()][0]();
    expect(tick).toHaveBeenCalledTimes(1);
    current = null;
    source.stop();
    expect(pip.ticks.size).toBe(0);
  });

  it('moves to the mini window when it opens and back to the worker when it closes, never both', () => {
    const t = setup();
    t.source.start();
    expect(t.source.kind()).toBe('worker');
    const pip = pipWindow();
    t.setPip(pip);
    expect(t.source.kind()).toBe('pip');
    expect(t.w!.sent.at(-1)).toEqual({ cmd: 'stop', id: 1 });
    t.setPip(null);
    expect(t.source.kind()).toBe('worker');
    expect(pip.ticks.size).toBe(0);
  });

  it('a window that refuses timers is skipped for the worker', () => {
    const bad: TimerHost = { closed: false, setInterval() { throw new Error('nope'); }, clearInterval() {} };
    const { source } = setup({ pip: bad });
    source.start();
    expect(source.kind()).toBe('worker');
  });

  it('tells the caller when nothing is left to tick (no worker): it then uses its own interval', async () => {
    const { source, onLost } = setup({ worker: null });
    source.start();
    await Promise.resolve();
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(source.kind()).toBeNull();
  });

  it('a worker that dies mid-run reports the loss once', () => {
    const { source, onLost, w } = setup();
    source.start();
    w!.crash();
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(source.kind()).toBeNull();
  });

  it('stop ends everything: no ticks, no worker, no listener on the window', () => {
    const t = setup();
    t.source.start();
    t.source.stop();
    expect(t.w!.terminated).toBe(true);
    expect(t.listeners.size).toBe(0);
    expect(t.source.kind()).toBeNull();
    t.setPip(pipWindow());
    expect(t.source.kind()).toBeNull();
  });

  it('start twice does not double the ticks', () => {
    const { source, w } = setup();
    source.start();
    source.start();
    expect(w!.sent.filter((m) => (m as { cmd: string }).cmd === 'start')).toHaveLength(1);
  });
});

describe('the PiP window registry', () => {
  it('hands out an open window only, and tells listeners when it changes', () => {
    const seen = vi.fn();
    const off = subscribePipTickWindow(seen);
    const win = { closed: false, setInterval: () => 1, clearInterval: () => {} } as TimerHost & { closed: boolean };
    setPipTickWindow(win);
    expect(getPipTickWindow()).toBe(win);
    (win as { closed: boolean }).closed = true;
    expect(getPipTickWindow()).toBeNull();
    setPipTickWindow(null);
    setPipTickWindow(null); // no change, no call
    expect(seen).toHaveBeenCalledTimes(2);
    off();
    setPipTickWindow(win);
    expect(seen).toHaveBeenCalledTimes(2);
    setPipTickWindow(null);
  });
});
