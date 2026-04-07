import { useState } from 'react';
import { ArrowRight, Clock, BookOpen } from 'lucide-react';
import { BLOG_POSTS } from '../data/blogPosts';

const ALL_TAGS = ['All', ...Array.from(new Set(BLOG_POSTS.map(p => p.tag)))];

const TAG_COLORS: Record<string, string> = {
  Psychology:  'bg-violet-900/40 text-violet-300 border-violet-700/50',
  Treatment:   'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  Health:      'bg-rose-900/40 text-rose-300 border-rose-700/50',
  Parenting:   'bg-sky-900/40 text-sky-300 border-sky-700/50',
  Clinical:    'bg-amber-900/40 text-amber-300 border-amber-700/50',
  Technology:  'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
  Productivity:'bg-orange-900/40 text-orange-300 border-orange-700/50',
  Science:     'bg-indigo-900/40 text-indigo-300 border-indigo-700/50',
};

function tagClass(tag: string) {
  return TAG_COLORS[tag] ?? 'bg-slate-800 text-slate-300 border-slate-600';
}

export function BlogIndex() {
  const [activeTag, setActiveTag] = useState('All');

  const posts = activeTag === 'All'
    ? BLOG_POSTS
    : BLOG_POSTS.filter(p => p.tag === activeTag);

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">

      {/* Nav */}
      <nav aria-label="Site navigation" className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-slate-950/80 backdrop-blur-md border-b border-slate-900">
        <a href="/" className="text-sm font-semibold text-slate-100 tracking-tight">Stop Biting</a>
        <div className="flex items-center gap-6">
          <a href="/blog" aria-current="page" className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
            <BookOpen size={14} aria-hidden="true" />
            Blog
          </a>
          <a href="/" className="text-sm font-semibold text-slate-400 hover:text-slate-100 transition-colors">
            Launch App
          </a>
        </div>
      </nav>

      {/* Header */}
      <header className="pt-28 pb-12 px-6 text-center max-w-3xl mx-auto">
        <p className="text-emerald-400 text-sm font-medium tracking-wider uppercase mb-3">Evidence-based guides</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-100 mb-4">
          Nail Biting Resources
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed">
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
                ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-semibold'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200'
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
              className="group flex flex-col bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-600 hover:bg-slate-800/60 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${tagClass(post.tag)}`}>
                  {post.tag}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={11} aria-hidden="true" />
                  {post.readingMinutes} min
                </span>
              </div>

              <h2 className="text-base font-semibold text-slate-100 leading-snug mb-3 group-hover:text-emerald-300 transition-colors line-clamp-3">
                {post.title}
              </h2>

              <p className="text-sm text-slate-400 leading-relaxed mb-5 flex-1 line-clamp-3">
                {post.description}
              </p>

              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400 font-medium group-hover:gap-2.5 transition-all">
                Read article
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </a>
          ))}
        </div>

        {posts.length === 0 && (
          <p className="text-center text-slate-500 py-20">No posts in this category yet.</p>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 px-6 text-center text-slate-600 text-sm">
        <p>
          <a href="/" className="hover:text-slate-400 transition-colors">Stop Biting</a>
          {' — '}AI-powered nail biting tracker for Mac and Windows
        </p>
      </footer>
    </div>
  );
}
