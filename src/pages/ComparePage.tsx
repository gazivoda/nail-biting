import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, X } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggle } from '../components/ThemeToggle';
import { PAGE_MAP } from '../data/comparePages';

interface Props {
  path: string;
}


export function ComparePage({ path }: Props) {
  useTheme();

  const getContent = PAGE_MAP[path];
  const content = getContent?.();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [path]);

  // server.js injects an off-screen copy of this page for crawlers that never
  // run JS. Once React has rendered the real thing, leaving it there would mean
  // two <h1>s and the whole body twice — the exact problem bf4dab1 fixed for
  // blog posts. Raw HTML is unaffected.
  useEffect(() => {
    document.getElementById('ssr-page-content')?.remove();
  }, [path]);

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4 text-center px-6 bg-cream-100 dark:bg-ink-100">
        <p className="text-6xl font-bold text-stone-300 dark:text-stone-600">404</p>
        <p className="text-stone-500 dark:text-stone-400">Page not found.</p>
        <a href="/" className="mt-2 inline-flex items-center gap-2 text-forest-600 dark:text-forest-400 text-sm">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to home
        </a>
      </div>
    );
  }

  const breadcrumbLabel = path.startsWith('/compare/') ? 'Compare' : 'Solutions';
  const breadcrumbHref = path.startsWith('/compare/') ? '/compare/bitter-polish-alternative' : '/solutions/for-desk-workers';

  return (
    <div className="min-h-dvh bg-cream-100 dark:bg-ink-100 text-stone-800 dark:text-stone-200">

      {/* Nav */}
      <nav aria-label="Site navigation" className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-cream-100/90 dark:bg-ink-100/90 backdrop-blur-md border-b border-stone-200 dark:border-ink-400">
        <a href="/" className="text-sm font-semibold text-stone-800 dark:text-stone-100 tracking-tight">Stop Biting</a>
        <div className="flex items-center gap-6">
          <a href="/blog" className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 text-sm transition-colors">
            <BookOpen size={14} aria-hidden="true" />
            Blog
          </a>
          <ThemeToggle />
          <a href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold bg-forest-600 hover:bg-forest-500 text-cream-100 px-4 py-1.5 rounded-xl transition-all duration-150 hover:-translate-y-0.5">
            Try Free
          </a>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 pt-28 pb-24">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 mb-8">
          <a href="/" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Home</a>
          <span aria-hidden="true">/</span>
          <a href={breadcrumbHref} className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">{breadcrumbLabel}</a>
          <span aria-hidden="true">/</span>
          <span className="text-stone-500 dark:text-stone-400 truncate max-w-[180px]">{content.title.split(':')[0]}</span>
        </nav>

        <header className="mb-10">
          <p className="text-xs font-medium text-forest-600 dark:text-forest-400 uppercase tracking-widest mb-3">{breadcrumbLabel}</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-800 dark:text-stone-100 leading-tight mb-4">
            {content.title}
          </h1>
          <p className="text-lg text-stone-500 dark:text-stone-400 leading-relaxed">
            {content.subtitle}
          </p>
        </header>

        {/* Intro */}
        <div className="mb-10 p-6 rounded-2xl bg-stone-50 dark:bg-ink-50 border border-stone-200 dark:border-ink-400">
          <p className="text-[15px] text-stone-600 dark:text-stone-400 leading-relaxed">{content.intro}</p>
        </div>

        {/* Quick verdict table for compare pages */}
        {path.startsWith('/compare/') && path === '/compare/bitter-polish-alternative' && (
          <div className="mb-12 overflow-hidden rounded-2xl border border-stone-200 dark:border-ink-400">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 dark:bg-ink-50 border-b border-stone-200 dark:border-ink-400">
                  <th className="text-left px-4 py-3 font-semibold text-stone-700 dark:text-stone-300">Feature</th>
                  <th className="text-center px-4 py-3 font-semibold text-stone-700 dark:text-stone-300">Bitter Polish</th>
                  <th className="text-center px-4 py-3 font-semibold text-forest-600 dark:text-forest-400">Stop Biting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-ink-400">
                {[
                  ['Catches unconscious biting', false, true],
                  ['Works during gaming', false, true],
                  ['Works without washing hands', true, true],
                  ['Clinical evidence base', false, true],
                  ['Incident data & tracking', false, true],
                  ['No product reapplication', false, true],
                  ['Works for conscious biting', true, true],
                  ['One-time purchase option', true, false],
                ].map(([label, bitter, app]) => (
                  <tr key={String(label)} className="bg-white dark:bg-ink-50">
                    <td className="px-4 py-3 text-stone-600 dark:text-stone-400">{String(label)}</td>
                    <td className="px-4 py-3 text-center">
                      {bitter ? <Check size={16} className="mx-auto text-stone-400" /> : <X size={16} className="mx-auto text-stone-300 dark:text-stone-600" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {app ? <Check size={16} className="mx-auto text-forest-500" /> : <X size={16} className="mx-auto text-stone-300 dark:text-stone-600" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Main sections */}
        <article className="mb-14">
          {content.sections.map((section) => (
            <section key={section.heading} className="mb-10">
              <h2 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-4 leading-snug">{section.heading}</h2>
              {section.body.split('\n\n').map((para, i) => (
                <p key={i} className="text-[15px] text-stone-600 dark:text-stone-400 leading-relaxed mb-4">{para}</p>
              ))}
            </section>
          ))}
        </article>

        {/* Related posts */}
        <section className="mb-14">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-5">Related reading</h2>
          <div className="flex flex-col gap-3">
            {content.relatedPosts.map((post) => (
              <a
                key={post.href}
                href={post.href}
                className="group flex items-center justify-between gap-4 rounded-xl border border-stone-200 dark:border-ink-400 bg-white dark:bg-ink-50 px-4 py-3 hover:border-forest-300 dark:hover:border-forest-700 hover:shadow-sm transition-all"
              >
                <span className="text-sm text-stone-700 dark:text-stone-200 group-hover:text-forest-600 dark:group-hover:text-forest-400 transition-colors">{post.label}</span>
                <ArrowRight size={14} className="text-stone-400 group-hover:text-forest-500 shrink-0 transition-colors" aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl bg-forest-50 dark:bg-forest-900/20 border border-forest-200 dark:border-forest-800 p-8 text-center">
          <p className="text-stone-500 dark:text-stone-400 text-sm mb-1">3-day free trial — no credit card needed</p>
          <p className="text-stone-900 dark:text-stone-100 font-semibold text-xl mb-5">Try Stop Biting free</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-xl px-6 py-3 text-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_oklch(38%_0.12_148/0.35)] active:scale-95"
          >
            Launch App
          </a>
          <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">
            $2.99/month · $29/year · Cancel anytime
          </p>
        </div>

        <div className="mt-10 text-center">
          <a href="/" className="inline-flex items-center gap-2 text-sm text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to home
          </a>
        </div>
      </div>

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
