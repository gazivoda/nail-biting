import { useState } from 'react';
import { ArrowRight, Clock, BookOpen } from 'lucide-react';
import { BLOG_POSTS } from '../data/blogPosts';

const ALL_TAGS = ['All', ...Array.from(new Set(BLOG_POSTS.map(p => p.tag)))];

const TAG_COLORS: Record<string, string> = {
  Psychology:  'bg-violet-100 text-violet-700 border-violet-200',
  Treatment:   'bg-forest-100 text-forest-700 border-forest-200',
  Health:      'bg-rose-100 text-rose-700 border-rose-200',
  Parenting:   'bg-sky-100 text-sky-700 border-sky-200',
  Clinical:    'bg-amber-100 text-amber-700 border-amber-200',
  Technology:  'bg-cyan-100 text-cyan-700 border-cyan-200',
  Productivity:'bg-orange-100 text-orange-700 border-orange-200',
  Science:     'bg-indigo-100 text-indigo-700 border-indigo-200',
};

function tagClass(tag: string) {
  return TAG_COLORS[tag] ?? 'bg-stone-100 text-stone-600 border-stone-200';
}

export function BlogIndex() {
  const [activeTag, setActiveTag] = useState('All');

  const posts = activeTag === 'All'
    ? BLOG_POSTS
    : BLOG_POSTS.filter(p => p.tag === activeTag);

  return (
    <div className="min-h-dvh bg-cream-100 text-stone-800">

      {/* Nav */}
      <nav aria-label="Site navigation" className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-cream-100/90 backdrop-blur-md border-b border-stone-200">
        <a href="/" className="text-sm font-semibold text-stone-800 tracking-tight">Stop Biting</a>
        <div className="flex items-center gap-6">
          <a href="/blog" aria-current="page" className="flex items-center gap-1.5 text-forest-600 text-sm font-semibold">
            <BookOpen size={14} aria-hidden="true" />
            Blog
          </a>
          <a href="/" className="text-sm font-semibold text-stone-500 hover:text-stone-800 transition-colors">
            Launch App
          </a>
        </div>
      </nav>

      {/* Header */}
      <header className="pt-28 pb-12 px-6 text-center max-w-3xl mx-auto">
        <p className="text-forest-600 text-sm font-semibold tracking-wider uppercase mb-3">Evidence-based guides</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-800 mb-4">
          Nail Biting Resources
        </h1>
        <p className="text-stone-500 text-lg leading-relaxed">
          Research-backed articles on habit psychology, treatment options, and the science of breaking body-focused repetitive behaviours.
        </p>
      </header>

      {/* Tag filter */}
      <div className="flex flex-wrap justify-center gap-2 px-6 pb-10" role="group" aria-label="Filter by category">
        {ALL_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-all duration-150 ${
              activeTag === tag
                ? 'bg-forest-600 text-cream-100 border-forest-600 font-semibold'
                : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-700'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Post grid */}
      <main className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map(post => (
            <a
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col bg-white border border-stone-200 rounded-2xl p-6 hover:border-forest-300 hover:shadow-md transition-all duration-200 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500"
            >
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${tagClass(post.tag)}`}>
                  {post.tag}
                </span>
                <span className="flex items-center gap-1 text-xs text-stone-400">
                  <Clock size={11} aria-hidden="true" />
                  {post.readingMinutes} min
                </span>
              </div>

              <h2 className="text-base font-semibold text-stone-800 leading-snug mb-3 group-hover:text-forest-600 transition-colors line-clamp-3">
                {post.title}
              </h2>

              <p className="text-sm text-stone-500 leading-relaxed mb-5 flex-1 line-clamp-3">
                {post.description}
              </p>

              <span className="inline-flex items-center gap-1.5 text-sm text-forest-600 font-medium group-hover:gap-2.5 transition-all">
                Read article
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>

        {posts.length === 0 && (
          <p className="text-center text-stone-400 py-20">No posts in this category yet.</p>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-8 px-6 text-center text-stone-400 text-sm bg-cream-200">
        <p>
          <a href="/" className="hover:text-stone-600 transition-colors">Stop Biting</a>
          {' — '}AI-powered nail biting tracker for Mac and Windows
        </p>
      </footer>
    </div>
  );
}
