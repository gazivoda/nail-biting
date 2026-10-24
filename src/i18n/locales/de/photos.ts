// NEEDS NATIVE REVIEW (machine draft). Scope "photos", locale de.
import type { messages as en } from '../../scopes/photos';

export const messages: Record<keyof typeof en, string> = {
  // ── The diary screen ────────────────────────────────────────────────────────
  'diary.title': 'Foto-Tagebuch',
  'diary.intro': 'Mach einmal pro Woche ein Foto von deinen Händen. Mit der Zeit kannst du zwei Fotos nebeneinanderlegen und selbst sehen, wie deine Nägel jetzt im Vergleich zu früher aussehen.',
  'diary.privacy.statement': 'Die Fotos bleiben auf diesem Gerät. Sie werden nur in diesem Browser gespeichert und nie hochgeladen, synchronisiert, exportiert oder per E-Mail verschickt.',
  'diary.privacy.detail': 'Sie sind nicht Teil von Export, Synchronisierung oder der wöchentlichen E-Mail. Wenn du die Websitedaten löschst, den Browser wechselst oder ein privates Fenster schließt, werden sie entfernt.',
  'diary.notSaved': 'Dieser Browser speichert Fotos gerade nicht auf der Festplatte, sie sind also weg, sobald du diesen Tab schließt.',
  'diary.notMedical': 'Ein Foto-Tagebuch ist eine Möglichkeit zurückzublicken, keine Diagnose und keine Behandlung.',
  'diary.takeFirst': 'Mach dein erstes Foto',
  'diary.takeThisWeek': 'Mach das Foto dieser Woche',
  'diary.due': 'Dein letztes Foto wurde {age} aufgenommen. Ein neues ist fällig.',
  'diary.cannotDecode': 'Dieser Browser kann gespeicherte Fotos nicht anzeigen. Aktualisiere ihn oder öffne das Tagebuch in einem aktuellen Chrome, Edge, Firefox oder Safari.',
  'diary.loading': 'Deine Fotos werden von diesem Gerät gelesen',
  'diary.count': 'Deine Fotos ({count})',
  'diary.size': '{size} auf diesem Gerät',
  'diary.photoLabel': 'Foto vom {date}',
  'diary.keep': 'Behalten',
  'diary.deleteOne.aria': 'Das Foto vom {date} löschen',
  'diary.deleteOne.question': 'Dieses Foto löschen?',
  'diary.compareHeading': 'Vorher und nachher',
  'diary.deleteNote': 'Beim Löschen wird ein Foto endgültig aus diesem Browser entfernt.',
  'diary.deleteAll': 'Alle Fotos löschen',
  'diary.deleteAll.question': '{count, plural, one {Das Foto löschen?} other {Alle # Fotos löschen?}}',
  'diary.deleteAll.confirm': 'Alle löschen',
  'diary.deleteAll.keep': 'Fotos behalten',

  'status.saved': 'Foto auf diesem Gerät gespeichert.',
  'status.savedTabOnly': 'Foto nur für diesen Tab behalten. Dieser Browser speichert es nicht auf der Festplatte.',
  'status.deleted': 'Foto gelöscht.',
  'status.deletedAll': 'Alle {count} Fotos gelöscht.',

  // ── Before / after ──────────────────────────────────────────────────────────
  'compare.needTwo': 'Zum Vergleichen brauchst du zwei Fotos. Mach nächste Woche ein weiteres, dann kannst du es hier über das heutige legen.',
  'compare.before': 'Vorher',
  'compare.after': 'Nachher',
  'compare.same': 'Beide Seiten zeigen dasselbe Foto. Wähle zwei verschiedene Daten, um einen Unterschied zu sehen.',
  'compare.photoBefore': 'Foto vom {date} (vorher)',
  'compare.photoAfter': 'Foto vom {date} (nachher)',
  'compare.badgeBefore': 'Vorher, {date}',
  'compare.badgeAfter': 'Nachher, {date}',
  'compare.sliderLabel': 'Das frühere Foto einblenden',
  'compare.sliderValue': 'Das frühere Foto ist auf {percent} Prozent des Bildes zu sehen',
  'compare.hint': 'Ziehe am Bild oder am Schieberegler, um zwischen den beiden zu wechseln.',

  // ── Taking a photo ──────────────────────────────────────────────────────────
  'capture.title': 'Mach ein Foto von deinen Händen',
  'capture.idle': 'Die Kamera ist nur geöffnet, solange dieser Bildschirm offen ist, und schaltet sich ab, sobald das Foto gemacht ist.',
  'capture.start': 'Kamera starten',
  'capture.opening': 'Kamera wird geöffnet. Dein Browser fragt dich eventuell nach der Erlaubnis.',
  'capture.photoLabel': 'Das Foto, das du gerade gemacht hast',
  'capture.reviewNote': 'Die Kamera ist aus. Speichere dieses Foto in deinem Tagebuch auf diesem Gerät oder mach es noch einmal.',
  'capture.saving': 'Wird gespeichert',
  'capture.save': 'Foto speichern',
  'capture.retake': 'Neu aufnehmen',
  'capture.discard': 'Verwerfen',
  'capture.saved': 'In deinem Tagebuch gespeichert.',
  'capture.stopWatching': 'Überwachung beenden und erneut versuchen',
  'capture.previewLabel': 'Live-Vorschau der Kamera',
  'capture.guide': 'Lege deine Hände flach in den Rahmen, mit den Nägeln zur Kamera',
  'capture.mirrorNote': 'Halte dein Gesicht aus dem Bild heraus. Die Vorschau ist ein Spiegel, und das Foto wird so gespeichert, wie du es siehst.',
  'capture.countdown': 'Foto wird in {n} aufgenommen',
  'capture.waiting': 'Warte auf das Kamerabild',
  'capture.cancelTimer': 'Timer abbrechen',
  'capture.takeIn': 'Foto in {seconds} Sekunden aufnehmen',
  'capture.takeNow': 'Jetzt aufnehmen',
  'capture.notReady': 'Die Kamera hat noch kein Bild gezeigt. Warte, bis die Vorschau erscheint, und versuche es dann erneut.',
  'capture.saveFailed': 'Das Foto konnte nicht gespeichert werden. Versuche es erneut.',
  'capture.hiddenNotice': 'Die Kamera wurde ausgeschaltet, weil du diese Seite verlassen hast. Starte sie wieder, wenn du bereit bist.',

  // ── Why the camera did not open ─────────────────────────────────────────────
  'problem.blocked.title': 'Die Kamera ist blockiert',
  'problem.blocked.detail': 'Dein Browser hat den Kamerazugriff nicht erlaubt. Erlaube ihn für diese Website in der Adressleiste oder in den Browser-Einstellungen und versuche es dann erneut.',
  'problem.noCamera.title': 'Keine Kamera gefunden',
  'problem.noCamera.detail': 'Schließe eine Webcam an oder prüfe, ob sie eingeschaltet ist und nicht durch einen Datenschutzschalter blockiert wird, und versuche es dann erneut.',
  'problem.watching.title': 'Die Überwachung nutzt die Kamera',
  'problem.watching.detail': 'Deine Kamera lässt sich nicht ein zweites Mal öffnen, solange die Überwachung läuft. Beende die Überwachung, mach das Foto und starte sie dann wieder im Tab „Überwachen“.',
  'problem.busy.title': 'Die Kamera ist belegt',
  'problem.busy.detail': 'Eine andere App oder ein anderer Browser-Tab nutzt die Kamera. Schließe die App oder den Tab und versuche es dann erneut.',
  'problem.insecure.title': 'Die Kamera braucht eine sichere Seite',
  'problem.insecure.detail': 'Kameras funktionieren nur auf https-Seiten (oder localhost). Öffne Stop Biting über die https-Adresse und versuche es erneut.',
  'problem.unknown.title': 'Die Kamera wurde nicht gestartet',
  'problem.unknown.detail': 'Beim Öffnen der Kamera ist etwas schiefgegangen. Versuche es erneut oder lade die Seite neu.',
  'problem.frame.title': 'Das Foto konnte nicht aufgenommen werden',

  // ── Storage limits ──────────────────────────────────────────────────────────
  'store.full': 'Das Tagebuch fasst {max} Fotos. Lösche ein paar ältere, um weitere hinzuzufügen.',
  'store.writeFailed': 'Dieser Browser hat das Foto nicht gespeichert. Schaffe Speicherplatz oder versuche es erneut.',

  // ── The weekly reminder strip (inside the app only) ─────────────────────────
  'reminder.aria': 'Erinnerung an das Foto-Tagebuch',
  'reminder.text': '<b>Zeit für das Handfoto dieser Woche.</b> Das letzte war {age}.',
  'reminder.open': 'Foto-Tagebuch öffnen',
  'reminder.snooze': 'Jetzt nicht',

  // ── Settings > Data > Photo diary ───────────────────────────────────────────
  'settings.saved': '{count, plural, =0 {Keine Fotos gespeichert.} one {# Foto gespeichert, {size} in diesem Browser.} other {# Fotos gespeichert, {size} in diesem Browser.}}',
  'settings.deleteQuestion': '{count, plural, one {Das Foto aus diesem Browser löschen?} other {Alle # Fotos aus diesem Browser löschen?}}',
  'settings.note': 'Das Löschen deines Verlaufs oder „Alles löschen“ in diesem Bereich entfernt keine Fotos. Verwende dafür diesen Button.',
  'settings.allDeleted': 'Alle Fotos gelöscht.',

  // ── Small helpers ───────────────────────────────────────────────────────────
  'age.ago': '{count, plural, =0 {heute} one {vor {count} Tag} other {vor {count} Tagen}}',
};
