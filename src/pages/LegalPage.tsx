import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggle } from '../components/ThemeToggle';

interface Section {
  heading: string;
  content: string | string[];
}

interface Props {
  title: string;
  lastUpdated: string;
  sections: Section[];
}

export function LegalPage({ title, lastUpdated, sections }: Props) {
  useTheme();

  return (
    <div className="min-h-dvh bg-cream-100 dark:bg-ink-100 text-stone-800 dark:text-stone-200">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-cream-100/90 dark:bg-ink-100/90 backdrop-blur-md border-b border-stone-200 dark:border-ink-400">
        <a href="/" className="text-sm font-semibold text-stone-800 dark:text-stone-100 tracking-tight">Stop Biting</a>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back
          </a>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 pt-28 pb-20">
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">{title}</h1>
        <p className="text-stone-400 dark:text-stone-500 text-sm mt-2">Last updated: {lastUpdated}</p>

        <div className="mt-10 space-y-8">
          {sections.map(({ heading, content }) => (
            <section key={heading}>
              <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100 mb-2">{heading}</h2>
              {Array.isArray(content) ? (
                <ul className="space-y-1.5">
                  {content.map((item, i) => (
                    <li key={i} className="flex gap-2 text-stone-500 dark:text-stone-400 text-sm leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-forest-500 flex-shrink-0 mt-1.5" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed">{content}</p>
              )}
            </section>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-stone-200 dark:border-ink-400 text-xs text-stone-400 dark:text-stone-500 space-y-1">
          <p>Stop Biting · <a href="https://stopbiting.today" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">stopbiting.today</a></p>
          <p>Contact: <a href="mailto:hello@stopbiting.today" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">hello@stopbiting.today</a></p>
        </div>
      </main>

      <footer className="border-t border-stone-200 dark:border-ink-400 py-6 px-8 bg-cream-200 dark:bg-ink-200">
        <div className="max-w-2xl mx-auto flex flex-wrap gap-4 text-xs text-stone-400 dark:text-stone-500">
          <a href="/" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Home</a>
          <a href="/privacy" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Privacy Policy</a>
          <a href="/terms-and-conditions" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Terms of Service</a>
          <a href="/refund-policy" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Refund Policy</a>
        </div>
      </footer>
    </div>
  );
}
