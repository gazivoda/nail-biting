import { radioGroupKeyDown, radioTabIndex } from './radioKeys';

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
  /** Sits on a deep forest surface (white track, lime selection). */
  onDeep?: boolean;
}

export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, onDeep }: Props<T>) {
  return (
    // A radio group, not a row of loose buttons: assistive tech hears the
    // group's name and which option is selected. 44px tall on touch screens.
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={e => radioGroupKeyDown(e, options.map(o => o.value), value, onChange)}
      className={`inline-flex items-center gap-0.5 p-[3px] rounded-full ${
        onDeep ? 'bg-white/10' : 'bg-stone-100 dark:bg-ink-fill border border-stone-200 dark:border-ink-400'
      }`}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          tabIndex={radioTabIndex(value === opt.value)}
          onClick={() => onChange(opt.value)}
          className={`min-h-11 px-4 py-1 text-sm rounded-full transition-colors duration-[140ms] ${
            value === opt.value
              ? onDeep
                ? 'bg-lime-300 text-deep font-semibold'
                : 'bg-deep text-white dark:bg-deep-2 dark:text-lime-300 font-semibold'
              : onDeep
                ? 'text-white/75 hover:text-white font-medium'
                : 'text-stone-600 dark:text-stone-300 font-medium hover:text-stone-900 dark:hover:text-stone-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
