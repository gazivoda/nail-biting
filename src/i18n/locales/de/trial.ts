// NEEDS NATIVE REVIEW (machine draft). Scope "trial", locale de.
import type { messages as en } from '../../scopes/trial';

export const messages: Record<keyof typeof en, string> = {
  'trial.left.days': '{count, plural, one {Noch {count} Tag} other {Noch {count} Tage}}',
  'trial.left.hours': '{count, plural, one {Noch {count} Stunde} other {Noch {count} Stunden}}',
  'trial.left.underHour': 'Noch weniger als eine Stunde',
  'trial.ended.none': 'Deine kostenlose Testphase ist zu Ende. Dein Verlauf bleibt auf diesem Gerät gespeichert.',
  'trial.ended.logged': 'Deine kostenlose Testphase ist zu Ende. {count, plural, one {Es wurde {count} Alarm erfasst} other {Es wurden {count} Alarme erfasst}}, und dein Verlauf bleibt auf diesem Gerät gespeichert.',
};
