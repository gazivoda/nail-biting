// NEEDS NATIVE REVIEW (machine draft). Scope "labels", locale de.
import type { messages as en } from '../../scopes/labels';

export const messages: Record<keyof typeof en, string> = {
  'tag.stress': 'Stress',
  'tag.focus': 'Tiefe Konzentration',
  'tag.boredom': 'Langeweile',
  'tag.unknown': 'Unsicher',
  'tag.urge': 'Drang',
  'behavior.nail_biting.label': 'Nägelkauen',
  'behavior.nail_biting.short': 'Nägel',
  'behavior.nail_biting.description': 'Eine Fingerspitze etwa 0,6 Sekunden nahe am Mund. Das ist die Prüfung, die die App schon immer nutzt.',
  'behavior.cuticle_skin_biting.label': 'Nagelhaut- und Hautkauen',
  'behavior.cuticle_skin_biting.short': 'Nagelhaut',
  'behavior.cuticle_skin_biting.description': 'Dieselbe Mundprüfung wie beim Nägelkauen, unter diesem Namen erfasst. Wähle, was zu dir passt; beide teilen sich eine Prüfung, daher kann nur eine aktiv sein.',
  'behavior.nose_picking.label': 'In der Nase bohren',
  'behavior.nose_picking.short': 'Nase',
  'behavior.nose_picking.description': 'Eine Zeige- oder Kleinfingerspitze etwa 1,6 Sekunden an der Nase.',
  'behavior.eye_area_pulling.label': 'Wimpern- und Augenbrauenzupfen',
  'behavior.eye_area_pulling.short': 'Augen',
  'behavior.eye_area_pulling.description': 'Daumen und Finger zusammengekniffen am Auge oder an der Braue, etwa 1,4 Sekunden.',
  'behavior.face_skin_picking.label': 'Hautzupfen im Gesicht',
  'behavior.face_skin_picking.short': 'Gesichtshaut',
  'behavior.face_skin_picking.description': 'Eine Fingerspitze mit kleinen, wiederholten Bewegungen an Wange, Kinn oder Stirn, etwa 3 Sekunden.',
  'behavior.hair_pulling.label': 'Haareausreißen',
  'behavior.hair_pulling.short': 'Haare',
  'behavior.hair_pulling.description': 'Ein Zupfen oberhalb der Stirn, etwa 2 Sekunden. Die Kamera muss hoch genug ausgerichtet sein, um den Haaransatz zu sehen.',
};
