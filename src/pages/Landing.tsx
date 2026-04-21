import { useEffect } from 'react';
import {
  ShieldCheck, Lock, Zap, Cpu, BellRing, Trophy,
  ClipboardList, BarChart2, WifiOff, HardDrive,
  Code2, ChevronDown, Camera, Bell, BookOpen,
  Star, ArrowRight, Check, Shield,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggle } from '../components/ThemeToggle';
import { DetectionWave } from '../components/DetectionWave';
import { ContactForm } from '../components/ContactForm';

// Activates scroll-reveal on all .reveal and .reveal-card elements
function useScrollReveal() {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      document.querySelectorAll('.reveal, .reveal-card').forEach(el => {
        el.classList.add('revealed');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );

    document.querySelectorAll('.reveal, .reveal-card').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

interface Props {}

export function Landing(_props: Props) {
  useTheme();
  useScrollReveal();

  return (
    <div className="min-h-dvh bg-cream-100 dark:bg-ink-100 text-stone-800 dark:text-stone-200">

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav aria-label="Site navigation" className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-cream-100/90 dark:bg-ink-100/90 backdrop-blur-md border-b border-stone-200 dark:border-ink-400">
        <a href="/" className="flex items-center gap-2 text-sm font-semibold text-stone-800 dark:text-stone-100 tracking-tight">
          <img src="/logo.svg" alt="" className="w-7 h-7 flex-shrink-0" />
          Stop Biting Nails
        </a>
        <div className="flex items-center gap-6">
          <a href="/blog" className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 text-sm transition-colors">
            <BookOpen size={14} aria-hidden="true" />
            Blog
          </a>
          <ThemeToggle />
          <a
            href="/api/auth/google"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-forest-600 hover:bg-forest-500 text-cream-100 px-4 py-1.5 rounded-xl transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_oklch(38%_0.12_148/0.4)]"
          >
            <Zap size={13} aria-hidden="true" />
            Sign in to app
          </a>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <main>
        <section
          aria-label="Hero"
          className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 text-center pt-16 overflow-hidden"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, oklch(92% 0.055 148 / 0.25) 0%, transparent 70%)' }}
        >
          {/* Floating ambient orbs */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="animate-float-slow absolute rounded-full opacity-30 dark:opacity-20"
              style={{
                width: 420, height: 420,
                top: '8%', left: '-8%',
                background: 'radial-gradient(circle, oklch(84% 0.080 148) 0%, transparent 70%)',
                filter: 'blur(60px)',
                willChange: 'transform',
                transform: 'translateZ(0)',
              }}
            />
            <div
              className="animate-float-medium absolute rounded-full opacity-20 dark:opacity-15"
              style={{
                width: 320, height: 320,
                top: '20%', right: '-6%',
                background: 'radial-gradient(circle, oklch(70% 0.110 148) 0%, transparent 70%)',
                filter: 'blur(50px)',
                animationDelay: '1.5s',
                willChange: 'transform',
                transform: 'translateZ(0)',
              }}
            />
            <div
              className="animate-float-slow absolute rounded-full opacity-15 dark:opacity-10"
              style={{
                width: 260, height: 260,
                bottom: '15%', left: '20%',
                background: 'radial-gradient(circle, oklch(76% 0.155 75) 0%, transparent 70%)',
                filter: 'blur(45px)',
                animationDelay: '3s',
                willChange: 'transform',
                transform: 'translateZ(0)',
              }}
            />
          </div>

          <div className="max-w-3xl mx-auto relative z-10">
            <p
              className="animate-fade-up text-xs tracking-[0.25em] uppercase text-forest-600 dark:text-forest-400 font-semibold mb-6"
              style={{ animationDelay: '0ms' }}
            >
              AI-powered · On-device · 3-day free trial
            </p>

            <h1
              className="animate-fade-up font-display text-5xl sm:text-6xl font-normal text-stone-800 dark:text-stone-100 leading-tight"
              style={{ animationDelay: '80ms' }}
            >
              Stop nail biting with<br />
              <em className="not-italic text-forest-600 dark:text-forest-400">real-time AI detection.</em>
            </h1>

            <p
              className="animate-fade-up text-stone-500 dark:text-stone-400 text-lg leading-relaxed max-w-xl mx-auto mt-6"
              style={{ animationDelay: '160ms' }}
            >
              The Stop Biting app uses your webcam and on-device AI to catch nail biting the moment it starts —
              then sounds an alarm.{' '}
              <span className="text-stone-700 dark:text-stone-200 font-medium">No cloud processing.</span>{' '}
              <span className="text-stone-700 dark:text-stone-200 font-medium">No camera data sent anywhere.</span>{' '}
              Works right in your browser — no install needed.
            </p>

            <div
              className="animate-fade-up flex items-center justify-center gap-1.5 text-forest-600 dark:text-forest-400 text-xs py-1.5 px-4 bg-forest-50 dark:bg-forest-900 border border-forest-200 dark:border-forest-800 rounded-full mt-6 w-fit mx-auto"
              style={{ animationDelay: '240ms' }}
            >
              <ShieldCheck size={12} aria-hidden="true" />
              <span>All AI processing on-device — zero network requests during detection</span>
              <span className="w-1.5 h-1.5 rounded-full bg-forest-500 animate-pulse ml-1" aria-hidden="true" />
            </div>

            <div
              className="animate-fade-up mt-10 flex flex-col items-center gap-4"
              style={{ animationDelay: '320ms' }}
            >
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href="/api/auth/google"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-shimmer inline-flex items-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-2xl px-6 py-3 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_oklch(38%_0.12_148/0.35)] active:scale-95"
                >
                  <Zap size={15} aria-hidden="true" />
                  Start free trial
                  <ArrowRight size={14} className="opacity-70 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                </a>
                <a
                  href="/blog"
                  className="inline-flex items-center gap-2 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-sm transition-colors"
                >
                  <BookOpen size={14} aria-hidden="true" />
                  Read the science
                </a>
              </div>
            </div>

            {/* Social proof strip */}
            <div
              className="animate-fade-up mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-stone-400 dark:text-stone-500"
              style={{ animationDelay: '400ms' }}
            >
              {['Web App', 'PWA install', 'MediaPipe AI', '100% private', 'No cloud'].map(tag => (
                <span key={tag} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-forest-400" aria-hidden="true" />
                  {tag}
                </span>
              ))}
            </div>

            {/* Detection waveform animation */}
            <div
              className="animate-fade-up mt-10 w-full"
              style={{ animationDelay: '500ms' }}
            >
              <DetectionWave />
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-in" style={{ animationDelay: '600ms' }}>
            <ChevronDown size={20} className="text-stone-300 dark:text-stone-600 animate-bounce" aria-hidden="true" />
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-8 space-y-20 pb-20">

          {/* ── PRIVACY STATEMENT ─────────────────────────────────────────── */}
          <section aria-labelledby="privacy-heading" className="reveal">
            <div className="bg-forest-50 dark:bg-forest-900 border border-forest-200 dark:border-forest-700 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-forest-100 dark:bg-forest-800 border border-forest-200 dark:border-forest-700 flex items-center justify-center mx-auto mb-6">
                <Lock size={32} className="text-forest-600 dark:text-forest-400" aria-hidden="true" />
              </div>
              <h2 id="privacy-heading" className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Your camera never leaves this app.</h2>
              <p className="text-forest-600 dark:text-forest-400 text-lg font-medium mt-1">Not even for a millisecond.</p>
              <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed mt-4 max-w-sm mx-auto">
                MediaPipe runs entirely in WebAssembly inside this app. Every frame of video is processed
                locally on your CPU or GPU. Zero bytes of camera data are transmitted to any server —
                because there is no server involved in detection.
              </p>
              <p className="text-stone-700 dark:text-stone-200 text-sm font-medium mt-4 pt-4 border-t border-forest-200 dark:border-forest-700">
                Disconnect from the internet and the app works exactly the same.
              </p>
            </div>
          </section>

          {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
          <section aria-labelledby="how-heading">
            <p className="reveal text-xs uppercase tracking-[0.2em] text-forest-600 dark:text-forest-400 text-center font-semibold">How it works</p>
            <h2 id="how-heading" className="reveal text-2xl font-bold text-stone-800 dark:text-stone-100 text-center mt-2 tracking-tight">Three steps to start stopping nail biting.</h2>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                {
                  n: '01', icon: Camera, heading: 'Allow camera access',
                  body: 'One-time permission prompt. Revoke it any time from System Preferences. The app never asks for microphone, location, or anything else.',
                },
                {
                  n: '02', icon: Cpu, heading: 'AI loads on your device',
                  body: 'MediaPipe hand and face landmark models run in WebAssembly — the same technology powering Google Meet\'s background blur. No internet needed after setup.',
                },
                {
                  n: '03', icon: Bell, heading: 'Get alerted the moment it happens',
                  body: 'The instant your fingers approach your mouth, an audible alarm fires and the incident is logged locally. Awareness at the exact moment — the core of habit reversal training.',
                },
              ].map(({ n, icon: Icon, heading, body }, i) => (
                <div
                  key={n}
                  className="reveal-card bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-7 shadow-card hover:-translate-y-1 hover:shadow-card-md transition-all duration-200"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <span className="w-8 h-8 rounded-full bg-forest-100 dark:bg-forest-800 border border-forest-200 dark:border-forest-800 flex items-center justify-center text-xs font-bold text-forest-600 dark:text-forest-400 flex-shrink-0">
                      {n}
                    </span>
                    <Icon size={18} className="text-forest-500 dark:text-forest-400" aria-hidden="true" />
                  </div>
                  <h3 className="text-stone-800 dark:text-stone-100 font-semibold text-base">{heading}</h3>
                  <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed mt-2">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── FEATURE GRID ──────────────────────────────────────────────── */}
          <section aria-labelledby="features-heading">
            <h2 id="features-heading" className="reveal text-2xl font-bold text-stone-800 dark:text-stone-100 text-center tracking-tight">Everything you need to build the habit.</h2>
            <p className="reveal text-stone-500 dark:text-stone-400 text-base text-center mt-1">Nothing you don't.</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-10">
              {[
                { icon: Cpu, name: 'On-Device AI', desc: 'MediaPipe runs in WebAssembly. Your CPU does the work, not a remote server.', accent: true, color: 'text-forest-500 dark:text-forest-400' },
                { icon: BellRing, name: 'Real-Time Alerts', desc: 'Persistent audible alarm the moment your hand nears your mouth. Hard to ignore.', accent: false, color: 'text-alert-600 dark:text-alert-400' },
                { icon: Trophy, name: 'Streak Tracker', desc: 'Current streak and all-time best. Losing the streak is the point.', accent: false, color: 'text-amber-500' },
                { icon: ClipboardList, name: 'Incident Log', desc: 'Tag each bite by trigger: stress, focus, boredom. Patterns surface fast.', accent: false, color: 'text-stone-500 dark:text-stone-400' },
                { icon: BarChart2, name: '7-Day Chart', desc: 'Visual bite frequency history. Colour-coded by severity.', accent: false, color: 'text-forest-500 dark:text-forest-400' },
                { icon: WifiOff, name: 'Works Offline', desc: 'No internet required after setup. Detection runs entirely on your hardware.', accent: true, color: 'text-stone-500 dark:text-stone-400' },
              ].map(({ icon: Icon, name, desc, accent, color }, i) => (
                <div
                  key={name}
                  className={`reveal-card bg-white dark:bg-ink-50 rounded-2xl p-5 border shadow-card hover:-translate-y-1 hover:shadow-card-md transition-all duration-200 ${
                    accent
                      ? 'border-forest-200 dark:border-forest-800'
                      : 'border-stone-200 dark:border-ink-400'
                  }`}
                  style={{ transitionDelay: `${i * 60}ms` }}
                >
                  <Icon size={20} className={color} aria-hidden="true" />
                  <p className="text-stone-800 dark:text-stone-100 font-semibold text-sm mt-3">{name}</p>
                  <p className="text-stone-500 dark:text-stone-400 text-xs leading-relaxed mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── WHY / HRT ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            <article aria-labelledby="why-bite-heading" className="reveal-card bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-7 space-y-4 shadow-card hover:-translate-y-1 hover:shadow-card-md transition-all duration-200">
              <h2 id="why-bite-heading" className="text-xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Why do people bite their nails?</h2>
              <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed">
                About 1 in 4 adults bites their nails — not occasionally, but chronically. Most have been doing it since childhood. Most have tried to stop more than once. The reason it's so hard isn't weak willpower. It's that the habit runs on autopilot, below the level of conscious thought.
              </p>

              <h3 className="text-stone-700 dark:text-stone-300 text-sm font-semibold pt-1">When it tends to happen</h3>
              <ul className="space-y-3 text-sm">
                {[
                  ['Stress', "Your brain reaches for something familiar when anxiety spikes. Biting gives a brief sense of relief, which teaches your brain to reach for it again next time."],
                  ['Deep focus', "The part of your brain that monitors what your hands are doing goes quiet when you're concentrating hard. This is why you look down and realise you've been biting for the last 20 minutes."],
                  ['Pure habit', 'After years of repetition, the context itself — laptop open, meeting on, desk — is enough to trigger it. No stress required. The hand just... moves.'],
                ].map(([label, text]) => (
                  <li key={label as string} className="flex gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest-500 dark:bg-forest-400 flex-shrink-0 mt-1.5" aria-hidden="true" />
                    <span className="text-stone-500 dark:text-stone-400 leading-relaxed">
                      <span className="text-stone-700 dark:text-stone-200 font-medium">{label}: </span>
                      {text}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed pt-2 border-t border-stone-200 dark:border-ink-400">
                Bitter nail polish and physical barriers don't fix this — they fight the symptom. What actually works is catching the moment it starts and building awareness of when and why it happens.
              </p>

              <a href="/blog/why-do-people-bite-their-nails" className="group inline-flex items-center gap-1 text-forest-600 dark:text-forest-400 text-xs hover:text-forest-500 transition-colors">
                Read the full article{' '}
                <ArrowRight size={12} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
              </a>
            </article>

            <article aria-labelledby="hrt-heading" className="reveal-card bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-7 space-y-4 shadow-card hover:-translate-y-1 hover:shadow-card-md transition-all duration-200" style={{ transitionDelay: '80ms' }}>
              <h2 id="hrt-heading" className="text-xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">The approach that actually works</h2>
              <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed">
                Habit Reversal Training is the most studied method for stopping nail biting — and the one with the best results. Studies consistently show 70–90% reductions in biting frequency. The reason it works when willpower doesn't is that it targets the habit at the automatic level, not the conscious one.
              </p>

              <h3 className="text-stone-700 dark:text-stone-300 text-sm font-semibold pt-1">How it works</h3>
              <div className="space-y-3">
                {[
                  ['Notice it happening', "Most nail biters catch fewer than half their daily biting episodes. Step one is simply becoming aware every single time — which is harder than it sounds when the habit is fully automatic."],
                  ['Do something else instead', 'The moment you notice it, replace the bite with something your hands can\'t do simultaneously — press your palms flat, clench a fist, grip the desk. Hold it for a minute.'],
                  ['Get an external signal', 'In clinical settings, a therapist would tap your shoulder. The audio alarm in this app does the same thing: it catches the moment you missed.'],
                ].map(([title, text]) => (
                  <div key={title as string} className="flex gap-3">
                    <span className="w-1 rounded-full bg-forest-400 dark:bg-forest-600 flex-shrink-0 self-stretch" aria-hidden="true" />
                    <div>
                      <p className="text-stone-700 dark:text-stone-200 text-sm font-semibold">{title as string}</p>
                      <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed mt-0.5">{text as string}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed pt-2 border-t border-stone-200 dark:border-ink-400">
                Stop Biting handles the awareness and the signal. What you do with your hands instead is up to you.
              </p>

              <a href="/blog/habit-reversal-training-guide" className="group inline-flex items-center gap-1 text-forest-600 dark:text-forest-400 text-xs hover:text-forest-500 transition-colors">
                Read the full HRT guide{' '}
                <ArrowRight size={12} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
              </a>
            </article>

          </div>

          {/* ── TESTIMONIALS ──────────────────────────────────────────────── */}
          <section aria-labelledby="testimonials-heading">
            <h2 id="testimonials-heading" className="reveal text-2xl font-bold text-stone-800 dark:text-stone-100 text-center tracking-tight">What people are saying</h2>

            <div className="mt-8 space-y-4">
              {/* Featured quote — full width, forest tint */}
              <blockquote className="reveal-card bg-forest-50 dark:bg-forest-900/20 border border-forest-100 dark:border-forest-800 rounded-2xl px-8 py-7">
                <div className="flex gap-0.5 mb-4" aria-label="5 out of 5 stars">
                  {[...Array(5)].map((_, i) => <Star key={i} size={13} className="text-amber-400 fill-amber-400" aria-hidden="true" />)}
                </div>
                <p className="text-stone-700 dark:text-stone-300 text-base sm:text-lg leading-relaxed">
                  "I've tried bitter nail polish, gloves, everything. This is the only thing that actually caught me in the act. Three weeks clean."
                </p>
                <footer className="mt-5">
                  <p className="text-stone-800 dark:text-stone-200 text-sm font-semibold">Sarah K.</p>
                  <p className="text-stone-400 dark:text-stone-500 text-xs mt-0.5">Software engineer, 8-year nail biter</p>
                </footer>
              </blockquote>

              {/* Two smaller quotes side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    quote: "The alarm is jarring at first. That's exactly the point. My brain finally made the connection between the urge and the action.",
                    name: 'Marcus T.',
                    context: 'Designer, broke the habit in 6 weeks',
                  },
                  {
                    quote: "I bit during video calls without ever noticing. This caught me every single time. Two months in and the urge is genuinely fading.",
                    name: 'Priya M.',
                    context: 'Remote worker, 15-year habit',
                  },
                ].map(({ quote, name, context }, i) => (
                  <blockquote
                    key={name}
                    className="reveal-card bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-6 shadow-card hover:-translate-y-1 hover:shadow-card-md transition-all duration-200"
                    style={{ transitionDelay: `${i * 80}ms` }}
                  >
                    <div className="flex gap-0.5 mb-3" aria-label="5 out of 5 stars">
                      {[...Array(5)].map((_, j) => <Star key={j} size={11} className="text-amber-400 fill-amber-400" aria-hidden="true" />)}
                    </div>
                    <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">"{quote}"</p>
                    <footer className="mt-4">
                      <p className="text-stone-800 dark:text-stone-200 text-xs font-semibold">{name}</p>
                      <p className="text-stone-400 dark:text-stone-500 text-xs">{context}</p>
                    </footer>
                  </blockquote>
                ))}
              </div>
            </div>
          </section>

          {/* ── PRIVACY DEEP-DIVE ─────────────────────────────────────────── */}
          <section aria-labelledby="privacy-details-heading">
            <h2 id="privacy-details-heading" className="reveal text-2xl font-bold text-stone-800 dark:text-stone-100 text-center tracking-tight">Open, honest, verifiable.</h2>
            <p className="reveal text-stone-500 dark:text-stone-400 text-sm text-center mt-2 max-w-xs mx-auto">
              The privacy claims on this page aren't marketing. You can verify every one of them yourself.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
              {[
                {
                  icon: WifiOff,
                  title: 'No network requests during detection',
                  detail: "Open Activity Monitor and watch network usage while the app runs. You'll see nothing camera-related — because nothing is sent.",
                },
                {
                  icon: HardDrive,
                  title: 'Data lives on your device only',
                  detail: 'Your streak and incident log are stored locally. Uninstall the app and it\'s gone — no server backup, no data retained.',
                },
                {
                  icon: Code2,
                  title: 'Built on open web technologies',
                  detail: 'The app runs on React, WebAssembly, and MediaPipe — all inspectable. Camera frames never leave the canvas element.',
                },
              ].map(({ icon: Icon, title, detail }, i) => (
                <div
                  key={title}
                  className="reveal-card bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl px-5 py-4 flex items-start gap-4 shadow-card hover:-translate-y-1 hover:shadow-card-md transition-all duration-200"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <Icon size={16} className="text-forest-500 dark:text-forest-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-stone-800 dark:text-stone-100 text-sm font-semibold">{title}</p>
                    <p className="text-stone-500 dark:text-stone-400 text-xs leading-relaxed mt-0.5">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── STATS STRIP ───────────────────────────────────────────────── */}
          <section aria-label="Key statistics" className="reveal flex flex-col sm:flex-row items-center justify-center gap-8 py-4">
            {[
              { number: '20–30%', label: 'of adults bite their nails chronically' },
              { number: '70–90%', label: 'fewer biting incidents after 6 weeks of awareness training' },
              { number: '0 bytes', label: 'Of camera data sent to servers' },
            ].map(({ number, label }, i) => (
              <div key={label} className="flex items-center gap-8">
                <div className="text-center">
                  <p className="font-display text-4xl text-forest-600 dark:text-forest-400">{number}</p>
                  <p className="text-stone-400 dark:text-stone-500 text-xs uppercase tracking-wider mt-1">{label}</p>
                </div>
                {i < 2 && <div className="border-l border-stone-200 dark:border-ink-400 h-10 hidden sm:block" aria-hidden="true" />}
              </div>
            ))}
          </section>
          <p className="reveal text-stone-400 dark:text-stone-500 text-xs text-center -mt-12">
            Biting reduction figures from clinical studies on habit reversal training. Camera privacy is architectural — there's no server to send data to.
          </p>

          {/* ── PRICING ───────────────────────────────────────────────────── */}
          <section id="pricing" aria-labelledby="pricing-heading">
            <p className="reveal text-xs uppercase tracking-[0.2em] text-forest-600 dark:text-forest-400 text-center font-semibold">Pricing</p>
            <h2 id="pricing-heading" className="reveal text-2xl font-bold text-stone-800 dark:text-stone-100 text-center mt-2 tracking-tight">Simple, honest pricing.</h2>
            <p className="reveal text-stone-500 dark:text-stone-400 text-sm text-center mt-2">Start with a 3-day free trial. No credit card required.</p>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* Monthly */}
              <div className="reveal-card bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-7 flex flex-col shadow-card hover:-translate-y-1 hover:shadow-card-md transition-all duration-200">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-forest-100 dark:bg-forest-800 flex items-center justify-center">
                    <Zap size={16} className="text-forest-600 dark:text-forest-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">Monthly</p>
                    <p className="text-xs text-stone-400 dark:text-stone-500">Billed monthly</p>
                  </div>
                </div>
                <div className="mb-5">
                  <span className="text-4xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">$2.99</span>
                  <span className="text-stone-400 dark:text-stone-500 text-sm"> / month</span>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {['Unlimited AI detection', 'Streak & habit tracking', 'Full incident history', 'All alert types'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                      <Check size={13} className="text-forest-500 dark:text-forest-400 shrink-0" aria-hidden="true" />{f}
                    </li>
                  ))}
                </ul>
                <a
                  href="/api/auth/google"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-stone-100 text-cream-100 dark:text-stone-900 font-semibold rounded-xl px-5 py-2.5 text-sm transition-all duration-150 hover:-translate-y-0.5"
                >
                  Start free trial
                </a>
              </div>

              {/* Yearly */}
              <div className="reveal-card bg-white dark:bg-ink-50 border-2 border-forest-500 dark:border-forest-600 rounded-2xl p-7 flex flex-col shadow-card-md relative hover:-translate-y-1 hover:shadow-card-md transition-all duration-200" style={{ transitionDelay: '80ms' }}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-forest-600 text-cream-100 text-xs font-semibold px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
                    Best value — save 19%
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-forest-100 dark:bg-forest-800 flex items-center justify-center">
                    <Star size={16} className="text-forest-600 dark:text-forest-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">Yearly</p>
                    <p className="text-xs text-stone-400 dark:text-stone-500">Billed once a year</p>
                  </div>
                </div>
                <div className="mb-1">
                  <span className="text-4xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">$29.00</span>
                  <span className="text-stone-400 dark:text-stone-500 text-sm"> / year</span>
                </div>
                <p className="text-forest-600 dark:text-forest-400 text-xs mb-5 font-medium">Just $2.42/month</p>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {['Unlimited AI detection', 'Streak & habit tracking', 'Full incident history', 'All alert types', 'Priority support'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
                      <Check size={13} className="text-forest-500 dark:text-forest-400 shrink-0" aria-hidden="true" />{f}
                    </li>
                  ))}
                </ul>
                <a
                  href="/api/auth/google"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-xl px-5 py-2.5 text-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_oklch(38%_0.12_148/0.4)]"
                >
                  <Zap size={13} aria-hidden="true" />
                  Start free trial
                </a>
              </div>
            </div>

            {/* Trust badges */}
            <div className="reveal flex flex-wrap items-center justify-center gap-6 mt-8 text-xs text-stone-400 dark:text-stone-500">
              <div className="flex items-center gap-1.5"><Shield size={11} aria-hidden="true" /><span>Secure payment via Paddle</span></div>
              <div className="flex items-center gap-1.5"><Check size={11} aria-hidden="true" /><span>Cancel anytime</span></div>
              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-forest-500" aria-hidden="true" /><span>3-day free trial</span></div>
              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-forest-500" aria-hidden="true" /><span>No credit card required to start</span></div>
            </div>
          </section>

          {/* ── BLOG PREVIEW ──────────────────────────────────────────────── */}
          <section aria-labelledby="blog-preview-heading">
            <div className="reveal flex items-center justify-between mb-6">
              <h2 id="blog-preview-heading" className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">From the blog</h2>
              <a href="/blog" className="group inline-flex items-center gap-1 text-forest-600 dark:text-forest-400 text-sm hover:text-forest-500 transition-colors">
                All articles{' '}
                <ArrowRight size={14} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
              </a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                { slug: 'habit-reversal-training-guide', title: 'Habit Reversal Training: The Complete Guide', tag: 'Treatment', mins: 9 },
                { slug: 'nail-biting-health-risks', title: 'The Real Health Risks of Nail Biting', tag: 'Health', mins: 6 },
                { slug: 'how-ai-can-help-stop-nail-biting', title: 'How AI Can Help You Stop Biting Your Nails', tag: 'Technology', mins: 7 },
              ].map(({ slug, title, tag, mins }, i) => (
                <a
                  key={slug}
                  href={`/blog/${slug}`}
                  className="reveal-card bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-5 hover:border-forest-300 dark:hover:border-forest-700 hover:-translate-y-1 hover:shadow-card-md transition-all duration-200 group shadow-card"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <span className="text-xs text-forest-600 dark:text-forest-400 font-semibold uppercase tracking-wider">{tag}</span>
                  <h3 className="text-stone-800 dark:text-stone-100 font-semibold text-sm mt-2 leading-snug group-hover:text-forest-600 dark:group-hover:text-forest-400 transition-colors">{title}</h3>
                  <p className="text-stone-400 dark:text-stone-500 text-xs mt-3">{mins} min read</p>
                </a>
              ))}
            </div>
          </section>

          {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
          <section
            aria-label="Call to action"
            className="reveal text-center py-12 rounded-2xl bg-forest-50 dark:bg-forest-900 border border-forest-200 dark:border-forest-800"
          >
            <h2 className="text-3xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Ready to stop nail biting?</h2>
            <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed max-w-sm mx-auto mt-4">
              Use the web app directly in your browser — sign in with Google and nail biting detection starts in under ten seconds. No install needed.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <a
                href="/api/auth/google"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-shimmer inline-flex items-center gap-2 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-2xl px-8 py-3.5 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_oklch(38%_0.12_148/0.35)] active:scale-95"
              >
                <Zap size={15} aria-hidden="true" />
                Start free trial — it's free
              </a>
              <p className="text-stone-400 dark:text-stone-500 text-xs">3-day free trial · no credit card required</p>
            </div>
          </section>

          {/* ── CONTACT ───────────────────────────────────────────────────────── */}
          <ContactForm />

        </div>
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-stone-200 dark:border-ink-400 py-10 px-8 bg-cream-200 dark:bg-ink-200">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/logo.svg" alt="" className="w-7 h-7 flex-shrink-0" />
              <p className="text-stone-700 dark:text-stone-200 text-sm font-semibold">Stop Biting</p>
            </div>
            <p className="text-stone-400 dark:text-stone-500 text-xs mt-1 max-w-xs leading-relaxed">
              Stop nail biting (onychophagia) using on-device AI. Works in your browser as a Progressive Web App — no install required. Built with MediaPipe, React, and WebAssembly.
            </p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-col gap-2 text-xs">
            <a href="/" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Home</a>
            <a href="/blog" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Blog</a>
            <a href="/#pricing" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Pricing</a>
            <a href="mailto:hello@stopbiting.today" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Contact</a>
            <a href="/privacy" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Privacy Policy</a>
            <a href="/terms-and-conditions" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Terms of Service</a>
            <a href="/refund-policy" className="text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">Refund Policy</a>
          </nav>
        </div>
        <p className="text-stone-400 dark:text-stone-500 text-xs text-center mt-8">
          © {new Date().getFullYear()} Stop Biting · AI-powered nail biting detection ·{' '}
          <a href="https://stopbiting.today/" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">stopbiting.today</a>
        </p>
      </footer>

    </div>
  );
}
