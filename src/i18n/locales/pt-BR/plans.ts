// NEEDS NATIVE REVIEW (machine draft). Scope "plans", locale pt-BR.
import type { messages as en } from '../../scopes/plans';

export const messages: Record<keyof typeof en, string> = {
  'extras.label': 'Outras formas de comprar',
  'plan.lifetime': 'Vitalício',
  'lifetime.once': 'uma única vez',
  'lifetime.priceAtCheckout': 'O preço é exibido no pagamento',
  'lifetime.band.body': 'Pague uma única vez em vez de todo mês ou todo ano. Inclui tudo do plano mensal, sem renovações, enquanto o Stop Biting estiver disponível. Comece o teste grátis e depois escolha Vitalício no app.',
  'lifetime.band.cta': 'Começar o teste grátis',
  'gift.title': 'Dê de presente',
  'gift.body.length': 'Compre {length} de Stop Biting para outra pessoa. Enviamos um link por e-mail para você repassar. A pessoa entra, abre o link e o resgata uma única vez. O presente começa quando nenhum teste ou assinatura estiver cobrindo a pessoa.',
  'gift.body.plain': 'Compre acesso ao Stop Biting para outra pessoa. Enviamos um link por e-mail para você repassar. A pessoa entra, abre o link e o resgata uma única vez. O presente começa quando nenhum teste ou assinatura estiver cobrindo a pessoa.',
  'gift.thanks': 'Obrigado. O link do presente está sendo enviado para o e-mail com o qual você pagou. Pode levar alguns minutos.',
  'gift.failed': 'Não foi possível carregar o pagamento. Se você usa um bloqueador de anúncios, permita paddle.com neste site e recarregue a página, ou escreva para hello@stopbiting.today.',
  'gift.buy': 'Comprar um presente',
  'length.years': '{count, plural, one {um ano} other {{count} anos}}',
  'length.months': '{count, plural, one {um mês} other {{count} meses}}',
  'length.days': '{count, plural, one {um dia} other {{count} dias}}',
};
