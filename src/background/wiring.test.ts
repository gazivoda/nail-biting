import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkReminder, connectDesktop, mirrorCameraSwitch, runExpiryClock } from './wiring';
import { dispatchWatch, getWatchState, resetWatchForTests, subscribeWatch } from './watchStore';
import { DEFAULT_SCHEDULE, type Schedule } from './schedule';
import { createDesktopBridge } from '../desktop/bridge';
import type { DesktopCommand, DesktopState } from '../desktop/ipc';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';

const MIN = 60_000;

beforeEach(() => {
  setStorageAdapter(createMemoryAdapter());
  resetWatchForTests();
});
afterEach(() => {
  vi.useRealTimers();
  resetStorage();
  resetWatchForTests();
});

describe('the desktop shell drives the same state machine', () => {
  // The REAL bridge from src/desktop/bridge.ts on one side, the real store on the other, a fake tray and camera.
  function setup(initial = { cameraEnabled: true, detecting: true }) {
    let app = { ...initial };
    const appListeners = new Set<() => void>();
    const sent: DesktopState[] = [];
    const cameraCalls: boolean[] = [];
    let sendCommand: (c: DesktopCommand) => void = () => {};
    const target = new EventTarget();
    const later: Array<() => void> = [];

    const bridge = createDesktopBridge({
      api: { onCommand: (cb) => { sendCommand = cb; return () => {}; }, sendState: (s) => { sent.push(s); } },
      target,
      getApp: () => app,
      subscribeApp: (l) => { appListeners.add(l); return () => appListeners.delete(l); },
      setCameraEnabled: (on) => { cameraCalls.push(on); app = { ...app, cameraEnabled: on }; appListeners.forEach((l) => l()); },
      schedule: () => {},
    });
    const disconnect = connectDesktop({
      target,
      isDesktop: true,
      getState: getWatchState,
      subscribe: subscribeWatch,
      dispatch: dispatchWatch,
      pause: (minutes) => dispatchWatch({ type: 'pause', now: Date.now(), minutes }),
      later: (fn) => { later.push(fn); },
    });
    return {
      bridge, sent, cameraCalls, later, disconnect,
      command: (c: DesktopCommand) => sendCommand(c),
      last: () => sent[sent.length - 1],
      setDetecting(detecting: boolean) { app = { ...app, detecting }; appListeners.forEach((l) => l()); },
    };
  }

  it('the first report tells the tray that pausing exists', () => {
    const t = setup();
    expect(t.last()).toMatchObject({ pauseSupported: true, paused: false, pausedUntil: null });
  });

  it('a tray "Pause for 15 minutes" pauses, reports the end time, and leaves the camera to the pause', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 14, 0));
    const t0 = Date.now();
    const t = setup();
    t.command({ type: 'pause', minutes: 15 });
    expect(getWatchState()).toEqual({ kind: 'paused', until: t0 + 15 * MIN, releaseCamera: true });
    expect(t.last()).toMatchObject({ paused: true, pausedUntil: t0 + 15 * MIN, pauseSupported: true });
    expect(t.cameraCalls).toEqual([]); // the bridge's default action is not used for pause
  });

  it('"Resume" ends the pause and reports it', () => {
    const t = setup();
    t.command({ type: 'pause', minutes: 60 });
    t.command({ type: 'resume' });
    expect(getWatchState()).toEqual({ kind: 'running' });
    expect(t.last()).toMatchObject({ paused: false, pausedUntil: null });
    expect(t.cameraCalls).toEqual([]);
  });

  it('the tray shows the pause as the app has it: detection stops (watching false) and paused stays true', () => {
    const t = setup();
    t.command({ type: 'pause', minutes: 15 });
    t.setDetecting(false); // what CameraView does when the pause switches inference off
    expect(t.last()).toMatchObject({ watching: false, paused: true });
  });

  it('"Stop watching" while paused stops the machine and switches the camera off', () => {
    const t = setup();
    t.command({ type: 'pause', minutes: 15 });
    t.command({ type: 'stop' });
    expect(getWatchState()).toEqual({ kind: 'stopped' });
    expect(t.cameraCalls).toEqual([false]);
    expect(t.last()).toMatchObject({ paused: false });
  });

  it('"Start" while paused is a resume (and does not restart the camera)', () => {
    const t = setup();
    t.command({ type: 'pause', minutes: 15 });
    t.command({ type: 'start' });
    expect(getWatchState()).toEqual({ kind: 'running' });
    expect(t.cameraCalls).toEqual([]);
  });

  it('"Start" while stopped starts the machine and lets the bridge switch the camera on', () => {
    const t = setup({ cameraEnabled: false, detecting: false });
    dispatchWatch({ type: 'stop' });
    t.command({ type: 'start' });
    expect(getWatchState()).toEqual({ kind: 'running' });
    expect(t.cameraCalls).toEqual([true]);
  });

  it('a command with a broken payload is ignored', () => {
    const t = setup();
    // bypass the tray's own validation: whatever reaches the window event must not break the machine
    const target = new EventTarget();
    const off = connectDesktop({ target, isDesktop: false, getState: getWatchState, subscribe: subscribeWatch, dispatch: dispatchWatch, pause: vi.fn() });
    for (const detail of [null, {}, { type: 5 }, { type: 'pause' }, { type: 'pause', minutes: 'soon' }, { type: 'nap' }]) {
      target.dispatchEvent(new CustomEvent('stopbiting:desktop-command', { detail, cancelable: true }));
    }
    expect(getWatchState()).toEqual({ kind: 'running' });
    off();
    t.disconnect();
  });

  it('in a browser (no desktop shell) nothing is reported to a tray', () => {
    const target = new EventTarget();
    const reports = vi.fn();
    target.addEventListener('stopbiting:desktop-state', reports);
    const later = vi.fn();
    const off = connectDesktop({ target, isDesktop: false, getState: getWatchState, subscribe: subscribeWatch, dispatch: dispatchWatch, pause: vi.fn(), later });
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 15 });
    expect(reports).not.toHaveBeenCalled();
    expect(later).not.toHaveBeenCalled();
    off();
  });

  it('repeats the first report a few times, in case the bridge was not loaded yet', () => {
    const t = setup();
    expect(t.later).toHaveLength(3);
    const before = t.sent.length;
    t.later.forEach((fn) => fn()); // the bridge ignores a repeat of what it already sent
    expect(t.sent.length).toBe(before);
  });

  it('disconnecting removes the listener', () => {
    const t = setup();
    t.disconnect();
    t.command({ type: 'pause', minutes: 15 });
    expect(getWatchState().kind).toBe('running');
  });
});

describe('the camera switch', () => {
  function setup(initial: boolean) {
    let enabled = initial;
    const listeners = new Set<(e: boolean, p: boolean) => void>();
    const events: string[] = [];
    const off = mirrorCameraSwitch({
      getCameraEnabled: () => enabled,
      subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
      dispatch: (e) => { events.push(e.type); dispatchWatch(e); },
    });
    return { events, off, set(next: boolean) { const p = enabled; enabled = next; listeners.forEach((l) => l(next, p)); } };
  }

  it('a load with the switch on does nothing (so a pause that is still running survives a reload)', () => {
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 30 });
    const t = setup(true);
    expect(t.events).toEqual([]);
    expect(getWatchState().kind).toBe('paused');
  });

  it('turning the switch off stops (and clears a pause); turning it on again runs', () => {
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 30 });
    const t = setup(true);
    t.set(false);
    expect(getWatchState()).toEqual({ kind: 'stopped' });
    t.set(true);
    expect(getWatchState()).toEqual({ kind: 'running' });
  });

  it('a switch that is already off at load is a stopped machine', () => {
    setup(false);
    expect(getWatchState()).toEqual({ kind: 'stopped' });
  });

  it('a "change" to the same value is ignored', () => {
    const t = setup(true);
    t.set(true);
    expect(t.events).toEqual([]);
  });
});

describe('the clock that ends a pause', () => {
  function setup() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 14, 0));
    const subs = new Map<number, () => void>();
    let n = 0;
    const wake = new EventTarget();
    let visible = true;
    const off = runExpiryClock({
      getState: getWatchState,
      subscribe: subscribeWatch,
      every: (_ms, fn) => { const id = ++n; subs.set(id, fn); return () => { subs.delete(id); }; },
      dispatch: dispatchWatch,
      now: Date.now,
      wake: [[wake, 'focus']],
      isVisible: () => visible,
    });
    return { off, subs, wake, setVisible(v: boolean) { visible = v; }, run: () => subs.forEach((fn) => fn()) };
  }

  it('runs only while a pause or meeting is on', () => {
    const t = setup();
    expect(t.subs.size).toBe(0);
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 15 });
    expect(t.subs.size).toBe(1);
    dispatchWatch({ type: 'resume' });
    expect(t.subs.size).toBe(0);
    dispatchWatch({ type: 'meeting', now: Date.now(), minutes: 30 });
    expect(t.subs.size).toBe(1);
    t.off();
    expect(t.subs.size).toBe(0);
  });

  it('ends the pause by itself when its time comes, and stops its own clock', () => {
    const t = setup();
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 15 });
    vi.setSystemTime(Date.now() + 14 * MIN);
    t.run();
    expect(getWatchState().kind).toBe('paused');
    vi.setSystemTime(Date.now() + 1 * MIN);
    t.run();
    expect(getWatchState()).toEqual({ kind: 'running' });
    expect(t.subs.size).toBe(0);
  });

  it('a late tick (the laptop slept for hours) still ends it', () => {
    const t = setup();
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 15 });
    vi.setSystemTime(Date.now() + 5 * 60 * MIN);
    t.run();
    expect(getWatchState().kind).toBe('running');
  });

  it('checks when the tab wakes up, but only if it is visible', () => {
    const t = setup();
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 15 });
    vi.setSystemTime(Date.now() + 20 * MIN);
    t.setVisible(false);
    t.wake.dispatchEvent(new Event('focus'));
    expect(getWatchState().kind).toBe('paused');
    t.setVisible(true);
    t.wake.dispatchEvent(new Event('focus'));
    expect(getWatchState().kind).toBe('running');
  });

  it('on start an already-expired state is cleared at once', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 23, 14, 0));
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 5 });
    vi.setSystemTime(Date.now() + 10 * MIN);
    const off = runExpiryClock({ getState: getWatchState, subscribe: subscribeWatch, every: () => () => {}, dispatch: dispatchWatch, now: Date.now });
    expect(getWatchState().kind).toBe('running');
    off();
  });
});

describe('the reminder check', () => {
  const monday10 = new Date(2026, 9, 19, 10, 0).getTime();
  function setup(over: { schedule?: Partial<Schedule>; permission?: 'granted' | 'denied' | 'default'; front?: boolean; shows?: boolean } = {}) {
    let last: string | null = null;
    const show = vi.fn(() => over.shows ?? true);
    const run = (now = monday10) => checkReminder({
      loadSchedule: () => ({ ...DEFAULT_SCHEDULE, enabled: true, ...over.schedule }),
      getState: () => ({ kind: 'stopped' }),
      loadLastReminded: () => last,
      saveLastReminded: (id) => { last = id; },
      permission: () => over.permission ?? 'granted',
      appInFront: () => over.front ?? false,
      show,
      now: () => now,
    });
    return { run, show, last: () => last };
  }

  it('shows one reminder per window and remembers the window', () => {
    const t = setup();
    t.run(); t.run(); t.run(monday10 + 30 * MIN);
    expect(t.show).toHaveBeenCalledTimes(1);
    expect(t.last()).toBe('2026-10-19@540');
    t.run(new Date(2026, 9, 20, 9, 1).getTime());
    expect(t.show).toHaveBeenCalledTimes(2);
  });

  it('shows nothing outside the hours, without permission, with the schedule off, or with the app in front', () => {
    const outside = setup(); outside.run(new Date(2026, 9, 19, 20, 0).getTime()); // 8 pm, after the hours
    const weekend = setup(); weekend.run(new Date(2026, 9, 24, 10, 0).getTime()); // Saturday
    const denied = setup({ permission: 'denied' }); denied.run();
    const asked = setup({ permission: 'default' }); asked.run();
    const off = setup({ schedule: { enabled: false } }); off.run();
    const front = setup({ front: true }); front.run();
    for (const t of [outside, weekend, denied, asked, off, front]) expect(t.show).not.toHaveBeenCalled();
  });

  it('does not use up the window when nothing could be shown (so the next check can try again)', () => {
    const t = setup({ shows: false });
    t.run();
    expect(t.last()).toBeNull();
    t.run();
    expect(t.show).toHaveBeenCalledTimes(2);
  });
});
