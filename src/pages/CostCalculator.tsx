import { useEffect, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { TrialButton } from '../components/site/TrialButton';
import { track } from '../utils/track';
import { MONTHLY_PER_YEAR, YEARLY_PRICE, yearlyCost } from '../utils/costCalc';

// /tools/nail-biting-cost-calculator. The server (server.js) injects the head
// and the crawler-visible copy; like /pricing, this page does not touch
// document.title or the canonical link. Keep the prose in step with the
// injectSsrArticle block in that route.
const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
const num = (s: string) => (s.trim() === '' ? 0 : Number(s));

function Field({ id, label, hint, value, onChange }: {
  id: string; label: string; hint: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[0.9375rem] font-semibold text-[color:var(--sg-ink)]">{label}</label>
      <p className="sg-note mt-1">{hint}</p>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-[color:var(--sg-rule)] bg-white px-4 py-3 text-[color:var(--sg-ink)]"
      />
    </div>
  );
}

export function CostCalculator() {
  useTheme('light');
  const [manicures, setManicures] = useState('');
  const [price, setPrice] = useState('');
  const [other, setOther] = useState('');

  const entered = [manicures, price, other].some(v => v.trim() !== '');
  const r = yearlyCost({ manicuresPerYear: num(manicures), manicurePrice: num(price), otherPerYear: num(other) });
  const less = r.vsYearlyPlan < 0;

  // One event the first time someone fills in a number, not one per keystroke.
  useEffect(() => {
    if (entered) track('calculator_use');
  }, [entered]);

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">
      <SiteHeader />
      <main id="main" className="sg-container pt-28 pb-20 lg:pt-32">
        <nav aria-label="Breadcrumb" className="sg-note mb-8 flex items-center gap-2">
          <a href="/" className="hover:text-[color:var(--sg-ink)]">Home</a>
          <span aria-hidden="true">/</span>
          <span className="text-[color:var(--sg-ink)]">Nail biting cost calculator</span>
        </nav>

        <h1 className="sg-h1 max-w-[20ch]">What does nail biting cost you each year?</h1>
        <p className="sg-body sg-measure mt-5">
          Enter what you actually spend on repairing the damage. The result uses only your numbers and
          our published prices, so there is no assumed average in it.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-12">
          <form className="grid gap-6 lg:col-span-6" onSubmit={e => e.preventDefault()}>
            <Field id="manicures" label="Manicures or nail repairs per year" hint="Salon visits to fix or hide bitten nails." value={manicures} onChange={setManicures} />
            <Field id="price" label="What each one costs ($)" hint="Your usual price, including tip." value={price} onChange={setPrice} />
            <Field id="other" label="Other yearly spend ($)" hint="Bitter polish, press-ons, creams, anything else you buy for it." value={other} onChange={setOther} />
          </form>

          <div className="lg:col-span-6" aria-live="polite">
            <div className="rounded-2xl border border-[color:var(--sg-rule)] bg-white p-6">
              {entered ? (
                <>
                  <p className="sg-note">Your yearly cost</p>
                  <p className="mt-1 text-4xl font-bold text-[color:var(--sg-ink)]">{money(r.yearly)}</p>
                  <p className="sg-body mt-3">Over five years at the same rate: {money(r.fiveYears)}.</p>
                  <p className="sg-body mt-3">
                    {less
                      ? `That is ${money(-r.vsYearlyPlan)} less than the ${money(YEARLY_PRICE)} yearly plan, so on cost alone the app would not pay for itself. It is only worth it if it stops the biting.`
                      : r.yearly === YEARLY_PRICE
                        ? `That equals the ${money(YEARLY_PRICE)} yearly plan.`
                        : `That is ${money(r.vsYearlyPlan)} more than the ${money(YEARLY_PRICE)} yearly plan (${money(MONTHLY_PER_YEAR)} if you pay monthly).`}
                  </p>
                </>
              ) : (
                <p className="sg-body">Fill in any field to see your yearly cost.</p>
              )}
            </div>
            <div className="mt-6">
              <TrialButton source="cost_calculator" />
              <p className="sg-note mt-3">3-day free trial, no credit card. Then $2.99/month or $29/year.</p>
            </div>
          </div>
        </div>

        <section className="mt-16 max-w-2xl" aria-labelledby="calc-notes">
          <h2 id="calc-notes" className="sg-h3">What this does and does not count</h2>
          <p className="sg-body mt-3">
            It counts money you already spend. It does not count nail damage, infection risk or dental costs,
            and Stop Biting is not a medical treatment. Read <a className="sg-link" href="/blog/nail-biting-cost">the real cost of nail biting</a>{' '}
            for the wider picture, or <a className="sg-link" href="/pricing">see pricing</a>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
