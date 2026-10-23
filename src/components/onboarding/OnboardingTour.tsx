import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight } from 'lucide-react';
import { useT, type messages } from '../../i18n/scopes/shell';
import { useT as useCommonT } from '../../i18n/scopes/common';

interface Step {
  target: string;
  title: keyof typeof messages;
  body: keyof typeof messages;
  side: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: Step[] = [
  {
    target: 'camera-toggle',
    // The tour opens 1.8s after the dashboard, often while the browser's
    // camera prompt is still up or after it was refused, so it cannot promise
    // that detection is running. The card it points at says whether it is.
    title: 'tour.detector.title',
    body: 'tour.detector.body',
    side: 'bottom',
  },
  {
    target: 'hide-feed',
    title: 'tour.feed.title',
    body: 'tour.feed.body',
    side: 'bottom',
  },
  {
    target: 'streak-card',
    title: 'tour.streak.title',
    body: 'tour.streak.body',
    side: 'bottom',
  },
  {
    target: 'panic-button',
    title: 'tour.log.title',
    body: 'tour.log.body',
    side: 'top',
  },
  {
    target: 'history-tab',
    title: 'tour.history.title',
    body: 'tour.history.body',
    side: 'right',
  },
];

const TOUR_KEY = 'onboarding_v1_done';
const SPOTLIGHT_PAD = 10;
const TOOLTIP_W = 288;

/** Find the first element with the given data-tour attr that is actually visible */
function findTarget(name: string): Element | null {
  const nodes = document.querySelectorAll(`[data-tour="${name}"]`);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function Arrow({ side }: { side: Step['side'] }) {
  const base = 'absolute w-3 h-3 bg-white dark:bg-ink-50 rotate-45 z-0';
  if (side === 'bottom') return <div className={`${base} -top-1.5 left-1/2 -translate-x-1/2`} />;
  if (side === 'top')    return <div className={`${base} -bottom-1.5 left-1/2 -translate-x-1/2`} />;
  if (side === 'right')  return <div className={`${base} top-1/2 -translate-y-1/2 -left-1.5`} />;
  return                        <div className={`${base} top-1/2 -translate-y-1/2 -right-1.5`} />;
}

/** The text and buttons inside the tooltip: its own component so the words can be rendered without the portal. */
export function TourCardContent({ step, nextRef, skipRef, onSkip, onNext }: {
  step: number;
  nextRef?: React.Ref<HTMLButtonElement>;
  skipRef?: React.Ref<HTMLButtonElement>;
  onSkip: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const tc = useCommonT();
  const { title, body } = STEPS[step];
  return (
    <div className="p-5">
      {/* Dots + skip */}
      <div className="flex items-center justify-between mb-3">
        <span className="sr-only">{t('tour.stepOf', { step: step + 1, total: STEPS.length })}</span>
        <div className="flex items-center gap-1" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`block rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-5 h-2 bg-deep dark:bg-lime-300'
                  : i < step
                  ? 'w-2 h-2 bg-forest-500 dark:bg-forest-400'
                  : 'w-2 h-2 bg-stone-300 dark:bg-ink-400'
              }`}
            />
          ))}
        </div>
        <button
          ref={skipRef}
          type="button"
          onClick={onSkip}
          className="-mr-3 -my-2 min-h-11 px-3 text-xs text-stone-600 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
        >
          {t('tour.skip')}
        </button>
      </div>

      <h2 id="tour-title" className="font-display text-xl font-extrabold leading-[1.05] text-stone-900 dark:text-stone-100 tracking-[-0.035em] mb-2">
        {t(title)}
      </h2>
      <p id="tour-body" className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
        {t(body)}
      </p>

      <button
        ref={nextRef}
        type="button"
        onClick={onNext}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-1.5 bg-deep hover:bg-forest-500 dark:bg-lime-300 dark:hover:bg-lime-200 text-white dark:text-deep font-display text-sm font-bold rounded-full transition-colors duration-150"
      >
        {step >= STEPS.length - 1 ? tc('done') : <>{t('tour.next')} <ArrowRight size={14} aria-hidden="true" /></>}
      </button>
    </div>
  );
}

export function OnboardingTour() {
  const [step, setStep] = useState(-1);
  // Keyed by the step it was measured for. A bare rect used to start as null,
  // and the render read "null" as "target missing" and skipped the step before
  // the effect had measured anything, so the tour opened at step 3 of 5 and
  // never explained detection. Now a step only renders once it is measured,
  // and only the effect, having actually looked, may skip a step.
  const [target, setTarget] = useState<{ step: number; rect: DOMRect } | null>(null);
  const [vw, setVw] = useState(window.innerWidth);
  const [vh, setVh] = useState(window.innerHeight);
  const doneRef = useRef(!!localStorage.getItem(TOUR_KEY));

  useEffect(() => {
    if (doneRef.current) return;
    const t = setTimeout(() => setStep(0), 1800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (step < 0 || step >= STEPS.length) return;
    const update = (scrollTo = false) => {
      const el = findTarget(STEPS[step].target);
      if (!el) {
        // Genuinely not on screen (e.g. a control this layout doesn't render).
        if (step >= STEPS.length - 1) {
          localStorage.setItem(TOUR_KEY, '1');
          doneRef.current = true;
          setStep(-1);
        } else {
          setStep(step + 1);
        }
        return;
      }
      // On a phone the target is often below the fold (the bite button, the
      // tab bar): bring it into view first, or the spotlight and tooltip are
      // drawn off-screen.
      if (scrollTo) el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      setTarget({ step, rect: el.getBoundingClientRect() as DOMRect });
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    update(true);
    const onMove = () => update();
    window.addEventListener('resize', onMove);
    // Capture phase: the app scrolls an inner container, not the window.
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [step]);

  // A modal has to behave like one: focus moves onto its main button each
  // step, Tab stays between its two buttons, and Escape ends the tour.
  const nextRef = useRef<HTMLButtonElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const measured = target?.step === step;
  useEffect(() => {
    if (measured) nextRef.current?.focus();
  }, [step, measured]);

  if (step < 0 || step >= STEPS.length) return null;

  const finish = () => {
    localStorage.setItem(TOUR_KEY, '1');
    doneRef.current = true;
    setStep(-1);
  };

  const next = () => {
    if (step >= STEPS.length - 1) { finish(); return; }
    setStep(s => s + 1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const onNext = document.activeElement === nextRef.current;
    (onNext ? skipRef : nextRef).current?.focus();
  };

  // Not measured for this step yet: the effect above runs after this render.
  const rect = target?.step === step ? target.rect : null;
  if (!rect) return null;

  // A 272px tooltip beside its target does not fit on a phone: below 640px a
  // left/right step goes above or below, whichever has more room.
  const side: Step['side'] =
    vw < 640 && (STEPS[step].side === 'left' || STEPS[step].side === 'right')
      ? (rect.top > vh / 2 ? 'top' : 'bottom')
      : STEPS[step].side;

  const sx = rect.left - SPOTLIGHT_PAD;
  const sy = rect.top - SPOTLIGHT_PAD;
  const sw = rect.width + SPOTLIGHT_PAD * 2;
  const sh = rect.height + SPOTLIGHT_PAD * 2;

  const GAP = 14;
  let tooltipLeft = 0;
  let tooltipTop = 0;

  if (side === 'bottom') {
    tooltipLeft = Math.min(Math.max(rect.left + rect.width / 2 - TOOLTIP_W / 2, 12), vw - TOOLTIP_W - 12);
    tooltipTop = rect.bottom + SPOTLIGHT_PAD + GAP;
  } else if (side === 'top') {
    tooltipLeft = Math.min(Math.max(rect.left + rect.width / 2 - TOOLTIP_W / 2, 12), vw - TOOLTIP_W - 12);
    tooltipTop = Math.max(rect.top - SPOTLIGHT_PAD - GAP - 230, 12);
  } else if (side === 'right') {
    tooltipLeft = rect.right + SPOTLIGHT_PAD + GAP;
    tooltipTop = Math.min(Math.max(rect.top + rect.height / 2 - 90, 12), vh - 220);
  } else {
    tooltipLeft = Math.max(rect.left - SPOTLIGHT_PAD - GAP - TOOLTIP_W, 12);
    tooltipTop = Math.min(Math.max(rect.top + rect.height / 2 - 90, 12), vh - 220);
  }

  return createPortal(
    <div
      className="app-type fixed inset-0 z-[200] outline-none"
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      onKeyDown={onKeyDown}
    >
      {/* Darkened backdrop with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect x={sx} y={sy} width={sw} height={sh} rx="20" fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#tour-spotlight-mask)" />
      </svg>

      {/* Spotlight ring */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none rounded-[20px] transition-all duration-300"
        style={{
          left: sx, top: sy, width: sw, height: sh,
          boxShadow: '0 0 0 2px rgba(255,255,255,0.35)',
        }}
      />

      {/* Click blocker (outside tooltip) */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Tooltip */}
      <div
        className="absolute z-10 bg-white dark:bg-ink-50 rounded-2xl border border-stone-200 dark:border-ink-400"
        style={{ left: tooltipLeft, top: tooltipTop, width: TOOLTIP_W }}
        onClick={(e) => e.stopPropagation()}
      >
        <Arrow side={side} />

        <div className="relative z-10 rounded-2xl bg-white dark:bg-ink-50 overflow-hidden">
          {/* Progress bar */}
          <div className="h-0.5 bg-stone-100 dark:bg-ink-fill">
            <div
              className="h-full bg-deep dark:bg-lime-300 transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <TourCardContent step={step} nextRef={nextRef} skipRef={skipRef} onSkip={finish} onNext={next} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
