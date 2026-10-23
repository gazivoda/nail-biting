import { describe, it, expect } from 'vitest';
import { DARK_THEME_COLOR, LIGHT_THEME_COLOR, themeColorFor } from './themeColor';

describe('status-bar colour', () => {
  it('light is the colour index.html ships (the site-wide #F7F7F1 decision), dark is the app\'s dark ground', () => {
    expect(themeColorFor(false)).toBe('#F7F7F1');
    expect(themeColorFor(true)).toBe('#040e09');
    expect(LIGHT_THEME_COLOR).not.toBe(DARK_THEME_COLOR);
  });
});
