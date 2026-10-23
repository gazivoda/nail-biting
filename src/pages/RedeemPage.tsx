import { useEffect, useState, type FormEvent } from 'react';
import { describeLength } from '../billing/planLabel';
import { useSignInHref } from '../auth/useSignInProviders';
import { cleanGiftCode, forgetGiftCode, rememberGiftCode, takeGiftCode } from '../billing/giftCode';
import { apiFetch, useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { useT, type messages } from '../i18n/scopes/billing';
import { formatDate } from '../i18n/format';
import { useLocaleVersion } from '../i18n/hooks';
import { LocaleHost } from '../i18n/LocaleHost';

// /redeem: where a gift link lands (flag gift_plan; the server answers 404 for this path while the flag is
// off). The code comes from the emailed link's fragment, which the server's page has already moved into
// window.__sbGiftCode; it is kept in this browser while the recipient signs in, and used once.
//
// Light only and not indexable, like /signin.

export type Failure = 'invalid' | 'already_redeemed' | 'expired' | 'revoked' | 'busy' | 'failed';

const FAILURE_KEYS = {
  invalid: 'redeem.failure.invalid',
  already_redeemed: 'redeem.failure.already_redeemed',
  expired: 'redeem.failure.expired',
  revoked: 'redeem.failure.revoked',
  busy: 'redeem.failure.busy',
  failed: 'redeem.failure.failed',
} as const satisfies Record<Failure, keyof typeof messages>;

const fmt = (iso: string) => formatDate(iso, { year: 'numeric', month: 'long', day: 'numeric' });

export function RedeemPage() {
  useTheme('light');
  useLocaleVersion(); // this page is outside the app's router: a picked language applies through <LocaleHost /> below
  const t = useT();
  const { user, accessStatus, refreshProfile } = useAuth();
  const signIn = useSignInHref();
  const [code, setCode] = useState<string | null>(() => takeGiftCode());
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [redeemedDays, setRedeemedDays] = useState<number | null>(null);

  useEffect(() => {
    document.title = t('redeem.pageTitle');
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
        setFailure((out.reason in FAILURE_KEYS ? out.reason : 'failed') as Failure);
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
      <LocaleHost />
      <header className="sg-container flex h-16 items-center">
        <a href="/" className="flex min-h-11 items-center gap-2.5">
          <img src="/logo.svg" alt="" className="h-8 w-8 flex-shrink-0" />
          <span className="font-display text-xl font-extrabold tracking-[-0.03em]">Stop Biting</span>
        </a>
      </header>

      <main id="main" className="sg-container pb-20 pt-8 sm:pt-14">
        <div className="sg-plate mx-auto w-full max-w-md p-6 sm:p-8">
          {redeemedDays !== null ? (
            <RedeemedCard days={redeemedDays} endsAt={gift?.ends_at ?? null} />
          ) : accessStatus === 'loading' ? (
            <p className="sg-small" role="status">{t('redeem.checking')}</p>
          ) : accessStatus === 'no_auth' ? (
            <>
              <h1 className="sg-h3">{code ? t('redeem.signIn.title') : t('redeem.title')}</h1>
              <p className="sg-small mt-3">
                {code ? t('redeem.signIn.withLink') : t('redeem.signIn.noLink')}
              </p>
              <a href={signIn} className="sg-btn mt-6 w-full">{t('redeem.signIn.button')}</a>
            </>
          ) : (
            <RedeemForm
              hasLink={!!code}
              typed={typed}
              onType={setTyped}
              working={working}
              canSubmit={!!code || cleanGiftCode(typed) !== null}
              inputClass={input}
              onSubmit={redeem}
            />
          )}
          {failure && <FailureNote failure={failure} />}
        </div>
      </main>
    </div>
  );
}

/** After a successful redeem: when the gift ends, or how long was added. */
export function RedeemedCard({ days, endsAt }: { days: number; endsAt: string | null }) {
  const t = useT();
  return (
    <>
      <h1 className="sg-h3">{t('redeem.done.title')}</h1>
      <p className="sg-small mt-3" role="status">
        {endsAt
          ? t('redeem.done.until', { date: fmt(endsAt) })
          : t('redeem.done.saved', { length: describeLength(days) })}
      </p>
      <a href="/" className="sg-btn mt-6 w-full">{t('openApp')}</a>
    </>
  );
}

/** Signed in: the code field (when the link did not bring one) and the Redeem button. */
export function RedeemForm({ hasLink, typed, onType, working, canSubmit, inputClass, onSubmit }: {
  hasLink: boolean; typed: string; onType: (v: string) => void; working: boolean; canSubmit: boolean;
  inputClass: string; onSubmit: (e: FormEvent) => void;
}) {
  const t = useT();
  return (
    <>
      <h1 className="sg-h3">{t('redeem.title')}</h1>
      <p className="sg-small mt-3">
        {hasLink ? t('redeem.ready.withLink') : t('redeem.ready.typeCode')}
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        {!hasLink && (
          <input
            value={typed}
            onChange={e => onType(e.target.value)}
            aria-label={t('redeem.code.aria')}
            placeholder={t('redeem.code.placeholder')}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={inputClass}
          />
        )}
        <button type="submit" disabled={working || !canSubmit} className="sg-btn w-full disabled:opacity-60">
          {working ? t('redeem.redeeming') : t('redeem.redeem')}
        </button>
      </form>
    </>
  );
}

export function FailureNote({ failure }: { failure: Failure }) {
  const t = useT();
  return <p role="alert" className="sg-small mt-4 text-[color:var(--sg-ink)]">{t(FAILURE_KEYS[failure])}</p>;
}
