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
import { format } from 'date-fns';
import { Database, Trash2 } from 'lucide-react';
import { Row, Section } from './ui';
import { useFeatures } from '../../features/useFeature';
import { events } from '../../storage';
import { useAppStore } from '../../store/useAppStore';
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

const nice = (n: number) => n.toLocaleString('en');
const when = (ms: number) => format(ms, 'PP p');
const behaviorWord = (b: string) => b.replace(/_/g, ' ');

// ── The card ────────────────────────────────────────────────────────────────

export function DataCard({ backup, sync }: { backup: boolean; sync: boolean }) {
  return (
    <Section title="Data" icon={Database} fullWidth>
      {backup && <BackupRows />}
      {sync && <DeleteSyncedRow />}
      <DeleteEverythingRow sync={sync} />
    </Section>
  );
}

// ── Export and restore ──────────────────────────────────────────────────────

type ImportState =
  | { step: 'idle' }
  | { step: 'preview'; plan: ImportPlan; fileName: string }
  | { step: 'refused'; message: string }
  | { step: 'done'; plan: ImportPlan };

function BackupRows() {
  const [exported, setExported] = useState<string | null>(null);
  const [imp, setImp] = useState<ImportState>({ step: 'idle' });
  const fileInput = useRef<HTMLInputElement>(null);
  const fileId = useId();

  const exportJson = () => {
    const data = events.exportAll();
    downloadTextFile(exportFileName('json'), 'application/json', JSON.stringify(data, null, 2));
    setExported(`Saved ${nice(data.events.length)} ${data.events.length === 1 ? 'event' : 'events'} as a file you can restore from.`);
  };

  const exportCsv = () => {
    const list = events.list();
    downloadTextFile(exportFileName('csv'), 'text/csv', eventsToCsv(list), true);
    setExported(`Saved ${nice(list.length)} ${list.length === 1 ? 'row' : 'rows'} for a spreadsheet.`);
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
        label="Export your history"
        description="JSON restores everything, including your streak dates. CSV opens in a spreadsheet. Both are saved to your computer; nothing is uploaded."
      >
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportJson} className={pill}>Export JSON</button>
          <button type="button" onClick={exportCsv} className={pill}>Export CSV</button>
        </div>
      </Row>
      {exported && <p role="status" className="-mt-3 text-sm text-stone-700 dark:text-stone-200">{exported}</p>}

      <Row
        label="Restore from a file"
        description="Choose a JSON file you exported before. You see what it would change first. Events you already have are not duplicated, and newer ones here are never overwritten."
      >
        <div>
          <label htmlFor={fileId} className="sr-only">Choose a history file to restore</label>
          <input
            ref={fileInput}
            id={fileId}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={e => { void onFile(e.target.files?.[0]); }}
          />
          <button type="button" onClick={() => fileInput.current?.click()} className={pill}>Choose file</button>
        </div>
      </Row>

      {imp.step === 'refused' && (
        <div role="alert" className={panel}>
          <p className="text-sm text-alert-600 dark:text-alert-400">{imp.message}</p>
          <button type="button" onClick={reset} className={pill}>OK</button>
        </div>
      )}

      {imp.step === 'preview' && <ImportPreview plan={imp.plan} fileName={imp.fileName} onConfirm={confirmImport} onCancel={reset} />}

      {imp.step === 'done' && <ImportDone plan={imp.plan} onClose={reset} />}
    </>
  );
}

function ImportPreview({ plan, fileName, onConfirm, onCancel }: { plan: ImportPlan; fileName: string; onConfirm(): void; onCancel(): void }) {
  const noop = isNoop(plan);
  return (
    <div className={panel} role="group" aria-label="Import preview">
      <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">
        {fileName}: {nice(plan.total)} {plan.total === 1 ? 'entry' : 'entries'}
        {plan.exportedAt ? `, exported ${when(plan.exportedAt)}` : ''}
      </p>
      {plan.restoresWhole && (
        <p className="text-sm text-stone-700 dark:text-stone-200">
          This device has no history yet, so this restores everything from the file, including your streak dates.
        </p>
      )}
      <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700 dark:text-stone-200">
        <li>
          {nice(plan.added)} new {plan.added === 1 ? 'event' : 'events'} will be added
          {plan.addedRange ? ` (${format(plan.addedRange.from, 'PP')} to ${format(plan.addedRange.to, 'PP')})` : ''}
        </li>
        {plan.updated > 0 && <li>{nice(plan.updated)} here will be replaced by a newer version from the file</li>}
        {plan.deletions > 0 && <li>{nice(plan.deletions)} deletion {plan.deletions === 1 ? 'record' : 'records'} from the file will be applied</li>}
        {plan.unchanged > 0 && <li>{nice(plan.unchanged)} already here and unchanged</li>}
        {plan.keptNewer > 0 && <li>{nice(plan.keptNewer)} here are newer than the file’s version and stay as they are</li>}
        {plan.duplicatesInFile > 0 && <li>{nice(plan.duplicatesInFile)} listed twice in the file (counted once)</li>}
        {plan.invalid > 0 && <li>{nice(plan.invalid)} {plan.invalid === 1 ? 'entry is' : 'entries are'} not valid and will be skipped</li>}
      </ul>
      {plan.exceedsLimit && (
        <p className="text-sm text-alert-600 dark:text-alert-400">
          The app keeps the newest 5,000 events, so the oldest ones in this file will be left out.
        </p>
      )}
      {plan.sample.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">Newest events being added</p>
          <ul className="mt-1 space-y-0.5 text-sm text-stone-700 dark:text-stone-200">
            {plan.sample.map(e => (
              <li key={e.id}>{when(e.ts)} · {e.source === 'alarm' ? 'alarm' : 'logged by hand'} · {behaviorWord(e.behavior)}</li>
            ))}
          </ul>
        </div>
      )}
      {noop && <p className="text-sm text-stone-700 dark:text-stone-200">There is nothing new in this file. Your history stays exactly as it is.</p>}
      <div className="flex flex-wrap gap-2">
        {!noop && <button type="button" onClick={onConfirm} className={primary}>Import</button>}
        <button type="button" autoFocus onClick={onCancel} className={pill}>{noop ? 'Close' : 'Cancel'}</button>
      </div>
    </div>
  );
}

function ImportDone({ plan, onClose }: { plan: ImportPlan; onClose(): void }) {
  return (
    <div role="status" className={panel}>
      <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">
        Done. Added {nice(plan.added)} {plan.added === 1 ? 'event' : 'events'}
        {plan.updated > 0 ? `, updated ${nice(plan.updated)}` : ''}
        {plan.deletions > 0 ? `, applied ${nice(plan.deletions)} ${plan.deletions === 1 ? 'deletion' : 'deletions'}` : ''}.
      </p>
      {plan.keptNewer > 0 && (
        <p className="text-sm text-stone-700 dark:text-stone-200">{nice(plan.keptNewer)} newer {plan.keptNewer === 1 ? 'event was' : 'events were'} kept as they were.</p>
      )}
      {plan.sample.length > 0 && (
        <ul className="space-y-0.5 text-sm text-stone-700 dark:text-stone-200">
          {plan.sample.map(e => <li key={e.id}>{when(e.ts)} · {behaviorWord(e.behavior)}</li>)}
          {plan.added > plan.sample.length && <li>and {nice(plan.added - plan.sample.length)} more</li>}
        </ul>
      )}
      <button type="button" onClick={onClose} className={pill}>Close</button>
    </div>
  );
}

// ── Delete synced data ──────────────────────────────────────────────────────

type WipeState =
  | { step: 'idle' }
  | { step: 'asking'; count: number | null }
  | { step: 'working' }
  | { step: 'done'; deleted: number }
  | { step: 'error'; message: string };

const failure = (status: number) =>
  status === 0 ? 'Could not reach the server. Nothing was deleted. Check your connection and try again.'
  : status === 401 ? 'You are signed out. Sign in again, then try once more.'
  : status === 429 ? 'Too many requests. Wait a minute and try again.'
  : 'The server could not delete it. Nothing was deleted. Try again in a moment.';

function DeleteSyncedRow() {
  const [s, setS] = useState<WipeState>({ step: 'idle' });

  const ask = async () => {
    setS({ step: 'asking', count: null });
    const r = await loadRemoteStatus();
    setS({ step: 'asking', count: r.ok ? r.status.live : null });
  };

  const proceed = async () => {
    setS({ step: 'working' });
    const r = await deleteSyncedData();
    setS(r.ok ? { step: 'done', deleted: r.deleted } : { step: 'error', message: failure(r.status) });
  };

  return (
    <>
      <Row
        label="Delete synced data"
        description="Removes the copy of your history held on your account. History on this device stays, and sync is switched off."
      >
        <button type="button" onClick={() => { void ask(); }} disabled={s.step === 'asking' || s.step === 'working'} className={pill}>
          Delete synced data
        </button>
      </Row>
      {(s.step === 'asking' || s.step === 'working') && (
        <div className={panel} role="group" aria-label="Confirm deleting synced data">
          <p className="text-sm text-alert-600 dark:text-alert-400">
            {s.step === 'asking' && s.count !== null
              ? `This permanently deletes ${nice(s.count)} synced ${s.count === 1 ? 'event' : 'events'} from your account.`
              : 'This permanently deletes the history held on your account.'}
            {' '}Other devices will stop syncing. It can’t be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void proceed(); }} disabled={s.step === 'working'} className={danger}>
              {s.step === 'working' ? 'Deleting…' : 'Yes, delete synced data'}
            </button>
            <button type="button" autoFocus onClick={() => setS({ step: 'idle' })} disabled={s.step === 'working'} className={pill}>Cancel</button>
          </div>
        </div>
      )}
      {s.step === 'done' && (
        <p role="status" className="-mt-3 text-sm text-stone-700 dark:text-stone-200">
          Deleted {nice(s.deleted)} synced {s.deleted === 1 ? 'event' : 'events'} from your account. Sync is off. History on this device is untouched.
        </p>
      )}
      {s.step === 'error' && <p role="alert" className="-mt-3 text-sm text-alert-600 dark:text-alert-400">{s.message}</p>}
    </>
  );
}

// ── Delete everything ───────────────────────────────────────────────────────

type EverythingState =
  | { step: 'idle' }
  | { step: 'asking'; alsoSynced: boolean }
  | { step: 'working' }
  | { step: 'done' }
  | { step: 'error'; message: string };

function DeleteEverythingRow({ sync }: { sync: boolean }) {
  const [s, setS] = useState<EverythingState>({ step: 'idle' });
  const boxId = useId();
  // Whether there may be a synced copy to offer to delete: the feature is on and this browser has used it.
  const mayHaveCopy = sync && isSyncSwitchedOn();

  const proceed = async () => {
    const alsoSynced = s.step === 'asking' && s.alsoSynced;
    setS({ step: 'working' });
    const r = await deleteEverything({ alsoDeleteSynced: alsoSynced, clearLocal: () => useAppStore.getState().clearAllData() });
    setS(r.ok ? { step: 'done' } : { step: 'error', message: failure(r.status) });
  };

  return (
    <>
      <Row
        label="Delete everything"
        description="Erases your history, streak, bite reasons and settings on this device."
      >
        <button type="button" onClick={() => setS({ step: 'asking', alsoSynced: mayHaveCopy })} disabled={s.step === 'asking' || s.step === 'working'} className={`${pill} !text-alert-600 dark:!text-alert-400`}>
          <Trash2 size={14} aria-hidden="true" className="mr-2" />
          Delete everything
        </button>
      </Row>
      {(s.step === 'asking' || s.step === 'working') && (
        <div className={panel} role="group" aria-label="Confirm deleting everything">
          <p className="text-sm text-alert-600 dark:text-alert-400">
            This erases your history, streak, bite reasons and every setting on this device. It can’t be undone.
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
                Also delete the copy synced to my account. If you leave this off, the copy stays and sync is switched off on this device.
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void proceed(); }} disabled={s.step === 'working'} className={danger}>
              {s.step === 'working' ? 'Deleting…' : 'Yes, delete everything'}
            </button>
            <button type="button" autoFocus onClick={() => setS({ step: 'idle' })} disabled={s.step === 'working'} className={pill}>Cancel</button>
          </div>
        </div>
      )}
      {s.step === 'done' && <p role="status" className="-mt-3 text-sm text-stone-700 dark:text-stone-200">Everything on this device has been erased.</p>}
      {s.step === 'error' && <p role="alert" className="-mt-3 text-sm text-alert-600 dark:text-alert-400">{s.message}</p>}
    </>
  );
}
