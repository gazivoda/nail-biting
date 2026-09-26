import { useState } from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { BLOG_INDEX } from '../data/blogIndex';
import { useTheme } from '../hooks/useTheme';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { TAG_PILL } from '../components/blog/tagPill';

const ALL_TAGS = ['All', ...Array.from(new Set(BLOG_INDEX.map(p => p.tag)))];

export function BlogIndex() {
  useTheme('light');
  const [activeTag, setActiveTag] = useState('All');

  const posts = activeTag === 'All'
    ? BLOG_INDEX
    : BLOG_INDEX.filter(p => p.tag === activeTag);

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">

      <div className="sg-page"><SiteHeader current="blog" /></div>

      {/* Header: every heading on the site is sentence case, and no kicker
          label sits above it. The h1 and lede are mirrored in server.js. */}
      <header className="sg-container pt-28 pb-8 lg:pt-32">
        <h1 className="sg-h2">Nail biting resources</h1>
        <p className="sg-lede sg-measure mt-4">
          Research-backed articles on habit psychology, treatment options, and the science of breaking body-focused repetitive behaviours.
        </p>

        <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {ALL_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              aria-pressed={activeTag === tag}
              onClick={() => setActiveTag(tag)}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[0.9375rem] font-semibold transition-colors ${
                activeTag === tag
                  ? 'border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-white'
                  : 'border-[color:var(--sg-rule)] bg-white text-[color:var(--sg-ink-2)] hover:border-[color:var(--sg-ink-2)] hover:text-[color:var(--sg-ink)]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </header>

      {/* Post grid: plain plates, no hover lift. On a phone each card is the
          title and its tag only, so 144 articles are a list to scan rather
          than a 40,000px scroll; every link stays in the page for crawlers. */}
      <main className="sg-container pb-20">
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {posts.map(post => (
            <a
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-2xl border border-[color:var(--sg-rule)] bg-white p-5 transition-colors hover:border-[color:var(--sg-accent)] sm:p-6"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className={TAG_PILL}>{post.tag}</span>
                <span className="sg-note flex items-center gap-1">
                  <Clock size={12} aria-hidden="true" />
                  {post.readingMinutes} min
                </span>
              </div>

              <h2 className="text-[1.0625rem] font-bold leading-snug group-hover:text-[color:var(--sg-accent)] sm:mb-2 sm:line-clamp-3">
                {post.title}
              </h2>

              <p className="sg-small mb-4 hidden flex-1 line-clamp-3 sm:block">
                {post.description}
              </p>

              <span className="mt-3 hidden items-center gap-1.5 text-[0.9375rem] font-semibold text-[color:var(--sg-accent)] sm:mt-auto sm:inline-flex">
                Read article
                <ArrowRight size={15} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>

        {posts.length === 0 && (
          <p className="sg-body py-20 text-center">No posts in this category yet.</p>
        )}
      </main>

      <div className="sg-page"><SiteFooter /></div>
    </div>
  );
}
