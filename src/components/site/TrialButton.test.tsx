// The hero's trial button on a phone. The phone button ("Send the link to my computer") is wider than the standard one, so
// when it replaced the standard one AFTER the first paint the "How it works" link beside it wrapped and the screenshot and
// notes below moved down 60 px: the 0.098 layout shift in the home page's mobile Lighthouse run. These tests read the markup
// of the first render only (renderToStaticMarkup never runs an effect), which is what the first paint shows.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PHONE_QUERY } from '../../hooks/useIsPhone';

vi.mock('../../auth/useSignInProviders', () => ({
  useSignInProviders: () => ({ providers: { apple: false, microsoft: false, magic_link: false }, ready: true }),
  useSignInHref: () => '/api/auth/google',
}));

import { TrialButton } from './TrialButton';

describe('TrialButton, first render', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('is already the phone button on a phone (coarse pointer, narrow screen), with no network involved', () => {
    vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: q === PHONE_QUERY }) });
    vi.stubGlobal('navigator', {});   // no share sheet: the mail label
    const html = renderToStaticMarkup(<TrialButton source="landing_hero" />);
    expect(html).toContain('href="mailto:');
    expect(html).toContain('Email me the link for my computer');
    expect(html).not.toContain('Start free trial');
  });

  it('is the standard button on a desktop, and for the small header button even on a phone', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(renderToStaticMarkup(<TrialButton />)).toContain('Start free trial');
    vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: q === PHONE_QUERY }) });
    expect(renderToStaticMarkup(<TrialButton size="sm" />)).toContain('Start free trial');
  });
});
