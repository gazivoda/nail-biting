import { useEffect } from 'react';
import { ArrowLeft, Clock, BookOpen } from 'lucide-react';
import { getPost } from '../data/blogPosts';

interface Props {
  slug: string;
}

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function BlogPost({ slug }: Props) {
  const post = getPost(slug);

  // Inject JSON-LD BlogPosting schema
  useEffect(() => {
    if (!post) return;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.datePublished,
      dateModified: post.dateModified,
      author: {
        '@type': 'Organization',
        name: 'Stop Biting',
        url: 'https://stopbiting.today',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Stop Biting',
        url: 'https://stopbiting.today',
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `https://stopbiting.today/#/blog/${post.slug}`,
      },
      keywords: post.tag,
      timeRequired: `PT${post.readingMinutes}M`,
    };

    const existing = document.getElementById('blog-post-schema');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = 'blog-post-schema';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    // Set page title
    const prevTitle = document.title;
    document.title = `${post.title} | Stop Biting`;

    return () => {
      const el = document.getElementById('blog-post-schema');
      if (el) el.remove();
      document.title = prevTitle;
    };
  }, [post]);

  // Scroll to top when slug changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [slug]);

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">

      {/* Nav */}
      <nav aria-label="Site navigation" className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-slate-950/80 backdrop-blur-md border-b border-slate-900">
        <a href="/" className="text-sm font-semibold text-slate-100 tracking-tight">Stop Biting</a>
        <div className="flex items-center gap-6">
          <a href="#/blog" className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 text-sm transition-colors">
            <BookOpen size={14} aria-hidden="true" />
            Blog
          </a>
          <a href="/" className="text-sm font-semibold text-slate-400 hover:text-slate-100 transition-colors">
            Launch App
          </a>
        </div>
      </nav>

      {/* 404 */}
      {!post && (
        <div className="flex flex-col items-center justify-center min-h-dvh gap-4 text-center px-6">
          <p className="text-6xl font-bold text-slate-700">404</p>
          <p className="text-slate-400">Article not found.</p>
          <a href="#/blog" className="mt-2 inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to blog
          </a>
        </div>
      )}

      {/* Article */}
      {post && (
        <div className="max-w-2xl mx-auto px-6 pt-28 pb-24">

          {/* Back link */}
          <a
            href="#/blog"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-8"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            All articles
          </a>

          {/* Article header */}
          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${tagClass(post.tag)}`}>
                {post.tag}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Clock size={11} aria-hidden="true" />
                {post.readingMinutes} min read
              </span>
              <time dateTime={post.datePublished} className="text-xs text-slate-600">
                {formatDate(post.datePublished)}
              </time>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-100 leading-tight mb-4">
              {post.title}
            </h1>

            <p className="text-lg text-slate-400 leading-relaxed">
              {post.description}
            </p>
          </header>

          {/* Divider */}
          <hr className="border-slate-800 mb-10" />

          {/* Sections */}
          <article>
            {post.sections.map((section, i) => (
              <section key={i} className="mb-10">
                <h2 className="text-xl font-semibold text-slate-100 mb-4 leading-snug">
                  {section.heading}
                </h2>

                {/* Body paragraphs */}
                {section.body.split('\n\n').map((para, j) => (
                  <p key={j} className="text-slate-300 leading-relaxed mb-4 text-[15px]">
                    {para}
                  </p>
                ))}

                {/* Optional list */}
                {section.list && section.list.length > 0 && (
                  <ul className="mt-3 space-y-3">
                    {section.list.map((item, k) => (
                      <li key={k} className="flex gap-3 text-[15px] text-slate-300 leading-relaxed">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </article>

          {/* CTA */}
          <div className="mt-14 rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center">
            <p className="text-slate-400 text-sm mb-1">Ready to start tracking?</p>
            <p className="text-slate-100 font-semibold text-xl mb-5">Try Stop Biting — free to start</p>
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl px-6 py-3 text-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95"
            >
              Launch App
            </a>
          </div>

          {/* Back link bottom */}
          <div className="mt-10 text-center">
            <a
              href="#/blog"
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back to all articles
            </a>
          </div>
        </div>
      )}

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
