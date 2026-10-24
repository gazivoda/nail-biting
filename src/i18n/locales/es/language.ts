// NEEDS NATIVE REVIEW (machine draft). Scope "language", locale es.
import type { messages as en } from '../../scopes/language';

export const messages: Record<keyof typeof en, string> = {
  'title': 'Idioma',
  'groupLabel': 'Idioma de la app',
  'intro': 'Elige el idioma de las pantallas de la app. El sitio web, el blog y los correos siguen en inglés.',
  'draftNote': 'Esta traducción es un borrador automático y aún no la ha revisado una persona nativa. Es posible que algunas frases no suenen del todo bien.',
  'loadFailed': 'No se pudo cargar ese idioma. Comprueba tu conexión e inténtalo de nuevo.',
  'loading': 'Cargando…',
};
