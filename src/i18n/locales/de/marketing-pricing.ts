// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-pricing", locale de.
import type { messages as en } from '../../scopes/marketing-pricing';

export const messages: Record<keyof typeof en, string> = {
  'bc.pricing': 'Preise',

  'includes.heading': 'Das ist in jedem Tarif enthalten',
  'faq.heading': 'Fragen zu den Preisen',

  'faq.1.q': 'Wie funktioniert die kostenlose Testphase von {trialDays, plural, one {# Tag} other {# Tagen}}?',
  'faq.1.a': 'Jedes Konto startet mit einer kostenlosen Testphase von {trialDays, plural, one {# Tag} other {# Tagen}}, die alle Funktionen für Erkennung und Tracking enthält, ganz ohne Kreditkarte. Wenn die Testphase endet, wählst du den Monats- oder den Jahrestarif, um weiterzumachen.',
  'faq.2.q': 'Was ist der Unterschied zwischen dem Monats- und dem Jahrestarif?',
  'faq.2.a': 'Beide Tarife enthalten dieselben Funktionen: Erkennung, solange du sie laufen lässt, aktuelle und beste Serie, vollständiger Verlauf mit Auslöser-Tags sowie Ton, Blitz oder beides. Der Jahrestarif wird einmal mit {pYearly} abgerechnet (rund {pMonthlyEq} pro Monat, {pSave} günstiger als die monatliche Zahlung von {pMonthly}) und enthält bevorzugten Support.',
  'faq.3.q': 'Wie funktionieren die Zahlungen?',
  'faq.3.a': 'Zahlungen werden von Paddle abgewickelt, einem sicheren Merchant of Record. Stop Biting sieht oder speichert deine Kartendaten nie.',
  'faq.4.q': 'Kann ich jederzeit kündigen?',
  'faq.4.a': 'Ja. Du kannst jederzeit in den App-Einstellungen kündigen und behältst den Zugang bis zum Ende des bezahlten Zeitraums. Details findest du in der <link>Erstattungsrichtlinie</link>.',

  'cta.heading': 'Teste es {trialDays, plural, one {# Tag} other {# Tage}} kostenlos.',
  'cta.note': 'Ohne Karte zum Start. Erst mehr wissen? Lies, <how>wie die Erkennung funktioniert</how>, oder <calc>rechne aus, was Nägelkauen dich kostet</calc>.',
};
