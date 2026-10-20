import { describe, it, expect } from 'vitest';
import { BLOG_POSTS } from './blogPosts';
import { getRelated, PILLAR_SLUG } from './related';

describe('getRelated', () => {
  const inbound = new Map<string, number>();
  for (const p of BLOG_POSTS) {
    for (const r of getRelated(BLOG_POSTS, p.slug)) inbound.set(r.slug, (inbound.get(r.slug) ?? 0) + 1);
  }

  it('never links a post to itself or twice to the same post', () => {
    for (const p of BLOG_POSTS) {
      const slugs = getRelated(BLOG_POSTS, p.slug).map(r => r.slug);
      expect(slugs).not.toContain(p.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it('leaves no post without an inbound related link', () => {
    expect(BLOG_POSTS.filter(p => !inbound.has(p.slug)).map(p => p.slug)).toEqual([]);
  });

  it('keeps linking every non-pillar post up to the pillar', () => {
    for (const p of BLOG_POSTS) {
      if (p.slug === PILLAR_SLUG || p.slug === 'bfrb-guide' || p.slug === 'nail-biting-health-risks'
        || p.slug === 'nail-biting-in-children' || p.slug === 'nail-biting-by-situation') continue;
      expect(getRelated(BLOG_POSTS, p.slug).map(r => r.slug)).toContain(PILLAR_SLUG);
    }
  });

  it('links a spoke to its topic neighbours and its hub, not a random tag', () => {
    const slugs = getRelated(BLOG_POSTS, 'nail-biting-gum-disease').map(r => r.slug);
    expect(slugs).toContain('nail-biting-teeth-damage');
    expect(slugs).toContain('nail-biting-health-risks');
  });
});
