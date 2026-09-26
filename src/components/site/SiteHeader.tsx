import { TrialButton } from './TrialButton';

// The site header for every page in the sign system (homepage, /pricing,
// /how-it-works, /about). Section links are in-page anchors on the homepage
// and absolute (/#section) everywhere else. Must sit inside a `.sg-page`.
export function SiteHeader({ onHome = false, current }: { onHome?: boolean; current?: 'blog' }) {
  return (
    <nav
      aria-label="Site navigation"
      className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--sg-rule)] bg-[color:var(--sg-ground)]/90 backdrop-blur-md"
    >
      {/* First focusable thing on every marketing page: past the nav, to the
          page's <main id="main">. Invisible until focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-[color:var(--sg-ink)]"
      >
        Skip to content
      </a>
      <div className="sg-container flex h-16 items-center justify-between gap-4">
        <a href="/" className="flex min-h-11 items-center gap-2.5">
          <img src="/logo.svg" alt="" className="h-7 w-7 flex-shrink-0" />
          <span className="text-lg font-extrabold tracking-tight">Stop Biting</span>
        </a>
        <div className="hidden items-center gap-7 md:flex">
          {([['how', 'How to start'], ['science', 'Science'], ['privacy', 'Privacy'], ['pricing', 'Pricing'], ['faq', 'FAQ']] as const).map(([href, label]) => (
            <a key={href} href={`${onHome ? '' : '/'}#${href}`} className="text-[0.9375rem] font-semibold text-[color:var(--sg-ink-2)] transition-colors hover:text-[color:var(--sg-ink)]">
              {label}
            </a>
          ))}
          <a
            href="/blog"
            aria-current={current === 'blog' ? 'page' : undefined}
            className={`text-[0.9375rem] font-semibold transition-colors hover:text-[color:var(--sg-ink)] ${current === 'blog' ? 'text-[color:var(--sg-accent)]' : 'text-[color:var(--sg-ink-2)]'}`}
          >
            Blog
          </a>
        </div>
        {/* Returning customers (new computer, expired session) need a way in
            that isn't "Start free trial". The same Google flow signs an
            existing account in. Hidden on phones: the app runs on a computer. */}
        <div className="flex items-center gap-5">
          <a href="/api/auth/google" className="hidden min-h-11 items-center text-[0.9375rem] font-semibold text-[color:var(--sg-ink-2)] transition-colors hover:text-[color:var(--sg-ink)] sm:inline-flex">
            Sign in
          </a>
          <TrialButton size="sm" />
        </div>
      </div>
    </nav>
  );
}
