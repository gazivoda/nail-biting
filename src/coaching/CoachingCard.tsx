// What the competing-response prompt looks like (WS2). Presentational only:
// props in, buttons out. No store, no storage, no flags (this file is part of
// the chunk the landing-page demo also loads, via AlertOverlay's seam).
//
// Neutral by design: a countdown ring, a sentence, two buttons. No figure, no
// hands, no mouth, no pictogram of the habit (PRODUCT.md, DESIGN.md).
//
// Reduced motion: the ring is hidden and the number stands alone in a quiet
// outline. The number is the same in both, so nothing is lost.

import { Check } from 'lucide-react';
import { cardText } from './cardText';

export interface CoachingCardProps {
  /** `main`: the card over the app. `pip`: the one-line strip in the 240x64 minimized window. */
  variant: 'main' | 'pip';
  /** `finished` shows the calm "Done" confirmation for a moment. */
  phase: 'running' | 'finished';
  /** The competing response, in the person's words. */
  text: string;
  /** Seconds left (whole, rounded up). */
  remainingSec: number;
  /** 0 at the start, 1 when time is up. */
  progress: number;
  onDone: () => void;
  onSkip: () => void;
}

const RING_R = 24;
const RING_C = 2 * Math.PI * RING_R;

/** A thin ring that empties as the time passes, with the seconds left in the middle. Decorative: the live message carries the meaning. */
export function CountdownRing({ remainingSec, progress, size = 56 }: { remainingSec: number; progress: number; size?: number }) {
  const offset = RING_C * Math.min(1, Math.max(0, progress));
  return (
    <div
      aria-hidden="true"
      data-testid="coaching-ring"
      className="relative shrink-0 motion-reduce:rounded-full motion-reduce:border motion-reduce:border-white/30"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90 motion-reduce:hidden" width={size} height={size}>
        <circle cx="28" cy="28" r={RING_R} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="5" />
        <circle
          cx="28" cy="28" r={RING_R} fill="none" stroke="#C6F24E" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={RING_C} strokeDashoffset={offset}
        />
      </svg>
      <span
        className="absolute inset-0 grid place-items-center font-display font-extrabold tabular-nums"
        style={{ fontSize: size * 0.34 }}
      >
        {remainingSec}
      </span>
    </div>
  );
}

export function CoachingCard(p: CoachingCardProps) {
  const finished = p.phase === 'finished';
  return p.variant === 'pip' ? <PipStrip {...p} finished={finished} /> : <MainCard {...p} finished={finished} />;
}

function MainCard({ text, remainingSec, progress, finished, onDone, onSkip }: CoachingCardProps & { finished: boolean }) {
  return (
    <div
      data-testid="coaching-card"
      className="sg-dark flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-white/10 bg-deep p-4 text-white motion-safe:animate-fade-up"
    >
      {finished ? (
        <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-white/30">
          <Check size={24} />
        </span>
      ) : (
        <CountdownRing remainingSec={remainingSec} progress={progress} />
      )}
      <div className="min-w-[9rem] flex-1">
        <p className="text-xs font-semibold text-white/70">{finished ? cardText('card.logged') : cardText('card.tryInstead')}</p>
        <p className="font-display text-lg font-bold leading-tight tracking-[-0.02em]">{finished ? cardText('card.done') : text}</p>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        {/* One primary button in the same place in both phases, so keyboard focus is not lost when "Done" becomes "Close". */}
        <button
          type="button"
          onClick={finished ? onSkip : onDone}
          className="min-h-11 flex-1 rounded-full bg-white px-5 font-display text-sm font-bold text-deep transition-colors hover:bg-white/90 sm:flex-none"
        >
          {finished ? cardText('card.close') : cardText('card.done')}
        </button>
        {!finished && (
          <button
            type="button"
            onClick={onSkip}
            className="min-h-11 flex-1 rounded-full border border-white/30 px-5 text-sm font-semibold text-white/90 transition-colors hover:border-white/60 sm:flex-none"
          >
            {cardText('card.skip')}
          </button>
        )}
      </div>
    </div>
  );
}

// The minimized window is 240x64 and its size belongs to the background-watching
// work, so this is one row that fits it: ring, the sentence (two lines at most)
// and two small stacked buttons. Colours are inline, like PiPWindow's own, so
// the strip reads the same whatever stylesheet the other window ended up with.
function PipStrip({ text, remainingSec, progress, finished, onDone, onSkip }: CoachingCardProps & { finished: boolean }) {
  const btn: React.CSSProperties = {
    width: 52, height: 24, borderRadius: 999, fontSize: 11, fontWeight: 600, lineHeight: 1, cursor: 'pointer',
  };
  return (
    <div
      data-testid="coaching-strip"
      aria-live="off"
      style={{
        // inset 3: leaves PiPWindow's own 3px alert border uncovered, so the strip never hides the alarm state
        position: 'absolute', inset: 3, zIndex: 2, display: 'flex', alignItems: 'center', gap: 8, padding: '0 7px',
        borderRadius: 6, background: '#0B2A1E', color: '#f2f7f3', fontFamily: 'Geist, system-ui, sans-serif',
      }}
    >
      {finished ? (
        <span aria-hidden="true" style={{ width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid rgba(255,255,255,0.3)' }}>
          <Check size={16} />
        </span>
      ) : (
        <CountdownRing remainingSec={remainingSec} progress={progress} size={34} />
      )}
      <span
        title={text}
        style={{
          flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, lineHeight: 1.25,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}
      >
        {finished ? cardText('card.done') : text}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        <button
          type="button"
          onClick={finished ? onSkip : onDone}
          style={{ ...btn, background: '#ffffff', color: '#0B2A1E', border: 'none' }}
        >
          {finished ? cardText('card.close') : cardText('card.done')}
        </button>
        {!finished && (
          <button
            type="button"
            onClick={onSkip}
            style={{ ...btn, background: 'transparent', color: 'rgba(255,255,255,0.88)', border: '1px solid rgba(255,255,255,0.35)' }}
          >
            {cardText('card.skip')}
          </button>
        )}
      </span>
    </div>
  );
}
