// Settings > Account & Sync > "Refer a friend" (flag referrals). Rendered by AccountSyncSection with one
// line; WS4 owns that file's body, this one is ours. Nothing is drawn while the flag is off.

import { useEffect, useState } from 'react';
import { Check, Copy, Users } from 'lucide-react';
import { describeLength } from '../../billing/planLabel';
import { useT } from '../../i18n/scopes/billing';
import { apiFetch, useAuth } from '../../contexts/AuthContext';
import { useFeature } from '../../features/useFeature';
import { Row, Section } from '../../pages/settings/ui';

export interface Summary {
  code: string;
  link: string;
  credit_days: number;
  pending: number;
  rewarded: number;
  credit_days_earned: number;
}

export function ReferralCard() {
  // The flag is read here and the account only in the body, so with the flag off this renders nothing and
  // needs no session at all (the settings tests render the section on its own).
  return useFeature('referrals') ? <ReferralCardBody /> : null;
}

function ReferralCardBody() {
  const { user } = useAuth();
  const userId = user?.id;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    apiFetch('/api/referrals/me')
      .then((s: Summary) => { if (live) setSummary(s); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [userId]);

  if (!user) return null;

  async function copy() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is selectable in the box, so nothing is lost.
    }
  }

  return <ReferralView summary={summary} failed={failed} copied={copied} onCopy={copy} />;
}

/** The card for each state of the lookup and of the copy button (the state itself lives in ReferralCardBody). */
export function ReferralView({ summary, failed, copied, onCopy }: { summary: Summary | null; failed: boolean; copied: boolean; onCopy: () => void }) {
  const t = useT();
  const days = summary ? describeLength(summary.credit_days) : null;

  return (
    <Section title={t('referral.title')} icon={Users} fullWidth>
      <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
        {days
          ? t('referral.intro.days', { days })
          : t('referral.intro.plain')}
      </p>

      {failed && <p role="alert" className="text-sm text-alert-600 dark:text-alert-400">{t('referral.failed')}</p>}

      {summary && (
        <>
          <Row label={t('referral.link')} description={t('referral.link.description')}>
            <div className="flex w-full max-w-md items-center gap-2 sm:w-auto">
              <input
                readOnly
                value={summary.link}
                aria-label={t('referral.link.aria')}
                onFocus={e => e.currentTarget.select()}
                className="h-11 min-w-0 flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 text-sm text-stone-800 dark:border-ink-400 dark:bg-ink-fill dark:text-stone-100 sm:w-72"
              />
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-deep px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-500 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200"
              >
                {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                {copied ? t('referral.copied') : t('referral.copy')}
              </button>
            </div>
          </Row>
          <p className="text-sm text-stone-600 dark:text-stone-300" aria-live="polite">
            {summary.credit_days_earned > 0
              ? t('referral.paid.earned', { count: summary.rewarded, days: describeLength(summary.credit_days_earned) })
              : t('referral.paid', { count: summary.rewarded })}
            {summary.pending > 0 ? ` ${t('referral.pending', { count: summary.pending })}` : ''}
          </p>
        </>
      )}
    </Section>
  );
}
