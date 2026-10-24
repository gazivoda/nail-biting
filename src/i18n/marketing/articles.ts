// The server-rendered copy of each localized marketing page (WS12b): what a crawler without JavaScript, a reader with
// JavaScript off and the structured data say. Pure TypeScript, run at BUILD time by build.ts for every language.
//
// The rule (tasks/lessons.md, "a no-JS copy of a page must follow the page, not paraphrase it"): the article follows
// the visible page section by section, with the same words. It is built from the SAME messages the React page reads
// (src/i18n/scopes/marketing-*.ts), so the two cannot drift by construction; src/i18n/marketing/articles.test.ts also
// renders the React page in each language and checks that every sentence of the article is on the page, in order, and
// that every sentence of the page's main text is in the article.

import type { Translator } from './translate.ts';
import { escapeHtml } from './translate.ts';
import { pagePath, type SiteLocale } from './routes.ts';

/** What the server needs to serve one localized page. Strings may carry {{if flag}}..{{end}} markers and {{TOKENS}}. */
export interface PageFile {
  title: string;
  description: string;
  /** The page's own name in structured data (WebPage / AboutPage / FAQPage name). */
  name: string;
  schemaDescription: string;
  /** Inner HTML of <article id="ssr-page-content">. */
  article: string;
  /** The visible FAQ as plain text: the FAQPage JSON-LD is made from exactly these pairs. */
  faq: Array<{ q: string; a: string }>;
  faqName: string;
  /** Breadcrumb trail: [name, absolute URL]. */
  breadcrumb: Array<[string, string]>;
  /** Extra structured data this page carries besides the common ones (e.g. HowTo steps), as plain data. */
  howTo?: { name: string; description: string; totalTime: string; steps: Array<{ name: string; text: string }> };
  /** About page: the founder's description for the Person node. */
  personDescription?: string;
}

const li = (items: string[]): string => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
const e = escapeHtml;

const PLAN_KEYS = ['plan.f1', 'plan.f2', 'plan.f3', 'plan.f4'] as const;

// ── /pricing ─────────────────────────────────────────────────────────────────

export function buildPricing(tr: Translator, locale: SiteLocale): PageFile {
  const c = (key: string) => tr.text('marketing-chrome', key);
  const p = (key: string) => tr.text('marketing-pricing', key);
  const m = (key: string) => tr.text('marketing-meta', key);
  const refund = { link: (inner: string) => `<a href="/refund-policy">${inner}</a>` };

  const faq = [1, 2, 3, 4].map(n => ({ q: p(`faq.${n}.q`), a: p(`faq.${n}.a`) }));
  const faqHtml = [1, 2, 3, 4].map(n =>
    `<h3>${e(p(`faq.${n}.q`))}</h3><p>${n === 4 ? tr.html('marketing-pricing', 'faq.4.a', undefined, refund) : e(p(`faq.${n}.a`))}</p>`,
  ).join('');
  const features = PLAN_KEYS.map(k => e(c(k)));
  const payments = tr.html('marketing-chrome', 'pricing.payments', undefined, refund);
  const howLink = (inner: string) => `<a href="${pagePath(locale, 'how')}">${inner}</a>`;
  const ctaNote = tr.html('marketing-pricing', 'cta.note', undefined, {
    how: howLink,
    calc: inner => `<a href="/tools/nail-biting-cost-calculator">${inner}</a>`,
  });

  const article =
    `<h1>${e(c('pricing.heading'))}</h1>` +
    `<p class="article-summary">${e(c('pricing.lede'))}</p>` +
    // The two cards, in the order the page draws them: Yearly (the recommended one) first.
    `<section><p>${e(c('pricing.badge.save'))}</p>` +
    `<h2>${e(c('pricing.yearly'))}</h2>` +
    `<p>${e(String(tr.bag.pYearly))} ${e(c('pricing.perYear'))}</p>` +
    `<p>${e(c('pricing.yearly.eq'))}</p>` +
    li([...features, e(c('plan.extra'))]) + '</section>' +
    `<section><h2>${e(c('pricing.monthly'))}</h2>` +
    `<p>${e(String(tr.bag.pMonthly))} ${e(c('pricing.perMonth'))}</p>` +
    `<p>${e(c('pricing.monthly.billed'))}</p>` +
    // the page draws this line on a phone and the list on a desktop; the article has both, in the page's order
    `<p>${e(c('pricing.monthly.short'))}</p>` +
    li(features) + '</section>' +
    `<p>${payments}</p>` +
    `<section><h2>${e(p('includes.heading'))}</h2>` +
    li(['plan.f1', 'plan.f2', 'plan.f3', 'plan.f4', 'plan.privacy'].map(k => e(c(k)))) + '</section>' +
    `<section><h2>${e(p('faq.heading'))}</h2>${faqHtml}</section>` +
    `<section><h2>${e(p('cta.heading'))}</h2><p>${ctaNote}</p></section>`;

  return {
    title: m('pricing.title'),
    description: m('pricing.description'),
    name: m('pricing.name'),
    schemaDescription: m('pricing.schemaDescription'),
    article,
    faq,
    faqName: m('pricing.faqName'),
    breadcrumb: [
      [c('bc.home'), `https://stopbiting.today${pagePath(locale, 'home')}`],
      [p('bc.pricing'), `https://stopbiting.today${pagePath(locale, 'pricing')}`],
    ],
  };
}

// ── /about ───────────────────────────────────────────────────────────────────

export function buildAbout(tr: Translator, locale: SiteLocale): PageFile {
  const a = (key: string) => tr.text('marketing-about', key);
  const c = (key: string) => tr.text('marketing-chrome', key);
  const m = (key: string) => tr.text('marketing-meta', key);
  const html = (key: string, tags?: Parameters<Translator['html']>[3]) => tr.html('marketing-about', key, undefined, tags);
  const paragraphs = (scope: string, count: number) => Array.from({ length: count }, (_, i) => `<p>${html(`${scope}.p${i + 1}`)}</p>`).join('');

  const article =
    `<h1>${e(a('hero.title'))}</h1>` +
    `<p class="article-summary">${e(a('hero.lede'))}</p>` +
    `<section><h2>${e(a('story.heading'))}</h2>${paragraphs('story', 4)}</section>` +
    `<section><h2>${e(a('does.heading'))}</h2>${paragraphs('does', 3)}</section>` +
    `<section><h2>${e(a('privacy.heading'))}</h2>${paragraphs('privacy', 3)}</section>` +
    `<section><h2>${e(a('tech.heading'))}</h2>` +
    `<p>${html('tech.p1', { link: inner => `<a href="https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker">${inner}</a>` })}</p>` +
    `<p>${html('tech.p2')}</p></section>` +
    `<section><h2>${e(a('site.heading'))}</h2>` +
    `<p>${html('site.p1', { link: inner => `<a href="/editorial-policy">${inner}</a>` })}</p></section>` +
    `<section><h2>${e(c('bottom.heading'))}</h2><p>${e(c('bottom.note'))}</p></section>`;

  return {
    title: m('about.title'),
    description: m('about.description'),
    name: m('about.name'),
    schemaDescription: m('about.description'),
    article,
    faq: [],
    faqName: '',
    breadcrumb: [
      [c('bc.home'), `https://stopbiting.today${pagePath(locale, 'home')}`],
      [a('bc.about'), `https://stopbiting.today${pagePath(locale, 'about')}`],
    ],
    personDescription: m('about.personDescription'),
  };
}
