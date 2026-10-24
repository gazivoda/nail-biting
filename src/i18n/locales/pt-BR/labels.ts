// NEEDS NATIVE REVIEW (machine draft). Scope "labels", locale pt-BR.
import type { messages as en } from '../../scopes/labels';

export const messages: Record<keyof typeof en, string> = {
  'tag.stress': 'Estresse',
  'tag.focus': 'Foco profundo',
  'tag.boredom': 'Tédio',
  'tag.unknown': 'Não sei',
  'tag.urge': 'Impulso',
  'behavior.nail_biting.label': 'Roer as unhas',
  'behavior.nail_biting.short': 'Unhas',
  'behavior.nail_biting.description': 'Uma ponta de dedo perto da boca por cerca de 0,6 segundo. É a verificação que o app sempre usou.',
  'behavior.cuticle_skin_biting.label': 'Roer cutículas e pele',
  'behavior.cuticle_skin_biting.short': 'Cutículas',
  'behavior.cuticle_skin_biting.description': 'A mesma verificação da boca usada para as unhas, registrada com este nome. Escolha a que combina com você; elas compartilham uma única verificação, então só uma pode ficar ativa.',
  'behavior.nose_picking.label': 'Cutucar o nariz',
  'behavior.nose_picking.short': 'Nariz',
  'behavior.nose_picking.description': 'A ponta do indicador ou do mindinho no nariz por cerca de 1,6 segundo.',
  'behavior.eye_area_pulling.label': 'Arrancar cílios e sobrancelhas',
  'behavior.eye_area_pulling.short': 'Olhos',
  'behavior.eye_area_pulling.description': 'O polegar e outro dedo em pinça perto do olho ou da sobrancelha por cerca de 1,4 segundo.',
  'behavior.face_skin_picking.label': 'Beliscar a pele do rosto',
  'behavior.face_skin_picking.short': 'Pele do rosto',
  'behavior.face_skin_picking.description': 'Uma ponta de dedo com pequenos movimentos repetidos na bochecha, no queixo ou na testa por cerca de 3 segundos.',
  'behavior.hair_pulling.label': 'Arrancar cabelo',
  'behavior.hair_pulling.short': 'Cabelo',
  'behavior.hair_pulling.description': 'Um beliscão acima da testa por cerca de 2 segundos. Exige que a câmera enquadre alto o bastante para ver o topo da cabeça.',
};
