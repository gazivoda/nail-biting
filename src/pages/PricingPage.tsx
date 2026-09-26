import { useEffect, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { PricingSection } from '../components/PricingSection';
import { PLAN_FEATURES } from '../components/site/plans';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { TrialButton } from '../components/site/TrialButton';

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
    a: 'Every account starts with a 3-day free trial that includes full detection and tracking features, with no credit card required. When the trial ends, pick the monthly or yearly plan to keep going.',
  },
  {
    q: 'What is the difference between Monthly and Yearly?',
    a: 'Both plans include the same features: detection for as long as you run it, current and best streak, full history with trigger tags, and sound, flash, or both. Yearly is billed once at $29.00 (about $2.42/month, saving 19% versus $2.99/month billing) and adds priority support.',
  },
  {
    q: 'How do payments work?',
    a: 'Payments are handled by Paddle, a secure merchant of record. Stop Biting never sees or stores your card details.',
  },
  {
    q: 'Can I cancel anytime?',
    a: (
      <>
        Yes. Cancel anytime from the app settings and you keep access until the end of the paid
        period. See the{' '}
        <a href="/refund-policy" className="sg-link">
          refund policy
        </a>{' '}
        for details.
      </>
    ),
  },
];

// The same wording as the pricing cards (site/plans.ts) plus the privacy line.
// Mirrors the "What every plan includes" list in the server-injected prose.
const PLAN_INCLUDES = [...PLAN_FEATURES, 'Detection runs on your device; no camera data leaves it'];

export function PricingPage() {
  useTheme('light');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // In the homepage's sign system (tokens in `.sg-page`, see DESIGN.md), with
  // the same header and footer. The price headline from PricingSection is this
  // page's h1: there used to be a smaller Inter "Stop Biting Pricing" h1 above
  // a larger h2, in two typefaces.
  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">
      <SiteHeader />

      <main id="main" className="sg-container pt-28 pb-20 lg:pt-32">
        <nav aria-label="Breadcrumb" className="sg-note mb-8 flex items-center gap-2">
          <a href="/" className="hover:text-[color:var(--sg-ink)]">Home</a>
          <span aria-hidden="true">/</span>
          <span className="text-[color:var(--sg-ink)]">Pricing</span>
        </nav>

        <PricingSection headingAs="h1" />

        <div className="mx-auto mt-20 grid max-w-4xl gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Mirrors the "What every plan includes" list in the server-injected prose. */}
          <section aria-labelledby="plan-includes-heading" className="lg:col-span-5">
            <h2 id="plan-includes-heading" className="sg-h3">What every plan includes</h2>
            <ul className="mt-4 space-y-3">
              {PLAN_INCLUDES.map(f => (
                <li key={f} className="sg-body flex items-start gap-2.5">
                  <Check size={17} className="mt-1 shrink-0 text-[color:var(--sg-green)]" aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="pricing-faq-heading" className="lg:col-span-7">
            <h2 id="pricing-faq-heading" className="sg-h3">Pricing questions</h2>
            <div className="mt-4 border-t border-[color:var(--sg-rule)]">
              {PRICING_FAQS.map(({ q, a }) => (
                <details key={q} className="group border-b border-[color:var(--sg-rule)]">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[1.0625rem] font-bold marker:content-none [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown size={20} aria-hidden="true" className="shrink-0 text-[color:var(--sg-ink-2)] transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <p className="sg-body pb-5">{a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <div className="mx-auto mt-20 flex max-w-4xl flex-col items-start gap-4 border-t border-[color:var(--sg-rule)] pt-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="sg-h3">Try it free for 3 days.</p>
            <p className="sg-small mt-1">
              No card to start. Curious first? Read{' '}
              <a href="/how-it-works" className="sg-link">how the detection works</a>.
            </p>
          </div>
          <TrialButton />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
