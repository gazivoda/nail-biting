import { useId } from 'react';

// Fig. 3: the habit loop, and the one place it can be cut.
//
// A mechanism diagram, not data: it needs no source, and it must not imply one.
// Set as a vertical cycle rather than a ring because this plate lives in the
// four-column margin, where a ring's labels would have nowhere to go. The
// return path on the left is what makes it a loop.
//
// The competing response is the only forest element in the plate. That is the
// whole argument of section 02 in one gesture: everything else in the cycle is
// the habit running itself, and there is exactly one point you can reach.

const MONO = "'JetBrains Mono', ui-monospace, monospace";

const SPINE = 58;
const LABEL_X = 80;

type Station = { y: number; label: string; gloss: string };

const STATIONS: readonly Station[] = [
  { y: 44, label: 'TRIGGER', gloss: 'stress, focus, boredom' },
  { y: 116, label: 'URGE', gloss: 'the hand starts moving' },
  { y: 224, label: 'BITE', gloss: 'already happening' },
  { y: 296, label: 'RELIEF', gloss: 'brief, and then gone' },
  { y: 368, label: 'REINFORCEMENT', gloss: 'the loop gets stronger' },
];

// Sits in the gap between URGE and BITE, which is the only interval in the
// cycle where awareness arrives before the behaviour does.
const CUT_Y = 170;

export function HabitLoopFigure() {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  return (
    <svg
      viewBox="0 0 340 400"
      className="block h-auto w-full max-w-[340px] text-stone-600"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>The habit loop and the competing response</title>
      <desc id={descId}>
        A cycle of five stages drawn top to bottom: trigger, urge, bite, relief, reinforcement,
        with a return path on the left closing reinforcement back onto trigger. The line between
        urge and bite is broken, and a competing response is marked across the break as the point
        where the cycle can be interrupted.
      </desc>

      {/* ── The cycle ─────────────────────────────────────────────────────── */}
      <g stroke="var(--ed-hairline)" strokeWidth="1" fill="none" strokeLinecap="round">
        {STATIONS.map(({ y }) => (
          <circle key={y} cx={SPINE} cy={y} r="4.5" />
        ))}

        {/* Trigger to urge, then bite to relief to reinforcement. The urge-to-
            bite run is drawn separately below, because it is the broken one. */}
        {[
          [44, 116],
          [224, 296],
          [296, 368],
        ].map(([from, to]) => (
          <g key={`${from}-${to}`}>
            <line x1={SPINE} y1={from + 9} x2={SPINE} y2={to - 11} />
            <polyline points={`${SPINE - 4.5},${to - 15.5} ${SPINE},${to - 11} ${SPINE + 4.5},${to - 15.5}`} />
          </g>
        ))}

        {/* The broken run: urge to the cut, then the cut to bite. The gap is
            kept narrow so the forest bar below reads as a cut across a line
            that would otherwise be continuous, rather than as a station of
            its own. */}
        <line x1={SPINE} y1="125" x2={SPINE} y2={CUT_Y - 8} />
        <line x1={SPINE} y1={CUT_Y + 8} x2={SPINE} y2="213" />
        <polyline points={`${SPINE - 4.5},208.5 ${SPINE},213 ${SPINE + 4.5},208.5`} />

        {/* Reinforcement closing back onto trigger. */}
        <path d={`M ${SPINE - 5},368 L 22,368 L 22,44 L ${SPINE - 7},44`} />
        <polyline points={`${SPINE - 11.5},39.5 ${SPINE - 7},44 ${SPINE - 11.5},48.5`} />
      </g>

      {/* ── The interrupt: the only forest element in the plate ───────────── */}
      <line
        x1={SPINE - 21}
        y1={CUT_Y}
        x2={SPINE + 21}
        y2={CUT_Y}
        className="text-forest-600"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* ── Labels ────────────────────────────────────────────────────────── */}
      {STATIONS.map(({ y, label, gloss }) => (
        <g key={label}>
          <text
            x={LABEL_X}
            y={y + 4}
            fontFamily={MONO}
            fontWeight="500"
            fontSize="11"
            letterSpacing="0.16em"
            fill="currentColor"
          >
            {label}
          </text>
          <text x={LABEL_X} y={y + 20} fontSize="11" className="fill-stone-500">
            {gloss}
          </text>
        </g>
      ))}

      <g className="text-forest-600">
        <text
          x={LABEL_X}
          y={CUT_Y - 4}
          fontFamily={MONO}
          fontWeight="500"
          fontSize="11"
          letterSpacing="0.16em"
          fill="currentColor"
        >
          COMPETING RESPONSE
        </text>
        <text x={LABEL_X} y={CUT_Y + 12} fontSize="11" fill="currentColor">
          press palms flat, hold it
        </text>
      </g>
    </svg>
  );
}
