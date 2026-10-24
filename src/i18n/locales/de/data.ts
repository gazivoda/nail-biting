// NEEDS NATIVE REVIEW (machine draft). Scope "data", locale de.
import type { messages as en } from '../../scopes/data';

export const messages: Record<keyof typeof en, string> = {
  // ── Einstellungen > Daten: die Karte ───────────────────────────────────────
  'card.title': 'Daten',

  // ── Exportieren ────────────────────────────────────────────────────────────
  'export.label': 'Verlauf exportieren',
  'export.description': 'JSON stellt alles wieder her, auch die Daten deiner Serie. CSV öffnest du in einer Tabellenkalkulation. Beide werden auf deinem Computer gespeichert; es wird nichts hochgeladen.',
  'export.json': 'JSON exportieren',
  'export.csv': 'CSV exportieren',
  'export.savedJson': '{count, plural, one {# Ereignis wurde} other {# Ereignisse wurden}} als Datei gespeichert, aus der du wiederherstellen kannst.',
  'export.savedCsv': '{count, plural, one {# Zeile wurde} other {# Zeilen wurden}} für eine Tabellenkalkulation gespeichert.',

  // ── Wiederherstellen (Import) ──────────────────────────────────────────────
  'restore.label': 'Aus Datei wiederherstellen',
  'restore.description': 'Wähle eine JSON-Datei, die du zuvor exportiert hast. Du siehst zuerst, was sich ändern würde. Ereignisse, die du schon hast, werden nicht doppelt angelegt, und neuere hier werden nie überschrieben.',
  'restore.fileLabel': 'Wähle eine Verlaufsdatei zum Wiederherstellen',
  'restore.chooseFile': 'Datei wählen',
  'restore.ok': 'OK',

  'preview.aria': 'Importvorschau',
  'preview.title': '{fileName}: {total, plural, one {# Eintrag} other {# Einträge}}',
  'preview.titleExported': '{fileName}: {total, plural, one {# Eintrag} other {# Einträge}}, exportiert am {when}',
  'preview.restoresWhole': 'Dieses Gerät hat noch keinen Verlauf, daher wird alles aus der Datei wiederhergestellt, auch die Daten deiner Serie.',
  'preview.added': '{count, plural, one {# neues Ereignis wird hinzugefügt} other {# neue Ereignisse werden hinzugefügt}}',
  'preview.addedRange': '{count, plural, one {# neues Ereignis wird hinzugefügt} other {# neue Ereignisse werden hinzugefügt}} ({from} bis {to})',
  'preview.updated': '{count, plural, one {# vorhandenes Ereignis wird durch eine neuere Version aus der Datei ersetzt} other {# vorhandene Ereignisse werden durch eine neuere Version aus der Datei ersetzt}}',
  'preview.deletions': '{count, plural, one {# Löschvermerk aus der Datei wird angewendet} other {# Löschvermerke aus der Datei werden angewendet}}',
  'preview.unchanged': '{count, plural, one {# ist schon vorhanden und unverändert} other {# sind schon vorhanden und unverändert}}',
  'preview.keptNewer': '{count, plural, one {# vorhandenes Ereignis ist neuer als die Version in der Datei und bleibt unverändert} other {# vorhandene Ereignisse sind neuer als die Version in der Datei und bleiben unverändert}}',
  'preview.duplicates': '{count, plural, one {# kommt zweimal in der Datei vor (wird einmal gezählt)} other {# kommen zweimal in der Datei vor (werden einmal gezählt)}}',
  'preview.invalid': '{count, plural, one {# Eintrag ist ungültig und wird übersprungen} other {# Einträge sind ungültig und werden übersprungen}}',
  'preview.exceedsLimit': 'Die App behält die neuesten {max, number} Ereignisse, deshalb werden die ältesten in dieser Datei weggelassen.',
  'preview.sampleHeading': 'Neueste Ereignisse, die hinzugefügt werden',
  'preview.sampleLine': '{when} · {source, select, alarm {Alarm} other {von Hand erfasst}} · {behavior}',
  'preview.noop': 'In dieser Datei ist nichts Neues. Dein Verlauf bleibt genau so, wie er ist.',
  'preview.import': 'Importieren',

  'behavior.nail_biting': 'Nägelkauen',
  'behavior.cuticle_skin_biting': 'Kauen an Nagelhaut und Haut',
  'behavior.nose_picking': 'Nasebohren',
  'behavior.eye_area_pulling': 'Ausreißen von Wimpern und Augenbrauen',
  'behavior.face_skin_picking': 'Kratzen an der Gesichtshaut',
  'behavior.hair_pulling': 'Haareausreißen',

  // ── Nach dem Import ────────────────────────────────────────────────────────
  'done.added': 'Fertig. Hinzugefügt: {added, plural, one {# Ereignis} other {# Ereignisse}}.',
  'done.addedUpdated': 'Fertig. Hinzugefügt: {added, plural, one {# Ereignis} other {# Ereignisse}}, aktualisiert: {updated, number}.',
  'done.addedDeletions': 'Fertig. Hinzugefügt: {added, plural, one {# Ereignis} other {# Ereignisse}}, angewendet: {deletions, plural, one {# Löschung} other {# Löschungen}}.',
  'done.addedUpdatedDeletions': 'Fertig. Hinzugefügt: {added, plural, one {# Ereignis} other {# Ereignisse}}, aktualisiert: {updated, number}, angewendet: {deletions, plural, one {# Löschung} other {# Löschungen}}.',
  'done.keptNewer': '{count, plural, one {# neueres Ereignis wurde unverändert beibehalten.} other {# neuere Ereignisse wurden unverändert beibehalten.}}',
  'done.andMore': 'und {count, number} weitere',

  // ── Warum eine Datei abgelehnt wurde ───────────────────────────────────────
  'import.tooBig': 'Diese Datei ist größer als {mb} MB. Ein Verlaufsexport ist viel kleiner, daher ist das wahrscheinlich keiner.',
  'import.notJson': 'Diese Datei ist kein gültiges JSON. Wähle eine Datei, die du aus Stop Biting exportiert hast.',
  'import.notHistory': 'Diese Datei sieht nicht wie ein Verlaufsexport von Stop Biting aus.',
  'import.tooMany': 'Diese Datei enthält mehr als {max, number} Einträge.',
  'import.noEvents': 'In dieser Datei sind keine Ereignisse.',
  'import.noneValid': 'Keiner der Einträge in dieser Datei ist ein gültiges Ereignis.',
  'import.unreadable': 'Diese Datei konnte nicht gelesen werden.',

  // ── Warum ein Löschen fehlgeschlagen ist ───────────────────────────────────
  'failure.network': 'Der Server konnte nicht erreicht werden. Es wurde nichts gelöscht. Prüfe deine Verbindung und versuche es erneut.',
  'failure.signedOut': 'Du bist abgemeldet. Melde dich erneut an und versuche es noch einmal.',
  'failure.rateLimited': 'Zu viele Anfragen. Warte eine Minute und versuche es erneut.',
  'failure.server': 'Der Server konnte es nicht löschen. Es wurde nichts gelöscht. Versuche es gleich noch einmal.',

  // ── Synchronisierte Daten löschen ──────────────────────────────────────────
  'wipe.label': 'Synchronisierte Daten löschen',
  'wipe.description': 'Entfernt die Kopie deines Verlaufs, die in deinem Konto liegt. Der Verlauf auf diesem Gerät bleibt, und die Synchronisierung wird ausgeschaltet.',
  'wipe.checking': 'Wird geprüft…',
  'wipe.confirmAria': 'Löschen der synchronisierten Daten bestätigen',
  'wipe.confirmSome': 'Dadurch werden {count, plural, one {# synchronisiertes Ereignis} other {# synchronisierte Ereignisse}} endgültig aus deinem Konto gelöscht. Andere Geräte synchronisieren dann nicht mehr. Das lässt sich nicht rückgängig machen.',
  'wipe.confirmNone': 'Dadurch wird der in deinem Konto gespeicherte Verlauf endgültig geleert. Andere Geräte synchronisieren dann nicht mehr. Das lässt sich nicht rückgängig machen.',
  'wipe.yes': 'Ja, synchronisierte Daten löschen',
  'wipe.deleting': 'Wird gelöscht…',
  'wipe.doneSome': '{count, plural, one {# synchronisiertes Ereignis wurde} other {# synchronisierte Ereignisse wurden}} aus deinem Konto gelöscht. Die Synchronisierung ist aus. Der Verlauf auf diesem Gerät ist unberührt.',
  'wipe.doneNone': 'Der in deinem Konto gespeicherte Verlauf wurde geleert. Die Synchronisierung ist aus. Der Verlauf auf diesem Gerät ist unberührt.',

  // ── Alles löschen ──────────────────────────────────────────────────────────
  'all.label': 'Alles löschen',
  'all.description': 'Löscht deinen Verlauf, deine Serie, die Gründe für deine Bisse und deine Einstellungen auf diesem Gerät.',
  'all.confirmAria': 'Löschen von allem bestätigen',
  'all.confirm': 'Dadurch werden dein Verlauf, deine Serie, die Gründe für deine Bisse und alle Einstellungen auf diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.',
  'all.alsoSynced': 'Auch die mit meinem Konto synchronisierte Kopie löschen. Wenn du das ausgeschaltet lässt, bleibt die Kopie bestehen, und die Synchronisierung wird auf diesem Gerät ausgeschaltet.',
  'all.yes': 'Ja, alles löschen',
  'all.deleting': 'Wird gelöscht…',
  'all.done': 'Alles auf diesem Gerät wurde gelöscht.',

  // ── Einstellungen > Konto und Synchronisierung ─────────────────────────────
  'sync.title': 'Konto und Synchronisierung',
  'sync.dismiss': 'Ausblenden',
  'sync.toggle': 'Meinen Verlauf geräteübergreifend synchronisieren',
  'sync.toggleDescription': 'Dein Verlauf wird mit deinem Konto synchronisiert, wenn das eingeschaltet ist. Kameradaten verlassen dein Gerät nie.',
  'sync.signInToUse': 'Melde dich an, um die Synchronisierung zu nutzen.',
  'sync.whatSyncs': 'Was synchronisiert wird: pro Eintrag der Zeitpunkt, die Art, der gewählte Grund für den Biss, die Hand (falls bekannt) und ob du eine konkurrierende Reaktion abgeschlossen hast. Nie Video, Bilder, Gesichts- oder Handtracking-Punkte oder dein Foto-Tagebuch. Es ist ausgeschaltet, bis du es einschaltest, und du kannst es jederzeit ausschalten oder die synchronisierte Kopie löschen (siehe Daten).',
  'sync.statusLabel': 'Status',
  'sync.syncNow': 'Jetzt synchronisieren',
  'sync.deviceLabel': 'Dieses Gerät',
  'sync.deviceDescription': 'Nur du siehst diesen Namen. Er bleibt auf diesem Gerät.',
  'sync.deviceNameLabel': 'Name dieses Geräts',

  // ── Der vorgegebene Name dieses Geräts ─────────────────────────────────────
  'device.browserOnOs': '{browser} auf {os}',
  'device.app': 'Stop-Biting-App',
  'device.fallback': 'Dieses Gerät',

  // ── Die Worte dafür, was die Synchronisierung gerade tut ───────────────────
  'status.syncing': 'Synchronisierung läuft…',
  'status.offline.headline': 'Du bist offline.',
  'status.offline.detail': 'Alles ist auf diesem Gerät gespeichert und wird synchronisiert, sobald du wieder online bist.',
  'status.offline.detailPending': 'Alles ist auf diesem Gerät gespeichert und wird synchronisiert, sobald du wieder online bist. {pending, plural, one {# Änderung wartet} other {# Änderungen warten}} auf das Senden.',
  'status.backoff.headline': 'Der Server konnte nicht erreicht werden.',
  'status.backoff.detailAt': 'Dein Verlauf ist auf diesem Gerät sicher. Neuer Versuch {when}.',
  'status.backoff.detailSoon': 'Dein Verlauf ist auf diesem Gerät sicher. Neuer Versuch in Kürze.',
  'status.signedOut.headline': 'Du wurdest abgemeldet.',
  'status.signedOut.detail': 'Melde dich erneut an, um weiter zu synchronisieren. Dein Verlauf auf diesem Gerät ist unberührt.',
  'status.unavailable.headline': 'Die Synchronisierung ist gerade nicht verfügbar.',
  'status.unavailable.detail': 'Dein Verlauf ist auf diesem Gerät sicher. Es wird später erneut versucht.',
  'status.rejected.headline': 'Der Server hat einige Änderungen nicht akzeptiert.',
  'status.rejected.detail': 'Auf diesem Gerät geht nichts verloren. Versuche „Jetzt synchronisieren“.',
  'status.quota.headline': 'Dein synchronisierter Verlauf ist voll.',
  'status.quota.detail': 'Exportiere unten unter „Daten“ eine Kopie und lösche dann die synchronisierte Kopie, um neu zu beginnen.',
  'status.serverReset.headline': 'Die synchronisierten Daten wurden gelöscht, deshalb ist die Synchronisierung ausgeschaltet.',
  'status.serverReset.detail': 'Dein Verlauf auf diesem Gerät ist unberührt.',
  'status.firstSync': 'Warten auf die erste Synchronisierung.',
  'status.lastSynced': 'Zuletzt synchronisiert {when}.',
  'status.waiting': '{pending, plural, one {# Änderung wartet} other {# Änderungen warten}} auf das Senden.',
  'notice.serverReset.headline': 'Deine synchronisierten Daten wurden auf einem anderen Gerät gelöscht, deshalb ist die Synchronisierung hier ausgeschaltet.',
  'notice.serverReset.detail': 'Dein Verlauf auf diesem Gerät ist unberührt. Schalte die Synchronisierung ein, um ihn erneut hochzuladen.',
};
