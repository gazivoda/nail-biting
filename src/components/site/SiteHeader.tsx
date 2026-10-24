import { TrialButton } from './TrialButton';
import { LanguageSwitcher } from './LanguageSwitcher';
import { track } from '../../utils/track';
import { useSignInHref } from '../../auth/useSignInProviders';
import { useT as useChromeT } from '../../i18n/scopes/marketing-chrome';
import { useSitePaths } from '../../i18n/marketing/useSite';
import type { SitePage } from '../../i18n/marketing/routes';

// The site header for every page in the sign system (homepage, /pricing,
// /how-it-works, /about). Section links are in-page anchors on the homepage
// and absolute (/#section) everywhere else. Must sit inside a `.sg-page`.
// `page` names which of the four localized pages this is (WS12b): it lets the language
// switcher link to the same page in another language, and its absence (the blog) hides it.
export function SiteHeader({ onHome = false, current, page }: { onHome?: boolean; current?: 'blog'; page?: SitePage }) {
  // /api/auth/google until the owner turns another sign-in method on (src/auth/providers.ts).
  const signInHref = useSignInHref();
  const t = useChromeT();
  const paths = useSitePaths();
  const sections = [['how', t('nav.how')], ['science', t('nav.science')], ['privacy', t('nav.privacy')], ['pricing', t('nav.pricing')], ['faq', t('nav.faq')]] as const;
  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 top-0 z-50 bg-[color:var(--sg-ground)]"
    >
      {/* First focusable thing on every marketing page: past the nav, to the
          page's <main id="main">. Invisible until focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-[color:var(--sg-ink)]"
      >
        {t('nav.skip')}
      </a>
      <div className="sg-container flex h-16 items-center justify-between gap-4">
        <a href={paths.home} className="flex min-h-11 items-center gap-2.5">
          <img src="/logo.svg" alt="" className="h-8 w-8 flex-shrink-0" />
          {/* Below 360px the name and the trial button do not both fit on one
              line; the mark carries the brand there and the name stays in the
              link for screen readers. */}
          <span className="sr-only whitespace-nowrap font-display text-xl font-extrabold tracking-[-0.03em] min-[360px]:not-sr-only">Stop Biting</span>
        </a>
        <div className="hidden items-center gap-7 md:flex">
          {sections.map(([href, label]) => (
            <a key={href} href={`${onHome ? '' : paths.home}#${href}`} className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-[color:var(--sg-ink-2)] transition-colors hover:text-[color:var(--sg-ink)]">
              {label}
            </a>
          ))}
          <a
            href="/blog"
            aria-current={current === 'blog' ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center text-[0.9375rem] font-semibold transition-colors hover:text-[color:var(--sg-ink)] ${current === 'blog' ? 'text-[color:var(--sg-accent)]' : 'text-[color:var(--sg-ink-2)]'}`}
          >
            {t('nav.blog')}
          </a>
        </div>
        {/* Returning customers (new computer, expired session) need a way in
            that isn't "Start free trial". The same Google flow signs an
            existing account in. Hidden on phones: the app runs on a computer. */}
        <div className="flex items-center gap-5">
          <LanguageSwitcher page={page} variant="header" />
          <a href={signInHref} rel="nofollow" onClick={() => track('signin_click', 'header')} className="hidden min-h-11 items-center text-[0.9375rem] font-semibold text-[color:var(--sg-ink-2)] transition-colors hover:text-[color:var(--sg-ink)] sm:inline-flex">
            {t('nav.signin')}
          </a>
          <TrialButton size="sm" source="header" />
        </div>
      </div>
    </nav>
  );
}
