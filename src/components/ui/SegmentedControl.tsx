interface Option<T extends string> {
  label: string;
  value: T;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div className="inline-flex items-center gap-0.5 p-[3px] bg-stone-100 dark:bg-ink-300 border border-stone-200 dark:border-ink-400 rounded-[11px]">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-[5px] text-[12px] rounded-[8px] transition-all duration-[140ms] ${
            value === opt.value
              ? 'bg-white dark:bg-ink-50 text-forest-700 dark:text-forest-300 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              : 'text-stone-500 dark:text-stone-400 font-medium hover:text-stone-700 dark:hover:text-stone-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
