// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-meta", locale de.
import type { messages as en } from '../../scopes/marketing-meta';

export const messages: Record<keyof typeof en, string> = {
  'pricing.title': 'Preise: {pMonthly}/Monat oder {pYearlyShort}/Jahr | Stop Biting',
  'pricing.description': 'Preise von Stop Biting: kostenlose Testphase von {trialDays, plural, one {# Tag} other {# Tagen}}, ohne Karte. Danach {pMonthly}/Monat oder {pYearlyShort}/Jahr (rund {pMonthlyEq}/Monat, {pSave} sparen). Jederzeit kündbar.',
  'pricing.name': 'Preise von Stop Biting',
  'pricing.schemaDescription': 'Preise von Stop Biting: kostenlose Testphase von {trialDays, plural, one {# Tag} other {# Tagen}}, danach {pMonthly}/Monat oder {pYearlyShort}/Jahr.',
  'pricing.faqName': 'Fragen zu den Preisen von Stop Biting',

  'about.title': 'Über Stop Biting | Entwickelt von Igor Gazivoda',
  'about.description': 'Entwickelt von Igor Gazivoda, einem Entwickler, der 20 Jahre an den Nägeln kaute. KI-Erkennung auf dem Gerät: Solange sie läuft, werden keine Kameradaten gesendet.',
  'about.name': 'Über Stop Biting',
  'about.personDescription': 'Igor Gazivoda ist der Gründer von Stop Biting, einer App mit KI auf dem Gerät zur Erkennung von Nägelkauen, entwickelt mit MediaPipe und WebAssembly.',

  'how.title': 'So funktioniert die KI-Erkennung von Nägelkauen | Stop Biting',
  'how.description': 'Stop Biting nutzt MediaPipe und WebAssembly, um Nägelkauen in Echtzeit auf deinem Gerät zu erkennen. Solange es läuft, werden keine Kameradaten gesendet.',
  'how.name': 'So funktioniert die KI-Erkennung von Nägelkauen',
  'how.howtoName': 'So nutzt du Stop Biting zur Erkennung von Nägelkauen',
  'how.howtoDescription': 'Richte die KI-Erkennung von Nägelkauen in Echtzeit in unter 2 Minuten mit deiner Webcam ein.',

  'app.description': 'Web-App, die deine Webcam und eine KI auf deinem Gerät (MediaPipe) nutzt, um Nägelkauen (Onychophagie) in Echtzeit zu erkennen. Sie löst einen Alarm aus, sobald sich deine Hand dem Mund nähert. Mit Serien-Tracking, Vorfallsprotokoll, Anleitung zum Habit-Reversal-Training (HRT) und einem 7-Tage-Verlauf der Bisse. Solange sie läuft, werden keine Kameradaten gesendet.',
  'app.os': 'Webbrowser (Mac oder Windows)',
  'app.offer.trial.name': 'Kostenlose Testphase',
  'app.offer.trial.description': 'Alle Funktionen für Erkennung und Tracking während einer kostenlosen Testphase von {trialDays, plural, one {# Tag} other {# Tagen}}. Keine Kreditkarte nötig.',
  'app.offer.monthly.name': 'Monatlich',
  'app.offer.monthly.description': 'Unbegrenzte KI-Erkennung, Serien-Tracking, vollständiger Verlauf der Vorfälle und alle Alarmarten',
  'app.offer.yearly.name': 'Jährlich',
  'app.offer.yearly.description': 'Alles aus dem Monatstarif plus bevorzugter Support: {pSave} günstiger als monatliche Zahlung',
  'app.feature.1': 'Echtzeit-Erkennung von Nägelkauen per Webcam-KI',
  'app.feature.2': 'Erkennung auf dem Gerät: Solange sie läuft, werden keine Kameradaten gesendet',
  'app.feature.3': 'Ton- und Bildalarme, wenn Nägelkauen erkannt wird',
  'app.feature.4': 'Serien-Tracking und persönliche Bestleistung',
  'app.feature.5': 'Vorfallsprotokoll mit Auslöser-Tags (Stress, Konzentration, Langeweile)',
  'app.feature.6': 'Diagramm der Bisshäufigkeit über 7 Tage',
  'app.feature.7': 'Integrierte Anleitung zum Habit-Reversal-Training (HRT)',
  'app.feature.8': 'Funktioniert als PWA: direkt im Browser installieren, ganz ohne App-Store',
  'app.feature.9': 'Kostenlose Live-Demo von 60 Sekunden: Erkennung im Browser ausprobieren, ohne Anmeldung',
  'image.caption': 'Der Bildschirm „Überwachen“ von Stop Biting, mit Beispieldaten.',

  'nav.home': 'Stop Biting: KI-Erkennung von Nägelkauen',
  'nav.how': 'So funktioniert die KI-Erkennung von Nägelkauen',
  'nav.pricing': 'Preise: kostenlose Testphase, {pMonthly}/Monat oder {pYearlyShort}/Jahr',
  'nav.about': 'Über Stop Biting',

  'notfound.title': 'Seite nicht gefunden | Stop Biting',
  'notfound.h1': 'Diese Seite gibt es nicht.',
  'notfound.p': 'Vielleicht ist der Link defekt oder die Seite wurde verschoben. Die App, die Ratgeber und alles andere sind noch dort, wo sie waren.',
  'notfound.home': 'Zur Startseite',
  'notfound.blog': 'Die Ratgeber lesen',
};
