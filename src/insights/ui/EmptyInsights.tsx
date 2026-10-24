// What Insights shows before there is anything to chart: the same deep card History uses for "No history yet",
// with a plain list of what will appear here. The milestones below it are real even now (they start at one hour).

import { ArrowRight, BarChart3, Grid3x3, Tag, type LucideIcon } from 'lucide-react';
import { Rings } from '../../components/site/Rings';
import { useT, type messages } from '../../i18n/scopes/insights';

// The words are looked up when the page renders (not here), so they follow the language.
const WILL_SHOW: ReadonlyArray<{ icon: LucideIcon; key: keyof typeof messages }> = [
  { icon: BarChart3, key: 'empty.willTrend' },
  { icon: Grid3x3, key: 'empty.willWhen' },
  { icon: Tag, key: 'empty.willTriggers' },
];

export function EmptyInsights({ onGoToWatch }: { onGoToWatch?: () => void }) {
  const t = useT();
  return (
    <section className="bite sg-dark relative overflow-hidden rounded-[2rem] border border-transparent bg-deep p-7 text-white sm:p-10 lg:col-span-2 dark:border-ink-400">
      <Rings className="-bottom-24 -left-24 h-72 w-72 sm:h-96 sm:w-96" />
      <div className="relative flex max-w-xl flex-col items-start">
        <h2 className="font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-5xl">{t('empty.title')}</h2>
        <p className="mt-4 text-pretty text-base leading-relaxed text-white/80">
          {t('empty.body')}
        </p>
        <ul className="mt-5 list-none space-y-3 p-0">
          {WILL_SHOW.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-start gap-3 text-sm leading-relaxed text-white/85">
              <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-lime-300" />
              {t(key)}
            </li>
          ))}
        </ul>
        {onGoToWatch && (
          <button
            type="button"
            onClick={onGoToWatch}
            className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-lime-300 px-6 font-display text-base font-bold text-deep transition-colors hover:bg-lime-200"
          >
            {t('empty.goToWatch')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
