// NEEDS NATIVE REVIEW (machine draft). Scope "phone", locale pt-BR.
import type { messages as en } from '../../scopes/phone';

export const messages: Record<keyof typeof en, string> = {
  'home.greeting.named': '{part, select, morning {Bom dia} afternoon {Boa tarde} other {Boa noite}}, <name>{name}</name>.',
  'home.greeting.anon': '{part, select, morning {Bom <name>dia</name>.} afternoon {Boa <name>tarde</name>.} other {Boa <name>noite</name>.}}',
  'home.freePlan': 'Plano gratuito.',
  'home.freePlanHistory': 'Plano gratuito: o Histórico mostra {days, plural, one {seu último dia} other {seus últimos {days} dias}}.',
  'home.trial': 'Teste grátis: {left}.',
  'home.choosePlan': 'Escolher um plano',
  'home.logAria': 'Registrar',
  'home.bite': 'Eu roí',
  'home.urge': 'Sinto um impulso',
  'home.send.share': 'Enviar o link para o meu computador',
  'home.send.email': 'Enviar por e-mail o link para o meu computador',
  'home.openFull': 'Abrir o app completo neste dispositivo',

  'entry.bite': 'Mordida',
  'entry.biteWith': 'Mordida, {reason}',
  'entry.urgeDone': '{urge}, timer concluído',
  'entry.notBite': 'Não foi uma mordida',
  'entry.alarm': 'Alarme',

  'today.none': 'Nada registrado hoje',
  'today.some': '{list} hoje',
  'today.bites': '{count, plural, one {{count} mordida} other {{count} mordidas}}',
  'today.urges': '{count, plural, one {{count} impulso} other {{count} impulsos}}',
  'today.alarms': '{count, plural, one {{count} alarme para revisar} other {{count} alarmes para revisar}}',

  'toast.urge': 'Impulso registrado. Sua sequência não é afetada.',
  'toast.bite': 'Mordida registrada. Sua sequência recomeça a partir de agora.',
  'toast.biteWith': 'Mordida registrada: {reason}. Sua sequência recomeça a partir de agora.',
  'toast.question': 'O que provocou? Você pode pular esta etapa.',

  'recent.title': 'Recentes',
  'recent.all': 'Todo o histórico',
  'recent.empty': 'Nada registrado ainda. Toque em um botão acima quando acontecer.',

  'sync.phoneOnly': 'Armazenado somente neste celular.',
  'sync.phoneOnlyCanSync': 'Armazenado somente neste celular. Ative a sincronização em Configurações para ver no seu computador.',
  'sync.on': 'A sincronização está ativada, então seu computador vê estes registros.',
  'sync.openSettings': 'Abrir Configurações',
};
