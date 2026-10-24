import { describe, it, expect } from 'vitest';
import {
  ENGLISH_PATHS, HREFLANG, LOCALIZED_PAGES, OG_LOCALE, SITE_FLAG, SITE_LOCALES, SITE_PAGES, URL_PREFIX,
  alternatePath, hasLocalePrefix, hreflangSet, isLocalizedPage, localeOfPrefix, pagePath, pageUrl, parseSitePath,
} from './routes';
import { LOCALE_INFO } from '../core';

describe('the URL scheme', () => {
  it('English keeps its addresses', () => {
    expect(SITE_PAGES.map(p => pagePath('en', p))).toEqual(['/', '/how-it-works', '/pricing', '/about']);
    expect(pageUrl('en', 'home')).toBe('https://stopbiting.today/');
  });

  it('each language is a lower-case prefix with the English slug; the home page is the bare prefix', () => {
    expect(pagePath('es', 'home')).toBe('/es');
    expect(pagePath('es', 'pricing')).toBe('/es/pricing');
    expect(pagePath('de', 'how')).toBe('/de/how-it-works');
    expect(pagePath('pt-BR', 'about')).toBe('/pt-br/about');
    expect(pageUrl('pt-BR', 'home')).toBe('https://stopbiting.today/pt-br');
    // lower case, because the server's canonicalising redirect lower-cases every path (no /pt-BR/ to redirect)
    for (const l of SITE_LOCALES) for (const p of SITE_PAGES) expect(pagePath(l, p)).toBe(pagePath(l, p).toLowerCase());
  });

  it('a locale code is BCP 47, the prefix is its lower-case form', () => {
    expect(HREFLANG['pt-BR']).toBe('pt-BR');
    expect(URL_PREFIX['pt-BR']).toBe('pt-br');
    for (const l of SITE_LOCALES) {
      expect(URL_PREFIX[l]).toBe(HREFLANG[l].toLowerCase());
      expect(LOCALE_INFO[l].tag).toBe(HREFLANG[l]);
      expect(OG_LOCALE[l]).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
      expect(SITE_FLAG[l]).toBe(LOCALE_INFO[l].flag);
    }
  });

  it('parses an address back to its language and page, with or without a trailing slash', () => {
    for (const l of ['en', ...SITE_LOCALES] as const) {
      for (const page of SITE_PAGES) {
        if (l !== 'en' && !isLocalizedPage(page)) {
          expect(parseSitePath(pagePath(l, page)), `${l} ${page} has no version yet`).toBeNull();
          continue;
        }
        expect(parseSitePath(pagePath(l, page))).toEqual({ locale: l, page });
        if (pagePath(l, page) !== '/') expect(parseSitePath(`${pagePath(l, page)}/`)).toEqual({ locale: l, page });
      }
    }
    expect(parseSitePath('/blog')).toBeNull();
    expect(parseSitePath('/es/blog')).toBeNull();
    expect(parseSitePath('/fr')).toBeNull();
  });

  it('knows a language prefix when it sees one', () => {
    expect(hasLocalePrefix('/es')).toBe(true);
    expect(hasLocalePrefix('/es/anything')).toBe(true);
    expect(hasLocalePrefix('/pt-br/pricing')).toBe(true);
    expect(hasLocalePrefix('/essay')).toBe(false);
    expect(hasLocalePrefix('/deals')).toBe(false);
    expect(hasLocalePrefix('/blog/de-es')).toBe(false);
    expect(localeOfPrefix('/pt-br/about')).toBe('pt-BR');
    expect(localeOfPrefix('/de')).toBe('de');
    expect(localeOfPrefix('/pricing')).toBeNull();
  });

  it('gives the same page in another language, never the home page for a page with no equivalent', () => {
    for (const page of LOCALIZED_PAGES) {
      expect(alternatePath(ENGLISH_PATHS[page], 'es')).toBe(pagePath('es', page));
      expect(alternatePath(pagePath('de', page), 'en')).toBe(ENGLISH_PATHS[page]);
      expect(alternatePath(pagePath('de', page), 'pt-BR')).toBe(pagePath('pt-BR', page));
    }
    expect(alternatePath('/blog', 'es')).toBeNull();
    expect(alternatePath('/compare/stop-biting-vs-hands-off', 'de')).toBeNull();
    expect(alternatePath('/privacy', 'pt-BR')).toBeNull();
  });

  it('hreflang: English, every live language, x-default; nothing while none is live', () => {
    const page = LOCALIZED_PAGES[0];
    expect(hreflangSet(page, [])).toEqual([]);
    const set = hreflangSet(page, ['de', 'es']);
    expect(set.map(h => h.hreflang)).toEqual(['en', 'es', 'de', 'x-default']);
    expect(set[0].href).toBe(pageUrl('en', page));
    expect(set[set.length - 1].href).toBe(pageUrl('en', page));   // x-default is the English page
    expect(set.find(h => h.hreflang === 'de')?.href).toBe(pageUrl('de', page));
    // the set does not depend on which page of the set asks: every member gets the same list
    expect(hreflangSet(page, ['es', 'de'])).toEqual(set);
  });
});
