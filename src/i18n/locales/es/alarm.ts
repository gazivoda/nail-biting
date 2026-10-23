// NEEDS NATIVE REVIEW (machine draft). Scope "alarm", locale es.
import type { messages as en } from '../../scopes/alarm';

export const messages: Record<keyof typeof en, string> = {
  'overlay.title': 'Manos abajo',
  'overlay.hint': 'Presiona el pulgar contra la punta de cada dedo.',

  'alert.tabTitle': '⚠️ ¡Deja de morderte! – Stop Biting',
  'alert.notification.title': '¡Deja de morderte!',
  'alert.notification.body': 'Se detectó morderse las uñas: aparta las manos.',

  'suggestion.thumbs': 'Presiona el pulgar contra cada punta de los dedos',
  'suggestion.fist': 'Cierra y abre el puño · 5×',
  'suggestion.exhale': 'Exhala despacio por la nariz',
  'suggestion.water': 'Bebe agua a sorbos, con atención',

  'reminder.title': 'Revisión de manos',
  'reminder.body.thumbs': '¿Dónde tienes las manos? Si están cerca de la cara, prueba esto: presiona el pulgar contra cada punta de los dedos.',
  'reminder.body.fist': '¿Dónde tienes las manos? Si están cerca de la cara, prueba esto: cierra y abre el puño · 5×.',
  'reminder.body.exhale': '¿Dónde tienes las manos? Si están cerca de la cara, prueba esto: exhala despacio por la nariz.',
  'reminder.body.water': '¿Dónde tienes las manos? Si están cerca de la cara, prueba esto: bebe agua a sorbos, con atención.',

  'notABite.announce.offered': 'Alarma. Si fue una falsa alarma, pulsa No fue un mordisco.',
  'notABite.announce.marked': 'Marcada como «No fue un mordisco». No se cuenta. Pulsa Deshacer para revertirlo.',
  'notABite.toast.alarm': 'Alarma.',
  'notABite.toast.question': '¿Solo estabas apoyando la mano?',
  'notABite.toast.marked': 'Marcada como «No fue un mordisco». No se cuenta.',
  'notABite.toast.calibrateOffer': '¿Quieres enseñarle cómo apoyas la barbilla? Solo lleva un minuto.',
  'notABite.calibrate': 'Calibrar',
  'notABite.button': 'No fue un mordisco',
  'notABite.undo': 'Deshacer',
  'notABite.close': 'Cerrar',
};
