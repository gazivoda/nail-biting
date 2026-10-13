import { useEffect, useState } from 'react';
import type { BlogSection } from '../data/blogPosts';
import type { RelatedPost, ProductLink } from '../data/related';

// One article, fetched from /posts/<slug>.json (written at build time by
// scripts/generate-seo-content.mjs from the same data the crawler HTML uses).
//
// The page used to import every article, ~1 MB in the BlogPost chunk, so a
// reader of one post downloaded all 149. Types are imported with `import type`
// so none of that data is pulled back in.
export interface PostData {
  slug: string;
  title: string;
  seoTitle?: string;
  description: string;
  tag: string;
  readingMinutes: number;
  datePublished: string;
  dateModified: string;
  ogImage?: string;
  related: RelatedPost[];
  productLink: ProductLink | null;
  sections: BlogSection[];
}

export type PostState =
  | { status: 'loading' }
  | { status: 'ok'; post: PostData }
  | { status: 'notfound' }
  | { status: 'error' };

// Same alphabet the build enforces on slugs. Anything else is not an article,
// and must never be spliced into a request path.
const SLUG = /^[a-z0-9-]+$/;

type FetchFn = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

// A real 404 is "this article does not exist"; a network failure or a 5xx is
// "could not load it", and must not tell the reader the article is gone.
export async function loadPost(slug: string, fetchFn: FetchFn, signal?: AbortSignal): Promise<PostState> {
  if (!SLUG.test(slug)) return { status: 'notfound' };
  try {
    const res = await fetchFn(`/posts/${slug}.json`, { signal });
    if (res.status === 404) return { status: 'notfound' };
    if (!res.ok) return { status: 'error' };
    const post = (await res.json()) as PostData;
    if (!post || post.slug !== slug || !Array.isArray(post.sections)) return { status: 'error' };
    return { status: 'ok', post };
  } catch {
    return { status: 'error' };
  }
}

// Articles already read in this tab, so back/forward and re-opening are instant.
const cache = new Map<string, PostData>();

export function usePost(slug: string): PostState {
  const [state, setState] = useState<PostState>(() => {
    const hit = cache.get(slug);
    return hit ? { status: 'ok', post: hit } : { status: 'loading' };
  });

  useEffect(() => {
    const hit = cache.get(slug);
    if (hit) {
      setState({ status: 'ok', post: hit });
      return;
    }
    setState({ status: 'loading' });
    const controller = new AbortController();
    loadPost(slug, (url, init) => fetch(url, init), controller.signal).then(next => {
      if (controller.signal.aborted) return;
      if (next.status === 'ok') cache.set(slug, next.post);
      setState(next);
    });
    return () => controller.abort();
  }, [slug]);

  // On a client-side navigation the first render after the slug changes still
  // holds the previous article; never show it under the new URL.
  if (state.status === 'ok' && state.post.slug !== slug) return { status: 'loading' };
  return state;
}
