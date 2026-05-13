import { useEffect } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggle } from '../components/ThemeToggle';

export function About() {
  useTheme();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

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
          <a href="/" className="text-sm font-semibold text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors">
            Launch App
          </a>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 pt-28 pb-24">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 mb-8">
          <a href="/" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Home</a>
          <span aria-hidden="true">/</span>
          <span className="text-stone-500 dark:text-stone-400">About</span>
        </nav>

        <header className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-stone-800 dark:text-stone-100 leading-tight mb-4">
            About Stop Biting
          </h1>
          <p className="text-lg text-stone-500 dark:text-stone-400 leading-relaxed">
            Built by a nail biter, for nail biters. Here's why this app exists.
          </p>
        </header>

        {/* Founder story */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-4">The founder's story</h2>
          <div className="space-y-4 text-[15px] text-stone-600 dark:text-stone-400 leading-relaxed">
            <p>
              I'm Igor Gazivoda, a software developer. I bit my nails for over 20 years. Not occasionally — constantly,
              automatically, without noticing until the damage was already done.
            </p>
            <p>
              I tried everything: bitter polish, reminder bands, sheer willpower. They all failed the same way.
              The habit is automatic. It happens below the threshold of conscious awareness. By the time I noticed
              my hand was in my mouth, I'd already been biting for 30 seconds.
            </p>
            <p>
              When I read the research on Habit Reversal Training, I understood why everything else had failed.
              HRT's core insight is that awareness is the bottleneck — you can't interrupt a habit you don't know is
              happening. The gold-standard treatment literally starts with "awareness training" before anything else.
            </p>
            <p>
              I had a webcam. I knew how to code. I knew MediaPipe could run hand tracking on-device.
              So I built the awareness component — the part of HRT that is hardest to do alone.
            </p>
          </div>
        </section>

        {/* What the app does */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-4">What Stop Biting does</h2>
          <div className="space-y-4 text-[15px] text-stone-600 dark:text-stone-400 leading-relaxed">
            <p>
              Stop Biting uses your computer's webcam and Google's MediaPipe framework — compiled to WebAssembly and
              running entirely in your browser — to detect when your hand moves toward your mouth. When it does,
              an audible alarm fires.
            </p>
            <p>
              That alarm is the external awareness signal that HRT research identifies as the most critical
              component of the treatment. It catches the episodes that self-monitoring misses.
              Most nail biters catch fewer than half their daily episodes through self-awareness alone.
              The rest happen invisibly.
            </p>
            <p>
              The app also logs each detection with a timestamp, so you can see your actual biting
              frequency — not your estimated frequency. Most users are surprised. The gap between
              "I bite occasionally" and 40+ incidents per day is the gap that makes willpower-based
              approaches feel futile.
            </p>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-4">Privacy: the non-negotiable</h2>
          <div className="space-y-4 text-[15px] text-stone-600 dark:text-stone-400 leading-relaxed">
            <p>
              The app uses your webcam. This requires trust. I've designed it so that trust can be verified,
              not just promised.
            </p>
            <p>
              All video processing runs in WebAssembly on your device. Nothing is transmitted — not frames,
              not detections, not metadata. You can disconnect your internet connection after the app loads
              and it will function identically. You can verify this by watching your network traffic while
              the app runs.
            </p>
            <p>
              The incident log is stored locally. No account required to use the core detection feature.
              No analytics on how you use it.
            </p>
          </div>
        </section>

        {/* The technology */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-4">The technology</h2>
          <div className="space-y-4 text-[15px] text-stone-600 dark:text-stone-400 leading-relaxed">
            <p>
              The detection model is built on{' '}
              <a href="https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker" target="_blank" rel="noopener noreferrer" className="text-forest-600 dark:text-forest-400 hover:underline">
                Google MediaPipe's Hand Landmarker
              </a>
              , which tracks 21 hand landmarks in real time at 30fps. The model runs in WebAssembly — a
              sandboxed binary execution format supported by all modern browsers — meaning it has no network
              access and cannot read files outside the browser sandbox.
            </p>
            <p>
              The mouth proximity detection compares hand landmark coordinates to facial landmark coordinates
              in each frame. When a hand landmark is within detection threshold of the mouth region for a
              sustained period, the alarm triggers.
            </p>
            <p>
              The desktop apps (macOS and Windows) are Electron wrappers around the same web app, with
              system tray integration for background running.
            </p>
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl bg-forest-50 dark:bg-forest-900/20 border border-forest-200 dark:border-forest-800 p-8 text-center">
          <p className="text-stone-500 dark:text-stone-400 text-sm mb-1">3-day free trial — no credit card needed</p>
          <p className="text-stone-900 dark:text-stone-100 font-semibold text-xl mb-5">Try Stop Biting</p>
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
          {' — '}Built by <a href="/about" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Igor Gazivoda</a>
        </p>
      </footer>
    </div>
  );
}
