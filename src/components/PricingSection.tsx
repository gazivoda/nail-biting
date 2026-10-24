import { useEffect, useRef } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { track } from '../utils/track';
import { PRICE_IDS } from '../billing/env';
import { hasAll, useLocalizedPrices } from '../billing/prices';
import { LifetimeCard } from './billing/LifetimeCard';
import { useLifetimeOn } from '../billing/useLifetimeOn';
import { useT as useChromeT } from '../i18n/scopes/marketing-chrome';
import { useSiteBag, useSiteT } from '../i18n/marketing/useSite';

// The pricing block — shared verbatim by the landing page (#pricing anchor)
// and the dedicated /pricing page, so the two can never show different
// figures. Prices here MUST match the Offer schema and SSR prose that
// server.js injects for /pricing: $2.99/month, $29.00/year, free trial (shared/plans.js).
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

// The four lines of site/plans.ts (PLAN_FEATURES, shared with the in-app paywall), written through the catalog; a test
// pins that their English is exactly PLAN_FEATURES.
const FEATURE_KEYS = ['plan.f1', 'plan.f2', 'plan.f3', 'plan.f4'] as const;

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="space-y-2.5">
      {features.map(f => (
        <li key={f} className="sg-small flex items-center gap-2.5 text-[color:var(--sg-ink)]">
          <Check size={17} aria-hidden="true" className="flex-shrink-0 text-[color:var(--sg-accent)]" />
          {f}
        </li>
      ))}
    </ul>
  );
}

export function PricingSection({ headingAs: Heading = 'h2' }: { headingAs?: 'h1' | 'h2' }) {
  const t = useSiteT(useChromeT);
  const bag = useSiteBag();   // the list prices written for the language ($29.00 in English)
  const features = FEATURE_KEYS.map(key => t(key));
  // One aggregate event the first time the plans scroll into view, with the
  // page as its fixed label, so view-to-trial_click can be read per page.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        track('pricing_view', /\/pricing$/.test(window.location.pathname) ? 'pricing_page' : 'landing');
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // WS9 (flag regional_pricing): what Paddle will charge this visitor. Empty, and so the fixed prices
  // below, while the flag is off, when Paddle is not set up, and whenever anything goes wrong.
  const regional = useLocalizedPrices([PRICE_IDS.monthly, PRICE_IDS.yearly].filter(Boolean));
  const localized = hasAll(regional, [PRICE_IDS.monthly, PRICE_IDS.yearly]);
  // WS9 (flag lifetime_plan): the Lifetime plan is the third card of the same row. Off, the section is what it was.
  const lifetimeOn = useLifetimeOn();
  const priceLine = lifetimeOn ? 'mt-5 flex flex-wrap items-baseline gap-x-1.5' : 'mt-5 flex items-baseline gap-1.5';

  return (
    <section ref={ref} id="pricing" aria-labelledby="pricing-heading" className="sg-page">
      {/* Left-aligned on the page's edge like every other section: centred
          and narrower, it read as a template block pasted in. */}
      <div className="max-w-4xl">
        <Heading id="pricing-heading" className="sg-h2">{t.rich('pricing.heading', undefined, { mark: chunks => <span className="sg-mark">{chunks}</span> })}</Heading>
        <p className="sg-lede mt-4 max-w-2xl">
          {t('pricing.lede')}
        </p>
      </div>

      <div className={lifetimeOn ? 'mt-12 grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3' : 'mt-12 grid max-w-4xl gap-6 md:grid-cols-2'}>
        {/* ── Yearly: recommended ─────────────────────────────────────── */}
        <div className="sg-plate sg-dark relative flex flex-col !border-transparent !bg-[color:var(--sg-deep)] p-7 sm:p-9">
          <p className="absolute -top-3.5 left-7 rounded-full bg-[color:var(--sg-signal)] px-3 py-1 text-[0.8125rem] font-bold text-[color:var(--sg-deep)]">
            {localized ? t('pricing.badge.localized') : t('pricing.badge.save')}
          </p>
          <p className="sg-h3">{t('pricing.yearly')}</p>
          <p className={priceLine}>
            <span className="sg-figure">{localized ? regional[PRICE_IDS.yearly].total : String(bag.pYearly)}</span>
            <span className="sg-small">{t('pricing.perYear')}</span>
          </p>
          <p className="sg-small mt-2">{localized ? t('pricing.yearly.billed') : t('pricing.yearly.eq')}</p>
          <div className="mt-7 flex-1">
            <FeatureList features={[...features, t('plan.extra')]} />
          </div>
          <a
            href="/api/auth/google"
            target="_blank"
            rel="nofollow noopener noreferrer"
            onClick={() => track('trial_click', 'pricing_yearly')}
            className="sg-btn group mt-8 w-full"
          >
            {t('trial.start')}
            <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </a>
        </div>

        {/* ── Monthly ─────────────────────────────────────────────────── */}
        <div className="sg-plate flex flex-col p-7 sm:p-8">
          <p className="sg-h3">{t('pricing.monthly')}</p>
          <p className={priceLine}>
            <span className="sg-figure">{localized ? regional[PRICE_IDS.monthly].total : String(bag.pMonthly)}</span>
            <span className="sg-small">{t('pricing.perMonth')}</span>
          </p>
          <p className="sg-small mt-2">{t('pricing.monthly.billed')}</p>
          {/* Stacked on a phone, right under Yearly, the same four lines word
              for word cost about 150px and said nothing new. Side by side
              (md up) the full list is what makes the cards comparable. */}
          <p className="sg-small mt-7 flex-1 md:hidden">{t('pricing.monthly.short')}</p>
          <div className="mt-7 hidden flex-1 md:block">
            <FeatureList features={features} />
          </div>
          <a
            href="/api/auth/google"
            target="_blank"
            rel="nofollow noopener noreferrer"
            onClick={() => track('trial_click', 'pricing_monthly')}
            className="sg-btn sg-btn-ink group mt-8 w-full"
          >
            {t('trial.start')}
            <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </a>
        </div>

        {/* ── Lifetime (flag lifetime_plan): the third plate, marked as the best deal ── */}
        {lifetimeOn && <LifetimeCard featured className="md:col-span-2 lg:col-span-1" />}
      </div>

      {localized && (
        <p className="sg-small mt-6 max-w-4xl">
          {t('pricing.localizedNote')}
        </p>
      )}

      <p className="sg-small mt-8 max-w-4xl">
        {t.rich('pricing.payments', undefined, { link: chunks => <a href="/refund-policy" className="sg-link">{chunks}</a> })}
      </p>
    </section>
  );
}
