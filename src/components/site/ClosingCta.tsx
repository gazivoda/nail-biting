import { Rings } from './Rings';
import { TrialButton } from './TrialButton';
import { useT as useChromeT } from '../../i18n/scopes/marketing-chrome';
import { useSiteT } from '../../i18n/marketing/useSite';

// The closing call to action, shared by every marketing page (SiteFooter
// renders it). The offer must match PricingSection and the homepage.
export function ClosingCta({ source = 'page_closing' }: { source?: string } = {}) {
  const t = useSiteT(useChromeT);
  return (
    <section aria-label={t('cta.aria')} className="pb-10 pt-6 lg:pb-14">
      <div className="sg-container">
        <div className="sg-hero sg-dark bite relative flex flex-col items-start gap-8 overflow-hidden p-8 py-14 sm:p-12 lg:flex-row lg:items-center lg:justify-between lg:p-16">
          <Rings className="-left-64 -top-64 h-[40rem] w-[40rem]" />
          <div className="relative">
            <p className="sg-h1 max-w-[12ch]">{t.rich('cta.heading', undefined, { hl: chunks => <span className="sg-hl">{chunks}</span> })}</p>
            <p className="mt-5 max-w-[48ch] text-lg text-white/80">
              {t('cta.body')}
            </p>
          </div>
          <div className="relative flex flex-col items-start gap-3">
            <TrialButton tone="light" source={source} />
            <p className="sg-note whitespace-nowrap">{t('offer.line')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
