import { useEffect } from 'react';
import { ArrowLeft, BookOpen, Shield, Cpu, Bell, BarChart2, ArrowRight } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggle } from '../components/ThemeToggle';

export function HowItWorks() {
  useTheme();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const steps = [
    {
      num: '01',
      title: 'Open the app',
      body: 'Visit stopbiting.today in Chrome, Edge, or Firefox — no installation needed. Or download the macOS or Windows desktop app for background running.',
    },
    {
      num: '02',
      title: 'Grant camera access',
      body: 'Allow webcam access. The video feed is processed entirely on your device by MediaPipe running in WebAssembly. Nothing is transmitted anywhere.',
    },
    {
      num: '03',
      title: 'Position your camera',
      body: 'Make sure your face and hands are visible in the camera view. The AI tracks 21 hand landmarks and detects when they approach the mouth region.',
    },
    {
      num: '04',
      title: 'Work, game, or study normally',
      body: 'Stop Biting runs in the background at 30fps. When it detects your hand moving to your mouth, an audible alarm fires within one second.',
    },
    {
      num: '05',
      title: 'Respond to the alarm',
      body: 'The alarm is your awareness signal. Press both palms flat on your desk for 60 seconds — a competing response that is physically incompatible with biting. Over 2–4 weeks, this breaks the habit loop.',
    },
  ];

  const specs = [
    { icon: <Cpu size={18} />, label: 'Detection model', value: 'Google MediaPipe Hand Landmarker (21 landmarks)' },
    { icon: <Shield size={18} />, label: 'Processing', value: 'WebAssembly — sandboxed, on-device, no network access' },
    { icon: <Bell size={18} />, label: 'Alarm latency', value: 'Under 1 second from detection to alarm' },
    { icon: <BarChart2 size={18} />, label: 'Incident logging', value: 'Timestamped log stored locally — never transmitted' },
  ];

  const faqs = [
    {
      q: 'Does it work if I\'m not at the camera?',
      a: 'Detection requires your face and hands to be in frame. For work-from-home desk setups, most users are naturally in frame throughout the day.',
    },
    {
      q: 'Will it false-alarm when I\'m eating or touching my face?',
      a: 'The detection model distinguishes sustained hand-to-mouth proximity from brief touches. Sensitivity can be adjusted in settings. Most users find the default sensitivity produces very few false positives.',
    },
    {
      q: 'Does it work in the dark?',
      a: 'Detection accuracy decreases significantly in poor lighting. A desk lamp or good ambient lighting is sufficient — you don\'t need special lighting.',
    },
    {
      q: 'What happens to my camera data?',
      a: 'Nothing. The video feed is processed frame-by-frame by the MediaPipe WASM binary running locally. No frames, no thumbnails, no data of any kind is sent to any server. You can verify this by watching your network traffic while the app runs.',
    },
    {
      q: 'Does it work on Mac, Windows, and Linux?',
      a: 'The web app works on any device with a modern browser and webcam — Mac, Windows, Linux, and Chromebook. Native desktop apps are available for macOS and Windows for system-tray background running.',
    },
  ];

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
          <a href="/pricing" className="text-sm font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors">
            Pricing
          </a>
          <a href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold bg-forest-600 hover:bg-forest-500 text-cream-100 px-4 py-1.5 rounded-xl transition-all duration-150 hover:-translate-y-0.5">
            Try Free
          </a>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 pt-28 pb-24">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 mb-8">
          <a href="/" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Home</a>
          <span aria-hidden="true">/</span>
          <span className="text-stone-500 dark:text-stone-400">How It Works</span>
        </nav>

        <header className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-800 dark:text-stone-100 leading-tight mb-4">
            How AI Nail Biting Detection Works
          </h1>
          <p className="text-lg text-stone-500 dark:text-stone-400 leading-relaxed">
            Stop Biting uses MediaPipe and WebAssembly to detect nail biting in real time — entirely on your device.
            Setup takes under two minutes.
          </p>
        </header>

        {/* The awareness gap explanation */}
        <section className="mb-12 p-6 rounded-2xl bg-stone-50 dark:bg-ink-50 border border-stone-200 dark:border-ink-400">
          <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100 mb-3">Why awareness is the bottleneck</h2>
          <p className="text-[15px] text-stone-600 dark:text-stone-400 leading-relaxed">
            Most nail biters catch fewer than half of their daily biting episodes through self-monitoring alone.
            The habit is automatic — it runs below the threshold of conscious awareness.{' '}
            <a href="/blog/habit-reversal-training-guide" className="text-forest-600 dark:text-forest-400 hover:underline">
              Habit Reversal Training
            </a>
            {' '}(the gold-standard treatment) identifies awareness training as its most critical component.
            Stop Biting automates that component: it catches the episodes you don't notice.
          </p>
        </section>

        {/* Steps */}
        <section className="mb-14">
          <h2 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-6">Getting started</h2>
          <ol className="space-y-6">
            {steps.map((step) => (
              <li key={step.num} className="flex gap-5">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-forest-100 dark:bg-forest-900/40 border border-forest-200 dark:border-forest-800 flex items-center justify-center">
                  <span className="text-forest-600 dark:text-forest-400 text-xs font-bold">{step.num}</span>
                </div>
                <div className="pt-1.5">
                  <p className="font-semibold text-stone-800 dark:text-stone-100 mb-1">{step.title}</p>
                  <p className="text-[15px] text-stone-500 dark:text-stone-400 leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Technical specs */}
        <section className="mb-14">
          <h2 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-6">Technical specifications</h2>
          <div className="divide-y divide-stone-200 dark:divide-ink-400">
            {specs.map((spec) => (
              <div key={spec.label} className="flex items-start gap-4 py-4">
                <div className="text-forest-500 dark:text-forest-400 mt-0.5 flex-shrink-0">{spec.icon}</div>
                <div>
                  <p className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-0.5">{spec.label}</p>
                  <p className="text-[15px] text-stone-700 dark:text-stone-300">{spec.value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-14">
          <h2 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-6">Common questions</h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q}>
                <p className="font-medium text-stone-800 dark:text-stone-100 mb-2">{faq.q}</p>
                <p className="text-[15px] text-stone-500 dark:text-stone-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related links */}
        <section className="mb-14">
          <h2 className="text-base font-semibold text-stone-700 dark:text-stone-300 mb-4">Learn more</h2>
          <div className="flex flex-col gap-3">
            {[
              { href: '/blog/habit-reversal-training-guide', label: 'Habit Reversal Training: the clinical method behind the app' },
              { href: '/blog/stop-biting-app-review', label: 'Stop Biting app review: what to expect in the first two weeks' },
              { href: '/blog/webcam-privacy-nail-biting-app', label: 'How we verified on-device processing' },
              { href: '/compare/bitter-polish-alternative', label: 'Stop Biting vs bitter nail polish: which works?' },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="group flex items-center justify-between gap-4 rounded-xl border border-stone-200 dark:border-ink-400 bg-white dark:bg-ink-50 px-4 py-3 hover:border-forest-300 dark:hover:border-forest-700 hover:shadow-sm transition-all"
              >
                <span className="text-sm text-stone-700 dark:text-stone-200 group-hover:text-forest-600 dark:group-hover:text-forest-400 transition-colors">{link.label}</span>
                <ArrowRight size={14} className="text-stone-400 group-hover:text-forest-500 shrink-0 transition-colors" aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl bg-forest-50 dark:bg-forest-900/20 border border-forest-200 dark:border-forest-800 p-8 text-center">
          <p className="text-stone-500 dark:text-stone-400 text-sm mb-1">3-day free trial — no credit card needed</p>
          <p className="text-stone-900 dark:text-stone-100 font-semibold text-xl mb-5">Try Stop Biting free</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-xl px-6 py-3 text-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_oklch(38%_0.12_148/0.35)] active:scale-95"
          >
            Launch App
          </a>
          <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">
            $2.99/month · $29/year · Cancel anytime
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
          {' — '}AI-powered nail biting tracker for Mac and Windows
        </p>
      </footer>
    </div>
  );
}
