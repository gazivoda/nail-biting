import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useMemoryStorage, resetStorage } from '../../test-utils/memoryStorage';
import { kv } from '../storage/kv';
import {
  getLocale, getPreferredLocale, setLocale, setAllowedLocales, getAllowedLocales, installCatalogForTests, resetLocaleForTests,
  ensureLocaleLoaded, isLocaleReviewed, lookup, intlLocaleArg, intlTag, subscribeLocale, getLocaleVersion, setOutputTransformForTests,
  LOCALES, LOCALE_INFO, type LocaleModule,
} from './core';
import { createScope } from './scope';
import { useLocale } from './hooks';

const de: LocaleModule = {
  reviewed: false,
  catalog: { demo: { hello: 'Hallo {name}', days: '{n, plural, one {# Tag} other {# Tage}}' } },
};

const demo = createScope('demo', {
  hello: 'Hello {name}',
  days: '{n, plural, one {# day} other {# days}}',
  onlyEnglish: 'Only in English',
  note: 'Read the <link>privacy note</link>, <b>{name}</b>.',
});

describe('locale state', () => {
  beforeEach(() => {
    useMemoryStorage();
    resetLocaleForTests();
    vi.stubGlobal('document', { documentElement: { lang: 'en' } });
  });
  afterEach(() => {
    resetStorage();
    resetLocaleForTests();
    vi.unstubAllGlobals();
  });

  it('is English with nothing picked, and touches nothing', () => {
    expect(getLocale()).toBe('en');
    expect(getPreferredLocale()).toBe('en');
    expect(demo.t('hello', { name: 'Ana' })).toBe('Hello Ana');
    expect(intlLocaleArg()).toBeUndefined(); // Intl keeps using the browser's own formats
    expect((document.documentElement as { lang: string }).lang).toBe('en');
  });

  it('does not use a picked language until it is allowed', () => {
    installCatalogForTests('de', de);
    setLocale('de');
    expect(getPreferredLocale()).toBe('de');
    expect(kv.get('i18n', 'locale', '')).toBe('de'); // persisted through the storage module
    expect(getLocale()).toBe('en'); // flag not on (nobody called setAllowedLocales)
    expect(demo.t('hello', { name: 'Ana' })).toBe('Hello Ana');
    setAllowedLocales(['en', 'de']);
    expect(getLocale()).toBe('de');
    expect(intlTag()).toBe('de');
    expect(intlLocaleArg()).toBe('de');
    expect(demo.t('hello', { name: 'Ana' })).toBe('Hallo Ana');
    expect(demo.t('days', { n: 1 })).toBe('1 Tag');
    expect(demo.t('days', { n: 3 })).toBe('3 Tage');
    expect(lookup('demo', 'hello')).toBe('Hallo {name}');
    expect((document.documentElement as { lang: string }).lang).toBe('de');
  });

  it('stays English until the catalog has arrived, then switches (the real lazy chunk)', async () => {
    setLocale('de');
    setAllowedLocales(['en', 'de']);
    expect(getLocale()).toBe('en'); // the catalog is a dynamic import, not here yet
    expect((document.documentElement as { lang: string }).lang).toBe('en'); // and <html lang> waits for it
    await ensureLocaleLoaded('de');
    expect(getLocale()).toBe('de');
    expect((document.documentElement as { lang: string }).lang).toBe('de');
    expect(typeof isLocaleReviewed('de')).toBe('boolean');
  });

  it('falls back to English for a key the catalog lacks', () => {
    installCatalogForTests('de', de);
    setLocale('de');
    setAllowedLocales(['de']);
    expect(getLocale()).toBe('de');
    expect(demo.t('onlyEnglish')).toBe('Only in English');
  });

  it('goes back to English when the flag goes off, and restores <html lang>', () => {
    installCatalogForTests('de', de);
    setLocale('de');
    setAllowedLocales(['de']);
    expect(getLocale()).toBe('de');
    setAllowedLocales([]);
    expect(getLocale()).toBe('en');
    expect(getAllowedLocales()).toEqual(['en']);
    expect((document.documentElement as { lang: string }).lang).toBe('en');
    expect(getPreferredLocale()).toBe('de'); // the pick is kept for when the flag comes back
  });

  it('never reads the browser language', () => {
    vi.stubGlobal('navigator', { language: 'de-DE', languages: ['de-DE'] });
    setAllowedLocales(['de', 'es', 'pt-BR']);
    installCatalogForTests('de', de);
    expect(getLocale()).toBe('en');
    expect(getPreferredLocale()).toBe('en');
  });

  it('ignores a stored value that is not a locale', () => {
    kv.set('i18n', 'locale', 'klingon');
    resetLocaleForTests();
    expect(getPreferredLocale()).toBe('en');
    setLocale('xx' as never);
    expect(getPreferredLocale()).toBe('en');
  });

  it('tells subscribers and bumps the version', () => {
    const fn = vi.fn();
    const off = subscribeLocale(fn);
    const v = getLocaleVersion();
    installCatalogForTests('de', de);
    setLocale('de');
    setAllowedLocales(['de']);
    expect(fn).toHaveBeenCalled();
    expect(getLocaleVersion()).toBeGreaterThan(v);
    off();
  });

  it('reports whether a catalog was reviewed (English counts as its own source)', () => {
    expect(isLocaleReviewed('en')).toBe(true);
    expect(isLocaleReviewed('de')).toBe(false);
    installCatalogForTests('de', { ...de, reviewed: true });
    expect(isLocaleReviewed('de')).toBe(true);
  });

  it('applies the output transform to t() and to rich text but not to the keys', () => {
    setOutputTransformForTests(s => `[${s}]`);
    expect(demo.t('hello', { name: 'Ana' })).toBe('[Hello Ana]');
    const html = renderToStaticMarkup(<p>{demo.t.rich('note', { name: 'Ana' }, { link: c => <a href="/privacy">{c}</a>, b: c => <b>{c}</b> })}</p>);
    expect(html).toBe('<p>[Read the ]<a href="/privacy">[privacy note]</a>[, ]<b>[Ana]</b>[.]</p>');
  });

  it('lists the locales and a native name for each, with the flags the registry knows', () => {
    expect(LOCALES).toEqual(['en', 'es', 'de', 'pt-BR']);
    expect(LOCALE_INFO.en.flag).toBeNull();
    expect([LOCALE_INFO.es.flag, LOCALE_INFO.de.flag, LOCALE_INFO['pt-BR'].flag]).toEqual(['locale_es', 'locale_de', 'locale_pt_br']);
    expect(LOCALES.map(l => LOCALE_INFO[l].native)).toEqual(['English', 'Español', 'Deutsch', 'Português (Brasil)']);
  });
});

describe('React side', () => {
  beforeEach(() => { useMemoryStorage(); resetLocaleForTests(); });
  afterEach(() => { resetStorage(); resetLocaleForTests(); });

  function Hello() {
    const t = demo.useT();
    const { locale, preferred } = useLocale();
    return <p>{t('hello', { name: 'Ana' })} ({locale}/{preferred})</p>;
  }

  it('useT and useLocale render the active language', () => {
    expect(renderToStaticMarkup(<Hello />)).toBe('<p>Hello Ana (en/en)</p>');
    installCatalogForTests('de', de);
    setLocale('de');
    setAllowedLocales(['de']);
    expect(renderToStaticMarkup(<Hello />)).toBe('<p>Hallo Ana (de/de)</p>');
  });

  it('rich keeps inserted values out of tag parsing and works without handlers for a tag', () => {
    const html = renderToStaticMarkup(<p>{demo.t.rich('note', { name: '<i>x</i>' }, { link: c => <a href="/p">{c}</a> })}</p>);
    expect(html).toContain('<a href="/p">privacy note</a>');
    expect(html).toContain('&lt;i&gt;x&lt;/i&gt;'); // escaped text, not an element; the unhandled <b> tag renders its children
  });
});
