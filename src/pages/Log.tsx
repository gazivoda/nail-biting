import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatTime, formatDate } from '../utils/time';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { subDays, startOfDay, format } from 'date-fns';

const TAG_COLORS: Record<string, string> = {
  'auto-detected': 'text-alert-600 dark:text-alert-400 bg-alert-100 dark:bg-alert-900/30 border-alert-400 dark:border-alert-800',
  'stress': 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700',
  'focus': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700',
  'boredom': 'text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-ink-300 border-stone-300 dark:border-ink-400',
  'unknown': 'text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-ink-300 border-stone-200 dark:border-ink-400',
};

const TAG_LABELS: Record<string, string> = {
  'auto-detected': '📷 Detected',
  'stress': '😰 Stress',
  'focus': '🧠 Focus',
  'boredom': '😐 Boredom',
  'unknown': '🤷 Unknown',
};

function WeekChart() {
  const { incidents, theme } = useAppStore();
  const isDark = theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = startOfDay(subDays(new Date(), 6 - i));
    const count = incidents.filter(inc => {
      const d = startOfDay(new Date(inc.timestamp));
      return d.getTime() === date.getTime();
    }).length;
    return { day: format(date, 'EEE'), count, date };
  });

  const max = Math.max(...days.map(d => d.count), 1);

  const tickColor = isDark ? '#6b7280' : '#78716c';
  const tooltipBg = isDark ? 'oklch(18% 0.010 200)' : '#fafaf9';
  const tooltipBorder = isDark ? 'oklch(9% 0.005 200)' : '#e7e5e4';
  const tooltipLabel = isDark ? '#d1d5db' : '#57534e';

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-6 shadow-card">
      <p className="text-stone-700 dark:text-stone-200 font-semibold mb-1">Last 7 days</p>
      <p className="text-stone-400 dark:text-stone-500 text-xs mb-6">Bites per day</p>
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
          <Bar dataKey="count" name="bites" radius={[4, 4, 0, 0]}>
            {days.map((entry, index) => {
              const intensity = max > 0 ? entry.count / max : 0;
              const color = intensity === 0
                ? (isDark ? '#374151' : '#e7e5e4')
                : intensity < 0.4
                ? (isDark ? '#166534' : '#86efac')
                : intensity < 0.7
                ? '#f59e0b'
                : '#ef4444';
              return <Cell key={index} fill={color} />;
            })}
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
          className="px-2.5 py-1 rounded-lg bg-alert-600 hover:bg-alert-400 text-white font-semibold transition-colors"
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
  const { incidents, deleteIncident } = useAppStore();

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
    <div className="p-8">
      {/* Split: chart left, incident list right */}
      <div className="grid grid-cols-[360px_1fr] gap-8 items-start">

        {/* Left: sticky chart + summary */}
        <div className="sticky top-8 flex flex-col gap-4">
          <WeekChart />

          {incidents.length > 0 && (
            <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-5 shadow-card">
              <p className="text-stone-400 dark:text-stone-500 text-[10px] uppercase tracking-widest mb-3 font-medium">Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500 dark:text-stone-400">Total incidents</span>
                  <span className="text-stone-700 dark:text-stone-200 font-semibold tabular-nums">{incidents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500 dark:text-stone-400">Auto-detected</span>
                  <span className="text-stone-700 dark:text-stone-200 font-semibold tabular-nums">
                    {incidents.filter(i => i.autoDetected).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500 dark:text-stone-400">Manually logged</span>
                  <span className="text-stone-700 dark:text-stone-200 font-semibold tabular-nums">
                    {incidents.filter(i => !i.autoDetected).length}
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
                  {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
                </p>
                <ClearAllButton />
              </div>

              {grouped.map(({ date, items }) => (
                <div key={date}>
                  <p className="text-stone-400 dark:text-stone-500 text-[10px] uppercase tracking-widest mb-3 px-1 font-medium">{date}</p>
                  <div className="space-y-2">
                    {items.map(inc => (
                      <div
                        key={inc.id}
                        className="group bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-xl px-5 py-3.5 flex items-center justify-between shadow-card"
                      >
                        <span className="text-stone-500 dark:text-stone-400 text-sm tabular-nums">{formatTime(inc.timestamp)}</span>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full border ${TAG_COLORS[inc.tag]}`}>
                            {TAG_LABELS[inc.tag]}
                          </span>
                          <button
                            onClick={() => deleteIncident(inc.id)}
                            aria-label="Delete incident"
                            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-stone-300 dark:text-stone-600 hover:text-alert-600 dark:hover:text-alert-400 transition-all duration-150"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
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
