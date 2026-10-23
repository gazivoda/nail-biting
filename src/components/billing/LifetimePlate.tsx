// The lifetime option on the in-app paywall (flag lifetime_plan; the paywall renders this only when the flag
// is on AND the build was given the Lifetime price id). Same look as the monthly plate. It states what is
// bought and nothing more: one payment, no renewals, everything the monthly plan has.

import { ArrowRight, Check } from 'lucide-react';
import { PLAN_FEATURES } from '../site/plans';

export function LifetimePlate({ price, disabled, onBuy }: { price?: string; disabled: boolean; onBuy: () => void }) {
  return (
    <div className="mt-6 flex w-full max-w-4xl flex-col rounded-2xl border border-stone-200 bg-white p-7 dark:border-ink-400 dark:bg-ink-50 sm:p-9">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="sg-h3 text-stone-900 dark:text-stone-100">Lifetime</p>
        <p className="flex items-baseline gap-1.5 text-stone-900 dark:text-stone-100">
          {price
            ? <><span className="sg-figure">{price}</span><span className="text-sm text-stone-600 dark:text-stone-300">once</span></>
            : <span className="text-sm text-stone-600 dark:text-stone-300">Price shown at checkout</span>}
        </p>
      </div>
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
        One payment, no renewals, for as long as Stop Biting is offered. See the{' '}
        <a href="/refund-policy" className="underline underline-offset-4">refund policy</a>.
      </p>
      <ul className="mt-6 space-y-2.5">
        {PLAN_FEATURES.map(f => (
          <li key={f} className="flex items-center gap-2.5 text-[0.9375rem] leading-[1.55] text-stone-700 dark:text-stone-300">
            <Check size={17} aria-hidden="true" className="shrink-0 text-forest-500 dark:text-forest-400" />{f}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={disabled}
        onClick={onBuy}
        className="sg-btn group mt-7 w-full !bg-transparent border-2 border-stone-900 text-stone-900 hover:!bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-200 dark:text-stone-100 dark:hover:!bg-stone-200 dark:hover:text-stone-900 sm:w-auto sm:self-start"
      >
        Buy lifetime
        <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}
