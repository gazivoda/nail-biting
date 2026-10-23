import { useTheme } from '../hooks/useTheme';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { PageHero } from '../components/site/PageHero';
import { TrialButton } from '../components/site/TrialButton';
import { track } from '../utils/track';
import { TRIAL_HYPHEN } from '../../shared/plans.js';

// /tools/nail-biting-tracker-printable. The server (server.js) injects the head
// and the crawler-visible copy; like /pricing, this page does not touch
// document.title or the canonical link. Keep the prose in step with the
// injectSsrArticle block in that route. The sheet itself is built from
// docs/tracker/nail-biting-30-day-tracker.html (see its README).
const PDF = '/files/nail-biting-30-day-tracker.pdf';
const PREVIEW = '/files/nail-biting-30-day-tracker-preview.png';

export function PrintableTracker() {
  useTheme('light');
  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">
      <SiteHeader />
      <main id="main" className="sg-container pt-28 pb-20 lg:pt-32">
        <PageHero className="mb-12">
          <nav aria-label="Breadcrumb" className="sg-note mb-8 flex items-center gap-2">
            <a href="/" className="underline-offset-4 hover:underline">Home</a>
            <span aria-hidden="true">/</span>
            <span className="text-white">Printable nail biting tracker</span>
          </nav>
          <h1 className="sg-h1-md max-w-[18ch]">Free printable nail biting <span className="sg-hl">tracker</span></h1>
          <p className="sg-lede mt-5 max-w-[48ch]">
            A one-page, 30-day log for noticing when you bite and what is going on at the time. Print it, keep it
            on your desk, and tally each catch. It is free, with no sign-up.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href={PDF} download onClick={() => track('tracker_pdf_download')} className="sg-btn">Download the PDF</a>
            <span className="sg-note">One US Letter page, about 160 KB</span>
          </div>
        </PageHero>

        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-6">
            <section aria-labelledby="how-heading">
              <h2 id="how-heading" className="sg-h3">How to use it</h2>
              <ol className="sg-body mt-4 list-decimal space-y-3 pl-5">
                <li>Each time you notice your hand at your mouth, make a mark in that day&rsquo;s tally box.</li>
                <li>Tick what was going on: stress, deep focus, boredom or something else.</li>
                <li>Tick the competing-response box if you did something else with your hands instead.</li>
                <li>After a week, look for the moments that keep coming up.</li>
              </ol>
              <p className="sg-body mt-4">
                Keeping a self-monitoring log is the usual first step in awareness training, the first component of
                habit reversal training. Our{' '}
                <a className="sg-link" href="/blog/habit-reversal-training-guide">habit reversal guide</a> covers the
                full method.
              </p>
            </section>

            <section className="mt-10" aria-labelledby="limits-heading">
              <h2 id="limits-heading" className="sg-h3">What a paper log can and cannot do</h2>
              <p className="sg-body mt-3">
                A paper log only records what you notice, and much nail biting happens without noticing. If you work
                at a computer, Stop Biting watches through your webcam and sounds an alarm the moment your hand
                reaches your mouth, so the catches are logged for you. It detects nail biting only, and only in front
                of your webcam. A log is a way to notice a habit, not a treatment.
              </p>
              <div className="mt-6">
                <TrialButton source="printable_tracker" />
                <p className="sg-note mt-3">{TRIAL_HYPHEN} free trial, no credit card. Then $2.99/month or $29/year.</p>
                <p className="sg-note mt-2">
                  Or <a href="/#live-demo" onClick={() => track('demo_link_click', 'printable_tracker')} className="sg-link">try the 60 second demo</a> first, no account.
                </p>
              </div>
            </section>
          </div>

          <div className="lg:col-span-6">
            <a href={PDF} className="block rounded-2xl border border-[color:var(--sg-rule)] bg-white p-3" aria-label="Open the 30-day tracker PDF">
              <img
                src={PREVIEW}
                width={816}
                height={1056}
                alt="Preview of the 30-day nail biting tracker: a table with one row per day, a tally box, tick boxes for what was going on, and a competing response box."
                className="w-full h-auto"
                loading="eager"
                decoding="async"
              />
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
