// NEEDS NATIVE REVIEW (machine draft). Scope "plans", locale de.
import type { messages as en } from '../../scopes/plans';

export const messages: Record<keyof typeof en, string> = {
  'extras.label': 'Weitere Möglichkeiten zum Kaufen',
  'plan.lifetime': 'Lebenslang',
  'lifetime.once': 'einmalig',
  'lifetime.priceAtCheckout': 'Der Preis wird im Checkout angezeigt',
  'lifetime.band.body': 'Einmal zahlen statt jeden Monat oder jedes Jahr. Enthalten ist alles aus dem Monatstarif, ohne Verlängerungen, solange Stop Biting angeboten wird. Starte die kostenlose Testphase und wähle dann in der App Lebenslang.',
  'lifetime.band.cta': 'Kostenlose Testphase starten',
  'gift.title': 'Als Geschenk verschenken',
  'gift.body.length': 'Kaufe {length} Stop Biting für jemand anderen. Wir senden dir per E-Mail einen Link zum Weitergeben. Die Person meldet sich an, öffnet ihn und löst ihn einmal ein. Das Geschenk beginnt, wenn keine Testphase und kein Abo sie abdeckt.',
  'gift.body.plain': 'Kaufe Zugang zu Stop Biting für jemand anderen. Wir senden dir per E-Mail einen Link zum Weitergeben. Die Person meldet sich an, öffnet ihn und löst ihn einmal ein. Das Geschenk beginnt, wenn keine Testphase und kein Abo sie abdeckt.',
  'gift.thanks': 'Danke! Der Geschenk-Link wird an die E-Mail-Adresse gesendet, mit der du bezahlt hast. Das kann ein paar Minuten dauern.',
  'gift.failed': 'Der Checkout konnte nicht geladen werden. Wenn du einen Werbeblocker nutzt, erlaube paddle.com für diese Seite und lade sie neu, oder schreib an hello@stopbiting.today.',
  'gift.buy': 'Geschenk kaufen',
  'length.years': '{count, plural, one {ein Jahr} other {{count} Jahre}}',
  'length.months': '{count, plural, one {ein Monat} other {{count} Monate}}',
  'length.days': '{count, plural, one {ein Tag} other {{count} Tage}}',
};
