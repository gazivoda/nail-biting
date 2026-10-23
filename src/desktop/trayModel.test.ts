import { describe, expect, it } from 'vitest';
import { INITIAL_DESKTOP_STATE, MAX_PAUSE_MINUTES, type DesktopState } from './ipc';
import {
  TOMORROW_RESUME_HOUR,
  buildTrayMenu,
  formatResumeTime,
  nextMorning,
  pauseMinutes,
  shouldPreventSuspension,
  statusLabel,
  trayTooltip,
  type TrayMenuItem,
  type TrayModelInput,
} from './trayModel';

const NOW = new Date(2026, 9, 23, 14, 30, 0).getTime(); // Fri 23 Oct 2026, 14:30 local

type Override = {
  state?: Partial<DesktopState>;
  launchAtLogin?: boolean;
  loginItem?: TrayModelInput['loginItem'];
  now?: number;
};

function input(over: Override = {}): TrayModelInput {
  return {
    state: { ...INITIAL_DESKTOP_STATE, ...over.state },
    launchAtLogin: over.launchAtLogin ?? false,
    loginItem: over.loginItem ?? 'supported',
    now: over.now ?? NOW,
  };
}

function item(menu: TrayMenuItem[], id: string) {
  const found = menu.find((i) => i.type !== 'separator' && i.id === id);
  return found && found.type !== 'separator' ? found : undefined;
}

function ids(menu: TrayMenuItem[]) {
  return menu.map((i) => (i.type === 'separator' ? '-' : i.id));
}

describe('nextMorning', () => {
  it('evening: 08:00 the next day', () => {
    const d = nextMorning(new Date(2026, 9, 23, 22, 0));
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([24, TOMORROW_RESUME_HOUR, 0]);
  });

  it('small hours: 08:00 the same morning', () => {
    const d = nextMorning(new Date(2026, 9, 24, 2, 0));
    expect([d.getDate(), d.getHours()]).toEqual([24, TOMORROW_RESUME_HOUR]);
  });

  it('never fewer than two hours away: 07:00 means tomorrow, not in an hour', () => {
    const d = nextMorning(new Date(2026, 9, 24, 7, 0));
    expect(d.getDate()).toBe(25);
    const edge = nextMorning(new Date(2026, 9, 24, 6, 0));
    expect(edge.getDate()).toBe(24); // exactly two hours: allowed
  });

  it('during the day: 08:00 tomorrow', () => {
    expect(nextMorning(new Date(2026, 9, 23, 9, 0)).getDate()).toBe(24);
    expect(nextMorning(new Date(2026, 9, 23, 8, 0)).getDate()).toBe(24);
  });

  it('month and year rollover', () => {
    const d = nextMorning(new Date(2026, 11, 31, 23, 0));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2027, 0, 1, 8]);
  });

  it('stays within the pause limit for every minute of a day', () => {
    for (let minute = 0; minute < 24 * 60; minute += 7) {
      const now = new Date(2026, 9, 23, 0, minute);
      const m = pauseMinutes('tomorrow', now);
      expect(m).toBeGreaterThanOrEqual(120);
      expect(m).toBeLessThanOrEqual(MAX_PAUSE_MINUTES);
    }
  });
});

describe('pauseMinutes', () => {
  it('fixed choices', () => {
    expect(pauseMinutes('15m', new Date(NOW))).toBe(15);
    expect(pauseMinutes('1h', new Date(NOW))).toBe(60);
  });

  it('until tomorrow is whole minutes to the next morning', () => {
    // 14:30 -> 08:00 next day = 17.5 h
    expect(pauseMinutes('tomorrow', new Date(NOW))).toBe(17 * 60 + 30);
    // rounds a partial minute up
    expect(pauseMinutes('tomorrow', new Date(2026, 9, 23, 22, 0, 30))).toBe(10 * 60);
  });
});

describe('formatResumeTime', () => {
  it('today, tomorrow, later', () => {
    expect(formatResumeTime(new Date(2026, 9, 23, 15, 45).getTime(), NOW)).toBe('3:45 PM');
    expect(formatResumeTime(new Date(2026, 9, 23, 0, 5).getTime(), NOW)).toBe('12:05 AM');
    expect(formatResumeTime(new Date(2026, 9, 23, 12, 0).getTime(), NOW)).toBe('12:00 PM');
    expect(formatResumeTime(new Date(2026, 9, 24, 8, 0).getTime(), NOW)).toBe('tomorrow 8:00 AM');
    expect(formatResumeTime(new Date(2026, 9, 26, 8, 0).getTime(), NOW)).toBe('Mon 8:00 AM');
  });
});

describe('status and tooltip', () => {
  it('says what the app is doing', () => {
    expect(statusLabel(INITIAL_DESKTOP_STATE, NOW)).toBe('Not watching');
    expect(statusLabel({ ...INITIAL_DESKTOP_STATE, watching: true }, NOW)).toBe('Watching');
    expect(statusLabel({ ...INITIAL_DESKTOP_STATE, paused: true, pausedUntil: null }, NOW)).toBe('Paused');
    expect(
      statusLabel({ ...INITIAL_DESKTOP_STATE, paused: true, pausedUntil: new Date(2026, 9, 23, 15, 0).getTime() }, NOW),
    ).toBe('Paused until 3:00 PM');
    expect(trayTooltip({ ...INITIAL_DESKTOP_STATE, watching: true }, NOW)).toBe('Stop Biting: watching');
  });
});

describe('buildTrayMenu', () => {
  it('stopped: offers Start, pause items present but disabled, no Resume', () => {
    const menu = buildTrayMenu(input());
    expect(ids(menu)).toEqual([
      'open', '-', 'status', 'toggle', 'pause-15m', 'pause-1h', 'pause-tomorrow', '-', 'login', '-', 'quit',
    ]);
    expect(item(menu, 'toggle')?.label).toBe('Start watching');
    expect(item(menu, 'status')?.label).toBe('Not watching');
    expect(item(menu, 'status')?.enabled).toBe(false);
    for (const id of ['pause-15m', 'pause-1h', 'pause-tomorrow']) expect(item(menu, id)?.enabled).toBe(false);
    expect(item(menu, 'resume')).toBeUndefined();
  });

  it('watching but pausing not built yet: Stop, pause items stay disabled', () => {
    const menu = buildTrayMenu(input({ state: { watching: true, pauseSupported: false } }));
    expect(item(menu, 'toggle')?.label).toBe('Stop watching');
    expect(item(menu, 'status')?.label).toBe('Watching');
    expect(item(menu, 'pause-1h')?.enabled).toBe(false);
  });

  it('watching with pausing available: the three pause items are enabled', () => {
    const menu = buildTrayMenu(input({ state: { watching: true, pauseSupported: true } }));
    expect(item(menu, 'pause-15m')?.label).toBe('Pause for 15 minutes');
    expect(item(menu, 'pause-1h')?.label).toBe('Pause for 1 hour');
    expect(item(menu, 'pause-tomorrow')?.label).toBe('Pause until tomorrow');
    for (const id of ['pause-15m', 'pause-1h', 'pause-tomorrow']) expect(item(menu, id)?.enabled).toBe(true);
  });

  it('pausing is not offered while nothing is running', () => {
    const menu = buildTrayMenu(input({ state: { watching: false, pauseSupported: true } }));
    expect(item(menu, 'pause-15m')?.enabled).toBe(false);
  });

  it('paused: Resume replaces the pause items, status shows the end, toggle stops', () => {
    const until = new Date(2026, 9, 23, 15, 0).getTime();
    const menu = buildTrayMenu(input({ state: { watching: false, paused: true, pausedUntil: until, pauseSupported: true } }));
    expect(item(menu, 'resume')?.enabled).toBe(true);
    expect(item(menu, 'pause-15m')).toBeUndefined();
    expect(item(menu, 'status')?.label).toBe('Paused until 3:00 PM');
    expect(item(menu, 'toggle')?.label).toBe('Stop watching');
  });

  it('launch at login: a checkbox that mirrors the choice', () => {
    const on = item(buildTrayMenu(input({ launchAtLogin: true })), 'login');
    expect(on).toMatchObject({ type: 'checkbox', checked: true, enabled: true, label: 'Launch at login' });
    const off = item(buildTrayMenu(input({ launchAtLogin: false })), 'login');
    expect(off).toMatchObject({ checked: false, enabled: true });
  });

  it('launch at login: disabled in an unpackaged build, hidden where the OS has no login items', () => {
    const dev = item(buildTrayMenu(input({ loginItem: 'dev-only' })), 'login');
    expect(dev?.enabled).toBe(false);
    expect(dev?.label).toContain('installed app only');
    const linux = buildTrayMenu(input({ loginItem: 'unsupported' }));
    expect(item(linux, 'login')).toBeUndefined();
    expect(ids(linux).filter((i) => i === '-')).toHaveLength(2); // no doubled separator
  });

  it('always has Open and Quit enabled', () => {
    const menu = buildTrayMenu(input());
    expect(item(menu, 'open')).toMatchObject({ enabled: true, label: 'Open Stop Biting' });
    expect(item(menu, 'quit')).toMatchObject({ enabled: true, label: 'Quit Stop Biting' });
  });

  it('every menu id is unique', () => {
    const states: Partial<DesktopState>[] = [
      {},
      { watching: true, pauseSupported: true },
      { paused: true, pausedUntil: null, pauseSupported: true },
    ];
    for (const state of states) {
      const named = ids(buildTrayMenu(input({ state }))).filter((i) => i !== '-');
      expect(new Set(named).size).toBe(named.length);
    }
  });
});

describe('shouldPreventSuspension', () => {
  it('only while detection runs and is not paused', () => {
    expect(shouldPreventSuspension({ ...INITIAL_DESKTOP_STATE, watching: true })).toBe(true);
    expect(shouldPreventSuspension(INITIAL_DESKTOP_STATE)).toBe(false);
    expect(shouldPreventSuspension({ ...INITIAL_DESKTOP_STATE, watching: true, paused: true })).toBe(false);
  });
});
