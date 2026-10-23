// The Insights page as a drawing of numbers: everything it needs comes in as props, so it renders the same in
// a server-side render (the tests) as in the browser, with 0, 1 or 10,000 events. InsightsView.tsx is the
// wrapper that feeds it from the store.

import type { ReactNode } from 'react';
import type { Insights } from '../aggregate';
import { coachingSentence, falseAlarmSentence, heatmapSummary, seriesSummary } from '../copy';
import { plural, triggerLabel } from '../labels';
import type { MilestoneStatus } from '../milestones';
import type { CustomTag } from '../../types';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { BarSeries, type BarDatum } from './BarSeries';
import { EmptyInsights } from './EmptyInsights';
import { HeatmapGrid } from './HeatmapGrid';
import { InsightCard } from './InsightCard';
import { MilestoneList } from './MilestoneList';
import { RateCard } from './RateCard';
import { TriggerBars } from './TriggerBars';
import { WeekHero } from './WeekHero';

export type Series = 'bites' | 'entries';
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

const dayLabel = (ts: number) => new Date(ts).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
const shortDate = (ts: number) => new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' });

export function InsightsBody(p: InsightsBodyProps) {
  const { insights: r } = p;
  const bites = p.series === 'bites';
  const noun = bites ? 'bite' : 'entry';
  const nounPlural = bites ? 'bites' : 'entries';
  const pick = (b: { bites: number; entries: number }) => (bites ? b.bites : b.entries);

  const daily: BarDatum[] = r.daily.map((d, i) => {
    const date = new Date(d.start);
    const fromEnd = r.daily.length - 1 - i;
    return {
      key: d.start,
      value: pick(d),
      // Every fifth day is labelled; the month is added to the first label and wherever the month turns over.
      label: fromEnd % 5 === 0 ? (i === 0 || date.getDate() <= 5 ? `${date.getDate()} ${date.toLocaleDateString([], { month: 'short' })}` : String(date.getDate())) : '',
      title: `${dayLabel(d.start)}: ${pick(d)} ${plural(pick(d), noun, nounPlural)}`,
    };
  });
  const weekly: BarDatum[] = r.weekly.map(w => ({
    key: w.start,
    value: pick(w),
    label: shortDate(w.start),
    title: `Week of ${shortDate(w.start)}: ${pick(w)} ${plural(pick(w), noun, nounPlural)}`,
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
            <WeekHero trend={bites ? r.trend : r.entryTrend} noun={noun} nounPlural={nounPlural} />
            {sparse && (
              <p role="note" className="rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm text-stone-700 dark:border-ink-400 dark:bg-ink-50 dark:text-stone-200">
                Only {r.totals.entries} {plural(r.totals.entries, 'entry', 'entries')} so far. The charts say more after a week or two of use.
              </p>
            )}
            {!!p.hiddenCount && (
              <p role="note" className="text-sm text-stone-600 dark:text-stone-300">
                {p.hiddenCount} older {p.hiddenCount === 1 ? 'entry is' : 'entries are'} saved on this device and show again with a plan, so these charts cover the days you can see.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl<Series>
                ariaLabel="Charts count"
                value={p.series}
                onChange={p.onSeries}
                options={[
                  { label: 'Bites', value: 'bites' },
                  { label: 'Alarms and bites', value: 'entries' },
                ]}
              />
              <p className="text-sm text-stone-600 dark:text-stone-300">
                {bites ? 'Alarms count once you confirm them or log the bite yourself.' : 'Includes alarms nobody has reviewed yet.'}
              </p>
            </div>
          </div>

          <InsightCard title="Each day" subtitle={`Last ${r.daily.length} days, today on the right.`} className="lg:col-span-2">
            <BarSeries
              data={daily}
              summary={seriesSummary(daily.map(d => d.value), noun, nounPlural, 'day', r.daily.map(d => `on ${dayLabel(d.start)}`))}
              emptyText={`No ${nounPlural} in the last ${r.daily.length} days.`}
            />
          </InsightCard>

          <InsightCard
            title="When it happens"
            subtitle={`Bites by weekday and hour of the day, ${rangeName(p.rangeDays)}.`}
            className="lg:col-span-2"
            action={<RangeSwitch value={p.rangeDays} onChange={p.onRangeDays} />}
          >
            <HeatmapGrid heatmap={r.heatmap} summary={heatmapSummary(r.heatmap)} />
            <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">{heatmapSummary(r.heatmap)}</p>
          </InsightCard>

          <InsightCard title="Each week" subtitle={`Last ${r.weekly.length} weeks, weeks start on Monday.`}>
            <BarSeries
              data={weekly}
              showValues
              summary={seriesSummary(weekly.map(d => d.value), noun, nounPlural, 'week', r.weekly.map(w => `in the week of ${shortDate(w.start)}`))}
              emptyText={`No ${nounPlural} in the last ${r.weekly.length} weeks.`}
            />
          </InsightCard>

          <InsightCard
            title="What sets it off"
            subtitle={`The reasons you picked for bites, ${rangeName(p.rangeDays)}.`}
          >
            {r.triggers.total === 0 ? (
              <p className="text-sm text-stone-600 dark:text-stone-300">No bites in this range.</p>
            ) : (
              <>
                <TriggerBars breakdown={r.triggers} customTags={p.customTags} />
                <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">
                  {r.triggers.top
                    ? `Most often: ${triggerLabel(r.triggers.top.tag, p.customTags)}, ${r.triggers.top.count} of ${r.triggers.top.of} bites with a reason.`
                    : 'Not enough bites with a reason yet to name the most common one.'}
                </p>
              </>
            )}
          </InsightCard>

          {showCoaching && (
            <RateCard
              title="Competing response"
              rate={r.coaching.rate}
              sentence={coachingSentence(r.coaching)}
              empty="No finished competing responses to count yet. Turn on the prompt under Settings, Alerts, and this shows how often you finish it after an alarm."
            />
          )}
          {showFalseAlarms && (
            <RateCard
              title="False alarms"
              rate={r.falseAlarms.rate}
              sentence={falseAlarmSentence(r.falseAlarms)}
              empty="No alarms yet. Alarms you mark as not a bite are counted here."
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

function rangeName(r: RangeDays): string {
  return r === null ? 'all your history' : `last ${r} days`;
}

function RangeSwitch({ value, onChange }: { value: RangeDays; onChange: (r: RangeDays) => void }) {
  const key = (v: RangeDays) => (v === null ? 'all' : String(v));
  return (
    <SegmentedControl<string>
      ariaLabel="Period"
      value={key(value)}
      onChange={v => onChange(v === 'all' ? null : (Number(v) as 30 | 90))}
      options={[
        { label: '30 days', value: '30' },
        { label: '90 days', value: '90' },
        { label: 'All', value: 'all' },
      ]}
    />
  );
}
