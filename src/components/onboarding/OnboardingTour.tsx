import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Step {
  target: string;
  title: string;
  body: string;
  side: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: Step[] = [
  {
    target: 'camera-toggle',
    title: 'Detection is already running',
    body: 'The AI is watching for nail biting in real time using your webcam. Everything processes on-device — nothing is uploaded anywhere.',
    side: 'bottom',
  },
  {
    target: 'hide-feed',
    title: 'Camera feed stays hidden',
    body: "Your video isn't shown by default so you can focus on work. The AI detects nail biting either way — toggle the feed on only if you want to see yourself.",
    side: 'bottom',
  },
  {
    target: 'streak-card',
    title: 'Your streak',
    body: "Counts how long you've gone without a bite. Every hour it grows. When the alarm fires and resets it — that's the feedback loop that builds awareness.",
    side: 'left',
  },
  {
    target: 'panic-button',
    title: 'Bit and the alarm missed it?',
    body: "Log it manually here. Tag the trigger — stress, deep focus, boredom — to find patterns in when it happens.",
    side: 'top',
  },
  {
    target: 'history-tab',
    title: 'Track your progress',
    body: '7-day bite chart, full incident log, and trigger breakdown — patterns usually become obvious within the first week.',
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
  const [rect, setRect] = useState<DOMRect | null>(null);
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
      setRect(el ? (el.getBoundingClientRect() as DOMRect) : null);
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [step]);

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

  // If element not found, advance to next
  if (!rect) {
    setTimeout(next, 0);
    return null;
  }

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
    <div className="fixed inset-0 z-[200]" aria-modal="true" role="dialog" aria-label="App tour">
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
        role="document"
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
              <div className="flex items-center gap-1">
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
                onClick={finish}
                className="text-[11px] text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
              >
                Skip tour
              </button>
            </div>

            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100 tracking-tight mb-1.5">
              {title}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              {body}
            </p>

            <button
              onClick={next}
              className="mt-4 w-full bg-forest-600 hover:bg-forest-500 active:scale-[0.98] text-white text-xs font-semibold rounded-xl py-2.5 transition-all duration-150"
            >
              {step >= STEPS.length - 1 ? "Got it — let's go!" : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
