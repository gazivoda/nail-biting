import { useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { SiteHeader } from '../components/site/SiteHeader';
import { SiteFooter } from '../components/site/SiteFooter';
import { TrialButton } from '../components/site/TrialButton';

export function About() {
  useTheme('light');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">

      <SiteHeader />

      <main id="main" className="sg-container max-w-3xl pt-28 pb-20 lg:pt-32">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="sg-note mb-8 flex items-center gap-2">
          <a href="/" className="hover:text-[color:var(--sg-ink)]">Home</a>
          <span aria-hidden="true">/</span>
          <span className="text-[color:var(--sg-ink)]">About</span>
        </nav>

        <header className="mb-14">
          <h1 className="sg-h2">
            About Stop Biting
          </h1>
          <p className="sg-lede sg-measure mt-5">
            Built by a nail biter, for nail biters. Here's why this app exists.
          </p>
        </header>

        {/* Founder story */}
        <section className="mb-12 border-t border-[color:var(--sg-rule)] pt-8">
          <h2 className="sg-h3 mb-3">The founder's story</h2>
          <div className="sg-body sg-measure space-y-4">
            <p>
              I'm Igor Gazivoda, a software developer. I bit my nails for over 20 years. Not occasionally: constantly,
              automatically, without noticing until the damage was already done.
            </p>
            <p>
              I tried everything: bitter polish, reminder bands, sheer willpower. They all failed the same way.
              The habit is automatic. It happens below the threshold of conscious awareness. By the time I noticed
              my hand was in my mouth, I'd already been biting for 30 seconds.
            </p>
            <p>
              When I read the research on Habit Reversal Training, I understood why everything else had failed.
              HRT's core insight is that awareness is the bottleneck: you can't interrupt a habit you don't know is
              happening. The gold-standard treatment literally starts with "awareness training" before anything else.
            </p>
            <p>
              I had a webcam. I knew how to code. I knew MediaPipe could run hand tracking on-device.
              So I built the awareness component, the part of HRT that is hardest to do alone.
            </p>
          </div>
        </section>

        {/* What the app does */}
        <section className="mb-12 border-t border-[color:var(--sg-rule)] pt-8">
          <h2 className="sg-h3 mb-3">What Stop Biting does</h2>
          <div className="sg-body sg-measure space-y-4">
            <p>
              Stop Biting uses your computer's webcam and Google's MediaPipe framework (compiled to WebAssembly and
              running entirely in your browser) to detect when your hand moves toward your mouth. When it does,
              an audible alarm fires.
            </p>
            <p>
              That alarm is the external awareness signal that HRT research identifies as the most critical
              component of the treatment. It catches the episodes that self-monitoring misses. Most of them happen without you noticing.
            </p>
            <p>
              The app also logs each detection with a timestamp, so you can see your actual biting
              frequency, not your estimated frequency. A real count, rather than a guess, is
              what turns the habit into something you can work on.
            </p>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-12 border-t border-[color:var(--sg-rule)] pt-8">
          <h2 className="sg-h3 mb-3">Privacy: the non-negotiable</h2>
          <div className="sg-body sg-measure space-y-4">
            <p>
              The app uses your webcam. This requires trust. I've designed it so that trust can be verified,
              not just promised.
            </p>
            <p>
              All video processing runs in WebAssembly on your device. No video, no frames and no
              detections are transmitted. You can disconnect your internet connection after the app loads
              and it will function identically. You can verify this by watching your network traffic while
              the app runs.
            </p>
            <p>
              Your alarm and bite log is stored in your browser. The site counts page visits with Google
              Analytics; that never includes anything from your camera.
            </p>
          </div>
        </section>

        {/* The technology */}
        <section className="mb-12 border-t border-[color:var(--sg-rule)] pt-8">
          <h2 className="sg-h3 mb-3">The technology</h2>
          <div className="sg-body sg-measure space-y-4">
            <p>
              The detection model is built on{' '}
              <a href="https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker" target="_blank" rel="noopener noreferrer" className="sg-link">
                Google MediaPipe's Hand Landmarker
              </a>
              , which locates 21 hand landmarks. Stop Biting runs it five times a second. The model runs in WebAssembly (a
              sandboxed binary execution format supported by all modern browsers), meaning it has no network
              access and cannot read files outside the browser sandbox.
            </p>
            <p>
              The mouth proximity detection compares hand landmark coordinates to facial landmark coordinates
              in each frame. When a hand landmark is within detection threshold of the mouth region for a
              sustained period, the alarm triggers.
            </p>
          </div>
        </section>

        {/* How this site is written — keep in step with the /about SSR copy in server.js */}
        <section className="mb-12 border-t border-[color:var(--sg-rule)] pt-8">
          <h2 className="sg-h3 mb-3">How this site is written</h2>
          <div className="sg-body sg-measure space-y-4">
            <p>
              Every article, guide and comparison here is written by me. I'm a developer, not a clinician, and the{' '}
              <a href="/editorial-policy" className="sg-link">
                editorial policy and corrections page
              </a>
              {' '}says exactly what that means for what you read: how claims are sourced, how anything I say about a
              competing product is checked, and how to tell me when something on this site is wrong.
            </p>
          </div>
        </section>

        <div className="mt-16 flex flex-col items-start gap-4 border-t border-[color:var(--sg-rule)] pt-10 sm:flex-row sm:items-center sm:justify-between">
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
