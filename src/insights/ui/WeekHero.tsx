// The top card of Insights: the last 7 days against the 7 before, in the same deep forest card as the
// History chart. Counts and one plain sentence; no verdict.

import { Rings } from '../../components/site/Rings';
import type { Trend } from '../aggregate';
import { trendSentence } from '../copy';
import { plural } from '../labels';

export function WeekHero({ trend, noun, nounPlural }: { trend: Trend; noun: string; nounPlural: string }) {
  return (
    <section className="bite sg-dark relative overflow-hidden rounded-2xl border border-transparent bg-deep p-6 text-white dark:border-ink-400">
      <Rings className="-bottom-28 -right-24 h-72 w-72" />
      <div className="relative">
        <h2 className="font-display text-lg font-bold tracking-[-0.02em]">Last 7 days</h2>
        <p className="mt-3 flex items-baseline gap-3">
          <span className="font-display text-7xl font-extrabold leading-none tracking-[-0.045em] tabular-nums">{trend.current}</span>
          <span className="text-base font-medium text-white/75">{plural(trend.current, noun, nounPlural)}</span>
        </p>
        <p className="mt-3 max-w-md text-sm text-white/80">{trendSentence(trend, nounPlural)}</p>
      </div>
    </section>
  );
}
