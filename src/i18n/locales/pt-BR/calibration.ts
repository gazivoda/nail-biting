// NEEDS NATIVE REVIEW (machine draft). Scope "calibration", locale pt-BR.
import type { messages as en } from '../../scopes/calibration';

export const messages: Record<keyof typeof en, string> = {
  'title.rest': 'Etapa 1 de 2',
  'title.real': 'Etapa 2 de 2',
  'title.between': 'Em seguida: etapa 2 de 2',
  'title.default': 'Calibrar',

  'camera.aria': 'Sua câmera',
  'link.starting': 'Iniciando a câmera…',
  'link.failed': 'Não foi possível iniciar a câmera.',
  'link.models': 'Não foi possível carregar a detecção. Verifique sua conexão e tente de novo.',
  'link.paused': 'A câmera está ligada. A detecção fica em pausa enquanto você calibra.',
  'seen.both': 'A câmera vê seu rosto e sua mão.',
  'seen.faceOnly': 'A câmera vê seu rosto. Ainda não vê sua mão.',
  'seen.none': 'A câmera não vê seu rosto. Sente-se de modo que seu rosto apareça na imagem.',

  'intro.lead': 'Isto é opcional e leva cerca de um minuto. Ajuda o app a distinguir apoiar o queixo da coisa de verdade. Você fará duas coisas rápidas enquanto a câmera olha para você.',
  'instruction.rest': 'Apoie o queixo na mão como você normalmente faria.',
  'instruction.real': 'Aproxime a ponta de um dedo dos lábios.',
  'intro.privacy': 'Nada é gravado. Apenas alguns números sobre onde sua mão estava são guardados, neste dispositivo: nenhuma imagem. Eles não fazem parte do seu histórico, não são sincronizados nem enviados. Você pode apagá-los em Configurações, em Detecção. O monitoramento fica em pausa enquanto você faz isto.',
  'start': 'Começar',
  'notNow': 'Agora não',

  'hold': 'Mantenha a posição. {left, plural, one {Falta # segundo} other {Faltam # segundos}}.',
  'progress': '{count} de {needed} necessários.',
  'between.lead': 'Afaste a mão.',
  'between.next': 'A etapa 2 começa em {left, plural, one {# segundo} other {# segundos}}: você vai aproximar a ponta de um dedo dos lábios.',

  'result.done': 'Pronto.',
  'result.summary': 'O app viu {rest} quadros de você apoiando o queixo e {real} com a ponta de um dedo perto dos lábios. Ao salvar, alguns números deles são guardados, neste dispositivo, e a regra do apoio de queixo vai usá-los.',
  'result.failed': 'Isso não funcionou.',
  'failure.noRest': 'A câmera não viu sua mão apoiada no queixo por tempo suficiente. Tente de novo com a mão à vista.',
  'failure.noReal': 'A câmera não viu a ponta de um dedo perto dos lábios por tempo suficiente. Tente de novo com a mão à vista.',
  'failure.noEither': 'A câmera não viu sua mão. Verifique se seu rosto e sua mão estão na imagem e tente de novo.',
};
