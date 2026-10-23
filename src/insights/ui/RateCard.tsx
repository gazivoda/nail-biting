// A single rate: a big percentage, what it measures, and the counts behind it.
// Used for the competing-response rate (WS2) and the false-alarm rate (WS3).

import { InsightCard } from './InsightCard';

export function RateCard({ title, rate, sentence, empty }: {
  title: string;
  /** 0..1, or null when there is nothing to measure yet. */
  rate: number | null;
  /** The counts behind the percentage. */
  sentence: string | null;
  /** Shown when `rate` is null. */
  empty: string;
}) {
  return (
    <InsightCard title={title}>
      {rate === null ? (
        <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">{empty}</p>
      ) : (
        <>
          <p className="font-display text-6xl font-extrabold leading-none tracking-[-0.045em] tabular-nums text-stone-900 dark:text-stone-100">
            {Math.round(rate * 100)}
            <span className="ml-1 text-3xl text-stone-600 dark:text-stone-300">%</span>
          </p>
          {sentence && <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">{sentence}</p>}
        </>
      )}
    </InsightCard>
  );
}
