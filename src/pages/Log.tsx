import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Trash2, Check, CheckCircle, ArrowRight } from 'lucide-react';
import { useAppStore, isBite } from '../store/useAppStore';
import { isAlarmOrBite, isFalsePositive, isPendingAlarm, isUrge } from '../storage/eventModel';
import { useFalsePositiveEnabled } from '../falsePositive/useEnabled';
import { markNotABite, undoNotABite } from '../falsePositive/actions';
import { FalsePositiveRate } from '../falsePositive/FalsePositiveRate';
import { formatTime, formatDate } from '../utils/time';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { subDays, startOfDay } from 'date-fns';
import { Rings } from '../components/site/Rings';
import { PageTitle } from '../components/ui/PageTitle';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { PRESET_TAGS, URGE_TAG } from '../components/dashboard/triggerTags';
import { topTrigger, peakHour, hourRange, behaviorsIn, filterByBehavior } from '../utils/insights';
import { BEHAVIOR_REGISTRY } from '../detection/registry';
import { useBehaviorFilterEnabled } from '../detection/useBehaviors';
import type { Behavior } from '../storage/eventModel';
import { useHistoryWindow } from '../billing/useFreeTier';
import type { CustomTag, Incident, StatsMetric } from '../types';
import { HistoryInsightsSwitch, type HistoryView } from '../insights/ui/ViewSwitch';
import { useInsightsAvailability } from '../insights/useInsightsAvailability';
import { PhotoReminder } from '../photos/PhotoReminder';
import { formatDatePattern } from '../i18n/format';
import { useT } from '../i18n/scopes/history';
import { useT as useCommonT } from '../i18n/scopes/common';
// WS5: the Insights view is its own chunk, fetched only when someone opens it (flags `insights` / `photo_diary`).
const InsightsView = lazy(() => import('../insights/ui/InsightsView').then(m => ({ default: m.InsightsView })));
// One fill for every bar. Colouring bars by count (green, amber, red) meant a
// quiet day read as "safe" and clashed with the amber/red used for alarms and
// bites right beside the chart.
// The chart card is deep forest in both themes, so the bars are always lime.
const BAR_FILL = 'oklch(90% 0.2 124)';

// Two words, used the same way everywhere:
// Alarm = auto-detected and not yet reviewed (amber)
// Bite  = logged by hand OR an alarm confirmed as a bite (red)
// An urge-timer entry (WS2) is neither: see isBite.
function isConfirmedBite(inc: Incident) {
  return isBite(inc);
}

// Every confirmed-bite tag shares the same styling — preset or custom.
const BITE_TAG_COLOR = 'text-alert-600 dark:text-alert-400 bg-alert-100 dark:bg-alert-900/30 border-alert-400 dark:border-alert-800';

// An urge the person rode out (urge timer): calm green, not the alarm red.
const URGE_TAG_COLOR = 'text-forest-700 dark:text-forest-300 bg-forest-50 dark:bg-forest-800/50 border-forest-300 dark:border-forest-700';

// An alarm the person marked "Not a bite" (WS3): reviewed, not counted. Quiet, neither the alarm amber nor the bite red.
const FALSE_TAG_COLOR = 'text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-ink-fill border-stone-300 dark:border-ink-400';

const INCIDENT_TAG_COLOR = 'text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700';

// Every bite pill starts with "Bite", and a tagged one uses the same words as
// the tag picker (triggerTags.ts): "Deep focus", not "Focus".
function biteTagLabel(inc: Incident, customTags: CustomTag[], t: ReturnType<typeof useT>): string {
  if (inc.tag === 'auto-detected') return t('tag.bite');
  const preset = PRESET_TAGS.find(x => x.id === inc.tag);
  // A comma, not a middle dot: Overpass sets the dot hard against the next
  // word (DESIGN.md, the Comma Offer Rule).
  if (preset) return t('tag.biteWith', { reason: preset.label });
  const custom = customTags.find(x => x.id === inc.tag);
  return custom ? t('tag.biteWith', { reason: [custom.emoji, custom.label].filter(Boolean).join(' ') }) : t('tag.bite');
}

// What the empty state promises ("this page shows what sets you off"), from
// confirmed and logged bites only. Each row appears once there is enough data
// to mean something (see utils/insights).
function BiteInsights({ incidents: shown }: { incidents?: Incident[] }) {
  const t = useT();
  const { incidents: all, customTags } = useAppStore();
  const incidents = shown ?? all;
  const bites = incidents.filter(isConfirmedBite);
  const trigger = topTrigger(bites);
  const peak = peakHour(bites);
  if (!trigger && !peak) return null;
  const triggerLabel = trigger
    ? [...PRESET_TAGS, ...customTags].find(x => x.id === trigger.tag)?.label ?? trigger.tag
    : null;
  return (
    <div className="mt-4 space-y-2 border-t border-stone-200 pt-4 text-sm dark:border-ink-400">
      {trigger && (
        <div className="flex justify-between gap-4">
          <span className="text-stone-600 dark:text-stone-300">{t('summary.topTrigger')}</span>
          <span className="text-right font-semibold text-stone-700 dark:text-stone-200">
            {triggerLabel} <span className="font-normal text-stone-500 dark:text-stone-400">{t('summary.tagged', { count: trigger.count, total: trigger.of })}</span>
          </span>
        </div>
      )}
      {peak && (
        <div className="flex justify-between gap-4">
          <span className="text-stone-600 dark:text-stone-300">{t('summary.mostBites')}</span>
          <span className="text-right font-semibold text-stone-700 dark:text-stone-200">{hourRange(peak.hour)}</span>
        </div>
      )}
    </div>
  );
}

function WeekChart({ incidents: shown }: { incidents?: Incident[] }) {
  const t = useT();
  const { incidents: all, weekChartMetric, setWeekChartMetric } = useAppStore();
  const incidents = shown ?? all;

  const relevantIncidents = weekChartMetric === 'confirmed'
    ? incidents.filter(isConfirmedBite)
    : incidents.filter(isAlarmOrBite); // "Alarms and bites per day": an urge and a "Not a bite" alarm are neither

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = startOfDay(subDays(new Date(), 6 - i));
    const count = relevantIncidents.filter(inc => {
      const d = startOfDay(new Date(inc.timestamp));
      return d.getTime() === date.getTime();
    }).length;
    return { day: formatDatePattern(date, 'EEE', { weekday: 'short' }), count, date };
  });

  const total = days.reduce((n, d) => n + d.count, 0);
  const busiest = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]);
  const confirmedOnly = weekChartMetric === 'confirmed';
  const busiestDay = formatDatePattern(busiest.date, 'EEEE', { weekday: 'long' });
  const caption = total === 0
    ? t(confirmedOnly ? 'week.captionBitesNone' : 'week.captionAllNone')
    : t(confirmedOnly ? 'week.captionBites' : 'week.captionAll', { day: busiestDay, count: busiest.count });

  const tickColor = 'oklch(100% 0 0 / 0.72)';
  const tooltipBg = 'oklch(31% 0.06 160)';
  const tooltipBorder = 'oklch(100% 0 0 / 0.16)';

  return (
    <div className="bite sg-dark relative overflow-hidden rounded-2xl border border-transparent bg-deep p-6 text-white dark:border-ink-400">
      <h2 className="font-display text-lg font-bold tracking-[-0.02em]">{t('week.title')}</h2>
      <p className="mt-3 flex items-baseline gap-3">
        <span className="font-display text-7xl font-extrabold leading-none tracking-[-0.045em] tabular-nums">{total}</span>
        <span className="text-base font-medium text-white/75">
          {t(confirmedOnly ? 'week.bitesThisWeek' : 'week.entriesThisWeek', { count: total })}
        </span>
      </p>
      <p className="mt-2 text-sm text-white/75">
        {caption}
      </p>
      <div className="mt-4">
        <SegmentedControl<StatsMetric>
          ariaLabel={t('week.chartShows')}
          onDeep
          value={weekChartMetric}
          onChange={setWeekChartMetric}
          options={[
            { label: t('week.filterAll'), value: 'incidents' },
            { label: t('week.filterBites'), value: 'confirmed' },
          ]}
        />
      </div>
      <div className="mt-5">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={days} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fill: tickColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: tickColor, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 16, fontSize: 12 }}
              labelStyle={{ color: tickColor }}
              itemStyle={{ color: BAR_FILL }}
              cursor={{ fill: 'rgba(255,255,255,0.06)' }}
            />
            <Bar dataKey="count" name={t(confirmedOnly ? 'week.seriesBites' : 'week.seriesEntries')} radius={[8, 8, 0, 0]} fill={BAR_FILL} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Clears History only. Settings and bite reasons are the Settings page's
// "Clear all data", which says so. Focus goes to Cancel on open (the safe
// choice) and back to the trigger on cancel, never to <body>.
export function ClearAllConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const t = useT();
  const tc = useCommonT();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
      <span className="text-stone-600 dark:text-stone-300">{t('clear.confirm')}</span>
      <button
        type="button"
        onClick={onConfirm}
        className="min-h-11 rounded-full bg-alert-600 px-5 font-semibold text-cream-100 transition-colors hover:bg-alert-800"
      >
        {t('clear.yes')}
      </button>
      <button
        type="button"
        autoFocus
        onClick={onCancel}
        className="min-h-11 rounded-full border border-stone-300 px-5 font-semibold text-stone-700 transition-colors hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill"
      >
        {tc('cancel')}
      </button>
    </div>
  );
}

function ClearAllButton() {
  const t = useT();
  const { clearHistory } = useAppStore();
  const [confirming, setConfirming] = useState(false);
  const [returnFocus, setReturnFocus] = useState(false);

  if (confirming) {
    return (
      <ClearAllConfirm
        onConfirm={() => { clearHistory(); setConfirming(false); }}
        onCancel={() => { setConfirming(false); setReturnFocus(true); }}
      />
    );
  }

  return (
    <button
      type="button"
      autoFocus={returnFocus}
      onClick={() => setConfirming(true)}
      className="flex min-h-11 items-center gap-1.5 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition-colors hover:border-alert-600 hover:text-alert-600 dark:border-ink-400 dark:text-stone-200 dark:hover:border-alert-400 dark:hover:text-alert-400"
    >
      <Trash2 size={14} aria-hidden="true" />
      {t('clear.button')}
    </button>
  );
}

// The bar after a deletion: what was removed and a way back. Rendered inside the page's polite live region.
export function UndoBar({ time, onUndo }: { time: string; onUndo: () => void }) {
  const t = useT();
  const tc = useCommonT();
  return (
    <div className="-mt-3 mb-5 flex items-center justify-between gap-3 rounded-full border border-stone-200 bg-white py-1 pl-5 pr-3 text-sm dark:border-ink-400 dark:bg-ink-50">
      <span className="text-stone-700 dark:text-stone-200">{t('undo.deleted', { time })}</span>
      <button
        type="button"
        onClick={onUndo}
        className="inline-flex min-h-11 items-center px-2 font-semibold text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-400 dark:hover:text-forest-300"
      >
        {tc('undo')}
      </button>
    </div>
  );
}

export function Log({ onGoToWatch }: { onGoToWatch?: () => void }) {
  const t = useT();
  const tc = useCommonT();
  const { incidents: allIncidents, deleteIncident, restoreIncident, confirmIncident, customTags } = useAppStore();
  // The "Not a bite" button on each alarm is the `false_positive_controls` feature. An entry already marked keeps its label
  // and its Undo whatever the flag says (the mark is data), so turning the flag off never strands one.
  const falsePositiveControls = useFalsePositiveEnabled();

  // Behaviour filter (WS1): only offered with the `detection_behaviors` flag on AND more than one
  // behaviour in the history. Otherwise `incidents` is the store's own array and nothing differs.
  const behaviorFilterOn = useBehaviorFilterEnabled();
  const behaviorsPresent = behaviorsIn(allIncidents);
  const showBehaviorFilter = behaviorFilterOn && behaviorsPresent.length > 1;
  const [pickedBehavior, setPickedBehavior] = useState<Behavior | 'all'>('all');
  const behaviorFilter = showBehaviorFilter && pickedBehavior !== 'all' && behaviorsPresent.includes(pickedBehavior) ? pickedBehavior : 'all';
  const incidents = filterByBehavior(allIncidents, behaviorFilter);
  // WS9 (flag free_tier): a free account's list shows the last few days. Same array for every other account.
  const { visible: shown, hidden: hiddenCount } = useHistoryWindow(incidents);

  // Insights (WS5): a second view under the title, only while `insights` or `photo_diary` is on.
  const insightsTab = useInsightsAvailability();
  const [view, setView] = useState<HistoryView>('history');

  // One tap on the bin used to remove an entry for good, and deleting a bite
  // silently moves the streak. The last deletion can be undone for a few
  // seconds; the bar sits above the list so it survives deleting the last one.
  const [lastDeleted, setLastDeleted] = useState<Incident | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);
  const removeEntry = (inc: Incident) => {
    deleteIncident(inc.id);
    setLastDeleted(inc);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setLastDeleted(null), 6000);
  };
  const undoDelete = () => {
    if (lastDeleted) restoreIncident(lastDeleted);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setLastDeleted(null);
  };

  // "Not a bite" entries stay in the list (so they can be taken back) but are not entries that count.
  const markedCount = shown.filter(isFalsePositive).length;
  const countedEntries = shown.length - markedCount;

  // Group by day
  const grouped: { date: string; items: typeof incidents }[] = [];
  const seen = new Set<string>();

  for (const inc of shown) {
    const key = formatDate(inc.timestamp);
    if (!seen.has(key)) {
      seen.add(key);
      grouped.push({ date: key, items: [] });
    }
    grouped[grouped.length - 1].items.push(inc);
  }

  if (insightsTab && view === 'insights') {
    return (
      <div className="p-5 sm:p-8 pb-10">
        <PageTitle mark={t('title')} />
        <HistoryInsightsSwitch view={view} onChange={setView} insightsLabel={insightsTab.label} />
        <Suspense fallback={null}>
          <InsightsView onGoToWatch={onGoToWatch} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-8 pb-10">
      <PageTitle mark={t('title')} />
      {insightsTab && <HistoryInsightsSwitch view={view} onChange={setView} insightsLabel={insightsTab.label} />}
      <PhotoReminder onOpen={() => setView('insights')} />

      <div role="status" aria-live="polite">
        {lastDeleted && <UndoBar time={formatTime(lastDeleted.timestamp)} onUndo={undoDelete} />}
      </div>

      {showBehaviorFilter && (
        <div className="-mt-2 mb-6 max-w-full overflow-x-auto">
          <SegmentedControl<Behavior | 'all'>
            ariaLabel={t('filter.label')}
            value={behaviorFilter}
            onChange={setPickedBehavior}
            options={[
              { label: t('filter.all'), value: 'all' },
              ...behaviorsPresent.map(b => ({ label: BEHAVIOR_REGISTRY[b].shortLabel, value: b as Behavior | 'all' })),
            ]}
          />
        </div>
      )}

      {/* First visit: say what will fill this page and hand over the one
          action that fills it, under the title rather than in an empty
          chart column. Otherwise: chart left, incident list right, stacking
          on narrow viewports. */}
      {incidents.length === 0 ? (
      <div className="bite sg-dark relative max-w-2xl overflow-hidden rounded-[2rem] border border-transparent bg-deep p-7 text-white sm:p-10 dark:border-ink-400">
        <Rings className="-bottom-24 -left-24 h-72 w-72 sm:h-96 sm:w-96" />
        <div className="relative flex flex-col items-start">
          <h2 className="font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-5xl">{t('empty.title')}</h2>
          <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-white/80">
            {t('empty.body')}
          </p>
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
      </div>
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-8 items-start">

        {/* Left: sticky chart + summary */}
        {/* Incident list: first in the DOM, right-hand column from xl */}
        <div>
          {incidents.length > 0 && (
            <div className="space-y-6">
              {/* Header row with clear-all */}
              <div className="flex items-center justify-between gap-3 px-1">
                {/* With nothing marked the line is short and stays on one line (as it always was). "N entries, M marked not a bite"
                    is longer: it may wrap, or at 320 px it pushed "Clear all" off the screen and made the page scroll sideways. */}
                <p className={`${markedCount === 0 ? 'shrink-0 whitespace-nowrap' : 'min-w-0'} text-sm font-semibold text-stone-700 dark:text-stone-200`}>
                  {markedCount === 0
                    ? t('list.count', { count: shown.length })
                    : t('list.countMarked', { counted: countedEntries, marked: markedCount })}
                </p>
                <ClearAllButton />
              </div>

              {grouped.map(({ date, items }) => (
                <div key={date}>
                  <h3 className="font-display text-lg font-bold tracking-[-0.02em] text-stone-900 dark:text-stone-100 mb-3 px-1">{date}</h3>
                  {/* One card per day, rows divided: a separate shadowed tile
                      for every entry fit six on a screen and read as a pile. */}
                  <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white divide-y divide-stone-200 dark:border-ink-400 dark:bg-ink-50 dark:divide-ink-400">
                    {items.map(inc => {
                      const bite = isConfirmedBite(inc);
                      const urge = isUrge(inc);
                      const notABite = isFalsePositive(inc);
                      const tagColor = notABite ? FALSE_TAG_COLOR : urge ? URGE_TAG_COLOR : bite ? BITE_TAG_COLOR : INCIDENT_TAG_COLOR;
                      const tagLabel = notABite
                        ? t('tag.notABite')
                        : urge
                          ? (inc.competingResponse?.done ? t('tag.urgeFinished', { label: URGE_TAG.label }) : URGE_TAG.label)
                          : bite
                            ? biteTagLabel(inc, customTags, t)
                            : t('tag.alarm');
                      return (
                        <div
                          key={inc.id}
                          className="group flex items-center gap-3 px-5 py-2.5"
                        >
                          {/* Time and tag together on the left, actions in
                              their own group on the right: hidden actions
                              used to push every tag to a different x. */}
                          <span className="w-20 flex-shrink-0 font-mono text-[13px] font-semibold text-stone-600 dark:text-stone-300 tabular-nums">{formatTime(inc.timestamp)}</span>
                          <span className={`inline-flex items-center gap-1 text-[13px] font-semibold px-3 py-1 rounded-full border ${tagColor}`}>
                            {inc.tag === 'auto-detected' && bite && <Check size={12} aria-hidden="true" />}
                            {tagLabel}
                          </span>
                          <div className="ml-auto flex items-center gap-1">
                            {isPendingAlarm(inc) && (
                              <button
                                onClick={() => confirmIncident(inc.id)}
                                aria-label={t('row.confirmAria', { time: formatTime(inc.timestamp) })}
                                title={t('row.confirmTitle')}
                                className="lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 flex min-h-11 items-center gap-1 px-2 text-xs text-amber-800 dark:text-amber-400 hover:text-alert-600 dark:hover:text-alert-400 transition-all duration-150 font-medium"
                              >
                                <CheckCircle size={13} />
                                <span>{t('tag.bite')}</span>
                              </button>
                            )}
                            {notABite && (
                              <button
                                onClick={() => undoNotABite(inc.id)}
                                aria-label={t('row.undoAria', { time: formatTime(inc.timestamp) })}
                                title={t('row.undoTitle')}
                                className="flex min-h-11 items-center gap-1 px-2 text-xs font-medium text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-300 dark:hover:text-forest-200"
                              >
                                {tc('undo')}
                              </button>
                            )}
                            {falsePositiveControls && inc.autoDetected && !notABite && (
                              <button
                                onClick={() => markNotABite(inc.id)}
                                aria-label={t('row.notABiteAria', { time: formatTime(inc.timestamp) })}
                                title={t('row.notABiteTitle')}
                                className="lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 flex min-h-11 items-center gap-1 px-2 text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-all duration-150"
                              >
                                {t('tag.notABite')}
                              </button>
                            )}
                            <button
                              onClick={() => removeEntry(inc)}
                              aria-label={t('row.deleteAria', { time: formatTime(inc.timestamp) })}
                              className="lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 flex min-h-11 min-w-11 items-center justify-center text-stone-500 dark:text-stone-400 hover:text-alert-600 dark:hover:text-alert-400 transition-all duration-150"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {hiddenCount > 0 && (
                <p className="px-1 text-sm text-stone-600 dark:text-stone-300">
                  {t('list.hidden', { count: hiddenCount })}
                </p>
              )}
            </div>
          )}
        </div>
        {/* Chart and summary. After the entries in the markup, so on a phone
            (and for keyboard and screen-reader order) the entries come first;
            from xl the grid puts this column on the left. */}
        <div className="xl:order-first xl:sticky xl:top-8 flex flex-col gap-4">
          {incidents.length > 0 && <WeekChart incidents={incidents} />}

          {incidents.length > 0 && (
            <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-6">
              <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-stone-900 dark:text-stone-100">{t('summary.title')}</h2>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="font-display text-5xl font-extrabold leading-none tracking-[-0.04em] tabular-nums text-stone-900 dark:text-stone-100">
                    {incidents.filter(isConfirmedBite).length}
                  </p>
                  <p className="mt-2 text-sm font-medium text-alert-600 dark:text-alert-400">{t('summary.bites')}</p>
                </div>
                <div>
                  <p className="font-display text-5xl font-extrabold leading-none tracking-[-0.04em] tabular-nums text-stone-900 dark:text-stone-100">
                    {incidents.filter(isPendingAlarm).length}
                  </p>
                  <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-400">{t('summary.alarms')}</p>
                </div>
              </div>
              <BiteInsights incidents={incidents} />
              <FalsePositiveRate incidents={incidents} />
            </div>
          )}
        </div>

      </div>
      )}
    </div>
  );
}
