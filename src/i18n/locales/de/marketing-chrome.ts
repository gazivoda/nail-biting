// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-chrome", locale de.
import type { messages as en } from '../../scopes/marketing-chrome';

export const messages: Record<keyof typeof en, string> = {
  'nav.label': 'Seitennavigation',
  'nav.skip': 'Zum Inhalt springen',
  'nav.how': 'So startest du',
  'nav.science': 'Wissenschaft',
  'nav.privacy': 'Datenschutz',
  'nav.pricing': 'Preise',
  'nav.faq': 'FAQ',
  'nav.blog': 'Blog',
  'nav.signin': 'Anmelden',

  'bc.label': 'Brotkrümelnavigation',
  'bc.home': 'Startseite',

  'trial.start': 'Kostenlose Testphase starten',
  'trial.startShort': 'Gratis testen',
  'trial.send': 'Link an meinen Computer senden',
  'trial.email': 'Link für meinen Computer per E-Mail schicken',
  'trial.mailSubject': 'Stop Biting, für meinen Computer',
  'trial.mailBody': 'Öffne das auf meinem Laptop oder Desktop-Rechner: {homeUrl}',
  'trial.shareText': 'Öffne das auf meinem Laptop oder Desktop-Rechner:',

  'offer.line': '{trialDays, plural, one {# Tag} other {# Tage}} gratis, ohne Karte, danach {pMonthly}/Monat',

  'cta.aria': 'Aufruf zum Handeln',
  'cta.heading': 'Erwische deinen nächsten <hl>Biss.</hl>',
  'cta.body': 'Lass es durch deinen nächsten Arbeitstag laufen, öffne dann den Verlauf und sieh, wann du beißt.',

  'footer.about': 'Ein Alarm, der dir Nägelkauen (Onychophagie) bewusst macht, entwickelt von <link>Igor Gazivoda</link>. Die Erkennung läuft in deinem Browser. Solange sie läuft, werden keine Kameradaten gesendet.',
  'bottom.heading': 'Teste es {trialDays, plural, one {# Tag} other {# Tage}} kostenlos.',
  'bottom.note': 'Ohne Karte zum Start. Danach {pMonthly} im Monat oder {pYearlyShort} im Jahr, jederzeit kündbar.',

  'footer.nav': 'Navigation im Seitenfuß',
  'footer.home': 'Startseite',
  'footer.blog': 'Blog',
  'footer.pricing': 'Preise',
  'footer.contact': 'Kontakt',
  'footer.editorial': 'Redaktionelle Richtlinien',
  'footer.privacy': 'Datenschutzerklärung',
  'footer.terms': 'Nutzungsbedingungen',
  'footer.refund': 'Erstattungsrichtlinie',
  'footer.tagline': 'Hör auf zu beißen.',
  'footer.copy': '© {year} Stop Biting.',
  'footer.englishOnly': 'Der Blog und die rechtlichen Seiten gibt es nur auf Englisch.',

  'lang.label': 'Sprache',

  'signin.google': 'Google',
  'signin.apple': 'Apple',
  'signin.microsoft': 'Microsoft',
  'signin.magic': 'einem Link per E-Mail',

  'plan.f1': 'Erkennung, solange du sie laufen lässt',
  'plan.f2': 'Aktuelle und beste Serie',
  'plan.f3': 'Vollständiger Verlauf mit Auslöser-Tags',
  'plan.f4': 'Ton, Blitz oder beides',
  'plan.extra': 'Bevorzugter Support',
  'plan.privacy': 'Die Erkennung läuft auf deinem Gerät; keine Kameradaten verlassen es',

  'pricing.heading': '{pMonthly} im Monat oder <mark>{pYearlyShort} im Jahr.</mark>',
  'pricing.lede': '{trialDays, plural, one {# Tag} other {# Tage}} zuerst gratis, ohne Karte zum Start. Den Tarif wählst du, wenn die Testphase endet.',
  'pricing.badge.save': 'Bester Preis: {pSave} sparen',
  'pricing.badge.localized': 'Bester Preis',
  'pricing.yearly': 'Jährlich',
  'pricing.perYear': '/ Jahr',
  'pricing.yearly.eq': '{pMonthlyEq}/Monat, jährlich abgerechnet',
  'pricing.yearly.billed': 'Jährliche Abrechnung',
  'pricing.monthly': 'Monatlich',
  'pricing.perMonth': '/ Monat',
  'pricing.monthly.billed': 'Monatliche Abrechnung',
  'pricing.monthly.short': 'Alles aus dem Jahrestarif außer dem bevorzugten Support.',
  'pricing.localizedNote': 'Diese Preise werden in deiner Landeswährung angezeigt. Die Listenpreise sind {pMonthly} im Monat und {pYearlyShort} im Jahr.',
  'pricing.payments': 'Zahlungen laufen über Paddle. Du kannst jederzeit in den Einstellungen kündigen. Innerhalb von 14 Tagen nach deiner ersten Zahlung kannst du eine vollständige Erstattung verlangen: siehe die <link>Erstattungsrichtlinie</link>.',
};
