// The free plan's line on the Dashboard (flag free_tier): how much of today's detection time is used.
// Renders nothing for every account that is not in the free tier, which is every account while the flag is off.

import { useFreeTier } from '../../billing/useFreeTier';

export function FreeTierNotice({ onUpgrade }: { onUpgrade?: () => void }) {
  const free = useFreeTier();
  if (!free.active) return null;

  return (
    <p role="status" className="-mt-4 mb-6 flex flex-wrap items-center gap-x-3 text-sm text-stone-600 dark:text-stone-300">
      <span>
        {free.reached
          ? `You have used today's ${free.limitMinutes} free minutes of detection. It starts again tomorrow.`
          : `Free plan: ${free.usedMinutes} of ${free.limitMinutes} minutes of detection used today.`}
      </span>
      {onUpgrade && (
        <button
          type="button"
          onClick={onUpgrade}
          className="inline-flex min-h-11 items-center font-semibold text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-400 dark:hover:text-forest-300"
        >
          Choose a plan
        </button>
      )}
    </p>
  );
}
