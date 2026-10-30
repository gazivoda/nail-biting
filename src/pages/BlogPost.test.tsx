import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PostState } from '../hooks/usePost';

// The article arrives from /posts/<slug>.json after the page has painted. While it is on its way the page is the header and
// a one-line loading column; a footer under that column is pushed ~10,000 px down when the article lands, and Lighthouse
// scored that single shift 0.719 on a phone (a CLS above 0.1 is "poor"). So the footer waits for the article, and only
// the loading view waits: the short error and not-found views are final and keep theirs.
const h = vi.hoisted(() => ({ state: { status: 'loading' } as PostState }));
vi.mock('../hooks/usePost', () => ({ usePost: () => h.state }));

import { BlogPost } from './BlogPost';

const render = (state: PostState) => {
  h.state = state;
  return renderToStaticMarkup(createElement(BlogPost, { slug: 'a-post' }));
};

const POST = {
  slug: 'a-post',
  title: 'A post about nails',
  description: 'What the post says in one line.',
  tag: 'Habit',
  readingMinutes: 4,
  datePublished: '2026-10-01',
  dateModified: '2026-10-01',
  related: [],
  productLink: null,
  sections: [{ heading: 'First', body: 'One paragraph.' }],
};

describe('BlogPost footer', () => {
  it('has no footer or closing call to action while the article is loading', () => {
    const html = render({ status: 'loading' });
    expect(html).toContain('Loading the article');
    expect(html).not.toContain('<footer');
    expect(html).not.toContain('Catch your next bite.');
    expect(html).toContain('aria-label="Site navigation"');   // the header stays: only what sits below the article column waits
  });

  it('has the footer once the article is there', () => {
    const html = render({ status: 'ok', post: POST });
    expect(html).toContain('A post about nails');
    expect(html).toContain('<footer');
    expect(html).not.toContain('Loading the article');
  });

  it('keeps the footer on the short, final views', () => {
    for (const status of ['error', 'notfound'] as const) {
      expect(render({ status }), status).toContain('<footer');
    }
  });
});
