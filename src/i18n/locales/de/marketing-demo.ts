// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-demo", locale de.
import type { messages as en } from '../../scopes/marketing-demo';

export const messages: Record<keyof typeof en, string> = {
  'start': 'Live-Demo ausprobieren',
  'retry': 'Erneut versuchen',
  'again': 'Noch einmal starten',
  'loading': 'KI-Modelle werden geladen (~20 MB, einmalig) …',
  'hint': 'Führe eine Fingerspitze an die Lippen, um den Alarm zu hören',
  'offer': '{trialDays, plural, one {# Tag} other {# Tage}} gratis, ohne Karte',
  'result': '{count, plural, =0 {In 60 Sekunden nichts erkannt. Starte es noch einmal und berühre deine Lippen, um den Alarm zu hören.} one {Dich einmal in 60 Sekunden erwischt. Die App macht das den ganzen Tag, während du arbeitest.} other {Dich # Mal in 60 Sekunden erwischt. Die App macht das den ganzen Tag, während du arbeitest.}}',
  'catch': 'Das ist der Alarm. Bisher {count, plural, one {einmal} other {# Mal}} erwischt.',
  'failure': 'Du kannst trotzdem <trial>die kostenlose Testphase starten</trial> ({offer}) oder lesen, <how>wie die Erkennung funktioniert</how>.',
};
