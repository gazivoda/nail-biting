// NEEDS NATIVE REVIEW (machine draft). Scope "trial", locale es.
import type { messages as en } from '../../scopes/trial';

export const messages: Record<keyof typeof en, string> = {
  'trial.left.days': '{count, plural, one {Queda {count} día} other {Quedan {count} días}}',
  'trial.left.hours': '{count, plural, one {Queda {count} hora} other {Quedan {count} horas}}',
  'trial.left.underHour': 'Queda menos de una hora',
  'trial.ended.none': 'Tu prueba gratuita ha terminado. Tu historial sigue guardado en este dispositivo.',
  'trial.ended.logged': 'Tu prueba gratuita ha terminado. Registró {count, plural, one {{count} alerta} other {{count} alertas}}, y tu historial sigue guardado en este dispositivo.',
};
