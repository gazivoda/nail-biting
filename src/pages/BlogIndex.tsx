import { useState, useEffect } from 'react';
import { ArrowRight, Clock, BookOpen } from 'lucide-react';
import { BLOG_POSTS } from '../data/blogPosts';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggle } from '../components/ThemeToggle';

const ALL_TAGS = ['All', ...Array.from(new Set(BLOG_POSTS.map(p => p.tag)))];

const TAG_COLORS: Record<string, string> = {
  Psychology:  'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800',
  Treatment:   'bg-forest-100 dark:bg-forest-900/30 text-forest-700 dark:text-forest-400 border-forest-200 dark:border-forest-800',
  Health:      'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  Parenting:   'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800',
  Clinical:    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  Technology:  'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
  Productivity:'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  Science:     'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
};

function tagClass(tag: string) {
  return TAG_COLORS[tag] ?? 'bg-stone-100 dark:bg-ink-300 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-ink-400';
}

function useScrollReveal() {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      document.querySelectorAll('.reveal, .reveal-card').forEach(el => el.classList.add('revealed'));
      return;
    }
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); } }),
      { threshold: 0.10, rootMargin: '0px 0px -30px 0px' },
    );
    document.querySelectorAll('.reveal, .reveal-card').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

export function BlogIndex() {
  useTheme();
  useScrollReveal();
  const [activeTag, setActiveTag] = useState('All');

  const posts = activeTag === 'All'
    ? BLOG_POSTS
    : BLOG_POSTS.filter(p => p.tag === activeTag);

  return (
    <div className="min-h-dvh bg-cream-100 dark:bg-ink-100 text-stone-800 dark:text-stone-200">

      {/* Nav */}
      <nav aria-label="Site navigation" className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-cream-100/90 dark:bg-ink-100/90 backdrop-blur-md border-b border-stone-200 dark:border-ink-400">
        <a href="/" className="text-sm font-semibold text-stone-800 dark:text-stone-100 tracking-tight">Stop Biting</a>
        <div className="flex items-center gap-4">
          <a href="/blog" aria-current="page" className="flex items-center gap-1.5 text-forest-600 dark:text-forest-400 text-sm font-semibold">
            <BookOpen size={14} aria-hidden="true" />
            Blog
          </a>
          <ThemeToggle />
          <a href="/" className="text-sm font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors">
            Launch App
          </a>
        </div>
      </nav>

      {/* Header */}
      <header className="reveal pt-28 pb-12 px-6 text-center max-w-3xl mx-auto">
        <p className="text-forest-600 dark:text-forest-400 text-sm font-semibold tracking-wider uppercase mb-3">Evidence-based guides</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-800 dark:text-stone-100 mb-4">
          Nail Biting Resources
        </h1>
        <p className="text-stone-500 dark:text-stone-400 text-lg leading-relaxed">
          Research-backed articles on habit psychology, treatment options, and the science of breaking body-focused repetitive behaviours.
        </p>
      </header>

      {/* Tag filter */}
      <div className="reveal flex flex-wrap justify-center gap-2 px-6 pb-10" role="group" aria-label="Filter by category">
        {ALL_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-all duration-150 ${
              activeTag === tag
                ? 'bg-forest-600 text-cream-100 border-forest-600 font-semibold'
                : 'bg-white dark:bg-ink-50 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-ink-400 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-700 dark:hover:text-stone-200'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Post grid */}
      <main className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <a
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{ transitionDelay: `${(i % 3) * 70}ms` }}
              className="reveal-card group flex flex-col bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-6 hover:border-forest-300 dark:hover:border-forest-700 hover:-translate-y-1 hover:shadow-card-md transition-all duration-200 shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500"
            >
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${tagClass(post.tag)}`}>
                  {post.tag}
                </span>
                <span className="flex items-center gap-1 text-xs text-stone-400 dark:text-stone-500">
                  <Clock size={11} aria-hidden="true" />
                  {post.readingMinutes} min
                </span>
              </div>

              <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100 leading-snug mb-3 group-hover:text-forest-600 dark:group-hover:text-forest-400 transition-colors line-clamp-3">
                {post.title}
              </h2>

              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mb-5 flex-1 line-clamp-3">
                {post.description}
              </p>

              <span className="inline-flex items-center gap-1.5 text-sm text-forest-600 dark:text-forest-400 font-medium group-hover:gap-2.5 transition-all">
                Read article
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>

        {posts.length === 0 && (
          <p className="text-center text-stone-400 dark:text-stone-500 py-20">No posts in this category yet.</p>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 dark:border-ink-400 py-8 px-6 text-center text-stone-400 dark:text-stone-500 text-sm bg-cream-200 dark:bg-ink-200">
        <p>
          <a href="/" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Stop Biting</a>
          {' — '}AI-powered nail biting tracker for Mac and Windows
        </p>
      </footer>
    </div>
  );
}
