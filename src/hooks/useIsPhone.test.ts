import { describe, it, expect } from 'vitest';
import { isPhone, PHONE_QUERY } from './useIsPhone';

describe('isPhone', () => {
  it('is true when the phone query matches', () => {
    expect(isPhone(q => ({ matches: q === PHONE_QUERY }))).toBe(true);
  });
  it('is false for a desktop, even a narrow window', () => {
    expect(isPhone(() => ({ matches: false }))).toBe(false);
  });
  it('is false when matchMedia is missing or throws', () => {
    expect(isPhone(undefined)).toBe(false);
    expect(isPhone(() => { throw new Error('x'); })).toBe(false);
  });
});
