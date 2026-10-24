// Settings > Sharing: make, copy and revoke read-only share links (WS10, flag share_links).
// Rendered from sections/SharingSection.tsx.
//
// A link shows a summary of the history this account has synced (counts, the reasons you
// picked, how often you finished a competing response, your streak) and nothing else.
// The card says exactly that before a link is made. The full link is shown once, in this
// panel, and lives only in this component's memory: it is not written to storage and is
// never sent anywhere except to the person you give it to. Revoking is confirmed in the
// page (never window.confirm).

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Share2 } from 'lucide-react';
import { Row, Section, Toggle } from './ui';
import { useFeatures } from '../../features/useFeature';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetchRequest } from '../../sync/apiFetchRequest';
import { getOptedInUserId, subscribeSyncOptIn } from '../../sync/optIn';
import { useT } from '../../i18n/scopes/sharing';
import { useT as useCommonT } from '../../i18n/scopes/common';
import { t as dataT } from '../../i18n/scopes/data';
import { createLink, listLinks, revokeLink } from '../../share/api';
import { browserClipboard, copyText } from '../../share/clipboard';
import {
  EXPIRY_OPTIONS, INTRO, SYNC_NEEDED, describeCreated, describeExpiry, describeViewed, failureText, previewFor,
} from '../../share/copy';
import type { CreatedLink, ExpiryChoice, ShareLink, ShareList } from '../../share/types';

const pill = 'inline-flex min-h-11 items-center justify-center rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill';
const primary = 'inline-flex min-h-11 items-center justify-center rounded-full bg-deep px-5 font-display text-sm font-bold text-white transition-colors hover:bg-deep-2 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200';
const danger = 'inline-flex min-h-11 items-center justify-center rounded-full bg-alert-600 px-6 text-sm font-semibold text-cream-100 transition-colors hover:bg-alert-800 disabled:cursor-not-allowed disabled:opacity-40';
const panel = 'space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-ink-400 dark:bg-ink-100';
const field = 'min-h-11 rounded-full border border-stone-300 bg-white px-4 text-sm text-stone-900 dark:border-ink-400 dark:bg-ink-fill dark:text-stone-100';
const note = 'text-sm leading-relaxed text-stone-600 dark:text-stone-300';

/** The section's content. Nothing at all while the feature flag is off. */
export function SharingSettings() {
  const on = useFeatures().share_links;
  if (!on) return null;
  return <SharingCard />;
}

const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/**
 * Scrolls to the Account & Sync card, if it is on the page. The card is another workstream's; this only looks for its
 * heading, by the card's own title in the language that shows (the message the card itself uses).
 */
function goToSyncSettings() {
  const title = dataT('sync.title');
  const heading = Array.from(document.querySelectorAll('h2')).find(h => h.textContent?.trim() === title);
  if (!heading) return;
  heading.setAttribute('tabindex', '-1');
  heading.scrollIntoView({ block: 'start' });
  heading.focus();
}

type Load = 'loading' | 'ready' | 'error';

function SharingCard() {
  const t = useT();
  const { user } = useAuth();
  const flags = useFeatures();
  const optedInFor = useSyncExternalStore(subscribeSyncOptIn, getOptedInUserId, () => null);
  const signedIn = !!user;
  const syncOn = signedIn && flags.event_sync && optedInFor === user.id;

  const [load, setLoad] = useState<Load>('loading');
  const [list, setList] = useState<ShareList | null>(null);
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<ExpiryChoice>(30);
  const [detailed, setDetailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const r = await listLinks(apiFetchRequest);
    setNow(Date.now());
    if (r.ok) {
      setList(r.value);
      setLoad('ready');
      setError(null);
    } else {
      setLoad('error');
      setError(failureText(r.status, 'load'));
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the list when the card opens; the state is set after the request answers
    void refresh();
  }, [signedIn, refresh]);

  const onCreate = async () => {
    setCreating(true);
    setError(null);
    setStatus(null);
    const r = await createLink(apiFetchRequest, { label: label.trim(), expiresInDays, detailed, timezone: browserZone() });
    setCreating(false);
    if (!r.ok) {
      setError(failureText(r.status, 'create'));
      return;
    }
    setCreated(r.value);
    setCopied('idle');
    setLabel('');
    setDetailed(false);
    void refresh();
  };

  const onCopy = async (input: HTMLInputElement | null) => {
    if (!created) return;
    const ok = await copyText(created.url, browserClipboard(input));
    setCopied(ok ? 'copied' : 'manual');
    if (!ok) input?.select();
  };

  const onRevoke = async () => {
    if (!confirmId) return;
    setRevoking(true);
    const r = await revokeLink(apiFetchRequest, confirmId);
    setRevoking(false);
    if (!r.ok && r.status !== 404) {
      setError(failureText(r.status, 'revoke'));
      return;
    }
    if (created?.id === confirmId) setCreated(null);
    setConfirmId(null);
    setError(null);
    setStatus(t('status.revoked'));
    void refresh();
  };

  return (
    <SharingCardView
      signedIn={signedIn}
      syncOn={syncOn}
      syncFlag={flags.event_sync}
      load={load}
      list={list}
      form={{ label, expiresInDays, detailed }}
      creating={creating}
      created={created}
      confirmId={confirmId}
      revoking={revoking}
      error={error}
      status={status}
      copied={copied}
      now={now}
      onLabel={setLabel}
      onExpiry={setExpiresInDays}
      onDetailed={setDetailed}
      onCreate={() => { void onCreate(); }}
      onCopy={input => { void onCopy(input); }}
      onDismissCreated={() => { setCreated(null); setCopied('idle'); }}
      onAskRevoke={id => { setConfirmId(id); setStatus(null); }}
      onCancelRevoke={() => setConfirmId(null)}
      onConfirmRevoke={() => { void onRevoke(); }}
      onGoToSync={goToSyncSettings}
    />
  );
}

export interface SharingCardViewProps {
  signedIn: boolean;
  /** This account has switched on sync on this browser, and the sync feature is on. */
  syncOn: boolean;
  /** The sync feature flag itself. */
  syncFlag: boolean;
  load: Load;
  list: ShareList | null;
  form: { label: string; expiresInDays: ExpiryChoice; detailed: boolean };
  creating: boolean;
  created: CreatedLink | null;
  confirmId: string | null;
  revoking: boolean;
  error: string | null;
  status: string | null;
  copied: 'idle' | 'copied' | 'manual';
  now: number;
  onLabel(v: string): void;
  onExpiry(v: ExpiryChoice): void;
  onDetailed(v: boolean): void;
  onCreate(): void;
  /** `input` is the field that shows the link, for the select-and-copy fallback. */
  onCopy(input: HTMLInputElement | null): void;
  onDismissCreated(): void;
  onAskRevoke(id: string): void;
  onCancelRevoke(): void;
  onConfirmRevoke(): void;
  onGoToSync(): void;
}

/** The card without any hook of its own, so every state can be rendered in a test. */
export function SharingCardView(p: SharingCardViewProps) {
  const t = useT();
  const tc = useCommonT();
  const labelId = useId();
  const expiryId = useId();
  const linkInput = useRef<HTMLInputElement>(null);
  const hasCreated = p.created !== null;
  // The panel with the new link appears with the link selected, ready to copy.
  useEffect(() => {
    if (hasCreated) linkInput.current?.select();
  }, [hasCreated]);
  const preview = previewFor(p.form.detailed);
  const links = p.list?.links ?? [];
  const atLimit = p.list !== null && links.length >= p.list.max;
  const nothingSynced = p.list !== null && p.list.syncedEntries === 0;

  return (
    <Section title={t('card.title')} icon={Share2} fullWidth>
      <p className={`-mt-2 ${note}`}>{String(INTRO)}</p>

      {!p.signedIn && <p className={note}>{t('card.signedOut')}</p>}

      {p.signedIn && !p.syncOn && (
        <div className={panel} role="note">
          <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{String(SYNC_NEEDED)}</p>
          <p className={note}>
            {p.syncFlag ? t('sync.turnOn') : t('sync.notAvailable')}
          </p>
          {p.syncFlag && (
            <button type="button" onClick={p.onGoToSync} className={pill}>{t('sync.go')}</button>
          )}
        </div>
      )}

      {p.signedIn && p.syncOn && nothingSynced && (
        <p className={note} role="status">
          {t('card.nothingSynced')}
        </p>
      )}

      {p.signedIn && (
        <>
          <div className="space-y-4">
            <Row label={t('form.note.label')} description={t('form.note.description')}>
              <div>
                <label htmlFor={labelId} className="sr-only">{t('form.note.label')}</label>
                <input
                  id={labelId}
                  type="text"
                  value={p.form.label}
                  maxLength={60}
                  onChange={e => p.onLabel(e.target.value)}
                  className={`${field} w-64 max-w-full`}
                />
              </div>
            </Row>

            <Row label={t('form.expiry.label')} description={t('form.expiry.description')}>
              <div>
                <label htmlFor={expiryId} className="sr-only">{t('form.expiry.label')}</label>
                <select
                  id={expiryId}
                  value={p.form.expiresInDays === null ? 'none' : String(p.form.expiresInDays)}
                  onChange={e => p.onExpiry(e.target.value === 'none' ? null : (Number(e.target.value) as ExpiryChoice))}
                  className={field}
                >
                  {EXPIRY_OPTIONS.map(o => (
                    <option key={String(o.value)} value={o.value === null ? 'none' : String(o.value)}>{o.label}</option>
                  ))}
                </select>
              </div>
            </Row>

            <Row label={t('form.dates.label')} description={t('form.dates.description')}>
              <Toggle value={p.form.detailed} onChange={p.onDetailed} label={t('form.dates.label')} />
            </Row>
          </div>

          <div className={panel} aria-label={t('preview.title')}>
            <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{t('preview.title')}</p>
            <ul className={`list-disc space-y-1 pl-5 ${note}`}>
              {preview.shows.map(line => <li key={line}>{line}</li>)}
            </ul>
            <p className="pt-1 text-[15px] font-semibold text-stone-900 dark:text-stone-100">{t('preview.neverTitle')}</p>
            <ul className={`list-disc space-y-1 pl-5 ${note}`}>
              {preview.never.map(line => <li key={line}>{line}</li>)}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={p.onCreate} disabled={p.creating || atLimit} className={primary}>
              {p.creating ? t('create.busy') : t('create.button')}
            </button>
            {atLimit && p.list && (
              <span className={note}>{t('create.limit', { max: p.list.max })}</span>
            )}
          </div>

          {p.created && (
            <div className={panel} role="group" aria-label={t('new.group')}>
              <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{t('new.title')}</p>
              <p className={note}>{t('new.note')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={`${labelId}-url`} className="sr-only">{t('new.urlLabel')}</label>
                <input
                  id={`${labelId}-url`}
                  ref={linkInput}
                  type="text"
                  readOnly
                  value={p.created.url}
                  onFocus={e => e.currentTarget.select()}
                  className={`${field} min-w-0 flex-1 basis-64 font-mono text-xs`}
                />
                <button type="button" onClick={() => p.onCopy(linkInput.current)} className={primary}>
                  {p.copied === 'copied' ? t('new.copied') : t('new.copy')}
                </button>
                <button type="button" onClick={p.onDismissCreated} className={pill}>{tc('done')}</button>
              </div>
              <p role="status" aria-live="polite" className={note}>
                {p.copied === 'copied' && t('new.copiedStatus')}
                {p.copied === 'manual' && t('new.copyManual')}
              </p>
            </div>
          )}

          {p.status && <p role="status" className="text-sm text-stone-700 dark:text-stone-200">{p.status}</p>}
          {p.error && <p role="alert" className="text-sm text-alert-600 dark:text-alert-400">{p.error}</p>}

          <div className="space-y-3">
            <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{t('links.title')}</p>
            {p.load === 'loading' && <p className={note}>{tc('loading')}</p>}
            {p.load === 'ready' && links.length === 0 && <p className={note}>{t('links.empty')}</p>}
            {links.length > 0 && (
              <ul className="space-y-3">
                {links.map(l => (
                  <LinkRow key={l.id} link={l} now={p.now} confirming={p.confirmId === l.id} revoking={p.revoking} p={p} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Section>
  );
}

function LinkRow({ link, now, confirming, revoking, p }: { link: ShareLink; now: number; confirming: boolean; revoking: boolean; p: SharingCardViewProps }) {
  const t = useT();
  return (
    <li className="rounded-2xl border border-stone-200 p-4 dark:border-ink-400">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="break-words text-[15px] font-semibold text-stone-900 dark:text-stone-100">
            {link.label || t('link.unnamed')}
            <span className="ml-2 rounded-full border border-stone-300 px-2 py-0.5 align-middle text-xs font-medium text-stone-600 dark:border-ink-400 dark:text-stone-300">
              {link.detailed ? t('link.withDates') : t('link.countsOnly')}
            </span>
          </p>
          <p className={note}>
            {describeCreated(link.createdAt)} · {describeExpiry(link.expiresAt, now)}
          </p>
          <p className={note}>{describeViewed(link.lastViewedAt)}</p>
        </div>
        {!confirming && (
          <button type="button" onClick={() => p.onAskRevoke(link.id)} className={pill} aria-label={link.label ? t('link.revokeNamed', { label: link.label }) : t('link.revokeUnnamed')}>
            {t('link.revoke')}
          </button>
        )}
      </div>
      {confirming && (
        <div className={`mt-3 ${panel}`} role="group" aria-label={t('revoke.group')}>
          <p className="text-sm text-alert-600 dark:text-alert-400">{t('revoke.warning')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={p.onConfirmRevoke} disabled={revoking} className={danger}>
              {revoking ? t('revoke.busy') : t('revoke.yes')}
            </button>
            <button type="button" autoFocus onClick={p.onCancelRevoke} disabled={revoking} className={pill}>{t('revoke.keep')}</button>
          </div>
        </div>
      )}
    </li>
  );
}
