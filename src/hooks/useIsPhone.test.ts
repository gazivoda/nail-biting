import { afterEach, describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { currentIsPhone, isPhone, PHONE_QUERY, useIsPhone } from './useIsPhone';

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

// The layout-shift regression (home page, mobile Lighthouse CLS 0.098): the hook used to start at false and flip in an
// effect, so the first paint on a phone showed the standard trial button and the next frame the longer phone one.
// renderToStaticMarkup runs the first render and never an effect, so it sees exactly what the first paint would.
describe('useIsPhone: the first render already knows', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const Probe = () => createElement('span', null, String(useIsPhone()));

  it('is true in the very first render on a phone', () => {
    vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: q === PHONE_QUERY }) });
    expect(currentIsPhone()).toBe(true);
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<span>true</span>');
  });
  it('is false in the first render on a desktop, a narrow window with a mouse included', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<span>false</span>');
  });
  it('is false with no window at all (server rendering, tests) and when matchMedia is missing', () => {
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<span>false</span>');
    vi.stubGlobal('window', {});
    expect(currentIsPhone()).toBe(false);
  });
});
