import { useEffect } from 'react';
import { ArrowLeft, Clock, BookOpen, ArrowRight } from 'lucide-react';
import { BLOG_POSTS, getPost } from '../data/blogPosts';

interface Props {
  slug: string;
}

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Return up to 3 related posts: same tag first, then others, excluding current
function getRelated(currentSlug: string, currentTag: string) {
  const sameTag = BLOG_POSTS.filter(p => p.slug !== currentSlug && p.tag === currentTag);
  const others  = BLOG_POSTS.filter(p => p.slug !== currentSlug && p.tag !== currentTag);
  return [...sameTag, ...others].slice(0, 3);
}

export function BlogPost({ slug }: Props) {
  const post = getPost(slug);
  const canonicalUrl = `https://stopbiting.today/blog/${slug}`;
  const related = post ? getRelated(slug, post.tag) : [];

  // Inject JSON-LD BlogPosting + BreadcrumbList schemas + update meta tags client-side
  // (server already injects correct title/description/canonical in initial HTML)
  useEffect(() => {
    if (!post) return;

    const blogPosting = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.datePublished,
      dateModified: post.dateModified,
      author: {
        '@type': 'Organization',
        name: 'Stop Biting Editorial Team',
        url: 'https://stopbiting.today',
        description: 'Science-based editorial team covering onychophagia, body-focused repetitive behaviors (BFRBs), and habit reversal training.',
        knowsAbout: ['onychophagia', 'nail biting', 'body-focused repetitive behaviors', 'habit reversal training', 'BFRB treatment'],
      },
      publisher: {
        '@type': 'Organization',
        name: 'Stop Biting',
        url: 'https://stopbiting.today',
        logo: {
          '@type': 'ImageObject',
          url: 'https://stopbiting.today/icons/icon-512x512.png',
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl,
      },
      url: canonicalUrl,
      keywords: post.tag,
      timeRequired: `PT${post.readingMinutes}M`,
      inLanguage: 'en',
      isAccessibleForFree: true,
    };

    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://stopbiting.today/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Blog',
          item: 'https://stopbiting.today/blog',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: post.title,
          item: canonicalUrl,
        },
      ],
    };

    document.getElementById('blog-post-schema')?.remove();
    document.getElementById('blog-breadcrumb-schema')?.remove();

    const postScript = document.createElement('script');
    postScript.id = 'blog-post-schema';
    postScript.type = 'application/ld+json';
    postScript.textContent = JSON.stringify(blogPosting);
    document.head.appendChild(postScript);

    const crumbScript = document.createElement('script');
    crumbScript.id = 'blog-breadcrumb-schema';
    crumbScript.type = 'application/ld+json';
    crumbScript.textContent = JSON.stringify(breadcrumb);
    document.head.appendChild(crumbScript);

    const prevTitle = document.title;
    document.title = `${post.title} | Stop Biting`;

    let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const prevCanonical = canonicalEl?.href ?? '';
    if (canonicalEl) canonicalEl.href = canonicalUrl;

    return () => {
      document.getElementById('blog-post-schema')?.remove();
      document.getElementById('blog-breadcrumb-schema')?.remove();
      document.title = prevTitle;
      if (canonicalEl) canonicalEl.href = prevCanonical;
    };
  }, [post, canonicalUrl]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [slug]);

  return (
    <div className="min-h-dvh bg-cream-100 text-stone-800">

      {/* Nav */}
      <nav aria-label="Site navigation" className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-cream-100/90 backdrop-blur-md border-b border-stone-200">
        <a href="/" className="text-sm font-semibold text-stone-800 tracking-tight">Stop Biting</a>
        <div className="flex items-center gap-6">
          <a href="/blog" className="flex items-center gap-1.5 text-stone-500 hover:text-stone-800 text-sm transition-colors">
            <BookOpen size={14} aria-hidden="true" />
            Blog
          </a>
          <a href="/" className="text-sm font-semibold text-stone-500 hover:text-stone-800 transition-colors">
            Launch App
          </a>
        </div>
      </nav>

      {/* 404 */}
      {!post && (
        <div className="flex flex-col items-center justify-center min-h-dvh gap-4 text-center px-6">
          <p className="text-6xl font-bold text-stone-300">404</p>
          <p className="text-stone-500">Article not found.</p>
          <a href="/blog" className="mt-2 inline-flex items-center gap-2 text-forest-600 hover:text-forest-500 text-sm">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to blog
          </a>
        </div>
      )}

      {/* Article */}
      {post && (
        <div className="max-w-2xl mx-auto px-6 pt-28 pb-24">

          {/* Breadcrumb nav */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-stone-400 mb-8">
            <a href="/" className="hover:text-stone-600 transition-colors">Home</a>
            <span aria-hidden="true">/</span>
            <a href="/blog" className="hover:text-stone-600 transition-colors">Blog</a>
            <span aria-hidden="true">/</span>
            <span className="text-stone-500 truncate max-w-[200px]">{post.tag}</span>
          </nav>

          {/* Article header */}
          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${tagClass(post.tag)}`}>
                {post.tag}
              </span>
              <span className="flex items-center gap-1 text-xs text-stone-400">
                <Clock size={11} aria-hidden="true" />
                {post.readingMinutes} min read
              </span>
              <time dateTime={post.datePublished} className="text-xs text-stone-400">
                {formatDate(post.datePublished)}
              </time>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-800 leading-tight mb-4">
              {post.title}
            </h1>

            <p className="text-lg text-stone-500 leading-relaxed mb-6">
              {post.description}
            </p>

            {/* Author byline — authority signal for AI crawlers */}
            <div className="flex items-center gap-3 py-4 border-t border-b border-stone-200">
              <div className="w-8 h-8 rounded-full bg-forest-100 border border-forest-200 flex items-center justify-center shrink-0">
                <span className="text-forest-600 text-xs font-bold">SB</span>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-700">Stop Biting Editorial Team</p>
                <p className="text-xs text-stone-400">
                  Science-based content on onychophagia and body-focused repetitive behaviors (BFRBs).
                  {post.dateModified !== post.datePublished && (
                    <> Updated <time dateTime={post.dateModified}>{formatDate(post.dateModified)}</time>.</>
                  )}
                </p>
              </div>
            </div>
          </header>

          <hr className="border-stone-200 mb-10" />

          {/* Article body */}
          <article>
            {post.sections.map((section, i) => (
              <section key={i} className="mb-10">
                <h2 className="text-xl font-semibold text-stone-800 mb-4 leading-snug">
                  {section.heading}
                </h2>

                {section.body.split('\n\n').map((para, j) => (
                  <p key={j} className="text-stone-600 leading-relaxed mb-4 text-[15px]">
                    {para}
                  </p>
                ))}

                {section.list && section.list.length > 0 && (
                  <ul className="mt-3 space-y-3">
                    {section.list.map((item, k) => (
                      <li key={k} className="flex gap-3 text-[15px] text-stone-600 leading-relaxed">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-forest-500 shrink-0" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </article>

          {/* CTA */}
          <div className="mt-14 rounded-2xl bg-forest-50 border border-forest-200 p-8 text-center">
            <p className="text-stone-500 text-sm mb-1">Ready to start tracking?</p>
            <p className="text-stone-800 font-semibold text-xl mb-5">Try Stop Biting — free to start</p>
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-xl px-6 py-3 text-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_oklch(38%_0.12_148/0.35)] active:scale-95"
            >
              Launch App
            </a>
          </div>

          {/* Related articles — internal linking for SEO */}
          {related.length > 0 && (
            <section className="mt-14" aria-labelledby="related-heading">
              <h2 id="related-heading" className="text-lg font-semibold text-stone-800 mb-5">
                Related articles
              </h2>
              <div className="flex flex-col gap-3">
                {related.map(rel => (
                  <a
                    key={rel.slug}
                    href={`/blog/${rel.slug}`}
                    className="group flex items-start justify-between gap-4 rounded-xl border border-stone-200 bg-white px-4 py-3 hover:border-forest-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border mb-1.5 ${tagClass(rel.tag)}`}>
                        {rel.tag}
                      </span>
                      <p className="text-sm font-medium text-stone-700 leading-snug group-hover:text-forest-600 transition-colors line-clamp-2">
                        {rel.title}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-stone-400 group-hover:text-forest-500 mt-1 shrink-0 transition-colors" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Back link */}
          <div className="mt-10 text-center">
            <a
              href="/blog"
              className="inline-flex items-center gap-2 text-sm text-stone-400 hover:text-stone-600 transition-colors"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back to all articles
            </a>
          </div>
        </div>
      )}

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
