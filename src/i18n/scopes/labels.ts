// Scope "labels": trigger-tag labels and behavior names/descriptions, read through the getters in triggerTags.ts and detection/registry.ts. A scope of its own so the main bundle does not carry them.
import { createScope } from '../scope.ts';

export const messages = {
  'tag.stress': 'Stress',
  'tag.focus': 'Deep focus',
  'tag.boredom': 'Boredom',
  'tag.unknown': 'Not sure',
  'tag.urge': 'Urge',
  'behavior.nail_biting.label': 'Nail biting',
  'behavior.nail_biting.short': 'Nails',
  'behavior.nail_biting.description': 'A fingertip held near your mouth for about 0.6 seconds. This is the check the app has always used.',
  'behavior.cuticle_skin_biting.label': 'Cuticle and skin biting',
  'behavior.cuticle_skin_biting.short': 'Cuticles',
  'behavior.cuticle_skin_biting.description': 'The same mouth check as nail biting, recorded under this name. Choose the one that fits you; they share one check, so only one can be on.',
  'behavior.nose_picking.label': 'Nose picking',
  'behavior.nose_picking.short': 'Nose',
  'behavior.nose_picking.description': 'An index or little fingertip at your nose for about 1.6 seconds.',
  'behavior.eye_area_pulling.label': 'Eyelash and eyebrow pulling',
  'behavior.eye_area_pulling.short': 'Eyes',
  'behavior.eye_area_pulling.description': 'A thumb and finger pinched together at your eye or brow for about 1.4 seconds.',
  'behavior.face_skin_picking.label': 'Face skin picking',
  'behavior.face_skin_picking.short': 'Face skin',
  'behavior.face_skin_picking.description': 'A fingertip moving in small repeated movements on your cheek, chin or forehead for about 3 seconds.',
  'behavior.hair_pulling.label': 'Hair pulling',
  'behavior.hair_pulling.short': 'Hair',
  'behavior.hair_pulling.description': 'A pinch above your forehead for about 2 seconds. Needs your camera framed high enough to see the top of your head.',
} satisfies Record<string, string>;

export const { t, useT } = createScope('labels', messages);
