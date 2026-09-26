import { useEffect } from 'react';
import { ArrowLeft, Clock, ArrowRight } from 'lucide-react';
import { BLOG_POSTS, getPost } from '../data/blogPosts';
import { getRelated } from '../data/related';
import { AUTHOR_BIO } from '../data/editorialPolicy';
import { AuthorBox } from './EditorialPolicyPage';
import { buildPageTitle } from '../utils/pageTitle';
import { useTheme } from '../hooks/useTheme';
import { TAG_PILL } from '../components/blog/tagPill';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { TrialButton } from '../components/site/TrialButton';

interface Props {
  slug: string;
}


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
}


export function BlogPost({ slug }: Props) {
  useTheme('light');
  const post = getPost(slug);
  const canonicalUrl = `https://stopbiting.today/blog/${slug}`;
  const related = post ? getRelated(BLOG_POSTS, slug) : [];

  // Keep <title> and canonical current across client-side navigation.
  //
  // JSON-LD is deliberately NOT injected here: server.js already puts the
  // canonical BlogPosting + BreadcrumbList blocks (with dates and author from
  // blogPosts.ts) into the raw HTML, which is the copy crawlers actually read.
  // A second client-side copy previously advertised two BlogPosting entities
  // under one @id with different headlines — ambiguous structured data that
  // can cost the rich result outright.
  useEffect(() => {
    if (!post) return;

    const prevTitle = document.title;
    // Must match what server.js put in the HTML. Google indexes the rendered
    // title, so setting an unbudgeted one here would undo the server's work.
    document.title = buildPageTitle(post.seoTitle ?? post.title);

    const canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const prevCanonical = canonicalEl?.href ?? '';
    if (canonicalEl) canonicalEl.href = canonicalUrl;

    return () => {
      document.title = prevTitle;
      if (canonicalEl) canonicalEl.href = prevCanonical;
    };
  }, [post, canonicalUrl]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [slug]);

  // Note: server.js injects an in-flow copy of the article (#ssr-page-content)
  // inside #root for crawlers and no-JS visitors. No cleanup is needed here —
  // React's createRoot().render() removes all existing children of #root when
  // the app mounts.

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">

      <div className="sg-page"><SiteHeader current="blog" /></div>

      {/* 404 */}
      {!post && (
        <div className="flex flex-col items-center justify-center min-h-dvh gap-4 text-center px-6">
          <p className="text-6xl font-bold text-stone-300 dark:text-stone-600">404</p>
          <p className="text-stone-500 dark:text-stone-400">Article not found.</p>
          <a href="/blog" className="mt-2 inline-flex items-center gap-2 text-forest-600 dark:text-forest-400 hover:text-forest-500 text-sm">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to blog
          </a>
        </div>
      )}

      {/* Article */}
      {post && (
        <div className="max-w-2xl mx-auto px-6 pt-28 pb-24">

          {/* Breadcrumb nav */}
          <nav aria-label="Breadcrumb" className="sg-note mb-8 flex items-center gap-2">
            <a href="/" className="hover:text-[color:var(--sg-ink)]">Home</a>
            <span aria-hidden="true">/</span>
            <a href="/blog" className="hover:text-[color:var(--sg-ink)]">Blog</a>
            <span aria-hidden="true">/</span>
            <span className="truncate max-w-[200px] text-[color:var(--sg-ink)]">{post.tag}</span>
          </nav>

          {/* Article header */}
          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className={TAG_PILL}>
                {post.tag}
              </span>
              <span className="sg-note flex items-center gap-1">
                <Clock size={11} aria-hidden="true" />
                {post.readingMinutes} min read
              </span>
              <time dateTime={post.datePublished} className="sg-note">
                {formatDate(post.datePublished)}
              </time>
            </div>

            <h1 className="sg-h2 mb-5">
              {post.title}
            </h1>

            <p className="sg-lede mb-7">
              {post.description}
            </p>

            {/* Author byline — authority signal for AI crawlers */}
            <div className="flex items-center gap-3 border-y border-[color:var(--sg-rule)] py-4">
              <div className="w-8 h-8 rounded-full bg-forest-100 dark:bg-forest-900/40 border border-forest-200 dark:border-forest-800 flex items-center justify-center shrink-0">
                <span className="text-forest-600 dark:text-forest-400 text-xs font-bold">IG</span>
              </div>
              <div>
                <p className="text-[0.9375rem] font-semibold">
                  <a href="/about" className="hover:text-[color:var(--sg-accent)]">{AUTHOR_BIO.name}</a>
                  {` · ${AUTHOR_BIO.role}`}
                </p>
                <p className="sg-small">
                  Science-based content on onychophagia and body-focused repetitive behaviors (BFRBs).
                  {post.dateModified !== post.datePublished && (
                    <> Updated <time dateTime={post.dateModified}>{formatDate(post.dateModified)}</time>.</>
                  )}
                </p>
              </div>
            </div>
          </header>

          {/* Article body */}
          <article className="mt-10">
            {post.sections.map((section, i) => (
              <section key={i} className="mb-10">
                <h2 className="mb-4 text-[1.5rem] font-extrabold leading-tight tracking-[-0.02em]">
                  {section.heading}
                </h2>

                {section.body.split('\n\n').map((para, j) => (
                  <p key={j} className="sg-body mb-4">
                    {para}
                  </p>
                ))}

                {section.list && section.list.length > 0 && (
                  <ul className="mt-3 space-y-3">
                    {section.list.map((item, k) => (
                      <li key={k} className="sg-body flex gap-3">
                        <span className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--sg-accent)]" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.html && (
                  <div
                    className="mt-4 overflow-x-auto blog-html-block"
                    dangerouslySetInnerHTML={{ __html: section.html }}
                  />
                )}
              </section>
            ))}
          </article>

          {/* CTA: the same offer and button as every other page. */}
          <div className="sg-page mt-14 flex flex-col items-start gap-4 rounded-2xl border border-[color:var(--sg-rule)] bg-white p-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="sg-h3">Try it free for 3 days.</p>
              <p className="sg-small mt-1">
                No card to start. Read{' '}
                <a href="/how-it-works" className="sg-link">how it works</a> or{' '}
                <a href="/pricing" className="sg-link">see pricing</a>.
              </p>
            </div>
            <TrialButton />
          </div>

          {/* Related articles — internal linking for SEO */}
          {related.length > 0 && (
            <section className="mt-14" aria-labelledby="related-heading">
              <h2 id="related-heading" className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-5">
                Related articles
              </h2>
              <div className="flex flex-col gap-3">
                {related.map(rel => (
                  <a
                    key={rel.slug}
                    href={`/blog/${rel.slug}`}
                    className="group flex items-start justify-between gap-4 rounded-xl border border-stone-200 dark:border-ink-400 bg-white dark:bg-ink-50 px-4 py-3 hover:border-forest-300 dark:hover:border-forest-700 hover:shadow-sm transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <span className={`${TAG_PILL} mb-1.5`}>
                        {rel.tag}
                      </span>
                      <p className="text-sm font-medium text-stone-700 dark:text-stone-200 leading-snug group-hover:text-forest-600 dark:group-hover:text-forest-400 transition-colors line-clamp-2">
                        {rel.title}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-stone-400 dark:text-stone-500 group-hover:text-forest-500 dark:group-hover:text-forest-400 mt-1 shrink-0 transition-colors" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </section>
          )}

          <AuthorBox />

          {/* Back link */}
          <div className="mt-10 text-center">
            <a
              href="/blog"
              className="inline-flex items-center gap-2 text-sm text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back to all articles
            </a>
          </div>
        </div>
      )}

      <div className="sg-page"><SiteFooter /></div>
    </div>
  );
}
