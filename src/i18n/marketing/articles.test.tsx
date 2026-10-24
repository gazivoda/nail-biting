// "A no-JS copy of a page must follow the page, not paraphrase it" (tasks/lessons.md), checked for every localized page in
// every language: the page is rendered by React in that language, the server-rendered article is built by build.ts, and
//   1. every sentence of the article is on the page, in the same order, and
//   2. every sentence of the page's main text (headings, paragraphs, list items, questions) is in the article,
// so a crawler that never runs JavaScript, a reader with JavaScript off and a visitor read the same words. The FAQPage
// pairs of the structured data are the visible questions and answers.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentType } from 'react';
import { buildLocaleFile } from './build';
import { LOCALIZED_PAGES, SITE_LOCALES, pagePath, type SiteLocale, type SitePage } from './routes';
import { catalog as esSite } from '../locales/es/site';
import { catalog as deSite } from '../locales/de/site';
import { catalog as ptSite } from '../locales/pt-BR/site';
import { catalog as esMeta } from '../locales/es/meta';
import { catalog as deMeta } from '../locales/de/meta';
import { catalog as ptMeta } from '../locales/pt-BR/meta';
import { installSiteCatalogForTests, resetLocaleForTests, setPageLocale } from '../core';
import { useMemoryStorage, resetStorage } from '../../../test-utils/memoryStorage';
import { resolveForProcess } from '../../../server/marketing/localePages.js';
import { setFlags } from '../testing/pseudo';

vi.mock('../../billing/prices', async importOriginal => ({
  ...(await importOriginal<typeof import('../../billing/prices')>()),
  useLocalizedPrices: () => ({}),
}));

import { PricingPage } from '../../pages/PricingPage';
import { About } from '../../pages/About';
import { HowItWorks } from '../../pages/HowItWorks';
import { Landing } from '../../pages/Landing';

const SITE = { es: esSite, de: deSite, 'pt-BR': ptSite } as const;
const META = { es: esMeta, de: deMeta, 'pt-BR': ptMeta } as const;
const PAGES: Partial<Record<SitePage, ComponentType>> = { pricing: PricingPage, about: About, how: HowItWorks, home: Landing };

const decode = (s: string) => s
  .replace(/&nbsp;/g, ' ').replace(/&#x27;|&#39;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/<!-- -->/g, '');
// Inline tags (a link, a highlighted word) vanish; every other tag is a break between words.
const norm = (s: string) => decode(s)
  .replace(/<span class="sg-(?:hl|mark)">([\s\S]*?)<\/span>/g, '$1')   // a highlighted word inside a heading
  .replace(/<\/?(?:a|strong|em|b|i|mark)\b[^>]*>/g, '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/[\u00a0\u202f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
/** The text of each heading, paragraph, list item and question, in order. */
const blocks = (html: string) => [...html.matchAll(/<(h1|h2|h3|p|li|summary|dt|dd|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(m => norm(m[2])).filter(Boolean);
const mainOf = (html: string) => html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? html;

function renderPage(locale: SiteLocale, page: SitePage): string {
  const Page = PAGES[page];
  if (!Page) throw new Error(`no component registered for ${page}`);
  resetLocaleForTests();
  installSiteCatalogForTests(locale, { reviewed: true, catalog: SITE[locale] as never });
  setPageLocale(locale);
  return renderToStaticMarkup(<Page />);
}

describe.each(SITE_LOCALES)('the server-rendered article follows the page: %s', locale => {
  beforeEach(() => useMemoryStorage());
  afterEach(() => { resetLocaleForTests(); resetStorage(); });

  const file = buildLocaleFile({ locale, site: SITE[locale], meta: META[locale], reviewed: false });
  // no optional feature on: the markers resolve to their plain wording
  const resolved = resolveForProcess(file, () => false);

  it.each(LOCALIZED_PAGES)('%s: every sentence of the article is on the page, in order', page => {
    const article = blocks(resolved.pages[page]!.article);
    expect(article.length).toBeGreaterThan(8);
    const pageText = norm(mainOf(renderPage(locale, page)));
    let from = 0;
    for (const block of article) {
      const at = pageText.indexOf(block, from);
      expect(at, `not on the page (or out of order): "${block.slice(0, 90)}"`).toBeGreaterThanOrEqual(0);
      from = at + block.length;
    }
  });

  it.each(LOCALIZED_PAGES)('%s: every sentence of the page is in the article', page => {
    const articleText = norm(resolved.pages[page]!.article);
    const visible = blocks(mainOf(renderPage(locale, page)));
    const missing = visible.filter(b => b.length >= 12 && !articleText.includes(b));
    // the breadcrumb is navigation, not copy
    expect(missing.filter(b => !/^(?:[^ ]+ \/ ?)+[^ ]+$/.test(b)), 'on the page but not in the article').toEqual([]);
  });

  it.each(LOCALIZED_PAGES)('%s: with the optional history sync on, the page and the article change together', page => {
    const off = norm(resolved.pages[page]!.article);
    const on = resolveForProcess(file, (name: string) => name === 'event_sync');
    const onBlocks = blocks(on.pages[page]!.article);
    if (norm(on.pages[page]!.article) === off) return;   // this page says nothing about where the history lives
    setFlags('event_sync');
    const pageText = norm(mainOf(renderPage(locale, page)));
    let from = 0;
    for (const block of onBlocks) {
      const at = pageText.indexOf(block, from);
      expect(at, `with sync on, not on the page (or out of order): "${block.slice(0, 90)}"`).toBeGreaterThanOrEqual(0);
      from = at + block.length;
    }
  });

  it.each(LOCALIZED_PAGES)('%s: the FAQPage pairs are the visible questions and answers', page => {
    const content = resolved.pages[page]!;
    if (content.faq.length === 0) return;   // a page without a visible FAQ has no FAQPage markup (About)
    const text = norm(mainOf(renderPage(locale, page)));
    expect(content.faq.length).toBeGreaterThan(0);
    for (const { q, a } of content.faq) {
      expect(text, `question: ${q}`).toContain(norm(q));
      expect(text, `answer: ${a.slice(0, 80)}`).toContain(norm(a));
    }
  });

  it.each(LOCALIZED_PAGES)('%s: carries the address, the freshness slot and a breadcrumb that ends on the page', page => {
    const content = resolved.pages[page]!;
    expect(resolved.paths[page]).toBe(pagePath(locale, page));
    expect(content.breadcrumb.at(-1)![1]).toBe(`https://stopbiting.today${pagePath(locale, page)}`);
    expect(content.breadcrumb[0][1]).toBe(`https://stopbiting.today${pagePath(locale, 'home')}`);
  });
});
