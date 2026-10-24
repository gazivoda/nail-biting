// NEEDS NATIVE REVIEW (machine draft). Scope "trial", locale pt-BR.
import type { messages as en } from '../../scopes/trial';

export const messages: Record<keyof typeof en, string> = {
  'trial.left.days': '{count, plural, one {Resta {count} dia} other {Restam {count} dias}}',
  'trial.left.hours': '{count, plural, one {Resta {count} hora} other {Restam {count} horas}}',
  'trial.left.underHour': 'Resta menos de uma hora',
  'trial.ended.none': 'Seu teste grátis terminou. Seu histórico continua salvo neste dispositivo.',
  'trial.ended.logged': 'Seu teste grátis terminou. Ele registrou {count, plural, one {{count} alarme} other {{count} alarmes}}, e seu histórico continua salvo neste dispositivo.',
};
