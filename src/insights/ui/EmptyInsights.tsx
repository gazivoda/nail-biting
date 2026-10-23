// What Insights shows before there is anything to chart: the same deep card History uses for "No history yet",
// with a plain list of what will appear here. The milestones below it are real even now (they start at one hour).

import { ArrowRight, BarChart3, Grid3x3, Tag } from 'lucide-react';
import { Rings } from '../../components/site/Rings';

const WILL_SHOW = [
  { icon: BarChart3, text: 'Bites per day and per week, and how this week compares with the one before' },
  { icon: Grid3x3, text: 'The weekdays and hours it happens most' },
  { icon: Tag, text: 'What sets it off, from the reasons you pick' },
] as const;

export function EmptyInsights({ onGoToWatch }: { onGoToWatch?: () => void }) {
  return (
    <section className="bite sg-dark relative overflow-hidden rounded-[2rem] border border-transparent bg-deep p-7 text-white sm:p-10 lg:col-span-2 dark:border-ink-400">
      <Rings className="-bottom-24 -left-24 h-72 w-72 sm:h-96 sm:w-96" />
      <div className="relative flex max-w-xl flex-col items-start">
        <h2 className="font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-5xl">Nothing to chart yet</h2>
        <p className="mt-4 text-pretty text-base leading-relaxed text-white/80">
          This page fills in from the alarms on the Watch tab and the bites you log. A week or two of entries is when patterns start to mean something. Here is what you will see:
        </p>
        <ul className="mt-5 list-none space-y-3 p-0">
          {WILL_SHOW.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm leading-relaxed text-white/85">
              <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-lime-300" />
              {text}
            </li>
          ))}
        </ul>
        {onGoToWatch && (
          <button
            type="button"
            onClick={onGoToWatch}
            className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-lime-300 px-6 font-display text-base font-bold text-deep transition-colors hover:bg-lime-200"
          >
            Go to Watch
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
