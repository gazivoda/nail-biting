// Bites by weekday (rows, Monday first) and hour of the day (24 columns).
//
// A CSS grid of small squares: empty cells are a quiet tint, the rest are the accent colour at a strength
// that follows the count (never fully transparent, so a single bite is visible). The figure is named by a
// sentence; the squares themselves are hidden from assistive technology and carry a `title` for pointer users.

import type { Heatmap } from '../aggregate';
import { WEEKDAY_SHORT, hourLabel, plural } from '../labels';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const HOUR_TICKS = new Set([0, 6, 12, 18]);

export function HeatmapGrid({ heatmap, summary }: { heatmap: Heatmap; summary: string }) {
  const { cells, max } = heatmap;
  return (
    <figure role="img" aria-label={summary} className="m-0">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'auto repeat(24, minmax(0, 1fr))' }} aria-hidden="true">
        <span />
        {HOURS.map(h => (
          <span key={h} className="relative h-4">
            {HOUR_TICKS.has(h) && (
              <span className="absolute left-0 whitespace-nowrap text-[11px] font-medium leading-4 text-stone-600 dark:text-stone-300">
                {hourLabel(h).replace(' ', '')}
              </span>
            )}
          </span>
        ))}
        {WEEKDAY_SHORT.map((day, row) => (
          <Row key={day} day={day} row={row} cells={cells} max={max} />
        ))}
      </div>
      <figcaption className="mt-3 flex items-center justify-end gap-2 text-xs text-stone-600 dark:text-stone-300" aria-hidden="true">
        Fewer
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <span
            key={t}
            className={`h-3 w-3 rounded-[3px] ${t === 0 ? 'bg-stone-100 dark:bg-ink-fill' : 'bg-forest-500 dark:bg-lime-300'}`}
            style={t === 0 ? undefined : { opacity: 0.25 + 0.75 * t }}
          />
        ))}
        More
      </figcaption>
    </figure>
  );
}

function Row({ day, row, cells, max }: { day: string; row: number; cells: readonly number[]; max: number }) {
  return (
    <>
      <span className="self-center pr-2 text-xs font-medium text-stone-600 dark:text-stone-300">{day}</span>
      {HOURS.map(h => {
        const n = cells[row * 24 + h];
        return (
          <span
            key={h}
            title={`${day} ${hourLabel(h)}: ${n} ${plural(n, 'bite')}`}
            className={`aspect-square rounded-[3px] ${n === 0 ? 'bg-stone-100 dark:bg-ink-fill' : 'bg-forest-500 dark:bg-lime-300'}`}
            style={n === 0 ? undefined : { opacity: 0.25 + 0.75 * (n / max) }}
          />
        );
      })}
    </>
  );
}
