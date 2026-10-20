// Detection-zone rings: dashed concentric circles around a point, the
// "threshold" the alarm watches. Purely decorative; position it with className.
export function Rings({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="-400 -400 800 800"
      className={`rings ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="5"
    >
      {[110, 190, 270, 350, 430].map((r, i) => (
        <circle key={r} r={r} strokeDasharray={`${2 + i} ${16 + i * 4}`} opacity={1 - i * 0.16} />
      ))}
    </svg>
  );
}
