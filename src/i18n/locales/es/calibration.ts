// NEEDS NATIVE REVIEW (machine draft). Scope "calibration", locale es.
import type { messages as en } from '../../scopes/calibration';

export const messages: Record<keyof typeof en, string> = {
  'title.rest': 'Paso 1 de 2',
  'title.real': 'Paso 2 de 2',
  'title.between': 'A continuación: paso 2 de 2',
  'title.default': 'Calibrar',

  'camera.aria': 'Tu cámara',
  'link.starting': 'Iniciando la cámara…',
  'link.failed': 'No se pudo iniciar la cámara.',
  'link.models': 'No se pudo cargar la detección. Revisa tu conexión e inténtalo de nuevo.',
  'link.paused': 'La cámara está encendida. La detección está en pausa mientras calibras.',
  'seen.both': 'La cámara ve tu cara y tu mano.',
  'seen.faceOnly': 'La cámara ve tu cara. Todavía no ve tu mano.',
  'seen.none': 'La cámara no ve tu cara. Colócate de modo que tu cara salga en la imagen.',

  'intro.lead': 'Es opcional y dura aproximadamente un minuto. Ayuda a la app a distinguir apoyar la barbilla de la acción real. Harás dos cosas breves mientras la cámara te observa.',
  'instruction.rest': 'Apoya la barbilla en la mano como lo harías normalmente.',
  'instruction.real': 'Acerca la punta de un dedo a los labios.',
  'intro.privacy': 'No se graba nada. Solo se guardan, en este dispositivo, unos pocos números sobre dónde estuvo tu mano: ninguna imagen. No forman parte de tu historial, no se sincronizan ni se suben. Puedes borrarlos en Ajustes, en Detección. La vigilancia está en pausa mientras haces esto.',
  'start': 'Empezar',
  'notNow': 'Ahora no',

  'hold': 'Mantén la posición. {left, plural, one {Queda # segundo} other {Quedan # segundos}}.',
  'progress': '{count} de {needed} necesarios.',
  'between.lead': 'Aparta la mano.',
  'between.next': 'El paso 2 empieza en {left, plural, one {# segundo} other {# segundos}}: acercarás la punta de un dedo a los labios.',

  'announce.rest': 'Paso 1 de 2. Apoya la barbilla en la mano como lo harías normalmente. Mantén la posición.',
  'announce.between': 'Aparta la mano. El paso 2 empieza en unos segundos.',
  'announce.real': 'Paso 2 de 2. Acerca la punta de un dedo a los labios. Mantén la posición.',
  'announce.done': 'Listo. Puedes guardar el resultado o intentarlo de nuevo.',
  'announce.failed': 'No funcionó. Puedes intentarlo de nuevo.',
  'result.done': 'Listo.',
  'result.summary': 'La app vio {rest} fotogramas de ti apoyando la barbilla y {real} con la punta de un dedo cerca de los labios. Al guardar se conservan unos pocos números de ellos, en este dispositivo, y la regla del apoyo de barbilla los usará.',
  'result.failed': 'Eso no funcionó.',
  'failure.noRest': 'La cámara no vio tu mano apoyada en la barbilla durante el tiempo suficiente. Inténtalo de nuevo con la mano a la vista.',
  'failure.noReal': 'La cámara no vio la punta de un dedo cerca de los labios durante el tiempo suficiente. Inténtalo de nuevo con la mano a la vista.',
  'failure.noEither': 'La cámara no vio tu mano. Comprueba que tu cara y tu mano salgan en la imagen e inténtalo de nuevo.',
};
