// The browser side of export and import: saving a text file, reading one the
// person chose. The only DOM code in src/backup. Nothing here touches the
// network or storage.

import { MAX_IMPORT_BYTES } from './importPlan';
import { t } from '../i18n/scopes/data';

/** `stop-biting-history-2026-10-23.json` */
export function exportFileName(kind: 'json' | 'csv', now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return `stop-biting-history-${day}.${kind}`;
}

/** Hands `text` to the browser as a file download. */
export function downloadTextFile(fileName: string, mime: string, text: string, bom = false): void {
  const blob = new Blob([bom ? '﻿' : '', text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type ReadResult =
  | { ok: true; text: string }
  | { ok: false; message: string };

/** Reads a chosen file as text, refusing anything over the size limit BEFORE reading it. */
export async function readChosenFile(file: File): Promise<ReadResult> {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, message: t('import.tooBig', { mb: Math.round(MAX_IMPORT_BYTES / 1024 / 1024) }) };
  }
  try {
    return { ok: true, text: await file.text() };
  } catch {
    return { ok: false, message: t('import.unreadable') };
  }
}
