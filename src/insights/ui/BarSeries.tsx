// A row of vertical bars: the daily and the weekly chart.
//
// Plain HTML and CSS (flex columns), no chart library: the labels stay at a fixed, readable size at any width
// (an SVG that scales to a phone would shrink its text with it), the markup is real in a server-side render so
// it can be tested, and the bars are drawn in the app's own tokens. The picture is hidden from assistive
// technology (`aria-hidden`); the image's name carries the summary sentence, and each bar has a `title` for
// pointer users.

export interface BarDatum {
  key: string | number;
  value: number;
  /** Text under the bar. Leave empty for most bars of a long series. */
  label?: string;
  /** Hover text, e.g. "Tue 20 Oct: 3 bites". */
  title: string;
}

export function BarSeries({ data, summary, showValues = false, emptyText }: {
  data: readonly BarDatum[];
  /** A sentence that says what the chart shows; it is the chart's accessible name. */
  summary: string;
  /** Print the number above each non-empty bar (for a short series). */
  showValues?: boolean;
  /** Shown instead of the bars when every value is 0. */
  emptyText: string;
}) {
  const max = data.reduce((m, d) => (d.value > m ? d.value : m), 0);
  const gap = data.length > 14 ? 'gap-[3px]' : 'gap-2';

  return (
    <div role="img" aria-label={summary} className="m-0">
      <div className="relative" aria-hidden="true">
        <div className={`flex h-40 items-end ${gap} border-b border-stone-200 dark:border-ink-400`}>
          {data.map(d => (
            <div key={d.key} title={d.title} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              {showValues && d.value > 0 && (
                <span className="mb-1 text-center text-xs font-semibold tabular-nums text-stone-700 dark:text-stone-200">{d.value}</span>
              )}
              <div
                className={`w-full rounded-t-md ${d.value > 0 ? 'bg-forest-500 dark:bg-lime-300' : 'bg-stone-200 dark:bg-ink-400'}`}
                style={{ height: d.value > 0 ? `${Math.max(6, (d.value / max) * (showValues ? 82 : 100))}%` : '2px' }}
              />
            </div>
          ))}
        </div>
        {max === 0 && (
          <p className="absolute inset-0 flex items-center justify-center px-6 pb-2 text-center text-sm text-stone-600 dark:text-stone-300">
            {emptyText}
          </p>
        )}
      </div>
      <div className={`mt-2 flex ${gap}`} aria-hidden="true">
        {data.map(d => (
          <span key={d.key} className="relative h-4 min-w-0 flex-1">
            {d.label && (
              <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium leading-4 tabular-nums text-stone-600 dark:text-stone-300">
                {d.label}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
