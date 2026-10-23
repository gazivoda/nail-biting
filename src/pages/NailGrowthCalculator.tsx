import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { PageHero } from '../components/site/PageHero';
import { TrialButton } from '../components/site/TrialButton';
import { ShareButton } from '../components/site/ShareButton';
import { buildShareUrl, cleanChoiceParam, cleanNumberParam } from '../utils/shareLink';
import { track } from '../utils/track';
import { FINGERNAIL_MM_PER_MONTH, TOENAIL_MM_PER_MONTH, monthsToGrow, type NailKind } from '../utils/nailGrowth';
import { TRIAL_HYPHEN } from '../../shared/plans.js';

// /tools/nail-growth-timeline-calculator. The server (server.js) injects the head
// and the crawler-visible copy; like /pricing, this page does not touch
// document.title or the canonical link. Keep the prose in step with the
// injectSsrArticle block in that route. The one source is Yaemsiri et al. 2010
// (see src/utils/nailGrowth.ts).
const num = (s: string) => (s.trim() === '' ? 0 : Number(s));

export function NailGrowthCalculator() {
  useTheme('light');
  // A shared link opens with the inputs filled in: ?mm=10&type=toe
  const [mm, setMm] = useState(() => cleanNumberParam(new URLSearchParams(window.location.search).get('mm')));
  const [kind, setKind] = useState<NailKind>(() =>
    cleanChoiceParam(new URLSearchParams(window.location.search).get('type'), ['fingernail', 'toenail'] as const, 'fingernail'));

  const entered = mm.trim() !== '';
  const r = monthsToGrow(num(mm), kind);
  const rate = kind === 'fingernail' ? FINGERNAIL_MM_PER_MONTH : TOENAIL_MM_PER_MONTH;

  // One event the first time someone fills in a number, not one per keystroke.
  // A link opened with the inputs already filled in is not someone using the
  // calculator, so it does not count.
  const openedFilled = useRef(entered);
  useEffect(() => {
    if (entered && !openedFilled.current) track('calculator_use', 'nail_growth');
  }, [entered]);

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">
      <SiteHeader />
      <main id="main" className="sg-container pt-28 pb-20 lg:pt-32">
        <PageHero className="mb-12">
        <nav aria-label="Breadcrumb" className="sg-note mb-8 flex items-center gap-2">
          <a href="/" className="hover:text-[color:var(--sg-ink)]">Home</a>
          <span aria-hidden="true">/</span>
          <span className="text-[color:var(--sg-ink)]">Nail growth timeline calculator</span>
        </nav>

        <h1 className="sg-h1-md max-w-[20ch]">How long will it take to <span className="sg-hl">grow</span> your nails back?</h1>
        <p className="sg-body sg-measure mt-5">
          Enter how much nail you want to grow. The result divides it by the average growth rate measured
          in one published study, so it is an estimate and not a promise.
        </p>
        </PageHero>

        <div className="mt-10 grid gap-10 lg:grid-cols-12">
          <form className="grid gap-6 lg:col-span-6" onSubmit={e => e.preventDefault()}>
            <div>
              <label htmlFor="growth-mm" className="block text-[0.9375rem] font-semibold text-[color:var(--sg-ink)]">Length you want to grow (mm)</label>
              <p className="sg-note mt-1">Measure the extra nail you are aiming for. 1 cm is 10 mm.</p>
              <input
                id="growth-mm"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={mm}
                onChange={e => setMm(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[color:var(--sg-rule)] bg-white px-4 py-3 text-[color:var(--sg-ink)]"
              />
            </div>
            <div>
              <label htmlFor="growth-kind" className="block text-[0.9375rem] font-semibold text-[color:var(--sg-ink)]">Fingernail or toenail</label>
              <select
                id="growth-kind"
                value={kind}
                onChange={e => setKind(e.target.value as NailKind)}
                className="mt-2 w-full rounded-xl border border-[color:var(--sg-rule)] bg-white px-4 py-3 text-[color:var(--sg-ink)]"
              >
                <option value="fingernail">Fingernail</option>
                <option value="toenail">Toenail</option>
              </select>
            </div>
          </form>

          <div className="lg:col-span-6" aria-live="polite">
            <div className="rounded-2xl border border-[color:var(--sg-rule)] bg-white p-6">
              {entered ? (
                <>
                  <p className="sg-note">At the average rate, about</p>
                  <p className="mt-1 text-4xl font-bold text-[color:var(--sg-ink)]">{r.months} {r.months === 1 ? 'month' : 'months'}</p>
                  <p className="sg-body mt-3">That is about {r.weeks} {r.weeks === 1 ? 'week' : 'weeks'}, using {rate} mm a month for a {kind}.</p>
                  <ShareButton
                    source="nail_growth"
                    getUrl={() => buildShareUrl(window.location.origin, window.location.pathname, { mm, type: kind })}
                  />
                </>
              ) : (
                <p className="sg-body">Enter a length to see the estimate.</p>
              )}
            </div>
            <div className="mt-6">
              <TrialButton source="nail_growth_calculator" />
              <p className="sg-note mt-3">{TRIAL_HYPHEN} free trial, no credit card. Then $2.99/month or $29/year.</p>
              <p className="sg-note mt-2">
                Or <a href="/#live-demo" onClick={() => track('demo_link_click', 'nail_growth_calculator')} className="sg-link">try the 60 second demo</a> first, no account.
              </p>
            </div>
          </div>
        </div>

        <section className="mt-16 max-w-2xl" aria-labelledby="growth-notes">
          <h2 id="growth-notes" className="sg-h3">Where the rate comes from, and what it leaves out</h2>
          <p className="sg-body mt-3">
            The rates are from a study of 22 healthy young adults in the United States who marked their nails and
            measured the distance one to three months later: 3.47 mm a month for fingernails and 1.62 mm for
            toenails (Yaemsiri et al., 2010). It is a small sample of young, healthy people, and the little
            fingernail grew slower than the others. The same study found faster growth with younger age, male
            gender and onychophagia, but none of those differences was statistically significant.
          </p>
          <p className="sg-body mt-3">
            The calculator knows nothing about how damaged your nails are. It only divides a length by an average.
            Read <a className="sg-link" href="/blog/grow-nails-after-nail-biting">how to grow your nails after nail biting</a> for
            what to expect week by week, or <a className="sg-link" href="/tools/nail-biting-cost-calculator">work out what biting costs you</a>.
            Stop Biting is not a medical treatment.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
