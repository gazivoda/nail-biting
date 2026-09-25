import { useEffect } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { TrialButton } from '../components/site/TrialButton';

// /how-it-works, in the homepage's sign system (tokens in `.sg-page`, see
// DESIGN.md). The h1, the standfirst, "Why awareness is the bottleneck", the
// steps and the first three questions are mirrored as crawler prose and
// HowTo/FAQPage schema in server.js (HOW_IT_WORKS_FAQS): edit both together.

const STEPS = [
  {
    title: 'Open the app',
    body: 'Visit stopbiting.today in Chrome, Edge, or Firefox. There is nothing to install.',
  },
  {
    title: 'Grant camera access',
    body: 'Allow webcam access. The video feed is processed entirely on your device by MediaPipe running in WebAssembly. The video never leaves your device.',
  },
  {
    title: 'Position your camera',
    body: 'Make sure your face and hands are visible in the camera view. The AI tracks 21 hand landmarks and detects when they approach the mouth region.',
  },
  {
    title: 'Work, game, or study normally',
    body: 'Stop Biting runs in the background, checking five times a second. It needs three consecutive frames before it acts, so an alarm fires about six tenths of a second after your hand starts moving to your mouth.',
  },
  {
    title: 'Respond to the alarm',
    body: 'The alarm is your awareness signal. Do the hand exercise the app suggests, such as pressing your palms flat or clenching a fist: a competing response your hands cannot do while biting. Doing it every time is the core of habit reversal training.',
  },
];

const SPECS = [
  { label: 'Detection model', value: 'Google MediaPipe Hand Landmarker (21 landmarks)' },
  { label: 'Processing', value: 'WebAssembly: sandboxed, on-device, no network access' },
  { label: 'Alarm latency', value: 'About 0.6 seconds after your hand starts moving to your mouth' },
  { label: 'Incident logging', value: 'Timestamped log stored locally, never transmitted' },
];

// The first three match HOW_IT_WORKS_FAQS in server.js (FAQPage schema).
const FAQS = [
  {
    q: 'What happens to my camera data?',
    a: 'Nothing. The video feed is processed frame-by-frame by the MediaPipe WASM binary running locally. No frames, no thumbnails, no data of any kind is sent to any server. You can verify this by watching your network traffic while the app runs.',
  },
  {
    q: 'Does it work on Mac, Windows, and Linux?',
    a: 'The web app works on any device with a modern browser and webcam: Mac, Windows, Linux, and Chromebook.',
  },
  {
    q: "Will it false-alarm when I'm eating or touching my face?",
    a: 'The detection model distinguishes sustained hand-to-mouth proximity from brief touches, and sensitivity can be adjusted in settings.',
  },
  {
    q: "Does it work if I'm not at the camera?",
    a: 'Detection needs your face and hands in frame. At a desk you are usually in frame anyway.',
  },
  {
    q: 'Does it work in the dark?',
    a: "Detection accuracy drops in poor lighting. A desk lamp or ordinary room light is enough; you don't need anything special.",
  },
];

const LINKS = [
  { href: '/blog/habit-reversal-training-guide', label: 'Habit Reversal Training: the clinical method behind the app' },
  { href: '/blog/stop-biting-app-review', label: 'Stop Biting app review: what to expect in the first two weeks' },
  { href: '/blog/webcam-privacy-nail-biting-app', label: 'How we verified on-device processing' },
  { href: '/compare/bitter-polish-alternative', label: 'Stop Biting vs bitter nail polish: which works?' },
];

export function HowItWorks() {
  useTheme('light');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">
      <SiteHeader />

      <main className="sg-container pt-28 pb-20 lg:pt-32">
        <nav aria-label="Breadcrumb" className="sg-note mb-8 flex items-center gap-2">
          <a href="/" className="hover:text-[color:var(--sg-ink)]">Home</a>
          <span aria-hidden="true">/</span>
          <span className="text-[color:var(--sg-ink)]">How it works</span>
        </nav>

        <header className="max-w-3xl">
          <h1 className="sg-h2">How AI Nail Biting Detection Works</h1>
          <p className="sg-lede sg-measure mt-5">
            Stop Biting uses MediaPipe and WebAssembly to detect nail biting in real time, entirely on your
            device. The MediaPipe Hand Landmarker tracks 21 hand landmarks, and the alarm fires under 1 second
            after it detects your hand approaching your mouth. Setup takes under two minutes.
          </p>
        </header>

        <div className="mt-16 grid gap-12 lg:grid-cols-12 lg:gap-10">
          <section aria-labelledby="awareness-heading" className="lg:col-span-4">
            <h2 id="awareness-heading" className="sg-h3">Why awareness is the bottleneck</h2>
            <p className="sg-body mt-3">
              Most biting episodes happen without you noticing: the habit is automatic, and it runs below
              the threshold of conscious awareness.{' '}
              <a href="/blog/habit-reversal-training-guide" className="sg-link">Habit Reversal Training</a>{' '}
              (the gold-standard treatment) identifies awareness training as its most critical component.
              Stop Biting automates that component: it catches the episodes you don't notice.
            </p>
          </section>

          <section aria-labelledby="steps-heading" className="lg:col-span-7 lg:col-start-6">
            <h2 id="steps-heading" className="sg-h3">Getting started</h2>
            <ol className="mt-4 list-decimal space-y-5 border-t border-[color:var(--sg-rule)] pt-5 pl-5 marker:font-extrabold marker:text-[color:var(--sg-ink)]">
              {STEPS.map(step => (
                <li key={step.title} className="pl-2">
                  <p className="font-bold">{step.title}</p>
                  <p className="sg-body mt-1">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section aria-labelledby="specs-heading" className="mt-20">
          <h2 id="specs-heading" className="sg-h3">Technical specifications</h2>
          <dl className="mt-4 border-t border-[color:var(--sg-rule)]">
            {SPECS.map(spec => (
              <div key={spec.label} className="grid gap-1 border-b border-[color:var(--sg-rule)] py-4 sm:grid-cols-12 sm:gap-10">
                <dt className="font-bold sm:col-span-4">{spec.label}</dt>
                <dd className="sg-body sm:col-span-8">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-20 grid gap-12 lg:grid-cols-12 lg:gap-10">
          <section aria-labelledby="hiw-faq-heading" className="lg:col-span-7">
            <h2 id="hiw-faq-heading" className="sg-h3">Common questions</h2>
            <div className="mt-4 border-t border-[color:var(--sg-rule)]">
              {FAQS.map(({ q, a }) => (
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

          <section aria-labelledby="learn-heading" className="lg:col-span-4 lg:col-start-9">
            <h2 id="learn-heading" className="sg-h3">Learn more</h2>
            <ul className="mt-4 border-t border-[color:var(--sg-rule)]">
              {LINKS.map(link => (
                <li key={link.href} className="border-b border-[color:var(--sg-rule)]">
                  <a href={link.href} className="group flex min-h-12 items-center justify-between gap-4 py-3 font-semibold hover:text-[color:var(--sg-accent)]">
                    <span className="group-hover:underline group-hover:underline-offset-4">{link.label}</span>
                    <ArrowRight size={16} aria-hidden="true" className="shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-20 flex flex-col items-start gap-4 border-t border-[color:var(--sg-rule)] pt-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="sg-h3">Try it free for 3 days.</p>
            <p className="sg-small mt-1">No card to start. Then $2.99 a month or $29 a year, cancel anytime.</p>
          </div>
          <TrialButton />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
