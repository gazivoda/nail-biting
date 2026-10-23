import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type Schema = Record<string, unknown>;

// Exercise the real HTTP responses with a small content artifact. The server,
// shell and dependencies are unchanged; no full site build or live accounts.
describe('server-rendered schema identities', () => {
  let fixture: string;
  let server: ChildProcess;
  let baseUrl: string;

  beforeAll(async () => {
    fixture = mkdtempSync(join(tmpdir(), 'stop-biting-schema-'));
    mkdirSync(join(fixture, 'dist'));
    for (const file of ['server.js', 'email.js', 'trialFollowup.js']) {
      copyFileSync(file, join(fixture, file));
    }
    copyFileSync('index.html', join(fixture, 'dist/index.html'));
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
    expect(collection?.hasPart).toEqual([expect.objectContaining({
      '@type': 'BlogPosting',
      '@id': 'https://stopbiting.today/blog/schema-fixture#article',
      url: 'https://stopbiting.today/blog/schema-fixture',
    })]);
    expect(html).toContain('href="/blog/schema-fixture"');
  });
});
