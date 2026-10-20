// No eyebrow label above the title: a kicker over a heading is the one
// pattern the design system bans outright (see DESIGN.md).
interface Props {
  title: string;
  right?: React.ReactNode;
}

export function PageHeader({ title, right }: Props) {
  return (
    <header className="flex items-end justify-between gap-6 mb-7">
      <div>
        <h1
          className="font-display text-[2.25rem] sm:text-[2.75rem] font-extrabold leading-[1] tracking-[-0.04em] text-stone-900 dark:text-stone-100"
        >
          {title}
        </h1>
      </div>
      {right && <div className="flex items-center gap-2 pb-1">{right}</div>}
    </header>
  );
}
