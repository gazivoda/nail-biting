import { useAppStore } from '../store/useAppStore';
import { formatTime, formatDate } from '../utils/time';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { subDays, startOfDay, format } from 'date-fns';

const TAG_COLORS: Record<string, string> = {
  'auto-detected': 'text-red-400 bg-red-950 border-red-900',
  'stress': 'text-amber-400 bg-amber-950 border-amber-900',
  'focus': 'text-blue-400 bg-blue-950 border-blue-900',
  'boredom': 'text-slate-400 bg-slate-800 border-slate-700',
  'unknown': 'text-slate-500 bg-slate-900 border-slate-800',
};

const TAG_LABELS: Record<string, string> = {
  'auto-detected': '📷 Detected',
  'stress': '😰 Stress',
  'focus': '🧠 Focus',
  'boredom': '😐 Boredom',
  'unknown': '🤷 Unknown',
};

function WeekChart() {
  const { incidents } = useAppStore();

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = startOfDay(subDays(new Date(), 6 - i));
    const count = incidents.filter(inc => {
      const d = startOfDay(new Date(inc.timestamp));
      return d.getTime() === date.getTime();
    }).length;
    return { day: format(date, 'EEE'), count, date };
  });

  const max = Math.max(...days.map(d => d.count), 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <p className="text-slate-300 font-semibold mb-1">Last 7 days</p>
      <p className="text-slate-500 text-xs mb-6">Bites per day</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={days} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: '#f87171' }}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <Bar dataKey="count" name="bites" radius={[4, 4, 0, 0]}>
            {days.map((entry, index) => {
              const intensity = max > 0 ? entry.count / max : 0;
              const color = intensity === 0 ? '#1e293b' : intensity < 0.4 ? '#065f46' : intensity < 0.7 ? '#d97706' : '#ef4444';
              return <Cell key={index} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Log() {
  const { incidents } = useAppStore();

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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total incidents</span>
                  <span className="text-slate-200 font-medium tabular-nums">{incidents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Auto-detected</span>
                  <span className="text-slate-200 font-medium tabular-nums">
                    {incidents.filter(i => i.autoDetected).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Manually logged</span>
                  <span className="text-slate-200 font-medium tabular-nums">
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
            <div className="flex flex-col items-center justify-center py-24 text-slate-600">
              <p className="text-5xl mb-4">🙌</p>
              <p className="font-medium text-slate-400 text-lg">No incidents logged yet</p>
              <p className="text-sm mt-1">Keep it that way!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(({ date, items }) => (
                <div key={date}>
                  <p className="text-slate-500 text-xs uppercase tracking-widest mb-3 px-1">{date}</p>
                  <div className="space-y-2">
                    {items.map(inc => (
                      <div
                        key={inc.id}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3.5 flex items-center justify-between"
                      >
                        <span className="text-slate-400 text-sm tabular-nums">{formatTime(inc.timestamp)}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full border ${TAG_COLORS[inc.tag]}`}>
                          {TAG_LABELS[inc.tag]}
                        </span>
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
