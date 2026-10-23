import { Rings } from './Rings';
import { TrialButton } from './TrialButton';
import { TRIAL_DAYS_TEXT } from '../../../shared/plans.js';

// The closing call to action, shared by every marketing page (SiteFooter
// renders it). The offer must match PricingSection and the homepage.
const OFFER_LINE = `${TRIAL_DAYS_TEXT} free, no card, then $2.99/month`;

export function ClosingCta({ source = 'page_closing' }: { source?: string } = {}) {
  return (
    <section aria-label="Call to action" className="pb-10 pt-6 lg:pb-14">
      <div className="sg-container">
        <div className="sg-hero sg-dark bite relative flex flex-col items-start gap-8 overflow-hidden p-8 py-14 sm:p-12 lg:flex-row lg:items-center lg:justify-between lg:p-16">
          <Rings className="-left-64 -top-64 h-[40rem] w-[40rem]" />
          <div className="relative">
            <p className="sg-h1 max-w-[12ch]">Catch your next <span className="sg-hl">bite.</span></p>
            <p className="mt-5 max-w-[48ch] text-lg text-white/80">
              Leave it running through your next workday, then open History and see when you bite.
            </p>
          </div>
          <div className="relative flex flex-col items-start gap-3">
            <TrialButton tone="light" source={source} />
            <p className="sg-note whitespace-nowrap">{OFFER_LINE}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
