import { useState, useEffect, useCallback, useRef } from 'react';
import { initializePaddle, type Paddle, type CheckoutEventsData } from '@paddle/paddle-js';
import { Check, Shield, ArrowLeft, AlertTriangle } from 'lucide-react';
import { trialLeft } from '../../utils/trial';
import { apiFetch, useAuth } from '../../contexts/AuthContext';
import { PLAN_FEATURES, YEARLY_EXTRA } from '../site/plans';

interface Props {
  onBack?: () => void;
}

const PADDLE_CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string;
const PRICE_MONTHLY = import.meta.env.VITE_PADDLE_PRICE_ID_MONTHLY as string;
const PRICE_YEARLY = import.meta.env.VITE_PADDLE_PRICE_ID_YEARLY as string;
const PADDLE_ENV = (import.meta.env.VITE_PADDLE_ENV || 'production') as 'production' | 'sandbox';

const CHECKOUT_UNAVAILABLE =
  "Checkout couldn't load. If you use an ad blocker, allow paddle.com for this site and reload, or email hello@stopbiting.today.";

export function PaywallPage({ onBack }: Props) {
  const { user, refreshProfile, signOut } = useAuth();
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          handleCheckoutComplete(txId);
        }
      },
    })
      // Paddle's script is blocked by some ad blockers and can fail on a bad
      // connection. The Subscribe buttons wait on it, so say why they are
      // disabled instead of leaving them greyed out forever.
      .then((paddleInstance) => {
        if (paddleInstance) setPaddle(paddleInstance);
        else setError(CHECKOUT_UNAVAILABLE);
      })
      .catch(() => setError(CHECKOUT_UNAVAILABLE));
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

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: user?.email ? { email: user.email } : undefined,
      customData: { userId: user?.id || '' },
    });
  };

  if (success) {
    return (
      <div className="min-h-dvh bg-cream-100 dark:bg-ink-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-forest-100 dark:bg-forest-900/40 flex items-center justify-center mx-auto mb-4 shadow-card">
            <Check size={32} className="text-forest-600 dark:text-forest-400" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2 tracking-tight">Payment received</h1>
          <p className="text-stone-500 dark:text-stone-400 mb-6">Your subscription can take a few seconds to activate.</p>
          <button
            onClick={() => refreshProfile()}
            className="inline-flex min-h-11 items-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-xl px-6 py-2.5 text-sm transition-colors duration-150"
          >
            Open the app
          </button>
        </div>
      </div>
    );
  }

  const trialLeftText = trialLeft(user?.trial_end_date);

  const isTrialExpired = !onBack;

  return (
    <div className="min-h-dvh bg-cream-100 dark:bg-ink-100 text-stone-800 dark:text-stone-200 flex flex-col">
      {/* Header */}
      <header className="border-b border-stone-200 dark:border-ink-400 bg-white dark:bg-ink-200 px-6 py-4 flex items-center justify-between shadow-card">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="w-7 h-7 flex-shrink-0 dark:hidden" />
          <img src="/logo-dark.svg" alt="" className="hidden w-7 h-7 flex-shrink-0 dark:block" />
          <span className="text-sm font-semibold tracking-tight text-stone-800 dark:text-stone-100">Stop Biting</span>
        </div>
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="flex min-h-11 items-center gap-1.5 px-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">
              <ArrowLeft size={14} />
              Back to app
            </button>
          )}
          <button onClick={signOut} className="min-h-11 px-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Trial expired notice */}
        {isTrialExpired && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded-xl px-4 py-2.5 text-sm mb-8">
            <AlertTriangle size={14} />
            <span>Your free trial has ended. Your history is still saved on this device.</span>
          </div>
        )}

        <div className="mb-10 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 mb-2 text-center tracking-tight">
          {onBack ? 'Choose a plan' : 'Keep the alarm running'}
        </h1>
        <p className="text-stone-500 dark:text-stone-400 text-center max-w-md">
          $2.99 a month, or $29 a year. Detection runs on your computer; only sign-in and payment use the network.
        </p>
        {/* Mid-trial, the free days left are the first thing to know, not a
            footnote under the fold on a phone. */}
        {onBack && trialLeftText && (
          <p className="mt-3 text-sm font-medium text-forest-700 dark:text-forest-300">
            {trialLeftText} in your free trial.
          </p>
        )}
        </div>

        {!plansConfigured && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-5 py-4 mb-8 max-w-lg w-full">
            <AlertTriangle size={16} className="text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              {/* Customer-facing: the config details (VITE_PADDLE_PRICE_ID_*)
                  belong in the console, not on a checkout screen. */}
              <p className="text-amber-800 dark:text-amber-300 text-sm font-medium mb-1">Subscriptions are unavailable right now</p>
              <p className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                Please try again later, or email hello@stopbiting.today.
              </p>
            </div>
          </div>
        )}

        {activating && (
          <div className="flex items-center gap-3 text-stone-500 mb-8">
            <span className="w-2 h-2 rounded-full bg-forest-500 animate-pulse" />
            <span className="text-sm">Activating your subscription…</span>
          </div>
        )}

        {/* Above the plans: it explains why their buttons are disabled, and on
            a phone the space below them is two screens down. */}
        {error && (
          <div role="alert" className="mb-8 max-w-lg w-full text-sm text-alert-600 dark:text-alert-400 bg-alert-100 dark:bg-alert-900/20 border border-alert-400 dark:border-alert-800 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          {/* Yearly first at every width, as on /pricing. */}
          <div className="border-2 border-forest-500 dark:border-forest-600 rounded-2xl p-6 flex flex-col bg-white dark:bg-ink-50 shadow-card-md dark:shadow-card-md-dark relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-forest-600 text-cream-100 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                Best value: save 19%
              </span>
            </div>
            <div className="mb-4">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">Yearly</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Billed once a year</p>
            </div>
            <div className="mb-1">
              <span className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">$29.00</span>
              <span className="text-stone-500 dark:text-stone-400 text-sm"> / year</span>
            </div>
            <p className="text-forest-600 dark:text-forest-400 text-xs mb-4 font-medium">About $2.42 a month</p>
            <ul className="space-y-2 mb-6 flex-1">
              {[...PLAN_FEATURES, YEARLY_EXTRA].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                  <Check size={13} className="text-forest-500 dark:text-forest-400 shrink-0" />{f}
                </li>
              ))}
            </ul>
            {plansConfigured && (
              <button
                disabled={activating || !paddle}
                onClick={() => openCheckout(PRICE_YEARLY)}
                className="inline-flex min-h-11 items-center justify-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Subscribe yearly
              </button>
            )}
          </div>
          {/* Monthly */}
          <div className="border border-stone-200 dark:border-ink-400 rounded-2xl p-6 flex flex-col bg-white dark:bg-ink-50 shadow-card dark:shadow-card-dark">
            <div className="mb-4">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">Monthly</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Billed monthly</p>
            </div>
            <div className="mb-4">
              <span className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">$2.99</span>
              <span className="text-stone-500 dark:text-stone-400 text-sm"> / month</span>
            </div>
            <ul className="space-y-2 mb-6 flex-1">
              {PLAN_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                  <Check size={13} className="text-forest-500 dark:text-forest-400 shrink-0" />{f}
                </li>
              ))}
            </ul>
            {plansConfigured && (
              <button
                disabled={activating || !paddle}
                onClick={() => openCheckout(PRICE_MONTHLY)}
                className="inline-flex min-h-11 items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-stone-100 text-cream-100 dark:text-stone-900 font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Subscribe monthly
              </button>
            )}
          </div>

        </div>


        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-10 text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-1.5"><Shield size={11} /><span>Secure payment via Paddle</span></div>
          <div className="flex items-center gap-1.5"><Check size={11} /><span>Cancel anytime in Settings</span></div>
          <div className="flex items-center gap-1.5"><Check size={11} /><span>Camera stays on-device</span></div>
        </div>

      </main>
    </div>
  );
}
