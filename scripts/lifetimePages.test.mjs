// The Lifetime plan on the pages that quote Stop Biting's price, against the REAL server.js and the REAL build.
//
//   npm run build:web && npm test
//
// The compare pages, the solutions pages and two posts said "$2.99/month or $29/year" (and, in a few sentences, "a subscription")
// while the pricing section sells a third plan. shared/flagCopy.js now words them at serve time. This file boots `node server.js`:
//   1. flag off: every page says what it always said, and no sentence names a Lifetime plan of ours;
//   2. flag on with a Lifetime price id: the price lists end with the plan, the "subscription" sentences are true again, the
//      competitor figures are exactly those of the flag-off pages, the FAQPage data equals the visible answers, and the
//      product node's offer is the number the sentences say;
//   3. flag on, no price id: the card is not shown, so nothing changes;
//   4. LIFETIME_PRICE_USD changed: the sentences and the offer follow it.
// That the flag-off responses are byte for byte the base commit's is proved against the base commit (git archive rig), not here.
// Skipped (not failed) when dist/ has not been built.

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
  const dataDir = mkdtempSync(join(tmpdir(), 'sb-lifetime-pages-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      DATA_DIR: dataDir,
      GOOGLE_CLIENT_ID: 'x',
      GOOGLE_CLIENT_SECRET: 'x',
      JWT_SECRET: 'test-secret-test-secret-test-secret-0123',
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

const decode = s => s
  .replace(/&#x27;|&#39;/g, '\'').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&');
const textOf = html => decode(html.replace(/<\/(?:p|td|th|li|h\d|tr|section)>/g, '\n').replace(/<[^>]*>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
const articleOf = html => html.match(/<article id="ssr-page-content">([\s\S]*?)<\/article>/)?.[1] ?? '';
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const sentences = text => text.split(/\n|(?<=[.!?])\s+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const TWO_PRICES = /\$2\.99\/mo(?:nth)? or \$29\/y(?:ea)?r/;
const EM_OR_EN_DASH = /[–—]/g;
const flatten = s => s.replace(/\s+/g, ' ');

/** The 14 pages of the audit, the Pavlok comparison (the audit's filter missed it: its text holds "$99.99"), and the two posts. */
const COMPARE = [
  '/compare/stop-biting-vs-hands-off', '/compare/stop-biting-vs-nailed', '/compare/stop-biting-vs-smartbehavior',
  '/compare/stop-biting-vs-habitaware', '/compare/stop-biting-vs-nailkeeper', '/compare/stop-biting-vs-biteless',
  '/compare/stop-biting-vs-habitcam', '/compare/stop-biting-vs-nailbitemenu', '/compare/stop-biting-vs-pavlok', '/compare/ai-detection-apps',
];
const SOLUTIONS = ['/solutions/for-students', '/solutions/for-remote-workers', '/solutions/for-mac', '/solutions/for-windows'];
const POSTS = ['/blog/stop-biting-vs-mavala-stop', '/blog/best-apps-to-stop-nail-biting'];
const PAGES = [...COMPARE, ...SOLUTIONS, ...POSTS];

/** [page, the sentence (or piece of one) with the flag off, the same with the Lifetime plan for sale]; {{T}} stands for the trial's length (TRIAL_HYPHEN). */
const WORDING = [
  ['/compare/stop-biting-vs-hands-off', 'Stop Biting is $2.99/month or $29/year — about $2.42/month if you commit, roughly 19% cheaper than paying monthly.',
    'Stop Biting is $2.99/month, or $29/year (about $2.42/month if you commit, roughly 19% cheaper than paying monthly), or $99 once for the Lifetime plan.'],
  ['/compare/stop-biting-vs-hands-off', 'Stop Biting: $2.99/month or $29/year (about $2.42/month), with a {{T}} free trial',
    'Stop Biting: $2.99/month, $29/year (about $2.42/month) or $99 once, with a {{T}} free trial'],
  ['/compare/stop-biting-vs-nailed', 'choose Stop Biting, at $2.99/month or $29/year, if you need Windows', 'choose Stop Biting, at $2.99/month, $29/year or $99 once, if you need Windows'],
  ['/compare/stop-biting-vs-nailed', 'Stop Biting is a subscription that adds Windows', 'Stop Biting is a subscription, or a one-time Lifetime plan, that adds Windows'],
  ['/compare/stop-biting-vs-nailed', 'Stop Biting’s subscription buys you things you may not need — and on price Nailed wins outright',
    'Stop Biting’s paid plans buy you things you may not need — and on price Nailed wins outright'],
  ['/compare/stop-biting-vs-nailed', 'Stop Biting: $2.99/month, or $29/year (~$2.42/month).', 'Stop Biting: $2.99/month, $29/year (~$2.42/month) or $99 once for the Lifetime plan.'],
  ['/compare/stop-biting-vs-nailed', 'What the subscription pays for is the rest of the system', 'What a Stop Biting plan pays for is the rest of the system'],
  ['/compare/stop-biting-vs-nailed', 'Should I buy Nailed or subscribe to Stop Biting?', 'Should I buy Nailed or pay for Stop Biting?'],
  ['/compare/stop-biting-vs-smartbehavior', 'Choose Stop Biting, at $2.99/month or $29/year with a {{T}} free trial', 'Choose Stop Biting, at $2.99/month, $29/year or $99 once with a {{T}} free trial'],
  ['/compare/stop-biting-vs-habitaware', 'It is a subscription with a published price: $2.99/month or $29/year, about $2.42/month on the annual plan.',
    'It has published prices: $2.99/month, $29/year (about $2.42/month on the annual plan) or $99 once for the Lifetime plan.'],
  ['/compare/stop-biting-vs-nailkeeper', 'Stop Biting has a {{T}} free trial, then $2.99/month or $29/year.', 'Stop Biting has a {{T}} free trial, then $2.99/month, $29/year or $99 once.'],
  ['/compare/stop-biting-vs-biteless', 'Both sell a subscription.', 'Both sell a subscription, and Stop Biting also has a one-time Lifetime plan.'],
  ['/compare/stop-biting-vs-biteless', 'Stop Biting is $2.99/month or $29/year after a {{T}} free trial.', 'Stop Biting is $2.99/month, $29/year or $99 once after a {{T}} free trial.'],
  ['/compare/stop-biting-vs-habitcam', 'costs $2.99/month or $29/year after a {{T}} trial with no card', 'costs $2.99/month, $29/year or $99 once after a {{T}} trial with no card'],
  ['/compare/stop-biting-vs-habitcam', 'want one purchase instead of a subscription, or have more than one of those behaviours',
    'want to pay once for less than Stop Biting’s $99 Lifetime plan, or have more than one of those behaviours'],
  ['/compare/stop-biting-vs-habitcam', 'and it is a subscription.', 'and it is a subscription unless you choose the one-time Lifetime plan at $99.'],
  ['/compare/stop-biting-vs-habitcam', 'Stop Biting is $2.99/month or $29/year.', 'Stop Biting is $2.99/month, $29/year or $99 once.'],
  ['/compare/stop-biting-vs-nailbitemenu', 'Stop Biting is a paid subscription after the trial, requires an account', 'Stop Biting is a paid subscription or a one-time Lifetime plan after the trial, requires an account'],
  ['/compare/stop-biting-vs-pavlok', 'It costs far less to try: $2.99/month or $29/year, against the device prices on Pavlok’s home page.',
    'It costs far less to try: $2.99/month, or $29/year, against the device prices on Pavlok’s home page. Stop Biting also has a one-time Lifetime plan at $99.'],
  ['/compare/stop-biting-vs-pavlok', 'a {{T}} free trial with no card, then $2.99/month or $29/year. Pavlok’s home page shows $99.99',
    'a {{T}} free trial with no card, then $2.99/month, $29/year or $99 once. Pavlok’s home page shows $99.99'],
  ['/compare/ai-detection-apps', 'Stop Biting ($2.99/month or $29/year), Hands Off', 'Stop Biting ($2.99/month, $29/year or $99 once), Hands Off'],
  ['/compare/ai-detection-apps', 'Pricing is published: $2.99/month or $29/year (~$2.42/month), with a {{T}} free trial', 'Pricing is published: $2.99/month, $29/year (~$2.42/month) or $99 once, with a {{T}} free trial'],
  ['/solutions/for-students', 'with a {{T}} free trial and no card, then $2.99/month or $29/year.', 'with a {{T}} free trial and no card, then $2.99/month, $29/year or $99 once.'],
  ['/solutions/for-remote-workers', 'A {{T}} free trial with no credit card, then $2.99/month or $29/year.', 'A {{T}} free trial with no credit card, then $2.99/month, $29/year or $99 once.'],
  ['/solutions/for-mac', 'There is a {{T}} free trial with no credit card, then $2.99/month or $29/year.', 'There is a {{T}} free trial with no credit card, then $2.99/month, $29/year or $99 once.'],
  ['/solutions/for-windows', 'There is a {{T}} free trial with no credit card, then $2.99/month or $29/year.', 'There is a {{T}} free trial with no credit card, then $2.99/month, $29/year or $99 once.'],
  ['/blog/stop-biting-vs-mavala-stop', 'Price — Stop Biting: $2.99/month or $29/year with {{T}} free trial.', 'Price — Stop Biting: $2.99/month, $29/year or $99 once with {{T}} free trial.'],
  ['/blog/best-apps-to-stop-nail-biting', 'Stop Biting costs $2.99/month or $29/year after a free {{T}} trial', 'Stop Biting costs $2.99/month, $29/year or $99 once after a free {{T}} trial'],
].map(row => row.map(cell => cell.replaceAll('{{T}}', TRIAL_HYPHEN)));

/** The money in a text, Stop Biting's own figures set aside: what the page says about everybody else. */
const competitorMoney = text => (text.match(/[€$£]\d+(?:[.,]\d+)*/g) ?? []).filter(m => !['$2.99', '$29', '$2.42', '$99', '$149'].includes(m)).sort();

async function pagesOf(srv) {
  const out = {};
  for (const path of ['/pricing', '/', '/how-it-works', ...PAGES]) out[path] = (await get(srv, path)).text;
  return out;
}

describe.skipIf(!built)('pages that quote our price, flag off', () => {
  let srv; let off;
  beforeAll(async () => { srv = await startServer({}); off = await pagesOf(srv); }, 60000);
  afterAll(async () => { await srv?.stop(); });

  it.each(PAGES)('%s: two prices and no plan of ours called Lifetime, the product node has the three offers of today', path => {
    const html = off[path];
    const article = textOf(articleOf(html));
    expect(article.length, path).toBeGreaterThan(500);
    expect(flatten(article), path).toMatch(/\$2\.99\/mo(?:nth)? or \$29\/y(?:ea)?r/);
    expect(article, path).not.toMatch(/\$99 once|one-time Lifetime plan|Lifetime plan at|for the Lifetime plan/);
    const app = jsonLd(html).find(b => b['@type'] === 'SoftwareApplication');
    expect(app.offers.map(o => o.name), path).toEqual(['Free trial', 'Monthly', 'Yearly']);
  });

  it('the old sentences are all there, word for word', () => {
    for (const [path, before] of WORDING) expect(flatten(textOf(articleOf(off[path]))), `${path}: ${before}`).toContain(before);
  });

  it('the headlines of the pricing page and the homepage are the two-price ones, and no marker is written', () => {
    expect(articleOf(off['/pricing'])).toContain('<h1>$2.99 a month, or $29 a year.</h1>');
    expect(articleOf(off['/'])).toContain('<section><h2>$2.99 a month, or $29 a year.</h2>');
    for (const path of ['/pricing', '/', ...PAGES]) expect(off[path].includes('sb-copy-flags'), path).toBe(false);
  });

  it('seo-content.json, the posts and llms-full.txt are the generated files, byte for byte', async () => {
    expect((await get(srv, '/seo-content.json')).text === readFileSync(join(ROOT, 'dist/seo-content.json'), 'utf8')).toBe(true);
    expect((await get(srv, '/llms-full.txt')).text === readFileSync(join(ROOT, 'dist/llms-full.txt'), 'utf8')).toBe(true);
    expect((await get(srv, '/posts/stop-biting-vs-mavala-stop.json')).text === readFileSync(join(ROOT, 'dist/posts/stop-biting-vs-mavala-stop.json'), 'utf8')).toBe(true);
  });
});

describe.skipIf(!built)('pages that quote our price, flag on with the price id', () => {
  let srv; let off; let on;
  beforeAll(async () => {
    const plain = await startServer({});
    off = await pagesOf(plain);
    await plain.stop();
    srv = await startServer({ FEATURE_FLAGS: 'lifetime_plan', PADDLE_PRICE_ID_LIFETIME: 'pri_test_lifetime' });
    on = await pagesOf(srv);
  }, 90000);
  afterAll(async () => { await srv?.stop(); });

  it.each(PAGES)('%s: the price list ends with the Lifetime plan, in the sentences, the table and the FAQ', path => {
    const article = flatten(textOf(articleOf(on[path])));
    expect(article, path).not.toMatch(TWO_PRICES);
    expect(article, path).toContain('$99 once');
  });

  it('every sentence has its new wording, and the old one is gone from that page', () => {
    for (const [path, before, after] of WORDING) {
      const article = flatten(textOf(articleOf(on[path])));
      expect(article, `${path}: ${after}`).toContain(after);
      expect(article.includes(before), `${path}: ${before}`).toBe(false);
    }
  });

  it('what the pages say about everybody else is what it was: the same competitor prices, plans and conclusions', () => {
    for (const path of PAGES) {
      expect(competitorMoney(textOf(articleOf(on[path]))), path).toEqual(competitorMoney(textOf(articleOf(off[path]))));
    }
    const nailed = flatten(textOf(articleOf(on['/compare/stop-biting-vs-nailed'])));
    for (const kept of [
      'nailedapp.io advertises $4.99 one-time', 'Either way there is no subscription', 'Nailed asks for nothing recurring',
      'on price Nailed wins outright for Mac users on Apple Silicon', 'Choose Nailed if: you’re on an Apple Silicon Mac, you want nothing recurring',
    ]) expect(nailed, kept).toContain(kept);
    const habitcam = flatten(textOf(articleOf(on['/compare/stop-biting-vs-habitcam'])));
    for (const kept of [
      'Lifetime license: $19.99 launch special, regularly $39.99; one device; no subscription', 'Is HabitCam a subscription?',
      'It is cheaper over time.', 'Pick HabitCam if you are on Windows or Linux',
    ]) expect(habitcam, kept).toContain(kept);
    // the titles are not touched: the h1 of the Nailed and HabitCam pages is what the ledger froze
    expect(on['/compare/stop-biting-vs-nailed']).toContain('<title>');
    for (const path of COMPARE) expect(on[path].match(/<title>([^<]*)<\/title>/)[1], path).toBe(off[path].match(/<title>([^<]*)<\/title>/)[1]);
    for (const path of COMPARE) expect(on[path].match(/<meta name="description" content="([^"]*)"/)[1], path).toBe(off[path].match(/<meta name="description" content="([^"]*)"/)[1]);
  });

  it('no dash is added: a page has no more em or en dashes than it had', () => {
    for (const path of PAGES) {
      const count = html => (textOf(articleOf(html)).match(EM_OR_EN_DASH) ?? []).length;
      expect(count(on[path]), path).toBeLessThanOrEqual(count(off[path]));
    }
  });

  it('the FAQPage data equals the visible answers, question for question, and says the new words', () => {
    for (const path of PAGES) {
      const article = flatten(textOf(articleOf(on[path])));
      const faq = jsonLd(on[path]).find(b => b['@type'] === 'FAQPage');
      expect(faq, path).toBeTruthy();
      for (const q of faq.mainEntity) {
        expect(article, `${path}: ${q.name}`).toContain(flatten(textOf(q.name)));
        expect(article, `${path}: ${q.name}`).toContain(flatten(textOf(q.acceptedAnswer.text)));
      }
    }
    const faqOf = path => jsonLd(on[path]).find(b => b['@type'] === 'FAQPage').mainEntity.map(q => `${q.name} ${q.acceptedAnswer.text}`).join(' ');
    expect(faqOf('/solutions/for-students')).toContain('then $2.99/month, $29/year or $99 once.');
    expect(faqOf('/compare/stop-biting-vs-habitcam')).toContain('Stop Biting is $2.99/month, $29/year or $99 once.');
    for (const path of PAGES) expect(faqOf(path), path).not.toMatch(TWO_PRICES);
  });

  it('the product node lists the Lifetime offer, and the number is the one the sentences say', () => {
    for (const path of ['/pricing', '/', ...PAGES]) {
      const app = jsonLd(on[path]).find(b => b['@type'] === 'SoftwareApplication');
      expect(app.offers.map(o => [o.name, o.price]), path).toEqual([['Free trial', '0'], ['Monthly', '2.99'], ['Yearly', '29.00'], ['Lifetime', '99.00']]);
      const said = [...flatten(textOf(articleOf(on[path]))).matchAll(/\$(\d+) once/g)].map(m => m[1]);
      for (const n of said) expect(`${n}.00`, `${path} says $${n} once`).toBe(app.offers.at(-1).price);
    }
    // ...and with the flag off the node has no such offer and the pages say no such thing (the table above)
  });

  it('the pricing headline and the homepage section name the plan', () => {
    expect(articleOf(on['/pricing'])).toContain('<h1>$2.99 a month, $29 a year, or $99 once.</h1>');
    expect(articleOf(on['/'])).toContain('<section><h2>$2.99 a month, $29 a year, or $99 once.</h2>');
    expect(articleOf(on['/how-it-works'])).toContain('Pricing: $2.99/month, $29/year or $99 once, ');
  });

  it('the posts, seo-content.json and llms-full.txt carry the same words as the pages', async () => {
    const post = (await get(srv, '/posts/stop-biting-vs-mavala-stop.json')).text;
    expect(post).toContain('Price — Stop Biting: $2.99/month, $29/year or $99 once with');
    expect(post).not.toMatch(TWO_PRICES);
    const content = (await get(srv, '/seo-content.json')).text;
    expect(content).toContain('$99 once');
    expect(content).not.toMatch(TWO_PRICES);
    expect(content).not.toContain('$2.99/mo or $29/yr');
    const full = (await get(srv, '/llms-full.txt')).text;
    expect(full).not.toMatch(TWO_PRICES);
    expect(full).not.toContain('$2.99/mo or $29/yr');
    for (const [, , after] of WORDING.filter(([path]) => path !== '/blog/stop-biting-vs-mavala-stop')) {
      // llms-full.txt is the page's text with table rows as "a | b | c" lines; a sentence sits in it whole
      expect(full.replace(/\s+/g, ' '), after).toContain(after);
    }
    expect(full).toContain('Price | $2.99/month, $29/year or $99 once | €2.99/month (monthly plan only listed) |');
  });
});

describe.skipIf(!built)('pages that quote our price, flag on but no price id (no Lifetime card is shown either)', () => {
  let srv; let off; let on;
  beforeAll(async () => {
    const plain = await startServer({});
    off = await pagesOf(plain);
    await plain.stop();
    srv = await startServer({ FEATURE_FLAGS: 'lifetime_plan' });
    on = await pagesOf(srv);
  }, 90000);
  afterAll(async () => { await srv?.stop(); });

  it('every article says what it says with the flag off', () => {
    for (const path of ['/pricing', '/', '/how-it-works', ...PAGES]) {
      expect(articleOf(on[path]) === articleOf(off[path]), path).toBe(true);
      expect(on[path].includes('sb-copy-flags'), path).toBe(false);
    }
  });
});

describe.skipIf(!built)('pages that quote our price, the price follows LIFETIME_PRICE_USD', () => {
  let srv; let on;
  beforeAll(async () => {
    srv = await startServer({ FEATURE_FLAGS: 'lifetime_plan', PADDLE_PRICE_ID_LIFETIME: 'pri_test_lifetime', LIFETIME_PRICE_USD: '149' });
    on = await pagesOf(srv);
  }, 60000);
  afterAll(async () => { await srv?.stop(); });

  it('says $149 once wherever it said $99 once, and the offer says 149.00', () => {
    for (const path of ['/pricing', '/', ...PAGES]) {
      const article = flatten(textOf(articleOf(on[path])));
      expect(article, path).toContain('$149 once');
      expect(article, path).not.toContain('$99 once');
      expect(article, path).not.toMatch(/Lifetime plan at \$99/);
      const app = jsonLd(on[path]).find(b => b['@type'] === 'SoftwareApplication');
      expect(app.offers.at(-1).price, path).toBe('149.00');
    }
    expect(flatten(textOf(articleOf(on['/compare/stop-biting-vs-habitcam'])))).toContain('want to pay once for less than Stop Biting’s $149 Lifetime plan');
  });
});
