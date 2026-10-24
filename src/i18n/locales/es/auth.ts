// NEEDS NATIVE REVIEW (machine draft). Scope "auth", locale es.
import type { messages as en } from '../../scopes/auth';

export const messages: Record<keyof typeof en, string> = {
  'page.title': 'Iniciar sesión | Stop Biting',

  'finish.title': 'Termina de iniciar sesión',
  'finish.body': 'Pulsa el botón para iniciar sesión en este dispositivo. Abrir el enlace del correo por sí solo no inicia la sesión de nadie.',
  'finish.button': 'Iniciar sesión en Stop Biting',
  'finish.working': 'Iniciando sesión…',

  'intro.title': 'Inicia sesión o empieza tu prueba gratuita',
  'intro.body': 'Elige cómo quieres iniciar sesión. ¿Primera vez por aquí? Las mismas opciones inician tu prueba. ¿Ya tienes una cuenta? Volverás a iniciar sesión.',
  'checking': 'Buscando más opciones…',
  'divider.or': 'o',

  'provider.google': 'Iniciar sesión con Google',
  'provider.apple': 'Iniciar sesión con Apple',
  'provider.microsoft': 'Iniciar sesión con Microsoft',

  'email.label': 'Correo electrónico',
  'email.placeholder': 'you@example.com',
  'email.send': 'Envíame un enlace de acceso por correo',
  'email.sending': 'Enviando…',
  'sent.title': 'Revisa tu bandeja de entrada',
  'sent.body': 'Un enlace de acceso va de camino a <b>{email}</b>. Funciona una sola vez y caduca en 15 minutos. Si no ha llegado después de un par de minutos, revisa la carpeta de spam.',
  'sent.again': 'Enviar otro enlace',
  'sent.againWait': 'Enviar otro enlace ({seconds}s)',
  'sent.different': 'Usar otro correo',

  'terms': 'Al continuar, aceptas los <terms>Términos</terms> y la <privacy>Política de privacidad</privacy>.',

  'error.invalidEmail': 'Eso no parece una dirección de correo electrónico. Compruébala e inténtalo de nuevo.',
  'error.tooMany': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'error.sendFailed': 'No pudimos enviar el correo. Inténtalo de nuevo en un momento.',
  'error.finishFailed': 'No pudimos terminar de iniciar tu sesión. Solicita un enlace nuevo.',
  'error.who.default': 'Tu proveedor de inicio de sesión',
  'error.cancelled': 'Se canceló el inicio de sesión, así que no se configuró nada. Puedes volver a intentarlo cuando quieras.',
  'error.unverified': '{who} no confirmó que esta dirección de correo te pertenece, así que no la conectamos con una cuenta existente. Usa en su lugar el enlace de acceso por correo: demuestra que puedes leer esa bandeja de entrada.',
  'error.generic': 'El inicio de sesión no se completó, así que no se configuró nada. Inténtalo de nuevo.',
  'link.expired': 'Ese enlace de acceso ha caducado. Los enlaces funcionan durante 15 minutos. Escribe tu correo y te enviaremos uno nuevo.',
  'link.used': 'Ese enlace de acceso ya se usó. Cada enlace funciona una sola vez. Escribe tu correo y te enviaremos uno nuevo.',
  'link.invalid': 'Ese enlace de acceso no es válido. Escribe tu correo y te enviaremos uno nuevo.',
};
