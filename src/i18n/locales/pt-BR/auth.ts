// NEEDS NATIVE REVIEW (machine draft). Scope "auth", locale pt-BR.
import type { messages as en } from '../../scopes/auth';

export const messages: Record<keyof typeof en, string> = {
  'page.title': 'Entrar | Stop Biting',

  'finish.title': 'Conclua a entrada',
  'finish.body': 'Toque no botão para entrar neste dispositivo. Abrir o link do e-mail por si só não faz ninguém entrar.',
  'finish.button': 'Entrar no Stop Biting',
  'finish.working': 'Entrando…',

  'intro.title': 'Entre ou comece seu teste grátis',
  'intro.body': 'Escolha como você quer entrar. Primeira vez aqui? As mesmas opções iniciam seu teste. Já tem uma conta? Você entrará novamente.',
  'checking': 'Verificando mais opções…',
  'divider.or': 'ou',

  'provider.google': 'Fazer login com o Google',
  'provider.apple': 'Fazer login com a Apple',
  'provider.microsoft': 'Fazer login com a Microsoft',

  'email.label': 'Endereço de e-mail',
  'email.placeholder': 'you@example.com',
  'email.send': 'Enviar um link de acesso por e-mail',
  'email.sending': 'Enviando…',
  'sent.title': 'Verifique sua caixa de entrada',
  'sent.body': 'Um link de acesso está a caminho de <b>{email}</b>. Ele funciona uma única vez e expira em 15 minutos. Se não chegar depois de alguns minutos, verifique sua pasta de spam.',
  'sent.again': 'Enviar outro link',
  'sent.againWait': 'Enviar outro link ({seconds}s)',
  'sent.different': 'Usar outro e-mail',

  'terms': 'Ao continuar, você concorda com os <terms>Termos</terms> e a <privacy>Política de Privacidade</privacy>.',

  'error.invalidEmail': 'Isso não parece um endereço de e-mail. Confira e tente novamente.',
  'error.tooMany': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'error.sendFailed': 'Não foi possível enviar o e-mail. Tente novamente em instantes.',
  'error.finishFailed': 'Não foi possível concluir sua entrada. Solicite um novo link.',
  'error.who.default': 'Seu provedor de login',
  'error.cancelled': 'A entrada foi cancelada, então nada foi configurado. Você pode tentar de novo quando quiser.',
  'error.unverified': '{who} não confirmou que este endereço de e-mail pertence a você, então não o conectamos a uma conta existente. Use o link de acesso por e-mail: ele prova que você consegue ler essa caixa de entrada.',
  'error.generic': 'A entrada não foi concluída, então nada foi configurado. Tente novamente.',
  'link.expired': 'Esse link de acesso expirou. Os links funcionam por 15 minutos. Informe seu e-mail e enviaremos um novo.',
  'link.used': 'Esse link de acesso já foi usado. Cada link funciona uma única vez. Informe seu e-mail e enviaremos um novo.',
  'link.invalid': 'Esse link de acesso não é válido. Informe seu e-mail e enviaremos um novo.',
};
