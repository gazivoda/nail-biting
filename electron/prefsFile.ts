import { app } from 'electron';
import path from 'path';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { parsePrefs, serializePrefs, type DesktopPrefs } from '../src/desktop/prefs';

/**
 * The desktop preferences, as one plain JSON file in the app's user-data folder
 * (no dependency). Nothing is written until the user changes a setting, so a
 * fresh install has no file and gets the defaults (launch at login off).
 */
function prefsPath(): string {
  return path.join(app.getPath('userData'), 'desktop-prefs.json');
}

export function loadPrefs(): DesktopPrefs {
  try {
    return parsePrefs(readFileSync(prefsPath(), 'utf-8'));
  } catch {
    return parsePrefs(null);
  }
}

/** Writes through a temp file and a rename, so a crash cannot leave half a file. */
export function savePrefs(prefs: DesktopPrefs): boolean {
  try {
    const file = prefsPath();
    mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, serializePrefs(prefs), 'utf-8');
    renameSync(tmp, file);
    return true;
  } catch (err) {
    console.error('[main] could not save desktop preferences:', err);
    return false;
  }
}
