// The Lifetime plan card (flag lifetime_plan) and the price line it shares with the gift card.
//
// It sits in the same grid as Yearly and Monthly in PricingSection, so the three plans read as one row, and carries
// the same lime badge as the yearly plate. Nothing renders while the flag is off or when the Paddle price id was not
// given to the build, so with the flag off the pricing section is exactly what it was.
//
// Kept in its own file, away from PlanExtras (gift checkout, Paddle client), because PricingSection is in the main
// bundle of the landing page: this card only needs the small "plans" catalog scope.

import { ArrowRight } from 'lucide-react';
import { useT } from '../../i18n/scopes/plans';
import { useSignInHref } from '../../auth/useSignInProviders';
import { PRICE_IDS } from '../../billing/env';
import { useLocalizedPrices } from '../../billing/prices';
import { track } from '../../utils/track';

export function PriceLine({ price }: { price: string | undefined }) {
  const t = useT();
  return (
    <p className="mt-4 flex items-baseline gap-1.5">
      {price ? <><span className="sg-figure">{price}</span><span className="sg-small">{t('lifetime.once')}</span></> : <span className="sg-small">{t('lifetime.priceAtCheckout')}</span>}
    </p>
  );
}

/** `featured` adds the "Best deal" badge; `className` lets the grid place the card (it spans both columns on a tablet). */
export function LifetimeCard({ featured = false, className = '' }: { featured?: boolean; className?: string }) {
  const t = useT();
  const signIn = useSignInHref();
  const prices = useLocalizedPrices([PRICE_IDS.lifetime], { always: true });
  const price = prices[PRICE_IDS.lifetime]?.total;
  return (
    <div className={`sg-plate flex flex-col p-7 sm:p-8${featured ? ' relative' : ''}${className ? ` ${className}` : ''}`}>
      {featured && (
        <p className="absolute -top-3.5 left-7 rounded-full bg-[color:var(--sg-signal)] px-3 py-1 text-[0.8125rem] font-bold text-[color:var(--sg-deep)]">
          {t('lifetime.badge')}
        </p>
      )}
      <p className="sg-h3">{t('plan.lifetime')}</p>
      <PriceLine price={price} />
      <p className="sg-small mt-3 flex-1">
        {t('lifetime.band.body')}
      </p>
      <a
        href={signIn}
        rel="nofollow"
        onClick={() => track('trial_click', 'pricing_lifetime')}
        className="sg-btn sg-btn-ink group mt-6 w-full"
      >
        {t('lifetime.band.cta')}
        <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </a>
    </div>
  );
}
