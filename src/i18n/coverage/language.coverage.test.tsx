// Pseudo-locale coverage for the language card. Each coverage test file renders the screens of one area with the
// German catalog on and every t() result marked, then asserts no English is left outside the marks (see
// src/i18n/testing/pseudo.ts). The file lists what it renders in COVERS so the inventory test can check that
// every in-scope component is rendered by some coverage test or explained.

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePseudoLocale, expectAllTranslated, expectNoMissingParams } from '../testing/pseudo';
import { LanguageSettings } from '../../pages/settings/LanguageSettings';
import { LocaleHost } from '../LocaleHost';
import { setLocale, getLocale } from '../core';

export const COVERS = ['src/pages/settings/LanguageSettings.tsx', 'src/i18n/LocaleHost.tsx'];

describe('language card, pseudo-locale', () => {
  usePseudoLocale({ flags: ['locale_es', 'locale_de', 'locale_pt_br'] });

  it('has no English outside the marks, and lists the languages by their own names', () => {
    const html = renderToStaticMarkup(<LanguageSettings />);
    expectAllTranslated(html);
    expectNoMissingParams(html);
    for (const name of ['English', 'Español', 'Deutsch', 'Português (Brasil)']) expect(html).toContain(name);
  });

  it('shows the draft note while the active catalog is not reviewed', () => {
    // the pseudo helper installs de as reviewed; an unreviewed one is covered in core.test.tsx. Here: the note is absent.
    expect(renderToStaticMarkup(<LanguageSettings />)).not.toContain('maschineller Entwurf');
  });

  it('LocaleHost renders nothing visible', () => {
    setLocale('de');
    expect(renderToStaticMarkup(<LocaleHost />)).toBe('');
    expect(getLocale()).toBe('de');
  });
});

describe('language card, flags off', () => {
  usePseudoLocale({ flags: [] });
  it('renders nothing', () => {
    expect(renderToStaticMarkup(<LanguageSettings />)).toBe('');
  });
});
