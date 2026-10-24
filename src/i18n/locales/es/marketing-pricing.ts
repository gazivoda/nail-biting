// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-pricing", locale es.
import type { messages as en } from '../../scopes/marketing-pricing';

export const messages: Record<keyof typeof en, string> = {
  'bc.pricing': 'Precios',

  'includes.heading': 'Qué incluye cada plan',
  'faq.heading': 'Preguntas sobre los precios',

  'faq.1.q': '¿Cómo funciona la prueba gratuita de {trialDays, plural, one {# día} other {# días}}?',
  'faq.1.a': 'Cada cuenta empieza con una prueba gratuita de {trialDays, plural, one {# día} other {# días}} que incluye todas las funciones de detección y seguimiento, sin necesidad de tarjeta de crédito. Cuando termine la prueba, elige el plan mensual o el anual para seguir.',
  'faq.2.q': '¿Cuál es la diferencia entre el plan mensual y el anual?',
  'faq.2.a': 'Los dos planes incluyen las mismas funciones: detección mientras la mantengas activa, racha actual y mejor racha, historial completo con etiquetas de desencadenantes, y sonido, destello o ambos. El plan anual se cobra una sola vez por {pYearly} (unos {pMonthlyEq} al mes, con un ahorro del {pSave} frente a los {pMonthly} del plan mensual) e incluye soporte prioritario.',
  'faq.3.q': '¿Cómo funcionan los pagos?',
  'faq.3.a': 'Los pagos los gestiona Paddle, un comerciante de registro (merchant of record) seguro. Stop Biting nunca ve ni almacena los datos de tu tarjeta.',
  'faq.4.q': '¿Puedo cancelar cuando quiera?',
  'faq.4.a': 'Sí. Cancela cuando quieras desde los ajustes de la app y conservas el acceso hasta el final del periodo pagado. Consulta la <link>política de reembolso</link> para más detalles.',

  'cta.heading': 'Pruébalo gratis durante {trialDays, plural, one {# día} other {# días}}.',
  'cta.note': 'Sin tarjeta para empezar. ¿Quieres saber más antes? Lee <how>cómo funciona la detección</how> o <calc>calcula cuánto te cuesta morderte las uñas</calc>.',
};
