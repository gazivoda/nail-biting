// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-meta", locale es.
import type { messages as en } from '../../scopes/marketing-meta';

export const messages: Record<keyof typeof en, string> = {
  'pricing.title': 'Precios: {pMonthly}/mes o {pYearlyShort}/año | Stop Biting',
  'pricing.description': 'Precios de Stop Biting: prueba gratuita de {trialDays, plural, one {# día} other {# días}}, sin tarjeta. Después, {pMonthly}/mes o {pYearlyShort}/año (unos {pMonthlyEq}/mes, ahorra un {pSave}). Cancela cuando quieras.',
  'pricing.name': 'Precios de Stop Biting',
  'pricing.schemaDescription': 'Precios de Stop Biting: prueba gratuita de {trialDays, plural, one {# día} other {# días}}, luego {pMonthly}/mes o {pYearlyShort}/año.',
  'pricing.faqName': 'Preguntas sobre los precios de Stop Biting',

  'about.title': 'Acerca de Stop Biting | Creada por Igor Gazivoda',
  'about.description': 'Creada por Igor Gazivoda, un desarrollador que se mordió las uñas durante 20 años. Detección con IA en tu dispositivo: no se envían datos de la cámara mientras funciona.',
  'about.name': 'Acerca de Stop Biting',
  'about.personDescription': 'Igor Gazivoda es el fundador de Stop Biting, una app con IA en el dispositivo para detectar cuándo te muerdes las uñas, creada con MediaPipe y WebAssembly.',

  'app.description': 'App web que usa tu cámara web y una IA que se ejecuta en tu dispositivo (MediaPipe) para detectar en tiempo real cuándo te muerdes las uñas (onicofagia). Hace sonar una alarma en el momento en que tu mano se acerca a la boca. Incluye seguimiento de rachas, registro de incidentes, orientación de entrenamiento de reversión de hábito (HRT) e historial de mordiscos de 7 días. No se envían datos de la cámara mientras funciona.',
  'app.os': 'Navegador web (Mac o Windows)',
  'app.offer.trial.name': 'Prueba gratuita',
  'app.offer.trial.description': 'Todas las funciones de detección y seguimiento durante una prueba gratuita de {trialDays, plural, one {# día} other {# días}}. No hace falta tarjeta de crédito.',
  'app.offer.monthly.name': 'Mensual',
  'app.offer.monthly.description': 'Detección con IA sin límites, seguimiento de rachas, historial completo de incidentes y todos los tipos de alerta',
  'app.offer.yearly.name': 'Anual',
  'app.offer.yearly.description': 'Todo lo del plan mensual más soporte prioritario: ahorras un {pSave} frente al pago mensual',
  'app.feature.1': 'Detección en tiempo real de morderse las uñas con IA y la cámara web',
  'app.feature.2': 'Detección en tu dispositivo: no se envían datos de la cámara mientras funciona',
  'app.feature.3': 'Alertas sonoras y visuales cuando se detecta que te muerdes las uñas',
  'app.feature.4': 'Seguimiento de rachas y tu mejor marca de siempre',
  'app.feature.5': 'Registro de incidentes con etiquetas de desencadenantes (estrés, concentración, aburrimiento)',
  'app.feature.6': 'Gráfico de frecuencia de mordiscos de 7 días',
  'app.feature.7': 'Orientación de entrenamiento de reversión de hábito (HRT) integrada',
  'app.feature.8': 'Funciona como PWA: instálala directamente desde el navegador, sin tienda de apps',
  'app.feature.9': 'Demo en vivo gratuita de 60 segundos: prueba la detección en el navegador, sin registrarte',
  'image.caption': 'La pantalla Vigilar de Stop Biting, con datos de ejemplo.',

  'nav.home': 'Stop Biting: detección con IA de morderse las uñas',
  'nav.how': 'Cómo funciona la detección con IA de morderse las uñas',
  'nav.pricing': 'Precios: prueba gratuita, {pMonthly}/mes o {pYearlyShort}/año',
  'nav.about': 'Acerca de Stop Biting',

  'notfound.title': 'Página no encontrada | Stop Biting',
  'notfound.h1': 'Esta página no existe.',
  'notfound.p': 'Puede que el enlace esté roto o que la página se haya movido. La app, las guías y todo lo demás siguen donde estaban.',
  'notfound.home': 'Ir a la página de inicio',
  'notfound.blog': 'Leer las guías',
};
