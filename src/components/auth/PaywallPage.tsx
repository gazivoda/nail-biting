import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { Check, Zap, Star, Shield, ArrowLeft, AlertTriangle } from 'lucide-react';
import { apiFetch, useAuth } from '../../contexts/AuthContext';

interface Props {
  onBack?: () => void;
}

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID as string;
const PLAN_MONTHLY = import.meta.env.VITE_PAYPAL_PLAN_ID_MONTHLY as string;
const PLAN_YEARLY = import.meta.env.VITE_PAYPAL_PLAN_ID_YEARLY as string;

export function PaywallPage({ onBack }: Props) {
  const { user, refreshProfile, signOut } = useAuth();
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const plansConfigured = !!(PLAN_MONTHLY && PLAN_YEARLY);

  const handleSuccess = async (subscriptionId: string, plan: 'monthly' | 'yearly') => {
    setActivating(true);
    setError(null);
    try {
      // Server verifies the subscription is genuinely ACTIVE with PayPal
      // before updating the user record — prevents client-side self-granting.
      await apiFetch('/api/paypal/verify-subscription', {
        method: 'POST',
        body: JSON.stringify({ subscriptionId, plan }),
      });

      await refreshProfile();
      setSuccess(true);
    } catch (err) {
      setError('Payment received but failed to activate. Contact support with your PayPal subscription ID: ' + subscriptionId);
      console.error(err);
    } finally {
      setActivating(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-forest-100 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-forest-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-2">You're all set!</h2>
          <p className="text-stone-500 mb-2">Subscription activated. Enjoy Stop Biting Pro.</p>
          <p className="text-stone-400 text-sm">Redirecting to app…</p>
        </div>
      </div>
    );
  }

  const trialDaysLeft = user?.trial_end_date
    ? Math.max(0, Math.ceil((new Date(user.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isTrialExpired = !onBack;

  return (
    <div className="min-h-screen bg-cream-100 text-stone-800 flex flex-col">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-forest-500 animate-pulse" />
          <span className="text-sm font-semibold text-stone-800">Stop Biting</span>
        </div>
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors">
              <ArrowLeft size={14} />
              Back to app
            </button>
          )}
          <button onClick={signOut} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Trial expired notice */}
        {isTrialExpired && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-2.5 text-sm mb-8">
            <AlertTriangle size={14} />
            <span>Your 7-day free trial has ended. Subscribe to keep using Stop Biting.</span>
          </div>
        )}

        <h1 className="text-3xl font-bold text-stone-800 mb-2 text-center">
          {onBack ? 'Upgrade to Pro' : 'Continue Breaking the Habit'}
        </h1>
        <p className="text-stone-500 mb-10 text-center max-w-md">
          Unlimited AI nail-biting detection, streak tracking, and history — 100% on-device.
        </p>

        {!plansConfigured && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-8 max-w-lg w-full">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-amber-800 text-sm font-medium mb-1">PayPal plans not configured</p>
              <p className="text-amber-600 text-xs leading-relaxed">
                Set <code className="mx-1 bg-amber-100 px-1 rounded">VITE_PAYPAL_PLAN_ID_MONTHLY</code> and
                <code className="mx-1 bg-amber-100 px-1 rounded">VITE_PAYPAL_PLAN_ID_YEARLY</code> in .env
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          {/* Monthly */}
          <div className="border border-stone-200 rounded-2xl p-6 flex flex-col bg-white shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-forest-100 flex items-center justify-center">
                <Zap size={16} className="text-forest-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-800">Monthly</p>
                <p className="text-xs text-stone-400">Billed monthly</p>
              </div>
            </div>
            <div className="mb-4">
              <span className="text-3xl font-bold text-stone-800">€2.99</span>
              <span className="text-stone-400 text-sm"> / month</span>
            </div>
            <ul className="space-y-2 mb-6 flex-1">
              {['Unlimited AI detection', 'Streak & habit tracking', 'Full incident history', 'All alert types'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-stone-600">
                  <Check size={13} className="text-forest-500 shrink-0" />{f}
                </li>
              ))}
            </ul>
            {plansConfigured && (
              <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'EUR', intent: 'subscription', vault: true }}>
                <PayPalButtons
                  disabled={activating}
                  createSubscription={(_d, actions) => actions.subscription.create({ plan_id: PLAN_MONTHLY })}
                  onApprove={async (data) => { if (data.subscriptionID) await handleSuccess(data.subscriptionID, 'monthly'); }}
                  onError={(err) => setError(String(err))}
                  style={{ layout: 'vertical', color: 'blue', shape: 'rect', label: 'subscribe', height: 40 }}
                />
              </PayPalScriptProvider>
            )}
          </div>

          {/* Yearly */}
          <div className="border-2 border-forest-500 rounded-2xl p-6 flex flex-col bg-white shadow-sm relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-forest-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Best value — save 19%
              </span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-forest-100 flex items-center justify-center">
                <Star size={16} className="text-forest-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-800">Yearly</p>
                <p className="text-xs text-stone-400">Billed once a year</p>
              </div>
            </div>
            <div className="mb-1">
              <span className="text-3xl font-bold text-stone-800">€29.00</span>
              <span className="text-stone-400 text-sm"> / year</span>
            </div>
            <p className="text-forest-600 text-xs mb-4">Just €2.42/month</p>
            <ul className="space-y-2 mb-6 flex-1">
              {['Unlimited AI detection', 'Streak & habit tracking', 'Full incident history', 'All alert types', 'Priority support'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-stone-600">
                  <Check size={13} className="text-forest-500 shrink-0" />{f}
                </li>
              ))}
            </ul>
            {plansConfigured && (
              <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'EUR', intent: 'subscription', vault: true }}>
                <PayPalButtons
                  disabled={activating}
                  createSubscription={(_d, actions) => actions.subscription.create({ plan_id: PLAN_YEARLY })}
                  onApprove={async (data) => { if (data.subscriptionID) await handleSuccess(data.subscriptionID, 'yearly'); }}
                  onError={(err) => setError(String(err))}
                  style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'subscribe', height: 40 }}
                />
              </PayPalScriptProvider>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-6 max-w-lg text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex items-center gap-6 mt-10 text-xs text-stone-400">
          <div className="flex items-center gap-1.5"><Shield size={11} /><span>Secure PayPal payment</span></div>
          <div className="flex items-center gap-1.5"><Check size={11} /><span>Cancel anytime</span></div>
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-forest-500" /><span>Camera stays on-device</span></div>
        </div>

        {onBack && trialDaysLeft > 0 && (
          <p className="mt-6 text-xs text-stone-400">
            {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining in your free trial
          </p>
        )}
      </main>
    </div>
  );
}
