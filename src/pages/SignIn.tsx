import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useSignInProviders } from '../auth/useSignInProviders';
import { AppleButton, GoogleButton, MicrosoftButton } from '../components/auth/ProviderButtons';
import {
  isSafeRedirect, parseErrorCode, requestMagicLink, sendFailureMessage, signInNotice, takeMagicToken, verifyMagicLink,
  type LinkFailure, type SendFailure,
} from '../auth/signInClient';
import { useT } from '../i18n/scopes/auth';
import { useLocaleVersion } from '../i18n/hooks';
import { LocaleHost } from '../i18n/LocaleHost';

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
  useLocaleVersion(); // this page is outside the app's router: a picked language applies through <LocaleHost /> below
  const t = useT();
  const { providers, ready } = useSignInProviders();
  const first = bootState();

  const [pendingToken, setPendingToken] = useState<string | null>(first.token);
  const [phase, setPhase] = useState<'idle' | 'confirming'>('idle');
  const [linkFailure, setLinkFailure] = useState<LinkFailure | 'failed' | null>(null);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<SendFailure | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = t('page.title');
  }, [t]);

  useEffect(() => {
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
    setFormError(result.reason);
  }

  const showEmailForm = providers.magic_link && !pendingToken;
  const notice = signInNotice(linkFailure, first.error, first.provider);
  const formErrorText = formError ? sendFailureMessage(formError) : null;

  return (
    <div className="sg-page min-h-dvh bg-[color:var(--sg-ground)]">
      <LocaleHost />
      <header className="sg-container flex h-16 items-center">
        <a href="/" className="flex min-h-11 items-center gap-2.5">
          <img src="/logo.svg" alt="" className="h-8 w-8 flex-shrink-0" />
          <span className="font-display text-xl font-extrabold tracking-[-0.03em]">Stop Biting</span>
        </a>
      </header>

      <main id="main" className="sg-container pb-20 pt-8 sm:pt-14">
        <div className="sg-plate mx-auto w-full max-w-md p-6 sm:p-8">
          {pendingToken ? (
            <FinishCard confirming={phase === 'confirming'} onConfirm={confirmSignIn} />
          ) : (
            <>
              <h1 className="sg-h3">{t('intro.title')}</h1>
              <p className="sg-small mt-3">
                {t('intro.body')}
              </p>
            </>
          )}

          {notice && (
            <p role="alert" className="mt-5 rounded-2xl border border-[color:var(--sg-rule)] bg-[color:var(--sg-ground)] px-4 py-3 text-[0.9375rem] leading-snug text-[color:var(--sg-ink)]">
              {notice}
            </p>
          )}

          {!pendingToken && (
            <div className="mt-6 flex flex-col gap-3">
              <GoogleButton />
              {providers.apple && <AppleButton />}
              {providers.microsoft && <MicrosoftButton />}
              {!ready && <p className="sg-note text-center" role="status">{t('checking')}</p>}
            </div>
          )}

          {showEmailForm && (
            <div className="mt-6">
              <div className="mb-5 flex items-center gap-3 text-[color:var(--sg-ink-2)]" aria-hidden="true">
                <span className="h-px flex-1 bg-[color:var(--sg-rule)]" />
                <span className="sg-note">{t('divider.or')}</span>
                <span className="h-px flex-1 bg-[color:var(--sg-rule)]" />
              </div>

              {sentTo ? (
                <SentNotice
                  email={sentTo}
                  cooldown={cooldown}
                  sending={sending}
                  error={formErrorText}
                  onResend={() => void sendLink()}
                  onDifferent={() => { setSentTo(null); setFormError(null); window.setTimeout(() => emailRef.current?.focus(), 0); }}
                />
              ) : (
                <EmailForm email={email} onEmail={setEmail} sending={sending} error={formErrorText} inputRef={emailRef} onSubmit={sendLink} />
              )}
            </div>
          )}
        </div>

        <p className="sg-note mx-auto mt-6 max-w-md text-center">
          {t.rich('terms', {}, {
            terms: c => <a href="/terms-and-conditions" className="sg-link">{c}</a>,
            privacy: c => <a href="/privacy" className="sg-link">{c}</a>,
          })}
        </p>
      </main>
    </div>
  );
}

/** The page when the emailed link was opened: one more press signs in (so mail scanners cannot spend the link). */
export function FinishCard({ confirming, onConfirm }: { confirming: boolean; onConfirm: () => void }) {
  const t = useT();
  return (
    <>
      <h1 className="sg-h3">{t('finish.title')}</h1>
      <p className="sg-small mt-3">
        {t('finish.body')}
      </p>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirming}
        className="sg-btn mt-6 w-full disabled:opacity-60"
      >
        {confirming ? t('finish.working') : t('finish.button')}
      </button>
    </>
  );
}

/** "Check your inbox", with the resend button and its cooldown. */
export function SentNotice({ email, cooldown, sending, error, onResend, onDifferent }: {
  email: string; cooldown: number; sending: boolean; error: string | null; onResend: () => void; onDifferent: () => void;
}) {
  const t = useT();
  return (
    <div role="status" aria-live="polite">
      <h2 className="sg-h3">{t('sent.title')}</h2>
      <p className="sg-small mt-2">
        {t.rich('sent.body', { email }, { b: c => <strong className="break-all text-[color:var(--sg-ink)]">{c}</strong> })}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button
          type="button"
          onClick={onResend}
          disabled={cooldown > 0 || sending}
          className="sg-link min-h-11 disabled:no-underline disabled:opacity-60"
        >
          {cooldown > 0 ? t('sent.againWait', { seconds: cooldown }) : t('sent.again')}
        </button>
        <button
          type="button"
          onClick={onDifferent}
          className="sg-link min-h-11"
        >
          {t('sent.different')}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-[0.9375rem] text-[color:var(--sg-ink)]">{error}</p>}
    </div>
  );
}

/** The address field and the send button. */
export function EmailForm({ email, onEmail, sending, error, inputRef, onSubmit }: {
  email: string; onEmail: (v: string) => void; sending: boolean; error: string | null;
  inputRef: RefObject<HTMLInputElement | null>; onSubmit: (e: FormEvent) => void;
}) {
  const t = useT();
  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="signin-email" className="block text-[0.9375rem] font-semibold text-[color:var(--sg-ink)]">
        {t('email.label')}
      </label>
      <input
        ref={inputRef}
        id="signin-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={e => onEmail(e.target.value)}
        placeholder={t('email.placeholder')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'signin-email-error' : undefined}
        className={`${INPUT} mt-2`}
      />
      {error && (
        <p id="signin-email-error" role="alert" className="mt-2 text-[0.9375rem] text-[color:var(--sg-ink)]">{error}</p>
      )}
      <button type="submit" disabled={sending || email.trim() === ''} className="sg-btn mt-3 w-full disabled:opacity-60">
        {sending ? t('email.sending') : t('email.send')}
      </button>
    </form>
  );
}
