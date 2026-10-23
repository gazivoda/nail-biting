// The Settings page building blocks, moved here unchanged from Settings.tsx so
// the section files in ./sections can use them without importing the page (which
// would be circular). Markup and classes are byte-for-byte what the page had.

import type { LucideIcon } from 'lucide-react';

export function Section({ title, icon: Icon, children, fullWidth, danger }: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  fullWidth?: boolean;
  danger?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border bg-white p-5 sm:p-6 dark:bg-ink-50 ${
        danger ? 'border-alert-400 dark:border-alert-800' : 'border-stone-200 dark:border-ink-400'
      } ${fullWidth ? 'md:col-span-2' : ''}`}
    >
      <div className="mb-5 flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
            danger ? 'bg-alert-100 text-alert-600 dark:bg-alert-900/30 dark:text-alert-400' : 'bg-stone-100 text-stone-700 dark:bg-ink-fill dark:text-stone-200'
          }`}
        >
          <Icon size={16} />
        </span>
        <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-stone-900 dark:text-stone-100">{title}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function Row({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{label}</p>
        {description && <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  // The button is the 44px target; the pill inside is the visible track.
  return (
    <button
      type="button"
      aria-label={label}
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="group flex h-11 w-16 flex-shrink-0 items-center justify-center rounded-full"
    >
      <span className={`relative h-8 w-14 rounded-full transition-colors duration-200 ${value ? 'bg-deep dark:bg-lime-300' : 'bg-stone-300 dark:bg-ink-400'}`}>
        <span className={`absolute left-1 top-1 h-6 w-6 rounded-full transition-transform duration-200 ${value ? 'translate-x-6 bg-lime-300 dark:bg-deep' : 'translate-x-0 bg-white dark:bg-stone-300'}`} />
      </span>
    </button>
  );
}
