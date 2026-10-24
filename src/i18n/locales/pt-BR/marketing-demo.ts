// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-demo", locale pt-BR.
import type { messages as en } from '../../scopes/marketing-demo';

export const messages: Record<keyof typeof en, string> = {
  'start': 'Testar a demonstração ao vivo',
  'retry': 'Tentar novamente',
  'again': 'Executar de novo',
  'loading': 'Baixando modelos de IA (~20 MB, uma única vez)…',
  'hint': 'Leve a ponta de um dedo aos lábios para ouvir o alarme',
  'offer': '{trialDays, plural, one {# dia} other {# dias}} grátis, sem cartão',
  'result': '{count, plural, =0 {Nada detectado em 60 segundos. Execute de novo e toque os lábios para ouvir o alarme.} one {Pegou você uma vez em 60 segundos. O app faz isso o dia todo, enquanto você trabalha.} other {Pegou você # vezes em 60 segundos. O app faz isso o dia todo, enquanto você trabalha.}}',
  'catch': 'Esse é o alarme. Detectado {count, plural, one {uma vez} other {# vezes}} até agora.',
  'failure': 'Você ainda pode <trial>começar o teste grátis</trial> ({offer}) ou ler <how>como a detecção funciona</how>.',
};
