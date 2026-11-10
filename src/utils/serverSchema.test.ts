import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TRIAL_DAYS, fillTrialTokens, trialCopy } from '../../shared/plans.js';
import type { PostState } from '../hooks/usePost';

// The blog header parity test below renders the real BlogPost page: usePost is fed the fixture post instead of fetching it.
const h = vi.hoisted(() => ({ state: { status: 'loading' } as PostState }));
vi.mock('../hooks/usePost', () => ({ usePost: () => h.state }));

import { BlogPost } from '../pages/BlogPost';

type Schema = Record<string, unknown>;

// Exercise the real HTTP responses with a small content artifact. The server,
// shell and dependencies are unchanged; no full site build or live accounts.
describe('server-rendered schema identities', () => {
  // The /blog hasPart window is 20 posts (BLOG_FEATURED_COUNT in server.js). The fixture holds more than that,
  // all older than 'schema-fixture', so the window has to leave the oldest ones out.
  const BLOG_WINDOW = 20;
  const FILLER_SLUGS = Array.from({ length: 24 }, (_, index) => `schema-filler-${String(index + 1).padStart(2, '0')}`);
  let fixture: string;
  let server: ChildProcess;
  let baseUrl: string;

  beforeAll(async () => {
    fixture = mkdtempSync(join(tmpdir(), 'stop-biting-schema-'));
    mkdirSync(join(fixture, 'dist'));
    for (const file of ['server.js', 'email.js', 'trialFollowup.js']) {
      copyFileSync(file, join(fixture, file));
    }
    // Mirror Vite's shell transform without running a full build.
    writeFileSync(join(fixture, 'dist/index.html'),
      fillTrialTokens(readFileSync('index.html', 'utf8'), trialCopy(DEFAULT_TRIAL_DAYS)));
    for (const directory of ['server', 'shared']) {
      symlinkSync(resolve(directory), join(fixture, directory), 'dir');
    }
    symlinkSync(resolve('node_modules'), join(fixture, 'node_modules'), 'dir');
    writeFileSync(join(fixture, 'package.json'), '{"type":"module"}');
    writeFileSync(join(fixture, 'dist/seo-content.json'), JSON.stringify({
      posts: {
        'schema-fixture': {
          title: 'Schema identity fixture', description: 'An article about schema identities.',
          tag: 'Technology', readingMinutes: 1,
          datePublished: '2026-10-01', dateModified: '2026-10-01',
          sections: [{ heading: 'Identity', body: 'An article and its page have separate identities.' }],
        },
        ...Object.fromEntries(FILLER_SLUGS.map((slug, index) => [slug, {
          title: `Filler article ${index + 1}`, description: `Filler article number ${index + 1} for the collection window.`,
          tag: 'Technology', readingMinutes: 1,
          datePublished: `2026-09-${String(index + 1).padStart(2, '0')}`, dateModified: '2026-09-30',
          sections: [{ heading: 'Filler', body: 'Text so the article has a section.' }],
        }])),
      },
      comparePages: {
        '/compare/ai-detection-apps': {
          title: 'Detection app comparison fixture', subtitle: 'A comparison',
          intro: 'Compare the detector features.',
          sections: [{ heading: 'Features', body: 'Features differ between apps.' }],
        },
      },
    }));

    const portProbe = createServer();
    portProbe.listen(0, '127.0.0.1');
    await once(portProbe, 'listening');
    const address = portProbe.address();
    if (!address || typeof address === 'string') throw new Error('No fixture port');
    const port = address.port;
    await new Promise<void>(done => portProbe.close(() => done()));
    baseUrl = `http://127.0.0.1:${port}`;

    server = spawn(process.execPath, ['server.js'], {
      cwd: fixture,
      env: {
        PATH: process.env.PATH,
        PORT: String(port), APP_URL: baseUrl,
        GOOGLE_CLIENT_ID: 'schema-test', GOOGLE_CLIENT_SECRET: 'schema-test', JWT_SECRET: 'schema-test',
        DATA_DIR: join(fixture, 'data'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise<void>((ready, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 5000);
      server.stdout?.on('data', chunk => {
        output += chunk;
        if (output.includes('Server running')) {
          clearTimeout(timeout);
          ready();
        }
      });
      server.stderr?.on('data', chunk => { output += chunk; });
      server.once('error', error => { clearTimeout(timeout); reject(error); });
      server.once('exit', code => {
        clearTimeout(timeout);
        reject(new Error(`Server exited ${code}: ${output}`));
      });
    });
  });

  afterAll(async () => {
    if (server && server.exitCode === null) {
      const closed = once(server, 'exit');
      server.kill();
      await closed;
    }
    if (fixture) rmSync(fixture, { recursive: true, force: true });
  });

  async function page(path: string) {
    const response = await fetch(baseUrl + path);
    expect(response.status).toBe(200);
    const html = await response.text();
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map(match => JSON.parse(match[1]) as Schema);
    return { html, schemas };
  }

  it.each(['/', '/about', '/blog/schema-fixture'])('identifies the author by his profile on %s', async path => {
    const { schemas } = await page(path);
    const authors = schemas.flatMap(schema => [schema, schema.author as Schema])
      .filter(schema => schema?.['@type'] === 'Person');
    expect(authors.length).toBeGreaterThan(0);
    for (const author of authors) {
      expect(author['@id']).toBe('https://stopbiting.today/#person');
      expect(author.sameAs).toEqual(['https://github.com/gazivoda']);
      expect(author.url).toBe('https://stopbiting.today/about');
    }
  });

  it.each([
    ['/blog/schema-fixture', 'BlogPosting', 'https://stopbiting.today/blog/schema-fixture', 'https://stopbiting.today/blog/schema-fixture#article'],
    ['/compare/ai-detection-apps', 'Article', 'https://stopbiting.today/compare/ai-detection-apps', 'https://stopbiting.today/compare/ai-detection-apps#article'],
  ])('separates the article entity from its canonical page on %s', async (path, type, canonical, articleId) => {
    const { html, schemas } = await page(path);
    const article = schemas.find(schema => schema['@type'] === type);
    expect(article?.['@id']).toBe(articleId);
    expect(article?.url).toBe(canonical);
    expect(article?.mainEntityOfPage).toEqual({ '@type': 'WebPage', '@id': canonical });
    expect([...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map(match => match[1])).toEqual([canonical]);
    expect(html).toContain('<a href="/about">Igor Gazivoda</a>');
  });

  it('links the collection to the same article entity while retaining its page URL', async () => {
    const { html, schemas } = await page('/blog');
    const collection = schemas.find(schema => schema['@type'] === 'CollectionPage');
    expect(collection?.hasPart).toEqual(expect.arrayContaining([expect.objectContaining({
      '@type': 'BlogPosting',
      '@id': 'https://stopbiting.today/blog/schema-fixture#article',
      url: 'https://stopbiting.today/blog/schema-fixture',
    })]));
    expect(html).toContain('href="/blog/schema-fixture"');
  });

  // The meta tag, the CollectionPage description and the visible standfirst were typed three times and had
  // drifted apart. Structured data has to describe what the page shows.
  it('gives /blog one description: the meta tag, the CollectionPage and the standfirst agree', async () => {
    const { html, schemas } = await page('/blog');
    const collection = schemas.find(schema => schema['@type'] === 'CollectionPage');
    const meta = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
    const standfirst = html.match(/<p class="article-summary">([^<]*)<\/p>/)?.[1];
    expect(meta).toBeTruthy();
    expect(collection?.description).toBe(meta);
    expect(standfirst).toBe(meta);
    expect(meta).not.toMatch(/onychophagia|habit reversal/i);   // the words only the old JSON-LD copy used
  });

  // Not the whole index on purpose: stubs for every post would weigh more than the visible list they restate
  // (see BLOG_FEATURED_COUNT in server.js). The page itself must still link every post.
  it('lists a newest-first window of posts in hasPart while the page links every post', async () => {
    const { html, schemas } = await page('/blog');
    const collection = schemas.find(schema => schema['@type'] === 'CollectionPage');
    const parts = collection?.hasPart as Schema[];
    const allSlugs = ['schema-fixture', ...FILLER_SLUGS];
    expect(parts).toHaveLength(BLOG_WINDOW);
    expect(parts.map(part => part['@id'])).toEqual([
      'schema-fixture', ...FILLER_SLUGS.slice().reverse().slice(0, BLOG_WINDOW - 1),
    ].map(slug => `https://stopbiting.today/blog/${slug}#article`));
    for (const part of parts) {
      expect(part['@type']).toBe('BlogPosting');
      expect(`${part['@id']}`).toBe(`${part.url}#article`);
    }
    expect(allSlugs.length).toBeGreaterThan(BLOG_WINDOW);
    for (const slug of allSlugs) expect(html).toContain(`<a href="/blog/${slug}">`);
  });

  // What a crawler reads is #ssr-page-content; what a browser shows is BlogPost.tsx. The two wrote the date differently
  // ("Published 2026-10-08 · Updated 2026-10-19", ISO, no <time>, against "Updated 19 October 2026" in a <time>) and only
  // the client's header said what the author is. They are one page, so the header says one thing.
  describe('blog article header: the crawler copy and the page React renders agree', () => {
    const DISCLOSURE = 'A software developer who bit his nails for over 20 years, not a clinician.';
    // React writes the attribute as dateTime, the crawler copy as datetime: one attribute, HTML does not tell them apart.
    const TIME = /(Updated )?<time datetime="([^"]+)"[^>]*>([^<]+)<\/time>/gi;
    const timesOf = (html: string) => [...html.matchAll(TIME)].map(m => [m[1] ?? '', m[2], m[3]]);
    const crawlerArticle = (html: string) => html.match(/<article id="ssr-page-content">([\s\S]*?)<\/article>/)?.[1] ?? '';
    const fixturePost = (slug: string) => JSON.parse(readFileSync(join(fixture, 'dist/seo-content.json'), 'utf8')).posts[slug];
    const clientHtml = (slug: string) => {
      h.state = { status: 'ok', post: { slug, ...fixturePost(slug), related: [], productLink: null } };
      return renderToStaticMarkup(createElement(BlogPost, { slug }));
    };

    // [slug, the date line a reader sees]: schema-fixture was never revised, schema-filler-01 was (published 09-01, modified 09-30)
    it.each([
      ['schema-fixture', [['', '2026-10-01', '1 October 2026']]],
      ['schema-filler-01', [['Updated ', '2026-09-30', '30 September 2026']]],
    ])('%s: the same date text and <time> in both', async (slug, expected) => {
      const { html, schemas } = await page(`/blog/${slug}`);
      const crawler = crawlerArticle(html);
      expect(timesOf(crawler)).toEqual(expected);
      expect(timesOf(clientHtml(slug))).toEqual(expected);
      expect(crawler.replace(/<[^>]*>/g, ' ')).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);   // no ISO string left in the visible text (it lives in datetime=)

      // The date the page shows is a date the schema states: <time datetime> is the JSON-LD value, not a rewrite of it.
      const post = fixturePost(slug);
      const article = schemas.find(schema => schema['@type'] === 'BlogPosting');
      expect(article?.datePublished).toBe(post.datePublished);
      expect(article?.dateModified).toBe(post.dateModified);
      for (const [, iso] of timesOf(crawler)) expect([article?.datePublished, article?.dateModified]).toContain(iso);
      expect(timesOf(crawler)[0][1]).toBe(post.dateModified);   // a revised post leads with its update date; an unrevised one has the same two
    });

    it.each(['schema-fixture', 'schema-filler-01'])('%s: says what the author is, under the byline, as the page React renders does', async slug => {
      const { html } = await page(`/blog/${slug}`);
      expect(clientHtml(slug)).toContain(DISCLOSURE);
      const crawler = crawlerArticle(html);
      const byline = crawler.indexOf('<p>By <a href="/about">Igor Gazivoda</a>');
      const disclosure = crawler.indexOf(`<p>${DISCLOSURE}</p>`);
      const summary = crawler.indexOf('<p class="article-summary">');
      expect(byline).toBeGreaterThan(-1);
      expect(disclosure).toBeGreaterThan(byline);
      expect(disclosure).toBeLessThan(summary);
      expect(crawler.split(DISCLOSURE)).toHaveLength(2);   // once, in the header: the author box at the end has its own sentence
    });

    // bylineHtml() is shared with the comparison pages, whose React page draws no disclosure line and no date under the heading.
    it('leaves the comparison pages alone', async () => {
      const crawler = crawlerArticle((await page('/compare/ai-detection-apps')).html);
      expect(crawler).toContain('<p>By <a href="/about">Igor Gazivoda</a>');
      expect(crawler).not.toContain(DISCLOSURE);
      expect(timesOf(crawler)).toEqual([]);
    });
  });
});
