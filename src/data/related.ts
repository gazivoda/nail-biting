export interface RelatedPost {
  slug: string;
  title: string;
  tag: string;
}

// The head-term pillar: the guide the rest of this corpus exists to support.
//
// It is named here rather than inferred because the tag cycle below cannot
// reach it. getRelated only ever links within a post's own tag, so a post
// tagged Psychology can reach other Psychology posts and nothing else. The
// pillar is tagged Treatment, which left it with zero inbound links from the
// 111 posts outside that tag, and exactly three from inside it — the same
// three any long-tail spoke gets. An even distribution is the right default
// for peers, but it cannot express that one post is the destination.
export const PILLAR_SLUG = 'how-to-stop-nail-biting';

// Related articles for a post, used by both BlogPost.tsx (what visitors see)
// and scripts/generate-seo-content.mjs (what the server renders for crawlers),
// so the two can never disagree. Kept free of imports so Node can load it
// directly from the build script.
//
// Each post links to the posts that FOLLOW it in its own tag group, wrapping
// around. Every post in a group of four or more therefore receives exactly
// three inbound links. Taking the first three of the group instead — the
// obvious implementation — points all 33 Psychology posts at the same three
// articles, leaving the other 30 with no inbound links at all.
//
// The pillar is then appended to every other post, so each one returns its
// three tag-local picks plus one link up to the guide. The pillar is held out
// of the cycle itself so the count stays the same everywhere: every post but
// the pillar returns four, the pillar returns its own three.
export function getRelated<T extends RelatedPost>(
  posts: T[],
  currentSlug: string,
  count = 3,
): RelatedPost[] {
  const index = posts.findIndex(p => p.slug === currentSlug);
  if (index === -1) return [];

  const isPillar = currentSlug === PILLAR_SLUG;

  const picks: RelatedPost[] = [];
  const add = (post: RelatedPost) => {
    if (post.slug === currentSlug) return;
    // Held out of the cycle so it can be appended once, in a fixed position,
    // rather than landing in three arbitrary Treatment posts' picks.
    if (!isPillar && post.slug === PILLAR_SLUG) return;
    if (picks.some(p => p.slug === post.slug)) return;
    picks.push({ slug: post.slug, title: post.title, tag: post.tag });
  };

  const group = posts.filter(p => p.tag === posts[index].tag);
  const position = group.findIndex(p => p.slug === currentSlug);
  for (let i = 1; i < group.length && picks.length < count; i++) {
    add(group[(position + i) % group.length]);
  }

  // Tag groups smaller than count + 1 fall back to the wider corpus, starting
  // just after this post so undersized groups don't all point at the same tail.
  for (let i = 1; i < posts.length && picks.length < count; i++) {
    add(posts[(index + i) % posts.length]);
  }

  // The link up. Last, so the tag-local picks keep the positions they had.
  if (!isPillar) {
    const pillar = posts.find(p => p.slug === PILLAR_SLUG);
    if (pillar) picks.push({ slug: pillar.slug, title: pillar.title, tag: pillar.tag });
  }

  return picks;
}
