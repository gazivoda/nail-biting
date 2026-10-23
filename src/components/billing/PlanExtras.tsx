// Lifetime and gift on the /pricing page (flags lifetime_plan, gift_plan). Nothing renders while a flag
// is off, or when the matching Paddle price id was not given to the build, so with every flag off the
// page is what it was.
//
// Wording is plain and says exactly what is bought. No price is written here: the figure is what Paddle
// reports it will charge (src/billing/prices.ts), and "Price shown at checkout" when that cannot be read.

import { useState } from 'react';
import { ArrowRight, Gift } from 'lucide-react';
import { describeDays } from '../../../shared/plans.js';
import { useSignInHref } from '../../auth/useSignInProviders';
import { PRICE_IDS } from '../../billing/env';
import { completedTransactionId, onPaddleEvent, openGiftCheckout, paddleAvailable } from '../../billing/paddleClient';
import { useLocalizedPrices } from '../../billing/prices';
import { useGiftDays } from '../../billing/useGiftInfo';
import { useFeature } from '../../features/useFeature';
import { track } from '../../utils/track';

export function PlanExtras() {
  const lifetimeOn = useFeature('lifetime_plan') && PRICE_IDS.lifetime !== '';
  const giftOn = useFeature('gift_plan') && PRICE_IDS.gift !== '' && paddleAvailable();
  if (!lifetimeOn && !giftOn) return null;
  return (
    <section aria-label="Other ways to buy" className="mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
      {lifetimeOn && <LifetimeBand />}
      {giftOn && <GiftBand />}
    </section>
  );
}

function LifetimeBand() {
  const signIn = useSignInHref();
  const prices = useLocalizedPrices([PRICE_IDS.lifetime], { always: true });
  const price = prices[PRICE_IDS.lifetime]?.total;
  return (
    <div className="sg-plate flex flex-col p-7 sm:p-8">
      <p className="sg-h3">Lifetime</p>
      <p className="mt-4 flex items-baseline gap-1.5">
        {price ? <><span className="sg-figure">{price}</span><span className="sg-small">once</span></> : <span className="sg-small">Price shown at checkout</span>}
      </p>
      <p className="sg-small mt-3 flex-1">
        Pay once instead of every month or year. It includes everything in the monthly plan, with no renewals,
        for as long as Stop Biting is offered. Start the free trial, then choose Lifetime in the app.
      </p>
      <a
        href={signIn}
        rel="nofollow"
        onClick={() => track('trial_click', 'pricing_lifetime')}
        className="sg-btn sg-btn-ink group mt-6 w-full"
      >
        Start free trial
        <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </a>
    </div>
  );
}

function GiftBand() {
  const days = useGiftDays();
  const prices = useLocalizedPrices([PRICE_IDS.gift], { always: true });
  const price = prices[PRICE_IDS.gift]?.total;
  const [state, setState] = useState<'idle' | 'opening' | 'done' | 'failed'>('idle');
  const length = days ? describeDays(days) : null;

  async function buy() {
    setState('opening');
    const off = onPaddleEvent(event => {
      if (completedTransactionId(event) !== null) { off(); setState('done'); }
    });
    const opened = await openGiftCheckout(PRICE_IDS.gift);
    if (!opened) { off(); setState('failed'); } else setState('idle');
  }

  return (
    <div className="sg-plate flex flex-col p-7 sm:p-8">
      <p className="sg-h3 flex items-center gap-2"><Gift size={20} aria-hidden="true" />Give it as a gift</p>
      <p className="mt-4 flex items-baseline gap-1.5">
        {price ? <><span className="sg-figure">{price}</span><span className="sg-small">once</span></> : <span className="sg-small">Price shown at checkout</span>}
      </p>
      <p className="sg-small mt-3 flex-1">
        Buy {length ? length : 'access'} of Stop Biting for someone else. We email you a link to pass on. They sign in,
        open it and redeem it once. The gift starts when no trial or subscription is covering them.
      </p>
      {state === 'done' && (
        <p role="status" className="sg-small mt-4 font-semibold text-[color:var(--sg-ink)]">
          Thank you. The gift link is being emailed to the address you paid with. It can take a few minutes.
        </p>
      )}
      {state === 'failed' && (
        <p role="alert" className="sg-small mt-4">
          Checkout could not load. If you use an ad blocker, allow paddle.com for this site and reload, or email hello@stopbiting.today.
        </p>
      )}
      <button
        type="button"
        onClick={buy}
        disabled={state === 'opening'}
        className="sg-btn sg-btn-ink group mt-6 w-full disabled:opacity-60"
      >
        Buy a gift
        <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}
