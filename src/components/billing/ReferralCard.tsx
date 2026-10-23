// Settings > Account & Sync > "Refer a friend" (flag referrals). Rendered by AccountSyncSection with one
// line; WS4 owns that file's body, this one is ours. Nothing is drawn while the flag is off.

import { useEffect, useState } from 'react';
import { Check, Copy, Users } from 'lucide-react';
import { describeDays } from '../../../shared/plans.js';
import { apiFetch, useAuth } from '../../contexts/AuthContext';
import { useFeature } from '../../features/useFeature';
import { Row, Section } from '../../pages/settings/ui';

interface Summary {
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

  const days = summary ? describeDays(summary.credit_days) : null;

  return (
    <Section title="Refer a friend" icon={Users} fullWidth>
      <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
        {days
          ? `When someone you refer pays for the first time, you both get ${days} of bonus access. The days are saved and start by themselves when your trial or subscription is not covering you. If that payment is refunded, the days are taken back.`
          : 'When someone you refer pays for the first time, you both get bonus access.'}
      </p>

      {failed && <p role="alert" className="text-sm text-alert-600 dark:text-alert-400">Your link could not be loaded. Please try again later.</p>}

      {summary && (
        <>
          <Row label="Your link" description="Anyone who signs up through it is counted for you.">
            <div className="flex w-full max-w-md items-center gap-2 sm:w-auto">
              <input
                readOnly
                value={summary.link}
                aria-label="Your referral link"
                onFocus={e => e.currentTarget.select()}
                className="h-11 min-w-0 flex-1 rounded-full border border-stone-200 bg-stone-50 px-4 text-sm text-stone-800 dark:border-ink-400 dark:bg-ink-fill dark:text-stone-100 sm:w-72"
              />
              <button
                type="button"
                onClick={copy}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-deep px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-500 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200"
              >
                {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </Row>
          <p className="text-sm text-stone-600 dark:text-stone-300" aria-live="polite">
            {summary.rewarded} {summary.rewarded === 1 ? 'person has' : 'people have'} paid through your link
            {summary.credit_days_earned > 0 ? `, earning you ${describeDays(summary.credit_days_earned)}` : ''}.
            {summary.pending > 0 ? ` ${summary.pending} ${summary.pending === 1 ? 'is' : 'are'} signed up and have not paid yet.` : ''}
          </p>
        </>
      )}
    </Section>
  );
}
