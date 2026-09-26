import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight } from 'lucide-react';

interface Step {
  target: string;
  title: string;
  body: string;
  side: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: Step[] = [
  {
    target: 'camera-toggle',
    // The tour opens 1.8s after the dashboard, often while the browser's
    // camera prompt is still up or after it was refused, so it cannot promise
    // that detection is running. The card it points at says whether it is.
    title: 'This is the detector',
    body: 'Once your browser lets it use the camera, it watches for your hands and sounds the alarm when one reaches your mouth. The video never leaves this computer.',
    side: 'bottom',
  },
  {
    target: 'hide-feed',
    title: 'Camera feed stays hidden',
    body: "Your video stays hidden so you can focus on work. Detection runs either way. Turn the feed on only if you want to see yourself.",
    side: 'bottom',
  },
  {
    target: 'streak-card',
    title: 'Your streak',
    body: "How long you've gone without a bite. An alarm doesn't reset it; a bite you confirm or log does.",
    side: 'left',
  },
  {
    target: 'panic-button',
    title: 'Bit and the alarm missed it?',
    body: "Log it here and tag what set it off: stress, deep focus, boredom.",
    side: 'top',
  },
  {
    target: 'history-tab',
    title: 'History',
    body: 'Every alarm and bite by day, with a 7-day chart.',
    side: 'right',
  },
];

const TOUR_KEY = 'onboarding_v1_done';
const SPOTLIGHT_PAD = 10;
const TOOLTIP_W = 272;

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
    const update = () => {
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
      setTarget({ step, rect: el.getBoundingClientRect() as DOMRect });
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
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

  const { title, body, side } = STEPS[step];

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
    tooltipTop = Math.max(rect.top - SPOTLIGHT_PAD - GAP - 200, 12);
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
            <rect x={sx} y={sy} width={sw} height={sh} rx="14" fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#tour-spotlight-mask)" />
      </svg>

      {/* Spotlight ring */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none rounded-[14px] transition-all duration-300"
        style={{
          left: sx, top: sy, width: sw, height: sh,
          boxShadow: '0 0 0 2px rgba(255,255,255,0.3), 0 0 24px rgba(255,255,255,0.08)',
        }}
      />

      {/* Click blocker (outside tooltip) */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Tooltip */}
      <div
        className="absolute z-10 bg-white dark:bg-ink-50 rounded-2xl shadow-2xl"
        style={{ left: tooltipLeft, top: tooltipTop, width: TOOLTIP_W }}
        onClick={(e) => e.stopPropagation()}
      >
        <Arrow side={side} />

        <div className="relative z-10 rounded-2xl bg-white dark:bg-ink-50 overflow-hidden">
          {/* Progress bar */}
          <div className="h-0.5 bg-stone-100 dark:bg-ink-300">
            <div
              className="h-full bg-forest-500 transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-5">
            {/* Dots + skip */}
            <div className="flex items-center justify-between mb-3">
              <span className="sr-only">Step {step + 1} of {STEPS.length}</span>
              <div className="flex items-center gap-1" aria-hidden="true">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`block rounded-full transition-all duration-300 ${
                      i === step
                        ? 'w-4 h-1.5 bg-forest-500'
                        : i < step
                        ? 'w-1.5 h-1.5 bg-forest-300 dark:bg-forest-700'
                        : 'w-1.5 h-1.5 bg-stone-200 dark:bg-ink-300'
                    }`}
                  />
                ))}
              </div>
              <button
                ref={skipRef}
                type="button"
                onClick={finish}
                className="-mr-2 min-h-8 px-2 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
              >
                Skip tour
              </button>
            </div>

            <h2 id="tour-title" className="text-sm font-bold text-stone-800 dark:text-stone-100 tracking-tight mb-1.5">
              {title}
            </h2>
            <p id="tour-body" className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              {body}
            </p>

            <button
              ref={nextRef}
              type="button"
              onClick={next}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-1.5 bg-forest-600 hover:bg-forest-500 text-cream-100 text-sm font-semibold rounded-xl transition-colors duration-150"
            >
              {step >= STEPS.length - 1 ? 'Done' : <>Next <ArrowRight size={14} aria-hidden="true" /></>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
