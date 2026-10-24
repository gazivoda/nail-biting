// NEEDS NATIVE REVIEW (machine draft). Scope "alarm", locale pt-BR.
import type { messages as en } from '../../scopes/alarm';

export const messages: Record<keyof typeof en, string> = {
  'overlay.title': 'Mãos para baixo',
  'overlay.hint': 'Pressione o polegar contra a ponta de cada dedo.',

  'alert.tabTitle': '⚠️ Pare de roer! – Stop Biting',
  'alert.notification.title': 'Pare de roer!',
  'alert.notification.body': 'Roer as unhas detectado: afaste as mãos.',

  'suggestion.thumbs': 'Pressione o polegar contra a ponta de cada dedo',
  'suggestion.fist': 'Feche e abra o punho · 5×',
  'suggestion.exhale': 'Solte o ar devagar pelo nariz',
  'suggestion.water': 'Tome água em goles, com atenção',

  'reminder.title': 'Checagem das mãos',
  'reminder.body.thumbs': 'Onde estão suas mãos? Se estiverem perto do rosto, tente: pressione o polegar contra a ponta de cada dedo.',
  'reminder.body.fist': 'Onde estão suas mãos? Se estiverem perto do rosto, tente: feche e abra o punho · 5×.',
  'reminder.body.exhale': 'Onde estão suas mãos? Se estiverem perto do rosto, tente: solte o ar devagar pelo nariz.',
  'reminder.body.water': 'Onde estão suas mãos? Se estiverem perto do rosto, tente: tome água em goles, com atenção.',

  'notABite.announce.offered': 'Alarme. Se foi um alarme falso, toque em Não foi uma mordida.',
  'notABite.announce.marked': 'Marcado como “Não foi uma mordida”. Não será contado. Toque em Desfazer para voltar atrás.',
  'notABite.toast.alarm': 'Alarme.',
  'notABite.toast.question': 'Só estava apoiando a mão?',
  'notABite.toast.marked': 'Marcado como “Não foi uma mordida”. Não será contado.',
  'notABite.toast.calibrateOffer': 'Quer ensinar como você apoia o queixo? Leva só um minuto.',
  'notABite.calibrate': 'Calibrar',
  'notABite.button': 'Não foi uma mordida',
  'notABite.undo': 'Desfazer',
  'notABite.close': 'Fechar',
};
