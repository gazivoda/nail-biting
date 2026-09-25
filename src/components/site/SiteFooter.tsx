// The site footer for every page in the sign system. Must sit inside a `.sg-page`.
export function SiteFooter() {
  return (
    <footer className="border-t border-[color:var(--sg-rule)] bg-[color:var(--sg-plate)] py-14">
      <div className="sg-container">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="" className="h-7 w-7 flex-shrink-0" />
              <span className="text-lg font-extrabold tracking-tight">Stop Biting</span>
            </div>
            <p className="sg-small mt-4">
              An awareness alarm for nail biting (onychophagia), made by{' '}
              <a href="/about" className="sg-link">Igor Gazivoda</a>. Detection runs in your browser
              and nothing is uploaded.
            </p>
          </div>
          {/* Written out one by one: these eight hrefs are the site's whole
              legal and navigational surface, and spelling them as real
              attributes keeps them greppable. */}
          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-10 text-[0.9375rem] font-semibold text-[color:var(--sg-ink-2)]">
            <a href="/" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Home</a>
            <a href="/blog" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Blog</a>
            <a href="/#pricing" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Pricing</a>
            <a href="mailto:hello@stopbiting.today" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Contact</a>
            <a href="/editorial-policy" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Editorial Policy</a>
            <a href="/privacy" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Privacy Policy</a>
            <a href="/terms-and-conditions" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Terms of Service</a>
            <a href="/refund-policy" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">Refund Policy</a>
          </nav>
        </div>
        <p className="sg-small mt-10 border-t border-[color:var(--sg-rule)] pt-6">
          © {new Date().getFullYear()} Stop Biting.{' '}
          <a href="https://stopbiting.today/" className="inline-flex min-h-11 items-center hover:text-[color:var(--sg-ink)]">stopbiting.today</a>
        </p>
      </div>
    </footer>
  );
}
