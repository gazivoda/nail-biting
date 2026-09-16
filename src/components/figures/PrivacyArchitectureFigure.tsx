import { useId } from 'react';

// Fig. 5: the detection path, end to end.
//
// A mechanism diagram, not data. Its only job is to make the page's central
// trust claim checkable at a glance: the three stages of detection all sit
// inside one boundary, and the route out of that boundary is drawn as severed
// rather than merely unused. The zero on the cut is the same figure the hero
// and Fig. 2 already carry, here as a label on the path it describes.
//
// The claim is scoped, and the plate scopes it: what never leaves is camera
// data during detection. Signing in and paying are not on this path.

const MONO = "'JetBrains Mono', ui-monospace, monospace";

const NODE_Y = 104;

type Stage = { x: number; label: string; gloss: string };

const STAGES: readonly Stage[] = [
  { x: 58, label: 'CAMERA', gloss: 'video frames' },
  { x: 170, label: 'MEDIAPIPE', gloss: 'WebAssembly' },
  { x: 282, label: 'ALARM', gloss: 'audible' },
];

// The boundary runs well below the stage labels so the route out has a visible
// stretch of its own before it is cut. A cross floating directly under a line
// of type reads as a footnote mark; a cross at the end of a line that leaves a
// node reads as a severed path, which is the whole claim.
const BOUNDARY_BOTTOM = 212;

export function PrivacyArchitectureFigure() {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  return (
    <svg
      viewBox="0 0 340 334"
      className="block h-auto w-full max-w-[340px] text-stone-700"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>Where camera data goes during detection</title>
      <desc id={descId}>
        A boundary labelled &quot;your device&quot; encloses the whole detection path: camera, then
        the MediaPipe WebAssembly model, then the alarm. A single path leads out of the boundary
        toward a server, and it is cut at the boundary and marked zero bytes of camera data. The
        server sits outside, never reached.
      </desc>

      {/* ── The device boundary ───────────────────────────────────────────── */}
      <rect
        x="8"
        y="62"
        width="324"
        height={BOUNDARY_BOTTOM - 62}
        fill="none"
        stroke="var(--ed-hairline)"
        strokeWidth="1"
      />

      {/* ── The three stages, and the arrows between them ─────────────────── */}
      <g className="stroke-stone-300" strokeWidth="1" fill="none" strokeLinecap="round">
        {STAGES.map(({ x }) => (
          <rect key={x} x={x - 8} y={NODE_Y - 8} width="16" height="16" />
        ))}
        {[
          [78, 150],
          [190, 262],
        ].map(([from, to]) => (
          <g key={from}>
            <line x1={from} y1={NODE_Y} x2={to - 4} y2={NODE_Y} />
            <polyline points={`${to - 8.5},${NODE_Y - 4.5} ${to - 4},${NODE_Y} ${to - 8.5},${NODE_Y + 4.5}`} />
          </g>
        ))}
      </g>

      {/* ── The route out, severed at the boundary ────────────────────────────
          Solid while it is still inside the device, cut on the boundary line
          itself, and dashed beyond it: the remainder is the path that would
          exist, drawn as hypothetical rather than merely idle. */}
      <line x1="170" y1="164" x2="170" y2={BOUNDARY_BOTTOM} className="stroke-stone-300" strokeWidth="1" />
      <line
        x1="170"
        y1={BOUNDARY_BOTTOM + 14}
        x2="170"
        y2="262"
        stroke="var(--ed-hairline)"
        strokeWidth="1"
        strokeDasharray="3 5"
      />
      <g className="text-forest-600" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <line x1="162" y1={BOUNDARY_BOTTOM - 8} x2="178" y2={BOUNDARY_BOTTOM + 8} />
        <line x1="178" y1={BOUNDARY_BOTTOM - 8} x2="162" y2={BOUNDARY_BOTTOM + 8} />
      </g>
      <rect
        x="162"
        y="264"
        width="16"
        height="16"
        fill="none"
        stroke="var(--ed-hairline)"
        strokeWidth="1"
      />

      {/* ── Labels ────────────────────────────────────────────────────────── */}
      <g fontFamily={MONO} fontWeight="500" letterSpacing="0.16em">
        <text x="8" y="52" fontSize="12" fill="currentColor">
          YOUR DEVICE
        </text>
        {STAGES.map(({ x, label }) => (
          <text key={label} x={x} y="136" textAnchor="middle" fontSize="12" fill="currentColor">
            {label}
          </text>
        ))}
        <text x="192" y={BOUNDARY_BOTTOM - 2} fontSize="12" className="fill-forest-600">
          0 BYTES
        </text>
        <text x="192" y={BOUNDARY_BOTTOM + 16} fontSize="12" className="fill-forest-600">
          OF CAMERA DATA
        </text>
        <text x="170" y="304" textAnchor="middle" fontSize="12" className="fill-stone-500">
          ANY SERVER
        </text>
      </g>

      {STAGES.map(({ x, gloss }) => (
        <text key={gloss} x={x} y="154" textAnchor="middle" fontSize="11" className="fill-stone-500">
          {gloss}
        </text>
      ))}
      <text x="170" y="320" textAnchor="middle" fontSize="11" className="fill-stone-500">
        never reached
      </text>
    </svg>
  );
}
