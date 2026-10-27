// The Lifetime plan in what crawlers and AI assistants read, against the REAL server.js and the REAL build.
//
//   npm run build:web && npm test
//
// Boots `node server.js` three times on free ports with a scratch DATA_DIR and throwaway credentials:
//   1. no flags: the pages say what they always said (the exact strings of today, and no mention of Lifetime);
//   2. FEATURE_FLAGS=lifetime_plan but no Lifetime price id: the page shows no Lifetime card then, so the copy
//      must say nothing either (the same promise as 1);
//   3. FEATURE_FLAGS=lifetime_plan with PADDLE_PRICE_ID_LIFETIME: title, description, the product node's offers,
//      the crawler article, the navigation and llms.txt / llms-full.txt all name the plan, with its price.
// Skipped (not failed) when dist/ has not been built, so a bare `npm test` on a fresh checkout stays green.
// The flag-off response being byte for byte the old one is proved against the base commit, not here: this file
// pins the strings (see the report that came with it).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { TRIAL_HYPHEN } from '../shared/plans.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const built = existsSync(join(ROOT, 'dist/index.html')) && existsSync(join(ROOT, 'dist/llms-full.txt'));

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.once('error', reject);
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => resolve(port));
  });
});

async function startServer(env) {
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), 'sb-lifetime-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      DATA_DIR: dataDir,
      GOOGLE_CLIENT_ID: 'x',
      GOOGLE_CLIENT_SECRET: 'x',
      JWT_SECRET: 'test-secret-test-secret-test-secret-0123',
      // Set (empty) so a developer's real .env cannot fill them in.
      FEATURE_FLAGS: '',
      PADDLE_PRICE_ID_LIFETIME: '',
      VITE_PADDLE_PRICE_ID_LIFETIME: '',
      LIFETIME_PRICE_USD: '',
      TRIAL_DAYS: process.env.TRIAL_DAYS ?? '',
      RESEND_API_KEY: '',
      PADDLE_API_KEY: '',
      PADDLE_WEBHOOK_SECRET: '',
      ELECTRON_PROTOCOL: '',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`server did not start:\n${log}`)), 20000);
    const poll = setInterval(() => {
      if (log.includes('Server running')) { clearTimeout(t); clearInterval(poll); resolve(); }
      if (child.exitCode !== null) { clearTimeout(t); clearInterval(poll); reject(new Error(`server exited:\n${log}`)); }
    }, 50);
  });
  return {
    url: `http://127.0.0.1:${port}`,
    log: () => log,
    async stop() {
      child.kill();
      await new Promise(r => child.once('exit', r));
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

const get = async (srv, path) => {
  const res = await fetch(srv.url + path, { redirect: 'manual' });
  return { status: res.status, headers: res.headers, text: await res.text() };
};

// vitest prints the whole received string when a string assertion fails, and these are 100 KB pages.
const big = (text, label = '') => ({
  toContain: needle => expect(text.includes(needle), `${label} should contain ${needle}`).toBe(true),
  notToContain: needle => expect(text.includes(needle), `${label} should not contain ${needle}`).toBe(false),
});
const titleOf = html => html.match(/<title>([^<]*)<\/title>/)?.[1];
const metaContent = (html, selector) => html.match(new RegExp(`<meta ${selector}[^>]*content="([^"]*)"`))?.[1];
const articleOf = html => html.match(/<article id="ssr-page-content">([\s\S]*?)<\/article>/)?.[1] ?? '';
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const EM_DASH = /[–—]/;
// What the Lifetime plan's copy looks like. (The word alone is no test: the HabitCam comparison has always said
// "Lifetime License" about HabitCam, and Pavlok and HabitAware prices contain "$99".)
const SAYS_OUR_LIFETIME_PLAN = /Lifetime plan|Lifetime: \$|once for Lifetime|\$99 once|\$99\.00|"Lifetime"/;

const decode = s => s
  .replace(/&#x27;|&#39;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&');
const textOf = html => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
/** [question, answer] of the page's FAQPage data, as text. */
const schemaFaq = html => jsonLd(html).find(b => b['@type'] === 'FAQPage').mainEntity.map(q => [textOf(q.name), textOf(q.acceptedAnswer.text)]);
/** [question, answer] of the crawler article's <h2>/<h3> + <p> pairs. */
const articleFaq = (html, heading) => [...articleOf(html).matchAll(new RegExp(`<section><${heading}>([\\s\\S]*?)</${heading}><p>([\\s\\S]*?)</p></section>`, 'g'))]
  .map(m => [textOf(m[1]), textOf(m[2])]);
/** The pricing questions and the two homepage answers that used to say two plans (the sentences of today, and the Lifetime wording). */
const FAQ = {
  pickPlan: {
    now: `Every account starts with a ${TRIAL_HYPHEN} free trial that includes full detection and tracking features, with no credit card required. When the trial ends, pick the monthly or yearly plan to keep going.`,
    lifetime: `Every account starts with a ${TRIAL_HYPHEN} free trial that includes full detection and tracking features, with no credit card required. When the trial ends, pick the monthly, yearly or Lifetime plan to keep going.`,
  },
  differenceQ: { now: 'What is the difference between Monthly and Yearly?', lifetime: 'What is the difference between Monthly, Yearly and Lifetime?' },
  difference: {
    now: 'Both plans include the same features: detection for as long as you run it, current and best streak, full history with trigger tags, and sound, flash, or both. Yearly is billed once at $29.00 (about $2.42/month, saving 19% versus $2.99/month billing) and adds priority support.',
    lifetime: 'Every plan includes the same features: detection for as long as you run it, current and best streak, full history with trigger tags, and sound, flash, or both. Yearly is billed once at $29.00 (about $2.42/month, saving 19% versus $2.99/month billing) and adds priority support. Lifetime is paid once instead of every month or year. It includes everything in the monthly plan, with no renewals, for as long as Stop Biting is offered.',
  },
  cancel: 'Yes. Cancel anytime from the app settings and you keep access until the end of the paid period. See the refund policy for details.',
  homeCost: {
    now: `It costs $2.99 a month or $29 a year after a ${TRIAL_HYPHEN} free trial with no card.`,
    lifetime: `It costs $2.99 a month, $29 a year or a one-time Lifetime payment after a ${TRIAL_HYPHEN} free trial with no card.`,
  },
  homeCancel: {
    now: 'After that it is $2.99 a month or $29 a year, and you can cancel anytime from the app settings and keep access until the end of the paid period.',
    lifetime: 'After that it is $2.99 a month, $29 a year or a one-time Lifetime payment. A monthly or yearly plan can be cancelled anytime from the app settings, and you keep access until the end of the paid period.',
  },
};
/** The questions and answers of the pricing page and of the homepage, as the FAQPage data and the crawler article tell them. */
async function faqsOf(srv) {
  const pricing = (await get(srv, '/pricing')).text;
  const home = (await get(srv, '/')).text;
  return {
    pricingSchema: schemaFaq(pricing), pricingArticle: articleFaq(pricing, 'h2'),
    homeSchema: schemaFaq(home), homeArticle: articleFaq(home, 'h3'),
  };
}
/** The answer to a question, or undefined. */
const answerTo = (pairs, question) => pairs.find(([q]) => q === question)?.[1];

const PRICING_Q1 = `How does the ${TRIAL_HYPHEN} free trial work?`;
const HOME_Q1 = 'What is Stop Biting and how does it work?';
const HOME_Q8 = 'Do I need a credit card, and can I cancel anytime?';

/** The questions and answers the pricing page and the homepage tell, in the data and in the article: the wording of `which`, and EQUAL. */
async function expectFaqs(srv, which) {
  const faq = await faqsOf(srv);
  const q2 = FAQ.differenceQ[which];
  for (const [name, pairs] of Object.entries(faq)) {
    const label = `${name} (${which})`;
    if (name.startsWith('pricing')) {
      expect(answerTo(pairs, PRICING_Q1), label).toBe(FAQ.pickPlan[which]);
      expect(answerTo(pairs, q2), label).toBe(FAQ.difference[which]);
      expect(answerTo(pairs, 'Can I cancel anytime?'), label).toBe(FAQ.cancel);   // not reworded: it is about subscriptions
      expect(pairs.some(([q]) => q === FAQ.differenceQ[which === 'now' ? 'lifetime' : 'now']), `${label}: the other wording is gone`).toBe(false);
    } else {
      expect(answerTo(pairs, HOME_Q1), label).toContain(FAQ.homeCost[which]);
      expect(answerTo(pairs, HOME_Q8), label).toContain(FAQ.homeCancel[which]);
    }
  }
  // what the data says is what the article says, question for question
  expect(faq.pricingArticle).toEqual(expect.arrayContaining(faq.pricingSchema));
  expect(faq.homeArticle).toEqual(expect.arrayContaining(faq.homeSchema));
  expect(faq.pricingSchema).toHaveLength(4);
}

const TITLE_NOW = 'Pricing: $2.99/month or $29/year | Stop Biting';
const DESCRIPTION_NOW = `Stop Biting pricing: ${TRIAL_HYPHEN} free trial, no card required. Then $2.99/month or $29/year (about $2.42/month, save 19%). Cancel anytime.`;
const PAGES = ['/pricing', '/', '/how-it-works', '/about', '/llms.txt', '/llms-full.txt'];

describe.skipIf(!built)('Lifetime plan copy, flag off', () => {
  let srv;
  beforeAll(async () => { srv = await startServer({}); }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it('the /pricing title and description are the ones of today, and the page says two plans only', async () => {
    const { status, text } = await get(srv, '/pricing');
    expect(status).toBe(200);
    expect(titleOf(text)).toBe(TITLE_NOW);
    expect(metaContent(text, 'name="description"')).toBe(DESCRIPTION_NOW);
    big(articleOf(text)).toContain('then $2.99/month or $29.00/year, which is just $2.42/month and saves 19% versus monthly billing.</p>');
  });

  it.each(PAGES)('%s does not mention the Lifetime plan', async path => {
    const { status, text } = await get(srv, path);
    expect(status).toBe(200);
    expect(SAYS_OUR_LIFETIME_PLAN.test(text), `${path} mentions the Lifetime plan`).toBe(false);
  });

  it('the cost calculator article still says "our two published prices"', async () => {
    big(articleOf((await get(srv, '/tools/nail-biting-cost-calculator')).text)).toContain('Only the numbers you type and our two published prices: $2.99 a month, or $29 a year.');
  });

  it('the pricing questions and the two homepage answers say what they said, in the FAQPage data and in the article, with no marker', async () => {
    await expectFaqs(srv, 'now');
    for (const path of PAGES.slice(0, 4)) expect((await get(srv, path)).text.includes('sb-copy-flags'), path).toBe(false);
  });

  it('the shell offers are the three of today', async () => {
    const app = jsonLd((await get(srv, '/pricing')).text).find(b => b['@type'] === 'SoftwareApplication');
    expect(app.offers.map(o => o.name)).toEqual(['Free trial', 'Monthly', 'Yearly']);
  });

  it('llms.txt is the generated file, byte for byte', async () => {
    expect((await get(srv, '/llms.txt')).text === readFileSync(join(ROOT, 'dist/llms.txt'), 'utf8')).toBe(true);
    expect((await get(srv, '/llms-full.txt')).text === readFileSync(join(ROOT, 'dist/llms-full.txt'), 'utf8')).toBe(true);
  });
});

describe.skipIf(!built)('Lifetime plan copy, flag on but no price id (the page shows no Lifetime card either)', () => {
  let srv;
  beforeAll(async () => { srv = await startServer({ FEATURE_FLAGS: 'lifetime_plan' }); }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it('says what it says with the flag off, and tells the owner why in the log', async () => {
    expect(titleOf((await get(srv, '/pricing')).text)).toBe(TITLE_NOW);
    for (const path of PAGES) expect(SAYS_OUR_LIFETIME_PLAN.test((await get(srv, path)).text), path).toBe(false);
    expect(srv.log()).toMatch(/lifetime_plan is on but no Lifetime price id/);
  });

  it('the questions and answers and the marker are those of the flag being off: the card, the FAQ and the schema agree', async () => {
    await expectFaqs(srv, 'now');
    for (const path of PAGES.slice(0, 4)) expect((await get(srv, path)).text.includes('sb-copy-flags'), path).toBe(false);
  });
});

describe.skipIf(!built)('Lifetime plan copy, flag on with the price id', () => {
  let srv;
  beforeAll(async () => { srv = await startServer({ FEATURE_FLAGS: 'lifetime_plan', PADDLE_PRICE_ID_LIFETIME: 'pri_test_lifetime' }); }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it('/pricing: a title inside the 60 character ceiling and a description inside 160, both naming the plan, no em dash', async () => {
    const { text } = await get(srv, '/pricing');
    const title = titleOf(text);
    const description = metaContent(text, 'name="description"');
    expect(title).toBe('Pricing: $2.99/month, $29/year or $99 once | Stop Biting');
    expect(title.length).toBeLessThanOrEqual(60);
    expect(description).toBe(`Stop Biting pricing: ${TRIAL_HYPHEN} free trial, no card required. Then $2.99/month, $29/year (about $2.42/month, save 19%) or $99 once for Lifetime.`);
    expect(description.length).toBeLessThanOrEqual(160);
    for (const t of [title, description]) expect(t).not.toMatch(EM_DASH);
    big(text).toContain(`<meta property="og:title" content="${title}"`);
    big(text).toContain(`<meta property="og:description" content="${description}"`);
  });

  it('/pricing: every JSON-LD block parses, ids are unique, the product node lists four offers and the page names the price', async () => {
    const { text } = await get(srv, '/pricing');
    const blocks = jsonLd(text);
    const ids = blocks.map(b => b['@id']).filter(Boolean);
    expect(new Set(ids).size, `duplicate @id in ${ids.join(' ')}`).toBe(ids.length);
    const apps = blocks.filter(b => b['@type'] === 'SoftwareApplication');
    expect(apps).toHaveLength(1);
    expect(apps[0].offers.map(o => [o.name, o.price, o.priceCurrency])).toEqual([
      ['Free trial', '0', 'USD'], ['Monthly', '2.99', 'USD'], ['Yearly', '29.00', 'USD'], ['Lifetime', '99.00', 'USD'],
    ]);
    const page = blocks.find(b => b['@type'] === 'WebPage');
    expect(page.description).toBe(`Pricing for Stop Biting: ${TRIAL_HYPHEN} free trial, then $2.99/month, $29/year or $99 once for Lifetime.`);
    expect(JSON.stringify(blocks)).not.toMatch(/AggregateOffer|AggregateRating|"Review"/);
  });

  it('/pricing: the crawler article names the plan in the card\'s own words, after Yearly, and keeps the rest', async () => {
    const article = articleOf((await get(srv, '/pricing')).text);
    big(article).toContain('saves 19% versus monthly billing, or $99.00 once for the Lifetime plan.</p>');
    const lifetime = '<section><h2>Lifetime: $99.00, paid once</h2><p>Pay once instead of every month or year. It includes everything in the monthly plan, with no renewals, for as long as Stop Biting is offered. Start the free trial, then choose Lifetime in the app.</p></section>';
    big(article).toContain(lifetime);
    expect(article.indexOf('<h2>Yearly')).toBeLessThan(article.indexOf('<h2>Lifetime'));
    expect(article.indexOf('<h2>Lifetime')).toBeLessThan(article.indexOf('<h2>What every plan includes'));
    big(article).toContain('<h1>$2.99 a month, or $29 a year.</h1>');   // the visible heading does not change
    expect(article).not.toMatch(/best deal|best value|save \$/i);
    expect(article.match(/<h2>Lifetime/g)).toHaveLength(1);
  });

  it('the pricing questions and the two homepage answers name the plan, and the FAQPage data equals the article', async () => {
    await expectFaqs(srv, 'lifetime');
    const faq = await faqsOf(srv);
    // no sentence left that counts two plans (the pricing section of the homepage article is the Lifetime copy's own)
    for (const [q, a] of faq.pricingSchema) expect(`${q} ${a}`, q).not.toMatch(/\bboth plans\b|monthly or yearly plan to keep/i);
    // the sentences about Lifetime are the card's words, with no price, no saving and no "best deal"
    expect(answerTo(faq.pricingSchema, FAQ.differenceQ.lifetime)).toContain('It includes everything in the monthly plan, with no renewals, for as long as Stop Biting is offered.');
    expect(JSON.stringify([faq.pricingSchema, faq.homeSchema])).not.toMatch(/best deal|cheapest|\$99/i);
  });

  it('the page learns it from the marker, in every page that is served and in no error page', async () => {
    for (const path of ['/', '/pricing', '/about', '/how-it-works', '/blog/habit-reversal-training-guide']) {
      big((await get(srv, path)).text, path).toContain('<meta name="sb-copy-flags" content="lifetime_plan">');
    }
    big((await get(srv, '/this-does-not-exist')).text).notToContain('sb-copy-flags');
  });

  it('every page carries the Lifetime offer in the one product node, and the noscript nav names the plan', async () => {
    for (const path of ['/', '/pricing', '/blog/habit-reversal-training-guide']) {
      const { text } = await get(srv, path);
      const apps = jsonLd(text).filter(b => b['@type'] === 'SoftwareApplication');
      expect(apps, path).toHaveLength(1);
      expect(apps[0].offers.map(o => o.name), path).toContain('Lifetime');
      big(text, path).toContain('<a href="/pricing">Pricing: free trial, $2.99/month, $29/year or $99 once</a>');
    }
  });

  it('the homepage and how-it-works articles follow', async () => {
    const home = articleOf((await get(srv, '/')).text);
    big(home).toContain('credit card; after that it is $2.99/month, $29.00/year, or $99.00 once for Lifetime.</p>');
    big(home).toContain('Lifetime: $99.00, paid once, with no renewals. Every plan includes unlimited AI detection');
    big(home).notToContain('Both plans include');
    big(articleOf((await get(srv, '/how-it-works')).text)).toContain(`Pricing: $2.99/month, $29/year or $99 once, ${TRIAL_HYPHEN} free trial</a>`);
  });

  it('the cost calculator article no longer says there are two published prices', async () => {
    const article = articleOf((await get(srv, '/tools/nail-biting-cost-calculator')).text);
    big(article).toContain('Only the numbers you type and our two subscription prices: $2.99 a month, or $29 a year.');
    big(article).notToContain('our two published prices');
  });

  it('llms.txt names the plan in the Pricing block and on the pricing entry; llms-full.txt gains a Pricing section', async () => {
    const llms = (await get(srv, '/llms.txt')).text;
    big(llms).toContain('\n- Yearly: $29.00/year');
    big(llms).toContain('\n- Lifetime: $99.00, paid once, with no renewals; includes everything in Monthly for as long as Stop Biting is offered\n');
    big(llms).toContain('- [Pricing: $2.99/month, $29/year or $99 once](https://stopbiting.today/pricing): ');
    big(llms).toContain('a monthly or yearly plan can be cancelled at any time; the Lifetime plan is one payment');
    expect(llms).not.toMatch(/Lifetime:[^\n]*[–—]/);
    const full = (await get(srv, '/llms-full.txt')).text;
    big(full).toContain('\n## Pricing\nURL: https://stopbiting.today/pricing\n');
    big(full).toContain('- Lifetime: $99.00, paid once');
    const base = readFileSync(join(ROOT, 'dist/llms-full.txt'), 'utf8');
    expect(full.startsWith(base), 'llms-full.txt only gains a section at the end').toBe(true);
  });

  it('the articles that never mention our plans are unchanged by the flag (only the navigation and the product node follow)', async () => {
    for (const path of ['/about', '/privacy', '/compare/stop-biting-vs-habitcam', '/blog/habit-reversal-training-guide']) {
      const { text } = await get(srv, path);
      expect(SAYS_OUR_LIFETIME_PLAN.test(articleOf(text)), path).toBe(false);
    }
  });
});

describe.skipIf(!built)('Lifetime plan copy, the price follows LIFETIME_PRICE_USD', () => {
  let srv;
  beforeAll(async () => {
    srv = await startServer({ FEATURE_FLAGS: 'lifetime_plan', PADDLE_PRICE_ID_LIFETIME: 'pri_test_lifetime', LIFETIME_PRICE_USD: '149' });
  }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it('says $149 everywhere and $99 nowhere', async () => {
    for (const path of ['/pricing', '/', '/llms.txt', '/llms-full.txt']) {
      const { text } = await get(srv, path);
      big(text, path).toContain('$149');
      expect(/\$99 once|\$99\.00/.test(text), `${path} still says $99`).toBe(false);
    }
    const app = jsonLd((await get(srv, '/pricing')).text).find(b => b['@type'] === 'SoftwareApplication');
    expect(app.offers.at(-1).price).toBe('149.00');
  });

  it('the questions and answers name no price of the plan: the one number lives in the card and the offer', async () => {
    const faq = await faqsOf(srv);
    expect(JSON.stringify([faq.pricingSchema, faq.homeSchema])).not.toMatch(/\$149|\$99/);
  });
});

describe.skipIf(!built)('Lifetime plan copy next to the other flags that change copy', () => {
  let srv;
  beforeAll(async () => {
    srv = await startServer({ FEATURE_FLAGS: 'event_sync,lifetime_plan,phone_companion', PADDLE_PRICE_ID_LIFETIME: 'pri_test_lifetime' });
  }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it('lists every copy flag that is on in one marker, and the FAQ answers follow all of them at once', async () => {
    big((await get(srv, '/pricing')).text).toContain('<meta name="sb-copy-flags" content="event_sync phone_companion lifetime_plan">');
    const faq = await faqsOf(srv);
    expect(answerTo(faq.pricingSchema, PRICING_Q1)).toBe(FAQ.pickPlan.lifetime);
    // the homepage's answers follow sync, the phone and the Lifetime plan, and the data equals the article
    expect(faq.homeArticle).toEqual(expect.arrayContaining(faq.homeSchema));
    expect(answerTo(faq.homeSchema, HOME_Q1)).toContain(FAQ.homeCost.lifetime);
    expect(answerTo(faq.homeSchema, HOME_Q1)).toContain('copied to your account only if you turn on sync');
  });
});

describe.skipIf(!built)('Lifetime plan copy, flag off and another copy flag on', () => {
  let srv;
  beforeAll(async () => { srv = await startServer({ FEATURE_FLAGS: 'event_sync' }); }, 30000);
  afterAll(async () => { await srv?.stop(); });

  it('the marker does not list the plan and the pricing FAQ says two plans', async () => {
    big((await get(srv, '/pricing')).text).toContain('<meta name="sb-copy-flags" content="event_sync">');
    const faq = await faqsOf(srv);
    expect(answerTo(faq.pricingSchema, PRICING_Q1)).toBe(FAQ.pickPlan.now);
    expect(answerTo(faq.homeSchema, HOME_Q8)).toContain(FAQ.homeCancel.now);
  });
});
