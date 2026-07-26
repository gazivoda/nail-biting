import { useState } from 'react';
import { Trash2, CheckCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatTime, formatDate } from '../utils/time';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { subDays, startOfDay, format } from 'date-fns';
import { PageHeader } from '../components/layout/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import type { CustomTag, Incident, StatsMetric } from '../types';
import { severityForCount, type Severity } from '../utils/severity';

const SEVERITY_FILL: Record<Severity, { light: string; dark: string }> = {
  none:   { light: '#e7e5e4', dark: '#374151' },
  low:    { light: '#86efac', dark: '#166534' },
  medium: { light: '#f59e0b', dark: '#f59e0b' },
  high:   { light: '#ef4444', dark: '#ef4444' },
};

// Incidents = auto-detected & not yet confirmed as a bite (amber)
// Bites = manually logged OR confirmed auto-detected (red)
function isConfirmedBite(inc: Incident) {
  return !inc.autoDetected || inc.confirmed === true;
}

// Every confirmed-bite tag shares the same styling — preset or custom.
const BITE_TAG_COLOR = 'text-alert-600 dark:text-alert-400 bg-alert-100 dark:bg-alert-900/30 border-alert-400 dark:border-alert-800';

const INCIDENT_TAG_COLOR = 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700';

const BITE_TAG_LABELS: Record<string, string> = {
  'auto-detected': '✓ Bite',
  'stress': '😰 Stress',
  'focus': '🧠 Focus',
  'boredom': '😐 Boredom',
  'unknown': '🤷 Unknown',
};

function biteTagLabel(inc: Incident, customTags: CustomTag[]): string {
  const preset = BITE_TAG_LABELS[inc.tag];
  if (preset) return preset;
  const custom = customTags.find(t => t.id === inc.tag);
  return custom ? `${custom.emoji} ${custom.label}` : '🏷️ Other';
}

function WeekChart() {
  const { incidents, theme, weekChartMetric, setWeekChartMetric } = useAppStore();
  const isDark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

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

  const tickColor = isDark ? '#6b7280' : '#78716c';
  const tooltipBg = isDark ? 'oklch(18% 0.010 200)' : '#fafaf9';
  const tooltipBorder = isDark ? 'oklch(9% 0.005 200)' : '#e7e5e4';
  const tooltipLabel = isDark ? '#d1d5db' : '#57534e';

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-6 shadow-card dark:shadow-card-dark">
      <div className="flex items-center justify-between mb-1">
        <p className="text-stone-700 dark:text-stone-200 font-semibold">Last 7 days</p>
        <SegmentedControl<StatsMetric>
          value={weekChartMetric}
          onChange={setWeekChartMetric}
          options={[
            { label: 'Incidents', value: 'incidents' },
            { label: 'Confirmed', value: 'confirmed' },
          ]}
        />
      </div>
      <p className="text-stone-400 dark:text-stone-500 text-xs mb-6">
        {weekChartMetric === 'confirmed' ? 'Confirmed bites per day' : 'Incidents per day'}
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={days} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fill: tickColor, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: tickColor, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: tooltipLabel }}
            itemStyle={{ color: isDark ? '#f87171' : '#dc2626' }}
            cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}
          />
          <Bar dataKey="count" name={weekChartMetric === 'confirmed' ? 'confirmed bites' : 'incidents'} radius={[4, 4, 0, 0]}>
            {days.map((entry, index) => (
              <Cell key={index} fill={SEVERITY_FILL[severityForCount(entry.count)][isDark ? 'dark' : 'light']} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ClearAllButton() {
  const { clearAllData } = useAppStore();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-stone-500 dark:text-stone-400">Clear all data?</span>
        <button
          onClick={() => { clearAllData(); setConfirming(false); }}
          className="px-2.5 py-1 rounded-lg bg-alert-600 hover:bg-alert-800 text-cream-100 font-semibold transition-colors"
        >
          Yes, clear
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2.5 py-1 rounded-lg border border-stone-200 dark:border-ink-400 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 hover:text-alert-600 dark:hover:text-alert-400 transition-colors"
    >
      <Trash2 size={12} />
      Clear all
    </button>
  );
}

export function Log() {
  const { incidents, deleteIncident, confirmIncident, customTags } = useAppStore();

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
      <PageHeader eyebrow="Progress" title="Patterns & milestones" />

      {/* Split: chart left, incident list right — stacks on narrow sidebar viewports */}
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-8 items-start">

        {/* Left: sticky chart + summary */}
        <div className="xl:sticky xl:top-8 flex flex-col gap-4">
          <WeekChart />

          {incidents.length > 0 && (
            <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-5 shadow-card dark:shadow-card-dark">
              <p className="text-stone-400 dark:text-stone-500 text-[10px] uppercase tracking-widest mb-3 font-medium">Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-amber-600 dark:text-amber-400">Incidents (unconfirmed)</span>
                  <span className="text-stone-700 dark:text-stone-200 font-semibold tabular-nums">
                    {incidents.filter(i => i.autoDetected && !i.confirmed).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-alert-600 dark:text-alert-400">Confirmed bites</span>
                  <span className="text-stone-700 dark:text-stone-200 font-semibold tabular-nums">
                    {incidents.filter(isConfirmedBite).length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: incident list */}
        <div>
          {incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-stone-400 dark:text-stone-500">
              <p className="text-5xl mb-4">🙌</p>
              <p className="font-semibold text-stone-500 dark:text-stone-400 text-lg">No incidents logged yet</p>
              <p className="text-sm mt-1">Keep it that way!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header row with clear-all */}
              <div className="flex items-center justify-between px-1">
                <p className="text-stone-400 dark:text-stone-500 text-[10px] uppercase tracking-widest font-medium">
                  {incidents.length} {incidents.length !== 1 ? 'entries' : 'entry'}
                </p>
                <ClearAllButton />
              </div>

              {grouped.map(({ date, items }) => (
                <div key={date}>
                  <p className="text-stone-400 dark:text-stone-500 text-[10px] uppercase tracking-widest mb-3 px-1 font-medium">{date}</p>
                  <div className="space-y-2">
                    {items.map(inc => {
                      const bite = isConfirmedBite(inc);
                      const tagColor = bite ? BITE_TAG_COLOR : INCIDENT_TAG_COLOR;
                      const tagLabel = bite
                        ? (inc.confirmed ? '✓ Bite (confirmed)' : biteTagLabel(inc, customTags))
                        : '📷 Incident';
                      return (
                        <div
                          key={inc.id}
                          className="group bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-xl px-5 py-3.5 flex items-center justify-between shadow-card dark:shadow-card-dark"
                        >
                          <span className="text-stone-500 dark:text-stone-400 text-sm tabular-nums">{formatTime(inc.timestamp)}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2.5 py-1 rounded-full border ${tagColor}`}>
                              {tagLabel}
                            </span>
                            {inc.autoDetected && !inc.confirmed && (
                              <button
                                onClick={() => confirmIncident(inc.id)}
                                aria-label="Confirm as bite"
                                title="This was an actual bite"
                                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-alert-600 dark:hover:text-alert-400 transition-all duration-150 font-medium"
                              >
                                <CheckCircle size={13} />
                                <span>Bite</span>
                              </button>
                            )}
                            <button
                              onClick={() => deleteIncident(inc.id)}
                              aria-label="Delete"
                              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-stone-300 dark:text-stone-600 hover:text-alert-600 dark:hover:text-alert-400 transition-all duration-150"
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
      </div>
    </div>
  );
}
