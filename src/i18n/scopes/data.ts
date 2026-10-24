// Scope "data": Settings: data and backup, account and sync, sync status words, import/export.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/data.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
  // ── Settings > Data: the card ──────────────────────────────────────────────
  'card.title': 'Data',

  // ── Export ─────────────────────────────────────────────────────────────────
  'export.label': 'Export your history',
  'export.description': 'JSON restores everything, including your streak dates. CSV opens in a spreadsheet. Both are saved to your computer; nothing is uploaded.',
  'export.json': 'Export JSON',
  'export.csv': 'Export CSV',
  'export.savedJson': 'Saved {count, plural, one {# event} other {# events}} as a file you can restore from.',
  'export.savedCsv': 'Saved {count, plural, one {# row} other {# rows}} for a spreadsheet.',

  // ── Restore (import) ───────────────────────────────────────────────────────
  'restore.label': 'Restore from a file',
  'restore.description': 'Choose a JSON file you exported before. You see what it would change first. Events you already have are not duplicated, and newer ones here are never overwritten.',
  'restore.fileLabel': 'Choose a history file to restore',
  'restore.chooseFile': 'Choose file',
  'restore.ok': 'OK',

  // The two dates in the preview use the date-fns patterns; the dates themselves come from i18n/format.
  'preview.aria': 'Import preview',
  'preview.title': '{fileName}: {total, plural, one {# entry} other {# entries}}',
  'preview.titleExported': '{fileName}: {total, plural, one {# entry} other {# entries}}, exported {when}',
  'preview.restoresWhole': 'This device has no history yet, so this restores everything from the file, including your streak dates.',
  'preview.added': '{count, plural, one {# new event will be added} other {# new events will be added}}',
  'preview.addedRange': '{count, plural, one {# new event will be added} other {# new events will be added}} ({from} to {to})',
  'preview.updated': '{count, plural, one {# here will be replaced by a newer version from the file} other {# here will be replaced by a newer version from the file}}',
  'preview.deletions': '{count, plural, one {# deletion record from the file will be applied} other {# deletion records from the file will be applied}}',
  'preview.unchanged': '{count, plural, one {# already here and unchanged} other {# already here and unchanged}}',
  'preview.keptNewer': '{count, plural, one {# here are newer than the file’s version and stay as they are} other {# here are newer than the file’s version and stay as they are}}',
  'preview.duplicates': '{count, plural, one {# listed twice in the file (counted once)} other {# listed twice in the file (counted once)}}',
  'preview.invalid': '{count, plural, one {# entry is not valid and will be skipped} other {# entries are not valid and will be skipped}}',
  'preview.exceedsLimit': 'The app keeps the newest {max, number} events, so the oldest ones in this file will be left out.',
  'preview.sampleHeading': 'Newest events being added',
  'preview.sampleLine': '{when} · {source, select, alarm {alarm} other {logged by hand}} · {behavior}',
  'preview.noop': 'There is nothing new in this file. Your history stays exactly as it is.',
  'preview.import': 'Import',

  // The behavior in a sample line: the stored id is shown in lower case words.
  'behavior.nail_biting': 'nail biting',
  'behavior.cuticle_skin_biting': 'cuticle skin biting',
  'behavior.nose_picking': 'nose picking',
  'behavior.eye_area_pulling': 'eye area pulling',
  'behavior.face_skin_picking': 'face skin picking',
  'behavior.hair_pulling': 'hair pulling',

  // ── After importing ────────────────────────────────────────────────────────
  'done.added': 'Done. Added {added, plural, one {# event} other {# events}}.',
  'done.addedUpdated': 'Done. Added {added, plural, one {# event} other {# events}}, updated {updated, number}.',
  'done.addedDeletions': 'Done. Added {added, plural, one {# event} other {# events}}, applied {deletions, plural, one {# deletion} other {# deletions}}.',
  'done.addedUpdatedDeletions': 'Done. Added {added, plural, one {# event} other {# events}}, updated {updated, number}, applied {deletions, plural, one {# deletion} other {# deletions}}.',
  'done.keptNewer': '{count, plural, one {# newer event was kept as they were.} other {# newer events were kept as they were.}}',
  'done.andMore': 'and {count, number} more',

  // ── Why a file was refused (src/backup/importPlan.ts, files.ts) ────────────
  'import.tooBig': 'That file is larger than {mb} MB. A history export is far smaller, so this is probably not one.',
  'import.notJson': 'That file is not valid JSON. Choose a file you exported from Stop Biting.',
  'import.notHistory': 'That file does not look like a Stop Biting history export.',
  'import.tooMany': 'That file has more than {max, number} entries.',
  'import.noEvents': 'That file has no events in it.',
  'import.noneValid': 'None of the entries in that file are valid events.',
  'import.unreadable': 'That file could not be read.',

  // ── Why a delete failed ────────────────────────────────────────────────────
  'failure.network': 'Could not reach the server. Nothing was deleted. Check your connection and try again.',
  'failure.signedOut': 'You are signed out. Sign in again, then try once more.',
  'failure.rateLimited': 'Too many requests. Wait a minute and try again.',
  'failure.server': 'The server could not delete it. Nothing was deleted. Try again in a moment.',

  // ── Delete synced data ─────────────────────────────────────────────────────
  'wipe.label': 'Delete synced data',
  'wipe.description': 'Removes the copy of your history held on your account. History on this device stays, and sync is switched off.',
  'wipe.checking': 'Checking…',
  'wipe.confirmAria': 'Confirm deleting synced data',
  'wipe.confirmSome': 'This permanently deletes {count, plural, one {# synced event} other {# synced events}} from your account. Other devices will stop syncing. It can’t be undone.',
  'wipe.confirmNone': 'This permanently clears the history held on your account. Other devices will stop syncing. It can’t be undone.',
  'wipe.yes': 'Yes, delete synced data',
  'wipe.deleting': 'Deleting…',
  'wipe.doneSome': 'Deleted {count, plural, one {# synced event} other {# synced events}} from your account. Sync is off. History on this device is untouched.',
  'wipe.doneNone': 'Cleared the history held on your account. Sync is off. History on this device is untouched.',

  // ── Delete everything ──────────────────────────────────────────────────────
  'all.label': 'Delete everything',
  'all.description': 'Erases your history, streak, bite reasons and settings on this device.',
  'all.confirmAria': 'Confirm deleting everything',
  'all.confirm': 'This erases your history, streak, bite reasons and every setting on this device. It can’t be undone.',
  'all.alsoSynced': 'Also delete the copy synced to my account. If you leave this off, the copy stays and sync is switched off on this device.',
  'all.yes': 'Yes, delete everything',
  'all.deleting': 'Deleting…',
  'all.done': 'Everything on this device has been erased.',

  // ── Settings > Account & Sync ──────────────────────────────────────────────
  'sync.title': 'Account & Sync',
  'sync.dismiss': 'Dismiss',
  'sync.toggle': 'Sync my history across devices',
  'sync.toggleDescription': 'Your history syncs to your account when this is on. Camera data never leaves your device.',
  'sync.signInToUse': 'Sign in to use sync.',
  'sync.whatSyncs': 'What syncs: for each entry, its time, its type, the bite reason you picked, which hand if known, and whether you finished a competing response. Never video, pictures, face or hand tracking points, or your photo diary. It is off until you turn it on, and you can turn it off or delete the synced copy at any time (see Data).',
  'sync.statusLabel': 'Status',
  'sync.syncNow': 'Sync now',
  'sync.deviceLabel': 'This device',
  'sync.deviceDescription': 'Only you see this name. It stays on this device.',
  'sync.deviceNameLabel': 'Name of this device',

  // ── The default name of this device (src/sync/deviceName.ts) ───────────────
  'device.browserOnOs': '{browser} on {os}',
  'device.app': 'Stop Biting app',
  'device.fallback': 'This device',

  // ── The words for what sync is doing (src/sync/statusText.ts) ──────────────
  'status.syncing': 'Syncing…',
  'status.offline.headline': 'You are offline.',
  'status.offline.detail': 'Everything is saved on this device and will sync when you are back online.',
  'status.offline.detailPending': 'Everything is saved on this device and will sync when you are back online. {pending, plural, one {# change is} other {# changes are}} waiting to be sent.',
  'status.backoff.headline': 'Could not reach the server.',
  'status.backoff.detailAt': 'Your history is safe on this device. Trying again {when}.',
  'status.backoff.detailSoon': 'Your history is safe on this device. Trying again soon.',
  'status.signedOut.headline': 'You have been signed out.',
  'status.signedOut.detail': 'Sign in again to keep syncing. Your history on this device is untouched.',
  'status.unavailable.headline': 'Sync is not available right now.',
  'status.unavailable.detail': 'Your history is safe on this device. It will try again later.',
  'status.rejected.headline': 'The server did not accept some changes.',
  'status.rejected.detail': 'Nothing is lost on this device. Try Sync now.',
  'status.quota.headline': 'Your synced history is full.',
  'status.quota.detail': 'Export a copy from Data below, then delete the synced copy to start fresh.',
  'status.serverReset.headline': 'Synced data was deleted, so sync is off.',
  'status.serverReset.detail': 'Your history on this device is untouched.',
  'status.firstSync': 'Waiting for the first sync.',
  'status.lastSynced': 'Last synced {when}.',
  'status.waiting': '{pending, plural, one {# change is} other {# changes are}} waiting to be sent.',
  'notice.serverReset.headline': 'Your synced data was deleted from another device, so sync is off here.',
  'notice.serverReset.detail': 'Your history on this device is untouched. Turn sync on to upload it again.',
} satisfies Record<string, string>;

export const { t, useT } = createScope('data', messages);
