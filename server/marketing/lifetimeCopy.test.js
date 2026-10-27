// The Lifetime plan in what a crawler or an AI assistant reads (server/marketing/lifetimeCopy.js).
//
// Two promises are pinned here:
//   * with the plan not for sale every function hands back exactly what it was given (the SAME string or object),
//     so the served site is byte for byte what it was;
//   * with the plan for sale the words say what the visible card says, nothing the Terms and Refund pages do not
//     promise, and the price comes from ONE constant (shared/plans.js LIFETIME_PRICE_USD).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRIAL_HYPHEN, fillTrialTokens } from '../../shared/plans.js';
import { messages as plansScope } from '../../src/i18n/scopes/plans.ts';
import { ANCHORS, CARD_BODY, createLifetimeCopy } from './lifetimeCopy.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = file => readFileSync(join(ROOT, file), 'utf8');
// server.js writes 'it doesn\'t' in single-quoted literals and builds long paragraphs from `'...' +\n '...'` pieces; the served
// text has the apostrophe unescaped and the pieces joined.
const serverSource = read('server.js').replace(/\\'/g, '\'').replace(/(['`])\s*\+\s*\n\s*\1/g, '');

const OFF = createLifetimeCopy({ on: false });
const ON = createLifetimeCopy({ on: true, price: 99 });

const TITLE_NOW = 'Pricing: $2.99/month or $29/year | Stop Biting';
const DESCRIPTION_NOW = `Stop Biting pricing: ${TRIAL_HYPHEN} free trial, no card required. Then $2.99/month or $29/year (about $2.42/month, save 19%). Cancel anytime.`;
const NAV_NOW = 'Pricing: free trial, $2.99/month or $29/year';

const EM_DASH = /[–—]/;

describe('with the plan not for sale', () => {
  it('says so, and every function returns what it was given (same string, same object)', () => {
    expect(OFF.on).toBe(false);
    const meta = { title: TITLE_NOW, description: DESCRIPTION_NOW, canonical: 'https://stopbiting.today/pricing' };
    expect(OFF.meta(meta)).toBe(meta);
    for (const text of [TITLE_NOW, DESCRIPTION_NOW, NAV_NOW, read('public/llms.txt'), ANCHORS.pricingSummary]) {
      expect(OFF.pageDescription(text)).toBe(text);
      expect(OFF.navLabel(text)).toBe(text);
      expect(OFF.article(text)).toBe(text);
      expect(OFF.llmsTxt(text)).toBe(text);
      expect(OFF.llmsFull(text)).toBe(text);
      expect(OFF.shell(text)).toBe(text);
    }
  });
});

describe('with the plan for sale: title, description, navigation', () => {
  const meta = ON.meta({ title: TITLE_NOW, description: DESCRIPTION_NOW, canonical: 'https://stopbiting.today/pricing' });

  it('names the Lifetime plan and its one payment in the title, inside the 60 character ceiling', () => {
    expect(meta.title).toBe('Pricing: $2.99/month, $29/year or $99 once | Stop Biting');
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.canonical).toBe('https://stopbiting.today/pricing');
  });

  it('names it in the description, inside the 160 character ceiling, keeping the rest of the sentence', () => {
    expect(meta.description).toContain('Then $2.99/month, $29/year (about $2.42/month, save 19%) or $99 once for Lifetime.');
    expect(meta.description.startsWith(`Stop Biting pricing: ${TRIAL_HYPHEN} free trial, no card required. `)).toBe(true);
    expect(meta.description.length).toBeLessThanOrEqual(160);
  });

  it('keeps a four digit price inside the ceilings too', () => {
    const dear = createLifetimeCopy({ on: true, price: 1499 }).meta({ title: TITLE_NOW, description: DESCRIPTION_NOW });
    expect(dear.title.length).toBeLessThanOrEqual(60);
    expect(dear.description.length).toBeLessThanOrEqual(160);
    expect(dear.title).toContain('$1499');
  });

  it('uses no em dash or en dash anywhere in what it adds', () => {
    for (const text of [meta.title, meta.description, ON.pageDescription(`Pricing for Stop Biting: ${TRIAL_HYPHEN} free trial, then $2.99/month or $29/year.`), ON.navLabel(NAV_NOW)]) {
      expect(text).not.toMatch(EM_DASH);
    }
  });

  it('rewrites the structured description of the page and the navigation label', () => {
    expect(ON.pageDescription(`Pricing for Stop Biting: ${TRIAL_HYPHEN} free trial, then $2.99/month or $29/year.`))
      .toBe(`Pricing for Stop Biting: ${TRIAL_HYPHEN} free trial, then $2.99/month, $29/year or $99 once for Lifetime.`);
    expect(ON.navLabel(NAV_NOW)).toBe('Pricing: free trial, $2.99/month, $29/year or $99 once');
    expect(ON.navLabel('Privacy policy')).toBe('Privacy policy');
  });

  it('leaves a title or description it does not recognise alone (a reworded page is never half rewritten)', () => {
    const odd = { title: 'Something else | Stop Biting', description: 'Something else entirely.' };
    expect(ON.meta(odd)).toEqual(odd);
    expect(ON.pageDescription('Something else.')).toBe('Something else.');
  });
});

describe('with the plan for sale: the server-rendered article', () => {
  const pricingBefore = [
    '<h1>$2.99 a month, or $29 a year.</h1>',
    `<p class="article-summary">Simple, honest pricing: start with a ${TRIAL_HYPHEN} free trial, no credit card required, `,
    `${ANCHORS.pricingSummary}`,
    '<section><h2>Yearly: $29.00/year</h2>',
    `${ANCHORS.yearlySection}`,
    '<section><h2>What every plan includes</h2><ul><li>x</li></ul></section>',
  ].join('');

  it('adds the one-payment clause to the /pricing summary and a Lifetime section after Yearly, in the card\'s own words', () => {
    const out = ON.article(pricingBefore);
    expect(out).toContain('saves 19% versus monthly billing, or $99.00 once for the Lifetime plan.</p>');
    expect(out).toContain(`<section><h2>Lifetime: $99.00, paid once</h2><p>${CARD_BODY}</p></section><section><h2>What every plan includes</h2>`);
    expect(out.indexOf('Lifetime: $99.00')).toBeGreaterThan(out.indexOf('Yearly: $29.00'));
    expect(out.indexOf('Lifetime: $99.00')).toBeLessThan(out.indexOf('What every plan includes'));
  });

  it('uses the sentence the visible Lifetime card shows, and never calls it a best deal or quotes a saving', () => {
    expect(CARD_BODY).toBe(plansScope['lifetime.band.body']);
    const out = ON.article(pricingBefore);
    expect(out).not.toMatch(/best deal|best value for|save \$|cheaper than|per year equivalent/i);
    expect(out.match(/Lifetime/g)?.length).toBeGreaterThan(0);
  });

  it('adds the Lifetime sentence to the homepage copy and says "every plan" once there are three', () => {
    const home = `<p>The ${TRIAL_HYPHEN} free trial needs no ${ANCHORS.homeHero}<section>${ANCHORS.homePricing} Secure payment via Paddle.</section>`;
    const out = ON.article(home);
    expect(out).toContain('credit card; after that it is $2.99/month, $29.00/year, or $99.00 once for Lifetime.</p>');
    expect(out).toContain('saving 19%. Lifetime: $99.00, paid once, with no renewals. Every plan includes unlimited AI detection');
    expect(out).not.toContain('Both plans include');
  });

  it('updates the pricing link in the how-it-works article', () => {
    const out = ON.article(`<li><a href="/pricing">${ANCHORS.howLink}${TRIAL_HYPHEN} free trial</a></li>`);
    expect(out).toBe(`<li><a href="/pricing">Pricing: $2.99/month, $29/year or $99 once, ${TRIAL_HYPHEN} free trial</a></li>`);
  });

  it('changes nothing in an article that holds none of its anchors, and is idempotent', () => {
    const blog = '<h1>Why do people bite</h1><p>It costs $2.99/month or $29/year, and that is all.</p>';
    expect(ON.article(blog)).toBe(blog);
    const once = ON.article(pricingBefore);
    expect(ON.article(once)).toBe(once);
  });

  it('writes no em dash in anything it adds to an article', () => {
    const added = ON.article(pricingBefore).replace(pricingBefore, '');
    expect(`${CARD_BODY} ${added}`).not.toMatch(EM_DASH);
    const home = ON.article(`${ANCHORS.homeHero}${ANCHORS.homePricing}`);
    expect(home).not.toMatch(EM_DASH);
  });

  it('every anchor it replaces is in server.js exactly once, so a reworded sentence fails here and not silently', () => {
    for (const [name, anchor] of Object.entries(ANCHORS)) {
      if (typeof anchor !== 'string') continue;
      const count = serverSource.split(anchor).length - 1;
      expect(count, `${name}: ${anchor}`).toBe(1);
    }
  });
});

describe('with the plan for sale: the product node in the shell', () => {
  const shell = fillTrialTokens(read('index.html'));
  const blocks = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  const app = html => blocks(html).find(b => b['@type'] === 'SoftwareApplication');

  it('gains a Lifetime offer after Yearly, shaped like Monthly and Yearly, with the price from the constant', () => {
    const before = app(shell).offers;
    const out = ON.shell(shell);
    const offers = app(out).offers;
    expect(offers.map(o => o.name)).toEqual(['Free trial', 'Monthly', 'Yearly', 'Lifetime']);
    expect(offers.slice(0, 3)).toEqual(before);
    const lifetime = offers[3];
    expect(lifetime).toMatchObject({ '@type': 'Offer', price: '99.00', priceCurrency: 'USD', name: 'Lifetime' });
    expect(lifetime.priceSpecification).toEqual({ '@type': 'UnitPriceSpecification', price: '99.00', priceCurrency: 'USD' });
    expect(lifetime.description).not.toMatch(EM_DASH);
    expect(JSON.stringify(lifetime)).not.toMatch(/AggregateOffer|billingDuration|billingIncrement/);
  });

  it('touches nothing else: the other JSON-LD blocks and every id stay as they were', () => {
    const out = ON.shell(shell);
    const strip = html => blocks(html).filter(b => b['@type'] !== 'SoftwareApplication');
    expect(strip(out)).toEqual(strip(shell));
    const ids = blocks(out).map(b => b['@id']).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    const { offers: _o, ...rest } = app(out);
    const { offers: _b, ...restBefore } = app(shell);
    expect(rest).toEqual(restBefore);
  });

  it('is idempotent, and warns instead of guessing when the product node is not there', () => {
    const once = ON.shell(shell);
    expect(ON.shell(once)).toBe(once);
    const warnings = [];
    expect(ON.shell('<html><head></head></html>', { warn: m => warnings.push(m) })).toBe('<html><head></head></html>');
    expect(warnings.join(' ')).toMatch(/SoftwareApplication/);
  });
});

describe('with the plan for sale: llms.txt and llms-full.txt', () => {
  const llms = read('public/llms.txt');
  const out = ON.llmsTxt(llms);

  it('adds one Lifetime line to the Pricing block, right after Yearly, and keeps every other line', () => {
    const lines = out.split('\n');
    const yearly = lines.findIndex(l => l.startsWith('- Yearly: $29.00/year'));
    expect(lines[yearly + 1]).toBe('- Lifetime: $99.00, paid once, with no renewals; includes everything in Monthly for as long as Stop Biting is offered');
    expect(lines.filter(l => l.startsWith('- Lifetime:'))).toHaveLength(1);
  });

  it('says that only the subscriptions are cancelled, and rewrites the pricing entry of the key pages list', () => {
    expect(out).toContain('- Payment is taken through Paddle, and a monthly or yearly plan can be cancelled at any time; the Lifetime plan is one payment');
    expect(out).toContain(`- [Pricing: $2.99/month, $29/year or $99 once](https://stopbiting.today/pricing): Stop Biting pricing: ${TRIAL_HYPHEN} free trial, no card required. Then $2.99/month, $29/year (about $2.42/month, save 19%) or $99 once for Lifetime.`);
  });

  it('changes nothing else in the file, and is idempotent', () => {
    const before = llms.split('\n');
    const after = out.split('\n');
    const gone = before.filter(l => !after.includes(l));
    expect(gone).toEqual([
      '- Payment is taken through Paddle, and a plan can be cancelled at any time',
      before.find(l => l.startsWith('- [Pricing: $2.99/month or $29/year](https://stopbiting.today/pricing): ')),
    ]);
    expect(after.length - before.length).toBe(1);   // the Lifetime bullet is the only added line
    expect(ON.llmsTxt(out)).toBe(out);
    expect(after.find(l => l.startsWith('- Lifetime:'))).not.toMatch(EM_DASH);
  });

  it('llms-full.txt gains one Pricing section at the end that lists all three plans', () => {
    const full = '# Stop Biting\n\n## Some article\nURL: https://stopbiting.today/blog/x\n\ntext\n';
    const withPricing = ON.llmsFull(full);
    expect(withPricing.startsWith(full)).toBe(true);
    const block = withPricing.slice(full.length);
    expect(block).toContain('## Pricing');
    expect(block).toContain('URL: https://stopbiting.today/pricing');
    for (const line of ['- Monthly: $2.99/month', '- Yearly: $29.00/year', '- Lifetime: $99.00, paid once']) expect(block).toContain(line);
    expect(block).not.toMatch(EM_DASH);
    expect(ON.llmsFull(withPricing)).toBe(withPricing);
  });
});

describe('the price comes from one constant', () => {
  const dear = createLifetimeCopy({ on: true, price: 149 });
  const shell = fillTrialTokens(read('index.html'));

  it('every place that states it follows the constant: change it and 99 is gone', () => {
    const everything = [
      JSON.stringify(dear.meta({ title: TITLE_NOW, description: DESCRIPTION_NOW })),
      dear.pageDescription('then $2.99/month or $29/year.'),
      dear.navLabel(NAV_NOW),
      dear.article(`${ANCHORS.pricingSummary}${ANCHORS.yearlySection}${ANCHORS.homeHero}${ANCHORS.homePricing}${ANCHORS.howLink}`),
      dear.shell(shell),
      dear.llmsTxt(read('public/llms.txt')),
      dear.llmsFull('x\n'),
    ].join('\n');
    expect(everything).toContain('$149');
    expect(everything).toContain('149.00');
    expect(everything).not.toMatch(/\$99\b|\b99\.00\b/);
  });

  it('there is no price typed into the module or into server.js beside the constant', () => {
    // comments only: a trailing `// ...` would also eat the "https://" of a string
    const source = read('server/marketing/lifetimeCopy.js').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(source).not.toMatch(/(?<![\d.])99(?!\d)/);   // not the "99" of $2.99
    expect(read('server.js')).not.toMatch(/\$99\b|\b99\.00\b/);
  });
});
