// NEEDS NATIVE REVIEW (machine draft). Scope "labels", locale es.
import type { messages as en } from '../../scopes/labels';

export const messages: Record<keyof typeof en, string> = {
  'tag.stress': 'Estrés',
  'tag.focus': 'Concentración profunda',
  'tag.boredom': 'Aburrimiento',
  'tag.unknown': 'No lo sé',
  'tag.urge': 'Impulso',
  'behavior.nail_biting.label': 'Morderse las uñas',
  'behavior.nail_biting.short': 'Uñas',
  'behavior.nail_biting.description': 'Una yema de dedo cerca de la boca durante unos 0,6 segundos. Es la comprobación que la app ha usado siempre.',
  'behavior.cuticle_skin_biting.label': 'Morderse cutículas y piel',
  'behavior.cuticle_skin_biting.short': 'Cutículas',
  'behavior.cuticle_skin_biting.description': 'La misma comprobación de la boca que para las uñas, registrada con este nombre. Elige la que te corresponda; comparten una sola comprobación, así que solo una puede estar activa.',
  'behavior.nose_picking.label': 'Hurgarse la nariz',
  'behavior.nose_picking.short': 'Nariz',
  'behavior.nose_picking.description': 'La yema del índice o del meñique en la nariz durante unos 1,6 segundos.',
  'behavior.eye_area_pulling.label': 'Arrancarse pestañas y cejas',
  'behavior.eye_area_pulling.short': 'Ojos',
  'behavior.eye_area_pulling.description': 'El pulgar y otro dedo haciendo pinza cerca del ojo o de la ceja durante unos 1,4 segundos.',
  'behavior.face_skin_picking.label': 'Rascarse la piel de la cara',
  'behavior.face_skin_picking.short': 'Piel del rostro',
  'behavior.face_skin_picking.description': 'Una yema de dedo con pequeños movimientos repetidos en la mejilla, la barbilla o la frente durante unos 3 segundos.',
  'behavior.hair_pulling.label': 'Arrancarse el pelo',
  'behavior.hair_pulling.short': 'Pelo',
  'behavior.hair_pulling.description': 'Un pellizco por encima de la frente durante unos 2 segundos. Necesita que la cámara encuadre lo bastante alto para ver la parte superior de tu cabeza.',
};
