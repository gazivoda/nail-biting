import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { PageHero } from '../components/site/PageHero';
import { TrialButton } from '../components/site/TrialButton';
import { useTheme } from '../hooks/useTheme';
import { PAGE_MAP, type PageContent } from '../data/comparePages';
import { GATED_COMPARE_FLAG, isGatedComparePath } from '../data/gatedComparePaths';
import { refreshFlags } from '../features/flags';
import { useFeature } from '../features/useFeature';
import { useFlagCopy, useFlagIsOn } from '../features/useFlagCopy';
import { flagAwareDeep, mentionsFlagCopy } from '../../shared/flagCopy.js';
import { AuthorBox } from './EditorialPolicyPage';
import { TRIAL_DAYS_TEXT } from '../../shared/plans.js';

interface Props {
  path: string;
}

// Every ordinary compare/solutions page: no flag, no extra request, unchanged.
// The two competitor profile pages behind `compare_competitors` take the other
// branch, so only they ever read the flag or load their (unverified) copy.
export function ComparePage({ path }: Props) {
  if (isGatedComparePath(path)) return <FlaggedComparePage path={path} />;
  const getContent = PAGE_MAP[path];
  // Not one of the pages in this bundle: a feature page (WS11b), which exists only while its feature's
  // flag is on and is rendered from JSON the server resolves. Anything else the server says is not there.
  if (!getContent) return <ServerComparePage path={path} />;
  return <LocalComparePage path={path} content={getContent()} />;
}

// A page in this bundle renders as it always did, unless one of its sentences is one that changes with a
// feature flag (the NailBiteMenu comparison says what sign-in Stop Biting needs). Only such a page reads
// the flags, so every other page makes no request for them.
function LocalComparePage({ path, content }: Props & { content: PageContent }) {
  const follows = useMemo(() => mentionsFlagCopy(JSON.stringify(content)), [content]);
  return follows ? <FlagAwareComparePage path={path} content={content} /> : <ComparePageView path={path} content={content} />;
}

function FlagAwareComparePage({ path, content }: Props & { content: PageContent }) {
  const isOn = useFlagIsOn();
  const followed = useMemo(() => flagAwareDeep(content, isOn), [content, isOn]);
  return <ComparePageView path={path} content={followed} />;
}

// The copy of a feature page, already resolved for this server's flags and numbers. Read from the page's
// own HTML when the server put it there (no request, no flash), else asked for. Anything but a 200 is a 404.
function embeddedPage(path: string): PageContent | undefined {
  try {
    const text = document.getElementById('sb-page-data')?.textContent;
    if (!text) return undefined;
    const data = JSON.parse(text) as { path?: string; page?: PageContent };
    return data.path === path && data.page?.title ? data.page : undefined;
  } catch {
    return undefined;
  }
}

function ServerComparePage({ path }: Props) {
  const [content, setContent] = useState<PageContent | 'missing' | undefined>(() => embeddedPage(path));

  useEffect(() => {
    if (content) return;
    let live = true;
    fetch(`/page-data${path}.json`, { credentials: 'omit', headers: { Accept: 'application/json' } })
      .then(res => (res.ok ? (res.json() as Promise<PageContent>) : Promise.reject(new Error(String(res.status)))))
      .then(page => { if (live) setContent(page?.title ? page : 'missing'); })
      .catch(() => { if (live) setContent('missing'); });
    return () => { live = false; };
  }, [path, content]);

  if (!content) return null;
  return <ComparePageView path={path} content={content === 'missing' ? undefined : content} />;
}

// A flagged page does not exist until its flag is on: the 404 below until then.
// The server already answers 404 for these URLs while the flag is off, so this
// is the second lock (and the only one in `vite dev`, which has no server).
// The copy is a separate chunk, fetched only once the flag is known to be on.
function FlaggedComparePage({ path }: Props) {
  const on = useFeature(GATED_COMPARE_FLAG);
  const [settled, setSettled] = useState(false);
  const [content, setContent] = useState<PageContent | undefined>();

  // useFeature is false while the answer is unknown. Wait for the first answer
  // before showing a 404, or a visitor to a live page sees it flash.
  useEffect(() => {
    let live = true;
    void refreshFlags().finally(() => { if (live) setSettled(true); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!on) return;
    let live = true;
    void import('../data/competitorPages').then(m => { if (live) setContent(m.GATED_PAGE_MAP[path]?.()); });
    return () => { live = false; };
  }, [on, path]);

  if (on && content) return <ComparePageView path={path} content={content} />;
  if (settled && !on) return <ComparePageView path={path} content={undefined} />;
  return null;
}

export function ComparePageView({ path, content }: Props & { content: PageContent | undefined }) {
  useTheme('light');
  // The offer at the foot of the page names the Lifetime plan while it is for sale (shared/flagCopy.js); the trial button below
  // already reads the same flags, so this asks for nothing new.
  const copy = useFlagCopy();

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
  // Feature pages have no hub page to point at: Home / <the page>, as in their BreadcrumbList.
  const hasHub = !path.startsWith('/features/');

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">
      <div className="sg-page"><SiteHeader /></div>

      <main id="main" className="max-w-2xl mx-auto px-6 pt-28 pb-24">

        <PageHero className="mb-10 -mx-6 sm:-mx-0">
        <nav aria-label="Breadcrumb" className="sg-note mb-8 flex items-center gap-2">
          <a href="/" className="hover:text-[color:var(--sg-ink)]">Home</a>
          <span aria-hidden="true">/</span>
          {hasHub && (
            <>
              <a href={breadcrumbHref} className="hover:text-[color:var(--sg-ink)]">{breadcrumbLabel}</a>
              <span aria-hidden="true">/</span>
            </>
          )}
          <span className="truncate max-w-[200px] text-[color:var(--sg-ink)]">{content.title.split(':')[0]}</span>
        </nav>

        <header>
          <h1 className="sg-h2">{content.title}</h1>
          <p className="sg-lede mt-4">{content.subtitle}</p>
        </header>
        </PageHero>

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
                  role="region"
                  aria-label={`${section.heading}, scrolls sideways on small screens`}
                  tabIndex={0}
                  dangerouslySetInnerHTML={{ __html: section.html }}
                />
              )}
            </section>
          ))}
        </article>

        {/* The same offer and button as every other page. */}
        <div className="mb-14 flex flex-col items-start gap-4 rounded-2xl border border-[color:var(--sg-rule)] bg-white p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="sg-h3">A webcam alarm for nail biting.</p>
            <p className="sg-small mt-1 max-w-[46ch]">
              Stop Biting runs in your browser on a laptop or desktop and sounds an alarm when your
              hand moves toward your mouth. No camera data is sent while it runs. {TRIAL_DAYS_TEXT} free, no card,{' '}
              {copy('then $2.99 a month or $29 a year')}. Read{' '}
              <a href="/how-it-works" className="sg-link">how it works</a>.
            </p>
          </div>
          <TrialButton source="compare_page" />
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
