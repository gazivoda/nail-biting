import { useEffect, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { PricingSection } from '../components/PricingSection';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { TrialButton } from '../components/site/TrialButton';
import { Testimonials } from '../components/site/Testimonials';
import { PlanExtras } from '../components/billing/PlanExtras';
import { useFlagCopy } from '../features/useFlagCopy';
import { useLocale } from '../i18n/hooks';
import { useT as useChromeT } from '../i18n/scopes/marketing-chrome';
import { useT as usePricingT } from '../i18n/scopes/marketing-pricing';
import { useSitePaths, useSiteT } from '../i18n/marketing/useSite';

// Dedicated /pricing page (and /es/pricing, /de/pricing, /pt-br/pricing, WS12b). The server (server.js, and
// server/marketing/localePages.js for the other languages) injects the title, meta description, canonical, Offer schema
// and crawler-visible prose for this route — like About/HowItWorks, this page deliberately does NOT touch
// document.title or the canonical link, so the server-injected head survives hydration untouched.
//
// The pricing cards come verbatim from PricingSection (shared with the
// landing page), so /pricing and /#pricing can never show different figures.

// Keep these in step with the "Payments and cancellation" prose in server.js. The text is in the
// marketing-pricing scope; the crawler copy and the FAQPage JSON-LD are built from the same messages.
const FAQ_KEYS = [1, 2, 3, 4] as const;

const INCLUDE_KEYS = ['plan.f1', 'plan.f2', 'plan.f3', 'plan.f4', 'plan.privacy'] as const;

export function PricingPage() {
  useTheme('light');
  const t = useSiteT(usePricingT);
  const c = useSiteT(useChromeT);
  const paths = useSitePaths();
  const { locale } = useLocale();
  // The questions and answers that list the plans say a third one while the Lifetime plan is for sale (English; shared/flagCopy.js,
  // the server words the crawler copy and the FAQPage data with the same rules). With the flag off `copy` returns the text it was given.
  const copy = useFlagCopy();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const refundLink = { link: (chunks: ReactNode) => <a href="/refund-policy" className="sg-link">{chunks}</a> };
  const faqs: { q: string; a: ReactNode }[] = FAQ_KEYS.map(n => ({
    q: copy(t(`faq.${n}.q`)),
    a: n === 4 ? t.rich('faq.4.a', undefined, refundLink) : copy(t(`faq.${n}.a`)),
  }));

  // In the homepage's sign system (tokens in `.sg-page`, see DESIGN.md), with
  // the same header and footer. The price headline from PricingSection is this
  // page's h1: there used to be a smaller Inter "Stop Biting Pricing" h1 above
  // a larger h2, in two typefaces.
  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">
      <SiteHeader page="pricing" />

      <main id="main" className="sg-container pt-28 pb-20 lg:pt-32">
        <nav aria-label={c('bc.label')} className="sg-note mb-8 flex items-center gap-2">
          <a href={paths.home} className="hover:text-[color:var(--sg-ink)]">{c('bc.home')}</a>
          <span aria-hidden="true">/</span>
          <span className="text-[color:var(--sg-ink)]">{t('bc.pricing')}</span>
        </nav>

        <PricingSection headingAs="h1" />

        <PlanExtras />{/* WS9: lifetime and gift (flags lifetime_plan, gift_plan); nothing while they are off */}

        <div className="mx-auto mt-20 grid max-w-4xl gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Mirrors the "What every plan includes" list in the server-injected prose. */}
          <section aria-labelledby="plan-includes-heading" className="lg:col-span-5">
            <h2 id="plan-includes-heading" className="sg-h3">{t('includes.heading')}</h2>
            <ul className="mt-4 space-y-3">
              {INCLUDE_KEYS.map(key => (
                <li key={key} className="sg-body flex items-start gap-2.5">
                  <Check size={17} className="mt-1 shrink-0 text-[color:var(--sg-green)]" aria-hidden="true" />
                  <span>{c(key)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="pricing-faq-heading" className="lg:col-span-7">
            <h2 id="pricing-faq-heading" className="sg-h3">{t('faq.heading')}</h2>
            <div className="mt-4 border-t border-[color:var(--sg-rule)]">
              {faqs.map(({ q, a }, i) => (
                <details key={i} className="group border-b border-[color:var(--sg-rule)]">
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

        {/* Real quotes are written in English; they are not shown next to a translated page. */}
        {locale === 'en' && <Testimonials className="mx-auto mt-20 max-w-4xl" container={false} />}

        <div className="mx-auto mt-20 flex max-w-4xl flex-col items-start gap-4 border-t border-[color:var(--sg-rule)] pt-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="sg-h3">{t('cta.heading')}</p>
            <p className="sg-small mt-1">
              {t.rich('cta.note', undefined, {
                how: chunks => <a href={paths.how} className="sg-link">{chunks}</a>,
                calc: chunks => <a href="/tools/nail-biting-cost-calculator" className="sg-link">{chunks}</a>,
              })}
            </p>
          </div>
          <TrialButton source="pricing_page" />
        </div>
      </main>

      <SiteFooter page="pricing" />
    </div>
  );
}
