// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-about", locale pt-BR.
import type { messages as en } from '../../scopes/marketing-about';

export const messages: Record<keyof typeof en, string> = {
  'bc.about': 'Sobre',
  'hero.title': 'Sobre o Stop <hl>Biting</hl>',
  'hero.lede': 'Criado por alguém que roía as unhas, para quem rói as unhas. Veja por que este app existe.',

  'story.heading': 'A história do fundador',
  'story.p1': 'Eu sou Igor Gazivoda, desenvolvedor de software. Roí as unhas por mais de 20 anos. Não de vez em quando: o tempo todo, no automático, sem perceber até o estrago já estar feito.',
  'story.p2': 'Tentei de tudo: esmalte amargo, pulseiras de lembrete, pura força de vontade. Tudo falhava do mesmo jeito. O hábito é automático. Acontece abaixo do limiar da consciência. Quando eu percebia que a mão estava na boca, já fazia 30 segundos que eu estava roendo.',
  'story.p3': 'Quando li as pesquisas sobre o treinamento de reversão de hábito (HRT), entendi por que tudo o mais tinha falhado. A ideia central da HRT é que a consciência é o gargalo: você não consegue interromper um hábito que não sabe que está acontecendo. O tratamento de referência começa, literalmente, com o "treino de consciência" antes de qualquer outra coisa.',
  'story.p4': 'Eu tinha uma webcam. Sabia programar. Sabia que o MediaPipe conseguia rodar o rastreamento de mãos direto no dispositivo. Então construí o componente de consciência, a parte da HRT mais difícil de fazer sozinho.',

  'does.heading': 'O que o Stop Biting faz',
  'does.p1': 'O Stop Biting usa a webcam do seu computador e o framework MediaPipe do Google (compilado para WebAssembly e executado inteiramente no seu navegador) para detectar quando sua mão se aproxima da boca. Quando isso acontece, um alarme sonoro toca.',
  'does.p2': 'Esse alarme é o sinal externo de consciência que as pesquisas sobre a HRT identificam como o componente mais importante do tratamento. Ele pega os episódios que o automonitoramento deixa passar. A maioria acontece sem você perceber.',
  'does.p3': 'O app também registra cada detecção com data e hora, para você ver a frequência real com que rói as unhas, e não a que imagina. Uma contagem real, em vez de um palpite, é o que transforma o hábito em algo em que você pode trabalhar.',

  'privacy.heading': 'Privacidade: o inegociável',
  'privacy.p1': 'O app usa sua webcam. Isso exige confiança. Eu o projetei para que essa confiança possa ser verificada, e não apenas prometida.',
  'privacy.p2': 'Todo o processamento de vídeo roda em WebAssembly no seu dispositivo. Nenhum vídeo, nenhum quadro e nenhuma detecção é transmitido. Você pode desconectar a internet depois que o app carregar e ele funcionará igual. Você pode conferir observando o tráfego de rede enquanto o app roda.',
  'privacy.p3': '{sync, select, on {Seu registro de alarmes e mordidas fica salvo no seu navegador e só é copiado para a sua conta se você ativar a sincronização.} other {Seu registro de alarmes e mordidas fica salvo no seu navegador.}} O site conta as visitas com o Google Analytics; isso nunca inclui nada da sua câmera.',

  'tech.heading': 'A tecnologia',
  'tech.p1': 'O modelo de detecção é baseado no <link>Hand Landmarker do Google MediaPipe</link>, que localiza 21 pontos da mão. O Stop Biting o executa cinco vezes por segundo. O modelo roda em WebAssembly (um formato de execução binária isolado, compatível com todos os navegadores modernos), ou seja, não tem acesso à rede e não consegue ler arquivos fora do ambiente isolado do navegador.',
  'tech.p2': 'A detecção de proximidade da boca compara, a cada quadro, as coordenadas dos pontos da mão com as dos pontos do rosto. Quando um ponto da mão fica dentro do limite de detecção da região da boca por um período contínuo, o alarme dispara.',

  'site.heading': 'Como este site é escrito',
  'site.p1': 'Cada artigo, guia e comparação aqui é escrito por mim. Sou desenvolvedor, não clínico, e a <link>página de política editorial e correções</link> diz exatamente o que isso significa para o que você lê: como as afirmações são embasadas, como tudo o que digo sobre um produto concorrente é conferido e como me avisar quando algo neste site estiver errado.',
};
