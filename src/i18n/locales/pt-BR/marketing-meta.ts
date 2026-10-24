// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-meta", locale pt-BR.
import type { messages as en } from '../../scopes/marketing-meta';

export const messages: Record<keyof typeof en, string> = {
  'pricing.title': 'Preços: {pMonthly}/mês ou {pYearlyShort}/ano | Stop Biting',
  'pricing.description': 'Preços do Stop Biting: teste grátis de {trialDays, plural, one {# dia} other {# dias}}, sem cartão. Depois, {pMonthly}/mês ou {pYearlyShort}/ano (cerca de {pMonthlyEq}/mês, economize {pSave}). Cancele quando quiser.',
  'pricing.name': 'Preços do Stop Biting',
  'pricing.schemaDescription': 'Preços do Stop Biting: teste grátis de {trialDays, plural, one {# dia} other {# dias}}, depois {pMonthly}/mês ou {pYearlyShort}/ano.',
  'pricing.faqName': 'Perguntas sobre os preços do Stop Biting',

  'about.title': 'Sobre o Stop Biting | Criado por Igor Gazivoda',
  'about.description': 'Criado por Igor Gazivoda, um desenvolvedor que roeu as unhas por 20 anos. Detecção por IA no dispositivo: nenhum dado da câmera é enviado enquanto ela funciona.',
  'about.name': 'Sobre o Stop Biting',
  'about.personDescription': 'Igor Gazivoda é o fundador do Stop Biting, um app com IA no dispositivo para detectar quando você rói as unhas, criado com MediaPipe e WebAssembly.',

  'how.title': 'Como funciona a detecção de roer unhas com IA | Stop Biting',
  'how.description': 'O Stop Biting usa MediaPipe e WebAssembly para detectar em tempo real quando você rói as unhas, no seu dispositivo. Nenhum dado da câmera é enviado enquanto ele funciona.',
  'how.name': 'Como funciona a detecção de roer unhas com IA',
  'how.howtoName': 'Como usar o Stop Biting para detectar quando você rói as unhas',
  'how.howtoDescription': 'Configure a detecção de roer unhas com IA em tempo real em menos de 2 minutos usando sua webcam.',

  'app.description': 'App web que usa sua webcam e uma IA que roda no seu dispositivo (MediaPipe) para detectar em tempo real quando você rói as unhas (onicofagia). Toca um alarme no momento em que sua mão se aproxima da boca. Inclui acompanhamento de sequências, registro de ocorrências, orientação de treinamento de reversão de hábito (HRT) e histórico de mordidas de 7 dias. Nenhum dado da câmera é enviado enquanto ela funciona.',
  'app.os': 'Navegador web (Mac ou Windows)',
  'app.offer.trial.name': 'Teste grátis',
  'app.offer.trial.description': 'Todos os recursos de detecção e acompanhamento durante um teste grátis de {trialDays, plural, one {# dia} other {# dias}}. Sem necessidade de cartão de crédito.',
  'app.offer.monthly.name': 'Mensal',
  'app.offer.monthly.description': 'Detecção por IA ilimitada, acompanhamento de sequências, histórico completo de ocorrências e todos os tipos de alerta',
  'app.offer.yearly.name': 'Anual',
  'app.offer.yearly.description': 'Tudo do plano mensal mais suporte prioritário: economize {pSave} em relação à cobrança mensal',
  'app.feature.1': 'Detecção em tempo real de roer as unhas com IA e webcam',
  'app.feature.2': 'Detecção no dispositivo: nenhum dado da câmera é enviado enquanto ela funciona',
  'app.feature.3': 'Alertas sonoros e visuais quando roer as unhas é detectado',
  'app.feature.4': 'Acompanhamento de sequências e seu melhor recorde de todos os tempos',
  'app.feature.5': 'Registro de ocorrências com tags de gatilhos (estresse, foco, tédio)',
  'app.feature.6': 'Gráfico de frequência de mordidas dos últimos 7 dias',
  'app.feature.7': 'Orientação de treinamento de reversão de hábito (HRT) integrada',
  'app.feature.8': 'Funciona como PWA: instale direto do navegador, sem loja de aplicativos',
  'app.feature.9': 'Demonstração ao vivo gratuita de 60 segundos: teste a detecção no navegador, sem cadastro',
  'image.caption': 'A tela Monitorar do Stop Biting, com dados de exemplo.',

  'nav.home': 'Stop Biting: detecção de roer unhas com IA',
  'nav.how': 'Como funciona a detecção de roer unhas com IA',
  'nav.pricing': 'Preços: teste grátis, {pMonthly}/mês ou {pYearlyShort}/ano',
  'nav.about': 'Sobre o Stop Biting',

  'notfound.title': 'Página não encontrada | Stop Biting',
  'notfound.h1': 'Esta página não existe.',
  'notfound.p': 'O link pode estar quebrado ou a página pode ter sido movida. O app, os guias e todo o resto continuam onde estavam.',
  'notfound.home': 'Ir para a página inicial',
  'notfound.blog': 'Ler os guias',
};
