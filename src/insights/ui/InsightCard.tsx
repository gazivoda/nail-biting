// The white card every chart sits in. Same surface as the History summary card: hairline, no shadow.

import type { ReactNode } from 'react';

export function InsightCard({ title, subtitle, action, children, className = '' }: {
  title: string;
  subtitle?: string;
  /** A control that belongs to this card only (a range switch). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 dark:border-ink-400 dark:bg-ink-50 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-stone-900 dark:text-stone-100">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
