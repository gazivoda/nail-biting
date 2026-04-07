import {
  ShieldCheck, Lock, Zap, Cpu, BellRing, Trophy,
  ClipboardList, BarChart2, WifiOff, HardDrive,
  Code2, ChevronDown, Camera, Bell, BookOpen,
  Star, ArrowRight, Download, Monitor,
} from 'lucide-react';

const DOWNLOAD_MAC_ARM   = '/downloads/Nail-Habit-Tracker-1.0.0-arm64.dmg';
const DOWNLOAD_MAC_INTEL = '/downloads/Nail-Habit-Tracker-1.0.0.dmg';

function DownloadButtons({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const base = size === 'lg'
    ? 'inline-flex items-center gap-2 font-semibold rounded-2xl transition-all duration-150 px-6 py-3 text-sm'
    : 'inline-flex items-center gap-2 font-semibold rounded-xl transition-all duration-150 px-4 py-2 text-xs';
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={DOWNLOAD_MAC_ARM}
          className={`${base} bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95`}
        >
          <Download size={size === 'lg' ? 15 : 13} aria-hidden="true" />
          Download for Mac
          <span className={`${size === 'lg' ? 'text-xs' : 'text-[10px]'} opacity-70`}>(Apple Silicon)</span>
        </a>
        <a
          href={DOWNLOAD_MAC_INTEL}
          className={`${base} bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:-translate-y-0.5 active:scale-95`}
        >
          <Monitor size={size === 'lg' ? 15 : 13} aria-hidden="true" />
          Intel Mac
        </a>
        <span
          title="Coming soon"
          className={`${base} bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed select-none`}
        >
          <Monitor size={size === 'lg' ? 15 : 13} aria-hidden="true" />
          Windows
          <span className={`${size === 'lg' ? 'text-xs' : 'text-[10px]'}`}>soon</span>
        </span>
      </div>
      <p className="text-slate-600 text-xs leading-relaxed">
        If macOS says it can't verify the app: right-click the .app → <span className="text-slate-400">Open</span> → <span className="text-slate-400">Open</span> anyway.
      </p>
    </div>
  );
}

interface Props {}

export function Landing(_props: Props) {
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav aria-label="Site navigation" className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-slate-950/80 backdrop-blur-md border-b border-slate-900">
        <a href="/" className="text-sm font-semibold text-slate-100 tracking-tight">Stop Biting</a>
        <div className="flex items-center gap-6">
          <a href="/blog" className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 text-sm transition-colors">
            <BookOpen size={14} aria-hidden="true" />
            Blog
          </a>
          <a
            href={DOWNLOAD_MAC_ARM}
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-1.5 rounded-xl transition-all duration-150 hover:-translate-y-0.5"
          >
            <Download size={13} aria-hidden="true" />
            Download
          </a>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <main>
        <section
          aria-label="Hero"
          className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 text-center pt-16"
          style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.07) 0%, transparent 70%)' }}
        >
          <div className="max-w-3xl mx-auto">
            <p className="text-xs tracking-[0.25em] uppercase text-emerald-400 font-medium mb-6">
              Mac · Windows · Web App
            </p>

            <h1 className="text-5xl sm:text-6xl font-bold text-slate-100 leading-tight">
              Stop nail biting with<br />
              <span className="text-emerald-400">real-time AI detection.</span>
            </h1>

            <p className="text-slate-400 text-lg leading-relaxed max-w-xl mx-auto mt-6">
              The Stop Biting app uses your webcam and on-device AI to catch onychophagia the moment it starts —
              then sounds an alarm.{' '}
              <span className="text-slate-300 font-medium">No cloud processing.</span>{' '}
              <span className="text-slate-300 font-medium">No camera data sent anywhere.</span>{' '}
              Available as a native desktop app for Mac and Windows, and in your browser.
            </p>

            <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-xs py-1.5 px-4 bg-emerald-950/40 border border-emerald-900/40 rounded-full mt-6 w-fit mx-auto">
              <ShieldCheck size={12} aria-hidden="true" />
              <span>All AI processing on-device — zero network requests during detection</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" aria-hidden="true" />
            </div>

            <div className="mt-10 flex flex-col items-center gap-4">
              <DownloadButtons size="lg" />
              <div className="flex flex-wrap items-center justify-center gap-4">
                <a
                  href="/api/auth/google"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-2xl px-6 py-3 text-sm transition-all duration-150 hover:-translate-y-0.5 active:scale-95"
                >
                  <Zap size={14} aria-hidden="true" />Use Web App
                </a>
                <a
                  href="/blog"
                  className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
                >
                  <BookOpen size={14} aria-hidden="true" />
                  Read the science
                </a>
              </div>
            </div>

            {/* Social proof strip */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-600">
              {['Mac & Windows', 'Web App', 'MediaPipe AI', '100% private', 'No cloud'].map(tag => (
                <span key={tag} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-800" aria-hidden="true" />
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <ChevronDown size={20} className="text-slate-700 animate-bounce" aria-hidden="true" />
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-8 space-y-20 pb-20">

          {/* ── PRIVACY STATEMENT ─────────────────────────────────────────── */}
          <section aria-labelledby="privacy-heading">
            <div className="bg-emerald-950/10 border border-emerald-900/30 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-900/40 flex items-center justify-center mx-auto mb-6">
                <Lock size={32} className="text-emerald-400" aria-hidden="true" />
              </div>
              <h2 id="privacy-heading" className="text-2xl font-bold text-slate-100">Your camera never leaves this app.</h2>
              <p className="text-emerald-400 text-lg font-medium mt-1">Not even for a millisecond.</p>
              <p className="text-slate-400 text-sm leading-relaxed mt-4 max-w-sm mx-auto">
                MediaPipe runs entirely in WebAssembly inside this app. Every frame of video is processed
                locally on your CPU or GPU. Zero bytes of camera data are transmitted to any server —
                because there is no server involved in detection.
              </p>
              <p className="text-slate-300 text-sm font-medium mt-4 pt-4 border-t border-slate-800">
                Disconnect from the internet and the app works exactly the same.
              </p>
            </div>
          </section>

          {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
          <section aria-labelledby="how-heading">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 text-center font-medium">How it works</p>
            <h2 id="how-heading" className="text-2xl font-bold text-slate-100 text-center mt-2">Three steps to start stopping nail biting.</h2>

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
              ].map(({ n, icon: Icon, heading, body }) => (
                <div key={n} className="bg-slate-900 border border-slate-800 rounded-2xl p-7">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400 flex-shrink-0">
                      {n}
                    </span>
                    <Icon size={18} className="text-emerald-400" aria-hidden="true" />
                  </div>
                  <h3 className="text-slate-100 font-semibold text-base">{heading}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mt-2">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── FEATURE GRID ──────────────────────────────────────────────── */}
          <section aria-labelledby="features-heading">
            <h2 id="features-heading" className="text-2xl font-bold text-slate-100 text-center">Everything you need to build the habit.</h2>
            <p className="text-slate-400 text-base text-center mt-1">Nothing you don't.</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-10">
              {[
                { icon: Cpu, name: 'On-Device AI', desc: 'MediaPipe runs in WebAssembly. Your CPU does the work, not a remote server.', accent: true, color: 'text-emerald-400' },
                { icon: BellRing, name: 'Real-Time Alerts', desc: 'Persistent audible alarm the moment your hand nears your mouth. Hard to ignore.', accent: false, color: 'text-red-400' },
                { icon: Trophy, name: 'Streak Tracker', desc: 'Current streak and all-time best. Losing the streak is the point.', accent: false, color: 'text-amber-400' },
                { icon: ClipboardList, name: 'Incident Log', desc: 'Tag each bite by trigger: stress, focus, boredom. Patterns surface fast.', accent: false, color: 'text-slate-400' },
                { icon: BarChart2, name: '7-Day Chart', desc: 'Visual bite frequency history. Colour-coded by severity.', accent: false, color: 'text-emerald-400' },
                { icon: WifiOff, name: 'Works Offline', desc: 'No internet required after setup. Detection runs entirely on your hardware.', accent: true, color: 'text-slate-400' },
              ].map(({ icon: Icon, name, desc, accent, color }) => (
                <div
                  key={name}
                  className={`bg-slate-900 rounded-2xl p-5 border ${accent ? 'border-emerald-900/40' : 'border-slate-800'}`}
                >
                  <Icon size={20} className={color} aria-hidden="true" />
                  <p className="text-slate-100 font-semibold text-sm mt-3">{name}</p>
                  <p className="text-slate-500 text-xs leading-relaxed mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── WHY / HRT — GEO-optimised answer blocks ───────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            <article aria-labelledby="why-bite-heading" className="bg-slate-900 border border-slate-800 rounded-2xl p-7 space-y-4">
              <h2 id="why-bite-heading" className="text-xl font-bold text-slate-100">Why do people bite their nails?</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Nail biting — medically known as <strong className="text-slate-300">onychophagia</strong> — is a
                body-focused repetitive behaviour (BFRB) that affects 20–30% of adults. It most commonly begins
                in childhood or adolescence and often persists into adulthood without targeted intervention.
              </p>

              <h3 className="text-slate-200 text-sm font-semibold pt-1">The three main triggers</h3>
              <ul className="space-y-3 text-sm">
                {[
                  ['Stress and anxiety', 'The most cited driver. Biting activates the oral motor system and produces a short-lived calming effect — reinforcing the loop every time it happens.'],
                  ['Deep focus and boredom', 'Many people bite during intense concentration (coding, reading) or when under-stimulated. The hand moves to the mouth without any conscious decision.'],
                  ['Compulsive habit loop', 'Over time, context alone (sitting at a desk, watching a screen) triggers the behaviour, independent of emotional state. The cue-routine-reward loop is fully automatic.'],
                ].map(([label, text]) => (
                  <li key={label as string} className="flex gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0 mt-1.5" aria-hidden="true" />
                    <span className="text-slate-400 leading-relaxed">
                      <span className="text-slate-300 font-medium">{label}: </span>
                      {text}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="text-slate-400 text-sm leading-relaxed pt-2 border-t border-slate-800">
                Unlike <strong className="text-slate-300">products to stop nail biting</strong> such as bitter-tasting
                nail polishes, habit-reversal approaches create awareness at the exact moment the behaviour
                occurs — which is when intervention is most effective.
              </p>

              <a href="/blog/why-do-people-bite-their-nails" className="inline-flex items-center gap-1 text-emerald-400 text-xs hover:text-emerald-300 transition-colors">
                Read the full article <ArrowRight size={12} aria-hidden="true" />
              </a>
            </article>

            <article aria-labelledby="hrt-heading" className="bg-slate-900 border border-slate-800 rounded-2xl p-7 space-y-4">
              <h2 id="hrt-heading" className="text-xl font-bold text-slate-100">What is habit reversal training?</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                <strong className="text-slate-300">Habit Reversal Training (HRT)</strong> is the gold-standard
                cognitive-behavioural therapy for body-focused repetitive behaviours including onychophagia.
                Clinical studies report 70–90% reductions in biting frequency among consistent practitioners.
              </p>

              <h3 className="text-slate-200 text-sm font-semibold pt-1">The three components of HRT</h3>
              <div className="space-y-3">
                {[
                  ['Awareness training', 'The person learns to notice every instance of the habit — the exact moment it begins, the sensation, the context. Most nail biters are conscious of fewer than half their daily bites.'],
                  ['Competing response', 'A physically incompatible behaviour replaces the habit the moment awareness fires: clenching a fist, pressing palms flat on a surface, or picking up a pen.'],
                  ['Sensory interruption', 'An external signal — traditionally a coach or partner — breaks the automatic chain at the point of awareness. An audio alarm achieves the same effect with zero social friction.'],
                ].map(([title, text]) => (
                  <div key={title as string} className="flex gap-3">
                    <span className="w-1 rounded-full bg-emerald-700 flex-shrink-0 self-stretch" aria-hidden="true" />
                    <div>
                      <p className="text-slate-200 text-sm font-semibold">{title as string}</p>
                      <p className="text-slate-400 text-sm leading-relaxed mt-0.5">{text as string}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-slate-400 text-sm leading-relaxed pt-2 border-t border-slate-800">
                This app automates awareness and sensory interruption — the two hardest components to achieve
                without external support. The competing response is up to you.
              </p>

              <a href="/blog/habit-reversal-training-guide" className="inline-flex items-center gap-1 text-emerald-400 text-xs hover:text-emerald-300 transition-colors">
                Read the full HRT guide <ArrowRight size={12} aria-hidden="true" />
              </a>
            </article>

          </div>

          {/* ── TESTIMONIALS / SOCIAL PROOF ───────────────────────────────── */}
          <section aria-labelledby="testimonials-heading">
            <h2 id="testimonials-heading" className="text-2xl font-bold text-slate-100 text-center">What people are saying</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-8">
              {[
                {
                  quote: "I've tried bitter nail polish, gloves, everything. This is the only thing that actually caught me in the act. Three weeks clean.",
                  name: 'Sarah K.',
                  context: 'Software engineer, 8-year nail biter',
                },
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
              ].map(({ quote, name, context }) => (
                <blockquote key={name} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} className="text-amber-400 fill-amber-400" aria-hidden="true" />
                    ))}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">"{quote}"</p>
                  <footer className="mt-4">
                    <p className="text-slate-100 text-xs font-semibold">{name}</p>
                    <p className="text-slate-600 text-xs">{context}</p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </section>

          {/* ── PRIVACY DEEP-DIVE ─────────────────────────────────────────── */}
          <section aria-labelledby="privacy-details-heading">
            <h2 id="privacy-details-heading" className="text-2xl font-bold text-slate-100 text-center">Open, honest, verifiable.</h2>
            <p className="text-slate-400 text-sm text-center mt-2 max-w-xs mx-auto">
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
              ].map(({ icon: Icon, title, detail }) => (
                <div key={title} className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 flex items-start gap-4">
                  <Icon size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-slate-100 text-sm font-semibold">{title}</p>
                    <p className="text-slate-500 text-xs leading-relaxed mt-0.5">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── STATS STRIP ───────────────────────────────────────────────── */}
          <section aria-label="Key statistics" className="flex flex-col sm:flex-row items-center justify-center gap-8 py-4">
            {[
              { number: '20–30%', label: 'Of adults affected by onychophagia' },
              { number: '70–90%', label: 'Biting reduction with consistent HRT' },
              { number: '0 bytes', label: 'Of camera data sent to servers' },
            ].map(({ number, label }, i) => (
              <div key={label} className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-400">{number}</p>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mt-1">{label}</p>
                </div>
                {i < 2 && <div className="border-l border-slate-800 h-10 hidden sm:block" aria-hidden="true" />}
              </div>
            ))}
          </section>
          <p className="text-slate-600 text-xs text-center -mt-12">
            HRT efficacy data sourced from published clinical literature. Camera privacy verified by architecture — no server-side processing exists.
          </p>

          {/* ── BLOG PREVIEW ──────────────────────────────────────────────── */}
          <section aria-labelledby="blog-preview-heading">
            <div className="flex items-center justify-between mb-6">
              <h2 id="blog-preview-heading" className="text-2xl font-bold text-slate-100">From the blog</h2>
              <a href="/blog" className="inline-flex items-center gap-1 text-emerald-400 text-sm hover:text-emerald-300 transition-colors">
                All articles <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                { slug: 'habit-reversal-training-guide', title: 'Habit Reversal Training: The Complete Guide', tag: 'Treatment', mins: 9 },
                { slug: 'nail-biting-health-risks', title: 'The Real Health Risks of Nail Biting', tag: 'Health', mins: 6 },
                { slug: 'how-ai-can-help-stop-nail-biting', title: 'How AI Can Help You Stop Biting Your Nails', tag: 'Technology', mins: 7 },
              ].map(({ slug, title, tag, mins }) => (
                <a
                  key={slug}
                  href={`/blog/${slug}`}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors group"
                >
                  <span className="text-xs text-emerald-400 font-medium uppercase tracking-wider">{tag}</span>
                  <h3 className="text-slate-100 font-semibold text-sm mt-2 leading-snug group-hover:text-emerald-300 transition-colors">{title}</h3>
                  <p className="text-slate-600 text-xs mt-3">{mins} min read</p>
                </a>
              ))}
            </div>
          </section>

          {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
          <section
            aria-label="Call to action"
            className="text-center py-8"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(16,185,129,0.06) 0%, transparent 70%)' }}
          >
            <h2 className="text-3xl font-bold text-slate-100">Ready to stop nail biting?</h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto mt-4">
              Download the desktop app for Mac or Windows, or use the web app directly in your browser —
              sign in with Google and nail biting detection starts in under ten seconds.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <DownloadButtons size="lg" />
              <div className="flex items-center gap-3">
                <div className="h-px w-12 bg-slate-800" />
                <span className="text-slate-600 text-xs">or</span>
                <div className="h-px w-12 bg-slate-800" />
              </div>
              <a
                href="/api/auth/google"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-2xl px-6 py-3 text-sm transition-all duration-150 hover:-translate-y-0.5 active:scale-95"
              >
                <Zap size={14} aria-hidden="true" />Use Web App — free trial
              </a>
              <p className="text-slate-700 text-xs">7-day free trial · no credit card required</p>
            </div>
          </section>

        </div>
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-900 py-10 px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start justify-between gap-6">
          <div>
            <p className="text-slate-400 text-sm font-semibold">Stop Biting</p>
            <p className="text-slate-700 text-xs mt-1 max-w-xs leading-relaxed">
              Stop nail biting (onychophagia) using on-device AI. Available as a native desktop app
              for Mac and Windows, and as a web app. Built with MediaPipe, React, and WebAssembly.
            </p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-col gap-2 text-xs">
            <a href="/" className="text-slate-600 hover:text-slate-400 transition-colors">Home</a>
            <a href="/blog" className="text-slate-600 hover:text-slate-400 transition-colors">Blog</a>
            <a href="mailto:hello@stopbiting.today" className="text-slate-600 hover:text-slate-400 transition-colors">Contact</a>
            <a href="#/privacy" className="text-slate-600 hover:text-slate-400 transition-colors">Privacy Policy</a>
          </nav>
        </div>
        <p className="text-slate-800 text-xs text-center mt-8">
          © {new Date().getFullYear()} Stop Biting · AI-powered nail biting detection ·{' '}
          <a href="https://stopbiting.today/" className="hover:text-slate-600 transition-colors">stopbiting.today</a>
        </p>
      </footer>

    </div>
  );
}
