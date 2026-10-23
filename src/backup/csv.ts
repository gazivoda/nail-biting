// History as a spreadsheet (Settings > Data > Export CSV). Pure functions.
//
// One row per live event. Deleted events are not history and are left out (the
// JSON export keeps them, because it is the file that restores a device).
//
// Cells are escaped per RFC 4180. A cell that a spreadsheet would run as a
// formula (it starts with =, +, - or @, or a tab or carriage return) gets a
// leading apostrophe, because trigger names can be typed by the person (custom
// bite reasons) or arrive from an imported file, and a spreadsheet must not
// execute them.

import type { HabitEventWire } from '../storage/eventModel';

export const CSV_COLUMNS = [
  'id',
  'time',            // ISO 8601, UTC
  'timestamp_ms',
  'source',
  'behavior',
  'hand',
  'triggers',        // separated by "; "
  'confirmed',
  'false_positive',
  'competing_response_done',
  'competing_response_seconds',
  'device_id',
  'updated_at',      // ISO 8601, UTC
] as const;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return '';
  let s = typeof value === 'string' ? value : String(value);
  if (typeof value === 'string' && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const iso = (ms: number) => (Number.isFinite(ms) ? new Date(ms).toISOString() : '');

export function eventsToCsv(events: HabitEventWire[]): string {
  const rows: string[] = [CSV_COLUMNS.join(',')];
  const live = events.filter(e => e.deleted !== true).sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
  for (const e of live) {
    rows.push([
      csvCell(e.id),
      csvCell(iso(e.ts)),
      csvCell(e.ts),
      csvCell(e.source),
      csvCell(e.behavior),
      csvCell(e.hand),
      csvCell(e.triggers?.join('; ')),
      csvCell(e.confirmed),
      csvCell(e.falsePositive),
      csvCell(e.competingResponse?.done),
      csvCell(e.competingResponse?.durationSec),
      csvCell(e.deviceId),
      csvCell(iso(e.updatedAt)),
    ].join(','));
  }
  return rows.join('\r\n') + '\r\n';
}
