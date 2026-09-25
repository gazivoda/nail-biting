import { TrialButton } from './TrialButton';

// The site header for every page in the sign system (homepage, /pricing,
// /how-it-works, /about). Section links are in-page anchors on the homepage
// and absolute (/#section) everywhere else. Must sit inside a `.sg-page`.
export function SiteHeader({ onHome = false }: { onHome?: boolean }) {
  return (
    <nav
      aria-label="Site navigation"
      className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--sg-rule)] bg-[color:var(--sg-ground)]/90 backdrop-blur-md"
    >
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
          <a href="/blog" className="text-[0.9375rem] font-semibold text-[color:var(--sg-ink-2)] transition-colors hover:text-[color:var(--sg-ink)]">
            Blog
          </a>
        </div>
        <TrialButton size="sm" />
      </div>
    </nav>
  );
}
