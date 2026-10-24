// NEEDS NATIVE REVIEW (machine draft). Scope "auth", locale de.
import type { messages as en } from '../../scopes/auth';

export const messages: Record<keyof typeof en, string> = {
  'page.title': 'Anmelden | Stop Biting',

  'finish.title': 'Anmeldung abschließen',
  'finish.body': 'Drücke die Schaltfläche, um dich auf diesem Gerät anzumelden. Das bloße Öffnen des E-Mail-Links meldet niemanden an.',
  'finish.button': 'Bei Stop Biting anmelden',
  'finish.working': 'Anmeldung läuft…',

  'intro.title': 'Anmelden oder kostenlose Testphase starten',
  'intro.body': 'Wähle, wie du dich anmelden möchtest. Neu hier? Mit denselben Optionen startest du deine Testphase. Schon ein Konto? Dann wirst du wieder angemeldet.',
  'checking': 'Weitere Optionen werden geprüft…',
  'divider.or': 'oder',

  'provider.google': 'Mit Google anmelden',
  'provider.apple': 'Mit Apple anmelden',
  'provider.microsoft': 'Mit Microsoft anmelden',

  'email.label': 'E-Mail-Adresse',
  'email.placeholder': 'you@example.com',
  'email.send': 'Anmeldelink per E-Mail senden',
  'email.sending': 'Wird gesendet…',
  'sent.title': 'Schau in dein Postfach',
  'sent.body': 'Ein Anmeldelink ist unterwegs an <b>{email}</b>. Er funktioniert nur einmal und läuft in 15 Minuten ab. Wenn er nach ein paar Minuten nicht da ist, schau in deinem Spam-Ordner nach.',
  'sent.again': 'Weiteren Link senden',
  'sent.againWait': 'Weiteren Link senden ({seconds}s)',
  'sent.different': 'Andere E-Mail-Adresse verwenden',

  'terms': 'Wenn du fortfährst, stimmst du den <terms>Nutzungsbedingungen</terms> und der <privacy>Datenschutzerklärung</privacy> zu.',

  'error.invalidEmail': 'Das sieht nicht nach einer E-Mail-Adresse aus. Bitte prüfe sie und versuche es noch einmal.',
  'error.tooMany': 'Zu viele Versuche. Bitte warte ein paar Minuten und versuche es dann noch einmal.',
  'error.sendFailed': 'Wir konnten die E-Mail nicht senden. Bitte versuche es gleich noch einmal.',
  'error.finishFailed': 'Wir konnten deine Anmeldung nicht abschließen. Bitte fordere einen neuen Link an.',
  'error.who.default': 'Dein Anmeldeanbieter',
  'error.cancelled': 'Die Anmeldung wurde abgebrochen, daher wurde nichts eingerichtet. Du kannst es jederzeit noch einmal versuchen.',
  'error.unverified': '{who} hat nicht bestätigt, dass diese E-Mail-Adresse dir gehört, daher haben wir sie nicht mit einem bestehenden Konto verbunden. Nutze stattdessen den Anmeldelink per E-Mail: Er beweist, dass du dieses Postfach lesen kannst.',
  'error.generic': 'Die Anmeldung wurde nicht abgeschlossen, daher wurde nichts eingerichtet. Bitte versuche es noch einmal.',
  'link.expired': 'Dieser Anmeldelink ist abgelaufen. Links gelten 15 Minuten. Gib deine E-Mail-Adresse ein, dann senden wir dir einen neuen.',
  'link.used': 'Dieser Anmeldelink wurde bereits verwendet. Jeder Link funktioniert nur einmal. Gib deine E-Mail-Adresse ein, dann senden wir dir einen neuen.',
  'link.invalid': 'Dieser Anmeldelink ist ungültig. Gib deine E-Mail-Adresse ein, dann senden wir dir einen neuen.',
};
