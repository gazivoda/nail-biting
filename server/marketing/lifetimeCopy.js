// The Lifetime plan, in the words a crawler or an AI assistant reads (flag `lifetime_plan`).
//
// With the flag on and a Lifetime price id configured, the pricing section of the site shows THREE cards (Yearly,
// Monthly, Lifetime). Everything the server writes for readers that do not run the page (the title, the
// description, the crawler article, the product node's offers, the navigation, llms.txt and llms-full.txt) said
// two plans only. This module adds the third, and only then.
//
// How it stays out of the way:
//   * `createLifetimeCopy({ on: false })` returns functions that hand back exactly what they were given (the same
//     string, the same object). With the plan not for sale the served site is byte for byte what it was.
//   * The source sentences are NOT edited. A page's freshness date (scripts/sync-seo.mjs) is a fingerprint of the
//     literals in its handler, so a Lifetime sentence written there would move /pricing's and /'s `lastmod` with
//     the flag off. Here each sentence is found by its exact text (ANCHORS, which a test finds in server.js once
//     each) and rewritten at serve time. The same idea as shared/flagCopy.js RULES, except these rewrite markup too.
//   * The words are the ones the visible card and the Terms and Refund pages already use: "Pay once instead of
//     every month or year. It includes everything in the monthly plan, with no renewals, for as long as Stop Biting
//     is offered." No saving is quoted, it is never called the best deal, and nothing is promised beyond them.
//   * The price is `LIFETIME_PRICE_USD` (shared/plans.js), the one number, and it must equal the Paddle price.
//
// Who calls it (server.js): the shell once at start-up, `injectMeta`, `injectSsrArticle`, `injectNoscriptNav`
// and the /llms.txt and /llms-full.txt handlers. Pure functions, no I/O, so vitest tests them without a server.

import { LIFETIME_PRICE_USD, TRIAL_DAYS_TEXT } from '../../shared/plans.js';

const BRAND_SUFFIX = ' | Stop Biting';
const OFFER_NAME = 'Lifetime';

/**
 * What the Lifetime card says about the plan, word for word (src/i18n/scopes/plans.ts, `lifetime.band.body`; a test
 * compares them). The Terms say the same in other words: "a one-time payment ... the features of the monthly plan for
 * as long as Stop Biting is offered, without further payments".
 */
export const CARD_BODY = 'Pay once instead of every month or year. It includes everything in the monthly plan, with no renewals, for as long as Stop Biting is offered. Start the free trial, then choose Lifetime in the app.';

/**
 * The sentences of server.js this module rewrites, exactly as the source writes them (a test finds each one in
 * server.js exactly once, so rewording a sentence fails a test instead of silently dropping the Lifetime copy).
 */
export const ANCHORS = Object.freeze({
  /** /pricing <title> */
  title: 'Pricing: $2.99/month or $29/year | Stop Biting',
  /** the tail of the /pricing meta description (the start of it names the trial) */
  description: 'Then $2.99/month or $29/year (about $2.42/month, save 19%). Cancel anytime.',
  /** the WebPage description in the /pricing JSON-LD */
  pageDescription: 'then $2.99/month or $29/year.',
  /** the /pricing link of the noscript site navigation, on every page */
  nav: 'Pricing: free trial, $2.99/month or $29/year',
  /** the end of the /pricing standfirst */
  pricingSummary: 'then $2.99/month or $29.00/year, which is just $2.42/month and saves 19% versus monthly billing.</p>',
  /** the end of the Yearly section of the /pricing article: the Lifetime section goes right after it */
  yearlySection: 'Includes everything in Monthly plus priority support.</p></section>',
  /** the end of the homepage standfirst */
  homeHero: 'credit card; after that it is $2.99/month or $29.00/year.</p>',
  /** the homepage pricing section, which says "Both plans" */
  homePricing: 'saving 19%. Both plans include unlimited AI detection, streak and habit tracking, full incident history, and all alert types.',
  /** the pricing link in the how-it-works article ("Learn more") */
  howLink: 'Pricing — $2.99/month or $29/year, ',
  /** the cost calculator article says it uses "our two published prices": the two subscriptions, once there are three prices */
  calculator: 'our two published prices: ',
});

const identity = value => value;

/** What every function does while the plan is not for sale. Frozen: nothing can switch it on by accident. */
const OFF = Object.freeze({
  on: false,
  price: null,
  meta: identity,
  pageDescription: identity,
  navLabel: identity,
  article: identity,
  shell: identity,
  llmsTxt: identity,
  llmsFull: identity,
});

const replaceAll = (text, from, to) => (text.includes(from) ? text.split(from).join(to) : text);

/**
 * @param {{ on: boolean, price?: number }} options  `on`: the plan is for sale (copyIsOn('lifetime_plan'));
 *   `price`: whole US dollars, default LIFETIME_PRICE_USD
 */
export function createLifetimeCopy({ on, price = LIFETIME_PRICE_USD } = {}) {
  if (!on) return OFF;
  if (!Number.isInteger(price) || price < 1) throw new Error(`the Lifetime price must be a whole number of dollars, got ${price}`);

  const usd = `$${price}`;                  // "$99": titles and descriptions, like "$29/year" there
  const usdFull = `$${price.toFixed(2)}`;   // "$99.00": prose and the offer, like "$29.00/year" there

  const onTitle = `Pricing: $2.99/month, $29/year or ${usd} once${BRAND_SUFFIX}`;
  const onDescriptionTail = `Then $2.99/month, $29/year (about $2.42/month, save 19%) or ${usd} once for Lifetime.`;
  const onNav = `Pricing: free trial, $2.99/month, $29/year or ${usd} once`;
  const lifetimeBullet = `- Lifetime: ${usdFull}, paid once, with no renewals; includes everything in Monthly for as long as Stop Biting is offered`;

  /** { title, description, ...rest }: the Lifetime wording for /pricing, or the same object when it is not that page's text. */
  function meta(base) {
    const title = base.title === ANCHORS.title ? onTitle : base.title;
    const description = typeof base.description === 'string' && base.description.includes(ANCHORS.description)
      ? replaceAll(base.description, ANCHORS.description, onDescriptionTail)
      : base.description;
    return title === base.title && description === base.description ? base : { ...base, title, description };
  }

  const pageDescription = text => replaceAll(text, ANCHORS.pageDescription, `then $2.99/month, $29/year or ${usd} once for Lifetime.`);

  const navLabel = label => (label === ANCHORS.nav ? onNav : label);

  /** The crawler articles of /pricing, the homepage and how-it-works, after `copyHtml`. Idempotent. */
  function article(html) {
    let out = html;
    out = replaceAll(out, ANCHORS.pricingSummary,
      `then $2.99/month or $29.00/year, which is just $2.42/month and saves 19% versus monthly billing, or ${usdFull} once for the Lifetime plan.</p>`);
    if (!out.includes(`<h2>${OFFER_NAME}: `)) {
      out = replaceAll(out, ANCHORS.yearlySection,
        `${ANCHORS.yearlySection}<section><h2>${OFFER_NAME}: ${usdFull}, paid once</h2><p>${CARD_BODY}</p></section>`);
    }
    out = replaceAll(out, ANCHORS.homeHero,
      `credit card; after that it is $2.99/month, $29.00/year, or ${usdFull} once for Lifetime.</p>`);
    out = replaceAll(out, ANCHORS.homePricing,
      `saving 19%. ${OFFER_NAME}: ${usdFull}, paid once, with no renewals. Every plan includes unlimited AI detection, streak and habit tracking, full incident history, and all alert types.`);
    out = replaceAll(out, ANCHORS.howLink, `Pricing: $2.99/month, $29/year or ${usd} once, `);
    out = replaceAll(out, ANCHORS.calculator, 'our two subscription prices: ');
    return out;
  }

  /** The Lifetime offer, shaped like Monthly and Yearly in index.html (price and currency on the Offer and on its price specification). */
  const offer = () => ({
    '@type': 'Offer',
    price: price.toFixed(2),
    priceCurrency: 'USD',
    name: OFFER_NAME,
    description: 'Everything in Monthly with no renewals, for as long as Stop Biting is offered. One payment',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: price.toFixed(2),
      priceCurrency: 'USD',
    },
  });

  /**
   * The shell (dist/index.html) with a Lifetime offer added to the SoftwareApplication node, which every route
   * carries once (/pricing references it by @id). Called once, at start-up. If the node is not there it says so and
   * returns the shell as it is: a wrong guess in structured data is worse than a missing offer.
   */
  function shell(html, { warn = console.warn } = {}) {
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let node;
      try { node = JSON.parse(match[1]); } catch { continue; }
      if (node?.['@type'] !== 'SoftwareApplication' || !Array.isArray(node.offers)) continue;
      if (node.offers.some(o => o?.name === OFFER_NAME)) return html;
      const json = JSON.stringify({ ...node, offers: [...node.offers, offer()] }, null, 2).replace(/\n/g, '\n    ');
      const start = match.index + '<script type="application/ld+json">'.length;
      return `${html.slice(0, start)}\n    ${json}\n    ${html.slice(start + match[1].length)}`;
    }
    warn('[marketing] lifetime_plan: no SoftwareApplication node with offers in the shell (index.html): the Lifetime offer is not in the structured data.');
    return html;
  }

  /** llms.txt: a Lifetime bullet after Yearly, an honest payment line, and the pricing entry of the key pages list. */
  function llmsTxt(text) {
    if (text.includes('\n- Lifetime:')) return text;
    let out = text.replace(/^- Yearly: \$29\.00\/year.*$/m, line => `${line}\n${lifetimeBullet}`);
    out = replaceAll(out, '- Payment is taken through Paddle, and a plan can be cancelled at any time',
      '- Payment is taken through Paddle, and a monthly or yearly plan can be cancelled at any time; the Lifetime plan is one payment');
    out = out.replace(/^- \[([^\]\n]*)\]\((https:\/\/stopbiting\.today\/pricing)\): (.*)$/m, (line, title, url, description) => {
      const changed = meta({ title: `${title}${BRAND_SUFFIX}`, description });
      return changed.title === `${title}${BRAND_SUFFIX}` && changed.description === description
        ? line
        : `- [${changed.title.slice(0, -BRAND_SUFFIX.length)}](${url}): ${changed.description}`;
    });
    return out;
  }

  /** llms-full.txt has no pricing section at all while the plan is not for sale (the compare pages quote the two subscriptions). With it, one at the end. */
  function llmsFull(text) {
    if (text.includes('\n## Pricing\nURL: https://stopbiting.today/pricing\n')) return text;
    const block = [
      '## Pricing',
      'URL: https://stopbiting.today/pricing',
      '',
      '### Plans',
      '',
      `- Free trial: ${TRIAL_DAYS_TEXT}, no credit card required`,
      '- Monthly: $2.99/month',
      '- Yearly: $29.00/year, about $2.42/month, 19% less than paying monthly',
      lifetimeBullet,
      '',
      '### What every plan includes',
      '',
      'Detection for as long as you run it, current and best streak, full history with trigger tags, and sound, flash, or both. Yearly also includes priority support.',
      '',
      '### Payments',
      '',
      'Payments are handled by Paddle, a secure merchant of record. A monthly or yearly plan can be cancelled anytime from the app settings, and access lasts until the end of the paid period. The Lifetime plan is one payment. A full refund can be requested within 14 days of the first payment, or of the Lifetime payment: see https://stopbiting.today/refund-policy',
      '',
    ].join('\n');
    return `${text}${text.endsWith('\n') ? '' : '\n'}\n${block}`;
  }

  return Object.freeze({ on: true, price, meta, pageDescription, navLabel, article, shell, llmsTxt, llmsFull });
}
