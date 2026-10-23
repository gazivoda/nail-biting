import { describe, it, expect, afterEach, vi } from 'vitest';
import { askNotificationPermission, notificationPermission, planTurnOn, showStartWatchingReminder, REMINDER_TITLE } from './reminders';

type G = { Notification?: unknown; window?: unknown };
const g = globalThis as unknown as G;
const saved = { Notification: g.Notification, window: g.window };

afterEach(() => {
  if (saved.Notification === undefined) delete g.Notification; else g.Notification = saved.Notification;
  if (saved.window === undefined) delete g.window; else g.window = saved.window;
  vi.restoreAllMocks();
});

function fakeNotification(permission: 'default' | 'granted' | 'denied', answer: 'granted' | 'denied' | 'default' = 'granted') {
  const created: Array<{ title: string; options: Record<string, unknown>; onclick: (() => void) | null; close: () => void }> = [];
  const requestPermission = vi.fn(async () => answer);
  class FakeNotification {
    static permission = permission;
    static requestPermission = requestPermission;
    onclick: (() => void) | null = null;
    close = vi.fn();
    constructor(public title: string, public options: Record<string, unknown>) { created.push(this); }
  }
  g.Notification = FakeNotification;
  return { created, requestPermission };
}

describe('turning the reminder on', () => {
  it('plans the right thing for each state of the permission', () => {
    expect(planTurnOn('granted')).toBe('enable');
    expect(planTurnOn('default')).toBe('explain');
    expect(planTurnOn('denied')).toBe('denied');
    expect(planTurnOn('unsupported')).toBe('unsupported');
  });

  it('reads the permission without asking for anything', () => {
    const f = fakeNotification('default');
    expect(notificationPermission()).toBe('default');
    expect(f.requestPermission).not.toHaveBeenCalled();
  });

  it('says "unsupported" where there is no Notification API', () => {
    delete g.Notification;
    expect(notificationPermission()).toBe('unsupported');
  });

  it('the desktop app counts as allowed (it uses native notifications)', () => {
    g.window = { desktop: {} };
    expect(notificationPermission()).toBe('granted');
  });

  it('prompts only when the browser has never been asked', async () => {
    const asked = fakeNotification('default', 'granted');
    expect(await askNotificationPermission()).toBe('granted');
    expect(asked.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('never prompts again after a decision (granted or blocked) or where it is impossible', async () => {
    for (const decided of ['granted', 'denied'] as const) {
      const f = fakeNotification(decided);
      expect(await askNotificationPermission()).toBe(decided);
      expect(f.requestPermission).not.toHaveBeenCalled();
    }
    delete g.Notification;
    expect(await askNotificationPermission()).toBe('unsupported');
  });

  it('a dismissed prompt stays "default" (the reminder stays off)', async () => {
    fakeNotification('default', 'default');
    expect(await askNotificationPermission()).toBe('default');
  });
});

describe('showing the reminder', () => {
  it('shows one notification whose click brings the app to the front', () => {
    const f = fakeNotification('granted');
    const focus = vi.fn();
    g.window = { focus };
    expect(showStartWatchingReminder()).toBe(true);
    expect(f.created).toHaveLength(1);
    expect(f.created[0].title).toBe(REMINDER_TITLE);
    expect(f.created[0].options.tag).toBe('stopbiting-schedule');
    f.created[0].onclick?.();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(f.created[0].close).toHaveBeenCalled();
  });

  it('shows nothing without permission', () => {
    for (const p of ['default', 'denied'] as const) {
      const f = fakeNotification(p);
      g.window = { focus: vi.fn() };
      expect(showStartWatchingReminder()).toBe(false);
      expect(f.created).toHaveLength(0);
    }
  });

  it('in the desktop app it goes through the native notification, whose click opens the window', () => {
    const notify = vi.fn();
    g.window = { desktop: { notify } };
    expect(showStartWatchingReminder()).toBe(true);
    expect(notify).toHaveBeenCalledWith({ title: REMINDER_TITLE, body: expect.any(String), clickAction: 'open' });
  });

  it('a browser that refuses the constructor is a "not shown", not a crash', () => {
    class Throwing { static permission = 'granted'; constructor() { throw new TypeError('Illegal constructor'); } }
    g.Notification = Throwing;
    g.window = { focus: vi.fn() };
    expect(showStartWatchingReminder()).toBe(false);
  });

  it('the wording makes no medical claim and shows no picture', () => {
    const f = fakeNotification('granted');
    g.window = { focus: vi.fn() };
    showStartWatchingReminder();
    const text = JSON.stringify(f.created[0]);
    expect(text).not.toMatch(/treat|cure|therapy|clinical|bite|nail/i);
    expect(f.created[0].options.image).toBeUndefined();
  });
});
