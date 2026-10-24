// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-how", locale pt-BR.
import type { messages as en } from '../../scopes/marketing-how';

export const messages: Record<keyof typeof en, string> = {
  'bc.how': 'Como funciona',
  'hero.title': 'Como funciona a <hl>detecção</hl> de roer unhas com IA',
  'hero.lede': 'O Stop Biting usa MediaPipe e WebAssembly para detectar em tempo real quando você rói as unhas, tudo no seu dispositivo. O Hand Landmarker do MediaPipe acompanha 21 pontos da mão, e o alarme toca cerca de 0,6 segundo depois que ele vê sua mão se aproximar da boca. A configuração leva menos de dois minutos.',
  'figure.alt': 'Tela Monitorar do Stop Biting com um contador grande de sequência, os alarmes e as mordidas de hoje e a detecção em execução.',
  'figure.caption': 'A tela Monitorar (a captura está em inglês), com dados de exemplo.',

  'why.heading': 'Por que a consciência é o gargalo',
  'why.body': 'A maioria dos episódios acontece sem você perceber: o hábito é automático e ocorre abaixo do limiar da consciência. O <link>treinamento de reversão de hábito</link> (o tratamento de referência) identifica o treino de consciência como seu componente mais importante. O Stop Biting automatiza esse componente: ele pega os episódios que você não percebe.',

  'steps.heading': 'Como começar',
  'step.1.title': 'Abra o app',
  'step.1.body': 'Acesse stopbiting.today no Chrome, no Edge ou no Firefox. Não há nada para instalar.',
  'step.2.title': 'Permita o acesso à câmera',
  'step.2.body': 'Permita o acesso à webcam. O vídeo é processado inteiramente no seu dispositivo pelo MediaPipe, que roda em WebAssembly. Nenhum dado da câmera é enviado enquanto ele funciona.',
  'step.3.title': 'Posicione a câmera',
  'step.3.body': 'Garanta que seu rosto e suas mãos apareçam na imagem da câmera. A IA acompanha 21 pontos da mão e detecta quando eles se aproximam da região da boca.',
  'step.4.title': 'Trabalhe, jogue ou estude normalmente',
  'step.4.body': 'O Stop Biting roda em segundo plano, verificando cinco vezes por segundo. Ele precisa de três quadros seguidos antes de agir, então o alarme toca cerca de seis décimos de segundo depois que sua mão começa a se mover em direção à boca.',
  'step.5.title': 'Responda ao alarme',
  'step.5.body': 'O alarme é o seu sinal de consciência. Faça o exercício de mãos que o app sugere, como apoiar as palmas planas ou fechar o punho: uma resposta competitiva que suas mãos não conseguem fazer enquanto roem. Fazer isso toda vez é o núcleo do treinamento de reversão de hábito.',

  'specs.heading': 'Especificações técnicas',
  'spec.1.label': 'Modelo de detecção',
  'spec.1.value': 'Hand Landmarker do Google MediaPipe (21 pontos)',
  'spec.2.label': 'Processamento',
  'spec.2.value': 'WebAssembly: isolado, roda no seu dispositivo',
  'spec.3.label': 'Latência do alarme',
  'spec.3.value': 'Cerca de 0,6 segundo depois que sua mão começa a se mover em direção à boca',
  'spec.4.label': 'Registro de ocorrências',
  'spec.4.value': '{sync, select, on {Registro com data e hora guardado localmente; só é enviado à sua conta se você ativar a sincronização} other {Registro com data e hora guardado localmente, nunca transmitido}}',

  'faq.heading': 'Perguntas frequentes',
  'faq.1.q': 'O que acontece com os dados da minha câmera?',
  'faq.1.a': 'Eles são processados quadro a quadro no seu dispositivo pelo binário WASM do MediaPipe, executado localmente. Nenhum dado da câmera é enviado enquanto ele funciona. {sync, select, on {Entrar, pagar e, se você ativar, sincronizar usam a rede} other {Entrar e pagar usam a rede}}, e você mesmo pode conferir observando o tráfego de rede enquanto o app roda.',
  'faq.2.q': 'Funciona em Mac, Windows e Linux?',
  'faq.2.a': 'O app web funciona em qualquer dispositivo com navegador moderno e webcam: Mac, Windows, Linux e Chromebook.',
  'faq.3.q': 'Vai dar falso alarme quando eu estiver comendo ou tocando o rosto?',
  'faq.3.a': 'O modelo de detecção distingue a proximidade sustentada da mão com a boca de toques breves, e a sensibilidade pode ser ajustada nas configurações.',
  'faq.4.q': 'Funciona se eu não estiver na frente da câmera?',
  'faq.4.a': 'A detecção precisa que seu rosto e suas mãos estejam no quadro. Em uma mesa de trabalho, você geralmente já está.',
  'faq.5.q': 'Funciona no escuro?',
  'faq.5.a': 'A precisão da detecção cai com pouca luz. Uma luminária de mesa ou a luz normal do ambiente bastam; você não precisa de nada especial.',

  'learn.heading': 'Saiba mais',
  'learn.note': 'Estes artigos estão em inglês.',
  // article titles: the articles are English only, so the titles stay as they are
  'link.1': 'Habit Reversal Training: the clinical method behind the app',
  'link.2': 'Stop Biting app review: what to expect in the first two weeks',
  'link.3': 'How we verified on-device processing',
  'link.4': 'Stop Biting vs bitter nail polish: which works?',
};
