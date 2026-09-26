import { useEffect } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { TrialButton } from '../components/site/TrialButton';
import { useTheme } from '../hooks/useTheme';
import { PAGE_MAP } from '../data/comparePages';
import { AuthorBox } from './EditorialPolicyPage';

interface Props {
  path: string;
}


export function ComparePage({ path }: Props) {
  useTheme('light');

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
  const breadcrumbHref = path.startsWith('/compare/') ? '/compare/ai-detection-apps' : '/solutions/for-desk-workers';

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">
      <div className="sg-page"><SiteHeader /></div>

      <main className="max-w-2xl mx-auto px-6 pt-28 pb-24">

        <nav aria-label="Breadcrumb" className="sg-note mb-8 flex items-center gap-2">
          <a href="/" className="hover:text-[color:var(--sg-ink)]">Home</a>
          <span aria-hidden="true">/</span>
          <a href={breadcrumbHref} className="hover:text-[color:var(--sg-ink)]">{breadcrumbLabel}</a>
          <span aria-hidden="true">/</span>
          <span className="truncate max-w-[200px] text-[color:var(--sg-ink)]">{content.title.split(':')[0]}</span>
        </nav>

        <header className="mb-10">
          <h1 className="sg-h2">{content.title}</h1>
          <p className="sg-lede mt-4">{content.subtitle}</p>
        </header>

        <div className="mb-10 rounded-2xl border border-[color:var(--sg-rule)] bg-white p-6">
          <p className="sg-body text-[color:var(--sg-ink)]">{content.intro}</p>
        </div>

        {/* No hand-written verdict table here. The one this page had marked
            Stop Biting as having a "clinical evidence base" and bitter polish
            as having none, the reverse of the trials cited below. Each page's
            own sourced table (section.html) carries the comparison. */}
        <article className="mb-14">
          {content.sections.map((section) => (
            <section key={section.heading} className="mb-10">
              <h2 className="mb-4 text-[1.5rem] font-extrabold leading-tight tracking-[-0.02em]">{section.heading}</h2>
              {section.body.split('\n\n').map((para, i) => (
                <p key={i} className="sg-body mb-4">{para}</p>
              ))}
              {section.html && (
                <div
                  className="mt-4 overflow-x-auto blog-html-block"
                  dangerouslySetInnerHTML={{ __html: section.html }}
                />
              )}
            </section>
          ))}
        </article>

        {/* The same offer and button as every other page. */}
        <div className="mb-14 flex flex-col items-start gap-4 rounded-2xl border border-[color:var(--sg-rule)] bg-white p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="sg-h3">Try it free for 3 days.</p>
            <p className="sg-small mt-1">
              No card to start, then $2.99 a month or $29 a year. Read{' '}
              <a href="/how-it-works" className="sg-link">how it works</a>.
            </p>
          </div>
          <TrialButton />
        </div>

        <section aria-labelledby="related-heading">
          <h2 id="related-heading" className="sg-h3 mb-5">Related reading</h2>
          <div className="flex flex-col gap-3">
            {content.relatedPosts.map((post) => (
              <a
                key={post.href}
                href={post.href}
                className="group flex items-center justify-between gap-4 rounded-xl border border-[color:var(--sg-rule)] bg-white px-4 py-3 transition-colors hover:border-[color:var(--sg-accent)]"
              >
                <span className="text-[0.9375rem] font-semibold text-[color:var(--sg-ink)] group-hover:text-[color:var(--sg-accent)]">{post.label}</span>
                <ArrowRight size={15} className="shrink-0 text-[color:var(--sg-ink-2)] group-hover:text-[color:var(--sg-accent)]" aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>

        <AuthorBox />
      </main>

      <div className="sg-page"><SiteFooter /></div>
    </div>
  );
}
