// The homepage's warning sign, drawn in the ISO 7010 manner: a yellow triangle
// with a black border and a black pictogram. The pictogram is the whole
// product in one frame: a head in profile, a hand rising to the lips, and a
// dashed ring round the mouth for the detection threshold (the detector
// measures fingertip-to-mouth distance against one radius; see
// src/hooks/biteDetector.ts). The hand loops: it rises, crosses the ring, the
// ring closes and the alarm lines flash, then it falls away. That loop is the
// page's one piece of motion (keyframes in index.css, still under
// prefers-reduced-motion).

const TRIANGLE = 'M120 16 L226 198 L14 198 Z';

export function AlarmSign({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 214"
      role="img"
      aria-label="Warning sign: a hand reaching the mouth sets off the alarm"
      className={className}
    >
      <defs>
        <clipPath id="sg-alarm-clip">
          <path d={TRIANGLE} />
        </clipPath>
      </defs>

      <path
        className="sg-pict-plate"
        d={TRIANGLE}
        fill="var(--sg-yellow)"
        stroke="var(--sg-ink)"
        strokeWidth="13"
        strokeLinejoin="round"
      />

      <g clipPath="url(#sg-alarm-clip)" fill="var(--sg-ink)">
        {/* Drawn at full size, then set into the wide lower half of the
            triangle, where the ring and the hand have room. */}
        <g transform="translate(1 36) scale(0.85)">
        {/* Head in profile, facing right, mouth at (160, 133). */}
        <path d="M104 176 L104 157 C90 150 82 137 82 119 C82 93 100 75 124 75 C146 75 158 89 158 107 L158 111 L166 123 L159 126 L160 131 L157 133.5 L159 139 C158 146 152 150 144 150 L137 150 L137 176 Z" />

        {/* The threshold ring. */}
        <circle
          className="sg-pict-ring"
          cx="161"
          cy="134"
          r="21"
          fill="none"
          stroke="var(--sg-ink)"
          strokeWidth="3"
          strokeDasharray="5 6"
        />

        {/* The hand: forearm, fist, index finger. */}
        <g className="sg-pict-hand" stroke="var(--sg-ink)" strokeLinecap="round">
          <line x1="199" y1="200" x2="185" y2="163" strokeWidth="17" />
          <circle cx="180" cy="153" r="12" stroke="none" />
          <line x1="175" y1="147" x2="168" y2="139" strokeWidth="8" />
        </g>

        {/* The alarm: three strokes off the ring that only show on a catch. */}
        <g className="sg-pict-flash" stroke="var(--sg-ink)" strokeWidth="5" strokeLinecap="round" opacity="0">
          <line x1="184" y1="110" x2="194" y2="100" />
          <line x1="190" y1="124" x2="203" y2="121" />
          <line x1="172" y1="102" x2="176" y2="89" />
        </g>
        </g>
      </g>
    </svg>
  );
}
