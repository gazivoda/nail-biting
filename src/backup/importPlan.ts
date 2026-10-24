// Reading a history file back in (Settings > Data > Import). Pure functions.
//
// Import is two steps so the person sees what will happen before it does:
//
//   planImport(text, localEvents)   validate the file, compare it with what is
//                                   here, count (nothing is changed)
//   applyImport(plan, facade)       carry out exactly that plan
//
// Rules, in the person's terms:
//  - a record already here (same id) is never duplicated;
//  - a record here that is newer than the file's, or that wins a tie, is never
//    overwritten;
//  - a record the file has and this device lacks is added;
//  - a file record newer than ours replaces ours (that is what restoring a
//    backup onto an older device means);
//  - a file that is malformed is refused whole, a single bad entry is skipped
//    and counted.
//
// Restoring into a device with no history at all uses `replaceAll`, which also
// restores the streak start dates, so the streak and best streak come back
// exactly. Importing into a device that has history merges events only (the
// streak numbers are then worked out from the merged events).

import { compareEventVersions, type HabitEventWire } from '../storage/eventModel';
import { parseWireEvent, type events as EventsFacade, type HabitExport } from '../storage';
import { MAX_INCIDENTS } from '../store/useAppStore';
import { t } from '../i18n/scopes/data';

/** Larger files are refused before they are read. A full export of 5,000 events is about 1.5 MB. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
/** More entries than the app keeps (5,000 events and 1,000 deletion records) by a wide margin. */
export const MAX_IMPORT_ENTRIES = 50_000;

export type ImportRefusal =
  | { ok: false; reason: 'too_big'; message: string }
  | { ok: false; reason: 'not_json'; message: string }
  | { ok: false; reason: 'not_history'; message: string }
  | { ok: false; reason: 'too_many'; message: string }
  | { ok: false; reason: 'nothing_valid'; message: string };

export interface ImportPlan {
  ok: true;
  /** A Stop Biting export file, or a bare list of events. */
  format: 'export' | 'list';
  exportedAt: number | null;
  /** Entries in the file (events and deletion records). */
  total: number;
  /** Entries that are not valid events and will be skipped. */
  invalid: number;
  /** The same event listed twice in the file (the newer listing counts). */
  duplicatesInFile: number;
  /** New events this device does not have. */
  added: number;
  /** Events here that the file has a newer version of. */
  updated: number;
  /** Deletion records in the file that win (events to remove, or removals to remember). */
  deletions: number;
  /** Same version already here. */
  unchanged: number;
  /** Events here that are newer than the file's (kept as they are). */
  keptNewer: number;
  /** True when this device has no history: the import restores it whole, streak dates included. */
  restoresWhole: boolean;
  /** The result would hold more events than the app keeps (the newest MAX_INCIDENTS stay). */
  exceedsLimit: boolean;
  /** Dates of the events that will be added: oldest and newest. */
  addedRange: { from: number; to: number } | null;
  /** A few of the added events, newest first, for the person to recognise. */
  sample: HabitEventWire[];
  /** What will be applied (the winners only). */
  toApply: HabitEventWire[];
  /** The parsed file, when it is an export (used for restoring whole). */
  file: HabitExport | null;
}

const isRecord = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

export function planImport(text: string, local: HabitEventWire[]): ImportPlan | ImportRefusal {
  // text.length counts characters, not bytes; for JSON that is mostly ASCII, so this is a close, cheap guard.
  if (text.length > MAX_IMPORT_BYTES) {
    return { ok: false, reason: 'too_big', message: t('import.tooBig', { mb: Math.round(MAX_IMPORT_BYTES / 1024 / 1024) }) };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not_json', message: t('import.notJson') };
  }

  let format: 'export' | 'list';
  let rawEntries: unknown[];
  let exportedAt: number | null = null;
  let file: HabitExport | null = null;
  if (Array.isArray(data)) {
    format = 'list';
    rawEntries = data;
  } else if (isRecord(data) && data.format === 'stop-biting-events' && Array.isArray(data.events)) {
    format = 'export';
    rawEntries = [...data.events, ...(Array.isArray(data.tombstones) ? data.tombstones : [])];
    if (typeof data.exportedAt === 'number') exportedAt = data.exportedAt;
    file = data as unknown as HabitExport;
  } else {
    return { ok: false, reason: 'not_history', message: t('import.notHistory') };
  }
  if (rawEntries.length > MAX_IMPORT_ENTRIES) {
    return { ok: false, reason: 'too_many', message: t('import.tooMany', { max: MAX_IMPORT_ENTRIES }) };
  }

  // Validate each entry; fold duplicate ids to the winning version.
  const winners = new Map<string, HabitEventWire>();
  let invalid = 0;
  let duplicatesInFile = 0;
  for (const raw of rawEntries) {
    const e = parseWireEvent(raw);
    if (!e) { invalid++; continue; }
    const seen = winners.get(e.id);
    if (seen) {
      duplicatesInFile++;
      if (compareEventVersions(e, seen) > 0) winners.set(e.id, e);
    } else {
      winners.set(e.id, e);
    }
  }
  if (winners.size === 0) {
    return { ok: false, reason: 'nothing_valid', message: rawEntries.length === 0 ? t('import.noEvents') : t('import.noneValid') };
  }

  const here = new Map(local.map(e => [e.id, e]));
  const toApply: HabitEventWire[] = [];
  const addedEvents: HabitEventWire[] = [];
  let updated = 0;
  let deletions = 0;
  let unchanged = 0;
  let keptNewer = 0;
  for (const e of winners.values()) {
    const mine = here.get(e.id);
    if (!mine) {
      toApply.push(e);
      if (e.deleted) deletions++;
      else addedEvents.push(e);
      continue;
    }
    const cmp = compareEventVersions(e, mine);
    if (cmp === 0) unchanged++;
    else if (cmp < 0) keptNewer++;
    else {
      toApply.push(e);
      if (e.deleted) deletions++;
      else updated++;
    }
  }

  addedEvents.sort((a, b) => b.ts - a.ts);
  return {
    ok: true,
    format,
    exportedAt,
    total: rawEntries.length,
    invalid,
    duplicatesInFile,
    added: addedEvents.length,
    updated,
    deletions,
    unchanged,
    keptNewer,
    restoresWhole: format === 'export' && local.length === 0,
    exceedsLimit: local.filter(e => !e.deleted).length + addedEvents.length > MAX_INCIDENTS,
    addedRange: addedEvents.length > 0 ? { from: addedEvents[addedEvents.length - 1].ts, to: addedEvents[0].ts } : null,
    sample: addedEvents.slice(0, 5),
    toApply,
    file,
  };
}

/** True when there is nothing to do: the file adds and changes nothing. */
export function isNoop(plan: ImportPlan): boolean {
  return plan.toApply.length === 0 && !plan.restoresWhole;
}

export type ImportFacade = Pick<typeof EventsFacade, 'merge' | 'replaceAll'>;

/** Carries out the plan through the storage facade. Returns what the facade reports. */
export function applyImport(plan: ImportPlan, facade: ImportFacade): { applied: number; skipped: number } {
  if (plan.restoresWhole && plan.file) {
    const r = facade.replaceAll(plan.file);
    return { applied: r.imported, skipped: r.skipped };
  }
  const r = facade.merge(plan.toApply);
  return { applied: r.applied, skipped: r.skipped };
}
