interface Props {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, right }: Props) {
  return (
    <header className="flex items-end justify-between gap-6 mb-7">
      <div>
        <p className="text-[10px] font-semibold tracking-[1.2px] uppercase text-stone-400 dark:text-stone-500">
          {eyebrow}
        </p>
        <h1
          className="mt-2 font-display text-[32px] font-normal leading-[1.1] tracking-[-0.6px] text-stone-800 dark:text-stone-100"
        >
          {title}
        </h1>
      </div>
      {right && <div className="flex items-center gap-2 pb-1">{right}</div>}
    </header>
  );
}
