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
          className="text-[2rem] font-extrabold leading-[1.1] tracking-[-0.025em] text-stone-800 dark:text-stone-100"
        >
          {title}
        </h1>
      </div>
      {right && <div className="flex items-center gap-2 pb-1">{right}</div>}
    </header>
  );
}
