// Lifetime and gift on the /pricing page (flags lifetime_plan, gift_plan). Nothing renders while a flag
// is off, or when the matching Paddle price id was not given to the build, so with every flag off the
// page is what it was.
//
// Wording is plain and says exactly what is bought. No price is written here: the figure is what Paddle
// reports it will charge (src/billing/prices.ts), and "Price shown at checkout" when that cannot be read.

import { useState } from 'react';
import { ArrowRight, Gift } from 'lucide-react';
import { describeLength } from '../../billing/planLength';
import { useT } from '../../i18n/scopes/plans';
import { useSignInHref } from '../../auth/useSignInProviders';
import { PRICE_IDS } from '../../billing/env';
import { completedTransactionId, onPaddleEvent, openGiftCheckout, paddleAvailable } from '../../billing/paddleClient';
import { useLocalizedPrices } from '../../billing/prices';
import { useGiftDays } from '../../billing/useGiftInfo';
import { useFeature } from '../../features/useFeature';
import { track } from '../../utils/track';

export function PlanExtras() {
  const t = useT();
  const lifetimeOn = useFeature('lifetime_plan') && PRICE_IDS.lifetime !== '';
  const giftOn = useFeature('gift_plan') && PRICE_IDS.gift !== '' && paddleAvailable();
  if (!lifetimeOn && !giftOn) return null;
  return (
    <section aria-label={t('extras.label')} className="mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
      {lifetimeOn && <LifetimeBand />}
      {giftOn && <GiftBand />}
    </section>
  );
}

function LifetimeBand() {
  const t = useT();
  const signIn = useSignInHref();
  const prices = useLocalizedPrices([PRICE_IDS.lifetime], { always: true });
  const price = prices[PRICE_IDS.lifetime]?.total;
  return (
    <div className="sg-plate flex flex-col p-7 sm:p-8">
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

function PriceLine({ price }: { price: string | undefined }) {
  const t = useT();
  return (
    <p className="mt-4 flex items-baseline gap-1.5">
      {price ? <><span className="sg-figure">{price}</span><span className="sg-small">{t('lifetime.once')}</span></> : <span className="sg-small">{t('lifetime.priceAtCheckout')}</span>}
    </p>
  );
}

function GiftBand() {
  const days = useGiftDays();
  const prices = useLocalizedPrices([PRICE_IDS.gift], { always: true });
  const price = prices[PRICE_IDS.gift]?.total;
  const [state, setState] = useState<GiftState>('idle');

  async function buy() {
    setState('opening');
    const off = onPaddleEvent(event => {
      if (completedTransactionId(event) !== null) { off(); setState('done'); }
    });
    const opened = await openGiftCheckout(PRICE_IDS.gift);
    if (!opened) { off(); setState('failed'); } else setState('idle');
  }

  return <GiftBandView price={price} days={days} state={state} onBuy={buy} />;
}

export type GiftState = 'idle' | 'opening' | 'done' | 'failed';

/** What the gift card shows for each state of the purchase (the state itself lives in GiftBand). */
export function GiftBandView({ price, days, state, onBuy }: { price: string | undefined; days: number | null; state: GiftState; onBuy: () => void }) {
  const t = useT();
  return (
    <div className="sg-plate flex flex-col p-7 sm:p-8">
      <p className="sg-h3 flex items-center gap-2"><Gift size={20} aria-hidden="true" />{t('gift.title')}</p>
      <PriceLine price={price} />
      <p className="sg-small mt-3 flex-1">
        {days ? t('gift.body.length', { length: describeLength(days) }) : t('gift.body.plain')}
      </p>
      {state === 'done' && (
        <p role="status" className="sg-small mt-4 font-semibold text-[color:var(--sg-ink)]">
          {t('gift.thanks')}
        </p>
      )}
      {state === 'failed' && (
        <p role="alert" className="sg-small mt-4">
          {t('gift.failed')}
        </p>
      )}
      <button
        type="button"
        onClick={onBuy}
        disabled={state === 'opening'}
        className="sg-btn sg-btn-ink group mt-6 w-full disabled:opacity-60"
      >
        {t('gift.buy')}
        <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}
