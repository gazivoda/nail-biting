import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoachingCard } from './CoachingCard';
import { CoachingSeam } from './CoachingSeam';
import { alarmCoaching } from './controller';
import { AlertOverlay } from '../components/detection/AlertOverlay';
import { CoachingSettings } from '../pages/settings/CoachingSettings';
import { AlertsSection } from '../pages/settings/sections/AlertsSection';
import { CoachingDashboardSlot } from './CoachingDashboardSlot';
import { ProgramHost } from './ProgramHost';
import { SettingsSlots } from '../pages/settings/SettingsSlots';
import { normalizeFlags, resetFlagsForTests } from '../features/flags';
import { kv } from '../storage/kv';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import { resetCoachingSettingsCache, saveCoachingSettings, DEFAULT_COACHING_SETTINGS } from './settings';

const card = (over: Partial<Parameters<typeof CoachingCard>[0]> = {}) =>
  renderToStaticMarkup(
    <CoachingCard variant="main" phase="running" text="Clench your fists" remainingSec={23} progress={0.2} onDone={() => {}} onSkip={() => {}} {...over} />,
  );

describe('the prompt card', () => {
  it('has Done and Skip buttons, the response in words, and the seconds', () => {
    const html = card();
    expect(html).toContain('Clench your fists');
    expect(html).toMatch(/<button[^>]*>Done<\/button>/);
    expect(html).toMatch(/<button[^>]*>Skip<\/button>/);
    expect(html).toContain('>23<');
  });

  it('is not modal: no dialog role, no aria-modal, no tabindex, no backdrop', () => {
    const html = card();
    expect(html).not.toMatch(/role="(alert)?dialog"|aria-modal|tabindex|autofocus/i);
    expect(html).not.toMatch(/fixed inset-0|backdrop/);
  });

  it('draws the ring as a decorative SVG that is hidden under reduced motion, with the number kept', () => {
    const html = card();
    expect(html).toMatch(/<svg[^>]*motion-reduce:hidden/);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-testid="coaching-ring"');
    expect(html).toContain('motion-reduce:border'); // the number gets a quiet outline instead
  });

  it('the Done confirmation keeps one button in place (focus is not lost) and drops Skip', () => {
    const html = card({ phase: 'finished' });
    expect(html).toContain('>Done<');
    expect(html).toMatch(/<button[^>]*>Close<\/button>/);
    expect(html).not.toMatch(/<button[^>]*>Skip<\/button>/);
  });

  it('the minimized-window strip is one row with both buttons and keeps ticking out of the live region', () => {
    const html = card({ variant: 'pip' });
    expect(html).toContain('data-testid="coaching-strip"');
    expect(html).toContain('aria-live="off"');
    expect(html).toMatch(/<button[^>]*>Done<\/button>/);
    expect(html).toMatch(/<button[^>]*>Skip<\/button>/);
  });

  it('draws nothing but a ring, words and buttons: no image, no figure, no emoji', () => {
    for (const variant of ['main', 'pip'] as const) {
      const html = card({ variant });
      expect(html).not.toMatch(/<img|<picture|<canvas|<video|<path /);
      expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe('the seam while nothing has armed it', () => {
  beforeEach(() => alarmCoaching.disarm());

  it('renders nothing on either surface', () => {
    expect(renderToStaticMarkup(<CoachingSeam surface="main" />)).toBe('');
    expect(renderToStaticMarkup(<CoachingSeam surface="pip" />)).toBe('');
  });

  it('leaves AlertOverlay exactly as it was: nothing when not visible, the same flash when visible', () => {
    expect(renderToStaticMarkup(<AlertOverlay visible={false} />)).toBe('');
    const flash = renderToStaticMarkup(<AlertOverlay visible />);
    expect(flash.startsWith('<div class="fixed inset-0 z-50 pointer-events-none">')).toBe(true);
    expect(flash).toContain('Hands down');
    expect(flash).toContain('Press your thumb to each fingertip.');
    expect(flash).not.toMatch(/coaching|Skip|Done/i);
  });
});

describe('Settings > Alerts', () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryAdapter());
    resetCoachingSettingsCache();
    resetFlagsForTests();
  });
  afterEach(() => {
    resetStorage();
    resetCoachingSettingsCache();
    resetFlagsForTests();
  });

  it('defaults to OFF, with the first preset selected and a 30 second timer', () => {
    const html = renderToStaticMarkup(<CoachingSettings />);
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>Off</);
    expect(html).toContain('No prompt. Alarms work exactly as before.');
    expect(html).toMatch(/value="30"/);
    expect(html).toMatch(/min="15"/);
    expect(html).toMatch(/max="60"/);
    expect(html).toMatch(/type="radio"[^>]*checked=""/);
  });

  it('offers the three timings and the neutral presets as text', () => {
    const html = renderToStaticMarkup(<CoachingSettings />);
    for (const t of ['Off', 'Once an hour', 'Every alarm', 'Clench your fists', 'Palms flat on the desk']) expect(html).toContain(t);
  });

  it('shows what was saved', () => {
    saveCoachingSettings({ ...DEFAULT_COACHING_SETTINGS, promptMode: 'every', durationSec: 45, custom: [{ id: 'mine-1', text: 'Squeeze a stress ball' }], selectedId: 'mine-1' });
    const html = renderToStaticMarkup(<CoachingSettings />);
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>Every alarm</);
    expect(html).toContain('Squeeze a stress ball');
    expect(html).toContain('value="45"');
  });

  it('is what the Alerts section renders, and only when hrt_coaching is on', () => {
    expect(renderToStaticMarkup(<AlertsSection />)).toContain('Competing-response prompt');
    // the page-level gate (WS0): flag off = no Alerts card at all
    expect(renderToStaticMarkup(<SettingsSlots />)).toBe('');
    kv.set('flags', 'last-known', { at: Date.now(), flags: normalizeFlags({ hrt_coaching: true }) });
    resetFlagsForTests();
    expect(renderToStaticMarkup(<SettingsSlots />)).toContain('Competing-response prompt');
    expect(renderToStaticMarkup(<SettingsSlots />)).toContain('Open the 4-week program');
  });

  it('with every flag off the Watch tab slot and the program host render nothing at all', () => {
    expect(renderToStaticMarkup(<CoachingDashboardSlot />)).toBe('');
    expect(renderToStaticMarkup(<ProgramHost />)).toBe('');
  });

  it('renders without calling fetch (the network guard is scripts/coachingGuards.test.mjs)', async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (() => { calls++; return Promise.reject(new Error('offline')); }) as typeof fetch;
    try {
      renderToStaticMarkup(<CoachingSettings />);
      renderToStaticMarkup(<CoachingSeam surface="main" />);
      expect(calls).toBe(0);
    } finally {
      globalThis.fetch = original;
    }
  });
});
