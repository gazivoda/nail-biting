// NEEDS NATIVE REVIEW (machine draft). Scope "language", locale pt-BR.
import type { messages as en } from '../../scopes/language';

export const messages: Record<keyof typeof en, string> = {
  'title': 'Idioma',
  'groupLabel': 'Idioma do app',
  'intro': 'Escolha o idioma das telas do app. O site, o blog e os e-mails continuam em inglês.',
  'draftNote': 'Esta tradução é um rascunho automático e ainda não foi revisada por um falante nativo. Algumas frases podem soar estranhas.',
  'loadFailed': 'Não foi possível carregar esse idioma. Verifique sua conexão e tente novamente.',
  'loading': 'Carregando…',
};
