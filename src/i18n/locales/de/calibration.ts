// NEEDS NATIVE REVIEW (machine draft). Scope "calibration", locale de.
import type { messages as en } from '../../scopes/calibration';

export const messages: Record<keyof typeof en, string> = {
  'title.rest': 'Schritt 1 von 2',
  'title.real': 'Schritt 2 von 2',
  'title.between': 'Als Nächstes: Schritt 2 von 2',
  'title.default': 'Kalibrieren',

  'camera.aria': 'Deine Kamera',
  'link.starting': 'Kamera wird gestartet…',
  'link.failed': 'Die Kamera konnte nicht gestartet werden.',
  'link.models': 'Die Erkennung konnte nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.',
  'link.paused': 'Die Kamera ist an. Die Erkennung ist pausiert, solange du kalibrierst.',
  'seen.both': 'Die Kamera sieht dein Gesicht und deine Hand.',
  'seen.faceOnly': 'Die Kamera sieht dein Gesicht. Deine Hand sieht sie noch nicht.',
  'seen.none': 'Die Kamera sieht dein Gesicht nicht. Setz dich so hin, dass dein Gesicht im Bild ist.',

  'intro.lead': 'Das ist optional und dauert etwa eine Minute. Es hilft der App, das Aufstützen des Kinns vom Ernstfall zu unterscheiden. Du machst zwei kurze Dinge, während die Kamera dich ansieht.',
  'instruction.rest': 'Stütze dein Kinn auf deine Hand, wie du es normalerweise tun würdest.',
  'instruction.real': 'Führe eine Fingerspitze nah an deine Lippen.',
  'intro.privacy': 'Es wird nichts aufgezeichnet. Nur ein paar Zahlen dazu, wo deine Hand war, werden auf diesem Gerät gespeichert: kein Bild. Sie sind nicht Teil deines Verlaufs, werden nicht synchronisiert und nicht hochgeladen. Du kannst sie in den Einstellungen unter Erkennung löschen. Die Überwachung ist pausiert, solange du das machst.',
  'start': 'Starten',
  'notNow': 'Jetzt nicht',

  'hold': 'Halte die Position. {left, plural, one {Noch # Sekunde} other {Noch # Sekunden}}.',
  'progress': '{count} von {needed} benötigt.',
  'between.lead': 'Nimm deine Hand weg.',
  'between.next': 'Schritt 2 beginnt in {left, plural, one {# Sekunde} other {# Sekunden}}: Du führst dann eine Fingerspitze nah an deine Lippen.',

  'announce.rest': 'Schritt 1 von 2. Stütze dein Kinn auf deine Hand, wie du es normalerweise tun würdest. Halte die Position.',
  'announce.between': 'Nimm deine Hand weg. Schritt 2 beginnt in ein paar Sekunden.',
  'announce.real': 'Schritt 2 von 2. Führe eine Fingerspitze nah an deine Lippen. Halte die Position.',
  'announce.done': 'Fertig. Du kannst das Ergebnis speichern oder es noch einmal versuchen.',
  'announce.failed': 'Das hat nicht geklappt. Du kannst es noch einmal versuchen.',
  'result.done': 'Fertig.',
  'result.summary': 'Die App hat {rest} Einzelbilder gesehen, auf denen du dein Kinn aufstützt, und {real} mit einer Fingerspitze nah an den Lippen. Beim Speichern bleiben ein paar Zahlen daraus auf diesem Gerät erhalten, und die Regel fürs Kinn-Aufstützen nutzt sie.',
  'result.failed': 'Das hat nicht geklappt.',
  'failure.noRest': 'Die Kamera hat deine Hand am Kinn nicht lange genug gesehen. Versuche es noch einmal mit der Hand im Bild.',
  'failure.noReal': 'Die Kamera hat keine Fingerspitze nah an deinen Lippen lange genug gesehen. Versuche es noch einmal mit der Hand im Bild.',
  'failure.noEither': 'Die Kamera hat deine Hand nicht gesehen. Prüfe, ob dein Gesicht und deine Hand im Bild sind, und versuche es noch einmal.',
};
