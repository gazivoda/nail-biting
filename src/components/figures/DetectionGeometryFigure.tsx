import { useId } from 'react';

// Fig. 4: what the detector actually measures.
//
// Hand-authored inline SVG. Nothing here may import a charting library: the
// landing page's critical path is the reason `recharts` lives in its own
// ~269 KB chunk, and four small plates are not worth putting it back.
//
// This is a *mechanism* diagram, not data, so it carries no source. Every
// element in it is a real part of the detector, and the numbers on it are read
// off `src/hooks/biteDetector.ts`: 21 hand landmarks, fingertips at indices
// 4/8/12/16/20, a mouth centre averaged from face landmarks 13 and 14, and one
// Euclidean distance compared against a threshold radius.

const MONO = "'JetBrains Mono', ui-monospace, monospace";

// MediaPipe Hands returns exactly 21 landmarks per hand. These are those 21,
// posed as a neutral open hand so the topology reads as a hand rather than as
// an abstraction. Index order is MediaPipe's own (0 wrist, 4 thumb tip,
// 8 index tip, 12 middle tip, 16 ring tip, 20 pinky tip).
const POSE: readonly (readonly [number, number])[] = [
  [75, 190], // 0  wrist
  [46, 168], // 1  thumb CMC
  [28, 145], // 2  thumb MCP
  [17, 122], // 3  thumb IP
  [10, 101], // 4  thumb tip
  [54, 112], // 5  index MCP
  [48, 83],  // 6  index PIP
  [45, 62],  // 7  index DIP
  [43, 43],  // 8  index tip
  [76, 105], // 9  middle MCP
  [75, 72],  // 10 middle PIP
  [74, 49],  // 11 middle DIP
  [73, 29],  // 12 middle tip
  [97, 110], // 13 ring MCP
  [100, 79], // 14 ring PIP
  [102, 57], // 15 ring DIP
  [104, 38], // 16 ring tip
  [117, 121], // 17 pinky MCP
  [124, 96], // 18 pinky PIP
  [128, 78], // 19 pinky DIP
  [131, 61], // 20 pinky tip
];

// MediaPipe's HAND_CONNECTIONS, verbatim: four bones per digit plus the five
// palm links that close the hand. Drawing an approximation of this would make
// the plate decorative; drawing the real list makes it a diagram.
const CONNECTIONS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

// The only landmarks the detector measures from. Mirrors FINGERTIP_INDICES in
// src/hooks/biteDetector.ts: a wrist or palm drifting past the face must not
// fire the alarm, so nothing but these five is ever compared to the mouth.
const FINGERTIPS = new Set([4, 8, 12, 16, 20]);

// Tilt the hand toward the mouth and drop it into the lower right of the plate.
// Doing this in code rather than by hand keeps the 21 points and their 21 bones
// consistent with each other no matter how the pose is nudged.
const ANGLE = (-22 * Math.PI) / 180;
const COS = Math.cos(ANGLE);
const SIN = Math.sin(ANGLE);
const PIVOT: readonly [number, number] = [75, 190];
const OFFSET: readonly [number, number] = [250, 160];

const HAND: readonly (readonly [number, number])[] = POSE.map(([x, y]) => {
  const dx = x - PIVOT[0];
  const dy = y - PIVOT[1];
  return [
    PIVOT[0] + dx * COS - dy * SIN + OFFSET[0],
    PIVOT[1] + dx * SIN + dy * COS + OFFSET[1],
  ] as const;
});

const MOUTH: readonly [number, number] = [140, 158];
const LIP_UPPER: readonly [number, number] = [140, 148];
const LIP_LOWER: readonly [number, number] = [140, 168];

// The alarm's decision boundary. Drawn as a radius rather than a number because
// the real threshold is a fraction of frame width (0.08 / 0.12 / 0.18 by
// sensitivity), and printing one of those beside a hand drawn at an arbitrary
// scale would imply a measurement this plate does not have.
const THRESHOLD_R = 72;

// The index fingertip is the nearest of the five in this pose, so it is the one
// the vector is drawn from. Derived, not guessed.
const TIP = HAND[8];
const VX = TIP[0] - MOUTH[0];
const VY = TIP[1] - MOUTH[1];
const VLEN = Math.hypot(VX, VY);
const UX = VX / VLEN;
const UY = VY / VLEN;

// Where the vector leaves the threshold arc, and the midpoint of the stretch
// that is still outside it: the leader for the DISTANCE label hangs off that.
const CROSS: readonly [number, number] = [MOUTH[0] + THRESHOLD_R * UX, MOUTH[1] + THRESHOLD_R * UY];
const OUTER_MID: readonly [number, number] = [(CROSS[0] + TIP[0]) / 2, (CROSS[1] + TIP[1]) / 2];
const LEADER_END: readonly [number, number] = [OUTER_MID[0] + 46 * UY, OUTER_MID[1] - 46 * UX];

const round = (n: number) => Math.round(n * 10) / 10;

export function DetectionGeometryFigure() {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  return (
    <svg
      viewBox="0 0 420 408"
      className="block h-auto w-full max-w-[420px] text-stone-600"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>Detection geometry</title>
      <desc id={descId}>
        A hand drawn as MediaPipe&apos;s 21 connected landmarks, with its five fingertips marked.
        A mouth centre sits to the upper left, taken as the midpoint of two lip landmarks, and is
        ringed by a dashed threshold circle. A straight line runs from the nearest fingertip to
        that mouth centre and is labelled as the measured distance. The fingertip is outside the
        circle, so no alarm is firing.
      </desc>

      {/* ── The hand: 21 landmarks and MediaPipe's own connectivity ──────────
          Drawn a step darker than `--ed-hairline`. The hairline token is tuned
          for rules separating type, where ~1.5:1 is the point; here the strokes
          are the subject of the plate, and at that contrast a 1px skeleton
          disappears on a non-retina screen. stone-300 is still a hairline
          weight and still the page's own palette. */}
      <g className="stroke-stone-300" strokeWidth="1" strokeLinecap="round" fill="none">
        {CONNECTIONS.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={round(HAND[a][0])}
            y1={round(HAND[a][1])}
            x2={round(HAND[b][0])}
            y2={round(HAND[b][1])}
          />
        ))}
      </g>

      {HAND.map(([x, y], i) =>
        FINGERTIPS.has(i) ? (
          <circle key={i} cx={round(x)} cy={round(y)} r="4" className="fill-forest-600" />
        ) : (
          <circle key={i} cx={round(x)} cy={round(y)} r="3" fill="none" className="stroke-stone-300" strokeWidth="1" />
        ),
      )}

      {/* ── The mouth: two lip landmarks and the centre taken between them ─ */}
      <g className="stroke-stone-300" strokeWidth="1" fill="none">
        <line x1={LIP_UPPER[0]} y1={LIP_UPPER[1]} x2={LIP_LOWER[0]} y2={LIP_LOWER[1]} />
        <circle cx={LIP_UPPER[0]} cy={LIP_UPPER[1]} r="3" />
        <circle cx={LIP_LOWER[0]} cy={LIP_LOWER[1]} r="3" />
      </g>
      <circle cx={MOUTH[0]} cy={MOUTH[1]} r="4" className="fill-forest-600" />

      {/* ── The threshold radius and the measured distance ────────────────── */}
      <g className="text-forest-600" stroke="currentColor" fill="none">
        <circle cx={MOUTH[0]} cy={MOUTH[1]} r={THRESHOLD_R} strokeWidth="1" strokeDasharray="3 5" />
        <line x1={MOUTH[0]} y1={MOUTH[1]} x2={round(TIP[0])} y2={round(TIP[1])} strokeWidth="1.25" />
      </g>

      <line
        x1={round(OUTER_MID[0])}
        y1={round(OUTER_MID[1])}
        x2={round(LEADER_END[0])}
        y2={round(LEADER_END[1])}
        className="stroke-stone-300"
        strokeWidth="1"
      />

      {/* ── Labels ────────────────────────────────────────────────────────── */}
      <g fontFamily={MONO} fontWeight="500" letterSpacing="0.16em">
        <text
          x={MOUTH[0]}
          y={MOUTH[1] - THRESHOLD_R - 12}
          textAnchor="middle"
          fontSize="11"
          className="fill-forest-600"
        >
          THRESHOLD
        </text>
        <text
          x={round(LEADER_END[0]) + 6}
          y={round(LEADER_END[1]) - 4}
          fontSize="11"
          className="fill-forest-600"
        >
          DISTANCE
        </text>
        <text x={MOUTH[0]} y={MOUTH[1] + THRESHOLD_R + 24} textAnchor="middle" fontSize="11" fill="currentColor">
          MOUTH CENTRE
        </text>
        <text x={MOUTH[0]} y={MOUTH[1] + THRESHOLD_R + 42} textAnchor="middle" fontSize="11" className="fill-stone-500">
          LIPS 13 &amp; 14
        </text>
        <text x="414" y="376" textAnchor="end" fontSize="11" fill="currentColor">
          HAND LANDMARKS &middot; 21
        </text>
        <text x="414" y="396" textAnchor="end" fontSize="11" className="fill-stone-500">
          FINGERTIPS &middot; 4 8 12 16 20
        </text>
      </g>
    </svg>
  );
}
