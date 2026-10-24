// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-pricing", locale pt-BR.
import type { messages as en } from '../../scopes/marketing-pricing';

export const messages: Record<keyof typeof en, string> = {
  'bc.label': 'Trilha de navegação',
  'bc.home': 'Início',
  'bc.pricing': 'Preços',

  'includes.heading': 'O que cada plano inclui',
  'faq.heading': 'Perguntas sobre os preços',

  'faq.1.q': 'Como funciona o teste grátis de {trialDays, plural, one {# dia} other {# dias}}?',
  'faq.1.a': 'Toda conta começa com um teste grátis de {trialDays, plural, one {# dia} other {# dias}} que inclui todos os recursos de detecção e acompanhamento, sem precisar de cartão de crédito. Quando o teste terminar, escolha o plano mensal ou o anual para continuar.',
  'faq.2.q': 'Qual é a diferença entre o plano Mensal e o Anual?',
  'faq.2.a': 'Os dois planos incluem os mesmos recursos: detecção enquanto você a mantiver ativa, sequência atual e melhor sequência, histórico completo com tags de gatilhos, e som, flash ou os dois. O plano Anual é cobrado uma única vez, por {pYearly} (cerca de {pMonthlyEq} por mês, uma economia de {pSave} em relação à cobrança mensal de {pMonthly}), e inclui suporte prioritário.',
  'faq.3.q': 'Como funcionam os pagamentos?',
  'faq.3.a': 'Os pagamentos são processados pelo Paddle, um merchant of record seguro. O Stop Biting nunca vê nem armazena os dados do seu cartão.',
  'faq.4.q': 'Posso cancelar quando quiser?',
  'faq.4.a': 'Sim. Cancele quando quiser nas configurações do app e você mantém o acesso até o fim do período pago. Veja a <link>política de reembolso</link> para mais detalhes.',

  'cta.heading': 'Experimente grátis por {trialDays, plural, one {# dia} other {# dias}}.',
  'cta.note': 'Sem cartão para começar. Quer saber mais antes? Leia <how>como a detecção funciona</how> ou <calc>calcule quanto roer as unhas custa para você</calc>.',
};
