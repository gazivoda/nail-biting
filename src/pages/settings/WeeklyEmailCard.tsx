// Settings > Account & Sync > "Weekly summary email" (WS5, flag weekly_email).
// Loaded lazily by ./WeeklyEmailSettings.tsx, so with the flag off none of this is
// downloaded.
//
// Off until the person turns it on. The server sends one email a week to the address
// on the ACCOUNT (nothing here can name another address), built from the history the
// person chose to sync. Every email carries an unsubscribe link.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { Row, Section, Toggle } from './ui';
import { apiFetch, useAuth } from '../../contexts/AuthContext';
import { t as tNow, useT } from '../../i18n/scopes/sharing';
import { useT as useCommonT } from '../../i18n/scopes/common';

/** What GET/PUT /api/email/weekly return. */
export interface WeeklyEmailState {
  enabled: boolean;
  timezone: string | null;
  hasSyncedData: boolean;
  hasEmail: boolean;
  lastSentWeek: string | null;
}

export type CardPhase = 'signed-out' | 'loading' | 'ready' | 'load-failed';

export interface WeeklyEmailCardViewProps {
  phase: CardPhase;
  state: WeeklyEmailState | null;
  saving: boolean;
  /** Plain-language reason the last save failed, or null. */
  error: string | null;
  onToggle(on: boolean): void;
  onRetry(): void;
}

/** The card without any hook of its own, so every state can be rendered in a test. */
export function WeeklyEmailCardView(p: WeeklyEmailCardViewProps) {
  const t = useT();
  const tc = useCommonT();
  const enabled = p.state?.enabled === true;
  const label = t('weekly.label');
  return (
    <Section title={t('weekly.title')} icon={Mail} fullWidth>
      <Row label={label} description={t('weekly.description')}>
        {p.phase === 'signed-out' && <span className="text-sm text-stone-600 dark:text-stone-300">{t('weekly.signedOut')}</span>}
        {p.phase === 'loading' && <span className="text-sm text-stone-600 dark:text-stone-300" role="status">{tc('loading')}</span>}
        {p.phase === 'ready' && p.state && <Toggle value={enabled} onChange={p.onToggle} label={label} />}
        {p.phase === 'load-failed' && (
          <button
            type="button"
            onClick={p.onRetry}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill"
          >
            {tc('tryAgain')}
          </button>
        )}
      </Row>

      <p className="-mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">{t('weekly.about')}</p>

      {p.phase === 'load-failed' && (
        <p role="alert" className="text-sm font-semibold text-alert-600 dark:text-alert-400">
          {t('weekly.loadFailed')}
        </p>
      )}

      {p.phase === 'ready' && p.state && !p.state.hasEmail && (
        <p role="status" className="text-sm font-semibold text-stone-700 dark:text-stone-200">
          {t('weekly.noEmail')}
        </p>
      )}

      {p.phase === 'ready' && p.state && p.state.hasEmail && !p.state.hasSyncedData && (
        <p role="status" className="text-sm font-semibold text-stone-700 dark:text-stone-200">
          {t('weekly.needSync')}
        </p>
      )}

      {p.error && (
        <p role="alert" className="text-sm font-semibold text-alert-600 dark:text-alert-400">{p.error}</p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {p.saving ? t('weekly.saving') : p.phase === 'ready' ? (enabled ? t('weekly.isOn') : t('weekly.isOff')) : ''}
      </p>
    </Section>
  );
}

function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** apiFetch throws `API error <status>`; the status is all the page needs. */
function statusOf(err: unknown): number | null {
  const m = /API error (\d{3})/.exec(err instanceof Error ? err.message : '');
  return m ? Number(m[1]) : null;
}

function saveErrorText(err: unknown): string {
  switch (statusOf(err)) {
    case 400: return tNow('weekly.error.noEmail');
    case 401: return tNow('weekly.error.signedOut');
    case 404: return tNow('weekly.error.unavailable');
    case 429: return tNow('weekly.error.tooMany');
    default: return tNow('weekly.error.generic');
  }
}

export function WeeklyEmailCard() {
  const { user } = useAuth();
  const signedIn = !!user;
  const [state, setState] = useState<WeeklyEmailState | null>(null);
  const [loadPhase, setLoadPhase] = useState<Exclude<CardPhase, 'signed-out'>>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const fetchState = useCallback(() => {
    apiFetch('/api/email/weekly')
      .then((s: WeeklyEmailState) => { if (alive.current) { setState(s); setLoadPhase('ready'); } })
      .catch(() => { if (alive.current) setLoadPhase('load-failed'); });
  }, []);

  useEffect(() => { if (signedIn) fetchState(); }, [signedIn, fetchState]);

  const retry = () => { setLoadPhase('loading'); fetchState(); };
  const phase: CardPhase = signedIn ? loadPhase : 'signed-out';

  const onToggle = (on: boolean) => {
    if (saving || !state) return;
    const before = state;
    setError(null);
    setSaving(true);
    setState({ ...state, enabled: on }); // optimistic; the server's answer replaces it
    apiFetch('/api/email/weekly', { method: 'PUT', body: JSON.stringify({ enabled: on, timezone: browserTimeZone() }) })
      .then((s: WeeklyEmailState) => { if (alive.current) setState(s); })
      .catch((err: unknown) => { if (alive.current) { setState(before); setError(saveErrorText(err)); } })
      .finally(() => { if (alive.current) setSaving(false); });
  };

  return <WeeklyEmailCardView phase={phase} state={state} saving={saving} error={error} onToggle={onToggle} onRetry={retry} />;
}
