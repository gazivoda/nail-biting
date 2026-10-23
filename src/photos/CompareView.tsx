// Before / after: any two photos, one on top of the other, with a slider that
// reveals the earlier one from the left. Two canvases stacked and clipped (no
// <img>, no blob URL), a real <input type="range"> for keyboard and touch, and
// dragging on the picture itself.

import { useId, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { format } from 'date-fns';
import { PhotoCanvas } from './PhotoCanvas';
import { defaultComparePair, sortNewestFirst, type PhotoMeta } from './diaryMeta';

export interface CompareViewProps {
  photos: readonly PhotoMeta[];
  loadBlob: (id: string) => Promise<Blob | null>;
  /** Starting slider position, 0 to 100 (tests). */
  initialPosition?: number;
}

const dateLabel = (ms: number) => format(ms, 'd MMM yyyy');

export function CompareView({ photos, loadBlob, initialPosition = 50 }: CompareViewProps) {
  const beforeSelectId = useId();
  const afterSelectId = useId();
  const [picked, setPicked] = useState<{ before?: string; after?: string }>({});
  const [position, setPosition] = useState(initialPosition);

  if (photos.length < 2) {
    return (
      <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
        You need two photos to compare. Take another one next week and this is where you can lay it over today's.
      </p>
    );
  }

  const byId = new Map(photos.map(p => [p.id, p]));
  const fallback = defaultComparePair(photos)!;
  const beforeId = picked.before && byId.has(picked.before) ? picked.before : fallback.beforeId;
  const afterId = picked.after && byId.has(picked.after) ? picked.after : fallback.afterId;
  const before = byId.get(beforeId)!;
  const after = byId.get(afterId)!;
  const same = beforeId === afterId;
  const options = sortNewestFirst(photos);

  const setFromPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return;
    setPosition(Math.min(100, Math.max(0, Math.round(((e.clientX - box.left) / box.width) * 100))));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={beforeSelectId} className="block text-sm font-semibold text-stone-800 dark:text-stone-100">
          Before
          <select
            id={beforeSelectId}
            value={beforeId}
            onChange={e => setPicked(p => ({ ...p, before: e.target.value }))}
            className="mt-1 block min-h-11 w-full rounded-full border border-stone-300 bg-white px-4 text-sm font-normal text-stone-900 dark:border-ink-400 dark:bg-ink-fill dark:text-stone-100"
          >
            {options.map(p => <option key={p.id} value={p.id}>{dateLabel(p.takenAt)}</option>)}
          </select>
        </label>
        <label htmlFor={afterSelectId} className="block text-sm font-semibold text-stone-800 dark:text-stone-100">
          After
          <select
            id={afterSelectId}
            value={afterId}
            onChange={e => setPicked(p => ({ ...p, after: e.target.value }))}
            className="mt-1 block min-h-11 w-full rounded-full border border-stone-300 bg-white px-4 text-sm font-normal text-stone-900 dark:border-ink-400 dark:bg-ink-fill dark:text-stone-100"
          >
            {options.map(p => <option key={p.id} value={p.id}>{dateLabel(p.takenAt)}</option>)}
          </select>
        </label>
      </div>

      {same && (
        <p role="status" className="text-sm text-stone-600 dark:text-stone-300">
          Both sides show the same photo. Pick two different dates to see a difference.
        </p>
      )}

      <div
        data-testid="compare-stage"
        onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); setFromPointer(e); }}
        onPointerMove={e => { if (e.buttons > 0) setFromPointer(e); }}
        className="relative mx-auto w-full max-w-2xl touch-pan-y select-none overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 dark:border-ink-400 dark:bg-ink-fill"
        style={{ aspectRatio: `${after.width} / ${after.height}` }}
      >
        <PhotoCanvas
          sourceKey={after.id}
          load={() => loadBlob(after.id)}
          maxWidth={960}
          label={`Photo from ${dateLabel(after.takenAt)} (after)`}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <PhotoCanvas
          sourceKey={before.id}
          load={() => loadBlob(before.id)}
          maxWidth={960}
          label={`Photo from ${dateLabel(before.takenAt)} (before)`}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white"
          style={{ left: `${position}%` }}
        >
          <span className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-deep/70" />
        </div>
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
          Before, {dateLabel(before.takenAt)}
        </span>
        <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
          After, {dateLabel(after.takenAt)}
        </span>
      </div>

      <div className="mx-auto max-w-2xl">
        <label htmlFor={`${beforeSelectId}-slider`} className="sr-only">Reveal the earlier photo</label>
        <input
          id={`${beforeSelectId}-slider`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={position}
          onChange={e => setPosition(Number(e.target.value))}
          aria-valuetext={`The earlier photo is shown across ${position} percent of the picture`}
          className="block h-11 w-full cursor-ew-resize accent-forest-500 dark:accent-lime-300"
        />
        <p className="mt-1 text-center text-xs text-stone-600 dark:text-stone-300">
          Drag the picture or the slider to move between the two.
        </p>
      </div>
    </div>
  );
}
