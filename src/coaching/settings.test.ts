import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_COACHING_SETTINGS, MAX_CUSTOM_RESPONSES, MAX_RESPONSE_LENGTH, PRESET_RESPONSES,
  addCustomResponse, cleanResponseText, getCoachingSettings, getLastPromptAt, removeCustomResponse,
  resetCoachingSettingsCache, sanitizeSettings, saveCoachingSettings, selectedResponseText, setLastPromptAt,
  subscribeCoachingSettings, updateCoachingSettings,
} from './settings';
import { useMemoryStorage, resetStorage } from '../../test-utils/memoryStorage';
import { kv } from '../storage/kv';

let n = 0;
const makeId = () => `c${++n}`;

describe('defaults', () => {
  it('the prompt is OFF by default, so nothing changes for anyone', () => {
    expect(DEFAULT_COACHING_SETTINGS.promptMode).toBe('off');
    expect(sanitizeSettings(undefined).promptMode).toBe('off');
    expect(sanitizeSettings({}).promptMode).toBe('off');
    expect(sanitizeSettings('junk').promptMode).toBe('off');
  });

  it('presets are plain text instructions, not drawings', () => {
    const texts = PRESET_RESPONSES.map(p => p.text);
    expect(texts).toContain('Clench your fists');
    expect(texts).toContain('Palms flat on the desk');
    for (const t of texts) expect(t).toMatch(/^[A-Za-z ,']+$/);
  });
});

describe('sanitizeSettings', () => {
  it('keeps good values and clamps the duration to 15..60', () => {
    expect(sanitizeSettings({ promptMode: 'hourly', durationSec: 45, selectedId: 'palms' }))
      .toMatchObject({ promptMode: 'hourly', durationSec: 45, selectedId: 'palms' });
    expect(sanitizeSettings({ durationSec: 3 }).durationSec).toBe(15);
    expect(sanitizeSettings({ durationSec: 999 }).durationSec).toBe(60);
    expect(sanitizeSettings({ durationSec: 'x' }).durationSec).toBe(30);
  });

  it('rejects an unknown mode and an unknown selection', () => {
    expect(sanitizeSettings({ promptMode: 'always' }).promptMode).toBe('off');
    expect(sanitizeSettings({ selectedId: 'nope' }).selectedId).toBe('fists');
  });

  it('drops malformed, duplicate and preset-colliding custom entries and caps the list', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, text: `thing ${i}` }));
    const s = sanitizeSettings({
      custom: [null, 7, { id: '', text: 'no id' }, { id: 'a', text: '   ' }, { id: 'fists', text: 'shadow preset' }, { id: 'ok', text: 'Squeeze a ball' }, { id: 'ok', text: 'dup id' }, ...many],
    });
    expect(s.custom[0]).toEqual({ id: 'ok', text: 'Squeeze a ball' });
    expect(s.custom.length).toBe(MAX_CUSTOM_RESPONSES);
    expect(s.custom.some(c => c.id === 'fists')).toBe(false);
  });

  it('a selection that points at a deleted custom response falls back to the first preset', () => {
    expect(sanitizeSettings({ selectedId: 'gone', custom: [] }).selectedId).toBe('fists');
  });
});

describe('cleanResponseText', () => {
  it('strips control characters, collapses space and bounds the length', () => {
    expect(cleanResponseText('  Hold \n a   pen\t')).toBe('Hold a pen');
    expect(cleanResponseText('a'.repeat(500)).length).toBe(MAX_RESPONSE_LENGTH);
    expect(cleanResponseText(42)).toBe('');
  });
});

describe('writing your own response', () => {
  it('adds, selects, and shows it', () => {
    const s = addCustomResponse(DEFAULT_COACHING_SETTINGS, 'Squeeze a stress ball', makeId);
    expect(s.custom).toHaveLength(1);
    expect(selectedResponseText(s)).toBe('Squeeze a stress ball');
  });

  it('ignores empty text and a full list; a repeat only selects the existing one', () => {
    expect(addCustomResponse(DEFAULT_COACHING_SETTINGS, '   ', makeId)).toBe(DEFAULT_COACHING_SETTINGS);
    const again = addCustomResponse(DEFAULT_COACHING_SETTINGS, 'clench your FISTS', makeId);
    expect(again.custom).toHaveLength(0);
    expect(again.selectedId).toBe('fists');
    let full = DEFAULT_COACHING_SETTINGS;
    for (let i = 0; i < MAX_CUSTOM_RESPONSES + 3; i++) full = addCustomResponse(full, `way ${i}`, makeId);
    expect(full.custom).toHaveLength(MAX_CUSTOM_RESPONSES);
  });

  it('removing the selected one falls back to the first preset', () => {
    const s = addCustomResponse(DEFAULT_COACHING_SETTINGS, 'Squeeze a stress ball', () => 'mine');
    const removed = removeCustomResponse(s, 'mine');
    expect(removed.custom).toHaveLength(0);
    expect(removed.selectedId).toBe('fists');
    expect(removeCustomResponse(s, 'unknown')).toBe(s);
  });
});

describe('the kv-backed store', () => {
  beforeEach(() => { useMemoryStorage(); resetCoachingSettingsCache(); });
  afterEach(() => { resetStorage(); resetCoachingSettingsCache(); });

  it('reads defaults from an empty store and returns a stable object', () => {
    const a = getCoachingSettings();
    expect(a).toEqual(DEFAULT_COACHING_SETTINGS);
    expect(getCoachingSettings()).toBe(a);
  });

  it('saves under kv hrt/settings, notifies subscribers, and survives a reload', () => {
    let notified = 0;
    const off = subscribeCoachingSettings(() => { notified++; });
    updateCoachingSettings({ promptMode: 'every', durationSec: 20 });
    expect(notified).toBeGreaterThan(0);
    expect(getCoachingSettings()).toMatchObject({ promptMode: 'every', durationSec: 20 });
    expect(kv.get('hrt', 'settings', null)).toMatchObject({ promptMode: 'every', durationSec: 20 });
    off();

    resetCoachingSettingsCache(); // a new page load
    expect(getCoachingSettings()).toMatchObject({ promptMode: 'every', durationSec: 20 });
  });

  it('survives corrupt stored data', () => {
    kv.set('hrt', 'settings', { promptMode: 42, durationSec: {}, custom: 'x' });
    resetCoachingSettingsCache();
    expect(getCoachingSettings()).toEqual(DEFAULT_COACHING_SETTINGS);
  });

  it('remembers when the last prompt was shown', () => {
    expect(getLastPromptAt()).toBeNull();
    setLastPromptAt(123456);
    expect(getLastPromptAt()).toBe(123456);
    kv.set('hrt', 'last-prompt-at', 'yesterday');
    expect(getLastPromptAt()).toBeNull();
  });

  it('keeps saving a valid object even if asked to save junk', () => {
    saveCoachingSettings({ promptMode: 'nope', durationSec: -5, selectedId: 'x', custom: [] } as never);
    expect(getCoachingSettings()).toEqual({ ...DEFAULT_COACHING_SETTINGS, durationSec: 15 }); // a number is clamped, the rest falls back
  });
});
