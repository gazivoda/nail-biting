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

/**
 * The two pricing cards and the payments line, as PricingSection draws them (the home page and /pricing both do). The
 * heading is an h1 on /pricing and an h2 on the home page, like the component.
 */
export function pricingSectionHtml(tr: Translator, heading: 'h1' | 'h2'): string {
  const c = (key: string) => tr.text('marketing-chrome', key);
  const refund = { link: (inner: string) => `<a href="/refund-policy">${inner}</a>` };
  const features = PLAN_KEYS.map(k => e(c(k)));
  return (
    `<${heading}>${e(c('pricing.heading'))}</${heading}>` +
    // (the standfirst the speakable spec points at is the page's own first paragraph: on /pricing this one)
    `<p${heading === 'h1' ? ' class="article-summary"' : ''}>${e(c('pricing.lede'))}</p>` +
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
    `<p>${tr.html('marketing-chrome', 'pricing.payments', undefined, refund)}</p>`
  );
}

export function buildPricing(tr: Translator, locale: SiteLocale): PageFile {
  const c = (key: string) => tr.text('marketing-chrome', key);
  const p = (key: string) => tr.text('marketing-pricing', key);
  const m = (key: string) => tr.text('marketing-meta', key);
  const refund = { link: (inner: string) => `<a href="/refund-policy">${inner}</a>` };

  const faq = [1, 2, 3, 4].map(n => ({ q: p(`faq.${n}.q`), a: p(`faq.${n}.a`) }));
  const faqHtml = [1, 2, 3, 4].map(n =>
    `<h3>${e(p(`faq.${n}.q`))}</h3><p>${n === 4 ? tr.html('marketing-pricing', 'faq.4.a', undefined, refund) : e(p(`faq.${n}.a`))}</p>`,
  ).join('');
  const howLink = (inner: string) => `<a href="${pagePath(locale, 'how')}">${inner}</a>`;
  const ctaNote = tr.html('marketing-pricing', 'cta.note', undefined, {
    how: howLink,
    calc: inner => `<a href="/tools/nail-biting-cost-calculator">${inner}</a>`,
  });

  const article =
    pricingSectionHtml(tr, 'h1') +
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

// ── the home page ────────────────────────────────────────────────────────────

/** What the home page's build needs besides the translator. */
export interface HomeContext {
  /** How many articles the blog has ("All 188 articles"): src/data/blogIndex.ts, the same file the page reads. */
  blogCount: number;
}

/** Where the featured guides go, in the page's order (Landing.tsx FEATURED_GUIDES and START_HERE). */
const GUIDES = [
  ['/how-it-works', 'guide.1'], ['/blog/habit-reversal-training-guide', 'guide.2'], ['/blog/how-to-stop-nail-biting', 'guide.3'],
  ['/blog/nail-biting-30-day-plan', 'guide.4'], ['/blog/nail-biting-trigger-mapping', 'guide.5'], ['/blog/best-apps-to-stop-nail-biting', 'guide.6'],
  ['/blog/best-nail-biting-remedies', 'guide.7'], ['/blog/nail-biting-health-risks', 'guide.8'], ['/blog/nail-biting-in-children', 'guide.9'],
  ['/compare/bitter-polish-alternative', 'guide.10'], ['/blog/how-ai-can-help-stop-nail-biting', 'guide.11'],
] as const;
const START_HERE = [
  ['/blog/habit-reversal-training-guide', 'start.1'], ['/blog/nail-biting-trigger-mapping', 'start.2'], ['/compare/bitter-polish-alternative', 'start.3'],
] as const;

export function buildHome(tr: Translator, locale: SiteLocale, ctx: HomeContext): PageFile {
  const h = (key: string, params?: Parameters<Translator['text']>[2]) => tr.text('marketing-home', key, params);
  const c = (key: string) => tr.text('marketing-chrome', key);
  const m = (key: string) => tr.text('marketing-meta', key);
  const html = (key: string, tags?: Parameters<Translator['html']>[3]) => tr.html('marketing-home', key, undefined, tags);
  const strong = { strong: (inner: string) => `<strong>${inner}</strong>` };
  const numbers = (count: number) => Array.from({ length: count }, (_, i) => i + 1);
  const aboutPath = pagePath(locale, 'about');

  // "Do I need a Google account?" has a second answer when another sign-in method is on: the server picks it at start-up
  // (it is built from the faq.10.alt.* pieces for every combination, see build.ts).
  const answerOf = (n: number) => (n === 10
    ? `{{if signin_any}}{{SIGNIN_ANSWER}}{{else}}${h('faq.10.a')}{{end}}`
    : h(`faq.${n}.a`));
  const answerHtmlOf = (n: number) => (n === 10
    ? `{{if signin_any}}{{SIGNIN_ANSWER_HTML}}{{else}}${html('faq.10.a')}{{end}}`
    : html(`faq.${n}.a`));
  const faq = numbers(11).map(n => ({ q: h(`faq.${n}.q`), a: answerOf(n) }));

  const startTitle = (href: string) => GUIDES.find(g => g[0] === href)?.[1] ?? '';
  const startHere = START_HERE.map(([href, key]) =>
    `<li><a href="${href}" lang="en">${e(h(startTitle(href)))}</a> ${e(h(key))}</li>`).join('');
  const moreGuides = GUIDES.filter(g => !START_HERE.some(s => s[0] === g[0]))
    .map(([href, key]) => `<li><a href="${href}" lang="en">${e(h(key))}</a></li>`).join('');

  const article =
    // hero
    `<h1>${e(h('hero.title'))}</h1>` +
    `<p class="article-summary">${e(h('hero.lede'))}</p>` +
    `<p>${e(c('offer.line'))}</p>` +
    `<p>${e(h('hero.note1'))}</p>` +
    `<p>${html('hero.note2')}</p>` +
    `<figure><img src="/shots/app-watch-1280.webp" srcset="/shots/app-watch-1280@1x.webp 1280w, /shots/app-watch-1280.webp 2560w" ` +
    `sizes="(min-width: 1024px) 36rem, 100vw" width="1280" height="792" alt="${e(h('hero.shot.alt'))}">` +
    `<figcaption>${e(h('hero.shot.caption'))}</figcaption></figure>` +
    // the live demo (its heading and paragraph render on page view)
    `<section><h2>${e(h('demo.heading'))}</h2><p>${e(h('demo.intro'))}</p><p>${e(h('demo.small'))}</p></section>` +
    // the loop
    `<section><h2>${e(h('loop.heading'))}</h2>${numbers(3).map(k => `<h3>${e(h(`loop.${k}.title`))}</h3><p>${e(h(`loop.${k}.body`))}</p>`).join('')}</section>` +
    // history
    `<section><h2>${e(h('history.heading'))}</h2><p>${e(h('history.body'))}</p>` +
    `<figure><img src="/shots/app-history-390.webp" width="390" height="844" alt="${e(h('history.alt'))}">` +
    `<figcaption>${e(h('history.caption'))}</figcaption></figure></section>` +
    // how to start
    `<section><h2>${e(h('how.heading'))}</h2><p>${html('how.lede')}</p><p>${e(h('how.small'))}</p>` +
    `<h3>${e(h('how.before'))}</h3><ul>${['how.b1', 'how.b2', 'how.b3', 'how.b4'].map(k => `<li>${e(h(k))}</li>`).join('')}<li>${html('how.b5')}</li></ul></section>` +
    // science
    `<section><h2>${e(h('science.heading'))}</h2><p>${e(h('science.p1'))}</p><p>${e(h('science.p2'))}</p>` +
    `<p>${html('science.p3', { link: inner => `<a href="https://www.bfrb.org/">${inner}</a>` })}</p>` +
    `<p><a href="/blog/habit-reversal-training-guide" lang="en">${e(h('science.guideLink'))}</a></p>` +
    `<p>${html('science.stat1', strong)}</p><p>${html('science.stat2', strong)}</p>` +
    `<ul><li><a href="https://pubmed.ncbi.nlm.nih.gov/7436976/">${e(h('science.ref1'))} ${e(h('science.pubmed'))}</a></li>` +
    `<li><a href="https://pubmed.ncbi.nlm.nih.gov/21549664/">${e(h('science.ref2'))} ${e(h('science.pubmed'))}</a></li></ul></section>` +
    // privacy
    `<section><h2>${e(h('privacy.heading'))}</h2><p>${html('privacy.p1')}</p>` +
    `<p><strong>${e(h('privacy.p2.lead'))}</strong> ${html('privacy.p2.rest')}</p></section>` +
    // why this exists
    `<section><h2>${e(h('maker.heading'))}</h2><p>${e(h('maker.p'))}</p><p>${e(h('maker.name'))}</p>` +
    `<p><a href="${aboutPath}">${e(h('maker.more'))}</a></p></section>` +
    // pricing
    `<section>${pricingSectionHtml(tr, 'h2')}</section>` +
    // the questions
    `<section><h2>${e(h('faq.heading'))}</h2>${numbers(11).map(n => `<h3>${e(h(`faq.${n}.q`))}</h3><p>${answerHtmlOf(n)}</p>`).join('')}</section>` +
    // guides
    `<section><h2>${e(h('guides.heading'))}</h2><p><a href="/blog" lang="en">${e(h('guides.all', { count: ctx.blogCount }))}</a></p>` +
    `<p>${e(h('guides.note'))}</p><ol>${startHere}</ol><ul>${moreGuides}</ul></section>` +
    // contact
    `<section><h2>${e(h('contact.heading'))}</h2><p>${e(h('contact.intro'))}</p></section>` +
    // the closing offer
    `<section><h2>${e(c('cta.heading'))}</h2><p>${e(c('cta.body'))}</p><p>${e(c('offer.line'))}</p></section>`;

  return {
    title: m('home.title'),
    description: m('home.description'),
    name: m('home.title'),
    schemaDescription: m('home.description'),
    article,
    faq,
    faqName: h('faq.heading'),
    breadcrumb: [[c('bc.home'), `https://stopbiting.today${pagePath(locale, 'home')}`]],
  };
}

// ── /how-it-works ────────────────────────────────────────────────────────────

export function buildHow(tr: Translator, locale: SiteLocale): PageFile {
  const h = (key: string) => tr.text('marketing-how', key);
  const c = (key: string) => tr.text('marketing-chrome', key);
  const m = (key: string) => tr.text('marketing-meta', key);
  const html = (key: string, tags?: Parameters<Translator['html']>[3]) => tr.html('marketing-how', key, undefined, tags);
  const numbers = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

  // The HowTo steps ARE the visible steps (title and body): the schema describes what the page shows.
  const steps = numbers(5).map(n => ({ name: h(`step.${n}.title`), text: h(`step.${n}.body`) }));
  const faq = numbers(5).map(n => ({ q: h(`faq.${n}.q`), a: h(`faq.${n}.a`) }));

  const article =
    `<h1>${e(h('hero.title'))}</h1>` +
    `<p class="article-summary">${e(h('hero.lede'))}</p>` +
    // The same real capture, alt text and caption as the React page.
    '<figure><img src="/shots/app-watch-1280.webp" srcset="/shots/app-watch-1280@1x.webp 1280w, /shots/app-watch-1280.webp 2560w" ' +
    `sizes="(min-width: 1024px) 48rem, 100vw" width="1280" height="792" loading="lazy" decoding="async" alt="${e(h('figure.alt'))}">` +
    `<figcaption>${e(h('figure.caption'))}</figcaption></figure>` +
    `<section><h2>${e(h('why.heading'))}</h2><p>${html('why.body', { link: inner => `<a href="/blog/habit-reversal-training-guide">${inner}</a>` })}</p></section>` +
    `<section><h2>${e(h('steps.heading'))}</h2><ol>${steps.map(s => `<li><p>${e(s.name)}</p><p>${e(s.text)}</p></li>`).join('')}</ol></section>` +
    `<section><h2>${e(h('specs.heading'))}</h2><dl>${numbers(4).map(n => `<dt>${e(h(`spec.${n}.label`))}</dt><dd>${html(`spec.${n}.value`)}</dd>`).join('')}</dl></section>` +
    `<section><h2>${e(h('faq.heading'))}</h2>${numbers(5).map(n => `<h3>${e(h(`faq.${n}.q`))}</h3><p>${html(`faq.${n}.a`)}</p>`).join('')}</section>` +
    `<section><h2>${e(h('learn.heading'))}</h2><p>${e(h('learn.note'))}</p><ul>${[
      ['/blog/habit-reversal-training-guide', 'link.1'], ['/blog/stop-biting-app-review', 'link.2'],
      ['/blog/webcam-privacy-nail-biting-app', 'link.3'], ['/compare/bitter-polish-alternative', 'link.4'],
    ].map(([href, key]) => `<li><a href="${href}" lang="en">${e(h(key))}</a></li>`).join('')}</ul></section>` +
    `<section><h2>${e(c('bottom.heading'))}</h2><p>${e(c('bottom.note'))}</p></section>`;

  return {
    title: m('how.title'),
    description: m('how.description'),
    name: m('how.name'),
    schemaDescription: m('how.description'),
    article,
    faq,
    faqName: m('how.name'),
    breadcrumb: [
      [c('bc.home'), `https://stopbiting.today${pagePath(locale, 'home')}`],
      [h('bc.how'), `https://stopbiting.today${pagePath(locale, 'how')}`],
    ],
    howTo: { name: m('how.howtoName'), description: m('how.howtoDescription'), totalTime: 'PT2M', steps },
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
