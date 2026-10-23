import { useEffect, useRef, useState } from 'react';
import { Trash2, Check, CheckCircle, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatTime, formatDate } from '../utils/time';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { subDays, startOfDay, format } from 'date-fns';
import { Rings } from '../components/site/Rings';
import { PageTitle } from '../components/ui/PageTitle';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { PRESET_TAGS } from '../components/dashboard/triggerTags';
import { topTrigger, peakHour, hourRange, behaviorsIn, filterByBehavior } from '../utils/insights';
import { BEHAVIOR_REGISTRY } from '../detection/registry';
import { useBehaviorFilterEnabled } from '../detection/useBehaviors';
import type { Behavior } from '../storage/eventModel';
import type { CustomTag, Incident, StatsMetric } from '../types';
// One fill for every bar. Colouring bars by count (green, amber, red) meant a
// quiet day read as "safe" and clashed with the amber/red used for alarms and
// bites right beside the chart.
// The chart card is deep forest in both themes, so the bars are always lime.
const BAR_FILL = 'oklch(90% 0.2 124)';

// Two words, used the same way everywhere:
// Alarm = auto-detected and not yet reviewed (amber)
// Bite  = logged by hand OR an alarm confirmed as a bite (red)
function isConfirmedBite(inc: Incident) {
  return !inc.autoDetected || inc.confirmed === true;
}

// Every confirmed-bite tag shares the same styling — preset or custom.
const BITE_TAG_COLOR = 'text-alert-600 dark:text-alert-400 bg-alert-100 dark:bg-alert-900/30 border-alert-400 dark:border-alert-800';

const INCIDENT_TAG_COLOR = 'text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700';

// Every bite pill starts with "Bite", and a tagged one uses the same words as
// the tag picker (triggerTags.ts): "Deep focus", not "Focus".
function biteTagLabel(inc: Incident, customTags: CustomTag[]): string {
  if (inc.tag === 'auto-detected') return 'Bite';
  const preset = PRESET_TAGS.find(x => x.id === inc.tag);
  // A comma, not a middle dot: Overpass sets the dot hard against the next
  // word (DESIGN.md, the Comma Offer Rule).
  if (preset) return `Bite, ${preset.label}`;
  const custom = customTags.find(x => x.id === inc.tag);
  return custom ? ['Bite,', custom.emoji, custom.label].filter(Boolean).join(' ') : 'Bite';
}

// What the empty state promises ("this page shows what sets you off"), from
// confirmed and logged bites only. Each row appears once there is enough data
// to mean something (see utils/insights).
function BiteInsights({ incidents: shown }: { incidents?: Incident[] }) {
  const { incidents: all, customTags } = useAppStore();
  const incidents = shown ?? all;
  const bites = incidents.filter(isConfirmedBite);
  const trigger = topTrigger(bites);
  const peak = peakHour(bites);
  if (!trigger && !peak) return null;
  const triggerLabel = trigger
    ? [...PRESET_TAGS, ...customTags].find(t => t.id === trigger.tag)?.label ?? trigger.tag
    : null;
  return (
    <div className="mt-4 space-y-2 border-t border-stone-200 pt-4 text-sm dark:border-ink-400">
      {trigger && (
        <div className="flex justify-between gap-4">
          <span className="text-stone-600 dark:text-stone-300">Top trigger</span>
          <span className="text-right font-semibold text-stone-700 dark:text-stone-200">
            {triggerLabel} <span className="font-normal text-stone-500 dark:text-stone-400">({trigger.count} of {trigger.of} tagged)</span>
          </span>
        </div>
      )}
      {peak && (
        <div className="flex justify-between gap-4">
          <span className="text-stone-600 dark:text-stone-300">Most bites</span>
          <span className="text-right font-semibold text-stone-700 dark:text-stone-200">{hourRange(peak.hour)}</span>
        </div>
      )}
    </div>
  );
}

function WeekChart({ incidents: shown }: { incidents?: Incident[] }) {
  const { incidents: all, weekChartMetric, setWeekChartMetric } = useAppStore();
  const incidents = shown ?? all;

  const relevantIncidents = weekChartMetric === 'confirmed'
    ? incidents.filter(isConfirmedBite)
    : incidents;

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = startOfDay(subDays(new Date(), 6 - i));
    const count = relevantIncidents.filter(inc => {
      const d = startOfDay(new Date(inc.timestamp));
      return d.getTime() === date.getTime();
    }).length;
    return { day: format(date, 'EEE'), count, date };
  });

  const total = days.reduce((n, d) => n + d.count, 0);
  const busiest = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]);
  const noun = weekChartMetric === 'confirmed' ? 'bite' : 'entry';
  const summary = total === 0
    ? `No ${noun === 'bite' ? 'bites' : 'entries'} in the last 7 days.`
    : `${total} ${total === 1 ? noun : noun === 'bite' ? 'bites' : 'entries'} this week, most on ${format(busiest.date, 'EEEE')} (${busiest.count}).`;

  const tickColor = 'oklch(100% 0 0 / 0.72)';
  const tooltipBg = 'oklch(31% 0.06 160)';
  const tooltipBorder = 'oklch(100% 0 0 / 0.16)';

  return (
    <div className="bite sg-dark relative overflow-hidden rounded-2xl border border-transparent bg-deep p-6 text-white dark:border-ink-400">
      <h2 className="font-display text-lg font-bold tracking-[-0.02em]">Last 7 days</h2>
      <p className="mt-3 flex items-baseline gap-3">
        <span className="font-display text-7xl font-extrabold leading-none tracking-[-0.045em] tabular-nums">{total}</span>
        <span className="text-base font-medium text-white/75">
          {total === 1 ? noun : noun === 'bite' ? 'bites' : 'entries'} this week
        </span>
      </p>
      <p className="mt-2 text-sm text-white/75">
        {weekChartMetric === 'confirmed' ? 'Bites per day' : 'Alarms and bites per day'}. {total === 0 ? summary : `Most on ${format(busiest.date, 'EEEE')} (${busiest.count}).`}
      </p>
      <div className="mt-4">
        <SegmentedControl<StatsMetric>
          ariaLabel="Chart shows"
          onDeep
          value={weekChartMetric}
          onChange={setWeekChartMetric}
          options={[
            { label: 'All', value: 'incidents' },
            { label: 'Bites', value: 'confirmed' },
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
            <Bar dataKey="count" name={weekChartMetric === 'confirmed' ? 'bites' : 'entries'} radius={[8, 8, 0, 0]} fill={BAR_FILL} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Clears History only. Settings and bite reasons are the Settings page's
// "Clear all data", which says so. Focus goes to Cancel on open (the safe
// choice) and back to the trigger on cancel, never to <body>.
function ClearAllButton() {
  const { clearHistory } = useAppStore();
  const [confirming, setConfirming] = useState(false);
  const [returnFocus, setReturnFocus] = useState(false);

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
        <span className="text-stone-600 dark:text-stone-300">Clear all history? This can't be undone.</span>
        <button
          type="button"
          onClick={() => { clearHistory(); setConfirming(false); }}
          className="min-h-11 rounded-full bg-alert-600 px-5 font-semibold text-cream-100 transition-colors hover:bg-alert-800"
        >
          Yes, clear
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => { setConfirming(false); setReturnFocus(true); }}
          className="min-h-11 rounded-full border border-stone-300 px-5 font-semibold text-stone-700 transition-colors hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill"
        >
          Cancel
        </button>
      </div>
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
      Clear all
    </button>
  );
}

export function Log({ onGoToWatch }: { onGoToWatch?: () => void }) {
  const { incidents: allIncidents, deleteIncident, restoreIncident, confirmIncident, customTags } = useAppStore();

  // Behaviour filter (WS1): only offered with the `detection_behaviors` flag on AND more than one
  // behaviour in the history. Otherwise `incidents` is the store's own array and nothing differs.
  const behaviorFilterOn = useBehaviorFilterEnabled();
  const behaviorsPresent = behaviorsIn(allIncidents);
  const showBehaviorFilter = behaviorFilterOn && behaviorsPresent.length > 1;
  const [pickedBehavior, setPickedBehavior] = useState<Behavior | 'all'>('all');
  const behaviorFilter = showBehaviorFilter && pickedBehavior !== 'all' && behaviorsPresent.includes(pickedBehavior) ? pickedBehavior : 'all';
  const incidents = filterByBehavior(allIncidents, behaviorFilter);

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

  // Group by day
  const grouped: { date: string; items: typeof incidents }[] = [];
  const seen = new Set<string>();

  for (const inc of incidents) {
    const key = formatDate(inc.timestamp);
    if (!seen.has(key)) {
      seen.add(key);
      grouped.push({ date: key, items: [] });
    }
    grouped[grouped.length - 1].items.push(inc);
  }

  return (
    <div className="p-5 sm:p-8 pb-10">
      <PageTitle mark="History" />

      <div role="status" aria-live="polite">
        {lastDeleted && (
          <div className="-mt-3 mb-5 flex items-center justify-between gap-3 rounded-full border border-stone-200 bg-white py-1 pl-5 pr-3 text-sm dark:border-ink-400 dark:bg-ink-50">
            <span className="text-stone-700 dark:text-stone-200">Entry from {formatTime(lastDeleted.timestamp)} deleted.</span>
            <button
              type="button"
              onClick={undoDelete}
              className="inline-flex min-h-11 items-center px-2 font-semibold text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-400 dark:hover:text-forest-300"
            >
              Undo
            </button>
          </div>
        )}
      </div>

      {showBehaviorFilter && (
        <div className="-mt-2 mb-6 max-w-full overflow-x-auto">
          <SegmentedControl<Behavior | 'all'>
            ariaLabel="Show behavior"
            value={behaviorFilter}
            onChange={setPickedBehavior}
            options={[
              { label: 'All', value: 'all' },
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
          <h2 className="font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-5xl">No history yet</h2>
          <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-white/80">
            Alarms from the Watch tab and bites you log with “I just bit my nails” appear here, day by day. Tag them and this page shows what sets you off.
          </p>
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
                <p className="shrink-0 whitespace-nowrap text-sm font-semibold text-stone-700 dark:text-stone-200">
                  {incidents.length} {incidents.length !== 1 ? 'entries' : 'entry'}
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
                      const tagColor = bite ? BITE_TAG_COLOR : INCIDENT_TAG_COLOR;
                      const tagLabel = bite
                        ? biteTagLabel(inc, customTags)
                        : 'Alarm';
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
                            {inc.autoDetected && !inc.confirmed && (
                              <button
                                onClick={() => confirmIncident(inc.id)}
                                aria-label={`Confirm alarm at ${formatTime(inc.timestamp)} as a bite`}
                                title="This was an actual bite"
                                className="lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 flex min-h-11 items-center gap-1 px-2 text-xs text-amber-800 dark:text-amber-400 hover:text-alert-600 dark:hover:text-alert-400 transition-all duration-150 font-medium"
                              >
                                <CheckCircle size={13} />
                                <span>Bite</span>
                              </button>
                            )}
                            <button
                              onClick={() => removeEntry(inc)}
                              aria-label={`Delete entry from ${formatTime(inc.timestamp)}`}
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
              <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-stone-900 dark:text-stone-100">Summary</h2>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="font-display text-5xl font-extrabold leading-none tracking-[-0.04em] tabular-nums text-stone-900 dark:text-stone-100">
                    {incidents.filter(isConfirmedBite).length}
                  </p>
                  <p className="mt-2 text-sm font-medium text-alert-600 dark:text-alert-400">Bites</p>
                </div>
                <div>
                  <p className="font-display text-5xl font-extrabold leading-none tracking-[-0.04em] tabular-nums text-stone-900 dark:text-stone-100">
                    {incidents.filter(i => i.autoDetected && !i.confirmed).length}
                  </p>
                  <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-400">Alarms to review</p>
                </div>
              </div>
              <BiteInsights incidents={incidents} />
            </div>
          )}
        </div>

      </div>
      )}
    </div>
  );
}
