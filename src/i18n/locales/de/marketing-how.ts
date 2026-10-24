// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-how", locale de.
import type { messages as en } from '../../scopes/marketing-how';

export const messages: Record<keyof typeof en, string> = {
  'bc.how': 'So funktioniert es',
  'hero.title': 'So funktioniert die <hl>KI-Erkennung</hl> von Nägelkauen',
  'hero.lede': 'Stop Biting nutzt MediaPipe und WebAssembly, um Nägelkauen in Echtzeit und komplett auf deinem Gerät zu erkennen. Der MediaPipe Hand Landmarker verfolgt 21 Handpunkte, und der Alarm ertönt etwa 0,6 Sekunden, nachdem er sieht, dass sich deine Hand dem Mund nähert. Die Einrichtung dauert weniger als zwei Minuten.',
  'figure.alt': 'Der Stop-Biting-Bildschirm „Überwachen“ mit großem Serienzähler, den heutigen Alarmen und Bissen und laufender Erkennung.',
  'figure.caption': 'Der Bildschirm „Überwachen“ (die Aufnahme ist auf Englisch), mit Beispieldaten.',

  'why.heading': 'Warum Bewusstsein der Engpass ist',
  'why.body': 'Die meisten Episoden passieren, ohne dass du es merkst: Die Gewohnheit läuft automatisch ab, unterhalb der Schwelle des Bewusstseins. Das <link>Habit-Reversal-Training</link> (der Goldstandard unter den Behandlungen) nennt Awareness-Training als wichtigsten Bestandteil. Stop Biting automatisiert diesen Bestandteil: Es erkennt die Episoden, die du nicht bemerkst.',

  'steps.heading': 'So legst du los',
  'step.1.title': 'App öffnen',
  'step.1.body': 'Rufe stopbiting.today in Chrome, Edge oder Firefox auf. Es muss nichts installiert werden.',
  'step.2.title': 'Kamerazugriff erlauben',
  'step.2.body': 'Erlaube den Webcam-Zugriff. Das Videobild wird komplett auf deinem Gerät von MediaPipe verarbeitet, das in WebAssembly läuft. Solange es läuft, werden keine Kameradaten gesendet.',
  'step.3.title': 'Kamera ausrichten',
  'step.3.body': 'Achte darauf, dass dein Gesicht und deine Hände im Kamerabild zu sehen sind. Die KI verfolgt 21 Handpunkte und erkennt, wenn sie sich dem Mundbereich nähern.',
  'step.4.title': 'Arbeiten, zocken oder lernen wie gewohnt',
  'step.4.body': 'Stop Biting läuft im Hintergrund und prüft fünfmal pro Sekunde. Es braucht drei aufeinanderfolgende Bilder, bevor es reagiert, daher ertönt der Alarm etwa sechs Zehntelsekunden, nachdem sich deine Hand zum Mund bewegt.',
  'step.5.title': 'Auf den Alarm reagieren',
  'step.5.body': 'Der Alarm ist dein Bewusstseinssignal. Mach die Handübung, die die App vorschlägt, zum Beispiel die Handflächen flach andrücken oder die Faust ballen: eine konkurrierende Reaktion, die deine Hände beim Beißen nicht ausführen können. Sie jedes Mal zu machen, ist der Kern des Habit-Reversal-Trainings.',

  'specs.heading': 'Technische Daten',
  'spec.1.label': 'Erkennungsmodell',
  'spec.1.value': 'Google MediaPipe Hand Landmarker (21 Punkte)',
  'spec.2.label': 'Verarbeitung',
  'spec.2.value': 'WebAssembly: abgeschottet, läuft auf deinem Gerät',
  'spec.3.label': 'Alarmverzögerung',
  'spec.3.value': 'Etwa 0,6 Sekunden, nachdem sich deine Hand zum Mund bewegt',
  'spec.4.label': 'Vorfallsprotokoll',
  'spec.4.value': '{sync, select, on {Protokoll mit Zeitstempel, lokal gespeichert; nur mit eingeschalteter Synchronisierung an dein Konto gesendet} other {Protokoll mit Zeitstempel, lokal gespeichert, nie übertragen}}',

  'faq.heading': 'Häufige Fragen',
  'faq.1.q': 'Was passiert mit meinen Kameradaten?',
  'faq.1.a': 'Sie werden Bild für Bild auf deinem Gerät von der lokal laufenden MediaPipe-WASM-Datei verarbeitet. Solange es läuft, werden keine Kameradaten gesendet. {sync, select, on {Anmelden, Bezahlen und, falls du es einschaltest, Synchronisieren nutzen das Netzwerk} other {Anmelden und Bezahlen nutzen das Netzwerk}}, und das kannst du selbst prüfen, indem du den Netzwerkverkehr beobachtest, während die App läuft.',
  'faq.2.q': 'Funktioniert es auf Mac, Windows und Linux?',
  'faq.2.a': 'Die Web-App funktioniert auf jedem Gerät mit modernem Browser und Webcam: Mac, Windows, Linux und Chromebook.',
  'faq.3.q': 'Gibt es Fehlalarme, wenn ich esse oder mein Gesicht berühre?',
  'faq.3.a': 'Das Erkennungsmodell unterscheidet anhaltende Nähe der Hand zum Mund von kurzen Berührungen, und die Empfindlichkeit lässt sich in den Einstellungen anpassen.',
  'faq.4.q': 'Funktioniert es, wenn ich nicht vor der Kamera bin?',
  'faq.4.a': 'Die Erkennung braucht dein Gesicht und deine Hände im Bild. An einem Schreibtisch bist du meistens ohnehin im Bild.',
  'faq.5.q': 'Funktioniert es im Dunkeln?',
  'faq.5.a': 'Bei schlechtem Licht lässt die Genauigkeit der Erkennung nach. Eine Schreibtischlampe oder normales Raumlicht reicht aus; du brauchst nichts Besonderes.',

  'learn.heading': 'Mehr erfahren',
  'learn.note': 'Diese Artikel sind auf Englisch.',
  // article titles: the articles are English only, so the titles stay as they are
  'link.1': 'Habit Reversal Training: the clinical method behind the app',
  'link.2': 'Stop Biting app review: what to expect in the first two weeks',
  'link.3': 'How we verified on-device processing',
  'link.4': 'Stop Biting vs bitter nail polish: which works?',
};
