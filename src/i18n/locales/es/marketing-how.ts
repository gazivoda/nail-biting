// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-how", locale es.
import type { messages as en } from '../../scopes/marketing-how';

export const messages: Record<keyof typeof en, string> = {
  'bc.how': 'Cómo funciona',
  'hero.title': 'Cómo funciona la <hl>detección</hl> con IA de morderse las uñas',
  'hero.lede': 'Stop Biting usa MediaPipe y WebAssembly para detectar en tiempo real cuándo te muerdes las uñas, por completo en tu dispositivo. El Hand Landmarker de MediaPipe sigue 21 puntos de la mano, y la alarma suena unos 0,6 segundos después de que ve tu mano acercarse a la boca. La configuración lleva menos de dos minutos.',
  'figure.alt': 'Pantalla Vigilar de Stop Biting con un contador grande de racha, las alarmas y los mordiscos de hoy, y la detección en marcha.',
  'figure.caption': 'La pantalla Vigilar (la captura está en inglés), con datos de ejemplo.',

  'why.heading': 'Por qué la conciencia es el cuello de botella',
  'why.body': 'La mayoría de los episodios ocurren sin que te des cuenta: el hábito es automático y se desarrolla por debajo del umbral de la conciencia. El <link>entrenamiento de reversión de hábito</link> (el tratamiento de referencia) identifica el entrenamiento en conciencia como su componente más importante. Stop Biting automatiza ese componente: detecta los episodios que no notas.',

  'steps.heading': 'Primeros pasos',
  'step.1.title': 'Abre la app',
  'step.1.body': 'Entra en stopbiting.today con Chrome, Edge o Firefox. No hay nada que instalar.',
  'step.2.title': 'Permite el acceso a la cámara',
  'step.2.body': 'Permite el acceso a la cámara web. El video se procesa por completo en tu dispositivo con MediaPipe, que se ejecuta en WebAssembly. No se envían datos de la cámara mientras funciona.',
  'step.3.title': 'Coloca tu cámara',
  'step.3.body': 'Asegúrate de que tu cara y tus manos se vean en la imagen de la cámara. La IA sigue 21 puntos de la mano y detecta cuándo se acercan a la zona de la boca.',
  'step.4.title': 'Trabaja, juega o estudia con normalidad',
  'step.4.body': 'Stop Biting funciona en segundo plano y comprueba cinco veces por segundo. Necesita tres fotogramas seguidos antes de actuar, así que la alarma suena unas seis décimas de segundo después de que tu mano empiece a moverse hacia la boca.',
  'step.5.title': 'Responde a la alarma',
  'step.5.body': 'La alarma es tu señal de conciencia. Haz el ejercicio de manos que sugiere la app, como apoyar las palmas planas o apretar el puño: una respuesta competitiva que tus manos no pueden hacer mientras te muerdes. Hacerlo cada vez es el núcleo del entrenamiento de reversión de hábito.',

  'specs.heading': 'Especificaciones técnicas',
  'spec.1.label': 'Modelo de detección',
  'spec.1.value': 'Hand Landmarker de Google MediaPipe (21 puntos)',
  'spec.2.label': 'Procesamiento',
  'spec.2.value': 'WebAssembly: aislado, se ejecuta en tu dispositivo',
  'spec.3.label': 'Latencia de la alarma',
  'spec.3.value': 'Unos 0,6 segundos después de que tu mano empiece a moverse hacia la boca',
  'spec.4.label': 'Registro de incidentes',
  'spec.4.value': '{sync, select, on {Registro con marca de tiempo guardado en local; solo se envía a tu cuenta si activas la sincronización} other {Registro con marca de tiempo guardado en local, nunca se transmite}}',

  'faq.heading': 'Preguntas frecuentes',
  'faq.1.q': '¿Qué pasa con los datos de mi cámara?',
  'faq.1.a': 'Se procesan fotograma a fotograma en tu dispositivo con el binario WASM de MediaPipe, que se ejecuta en local. No se envían datos de la cámara mientras funciona. {sync, select, on {Iniciar sesión, pagar y, si lo activas, sincronizar usan la red} other {Iniciar sesión y pagar usan la red}}, y puedes comprobarlo tú mismo observando el tráfico de red mientras la app funciona.',
  'faq.2.q': '¿Funciona en Mac, Windows y Linux?',
  'faq.2.a': 'La app web funciona en cualquier dispositivo con un navegador moderno y una cámara web: Mac, Windows, Linux y Chromebook.',
  'faq.3.q': '¿Dará falsas alarmas cuando como o me toco la cara?',
  'faq.3.a': 'El modelo de detección distingue la proximidad sostenida de la mano a la boca de los roces breves, y la sensibilidad se puede ajustar en los ajustes.',
  'faq.4.q': '¿Funciona si no estoy frente a la cámara?',
  'faq.4.a': 'La detección necesita que tu cara y tus manos estén en el encuadre. En un escritorio, normalmente ya lo estás.',
  'faq.5.q': '¿Funciona en la oscuridad?',
  'faq.5.a': 'La precisión de la detección baja con mala iluminación. Basta con una lámpara de escritorio o la luz normal de la habitación; no necesitas nada especial.',

  'learn.heading': 'Para saber más',
  'learn.note': 'Estos artículos están en inglés.',
  // article titles: the articles are English only, so the titles stay as they are
  'link.1': 'Habit Reversal Training: the clinical method behind the app',
  'link.2': 'Stop Biting app review: what to expect in the first two weeks',
  'link.3': 'How we verified on-device processing',
  'link.4': 'Stop Biting vs bitter nail polish: which works?',
};
