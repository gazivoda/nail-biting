import { describe, it, expect } from 'vitest';
import { toastMessage } from './toastText';
import { PRESET_TAGS } from '../components/dashboard/triggerTags';

const options = [...PRESET_TAGS, { id: 'commute', label: 'Commute', emoji: 'T' }];

describe('toastMessage', () => {
  it('says nothing when there is nothing to confirm', () => {
    expect(toastMessage(null, options)).toBe('');
  });
  it('a bite with no reason yet: it was logged and the streak restarts', () => {
    expect(toastMessage({ kind: 'bite', id: 'a', trigger: 'unknown' }, options)).toBe('Bite logged. Your streak starts again from now.');
  });
  it('a bite with a reason names it in the words of the picker', () => {
    expect(toastMessage({ kind: 'bite', id: 'a', trigger: 'stress' }, options)).toBe('Bite logged: Stress. Your streak starts again from now.');
    expect(toastMessage({ kind: 'bite', id: 'a', trigger: 'focus' }, options)).toBe('Bite logged: Deep focus. Your streak starts again from now.');
    expect(toastMessage({ kind: 'bite', id: 'a', trigger: 'commute' }, options)).toBe('Bite logged: Commute. Your streak starts again from now.');
  });
  it('an urge says the streak is not affected', () => {
    expect(toastMessage({ kind: 'urge', id: 'u' }, options)).toBe('Urge logged. Your streak is not affected.');
  });
  it('never uses an em or en dash (house style)', () => {
    for (const t of [{ kind: 'urge', id: 'u' }, { kind: 'bite', id: 'a', trigger: 'stress' }] as const) {
      expect(toastMessage(t, options)).not.toMatch(/[–—]/);
    }
  });
});
