import { Zap, Star, Check, Shield } from 'lucide-react';

// The pricing cards — shared verbatim by the landing page (#pricing anchor)
// and the dedicated /pricing page, so the two can never show different
// figures. Prices here MUST match the Offer schema and SSR prose that
// server.js injects for /pricing: $2.99/month, $29.00/year, 3-day free trial.
export function PricingSection() {
  return (
    <section id="pricing" aria-labelledby="pricing-heading">
      <p className="reveal text-xs uppercase tracking-[0.2em] text-forest-600 dark:text-forest-400 text-center font-semibold">Pricing</p>
      <h2 id="pricing-heading" className="reveal text-2xl font-bold text-stone-800 dark:text-stone-100 text-center mt-2 tracking-tight">Simple, honest pricing.</h2>
      <p className="reveal text-stone-500 dark:text-stone-400 text-sm text-center mt-2">Start with a 3-day free trial. No credit card required.</p>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* Monthly */}
        <div className="reveal-card bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-7 flex flex-col shadow-card hover:-translate-y-1 hover:shadow-card-md transition-all duration-200">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-9 h-9 rounded-xl bg-forest-100 dark:bg-forest-800 flex items-center justify-center">
              <Zap size={16} className="text-forest-600 dark:text-forest-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">Monthly</p>
              <p className="text-xs text-stone-400 dark:text-stone-500">Billed monthly</p>
            </div>
          </div>
          <div className="mb-5">
            <span className="text-4xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">$2.99</span>
            <span className="text-stone-400 dark:text-stone-500 text-sm"> / month</span>
          </div>
          <ul className="space-y-2.5 mb-7 flex-1">
            {['Unlimited AI detection', 'Streak & habit tracking', 'Full incident history', 'All alert types'].map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                <Check size={13} className="text-forest-500 dark:text-forest-400 shrink-0" aria-hidden="true" />{f}
              </li>
            ))}
          </ul>
          <a
            href="/api/auth/google"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-stone-100 text-cream-100 dark:text-stone-900 font-semibold rounded-xl px-5 py-2.5 text-sm transition-all duration-150 hover:-translate-y-0.5"
          >
            Start free trial
          </a>
        </div>

        {/* Yearly */}
        <div className="reveal-card bg-white dark:bg-ink-50 border-2 border-forest-500 dark:border-forest-600 rounded-2xl p-7 flex flex-col shadow-card-md relative hover:-translate-y-1 hover:shadow-card-md transition-all duration-200" style={{ transitionDelay: '80ms' }}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-forest-600 text-cream-100 text-xs font-semibold px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
              Best value — save 19%
            </span>
          </div>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-9 h-9 rounded-xl bg-forest-100 dark:bg-forest-800 flex items-center justify-center">
              <Star size={16} className="text-forest-600 dark:text-forest-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">Yearly</p>
              <p className="text-xs text-stone-400 dark:text-stone-500">Billed once a year</p>
            </div>
          </div>
          <div className="mb-1">
            <span className="text-4xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">$29.00</span>
            <span className="text-stone-400 dark:text-stone-500 text-sm"> / year</span>
          </div>
          <p className="text-forest-600 dark:text-forest-400 text-xs mb-5 font-medium">Just $2.42/month</p>
          <ul className="space-y-2.5 mb-7 flex-1">
            {['Unlimited AI detection', 'Streak & habit tracking', 'Full incident history', 'All alert types', 'Priority support'].map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                <Check size={13} className="text-forest-500 dark:text-forest-400 shrink-0" aria-hidden="true" />{f}
              </li>
            ))}
          </ul>
          <a
            href="/api/auth/google"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-xl px-5 py-2.5 text-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_oklch(38%_0.12_148/0.4)]"
          >
            <Zap size={13} aria-hidden="true" />
            Start free trial
          </a>
        </div>
      </div>

      {/* Trust badges */}
      <div className="reveal flex flex-wrap items-center justify-center gap-6 mt-8 text-xs text-stone-400 dark:text-stone-500">
        <div className="flex items-center gap-1.5"><Shield size={11} aria-hidden="true" /><span>Secure payment via Paddle</span></div>
        <div className="flex items-center gap-1.5"><Check size={11} aria-hidden="true" /><span>Cancel anytime</span></div>
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-forest-500" aria-hidden="true" /><span>3-day free trial</span></div>
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-forest-500" aria-hidden="true" /><span>No credit card required to start</span></div>
      </div>
    </section>
  );
}
