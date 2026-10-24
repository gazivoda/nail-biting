import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LOCALE_CODES, decorateEnglishHtml, hreflangLinkTags, hreflangSet, liveLocales, loadLocaleFiles, localeState, localeStates,
  localizeSoftwareApplication, localizedNoscriptNav, localizedNotFound, resolveLocaleFile, schemaNodes, servedLocales,
  withLocaleAlternates,
} from './localePages.js';

const flagsOf = (...on) => ({ isOn: name => on.includes(name) });

const file = (locale, extra = {}) => ({
  version: 1,
  locale,
  htmlLang: locale,
  ogLocale: { es: 'es_LA', de: 'de_DE', 'pt-BR': 'pt_BR' }[locale],
  hreflang: locale,
  prefix: locale.toLowerCase(),
  flag: { es: 'locale_es', de: 'locale_de', 'pt-BR': 'locale_pt_br' }[locale],
  reviewed: false,
  paths: { pricing: `/${locale.toLowerCase()}/pricing` },
  pages: {},
  lastmod: { pricing: '2026-10-24' },
  nav: [[`/${locale.toLowerCase()}/pricing`, 'Precios']],
  navLabel: 'Navegación',
  imageCaption: 'caption',
  app: { description: 'd', operatingSystem: 'os', inLanguage: locale, offers: [{ name: 'a', description: 'b' }], featureList: ['x'] },
  notFound: { title: 'T', h1: 'H', p: 'P', home: 'Home', blog: 'Blog' },
  ...extra,
});
const files = (over = {}) => ({ es: file('es'), de: file('de'), 'pt-BR': file('pt-BR'), ...over });

describe('the three states of a language', () => {
  it('flag off is off, whatever the review marker says', () => {
    expect(localeState(flagsOf(), file('es'))).toBe('off');
    expect(localeState(flagsOf(), file('es', { reviewed: true }))).toBe('off');
  });
  it('flag on and not reviewed is a draft', () => {
    expect(localeState(flagsOf('locale_es'), file('es'))).toBe('draft');
  });
  it('flag on and reviewed is live', () => {
    expect(localeState(flagsOf('locale_es'), file('es', { reviewed: true }))).toBe('live');
  });
  it('reviewed must be the boolean true (a string or a 1 is not a review)', () => {
    expect(localeState(flagsOf('locale_es'), file('es', { reviewed: 'true' }))).toBe('draft');
    expect(localeState(flagsOf('locale_es'), file('es', { reviewed: 1 }))).toBe('draft');
  });
  it('a language with no usable file is off even with its flag on', () => {
    expect(localeState(flagsOf('locale_es'), null)).toBe('off');
  });
  it('each language follows its own flag', () => {
    const f = files({ es: file('es', { reviewed: true }) });
    const states = localeStates(flagsOf('locale_es', 'locale_de'), f);
    expect(states).toEqual({ es: 'live', de: 'draft', 'pt-BR': 'off' });
    expect(servedLocales(states)).toEqual(['es', 'de']);
    expect(liveLocales(states)).toEqual(['es']);
  });
});

describe('loading the files', () => {
  it('reads a good file, and treats a missing, malformed or foreign one as off', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sb-loc-'));
    try {
      writeFileSync(join(dir, 'es.json'), JSON.stringify(file('es')));
      writeFileSync(join(dir, 'de.json'), '{not json');
      writeFileSync(join(dir, 'pt-BR.json'), JSON.stringify({ ...file('pt-BR'), version: 2 }));
      const warnings = [];
      const out = loadLocaleFiles(dir, { warn: (...a) => warnings.push(a.join(' ')) });
      expect(out.es.locale).toBe('es');
      expect(out.de).toBeNull();
      expect(out['pt-BR']).toBeNull();
      expect(warnings.length).toBe(2);
      expect(loadLocaleFiles(join(dir, 'nowhere')).es).toBeNull();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('hreflang', () => {
  it('is empty until a language is live', () => {
    const states = localeStates(flagsOf('locale_es'), files());
    expect(hreflangSet('pricing', states, files())).toEqual([]);
  });

  it('lists English, each live language that has the page, and x-default; drafts are not named', () => {
    const f = files({ es: file('es', { reviewed: true }) });
    const states = localeStates(flagsOf('locale_es', 'locale_de'), f);
    const set = hreflangSet('pricing', states, f);
    expect(set).toEqual([
      { hreflang: 'en', href: 'https://stopbiting.today/pricing' },
      { hreflang: 'es', href: 'https://stopbiting.today/es/pricing' },
      { hreflang: 'x-default', href: 'https://stopbiting.today/pricing' },
    ]);
    expect(hreflangLinkTags(set)).toContain('<link rel="alternate" hreflang="es" href="https://stopbiting.today/es/pricing">');
  });

  it('skips a page the language does not have', () => {
    const f = files({ es: file('es', { reviewed: true }) });
    const states = localeStates(flagsOf('locale_es'), f);
    expect(hreflangSet('about', states, f)).toEqual([]);
  });
});

describe('the English page', () => {
  const html = '<html><head><title>x</title></head><body></body></html>';

  it('is returned untouched while no language is served, and for any page that has no translation', () => {
    const f = files();
    expect(decorateEnglishHtml(html, '/pricing', { files: f, states: localeStates(flagsOf(), f) })).toBe(html);
    const on = localeStates(flagsOf('locale_es'), f);
    expect(decorateEnglishHtml(html, '/blog', { files: f, states: on })).toBe(html);
    expect(decorateEnglishHtml(html, '/about', { files: f, states: on })).toBe(html);   // not translated
  });

  it('gains the switcher marker for a draft and no hreflang', () => {
    const f = files();
    const out = decorateEnglishHtml(html, '/pricing', { files: f, states: localeStates(flagsOf('locale_es', 'locale_de'), f) });
    expect(out).toContain('<meta name="sb-locales" content="es de"></head>');
    expect(out).not.toContain('hreflang');
  });

  it('gains the marker and the hreflang links for a live language', () => {
    const f = files({ de: file('de', { reviewed: true }) });
    const out = decorateEnglishHtml(html, '/pricing', { files: f, states: localeStates(flagsOf('locale_de', 'locale_es'), f) });
    expect(out).toContain('content="es de"');
    expect(out).toContain('hreflang="de" href="https://stopbiting.today/de/pricing"');
    expect(out).toContain('hreflang="x-default" href="https://stopbiting.today/pricing"');
    expect(out).not.toContain('hreflang="es"');   // the Spanish page is still a draft
  });
});

describe('sitemap', () => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    '    <loc>https://stopbiting.today/</loc>',
    '    <lastmod>2026-10-01</lastmod>',
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '',
    '  <url>',
    '    <loc>https://stopbiting.today/pricing</loc>',
    '    <lastmod>2026-10-02</lastmod>',
    '    <changefreq>monthly</changefreq>',
    '    <priority>0.8</priority>',
    '  </url>',
    '',
    '</urlset>',
    '',
  ].join('\n');

  it('is untouched while nothing is live (drafts and off languages add nothing)', () => {
    const f = files();
    expect(withLocaleAlternates(xml, { files: f, states: localeStates(flagsOf('locale_es'), f) })).toBe(xml);
  });

  it('adds alternates to the English entry and an entry per live language', () => {
    const f = files({ es: file('es', { reviewed: true }), de: file('de', { reviewed: true }) });
    const out = withLocaleAlternates(xml, { files: f, states: localeStates(flagsOf('locale_es', 'locale_de', 'locale_pt_br'), f) });
    expect(out).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">');
    // English pricing carries the full set
    const english = out.match(/<url>\n    <loc>https:\/\/stopbiting.today\/pricing<\/loc>[\s\S]*?<\/url>/)[0];
    for (const h of ['en', 'es', 'de', 'x-default']) expect(english).toContain(`hreflang="${h}"`);
    expect(english).not.toContain('hreflang="pt-BR"');
    // each live language has its own entry with the same set and its date
    const es = out.match(/<url>\n    <loc>https:\/\/stopbiting.today\/es\/pricing<\/loc>[\s\S]*?<\/url>/)[0];
    expect(es).toContain('<lastmod>2026-10-24</lastmod>');
    expect(es).toContain('<priority>0.8</priority>');
    expect(es.match(/xhtml:link/g)).toHaveLength(english.match(/xhtml:link/g).length);
    expect(out).not.toContain('/pt-br/pricing');
    // the English home page has no translation yet: untouched
    expect(out.match(/<loc>https:\/\/stopbiting.today\/<\/loc>[\s\S]*?<\/url>/)[0]).not.toContain('xhtml');
    expect((out.match(/<loc>/g) ?? []).length).toBe(4);
  });

  it('lists a localized page without lastmod rather than inventing one', () => {
    const f = files({ es: file('es', { reviewed: true, lastmod: {} }) });
    const out = withLocaleAlternates(xml, { files: f, states: localeStates(flagsOf('locale_es'), f) });
    const es = out.match(/<url>\n    <loc>https:\/\/stopbiting.today\/es\/pricing<\/loc>[\s\S]*?<\/url>/)[0];
    expect(es).not.toContain('lastmod');
  });
});

describe('the localized 404', () => {
  const english = `<!doctype html>
<html lang="en">
<head><title>Page not found | Stop Biting</title></head>
<body><a class="brand" href="/"><img>Stop Biting</a>
<h1>This page doesn't exist.</h1>
<p>The link may be broken or the page may have moved. The app, the guides and everything else are where they were.</p>
<a class="btn btn-solid" href="/">Go to the homepage</a>
<a class="btn btn-line" href="/blog">Read the guides</a></body></html>`;

  it('swaps the words and the home link, and says the guides are English', () => {
    const out = localizedNotFound(english, file('es', { notFound: { title: 'No encontrada', h1: 'No existe', p: 'Aviso & más', home: 'Inicio', blog: 'Guías' } }));
    expect(out).toContain('<html lang="es">');
    expect(out).toContain('<title>No encontrada</title>');
    expect(out).toContain('<p>Aviso &amp; más</p>');
    expect(out).toContain('<a class="btn btn-solid" href="/es">Inicio</a>');
    expect(out).toContain('<a class="btn btn-line" href="/blog">Guías</a>');
    expect(out).not.toContain('This page');
  });

  it('gives up (null) when the English template changed, so the caller keeps the English page', () => {
    expect(localizedNotFound('<html lang="en"><h1>Oops</h1></html>', file('es'))).toBeNull();
  });
});

describe('structured data and navigation', () => {
  const shell = `<head>
<!-- Structured Data: SoftwareApplication — the node
     comment -->
<script type="application/ld+json">
{"@type":"SoftwareApplication","@id":"https://stopbiting.today/#app","name":"Stop Biting","description":"English","operatingSystem":"x","offers":[{"name":"Free trial","price":"0"},{"name":"Monthly","price":"2.99"},{"name":"Yearly","price":"29.00"}],"featureList":["a"]}
</script>
</head>`;

  it('re-emits SoftwareApplication in the language with the same id and prices', () => {
    const out = localizeSoftwareApplication(shell, file('es', { app: { description: 'Descripción', operatingSystem: 'Navegador', inLanguage: 'es', offers: [{ name: 'Prueba gratuita', description: 'd1' }, { name: 'Mensual', description: 'd2' }, { name: 'Anual', description: 'd3' }], featureList: ['uno'] } }));
    const json = JSON.parse(out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    expect(json['@id']).toBe('https://stopbiting.today/#app');
    expect(json.inLanguage).toBe('es');
    expect(json.description).toBe('Descripción');
    expect(json.offers.map(o => [o.name, o.price])).toEqual([['Prueba gratuita', '0'], ['Mensual', '2.99'], ['Anual', '29.00']]);
    expect(out).not.toContain('English');
  });

  it('leaves a shell without the block as it is', () => {
    expect(localizeSoftwareApplication('<head></head>', file('es'))).toBe('<head></head>');
  });

  it('writes the noscript navigation with this language first and the English-only pages marked English', () => {
    const html = localizedNoscriptNav('<body></body>', file('es'), [['/pricing', 'Pricing'], ['/blog', 'Blog'], ['/privacy', 'Privacy']]);
    expect(html).toContain('<nav aria-label="Navegación">');
    expect(html).toContain('<a href="/es/pricing">Precios</a>');
    expect(html).not.toContain('>Pricing<');    // the English version of a translated page is left out
    expect(html).toContain('<a href="/blog" lang="en">Blog</a>');
  });

  it('builds the pricing nodes in the language, and nothing the page does not show', () => {
    const k = {
      WEBSITE_ID: 'W', ORG_ID: 'O', APP_ID: 'A', PERSON_ID: 'P', SCHEMA_AUTHOR: { '@id': 'P' }, SCHEMA_SPEAKABLE: { s: 1 },
      breadcrumbSchema: trail => ({ '@type': 'BreadcrumbList', trail }),
      faqPageSchema: (canonical, name, faqs) => ({ '@type': 'FAQPage', '@id': `${canonical}#faq`, name, mainEntity: faqs }),
    };
    const content = { name: 'Precios', schemaDescription: 'desc', faqName: 'FAQ', faq: [{ q: 'q', a: 'a' }], breadcrumb: [['Inicio', 'u1'], ['Precios', 'u2']] };
    const nodes = schemaNodes('pricing', file('es'), content, 'https://stopbiting.today/es/pricing', k);
    expect(nodes.map(n => n['@type'])).toEqual(['WebPage', 'FAQPage', 'BreadcrumbList']);
    expect(nodes[0]).toMatchObject({ '@id': 'https://stopbiting.today/es/pricing', inLanguage: 'es', dateModified: '2026-10-24' });
    expect(nodes[1]).toMatchObject({ inLanguage: 'es', mainEntity: [{ q: 'q', a: 'a' }] });
  });

  it('resolves markers and tokens for this process, once', () => {
    const data = file('es', { pages: { pricing: { article: '{{if event_sync}}con{{else}}sin{{end}} {{SIGNIN_METHODS}}' } } });
    expect(resolveLocaleFile(data, { isOn: () => false, tokens: { SIGNIN_METHODS: 'Google' } }).pages.pricing.article).toBe('sin Google');
    expect(resolveLocaleFile(data, { isOn: n => n === 'event_sync', tokens: { SIGNIN_METHODS: 'Google o Apple' } }).pages.pricing.article).toBe('con Google o Apple');
  });

  it('knows the three language codes', () => {
    expect(LOCALE_CODES).toEqual(['es', 'de', 'pt-BR']);
  });
});
