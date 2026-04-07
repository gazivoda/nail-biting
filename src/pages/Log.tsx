import { useAppStore } from '../store/useAppStore';
import { formatTime, formatDate } from '../utils/time';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { subDays, startOfDay, format } from 'date-fns';

const TAG_COLORS: Record<string, string> = {
  'auto-detected': 'text-alert-600 bg-alert-100 border-alert-400',
  'stress': 'text-amber-600 bg-amber-50 border-amber-300',
  'focus': 'text-blue-600 bg-blue-50 border-blue-300',
  'boredom': 'text-stone-500 bg-stone-100 border-stone-300',
  'unknown': 'text-stone-400 bg-stone-100 border-stone-200',
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
    <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
      <p className="text-stone-700 font-semibold mb-1">Last 7 days</p>
      <p className="text-stone-400 text-xs mb-6">Bites per day</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={days} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fill: '#78716c', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#78716c', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#57534e' }}
            itemStyle={{ color: '#dc2626' }}
            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
          />
          <Bar dataKey="count" name="bites" radius={[4, 4, 0, 0]}>
            {days.map((entry, index) => {
              const intensity = max > 0 ? entry.count / max : 0;
              const color = intensity === 0 ? '#e7e5e4' : intensity < 0.4 ? '#86efac' : intensity < 0.7 ? '#f59e0b' : '#ef4444';
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
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
              <p className="text-stone-400 text-xs uppercase tracking-wider mb-3">Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">Total incidents</span>
                  <span className="text-stone-700 font-medium tabular-nums">{incidents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Auto-detected</span>
                  <span className="text-stone-700 font-medium tabular-nums">
                    {incidents.filter(i => i.autoDetected).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Manually logged</span>
                  <span className="text-stone-700 font-medium tabular-nums">
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
            <div className="flex flex-col items-center justify-center py-24 text-stone-400">
              <p className="text-5xl mb-4">🙌</p>
              <p className="font-medium text-stone-500 text-lg">No incidents logged yet</p>
              <p className="text-sm mt-1">Keep it that way!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(({ date, items }) => (
                <div key={date}>
                  <p className="text-stone-400 text-xs uppercase tracking-widest mb-3 px-1">{date}</p>
                  <div className="space-y-2">
                    {items.map(inc => (
                      <div
                        key={inc.id}
                        className="bg-white border border-stone-200 rounded-xl px-5 py-3.5 flex items-center justify-between shadow-sm"
                      >
                        <span className="text-stone-500 text-sm tabular-nums">{formatTime(inc.timestamp)}</span>
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
