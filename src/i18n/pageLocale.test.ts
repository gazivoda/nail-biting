// The language of a marketing page comes from its address (WS12b), not from the pick and not from the flags.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getLocale, getPageLocale, installSiteCatalogForTests, isSiteLocaleLoaded, lookup, resetLocaleForTests, setAllowedLocales,
  setLocale, setPageLocale, installCatalogForTests,
} from './core';

const site = (text: string) => ({ reviewed: false, catalog: { 'marketing-chrome': { 'nav.how': text } } });

beforeEach(() => resetLocaleForTests());
afterEach(() => resetLocaleForTests());

describe('page locale', () => {
  it('is English until a page says otherwise, and sets nothing without a catalog', () => {
    expect(getLocale()).toBe('en');
    expect(getPageLocale()).toBeNull();
    expect(lookup('marketing-chrome', 'nav.how')).toBeUndefined();
  });

  it('switches to the language of the address once its marketing catalog is here', () => {
    installSiteCatalogForTests('es', site('Cómo empezar'));
    expect(isSiteLocaleLoaded('es')).toBe(true);
    setPageLocale('es');
    expect(getPageLocale()).toBe('es');
    expect(getLocale()).toBe('es');
    expect(lookup('marketing-chrome', 'nav.how')).toBe('Cómo empezar');
    setPageLocale(null);
    expect(getLocale()).toBe('en');
  });

  it('needs no flag: the server only serves the address while the flag is on', () => {
    installSiteCatalogForTests('de', site('So startest du'));
    setAllowedLocales([]);      // nothing allowed: no flag is on
    setPageLocale('de');
    expect(getLocale()).toBe('de');
  });

  it('wins over what the person picked, and is never stored', () => {
    installSiteCatalogForTests('pt-BR', site('Como começar'));
    installCatalogForTests('es', { reviewed: false, catalog: {} });
    setAllowedLocales(['es']);
    setLocale('es');
    expect(getLocale()).toBe('es');           // the pick, as the signed-in app uses it
    setPageLocale('pt-BR');
    expect(getLocale()).toBe('pt-BR');        // the address wins on this page
    setPageLocale(null);
    expect(getLocale()).toBe('es');           // and the pick is as it was
  });

  it('reads the app catalog and the marketing catalog together', () => {
    installSiteCatalogForTests('es', site('Cómo empezar'));
    installCatalogForTests('es', { reviewed: false, catalog: { watch: { title: 'Vigilar' } } });
    setPageLocale('es');
    expect(lookup('marketing-chrome', 'nav.how')).toBe('Cómo empezar');
    expect(lookup('watch', 'title')).toBe('Vigilar');
    expect(lookup('watch', 'nope')).toBeUndefined();
  });
});
