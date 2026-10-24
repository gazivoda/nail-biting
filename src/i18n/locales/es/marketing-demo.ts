// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-demo", locale es.
import type { messages as en } from '../../scopes/marketing-demo';

export const messages: Record<keyof typeof en, string> = {
  'start': 'Probar la demo en vivo',
  'retry': 'Intentar de nuevo',
  'again': 'Volver a ejecutar',
  'loading': 'Descargando modelos de IA (~20 MB, una sola vez)…',
  'hint': 'Acerca la yema de un dedo a los labios para oír la alarma',
  'offer': '{trialDays, plural, one {# día} other {# días}} gratis, sin tarjeta',
  'result': '{count, plural, =0 {No se detectó nada en 60 segundos. Vuelve a ejecutarla y toca tus labios para oír la alarma.} one {Te detectó una vez en 60 segundos. La app hace esto todo el día, mientras trabajas.} other {Te detectó # veces en 60 segundos. La app hace esto todo el día, mientras trabajas.}}',
  'catch': 'Esa es la alarma. Detectado {count, plural, one {una vez} other {# veces}} hasta ahora.',
  'failure': 'Aun así puedes <trial>empezar la prueba gratuita</trial> ({offer}) o leer <how>cómo funciona la detección</how>.',
};
