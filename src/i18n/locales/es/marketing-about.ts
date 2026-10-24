// NEEDS NATIVE REVIEW (machine draft). Scope "marketing-about", locale es.
import type { messages as en } from '../../scopes/marketing-about';

export const messages: Record<keyof typeof en, string> = {
  'bc.about': 'Acerca de',
  'hero.title': 'Acerca de Stop <hl>Biting</hl>',
  'hero.lede': 'Creada por alguien que se mordía las uñas, para quienes se las muerden. Esta es la razón por la que existe esta app.',

  'story.heading': 'La historia del fundador',
  'story.p1': 'Soy Igor Gazivoda, desarrollador de software. Me mordí las uñas durante más de 20 años. No de vez en cuando: constantemente, de forma automática, sin darme cuenta hasta que el daño ya estaba hecho.',
  'story.p2': 'Lo probé todo: esmalte amargo, pulseras recordatorias, pura fuerza de voluntad. Todo fallaba de la misma manera. El hábito es automático. Ocurre por debajo del umbral de la conciencia. Cuando notaba que tenía la mano en la boca, ya llevaba 30 segundos mordiéndome.',
  'story.p3': 'Cuando leí la investigación sobre el entrenamiento de reversión de hábito (HRT), entendí por qué todo lo demás había fallado. La idea central de la HRT es que la conciencia es el cuello de botella: no puedes interrumpir un hábito si no sabes que está ocurriendo. El tratamiento de referencia empieza, literalmente, con el «entrenamiento en conciencia» antes que nada.',
  'story.p4': 'Tenía una cámara web. Sabía programar. Sabía que MediaPipe podía hacer seguimiento de manos en el propio dispositivo. Así que construí el componente de conciencia, la parte de la HRT que más cuesta hacer solo.',

  'does.heading': 'Qué hace Stop Biting',
  'does.p1': 'Stop Biting usa la cámara web de tu computadora y el framework MediaPipe de Google (compilado a WebAssembly y ejecutado por completo en tu navegador) para detectar cuándo tu mano se acerca a la boca. Cuando eso ocurre, suena una alarma.',
  'does.p2': 'Esa alarma es la señal externa de conciencia que la investigación sobre la HRT identifica como el componente más importante del tratamiento. Detecta los episodios que la autoobservación pasa por alto. La mayoría ocurren sin que te des cuenta.',
  'does.p3': 'La app también registra cada detección con su hora, para que veas con qué frecuencia te muerdes de verdad y no con la que calculas. Un recuento real, en lugar de una suposición, es lo que convierte el hábito en algo sobre lo que puedes trabajar.',

  'privacy.heading': 'Privacidad: lo no negociable',
  'privacy.p1': 'La app usa tu cámara web. Eso exige confianza. La diseñé para que esa confianza se pueda comprobar, no solo prometer.',
  'privacy.p2': 'Todo el procesamiento de video se ejecuta en WebAssembly en tu dispositivo. No se transmiten video, ni fotogramas, ni detecciones. Puedes desconectarte de internet después de que la app cargue y funcionará igual. Puedes comprobarlo observando el tráfico de red mientras la app funciona.',
  'privacy.p3': '{sync, select, on {Tu registro de alarmas y mordiscos se guarda en tu navegador y solo se copia a tu cuenta si activas la sincronización.} other {Tu registro de alarmas y mordiscos se guarda en tu navegador.}} El sitio cuenta las visitas con Google Analytics; eso nunca incluye nada de tu cámara.',

  'tech.heading': 'La tecnología',
  'tech.p1': 'El modelo de detección se basa en el <link>Hand Landmarker de Google MediaPipe</link>, que localiza 21 puntos de referencia de la mano. Stop Biting lo ejecuta cinco veces por segundo. El modelo se ejecuta en WebAssembly (un formato de ejecución binario aislado, compatible con todos los navegadores modernos), lo que significa que no tiene acceso a la red y no puede leer archivos fuera del entorno aislado del navegador.',
  'tech.p2': 'La detección de proximidad a la boca compara, en cada fotograma, las coordenadas de los puntos de la mano con las de los puntos de la cara. Cuando un punto de la mano permanece dentro del umbral de detección de la zona de la boca durante un tiempo sostenido, se activa la alarma.',

  'site.heading': 'Cómo se escribe este sitio',
  'site.p1': 'Cada artículo, guía y comparativa de este sitio lo escribo yo. Soy desarrollador, no clínico, y la <link>página de política editorial y correcciones</link> explica exactamente qué significa eso para lo que lees: cómo se citan las fuentes, cómo se comprueba cualquier cosa que digo sobre un producto de la competencia y cómo avisarme cuando algo de este sitio esté mal.',
};
