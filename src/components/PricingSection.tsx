import { ArrowRight, Check } from 'lucide-react';

// The pricing block — shared verbatim by the landing page (#pricing anchor)
// and the dedicated /pricing page, so the two can never show different
// figures. Prices here MUST match the Offer schema and SSR prose that
// server.js injects for /pricing: $2.99/month, $29.00/year, 3-day free trial.
//
// Set in the homepage's sign system (the `.sg-*` block in index.css): two
// plates side by side, the recommended yearly plan outlined in the blue of the
// "mandatory" signs and carrying the block's one filled button. `sg-page` is
// on the section itself so the tokens resolve on /pricing too, which does not
// wrap it in one.
//
// No `.reveal` classes: the homepage no longer runs the scroll-reveal hook, and
// a `.reveal` element nobody reveals stays at opacity 0.
//
// Both plan links are `/api/auth/google` in a new tab, spelled out one by one
// rather than mapped over an array: these two anchors are the whole checkout
// entry surface, and writing them as real attributes keeps them greppable.

const FEATURES = [
  'Unlimited AI detection',
  'Streak & habit tracking',
  'Full incident history',
  'All alert types',
];

const TRUST_TERMS = [
  'Secure payment via Paddle',
  'Cancel anytime',
  '3-day free trial',
  'No credit card required to start',
];

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="space-y-2.5">
      {features.map(f => (
        <li key={f} className="sg-small flex items-center gap-2.5 text-[color:var(--sg-ink)]">
          <Check size={17} aria-hidden="true" className="flex-shrink-0 text-[color:var(--sg-green)]" />
          {f}
        </li>
      ))}
    </ul>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="sg-page">
      <div className="mx-auto max-w-4xl text-center">
        <h2 id="pricing-heading" className="sg-h2">Simple, honest pricing.</h2>
        <p className="sg-lede mx-auto mt-4 max-w-2xl">
          Start with a 3-day free trial. No credit card required. Both plans start the same
          trial: you pick one when it ends.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
        {/* ── Yearly: recommended ─────────────────────────────────────── */}
        <div className="sg-plate relative flex flex-col p-7 shadow-[inset_0_0_0_2px_var(--sg-blue)] sm:p-8">
          <p className="absolute -top-3.5 left-7 rounded-[0.25rem] bg-[color:var(--sg-blue)] px-2.5 py-1 text-[0.8125rem] font-bold text-white">
            Best value: save 19%
          </p>
          <p className="sg-h3">Yearly</p>
          <p className="mt-5 flex items-baseline gap-1.5">
            <span className="sg-figure">$29.00</span>
            <span className="sg-small">/ year</span>
          </p>
          <p className="sg-small mt-2">$2.42/month, billed yearly</p>
          <div className="mt-7 flex-1">
            <FeatureList features={[...FEATURES, 'Priority support']} />
          </div>
          <a
            href="/api/auth/google"
            target="_blank"
            rel="noopener noreferrer"
            className="sg-btn group mt-8 w-full"
          >
            Start free trial
            <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </a>
        </div>

        {/* ── Monthly ─────────────────────────────────────────────────── */}
        <div className="sg-plate flex flex-col p-7 sm:p-8">
          <p className="sg-h3">Monthly</p>
          <p className="mt-5 flex items-baseline gap-1.5">
            <span className="sg-figure">$2.99</span>
            <span className="sg-small">/ month</span>
          </p>
          <p className="sg-small mt-2">Billed monthly</p>
          <div className="mt-7 flex-1">
            <FeatureList features={FEATURES} />
          </div>
          <a
            href="/api/auth/google"
            target="_blank"
            rel="noopener noreferrer"
            className="sg-btn sg-btn-ink group mt-8 w-full"
          >
            Start free trial
            <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>

      <ul className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-x-6 gap-y-2">
        {TRUST_TERMS.map(term => (
          <li key={term} className="sg-small flex items-center gap-2">
            <Check size={15} aria-hidden="true" className="text-[color:var(--sg-green)]" />
            {term}
          </li>
        ))}
      </ul>
    </section>
  );
}
