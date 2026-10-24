// The Insights page as a drawing of numbers: everything it needs comes in as props, so it renders the same in
// a server-side render (the tests) as in the browser, with 0, 1 or 10,000 events. InsightsView.tsx is the
// wrapper that feeds it from the store.

import type { ReactNode } from 'react';
import type { Insights } from '../aggregate';
import { coachingSentence, falseAlarmSentence, heatmapSummary, seriesSummary } from '../copy';
import { countPhrase, triggerLabel, type Series } from '../labels';
import type { MilestoneStatus } from '../milestones';
import type { CustomTag } from '../../types';
import { formatDate } from '../../i18n/format';
import { useT } from '../../i18n/scopes/insights';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { BarSeries, type BarDatum } from './BarSeries';
import { EmptyInsights } from './EmptyInsights';
import { HeatmapGrid } from './HeatmapGrid';
import { InsightCard } from './InsightCard';
import { MilestoneList } from './MilestoneList';
import { RateCard } from './RateCard';
import { TriggerBars } from './TriggerBars';
import { WeekHero } from './WeekHero';

export type { Series };
export type RangeDays = 30 | 90 | null;

export interface InsightsBodyProps {
  insights: Insights;
  milestones: readonly MilestoneStatus[];
  customTags: readonly CustomTag[];
  series: Series;
  onSeries: (s: Series) => void;
  rangeDays: RangeDays;
  onRangeDays: (r: RangeDays) => void;
  /** `insights` flag: the charts and milestones. Off with only the photo diary on. */
  charts: boolean;
  /** Show the competing-response card even with no data (`hrt_coaching` is on). */
  coachingOn: boolean;
  /** Show the false-alarm card even with no data (`false_positive_controls` is on). */
  falseAlarmsOn: boolean;
  /** The photo diary, already gated and lazy. */
  photoDiary?: ReactNode;
  /** Older entries a free account does not see (WS9). 0 for everyone else. */
  hiddenCount?: number;
  onGoToWatch?: () => void;
  onOpenMilestone: (s: MilestoneStatus) => void;
}

const dayLabel = (ts: number) => formatDate(ts, { weekday: 'short', day: 'numeric', month: 'short' });
const shortDate = (ts: number) => formatDate(ts, { day: 'numeric', month: 'short' });

export function InsightsBody(p: InsightsBodyProps) {
  const t = useT();
  const { insights: r } = p;
  const bites = p.series === 'bites';
  const pick = (b: { bites: number; entries: number }) => (bites ? b.bites : b.entries);

  const daily: BarDatum[] = r.daily.map((d, i) => {
    const date = new Date(d.start);
    const fromEnd = r.daily.length - 1 - i;
    return {
      key: d.start,
      value: pick(d),
      // Every fifth day is labelled; the month is added to the first label and wherever the month turns over.
      label: fromEnd % 5 === 0 ? (i === 0 || date.getDate() <= 5 ? `${date.getDate()} ${formatDate(date, { month: 'short' })}` : String(date.getDate())) : '',
      title: t('bar.title', { label: dayLabel(d.start), count: countPhrase(p.series, pick(d)) }),
    };
  });
  const weekly: BarDatum[] = r.weekly.map(w => ({
    key: w.start,
    value: pick(w),
    label: shortDate(w.start),
    title: t('bar.weekTitle', { date: shortDate(w.start), count: countPhrase(p.series, pick(w)) }),
  }));

  const showCoaching = r.coaching.rate !== null || p.coachingOn;
  const showFalseAlarms = r.falseAlarms.falsePositives > 0 || p.falseAlarmsOn;
  const sparse = r.hasData && r.totals.entries < 7;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {p.charts && !r.hasData && <EmptyInsights onGoToWatch={p.onGoToWatch} />}

      {p.charts && r.hasData && (
        <>
          <div className="space-y-6 lg:col-span-2">
            <WeekHero trend={bites ? r.trend : r.entryTrend} series={p.series} />
            {sparse && (
              <p role="note" className="rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm text-stone-700 dark:border-ink-400 dark:bg-ink-50 dark:text-stone-200">
                {t('body.sparse', { entries: countPhrase('entries', r.totals.entries) })}
              </p>
            )}
            {!!p.hiddenCount && (
              <p role="note" className="text-sm text-stone-600 dark:text-stone-300">
                {t('body.hidden', { count: p.hiddenCount })}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl<Series>
                ariaLabel={t('body.chartsCount')}
                value={p.series}
                onChange={p.onSeries}
                options={[
                  { label: t('body.seriesBites'), value: 'bites' },
                  { label: t('body.seriesEntries'), value: 'entries' },
                ]}
              />
              <p className="text-sm text-stone-600 dark:text-stone-300">
                {bites ? t('body.noteBites') : t('body.noteEntries')}
              </p>
            </div>
          </div>

          <InsightCard title={t('daily.title')} subtitle={t('daily.subtitle', { count: r.daily.length })} className="lg:col-span-2">
            <BarSeries
              data={daily}
              summary={seriesSummary(daily.map(d => d.value), p.series, 'day', r.daily.map(d => dayLabel(d.start)))}
              emptyText={t(bites ? 'daily.emptyBites' : 'daily.emptyEntries', { count: r.daily.length })}
            />
          </InsightCard>

          <InsightCard
            title={t('when.title')}
            subtitle={p.rangeDays === null ? t('when.subtitleAll') : t('when.subtitleDays', { days: p.rangeDays })}
            className="lg:col-span-2"
            action={<RangeSwitch value={p.rangeDays} onChange={p.onRangeDays} />}
          >
            <HeatmapGrid heatmap={r.heatmap} summary={heatmapSummary(r.heatmap)} />
            <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">{heatmapSummary(r.heatmap)}</p>
          </InsightCard>

          <InsightCard title={t('weekly.title')} subtitle={t('weekly.subtitle', { count: r.weekly.length })}>
            <BarSeries
              data={weekly}
              showValues
              summary={seriesSummary(weekly.map(d => d.value), p.series, 'week', r.weekly.map(w => shortDate(w.start)))}
              emptyText={t(bites ? 'weekly.emptyBites' : 'weekly.emptyEntries', { count: r.weekly.length })}
            />
          </InsightCard>

          <InsightCard
            title={t('triggers.title')}
            subtitle={p.rangeDays === null ? t('triggers.subtitleAll') : t('triggers.subtitleDays', { days: p.rangeDays })}
          >
            {r.triggers.total === 0 ? (
              <p className="text-sm text-stone-600 dark:text-stone-300">{t('range.noBites')}</p>
            ) : (
              <>
                <TriggerBars breakdown={r.triggers} customTags={p.customTags} />
                <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">
                  {r.triggers.top
                    ? t('triggers.top', { label: triggerLabel(r.triggers.top.tag, p.customTags), count: r.triggers.top.count, total: r.triggers.top.of })
                    : t('triggers.notEnough')}
                </p>
              </>
            )}
          </InsightCard>

          {showCoaching && (
            <RateCard
              title={t('rate.coachingTitle')}
              rate={r.coaching.rate}
              sentence={coachingSentence(r.coaching)}
              empty={t('rate.coachingEmpty')}
            />
          )}
          {showFalseAlarms && (
            <RateCard
              title={t('rate.falseTitle')}
              rate={r.falseAlarms.rate}
              sentence={falseAlarmSentence(r.falseAlarms)}
              empty={t('rate.falseEmpty')}
            />
          )}
        </>
      )}

      {p.charts && (
        <div className="lg:col-span-2">
          <MilestoneList statuses={p.milestones} onOpen={p.onOpenMilestone} />
        </div>
      )}

      {p.photoDiary && <div className="lg:col-span-2">{p.photoDiary}</div>}
    </div>
  );
}

function RangeSwitch({ value, onChange }: { value: RangeDays; onChange: (r: RangeDays) => void }) {
  const t = useT();
  const key = (v: RangeDays) => (v === null ? 'all' : String(v));
  return (
    <SegmentedControl<string>
      ariaLabel={t('range.label')}
      value={key(value)}
      onChange={v => onChange(v === 'all' ? null : (Number(v) as 30 | 90))}
      options={[
        { label: t('range.days30'), value: '30' },
        { label: t('range.days90'), value: '90' },
        { label: t('range.all'), value: 'all' },
      ]}
    />
  );
}
