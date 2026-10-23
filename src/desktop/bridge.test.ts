import { describe, expect, it } from 'vitest';
import { createDesktopBridge, type AppSnapshot } from './bridge';
import {
  DESKTOP_COMMAND_EVENT,
  DESKTOP_STATE_EVENT,
  parsePauseDetail,
  reportPauseState,
} from './events';
import type { DesktopCommand, DesktopState } from './ipc';

/** Everything the bridge touches, faked. */
function setup(initial: AppSnapshot = { cameraEnabled: true, detecting: false }) {
  let app = { ...initial };
  const listeners = new Set<() => void>();
  const sent: DesktopState[] = [];
  const cameraCalls: boolean[] = [];
  const scheduled: Array<() => void> = [];
  let sendCommand: (c: DesktopCommand) => void = () => {};
  let unsubscribedCommands = 0;
  const target = new EventTarget();
  const seen: DesktopCommand[] = [];
  target.addEventListener(DESKTOP_COMMAND_EVENT, (e) => seen.push((e as CustomEvent<DesktopCommand>).detail));

  const bridge = createDesktopBridge({
    api: {
      onCommand: (cb) => {
        sendCommand = cb;
        return () => { unsubscribedCommands++; };
      },
      sendState: (s) => { sent.push(s); },
    },
    target,
    getApp: () => app,
    subscribeApp: (l) => { listeners.add(l); return () => listeners.delete(l); },
    setCameraEnabled: (on) => { cameraCalls.push(on); app = { ...app, cameraEnabled: on }; },
    schedule: (fn) => { scheduled.push(fn); },
  });

  return {
    bridge, target, seen, sent, cameraCalls, scheduled,
    command: (c: DesktopCommand) => sendCommand(c),
    setApp(next: Partial<AppSnapshot>) { app = { ...app, ...next }; listeners.forEach((l) => l()); },
    listenerCount: () => listeners.size,
    unsubscribedCommands: () => unsubscribedCommands,
  };
}

describe('commands: tray -> DOM event', () => {
  it('turns every command type into a stopbiting:desktop-command event with the command as detail', () => {
    const t = setup();
    const commands: DesktopCommand[] = [
      { type: 'start' }, { type: 'stop' }, { type: 'pause', minutes: 60 }, { type: 'resume' },
    ];
    for (const c of commands) t.command(c);
    expect(t.seen).toEqual(commands);
  });

  it('the event is cancelable', () => {
    const t = setup();
    let cancelable = false;
    t.target.addEventListener(DESKTOP_COMMAND_EVENT, (e) => { cancelable = e.cancelable; });
    t.command({ type: 'stop' });
    expect(cancelable).toBe(true);
  });

  it('keeps its documented name', () => {
    expect(DESKTOP_COMMAND_EVENT).toBe('stopbiting:desktop-command');
    expect(DESKTOP_STATE_EVENT).toBe('stopbiting:desktop-state');
  });
});

describe('default action for start and stop', () => {
  it('stop switches the camera off', () => {
    const t = setup({ cameraEnabled: true, detecting: true });
    t.command({ type: 'stop' });
    expect(t.cameraCalls).toEqual([false]);
  });

  it('start switches the camera on', () => {
    const t = setup({ cameraEnabled: false, detecting: false });
    t.command({ type: 'start' });
    expect(t.cameraCalls).toEqual([true]);
    expect(t.scheduled).toHaveLength(0);
  });

  it('start while switched on but not running restarts it (the Retry button does the same)', () => {
    const t = setup({ cameraEnabled: true, detecting: false });
    t.command({ type: 'start' });
    expect(t.cameraCalls).toEqual([false]);
    expect(t.scheduled).toHaveLength(1);
    t.scheduled[0]();
    expect(t.cameraCalls).toEqual([false, true]);
  });

  it('pause and resume have no default action: the pause feature owns them', () => {
    const t = setup({ cameraEnabled: true, detecting: true });
    t.command({ type: 'pause', minutes: 15 });
    t.command({ type: 'resume' });
    expect(t.cameraCalls).toEqual([]);
  });

  it('a listener that calls preventDefault() has handled the command', () => {
    const t = setup({ cameraEnabled: true, detecting: true });
    t.target.addEventListener(DESKTOP_COMMAND_EVENT, (e) => e.preventDefault());
    t.command({ type: 'stop' });
    t.command({ type: 'start' });
    expect(t.cameraCalls).toEqual([]);
  });
});

describe('state: app -> tray', () => {
  it('sends the first state at once, with pausing marked unsupported', () => {
    const t = setup();
    expect(t.sent).toEqual([{ watching: false, paused: false, pausedUntil: null, pauseSupported: false }]);
  });

  it('follows the detection loop', () => {
    const t = setup();
    t.setApp({ detecting: true });
    expect(t.sent.at(-1)).toMatchObject({ watching: true });
    t.setApp({ detecting: false });
    expect(t.sent.at(-1)).toMatchObject({ watching: false });
  });

  it('does not send the same state twice', () => {
    const t = setup();
    t.setApp({ cameraEnabled: false }); // not part of the reported state
    t.setApp({ detecting: false });
    expect(t.sent).toHaveLength(1);
    t.setApp({ detecting: true });
    t.setApp({ detecting: true });
    expect(t.sent).toHaveLength(2);
  });

  it('the pause feature reports through the DOM event, which also switches pausing on', () => {
    const t = setup({ cameraEnabled: true, detecting: true });
    const until = 1_800_000_000_000;
    reportPauseState({ paused: true, pausedUntil: until }, t.target);
    expect(t.sent.at(-1)).toEqual({ watching: true, paused: true, pausedUntil: until, pauseSupported: true });
    reportPauseState({ paused: false }, t.target);
    expect(t.sent.at(-1)).toEqual({ watching: true, paused: false, pausedUntil: null, pauseSupported: true });
  });

  it('ignores a malformed pause report', () => {
    const t = setup();
    const before = t.sent.length;
    t.target.dispatchEvent(new CustomEvent(DESKTOP_STATE_EVENT, { detail: { paused: 'yes' } }));
    t.target.dispatchEvent(new CustomEvent(DESKTOP_STATE_EVENT, { detail: null }));
    t.target.dispatchEvent(new CustomEvent(DESKTOP_STATE_EVENT, { detail: { paused: true, pausedUntil: 'soon' } }));
    expect(t.sent).toHaveLength(before);
    expect(t.bridge.getState().pauseSupported).toBe(false);
  });

  it('a paused state without an end time is still paused', () => {
    const t = setup();
    reportPauseState({ paused: true }, t.target);
    expect(t.sent.at(-1)).toMatchObject({ paused: true, pausedUntil: null });
  });
});

describe('dispose', () => {
  it('stops listening to all three sources', () => {
    const t = setup();
    t.bridge.dispose();
    expect(t.unsubscribedCommands()).toBe(1);
    expect(t.listenerCount()).toBe(0);
    const before = t.sent.length;
    reportPauseState({ paused: true }, t.target);
    expect(t.sent).toHaveLength(before);
  });
});

describe('parsePauseDetail', () => {
  it('accepts paused with or without an end', () => {
    expect(parsePauseDetail({ paused: true, pausedUntil: 5 })).toEqual({ paused: true, pausedUntil: 5 });
    expect(parsePauseDetail({ paused: false, pausedUntil: 5 })).toEqual({ paused: false, pausedUntil: null });
    expect(parsePauseDetail({ paused: true })).toEqual({ paused: true, pausedUntil: null });
    expect(parsePauseDetail({ paused: true, pausedUntil: null })).toEqual({ paused: true, pausedUntil: null });
  });

  it('rejects the rest', () => {
    for (const bad of [null, undefined, 'x', 3, {}, { paused: 1 }, { paused: true, pausedUntil: -1 }, { paused: true, pausedUntil: NaN }]) {
      expect(parsePauseDetail(bad)).toBeNull();
    }
  });
});
