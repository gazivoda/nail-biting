import { useEffect, useRef, useCallback } from 'react';

type WaveState = 'watching' | 'spike' | 'decay';

interface WaveConfig {
  /** Number of SVG points across the width */
  points: number;
  /** SVG viewBox height */
  height: number;
  /** Baseline amplitude (calm) */
  calmAmp: number;
  /** Peak amplitude at spike */
  spikeAmp: number;
  /** How fast the wave phase advances per frame (radians) */
  calmSpeed: number;
  spikeSpeed: number;
  /** Number of wave cycles visible */
  frequency: number;
}

const CFG: WaveConfig = {
  points: 120,
  height: 80,
  calmAmp: 6,
  spikeAmp: 28,
  calmSpeed: 0.022,
  spikeSpeed: 0.055,
  frequency: 3.2,
};

// Duration of each phase in ms
const SPIKE_DURATION  = 900;
const DECAY_DURATION  = 1400;
const CYCLE_INTERVAL  = 4200; // ms between auto-detections

function buildPath(
  points: number,
  height: number,
  amplitude: number,
  phase: number,
  frequency: number,
  /** 0–1 distortion for organic feel */
  noise: number[],
): string {
  const mid = height / 2;
  const step = 1 / (points - 1);
  const coords: string[] = [];

  for (let i = 0; i < points; i++) {
    const t = i * step;
    const x = t * 100; // SVG uses 0–100 viewBox width
    const base = Math.sin(t * Math.PI * 2 * frequency + phase);
    // Add a second harmonic for organic texture
    const harmonic = 0.35 * Math.sin(t * Math.PI * 2 * frequency * 2.3 + phase * 1.4);
    const n = noise[i] ?? 0;
    const y = mid - (base + harmonic) * amplitude * (1 + 0.15 * n);
    coords.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return coords.join(' ');
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

// Ease-out quart
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 4);
}

// Ease-in-out for decay
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

interface Props {
  /** Extra class on the wrapper */
  className?: string;
  /**
   * When provided, disables the demo auto-cycle and reacts to real detection
   * events instead. Pass the status from useDetection.
   */
  detectionStatus?: 'idle' | 'loading' | 'watching' | 'alert' | 'error';
}

export function DetectionWave({ className = '', detectionStatus }: Props) {
  const svgRef    = useRef<SVGPathElement>(null);
  const svg2Ref   = useRef<SVGPathElement>(null); // ghost / shadow wave
  const gradRef   = useRef<SVGLinearGradientElement>(null);
  const grad2Ref  = useRef<SVGLinearGradientElement>(null);
  const labelRef  = useRef<HTMLSpanElement>(null);
  const dotRef    = useRef<HTMLSpanElement>(null);
  const rafRef    = useRef<number>(0);
  const stateRef      = useRef<WaveState>('watching');
  const isControlled  = useRef(detectionStatus !== undefined);
  const phaseRef  = useRef(0);
  const ampRef    = useRef(CFG.calmAmp);
  const phaseStepRef = useRef(CFG.calmSpeed);
  const stateStartRef = useRef(0);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-generate stable noise per point
  const noise = useRef<number[]>(
    Array.from({ length: CFG.points }, () => (Math.random() * 2 - 1)),
  );

  // forest-400 OKLCH
  const GREEN = 'oklch(58% 0.130 148)';
  // alert-400 OKLCH
  const RED   = 'oklch(62% 0.180 25)';

  const setGradColor = (color: string) => {
    [gradRef.current, grad2Ref.current].forEach(g => {
      if (!g) return;
      g.querySelectorAll('stop').forEach(s => s.setAttribute('stop-color', color));
    });
  };

  const triggerSpike = useCallback(() => {
    stateRef.current = 'spike';
    stateStartRef.current = performance.now();

    setGradColor(RED);

    if (labelRef.current) {
      labelRef.current.textContent = 'Detected!';
      labelRef.current.style.color = RED;
    }
    if (dotRef.current) {
      dotRef.current.style.background = RED;
    }

    // Schedule decay
    setTimeout(() => {
      stateRef.current = 'decay';
      stateStartRef.current = performance.now();
    }, SPIKE_DURATION);

    // Schedule return to watching
    setTimeout(() => {
      stateRef.current = 'watching';
      setGradColor(GREEN);
      if (labelRef.current) {
        labelRef.current.textContent = 'Watching...';
        labelRef.current.style.color = '';
      }
      if (dotRef.current) {
        dotRef.current.style.background = '';
      }
      // Schedule next cycle only in demo mode
      if (!isControlled.current) {
        cycleTimerRef.current = setTimeout(triggerSpike, CYCLE_INTERVAL);
      }
    }, SPIKE_DURATION + DECAY_DURATION);
  }, []);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // Start first auto-detection cycle (demo mode only)
    if (!isControlled.current) {
      cycleTimerRef.current = setTimeout(triggerSpike, CYCLE_INTERVAL);
    }

    function frame(now: number) {
      const state     = stateRef.current;
      const elapsed   = now - stateStartRef.current;
      const path      = svgRef.current;
      const path2     = svg2Ref.current;
      if (!path || !path2) { rafRef.current = requestAnimationFrame(frame); return; }

      // Determine target amplitude & speed
      let targetAmp: number;
      let targetSpeed: number;

      if (state === 'spike') {
        const t = easeOut(Math.min(elapsed / (SPIKE_DURATION * 0.5), 1));
        targetAmp   = lerp(CFG.calmAmp, CFG.spikeAmp, t);
        targetSpeed = lerp(CFG.calmSpeed, CFG.spikeSpeed, t);
      } else if (state === 'decay') {
        const t = easeInOut(Math.min(elapsed / DECAY_DURATION, 1));
        targetAmp   = lerp(CFG.spikeAmp, CFG.calmAmp, t);
        targetSpeed = lerp(CFG.spikeSpeed, CFG.calmSpeed, t);
      } else {
        targetAmp   = CFG.calmAmp;
        targetSpeed = CFG.calmSpeed;
      }

      // Smooth amp transitions
      ampRef.current      = lerp(ampRef.current, targetAmp, 0.08);
      phaseStepRef.current = lerp(phaseStepRef.current, targetSpeed, 0.06);
      phaseRef.current    += phaseStepRef.current;

      const d  = buildPath(CFG.points, CFG.height, ampRef.current, phaseRef.current, CFG.frequency, noise.current);
      // Ghost wave: offset phase and reduced amp
      const d2 = buildPath(CFG.points, CFG.height, ampRef.current * 0.45, phaseRef.current - 0.9, CFG.frequency, noise.current);

      path.setAttribute('d', d);
      path2.setAttribute('d', d2);

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    };
  }, [triggerSpike]);

  // React to real detection events when in controlled mode
  useEffect(() => {
    if (detectionStatus === undefined) return;
    isControlled.current = true;

    if (detectionStatus === 'alert' && stateRef.current === 'watching') {
      triggerSpike();
    } else if (labelRef.current) {
      if (detectionStatus === 'loading') {
        labelRef.current.textContent = 'Loading models…';
      } else if (detectionStatus === 'watching') {
        labelRef.current.textContent = 'Watching…';
      } else if (detectionStatus === 'idle' || detectionStatus === 'error') {
        labelRef.current.textContent = detectionStatus === 'error' ? 'Model error' : 'Waiting…';
      }
    }
  }, [detectionStatus, triggerSpike]);

  return (
    <div
      className={`w-full max-w-xl mx-auto select-none ${className}`}
      aria-hidden="true"
    >
      {/* Waveform card */}
      <div className="relative rounded-2xl border border-stone-200 dark:border-ink-400 bg-white/60 dark:bg-ink-50/60 backdrop-blur-sm overflow-hidden px-4 pt-3 pb-2 shadow-card">

        {/* Gradient fade on left & right edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white/80 dark:from-ink-50/80 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white/80 dark:from-ink-50/80 to-transparent z-10" />

        <svg
          viewBox={`0 0 100 ${CFG.height}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: CFG.height }}
        >
          <defs>
            <linearGradient ref={gradRef} id="wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="oklch(58% 0.130 148)" stopOpacity="0" />
              <stop offset="15%"  stopColor="oklch(58% 0.130 148)" stopOpacity="1" />
              <stop offset="85%"  stopColor="oklch(58% 0.130 148)" stopOpacity="1" />
              <stop offset="100%" stopColor="oklch(58% 0.130 148)" stopOpacity="0" />
            </linearGradient>
            <linearGradient ref={grad2Ref} id="wave-grad-ghost" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="oklch(58% 0.130 148)" stopOpacity="0" />
              <stop offset="15%"  stopColor="oklch(58% 0.130 148)" stopOpacity="0.35" />
              <stop offset="85%"  stopColor="oklch(58% 0.130 148)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="oklch(58% 0.130 148)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Ghost / shadow wave */}
          <path
            ref={svg2Ref}
            stroke="url(#wave-grad-ghost)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />

          {/* Primary wave */}
          <path
            ref={svgRef}
            stroke="url(#wave-grad)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>

        {/* Status label */}
        <div className="flex items-center justify-center gap-2 pb-1 pt-0.5">
          <span
            ref={dotRef}
            className="w-1.5 h-1.5 rounded-full bg-forest-400 transition-colors duration-300"
            style={{ boxShadow: '0 0 6px currentColor' }}
          />
          <span
            ref={labelRef}
            className="text-xs font-medium text-forest-600 dark:text-forest-400 transition-colors duration-300 tabular-nums"
          >
            Watching...
          </span>
        </div>
      </div>
    </div>
  );
}
