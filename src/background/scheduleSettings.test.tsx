import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScheduleSettings } from './ScheduleSettings';
import { BackgroundSlot } from './BackgroundSlot';
import { SettingsSlots } from '../pages/settings/SettingsSlots';
import { saveSchedule } from './scheduleStore';
import { DEFAULT_SCHEDULE } from './schedule';
import { dispatchWatch, resetWatchForTests } from './watchStore';
import { resetFlagsForTests } from '../features/flags';
import { kv } from '../storage/kv';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';

const setFlags = (...on: string[]) => {
  kv.set('flags', 'last-known', { at: Date.now(), flags: Object.fromEntries(on.map((n) => [n, true])) });
  resetFlagsForTests();
};

beforeEach(() => {
  setStorageAdapter(createMemoryAdapter());
  resetFlagsForTests();
  resetWatchForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  resetStorage();
  resetFlagsForTests();
  resetWatchForTests();
});

describe('Settings > Schedule', () => {
  it('starts off: one switch, no hours, no days', () => {
    const html = renderToStaticMarkup(<ScheduleSettings />);
    expect(html).toContain('Schedule');
    expect(html).toContain('Remind me to start watching');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain('type="time"');
    expect(html).not.toContain('aria-pressed');
  });

  it('with the reminder on, shows the days (Monday first), the hours and a summary in words', () => {
    saveSchedule({ ...DEFAULT_SCHEDULE, enabled: true });
    const html = renderToStaticMarkup(<ScheduleSettings />);
    expect(html).toContain('aria-checked="true"');
    const labels = [...html.matchAll(/aria-label="(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)"/g)].map((m) => m[1]);
    expect(labels).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(html).toContain('value="09:00"');
    expect(html).toContain('value="17:00"');
    expect(html).toContain('Mon to Fri');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(5);
  });

  it('says what an overnight window does, and what happens with no days', () => {
    saveSchedule({ enabled: true, days: [5], startMinutes: 22 * 60, endMinutes: 6 * 60 });
    expect(renderToStaticMarkup(<ScheduleSettings />)).toContain('runs into the next morning');
    saveSchedule({ enabled: true, days: [], startMinutes: 540, endMinutes: 1020 });
    expect(renderToStaticMarkup(<ScheduleSettings />)).toContain('no reminder will show');
  });

  it('is honest about what a reminder needs, and makes no claim about treatment', () => {
    const html = renderToStaticMarkup(<ScheduleSettings />);
    expect(html).toContain('A closed browser tab');
    expect(html).toContain('6:00 AM');
    expect(html).not.toMatch(/treat|cure|clinical|therapy/i);
  });

  it('never asks for notification permission just by being shown', () => {
    const request = vi.fn();
    (globalThis as unknown as { Notification: unknown }).Notification = { permission: 'default', requestPermission: request };
    renderToStaticMarkup(<ScheduleSettings />);
    delete (globalThis as unknown as { Notification?: unknown }).Notification;
    expect(request).not.toHaveBeenCalled();
  });

  it('is what the Settings page shows for the schedule section, only with its flag on', () => {
    expect(renderToStaticMarkup(<SettingsSlots />)).toBe('');
    setFlags('background_watching');
    expect(renderToStaticMarkup(<SettingsSlots />)).toContain('Remind me to start watching');
  });
});

describe('the Watch tab pause card', () => {
  it('is nothing with the flag off', () => {
    expect(renderToStaticMarkup(<BackgroundSlot />)).toBe('');
  });

  it('offers the three pauses and the three meeting lengths when watching', () => {
    setFlags('background_watching');
    const html = renderToStaticMarkup(<BackgroundSlot />);
    for (const label of ['15 minutes', '1 hour', 'Until tomorrow', '30 minutes', '2 hours', 'Meeting mode']) expect(html).toContain(label);
    expect(html).not.toContain('Resume now');
  });

  it('while paused it says until when, and offers Resume instead of more pauses', () => {
    setFlags('background_watching');
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 15 });
    const html = renderToStaticMarkup(<BackgroundSlot />);
    expect(html).toContain('Paused until');
    expect(html).toContain('Resume now');
    expect(html).not.toContain('Until tomorrow');
    expect(html).not.toContain('Meeting mode:');
  });

  it('in meeting mode it says so, can end it, and still offers a pause', () => {
    setFlags('background_watching');
    dispatchWatch({ type: 'meeting', now: Date.now(), minutes: 60 });
    const html = renderToStaticMarkup(<BackgroundSlot />);
    expect(html).toContain('Meeting mode until');
    expect(html).toContain('End meeting mode');
    expect(html).toContain('15 minutes');
    expect(html).toContain('flashes');
  });

  it('with the flag off the stored state is not even read', () => {
    dispatchWatch({ type: 'pause', now: Date.now(), minutes: 15 }); // a pause left in storage by an earlier session
    resetWatchForTests();
    const get = vi.spyOn(kv, 'get');
    renderToStaticMarkup(<BackgroundSlot />);
    expect(get.mock.calls.some(([ns, key]) => ns === 'background' && key === 'state')).toBe(false);
  });
});
