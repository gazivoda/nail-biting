import { useEffect, type ReactNode } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronDown, Zap } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ThemeToggle } from '../components/ThemeToggle';
import { PricingSection } from '../components/PricingSection';

// Dedicated /pricing page. The server (server.js) injects the title, meta
// description, canonical (https://stopbiting.today/pricing), Offer schema and
// crawler-visible prose for this route — like About/HowItWorks, this page
// deliberately does NOT touch document.title or the canonical link, so the
// server-injected head survives hydration untouched.
//
// The pricing cards come verbatim from PricingSection (shared with the
// landing page), so /pricing and /#pricing can never show different figures.

// Keep these in step with the "Payments and cancellation" prose in server.js.
const PRICING_FAQS: { q: string; a: ReactNode }[] = [
  {
    q: 'How does the 3-day free trial work?',
    a: 'Every account starts with a 3-day free trial that includes full detection and tracking features — no credit card required. When the trial ends, pick the monthly or yearly plan to keep going.',
  },
  {
    q: 'What is the difference between Monthly and Yearly?',
    a: 'Both plans include unlimited AI detection, streak and habit tracking, full incident history, and all alert types. Yearly is billed once at $29.00 — about $2.42/month, saving 19% versus $2.99/month billing — and adds priority support.',
  },
  {
    q: 'How do payments work?',
    a: 'Payments are handled by Paddle, a secure merchant of record. Stop Biting never sees or stores your card details.',
  },
  {
    q: 'Can I cancel anytime?',
    a: (
      <>
        Yes — cancel anytime from the app settings and you keep access until the end of the paid
        period. See the{' '}
        <a href="/refund-policy" className="text-forest-600 dark:text-forest-400 hover:underline">
          refund policy
        </a>{' '}
        for details.
      </>
    ),
  },
];

// Mirrors the "What every plan includes" list in the server-injected prose.
const PLAN_INCLUDES = [
  'Unlimited real-time AI nail biting detection via your webcam',
  'Streak and habit tracking with all-time best record',
  'Full incident history with trigger tagging',
  'All alert types (sound and visual)',
  '100% on-device processing — no camera data ever leaves your device',
];

export function PricingPage() {
  useTheme();
  useScrollReveal();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="min-h-dvh bg-cream-100 dark:bg-ink-100 text-stone-800 dark:text-stone-200">

      {/* Nav */}
      <nav aria-label="Site navigation" className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-cream-100/90 dark:bg-ink-100/90 backdrop-blur-md border-b border-stone-200 dark:border-ink-400">
        <a href="/" className="text-sm font-semibold text-stone-800 dark:text-stone-100 tracking-tight">Stop Biting</a>
        <div className="flex items-center gap-6">
          <a href="/blog" className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 text-sm transition-colors">
            <BookOpen size={14} aria-hidden="true" />
            Blog
          </a>
          <ThemeToggle />
          <a href="/" className="text-sm font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors">
            Launch App
          </a>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-24">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 mb-8">
          <a href="/" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Home</a>
          <span aria-hidden="true">/</span>
          <span className="text-stone-500 dark:text-stone-400">Pricing</span>
        </nav>

        <header className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-800 dark:text-stone-100 leading-tight">
            Stop Biting Pricing
          </h1>
        </header>

        {/* Pricing cards — shared verbatim with the landing page */}
        <PricingSection />

        {/* What every plan includes — mirrors the server-injected prose */}
        <section aria-labelledby="plan-includes-heading" className="mt-16 max-w-2xl mx-auto">
          <h2 id="plan-includes-heading" className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-4 text-center">
            What every plan includes
          </h2>
          <ul className="space-y-2.5">
            {PLAN_INCLUDES.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-[15px] text-stone-600 dark:text-stone-400 leading-relaxed">
                <Check size={15} className="text-forest-500 dark:text-forest-400 shrink-0 mt-1" aria-hidden="true" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section aria-labelledby="pricing-faq-heading" className="mt-16 max-w-2xl mx-auto">
          <h2 id="pricing-faq-heading" className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-6 text-center">
            Pricing questions
          </h2>
          <div className="flex flex-col gap-3">
            {PRICING_FAQS.map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-xl border border-stone-200 dark:border-ink-400 bg-white dark:bg-ink-50 px-5 py-4 shadow-card open:shadow-card-md transition-shadow"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-stone-800 dark:text-stone-100 marker:content-none [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-stone-400 transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed mt-3">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="mt-16 max-w-2xl mx-auto rounded-2xl bg-forest-50 dark:bg-forest-900/20 border border-forest-200 dark:border-forest-800 p-8 text-center">
          <p className="text-stone-500 dark:text-stone-400 text-sm mb-1">3-day free trial — no credit card needed</p>
          <p className="text-stone-900 dark:text-stone-100 font-semibold text-xl mb-5">Start free today</p>
          <a
            href="/api/auth/google"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-xl px-6 py-3 text-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_oklch(38%_0.12_148/0.35)] active:scale-95"
          >
            <Zap size={14} aria-hidden="true" />
            Start free trial
          </a>
          <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">
            Or read{' '}
            <a href="/how-it-works" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors underline">
              how the AI detection works
            </a>
          </p>
        </div>

        <div className="mt-10 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to home
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-stone-200 dark:border-ink-400 py-8 px-6 text-center text-stone-400 dark:text-stone-500 text-sm bg-cream-200 dark:bg-ink-200">
        <p>
          <a href="/" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Stop Biting</a>
          {' — '}Built by <a href="/about" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Igor Gazivoda</a>
        </p>
      </footer>
    </div>
  );
}
