import { useState, useEffect, useCallback, useRef } from 'react';
import { initializePaddle, type Paddle, type CheckoutEventsData } from '@paddle/paddle-js';
import { Check, Shield, ArrowLeft, AlertTriangle, ArrowRight } from 'lucide-react';
import { trialLeft, trialEndedMessage } from '../../utils/trial';
import { useAppStore } from '../../store/useAppStore';
import { isAlarmOrBite } from '../../storage/eventModel';
import { apiFetch, useAuth } from '../../contexts/AuthContext';
import { PLAN_FEATURES, YEARLY_EXTRA } from '../site/plans';
import { Rings } from '../site/Rings';
import { PRICE_IDS } from '../../billing/env';
import { hasAll, useLocalizedPrices } from '../../billing/prices';
import { useGiftDays } from '../../billing/useGiftInfo';
import { useFeature } from '../../features/useFeature';
import { LifetimePlate } from '../billing/LifetimePlate';
import { describeLength, planFeature } from '../../billing/planLabel';
import { useT } from '../../i18n/scopes/billing';
import { formatCurrency } from '../../i18n/format';

interface Props {
  onBack?: () => void;
}

const PADDLE_CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string;
const PRICE_MONTHLY = import.meta.env.VITE_PADDLE_PRICE_ID_MONTHLY as string;
const PRICE_YEARLY = import.meta.env.VITE_PADDLE_PRICE_ID_YEARLY as string;
const PADDLE_ENV = (import.meta.env.VITE_PADDLE_ENV || 'production') as 'production' | 'sandbox';

// The list prices the fixed (not localized) figures are built from: $2.99 a month, $29 a year, $2.42 a month when billed yearly.
const LIST_MONTHLY = 2.99;
const LIST_YEARLY = 29;
const LIST_YEARLY_PER_MONTH = 2.42;

export function PaywallPage({ onBack }: Props) {
  const t = useT();
  // Hooks first: the 'Payment received' early return below must not skip one.
  // What the trial actually logged on this device (local history, never a server figure).
  const loggedAlerts = useAppStore(s => s.incidents.filter(isAlarmOrBite).length); // not an urge, not a "Not a bite"
  const { user, refreshProfile, signOut } = useAuth();
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<'checkout_unavailable' | null>(null);
  const [success, setSuccess] = useState(false);
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // WS9: lifetime, gift and localized prices. Every one of these is inert while its flag is off.
  const lifetimeOn = useFeature('lifetime_plan') && PRICE_IDS.lifetime !== '';
  const lifetimeRef = useRef(false);   // read by the checkout callback, which is created once
  useEffect(() => { lifetimeRef.current = lifetimeOn; }, [lifetimeOn]);
  const giftOn = useFeature('gift_plan') && PRICE_IDS.gift !== '';
  const lastPriceRef = useRef('');
  const [giftSent, setGiftSent] = useState(false);
  const giftDays = useGiftDays();
  const regional = useLocalizedPrices([PRICE_MONTHLY, PRICE_YEARLY].filter(Boolean), { paddle });
  const localized = hasAll(regional, [PRICE_MONTHLY, PRICE_YEARLY]);
  const lifetimePrice = useLocalizedPrices(lifetimeOn ? [PRICE_IDS.lifetime] : [], { paddle, always: true })[PRICE_IDS.lifetime]?.total;

  const plansConfigured = !!(PRICE_MONTHLY && PRICE_YEARLY && PADDLE_CLIENT_TOKEN);

  // Initialize Paddle SDK
  useEffect(() => {
    if (!PADDLE_CLIENT_TOKEN) return;
    const emailAtInit = user?.email;
    initializePaddle({
      token: PADDLE_CLIENT_TOKEN,
      environment: PADDLE_ENV,
      pwCustomer: emailAtInit ? { email: emailAtInit } : undefined,
      eventCallback: (event) => {
        if (event.name === 'checkout.completed') {
          // checkout.completed provides transaction_id, not subscription_id.
          // The server will look up the transaction to find the subscription.
          const txId = (event.data as CheckoutEventsData | undefined)?.transaction_id ?? null;
          // WS9: a gift is for someone else; the buyer's own plan does not change.
          if (lastPriceRef.current !== '' && lastPriceRef.current === PRICE_IDS.gift) { setGiftSent(true); return; }
          handleCheckoutComplete(txId);
        }
      },
    })
      // Paddle's script is blocked by some ad blockers and can fail on a bad
      // connection. The Subscribe buttons wait on it, so say why they are
      // disabled instead of leaving them greyed out forever.
      .then((paddleInstance) => {
        if (paddleInstance) setPaddle(paddleInstance);
        else setError('checkout_unavailable');
      })
      .catch(() => setError('checkout_unavailable'));
  }, []);

  // When success screen is shown, poll refreshProfile until App.tsx transitions away.
  // This handles PayPal (and other async) payments where the webhook arrives after
  // the first refreshProfile() call.
  useEffect(() => {
    if (!success) return;
    pollRef.current = setInterval(() => { refreshProfile(); }, 3000);
    const timeout = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
    }, 90_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearTimeout(timeout);
    };
  }, [success, refreshProfile]);

  const handleCheckoutComplete = useCallback(async (transactionId: string | null) => {
    setActivating(true);
    setError(null);
    try {
      if (transactionId) {
        // Verify via transaction ID — server looks up the subscription from Paddle API
        await apiFetch('/api/paddle/verify-subscription', {
          method: 'POST',
          body: JSON.stringify({ transactionId }),
        });
      }
      // WS9: a lifetime payment has no subscription to verify; the webhook grants it, and this asks the
      // server to check the payment now instead of waiting. Best effort: the webhook still does it.
      if (lifetimeRef.current && transactionId) {
        await apiFetch('/api/billing/verify-transaction', { method: 'POST', body: JSON.stringify({ transactionId }) }).catch(() => undefined);
      }
      // Wait briefly for webhook to process, then refresh
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refreshProfile();
      setSuccess(true);
    } catch {
      // Webhook may still process — try refreshing after a delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      await refreshProfile();
      setSuccess(true);
    } finally {
      setActivating(false);
    }
  }, [refreshProfile]);

  const openCheckout = (priceId: string) => {
    if (!paddle) return;
    setError(null);
    lastPriceRef.current = priceId;

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: user?.email ? { email: user.email } : undefined,
      customData: { userId: user?.id || '' },
    });
  };

  if (success) return <PaymentReceived onOpen={() => refreshProfile()} />;

  const trialLeftText = trialLeft(user?.trial_end_date);

  const isTrialExpired = !onBack;

  return (
    <div className="min-h-dvh bg-cream-100 dark:bg-ink-100 text-stone-800 dark:text-stone-200 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="w-7 h-7 flex-shrink-0 dark:hidden" />
          <img src="/logo-dark.svg" alt="" className="hidden w-7 h-7 flex-shrink-0 dark:block" />
          <span className="font-display text-lg font-extrabold tracking-[-0.03em] text-stone-900 dark:text-stone-100">Stop Biting</span>
        </div>
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="flex min-h-11 items-center gap-1.5 px-2 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-800 dark:hover:text-stone-100 transition-colors">
              <ArrowLeft size={14} />
              {t('paywall.backToApp')}
            </button>
          )}
          <button onClick={signOut} className="min-h-11 px-2 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-800 dark:hover:text-stone-100 transition-colors">
            {t('paywall.signOut')}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-12">
        {/* Trial expired notice */}
        {isTrialExpired && (
          <div className="mb-6 flex w-full max-w-4xl items-center gap-2.5 rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm text-stone-600 dark:border-ink-400 dark:bg-ink-50 dark:text-stone-300">
            <AlertTriangle size={14} aria-hidden="true" className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{trialEndedMessage(loggedAlerts)}</span>
          </div>
        )}

        <div className="sg-hero sg-dark bite relative mb-10 flex w-full max-w-4xl flex-col items-start overflow-hidden p-7 sm:p-10 lg:p-14">
        <Rings className="-bottom-72 -right-60 h-[40rem] w-[40rem]" />
        <h1 className="sg-h1-md relative mb-5 max-w-[14ch] pr-6">
          {t.rich(onBack ? 'paywall.title.choose' : 'paywall.title.keep', {}, { hl: c => <span className="sg-hl">{c}</span> })}
        </h1>
        <p className="sg-lede relative max-w-md">
          {t('paywall.lede', { monthly: formatCurrency(LIST_MONTHLY), yearly: formatCurrency(LIST_YEARLY) })}
        </p>
        {/* Mid-trial, the free days left are the first thing to know, not a
            footnote under the fold on a phone. */}
        {onBack && trialLeftText && (
          <p className="relative mt-5 inline-flex min-h-8 items-center rounded-full border border-white/25 px-4 text-sm font-semibold text-white">
            {t('paywall.trialLeft', { left: trialLeftText })}
          </p>
        )}
        </div>

        {!plansConfigured && <PlansUnavailable />}

        {activating && <ActivatingNotice />}

        {/* Above the plans: it explains why their buttons are disabled, and on
            a phone the space below them is two screens down. */}
        {error && <CheckoutProblem />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {/* Yearly first at every width, as on /pricing. */}
          <div className="sg-dark relative flex flex-col rounded-2xl bg-deep p-7 text-white dark:bg-deep-2 sm:p-9">
            <p className="absolute -top-3.5 left-7 rounded-full bg-lime-300 px-3 py-1 text-[0.8125rem] font-bold text-deep">
              {localized ? t('paywall.badge.localized') : t('paywall.badge.save')}
            </p>
            <div className="mb-4">
              <p className="sg-h3">{t('paywall.yearly')}</p>
            </div>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="sg-figure">{localized ? regional[PRICE_YEARLY].total : formatCurrency(LIST_YEARLY, 'USD', { keepCents: true })}</span>
              <span className="sg-small">{t('paywall.perYear')}</span>
            </p>
            <p className="sg-small mt-2">{localized ? t('paywall.billedYearly') : t('paywall.perMonthBilledYearly', { price: formatCurrency(LIST_YEARLY_PER_MONTH) })}</p>
            <ul className="mt-7 mb-8 flex-1 space-y-2.5">
              {[...PLAN_FEATURES, YEARLY_EXTRA].map(f => (
                <li key={f} className="sg-small flex items-center gap-2.5 !text-white">
                  <Check size={17} aria-hidden="true" className="shrink-0 text-lime-300" />{planFeature(f)}
                </li>
              ))}
            </ul>
            {plansConfigured && (
              <button
                disabled={activating || !paddle}
                onClick={() => openCheckout(PRICE_YEARLY)}
                className="sg-btn group w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('paywall.subscribeYearly')}
                <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
          {/* Monthly */}
          <div className="flex flex-col rounded-2xl border border-stone-200 bg-white p-7 dark:border-ink-400 dark:bg-ink-50 sm:p-9">
            <div className="mb-4">
              <p className="sg-h3 text-stone-900 dark:text-stone-100">{t('paywall.monthly')}</p>
            </div>
            <p className="mt-1 flex items-baseline gap-1.5 text-stone-900 dark:text-stone-100">
              <span className="sg-figure">{localized ? regional[PRICE_MONTHLY].total : formatCurrency(LIST_MONTHLY)}</span>
              <span className="text-sm text-stone-600 dark:text-stone-300">{t('paywall.perMonth')}</span>
            </p>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">{t('paywall.billedMonthly')}</p>
            <ul className="mt-7 mb-8 flex-1 space-y-2.5">
              {PLAN_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-[0.9375rem] leading-[1.55] text-stone-700 dark:text-stone-300">
                  <Check size={17} aria-hidden="true" className="text-forest-500 dark:text-forest-400 shrink-0" />{planFeature(f)}
                </li>
              ))}
            </ul>
            {plansConfigured && (
              <button
                disabled={activating || !paddle}
                onClick={() => openCheckout(PRICE_MONTHLY)}
                className="sg-btn group w-full !bg-transparent border-2 border-stone-900 text-stone-900 dark:border-stone-200 hover:!bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:text-stone-100 dark:hover:!bg-stone-200 dark:hover:text-stone-900"
              >
                {t('paywall.subscribeMonthly')}
                <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
              </button>
            )}
          </div>

        </div>

        {lifetimeOn && (
          <LifetimePlate
            price={lifetimePrice}
            disabled={activating || !paddle}
            onBuy={() => openCheckout(PRICE_IDS.lifetime)}
          />
        )}

        {localized && (
          <p className="mt-6 w-full max-w-4xl text-sm text-stone-600 dark:text-stone-300">
            {t('paywall.localCurrency', { monthly: formatCurrency(LIST_MONTHLY), yearly: formatCurrency(LIST_YEARLY) })}
          </p>
        )}

        {giftSent && <GiftThanks />}

        {giftOn && paddle && plansConfigured && <GiftButton days={giftDays} onBuy={() => openCheckout(PRICE_IDS.gift)} />}

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-10 text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-1.5"><Shield size={11} /><span>{t('paywall.secure')}</span></div>
          <div className="flex items-center gap-1.5"><Check size={11} /><span>{t('paywall.cancel')}</span></div>
          <div className="flex items-center gap-1.5"><Check size={11} /><span>{t('paywall.noCamera')}</span></div>
        </div>

      </main>
    </div>
  );
}

/** Shown in place of the paywall once a payment went through, until the profile shows the new access. */
export function PaymentReceived({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  return (
    <div className="min-h-dvh bg-cream-100 dark:bg-ink-100 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-forest-100 dark:bg-forest-900/40 flex items-center justify-center mx-auto mb-4 shadow-card">
          <Check size={32} className="text-forest-600 dark:text-forest-400" />
        </div>
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2 tracking-tight">{t('paywall.received.title')}</h1>
        <p className="text-stone-500 dark:text-stone-400 mb-6">{t('paywall.received.body')}</p>
        <button
          onClick={onOpen}
          className="inline-flex min-h-11 items-center gap-2 bg-deep hover:bg-forest-500 dark:bg-lime-300 dark:hover:bg-lime-200 text-white dark:text-deep font-semibold rounded-full px-6 py-2.5 text-sm transition-colors duration-150"
        >
          {t('openApp')}
        </button>
      </div>
    </div>
  );
}

export function ActivatingNotice() {
  const t = useT();
  return (
    <div className="flex items-center gap-3 text-stone-500 mb-8">
      <span className="w-2 h-2 rounded-full bg-forest-500 animate-pulse" />
      <span className="text-sm">{t('paywall.activating')}</span>
    </div>
  );
}

export function CheckoutProblem() {
  const t = useT();
  return (
    <div role="alert" className="mb-8 max-w-4xl w-full text-sm text-alert-600 dark:text-alert-400 bg-alert-100 dark:bg-alert-900/20 border border-alert-400 dark:border-alert-800 rounded-xl px-4 py-3">
      {t('paywall.checkoutUnavailable')}
    </div>
  );
}

export function GiftThanks() {
  const t = useT();
  return (
    <p role="status" className="mt-6 w-full max-w-4xl rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm text-stone-700 dark:border-ink-400 dark:bg-ink-50 dark:text-stone-200">
      {t('gift.thanks')}
    </p>
  );
}

export function GiftButton({ days, onBuy }: { days: number | null; onBuy: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onBuy}
      className="mt-6 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-stone-700 underline underline-offset-4 hover:text-stone-900 dark:text-stone-200 dark:hover:text-white"
    >
      {days ? t('paywall.giftBuy', { length: describeLength(days) }) : t('paywall.giftBuyGeneric')}
    </button>
  );
}

/** Shown when this build has no Paddle plans configured (nothing to buy yet). */
export function PlansUnavailable() {
  const t = useT();
  return (
    <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-5 py-4 mb-8 max-w-4xl w-full">
      <AlertTriangle size={16} className="text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
      <div>
        {/* Customer-facing: the config details (VITE_PADDLE_PRICE_ID_*)
            belong in the console, not on a checkout screen. */}
        <p className="text-amber-800 dark:text-amber-300 text-sm font-medium mb-1">{t('paywall.unavailable.title')}</p>
        <p className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
          {t('paywall.unavailable.body')}
        </p>
      </div>
    </div>
  );
}
