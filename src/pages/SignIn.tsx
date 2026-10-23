import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useSignInProviders } from '../auth/useSignInProviders';
import { AppleButton, GoogleButton, MicrosoftButton } from '../components/auth/ProviderButtons';
import {
  errorMessage, isSafeRedirect, linkFailureMessage, parseErrorCode, requestMagicLink, takeMagicToken, verifyMagicLink,
  type LinkFailure,
} from '../auth/signInClient';

// /signin: every way into the app on one page. Google is always here (the same
// link the rest of the site uses); Apple, Microsoft and the emailed link appear
// only when the owner has switched them on and configured them
// (src/auth/providers.ts). Landing on /signin with nothing else enabled just
// shows Google.
//
// The server serves this page for any visitor and never signs anyone in on a
// GET. Opening an emailed link only loads this page; the token travels in the
// URL fragment and is spent when the visitor presses "Sign in to Stop Biting".
// That is what keeps mail scanners that follow links from using it up.
//
// Light only, like the rest of the public site (App.tsx pins the landing page
// the same way). noindex is set by the server and again here.

// Read once per page load. React StrictMode runs initialisers twice in
// development, and the token and error are removed from the URL after the first.
let boot: { token: string | null; error: ReturnType<typeof parseErrorCode>; provider: string | null } | null = null;
function bootState() {
  if (!boot) {
    const q = new URLSearchParams(window.location.search);
    boot = { token: takeMagicToken(), error: parseErrorCode(q.get('error')), provider: q.get('provider') };
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }
  return boot;
}

const COOLDOWN_SECONDS = 30;

const INPUT =
  'h-12 w-full rounded-full border border-[color:var(--sg-rule)] bg-white px-5 text-[1rem] text-[color:var(--sg-ink)] '
  + 'placeholder:text-[color:var(--sg-ink-2)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 '
  + 'focus-visible:outline-[color:var(--sg-accent)]';

export function SignInPage() {
  useTheme('light');
  const { providers, ready } = useSignInProviders();
  const first = bootState();

  const [pendingToken, setPendingToken] = useState<string | null>(first.token);
  const [phase, setPhase] = useState<'idle' | 'confirming'>('idle');
  const [linkFailure, setLinkFailure] = useState<LinkFailure | 'failed' | null>(null);
  const [notice] = useState(() => (first.error ? errorMessage(first.error, first.provider) : null));

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);

  // The form is replaced by "Check your inbox" when the link has been sent: take focus there, not to the top of the page.
  useEffect(() => {
    if (sentTo) sentHeading.current?.focus();
  }, [sentTo]);

  useEffect(() => {
    document.title = 'Sign in | Stop Biting';
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex, nofollow';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function confirmSignIn() {
    if (!pendingToken) return;
    setPhase('confirming');
    const result = await verifyMagicLink(pendingToken, window.location.origin);
    if (result.ok && isSafeRedirect(result.redirect, window.location.origin)) {
      window.location.assign(result.redirect);
      return;
    }
    setPendingToken(null); // a spent or refused token is never retried
    setPhase('idle');
    setLinkFailure(result.ok ? 'failed' : result.reason);
  }

  async function sendLink(e?: FormEvent) {
    e?.preventDefault();
    if (sending || cooldown > 0) return;
    setFormError(null);
    setSending(true);
    const result = await requestMagicLink(email.trim());
    setSending(false);
    if (result.ok) {
      setSentTo(email.trim());
      setCooldown(COOLDOWN_SECONDS);
      return;
    }
    setFormError(
      result.reason === 'invalid_email' ? "That doesn't look like an email address. Please check it and try again."
        : result.reason === 'too_many' ? 'Too many tries. Please wait a few minutes and try again.'
          : "We couldn't send the email. Please try again in a moment.",
    );
  }

  const showEmailForm = providers.magic_link && !pendingToken;

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">
      <header className="sg-container flex h-16 items-center">
        <a href="/" className="flex min-h-11 items-center gap-2.5">
          <img src="/logo.svg" alt="" className="h-8 w-8 flex-shrink-0" />
          <span className="font-display text-xl font-extrabold tracking-[-0.03em]">Stop Biting</span>
        </a>
      </header>

      <main id="main" className="sg-container pb-20 pt-8 sm:pt-14">
        <div className="sg-plate mx-auto w-full max-w-md p-6 sm:p-8">
          {pendingToken ? (
            <>
              <h1 className="sg-h3">Finish signing in</h1>
              <p className="sg-small mt-3">
                Press the button to sign in on this device. Opening the email link on its own does not sign anyone in.
              </p>
              <button
                type="button"
                onClick={confirmSignIn}
                disabled={phase === 'confirming'}
                className="sg-btn mt-6 w-full disabled:opacity-60"
              >
                {phase === 'confirming' ? 'Signing in…' : 'Sign in to Stop Biting'}
              </button>
            </>
          ) : (
            <>
              <h1 className="sg-h3">Sign in or start your free trial</h1>
              <p className="sg-small mt-3">
                Choose how you want to sign in. New here? The same options start your trial. Already have an account? You
                will be signed back in.
              </p>
            </>
          )}

          {(notice || linkFailure) && (
            <p role="alert" className="mt-5 rounded-2xl border border-[color:var(--sg-rule)] bg-[color:var(--sg-ground)] px-4 py-3 text-[0.9375rem] leading-snug text-[color:var(--sg-ink)]">
              {linkFailure ? (linkFailure === 'failed' ? "We couldn't finish signing you in. Please request a new link." : linkFailureMessage(linkFailure)) : notice}
            </p>
          )}

          {!pendingToken && (
            <div className="mt-6 flex flex-col gap-3">
              <GoogleButton />
              {providers.apple && <AppleButton />}
              {providers.microsoft && <MicrosoftButton />}
              {!ready && <p className="sg-note text-center" role="status">Checking for more options…</p>}
            </div>
          )}

          {showEmailForm && (
            <div className="mt-6">
              <div className="mb-5 flex items-center gap-3 text-[color:var(--sg-ink-2)]" aria-hidden="true">
                <span className="h-px flex-1 bg-[color:var(--sg-rule)]" />
                <span className="sg-note">or</span>
                <span className="h-px flex-1 bg-[color:var(--sg-rule)]" />
              </div>

              {sentTo ? (
                <div role="status" aria-live="polite">
                  <h2 ref={sentHeading} tabIndex={-1} className="sg-h3 outline-none">Check your inbox</h2>
                  <p className="sg-small mt-2">
                    A sign-in link is on its way to <strong className="break-all text-[color:var(--sg-ink)]">{sentTo}</strong>. It works
                    once and expires in 15 minutes. If it has not arrived after a couple of minutes, check your spam folder.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <button
                      type="button"
                      onClick={() => void sendLink()}
                      disabled={cooldown > 0 || sending}
                      className="sg-link min-h-11 disabled:no-underline disabled:opacity-60"
                    >
                      {cooldown > 0 ? `Send another link (${cooldown}s)` : 'Send another link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSentTo(null); setFormError(null); window.setTimeout(() => emailRef.current?.focus(), 0); }}
                      className="sg-link min-h-11"
                    >
                      Use a different email
                    </button>
                  </div>
                  {formError && <p role="alert" className="mt-2 text-[0.9375rem] text-[color:var(--sg-ink)]">{formError}</p>}
                </div>
              ) : (
                <form onSubmit={sendLink} noValidate>
                  <label htmlFor="signin-email" className="block text-[0.9375rem] font-semibold text-[color:var(--sg-ink)]">
                    Email address
                  </label>
                  <input
                    ref={emailRef}
                    id="signin-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    aria-invalid={formError ? true : undefined}
                    aria-describedby={formError ? 'signin-email-error' : undefined}
                    className={`${INPUT} mt-2`}
                  />
                  {formError && (
                    <p id="signin-email-error" role="alert" className="mt-2 text-[0.9375rem] text-[color:var(--sg-ink)]">{formError}</p>
                  )}
                  <button type="submit" disabled={sending || email.trim() === ''} className="sg-btn mt-3 w-full disabled:opacity-60">
                    {sending ? 'Sending…' : 'Email me a sign-in link'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <p className="sg-note mx-auto mt-6 max-w-md text-center">
          By continuing you agree to the{' '}
          <a href="/terms-and-conditions" className="sg-link">Terms</a> and the{' '}
          <a href="/privacy" className="sg-link">Privacy Policy</a>.
        </p>
      </main>
    </div>
  );
}
