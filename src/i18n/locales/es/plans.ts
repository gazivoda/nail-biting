// NEEDS NATIVE REVIEW (machine draft). Scope "plans", locale es.
import type { messages as en } from '../../scopes/plans';

export const messages: Record<keyof typeof en, string> = {
  'extras.label': 'Otras formas de comprar',
  'plan.lifetime': 'De por vida',
  'lifetime.once': 'una sola vez',
  'lifetime.priceAtCheckout': 'El precio se muestra al pagar',
  'lifetime.band.body': 'Paga una sola vez en lugar de cada mes o cada año. Incluye todo lo del plan mensual, sin renovaciones, mientras Stop Biting esté disponible. Empieza la prueba gratuita y luego elige De por vida en la app.',
  'lifetime.band.cta': 'Empezar la prueba gratuita',
  'gift.title': 'Regálalo',
  'gift.body.length': 'Compra {length} de Stop Biting para otra persona. Te enviamos por correo un enlace para que se lo pases. Esa persona inicia sesión, lo abre y lo canjea una sola vez. El regalo empieza cuando ninguna prueba ni suscripción la cubre.',
  'gift.body.plain': 'Compra acceso a Stop Biting para otra persona. Te enviamos por correo un enlace para que se lo pases. Esa persona inicia sesión, lo abre y lo canjea una sola vez. El regalo empieza cuando ninguna prueba ni suscripción la cubre.',
  'gift.thanks': 'Gracias. El enlace del regalo se está enviando al correo con el que pagaste. Puede tardar unos minutos.',
  'gift.failed': 'No se pudo cargar el pago. Si usas un bloqueador de anuncios, permite paddle.com en este sitio y recarga la página, o escribe a hello@stopbiting.today.',
  'gift.buy': 'Comprar un regalo',
  'length.years': '{count, plural, one {un año} other {{count} años}}',
  'length.months': '{count, plural, one {un mes} other {{count} meses}}',
  'length.days': '{count, plural, one {un día} other {{count} días}}',
};
