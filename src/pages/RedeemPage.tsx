import { useEffect, useState, type FormEvent } from 'react';
import { describeDays } from '../../shared/plans.js';
import { useSignInHref } from '../auth/useSignInProviders';
import { cleanGiftCode, forgetGiftCode, rememberGiftCode, takeGiftCode } from '../billing/giftCode';
import { apiFetch, useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

// /redeem: where a gift link lands (flag gift_plan; the server answers 404 for this path while the flag is
// off). The code comes from the emailed link's fragment, which the server's page has already moved into
// window.__sbGiftCode; it is kept in this browser while the recipient signs in, and used once.
//
// Light only and not indexable, like /signin.

type Failure = 'invalid' | 'already_redeemed' | 'expired' | 'revoked' | 'busy' | 'failed';

const FAILURE_TEXT: Record<Failure, string> = {
  invalid: 'That code is not valid. Check it and try again.',
  already_redeemed: 'This gift has already been redeemed.',
  expired: 'This gift link has expired. If you were sent it recently, email hello@stopbiting.today.',
  revoked: 'This gift is no longer valid. If you think that is a mistake, email hello@stopbiting.today.',
  busy: 'Too many tries. Please wait a few minutes and try again.',
  failed: 'Something went wrong. Please try again in a moment.',
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

export function RedeemPage() {
  useTheme('light');
  const { user, accessStatus, refreshProfile } = useAuth();
  const signIn = useSignInHref();
  const [code, setCode] = useState<string | null>(() => takeGiftCode());
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [redeemedDays, setRedeemedDays] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Redeem a gift | Stop Biting';
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex, nofollow';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  async function redeem(e?: FormEvent) {
    e?.preventDefault();
    const use = code ?? cleanGiftCode(typed);
    if (working) return;
    if (!use) { setFailure('invalid'); return; }
    setWorking(true);
    setFailure(null);
    try {
      const out = await apiFetch('/api/billing/gift/redeem', { method: 'POST', body: JSON.stringify({ code: use }) }) as
        { ok: true; days: number } | { ok: false; reason: string };
      if (out.ok) {
        forgetGiftCode();
        setCode(null);
        setRedeemedDays(out.days);
        await refreshProfile();
      } else {
        // Whatever the reason, this code will not work later either: stop carrying it around.
        forgetGiftCode();
        setCode(null);
        setFailure((out.reason in FAILURE_TEXT ? out.reason : 'failed') as Failure);
      }
    } catch (err) {
      setFailure(/\b429\b/.test((err as Error).message) ? 'busy' : 'failed');
      if (code) rememberGiftCode(code);   // a network failure is not the code's fault
    } finally {
      setWorking(false);
    }
  }

  const gift = user?.entitlement?.grants?.find(g => g.kind === 'gift');
  const input =
    'h-12 w-full rounded-full border border-[color:var(--sg-rule)] bg-white px-5 text-[1rem] tracking-wide text-[color:var(--sg-ink)] '
    + 'placeholder:text-[color:var(--sg-ink-2)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 '
    + 'focus-visible:outline-[color:var(--sg-accent)]';

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
          {redeemedDays !== null ? (
            <>
              <h1 className="sg-h3">Gift redeemed</h1>
              <p className="sg-small mt-3" role="status">
                {gift?.ends_at
                  ? `Your gift is active until ${fmt(gift.ends_at)}.`
                  : `${describeDays(redeemedDays)} of Stop Biting are saved on your account. They start by themselves when your trial or subscription is not covering you.`}
              </p>
              <a href="/" className="sg-btn mt-6 w-full">Open the app</a>
            </>
          ) : accessStatus === 'loading' ? (
            <p className="sg-small" role="status">Checking your account…</p>
          ) : accessStatus === 'no_auth' ? (
            <>
              <h1 className="sg-h3">{code ? 'Sign in to redeem your gift' : 'Redeem a gift'}</h1>
              <p className="sg-small mt-3">
                {code
                  ? 'Your gift link is kept on this device while you sign in. Sign in with your own account, or create one, and you will come back here.'
                  : 'Open the gift link you were sent. If it does not open, sign in first and then type the code from the email.'}
              </p>
              <a href={signIn} className="sg-btn mt-6 w-full">Sign in</a>
            </>
          ) : (
            <>
              <h1 className="sg-h3">Redeem a gift</h1>
              <p className="sg-small mt-3">
                {code
                  ? 'Your gift link is ready. It works once, and the days are added to the account you are signed in with.'
                  : 'Type the code from the gift email. It works once, and the days are added to the account you are signed in with.'}
              </p>
              <form onSubmit={redeem} className="mt-6 space-y-3">
                {!code && (
                  <input
                    value={typed}
                    onChange={e => setTyped(e.target.value)}
                    aria-label="Gift code"
                    placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className={input}
                  />
                )}
                <button type="submit" disabled={working || (!code && cleanGiftCode(typed) === null)} className="sg-btn w-full disabled:opacity-60">
                  {working ? 'Redeeming…' : 'Redeem'}
                </button>
              </form>
            </>
          )}
          {failure && <p role="alert" className="sg-small mt-4 text-[color:var(--sg-ink)]">{FAILURE_TEXT[failure]}</p>}
        </div>
      </main>
    </div>
  );
}
