import { ArrowRight } from 'lucide-react';

// The pricing block — shared verbatim by the landing page (#pricing anchor)
// and the dedicated /pricing page, so the two can never show different
// figures. Prices here MUST match the Offer schema and SSR prose that
// server.js injects for /pricing: $2.99/month, $29.00/year, 3-day free trial.
//
// Typeset in the editorial system the rest of the homepage uses (see the
// `/* ── Editorial system ── */` block in index.css). The two plans are
// hairline-ruled rows of one table rather than two competing cards: the
// rounded frames, the card shadows, the hover lift, the 2px forest border and
// the rounded "best value" pill are all gone. The yearly plan reads as the
// recommended one through position (it is first), through the forest accent on
// its name and saving, and through being the block's one filled button.
//
// `ed-page` is on the section, not on a page wrapper: it is what scopes
// `--ed-hairline` (so `border-hairline` resolves) and the editorial
// focus-visible ring. Landing already sets it on its root, but /pricing does
// not, and this component has to typeset identically on both.
//
// Both plan links are still `/api/auth/google` in a new tab, spelled out one
// by one rather than mapped over an array: these two anchors are the whole
// checkout entry surface, and writing them as real attributes keeps them
// greppable.

const MONTHLY_FEATURES = [
  'Unlimited AI detection',
  'Streak & habit tracking',
  'Full incident history',
  'All alert types',
];

const YEARLY_FEATURES = [
  'Unlimited AI detection',
  'Streak & habit tracking',
  'Full incident history',
  'All alert types',
  'Priority support',
];

// The terms that used to be a row of icon badges. They are apparatus, so they
// are set as a mono rule of hairline-separated terms, the same device the
// hero uses for what the app is.
const TRUST_TERMS = [
  'Secure payment via Paddle',
  'Cancel anytime',
  '3-day free trial',
  'No credit card required to start',
];

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="list-none border-t border-hairline">
      {features.map(f => (
        <li key={f} className="ed-body border-b border-hairline py-2.5 text-stone-600">
          {f}
        </li>
      ))}
    </ul>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="ed-page">
      {/* The old centred eyebrow is the label on the section rule now, so the
          string keeps its job instead of being repeated as a heading. */}
      <div className="reveal ed-mark text-stone-500">
        <span className="ed-mono flex-shrink-0">Pricing</span>
        <span className="ed-mark-rule ed-rule-draw" aria-hidden="true" />
      </div>

      <div className="mx-auto mt-10 max-w-2xl lg:mt-14">
        <h2 id="pricing-heading" className="reveal ed-h2 text-stone-800">
          Simple, honest pricing.
        </h2>
        <p className="reveal ed-lede ed-measure mt-5 text-stone-600" style={{ transitionDelay: '80ms' }}>
          Start with a 3-day free trial. No credit card required. Both plans start the same
          trial: you pick one when it ends.
        </p>

        <div className="mt-10 border-t border-hairline">

          {/* ── Yearly ────────────────────────────────────────────────────
              First by position, which is half of how it reads as the
              recommended plan. The other half is the forest accent on its
              name and saving, and the single filled button below. */}
          <div className="reveal-card border-b border-hairline py-9 sm:grid sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-x-10">
            <div>
              <p className="ed-mono text-forest-600">Yearly</p>
              <p className="ed-mono mt-2.5 text-stone-500">Billed once a year</p>
              <p className="ed-figure mt-6 text-forest-600">
                $29.00<span className="ed-mono text-stone-500">{' / year'}</span>
              </p>
              <p className="ed-mono mt-4 text-stone-500">$2.42/month, billed yearly</p>
              <p className="ed-mono mt-2 text-forest-600">Best value: save 19%</p>
            </div>

            <div className="mt-7 sm:mt-0">
              <FeatureList features={YEARLY_FEATURES} />
              <a
                href="/api/auth/google"
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-forest-600 px-6 py-3 ed-ui font-semibold text-cream-100 transition-colors duration-150 hover:bg-forest-500"
              >
                Start free trial
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="opacity-70 transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </a>
            </div>
          </div>

          {/* ── Monthly ───────────────────────────────────────────────────
              Same row, quieter typography: the plan name is stone rather
              than forest, and the call to action is outlined rather than
              filled. Same href, same target, same label.

              Outlined and not a bare text link on purpose. Yearly reads as
              recommended through position, the forest accent and the single
              filled button; that ranking does not require making the cheaper
              plan look unbuyable, and a text link next to a solid button
              reads as "not really an option". */}
          <div
            className="reveal-card border-b border-hairline py-9 sm:grid sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-x-10"
            style={{ transitionDelay: '80ms' }}
          >
            <div>
              <p className="ed-mono text-stone-800">Monthly</p>
              <p className="ed-mono mt-2.5 text-stone-500">Billed monthly</p>
              <p className="ed-figure mt-6 text-forest-600">
                $2.99<span className="ed-mono text-stone-500">{' / month'}</span>
              </p>
            </div>

            <div className="mt-7 sm:mt-0">
              <FeatureList features={MONTHLY_FEATURES} />
              <a
                href="/api/auth/google"
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl border border-forest-600 px-6 py-3 ed-ui font-semibold text-forest-600 transition-colors duration-150 hover:bg-forest-50"
              >
                Start free trial
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="opacity-70 transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </a>
            </div>
          </div>
        </div>

        {/* Terms, as apparatus rather than as badges. */}
        <ul className="reveal mt-8 flex flex-wrap items-center gap-y-2 text-stone-500">
          {TRUST_TERMS.map((term, i) => (
            <li key={term} className="flex items-center">
              <span className="ed-mono">{term}</span>
              {i < TRUST_TERMS.length - 1 && (
                <span className="mx-3 h-3 w-px bg-stone-300" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
