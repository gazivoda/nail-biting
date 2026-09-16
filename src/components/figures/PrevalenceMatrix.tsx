// The prevalence plate for Fig. 2 in section 01.
//
// A hundred dots, one per hundred adults, filled to the range the cited source
// actually reports. That range is the honesty constraint: Halteh, Scher &
// Lipner (2017) give 20 to 30 per cent, not a point estimate, so the plate
// draws twenty solid and ten open rather than picking twenty-five and drawing
// a number nobody measured. The citation is the one already in Fig. 2's
// figcaption; this plate adds no claim of its own.
//
// The SVG is aria-hidden on purpose: the legend beneath it and the "20-30% of
// adults bite their nails chronically" row directly below carry the whole
// meaning in text, and a screen reader has no use for a hundred enumerated
// circles.

const COLUMNS = 10;
const ROWS = 10;
const STEP = 32;
const ORIGIN = 26;

// Reading order, left to right and top to bottom: the first twenty dots are the
// lower bound, the next ten carry the range up to the upper bound.
const LOWER = 20;
const UPPER = 30;

const DOTS = Array.from({ length: COLUMNS * ROWS }, (_, i) => ({
  i,
  cx: ORIGIN + (i % COLUMNS) * STEP,
  cy: ORIGIN - 12 + Math.floor(i / COLUMNS) * STEP,
}));

export function PrevalenceMatrix() {
  return (
    <div>
      <p className="ed-mono text-stone-500">Prevalence, per 100 adults</p>

      <svg
        viewBox="0 0 340 316"
        className="mt-4 block h-auto w-full max-w-[340px]"
        aria-hidden="true"
        focusable="false"
      >
        {DOTS.map(({ i, cx, cy }) => {
          if (i < LOWER) {
            return <circle key={i} cx={cx} cy={cy} r="5" className="fill-forest-600" />;
          }
          if (i < UPPER) {
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="5"
                fill="none"
                strokeWidth="1.25"
                className="stroke-forest-600"
              />
            );
          }
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="5"
              fill="none"
              stroke="var(--ed-hairline)"
              strokeWidth="1"
            />
          );
        })}
      </svg>

      <ul className="mt-4 list-none space-y-2">
        <li className="flex items-center gap-3">
          <span aria-hidden="true" className="h-2 w-2 flex-shrink-0 rounded-full bg-forest-600" />
          <span className="ed-mono text-stone-500">20 in 100, lower estimate</span>
        </li>
        <li className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-2 w-2 flex-shrink-0 rounded-full border border-forest-600"
          />
          <span className="ed-mono text-stone-500">up to 30, upper estimate</span>
        </li>
      </ul>
    </div>
  );
}
