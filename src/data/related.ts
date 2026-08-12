export interface RelatedPost {
  slug: string;
  title: string;
  tag: string;
}

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
export function getRelated<T extends RelatedPost>(
  posts: T[],
  currentSlug: string,
  count = 3,
): RelatedPost[] {
  const index = posts.findIndex(p => p.slug === currentSlug);
  if (index === -1) return [];

  const picks: RelatedPost[] = [];
  const add = (post: RelatedPost) => {
    if (post.slug === currentSlug) return;
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

  return picks;
}
