import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_TRIAL_DAYS, fillTrialTokens, trialCopy } from '../../shared/plans.js';

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
});
