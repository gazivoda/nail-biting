import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentType } from 'react';
import { SETTINGS_SECTIONS, visibleSections, sectionIsEnabled, type SettingsSectionId } from './meta';
import { SECTION_COMPONENTS } from './sectionComponents';
import { SettingsSlots } from './SettingsSlots';
import { FEATURE_NAMES } from '../../features/registry';
import { normalizeFlags, resetFlagsForTests } from '../../features/flags';
import { kv } from '../../storage/kv';
import { setStorageAdapter } from '../../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../../test-utils/memoryStorage';

const flagsWith = (...on: string[]) => normalizeFlags(Object.fromEntries(on.map(n => [n, true])));

describe('settings section registry', () => {
  it('lists the seven sections of the plan, in order', () => {
    expect(SETTINGS_SECTIONS.map(s => s.id)).toEqual([
      'detection', 'alerts', 'behaviors', 'schedule', 'account-sync', 'data', 'sharing',
    ]);
    expect(SETTINGS_SECTIONS.map(s => s.title)).toEqual([
      'Detection', 'Alerts', 'Behaviors', 'Schedule', 'Account & Sync', 'Data', 'Sharing',
    ]);
  });

  it('only gates on flags that exist, and has a component for every section', () => {
    for (const s of SETTINGS_SECTIONS) {
      for (const f of s.flags) expect(FEATURE_NAMES, `${s.id} -> ${f}`).toContain(f);
      expect(typeof SECTION_COMPONENTS[s.id], s.id).toBe('function');
    }
    expect(Object.keys(SECTION_COMPONENTS).sort()).toEqual(SETTINGS_SECTIONS.map(s => s.id).sort());
  });

  it('shows nothing with every flag off', () => {
    expect(visibleSections(flagsWith())).toEqual([]);
  });

  it('shows a section when any one of its flags is on, and keeps the order', () => {
    expect(visibleSections(flagsWith('detection_behaviors')).map(s => s.id)).toEqual(['behaviors']);
    expect(visibleSections(flagsWith('signin_apple')).map(s => s.id)).toEqual(['account-sync']);
    expect(visibleSections(flagsWith('event_sync')).map(s => s.id)).toEqual(['account-sync', 'data']);
    expect(visibleSections(flagsWith('share_links', 'hrt_coaching')).map(s => s.id)).toEqual(['alerts', 'sharing']);
  });

  it('a section with no flags would always be eligible', () => {
    const always = { id: 'data', title: 'x', owner: 'x', flags: [] } as const;
    expect(sectionIsEnabled(always, flagsWith())).toBe(true);
  });
});

describe('<SettingsSlots />', () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryAdapter());
    resetFlagsForTests();
  });
  afterEach(() => {
    resetStorage();
    resetFlagsForTests();
  });

  const setFlags = (...on: string[]) => {
    kv.set('flags', 'last-known', { at: Date.now(), flags: Object.fromEntries(on.map(n => [n, true])) });
    resetFlagsForTests();
  };

  it('renders nothing at all with every flag off', () => {
    expect(renderToStaticMarkup(<SettingsSlots />)).toBe('');
  });

  it('renders nothing even with the flags on while the section files are empty', () => {
    // Left out because their cards have content now: hrt_coaching (WS2, see coachingSettings.test.tsx),
    // detection_behaviors (WS1, see src/detection/useBehaviors.test.tsx) and false_positive_controls (WS3,
    // see src/falsePositive/settings.test.tsx).
    setFlags('event_sync', 'share_links', 'background_watching');
    expect(renderToStaticMarkup(<SettingsSlots />)).toBe('');
  });

  it('renders a section that has content, only when its flag is on', () => {
    const components = { ...SECTION_COMPONENTS, behaviors: (() => <p>behaviors card</p>) as ComponentType } as Record<SettingsSectionId, ComponentType>;
    expect(renderToStaticMarkup(<SettingsSlots components={components} />)).toBe('');

    setFlags('detection_behaviors');
    expect(renderToStaticMarkup(<SettingsSlots components={components} />)).toBe('<p>behaviors card</p>');

    setFlags('share_links'); // a different flag: behaviors stays hidden
    expect(renderToStaticMarkup(<SettingsSlots components={components} />)).toBe('');
  });
});
