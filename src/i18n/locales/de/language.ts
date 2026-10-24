// NEEDS NATIVE REVIEW (machine draft). Scope "language", locale de.
import type { messages as en } from '../../scopes/language';

export const messages: Record<keyof typeof en, string> = {
  'title': 'Sprache',
  'groupLabel': 'Sprache der App',
  'intro': 'Wähle die Sprache der App-Bildschirme. Die Website, der Blog und die E-Mails bleiben auf Englisch.',
  'draftNote': 'Diese Übersetzung ist ein maschineller Entwurf und wurde noch nicht von Muttersprachlern geprüft. Manche Formulierungen klingen eventuell nicht ganz richtig.',
  'loadFailed': 'Diese Sprache konnte nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.',
  'loading': 'Wird geladen…',
};
