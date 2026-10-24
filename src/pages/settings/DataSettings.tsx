// Settings > Data: take your history out, put it back, and delete it (WS4).
// Rendered from sections/DataSection.tsx.
//
//   Export JSON / CSV        flag data_backup   works with no account and no sync
//   Restore from a file      flag data_backup   preview first, never overwrites newer records
//   Delete synced data       flag event_sync    wipes the server copy; this device keeps its history
//   Delete everything        either flag        this device, and the server copy if you tick the box
//
// Every destructive step is confirmed in the page (never window.confirm), names
// what will be lost, and puts keyboard focus on the safe button.

import { useId, useRef, useState } from 'react';
import { Database, Trash2 } from 'lucide-react';
import { Row, Section } from './ui';
import { useFeatures } from '../../features/useFeature';
import { events } from '../../storage';
import { MAX_INCIDENTS, useAppStore } from '../../store/useAppStore';
import { describeDeleteFailure } from '../../sync/statusText';
import { t, useT } from '../../i18n/scopes/data';
import { useT as useCommonT } from '../../i18n/scopes/common';
import { formatDatePattern } from '../../i18n/format';
import { eventsToCsv } from '../../backup/csv';
import { applyImport, isNoop, planImport, type ImportPlan, type ImportRefusal } from '../../backup/importPlan';
import { downloadTextFile, exportFileName, readChosenFile } from '../../backup/files';
import { deleteEverything, deleteSyncedData, isSyncSwitchedOn, loadRemoteStatus } from '../../sync/actions';

/** The section's content. Nothing at all while both flags are off. */
export function DataSettings() {
  const flags = useFeatures();
  if (!flags.data_backup && !flags.event_sync) return null;
  return <DataCard backup={flags.data_backup} sync={flags.event_sync} />;
}

const pill = 'inline-flex min-h-11 items-center justify-center rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill';
const primary = 'inline-flex min-h-11 items-center justify-center rounded-full bg-deep px-5 font-display text-sm font-bold text-white transition-colors hover:bg-deep-2 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200';
const danger = 'inline-flex min-h-11 items-center justify-center rounded-full bg-alert-600 px-6 text-sm font-semibold text-cream-100 transition-colors hover:bg-alert-800 disabled:cursor-not-allowed disabled:opacity-40';
const panel = 'space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-ink-400 dark:bg-ink-100';

// Dates: English keeps date-fns' "Oct 23, 2026 3:45 PM"; other languages get their own medium date and short time.
const when = (ms: number) => formatDatePattern(ms, 'PP p', { dateStyle: 'medium', timeStyle: 'short' });
const day = (ms: number) => formatDatePattern(ms, 'PP', { dateStyle: 'medium' });

// The stored behavior id is shown as words. The words of the known ids are translated; an id this
// build does not know (from a newer export file) is shown as it was, underscores turned into spaces.
const BEHAVIOR_KEYS = {
  nail_biting: 'behavior.nail_biting',
  cuticle_skin_biting: 'behavior.cuticle_skin_biting',
  nose_picking: 'behavior.nose_picking',
  eye_area_pulling: 'behavior.eye_area_pulling',
  face_skin_picking: 'behavior.face_skin_picking',
  hair_pulling: 'behavior.hair_pulling',
} as const satisfies Record<string, Parameters<typeof t>[0]>;
const behaviorWord = (b: string) =>
  Object.prototype.hasOwnProperty.call(BEHAVIOR_KEYS, b) ? t(BEHAVIOR_KEYS[b as keyof typeof BEHAVIOR_KEYS]) : b.replace(/_/g, ' ');

// ── The card ────────────────────────────────────────────────────────────────

export function DataCard({ backup, sync }: { backup: boolean; sync: boolean }) {
  const t = useT();
  return (
    <Section title={t('card.title')} icon={Database} fullWidth>
      {backup && <BackupRows />}
      {sync && <DeleteSyncedRow />}
      <DeleteEverythingRow sync={sync} />
    </Section>
  );
}

// ── Export and restore ──────────────────────────────────────────────────────

export type ImportState =
  | { step: 'idle' }
  | { step: 'preview'; plan: ImportPlan; fileName: string }
  | { step: 'refused'; message: string }
  | { step: 'done'; plan: ImportPlan };

/** `seed` only starts the card in a given state, so a test can render every step; the page never passes it. */
export function BackupRows({ seed }: { seed?: { exported?: string | null; imp?: ImportState } } = {}) {
  const t = useT();
  const [exported, setExported] = useState<string | null>(seed?.exported ?? null);
  const [imp, setImp] = useState<ImportState>(seed?.imp ?? { step: 'idle' });
  const fileInput = useRef<HTMLInputElement>(null);
  const fileId = useId();

  const exportJson = () => {
    const data = events.exportAll();
    downloadTextFile(exportFileName('json'), 'application/json', JSON.stringify(data, null, 2));
    setExported(t('export.savedJson', { count: data.events.length }));
  };

  const exportCsv = () => {
    const list = events.list();
    downloadTextFile(exportFileName('csv'), 'text/csv', eventsToCsv(list), true);
    setExported(t('export.savedCsv', { count: list.length }));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const read = await readChosenFile(file);
    if (!read.ok) { setImp({ step: 'refused', message: read.message }); return; }
    const plan = planImport(read.text, events.list({ includeDeleted: true }));
    setImp(plan.ok ? { step: 'preview', plan, fileName: file.name } : { step: 'refused', message: (plan as ImportRefusal).message });
  };

  const confirmImport = () => {
    if (imp.step !== 'preview') return;
    applyImport(imp.plan, events);
    setImp({ step: 'done', plan: imp.plan });
  };

  const reset = () => {
    setImp({ step: 'idle' });
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <>
      <Row
        label={t('export.label')}
        description={t('export.description')}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportJson} className={pill}>{t('export.json')}</button>
          <button type="button" onClick={exportCsv} className={pill}>{t('export.csv')}</button>
        </div>
      </Row>
      {exported && <p role="status" className="-mt-3 text-sm text-stone-700 dark:text-stone-200">{exported}</p>}

      <Row
        label={t('restore.label')}
        description={t('restore.description')}
      >
        <div>
          <label htmlFor={fileId} className="sr-only">{t('restore.fileLabel')}</label>
          <input
            ref={fileInput}
            id={fileId}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={e => { void onFile(e.target.files?.[0]); }}
          />
          <button type="button" onClick={() => fileInput.current?.click()} className={pill}>{t('restore.chooseFile')}</button>
        </div>
      </Row>

      {imp.step === 'refused' && (
        <div role="alert" className={panel}>
          <p className="text-sm text-alert-600 dark:text-alert-400">{imp.message}</p>
          <button type="button" onClick={reset} className={pill}>{t('restore.ok')}</button>
        </div>
      )}

      {imp.step === 'preview' && <ImportPreview plan={imp.plan} fileName={imp.fileName} onConfirm={confirmImport} onCancel={reset} />}

      {imp.step === 'done' && <ImportDone plan={imp.plan} onClose={reset} />}
    </>
  );
}

export function ImportPreview({ plan, fileName, onConfirm, onCancel }: { plan: ImportPlan; fileName: string; onConfirm(): void; onCancel(): void }) {
  const t = useT();
  const tc = useCommonT();
  const noop = isNoop(plan);
  return (
    <div className={panel} role="group" aria-label={t('preview.aria')}>
      <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">
        {plan.exportedAt
          ? t('preview.titleExported', { fileName, total: plan.total, when: when(plan.exportedAt) })
          : t('preview.title', { fileName, total: plan.total })}
      </p>
      {plan.restoresWhole && (
        <p className="text-sm text-stone-700 dark:text-stone-200">
          {t('preview.restoresWhole')}
        </p>
      )}
      <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700 dark:text-stone-200">
        <li>
          {plan.addedRange
            ? t('preview.addedRange', { count: plan.added, from: day(plan.addedRange.from), to: day(plan.addedRange.to) })
            : t('preview.added', { count: plan.added })}
        </li>
        {plan.updated > 0 && <li>{t('preview.updated', { count: plan.updated })}</li>}
        {plan.deletions > 0 && <li>{t('preview.deletions', { count: plan.deletions })}</li>}
        {plan.unchanged > 0 && <li>{t('preview.unchanged', { count: plan.unchanged })}</li>}
        {plan.keptNewer > 0 && <li>{t('preview.keptNewer', { count: plan.keptNewer })}</li>}
        {plan.duplicatesInFile > 0 && <li>{t('preview.duplicates', { count: plan.duplicatesInFile })}</li>}
        {plan.invalid > 0 && <li>{t('preview.invalid', { count: plan.invalid })}</li>}
      </ul>
      {plan.exceedsLimit && (
        <p className="text-sm text-alert-600 dark:text-alert-400">
          {t('preview.exceedsLimit', { max: MAX_INCIDENTS })}
        </p>
      )}
      {plan.sample.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{t('preview.sampleHeading')}</p>
          <ul className="mt-1 space-y-0.5 text-sm text-stone-700 dark:text-stone-200">
            {plan.sample.map(e => (
              <li key={e.id}>{t('preview.sampleLine', { when: when(e.ts), source: e.source, behavior: behaviorWord(e.behavior) })}</li>
            ))}
          </ul>
        </div>
      )}
      {noop && <p className="text-sm text-stone-700 dark:text-stone-200">{t('preview.noop')}</p>}
      <div className="flex flex-wrap gap-2">
        {!noop && <button type="button" onClick={onConfirm} className={primary}>{t('preview.import')}</button>}
        <button type="button" autoFocus onClick={onCancel} className={pill}>{noop ? tc('close') : tc('cancel')}</button>
      </div>
    </div>
  );
}

export function ImportDone({ plan, onClose }: { plan: ImportPlan; onClose(): void }) {
  const t = useT();
  const tc = useCommonT();
  const summaryKey =
    plan.updated > 0 && plan.deletions > 0 ? 'done.addedUpdatedDeletions'
    : plan.updated > 0 ? 'done.addedUpdated'
    : plan.deletions > 0 ? 'done.addedDeletions'
    : 'done.added';
  return (
    <div role="status" className={panel}>
      <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">
        {t(summaryKey, { added: plan.added, updated: plan.updated, deletions: plan.deletions })}
      </p>
      {plan.keptNewer > 0 && (
        <p className="text-sm text-stone-700 dark:text-stone-200">{t('done.keptNewer', { count: plan.keptNewer })}</p>
      )}
      {plan.sample.length > 0 && (
        <ul className="space-y-0.5 text-sm text-stone-700 dark:text-stone-200">
          {plan.sample.map(e => <li key={e.id}>{when(e.ts)} · {behaviorWord(e.behavior)}</li>)}
          {plan.added > plan.sample.length && <li>{t('done.andMore', { count: plan.added - plan.sample.length })}</li>}
        </ul>
      )}
      <button type="button" onClick={onClose} className={pill}>{tc('close')}</button>
    </div>
  );
}

// ── Delete synced data ──────────────────────────────────────────────────────

export type WipeState =
  | { step: 'idle' }
  | { step: 'checking' }
  | { step: 'asking'; count: number }
  | { step: 'working'; count: number }
  | { step: 'done'; count: number }
  | { step: 'error'; message: string };


/** `seed` only starts the row in a given step, so a test can render every one; the page never passes it. */
export function DeleteSyncedRow({ seed }: { seed?: WipeState } = {}) {
  const t = useT();
  const tc = useCommonT();
  const [s, setS] = useState<WipeState>(seed ?? { step: 'idle' });

  // Look first, so the confirmation can say exactly how much is about to go.
  const ask = async () => {
    setS({ step: 'checking' });
    const r = await loadRemoteStatus();
    setS(r.ok ? { step: 'asking', count: r.status.live } : { step: 'error', message: describeDeleteFailure(r.status) });
  };

  const proceed = async () => {
    if (s.step !== 'asking') return;
    const count = s.count;
    setS({ step: 'working', count });
    const r = await deleteSyncedData();
    setS(r.ok ? { step: 'done', count } : { step: 'error', message: describeDeleteFailure(r.status) });
  };

  const busy = s.step === 'checking' || s.step === 'working';
  return (
    <>
      <Row
        label={t('wipe.label')}
        description={t('wipe.description')}
      >
        <button type="button" onClick={() => { void ask(); }} disabled={busy || s.step === 'asking'} className={pill}>
          {s.step === 'checking' ? t('wipe.checking') : t('wipe.label')}
        </button>
      </Row>
      {(s.step === 'asking' || s.step === 'working') && (
        <div className={panel} role="group" aria-label={t('wipe.confirmAria')}>
          <p className="text-sm text-alert-600 dark:text-alert-400">
            {s.count > 0 ? t('wipe.confirmSome', { count: s.count }) : t('wipe.confirmNone')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void proceed(); }} disabled={busy} className={danger}>
              {s.step === 'working' ? t('wipe.deleting') : t('wipe.yes')}
            </button>
            <button type="button" autoFocus onClick={() => setS({ step: 'idle' })} disabled={busy} className={pill}>{tc('cancel')}</button>
          </div>
        </div>
      )}
      {s.step === 'done' && (
        <p role="status" className="-mt-3 text-sm text-stone-700 dark:text-stone-200">
          {s.count > 0 ? t('wipe.doneSome', { count: s.count }) : t('wipe.doneNone')}
        </p>
      )}
      {s.step === 'error' && <p role="alert" className="-mt-3 text-sm text-alert-600 dark:text-alert-400">{s.message}</p>}
    </>
  );
}

// ── Delete everything ───────────────────────────────────────────────────────

export type EverythingState =
  | { step: 'idle' }
  | { step: 'asking'; alsoSynced: boolean }
  | { step: 'working' }
  | { step: 'done' }
  | { step: 'error'; message: string };

/** `seed` only starts the row in a given step, so a test can render every one; the page never passes it. */
export function DeleteEverythingRow({ sync, seed }: { sync: boolean; seed?: EverythingState }) {
  const t = useT();
  const tc = useCommonT();
  const [s, setS] = useState<EverythingState>(seed ?? { step: 'idle' });
  const boxId = useId();
  // Whether there may be a synced copy to offer to delete: the feature is on and this browser has used it.
  const mayHaveCopy = sync && isSyncSwitchedOn();

  const proceed = async () => {
    const alsoSynced = s.step === 'asking' && s.alsoSynced;
    setS({ step: 'working' });
    const r = await deleteEverything({ alsoDeleteSynced: alsoSynced, clearLocal: () => useAppStore.getState().clearAllData() });
    setS(r.ok ? { step: 'done' } : { step: 'error', message: describeDeleteFailure(r.status) });
  };

  return (
    <>
      <Row
        label={t('all.label')}
        description={t('all.description')}
      >
        <button type="button" onClick={() => setS({ step: 'asking', alsoSynced: mayHaveCopy })} disabled={s.step === 'asking' || s.step === 'working'} className={`${pill} !text-alert-600 dark:!text-alert-400`}>
          <Trash2 size={14} aria-hidden="true" className="mr-2" />
          {t('all.label')}
        </button>
      </Row>
      {(s.step === 'asking' || s.step === 'working') && (
        <div className={panel} role="group" aria-label={t('all.confirmAria')}>
          <p className="text-sm text-alert-600 dark:text-alert-400">
            {t('all.confirm')}
          </p>
          {sync && (
            <div className="flex items-start gap-3">
              <input
                id={boxId}
                type="checkbox"
                checked={s.step === 'asking' ? s.alsoSynced : false}
                disabled={s.step === 'working'}
                onChange={e => setS({ step: 'asking', alsoSynced: e.target.checked })}
                className="mt-1 h-5 w-5 accent-[oklch(25%_0.05_162)] dark:accent-[oklch(90%_0.2_124)]"
              />
              <label htmlFor={boxId} className="text-sm text-stone-700 dark:text-stone-200">
                {t('all.alsoSynced')}
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void proceed(); }} disabled={s.step === 'working'} className={danger}>
              {s.step === 'working' ? t('all.deleting') : t('all.yes')}
            </button>
            <button type="button" autoFocus onClick={() => setS({ step: 'idle' })} disabled={s.step === 'working'} className={pill}>{tc('cancel')}</button>
          </div>
        </div>
      )}
      {s.step === 'done' && <p role="status" className="-mt-3 text-sm text-stone-700 dark:text-stone-200">{t('all.done')}</p>}
      {s.step === 'error' && <p role="alert" className="-mt-3 text-sm text-alert-600 dark:text-alert-400">{s.message}</p>}
    </>
  );
}
