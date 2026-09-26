interface Option<T extends string> {
  label: string;
  value: T;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Names the group for assistive tech, e.g. "Sensitivity". */
  ariaLabel: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel }: Props<T>) {
  return (
    // A radio group, not a row of loose buttons: assistive tech hears the
    // group's name and which option is selected. 44px tall on touch screens.
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex items-center gap-0.5 p-[3px] bg-stone-100 dark:bg-ink-300 border border-stone-200 dark:border-ink-400 rounded-[11px]">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`min-h-11 sm:min-h-8 px-3 py-1 text-[13px] rounded-[8px] transition-all duration-[140ms] ${
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
