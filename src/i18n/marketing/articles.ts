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
    `<section><h2>${e(c('pricing.yearly'))}</h2>` +
    `<p>${e(c('pricing.badge.save'))}</p>` +
    `<p>${e(String(tr.bag.pYearly))} ${e(c('pricing.perYear'))}</p>` +
    `<p>${e(c('pricing.yearly.eq'))}</p>` +
    li([...features, e(c('plan.extra'))]) + '</section>' +
    `<section><h2>${e(c('pricing.monthly'))}</h2>` +
    `<p>${e(String(tr.bag.pMonthly))} ${e(c('pricing.perMonth'))}</p>` +
    `<p>${e(c('pricing.monthly.billed'))}</p>` +
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
      [p('bc.home'), `https://stopbiting.today${pagePath(locale, 'home')}`],
      [p('bc.pricing'), `https://stopbiting.today${pagePath(locale, 'pricing')}`],
    ],
  };
}
