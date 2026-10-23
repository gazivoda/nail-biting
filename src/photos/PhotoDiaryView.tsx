// The photo diary screen as a props-only view: header and privacy statement, the open
// capture panel (passed in), the photo grid, the before/after slider, delete controls.
// PhotoDiary.tsx supplies the data and the handlers; the tests render this directly.
//
// Colours follow DESIGN.md: white cards with a hairline (ink-50 with an ink-400 line in
// dark mode), pills, no shadows. Nothing here draws a hand, a face or a mouth.

import { useRef, type ReactNode } from 'react';
import { format } from 'date-fns';
import { Camera, Lock } from 'lucide-react';
import { CompareView } from './CompareView';
import { PhotoCanvas } from './PhotoCanvas';
import { TwoStepDelete } from './TwoStepDelete';
import { describeAge, formatBytes, isDue, totalBytes, type PhotoMeta } from './diaryMeta';
import { INTRO, NOT_MEDICAL, NOT_SAVED_WARNING, PRIVACY_DETAIL, PRIVACY_STATEMENT } from './copy';

export interface PhotoDiaryViewProps {
  /** null while the photos are being read. */
  photos: readonly PhotoMeta[] | null;
  /** false when the browser is only holding photos in memory for this tab. */
  persistent: boolean;
  /** false in a browser that cannot decode images off-screen. */
  canDecode?: boolean;
  now: number;
  /** A short message for screen readers and sighted users: "Photo saved." */
  status: string;
  /** The open capture panel, or null. */
  capture: ReactNode | null;
  loadBlob: (id: string) => Promise<Blob | null>;
  onStartCapture: () => void;
  onDeleteOne: (id: string) => void;
  onDeleteAll: () => void;
}

const card = 'rounded-2xl border border-stone-200 bg-white p-5 dark:border-ink-400 dark:bg-ink-50 sm:p-6';
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-deep px-6 font-display text-sm font-bold text-white transition-colors hover:bg-deep-2 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200';

/** The button that opens the capture panel; focus returns to it when the panel closes. */
export const TAKE_BUTTON_ID = 'photo-diary-take';

const dayLabel = (ms: number) => format(ms, 'd MMM yyyy');

export function PhotoDiaryView(p: PhotoDiaryViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const photos = p.photos ?? [];
  const empty = p.photos !== null && photos.length === 0;
  const due = p.photos !== null && isDue(photos, p.now);

  const deleteOne = (id: string) => {
    p.onDeleteOne(id);
    headingRef.current?.focus(); // the photo that had focus is gone: land somewhere sensible
  };
  const deleteAll = () => {
    p.onDeleteAll();
    headingRef.current?.focus();
  };

  return (
    <section aria-labelledby="photo-diary-title" className="space-y-6">
      {empty && !p.capture ? (
        <div className="sg-dark relative overflow-hidden rounded-[2rem] border border-transparent bg-deep p-7 text-white dark:border-ink-400 sm:p-10">
          <h2
            id="photo-diary-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.045em] outline-none sm:text-5xl"
          >
            Photo diary
          </h2>
          <p className="mt-4 max-w-lg text-pretty text-base leading-relaxed text-white/80">{INTRO}</p>
          <div className="mt-6 flex max-w-lg items-start gap-3 text-sm leading-relaxed text-white/80">
            <Lock size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
            <p>{PRIVACY_STATEMENT} {PRIVACY_DETAIL}</p>
          </div>
          <button
            type="button"
            id={TAKE_BUTTON_ID}
            onClick={p.onStartCapture}
            className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-lime-300 px-6 font-display text-base font-bold text-deep transition-colors hover:bg-lime-200"
          >
            <Camera size={18} aria-hidden="true" />
            Take your first photo
          </button>
          <p className="mt-5 text-xs text-white/70">{NOT_MEDICAL}</p>
        </div>
      ) : (
        <div className={card}>
          <h2
            id="photo-diary-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-2xl font-bold tracking-[-0.02em] text-stone-900 outline-none dark:text-stone-100"
          >
            Photo diary
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600 dark:text-stone-300">{INTRO}</p>
          <div className="mt-4 flex max-w-xl items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-relaxed text-stone-700 dark:border-ink-400 dark:bg-ink-100 dark:text-stone-200">
            <Lock size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
            <p>{PRIVACY_STATEMENT} {PRIVACY_DETAIL}</p>
          </div>
          {due && photos.length > 0 && (
            <p className="mt-4 text-sm font-semibold text-stone-800 dark:text-stone-100">
              Your last photo was {describeAge(photos[0].takenAt, p.now)}. A new one is due.
            </p>
          )}
          {!p.capture && p.photos !== null && (
            <button type="button" id={TAKE_BUTTON_ID} onClick={p.onStartCapture} className={`${primary} mt-5`}>
              <Camera size={16} aria-hidden="true" />
              Take this week's photo
            </button>
          )}
        </div>
      )}

      <p role="status" aria-live="polite" className={p.status === '' ? 'sr-only' : 'text-sm font-semibold text-stone-800 dark:text-stone-100'}>
        {p.status}
      </p>

      {!p.persistent && (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          {NOT_SAVED_WARNING}
        </p>
      )}

      {p.canDecode === false && (
        <p className="text-sm text-stone-600 dark:text-stone-300">
          This browser cannot show saved photos. Update it, or open the diary in a recent Chrome, Edge, Firefox or Safari.
        </p>
      )}

      {p.capture}

      {p.photos === null && (
        <p role="status" className="text-sm text-stone-600 dark:text-stone-300">Reading your photos from this device</p>
      )}

      {photos.length > 0 && (
        <>
          <div className={card}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-display text-lg font-bold tracking-[-0.02em] text-stone-900 dark:text-stone-100">
                Your photos ({photos.length})
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300">{formatBytes(totalBytes(photos))} on this device</p>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map(photo => (
                <li key={photo.id} className="min-w-0 space-y-2">
                  <div
                    className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100 dark:border-ink-400 dark:bg-ink-fill"
                    style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                  >
                    <PhotoCanvas
                      sourceKey={photo.id}
                      load={() => p.loadBlob(photo.id)}
                      maxWidth={360}
                      lazy
                      label={`Photo from ${dayLabel(photo.takenAt)}`}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{dayLabel(photo.takenAt)}</p>
                    <p className="text-xs text-stone-600 dark:text-stone-300">{describeAge(photo.takenAt, p.now)}</p>
                  </div>
                  <TwoStepDelete
                    compact
                    label="Delete"
                    ariaLabel={`Delete the photo from ${dayLabel(photo.takenAt)}`}
                    question="Delete this photo?"
                    confirmLabel="Delete"
                    keepLabel="Keep"
                    onConfirm={() => deleteOne(photo.id)}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div className={card}>
            <h3 className="font-display text-lg font-bold tracking-[-0.02em] text-stone-900 dark:text-stone-100">Before and after</h3>
            <div className="mt-4">
              <CompareView photos={photos} loadBlob={p.loadBlob} />
            </div>
          </div>

          <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
            <p className="max-w-md text-sm text-stone-600 dark:text-stone-300">
              Deleting removes a photo from this browser for good.
            </p>
            <TwoStepDelete
              label="Delete all photos"
              question={`Delete all ${photos.length} photos?`}
              confirmLabel="Delete all"
              keepLabel="Keep my photos"
              onConfirm={deleteAll}
            />
          </div>
        </>
      )}
    </section>
  );
}
