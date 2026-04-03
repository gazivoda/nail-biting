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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">You're all set!</h2>
          <p className="text-slate-400 mb-2">Subscription activated. Enjoy Nail Habit Pro.</p>
          <p className="text-slate-500 text-sm">Redirecting to app…</p>
        </div>
      </div>
    );
  }

  const trialDaysLeft = user?.trial_end_date
    ? Math.max(0, Math.ceil((new Date(user.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isTrialExpired = !onBack;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold text-slate-100">Nail Habit</span>
        </div>
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
              <ArrowLeft size={14} />
              Back to app
            </button>
          )}
          <button onClick={signOut} className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Trial expired notice */}
        {isTrialExpired && (
          <div className="flex items-center gap-2 bg-amber-950/50 border border-amber-800/50 text-amber-400 rounded-lg px-4 py-2.5 text-sm mb-8">
            <AlertTriangle size={14} />
            <span>Your 7-day free trial has ended. Subscribe to keep using Nail Habit.</span>
          </div>
        )}

        <h1 className="text-3xl font-bold text-slate-100 mb-2 text-center">
          {onBack ? 'Upgrade to Pro' : 'Continue Breaking the Habit'}
        </h1>
        <p className="text-slate-400 mb-10 text-center max-w-md">
          Unlimited AI nail-biting detection, streak tracking, and history — 100% on-device.
        </p>

        {!plansConfigured && (
          <div className="flex items-start gap-3 bg-amber-950/40 border border-amber-800/40 rounded-xl px-5 py-4 mb-8 max-w-lg w-full">
            <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-amber-300 text-sm font-medium mb-1">PayPal plans not configured</p>
              <p className="text-amber-500 text-xs leading-relaxed">
                Set <code className="mx-1 bg-amber-950 px-1 rounded">VITE_PAYPAL_PLAN_ID_MONTHLY</code> and
                <code className="mx-1 bg-amber-950 px-1 rounded">VITE_PAYPAL_PLAN_ID_YEARLY</code> in .env
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          {/* Monthly */}
          <div className="border border-slate-700 rounded-2xl p-6 flex flex-col bg-slate-900/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-900/50 flex items-center justify-center">
                <Zap size={16} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Monthly</p>
                <p className="text-xs text-slate-500">Billed monthly</p>
              </div>
            </div>
            <div className="mb-4">
              <span className="text-3xl font-bold text-slate-100">€2.99</span>
              <span className="text-slate-400 text-sm"> / month</span>
            </div>
            <ul className="space-y-2 mb-6 flex-1">
              {['Unlimited AI detection', 'Streak & habit tracking', 'Full incident history', 'All alert types'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <Check size={13} className="text-emerald-400 shrink-0" />{f}
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
          <div className="border-2 border-emerald-600 rounded-2xl p-6 flex flex-col bg-slate-900/50 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Best value — save 19%
              </span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-900/60 flex items-center justify-center">
                <Star size={16} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Yearly</p>
                <p className="text-xs text-slate-500">Billed once a year</p>
              </div>
            </div>
            <div className="mb-1">
              <span className="text-3xl font-bold text-slate-100">€29.00</span>
              <span className="text-slate-400 text-sm"> / year</span>
            </div>
            <p className="text-emerald-400 text-xs mb-4">Just €2.42/month</p>
            <ul className="space-y-2 mb-6 flex-1">
              {['Unlimited AI detection', 'Streak & habit tracking', 'Full incident history', 'All alert types', 'Priority support'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <Check size={13} className="text-emerald-400 shrink-0" />{f}
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
          <div className="mt-6 max-w-lg text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex items-center gap-6 mt-10 text-xs text-slate-600">
          <div className="flex items-center gap-1.5"><Shield size={11} /><span>Secure PayPal payment</span></div>
          <div className="flex items-center gap-1.5"><Check size={11} /><span>Cancel anytime</span></div>
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /><span>Camera stays on-device</span></div>
        </div>

        {onBack && trialDaysLeft > 0 && (
          <p className="mt-6 text-xs text-slate-600">
            {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining in your free trial
          </p>
        )}
      </main>
    </div>
  );
}
