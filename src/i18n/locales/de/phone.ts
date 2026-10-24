// NEEDS NATIVE REVIEW (machine draft). Scope "phone", locale de.
import type { messages as en } from '../../scopes/phone';

export const messages: Record<keyof typeof en, string> = {
  'home.greeting.named': '{part, select, morning {Guten Morgen} afternoon {Guten Tag} other {Guten Abend}}, <name>{name}</name>.',
  'home.greeting.anon': '{part, select, morning {Guten <name>Morgen</name>.} afternoon {Guten <name>Tag</name>.} other {Guten <name>Abend</name>.}}',
  'home.freePlan': 'Kostenloser Tarif.',
  'home.freePlanHistory': 'Kostenloser Tarif: Der Verlauf zeigt {days, plural, one {deinen letzten Tag} other {deine letzten {days} Tage}}.',
  'home.trial': 'Kostenlose Testphase: {left}.',
  'home.choosePlan': 'Tarif wählen',
  'home.logAria': 'Erfassen',
  'home.bite': 'Ich habe gebissen',
  'home.urge': 'Ich spüre einen Drang',
  'home.send.share': 'Link an meinen Computer senden',
  'home.send.email': 'Link für meinen Computer per E-Mail senden',
  'home.openFull': 'Die vollständige App auf diesem Gerät öffnen',

  'entry.bite': 'Biss',
  'entry.biteWith': 'Biss, {reason}',
  'entry.urgeDone': '{urge}, Timer beendet',
  'entry.notBite': 'Kein Biss',
  'entry.alarm': 'Alarm',

  'today.none': 'Heute nichts erfasst',
  'today.some': '{list} heute',
  'today.bites': '{count, plural, one {{count} Biss} other {{count} Bisse}}',
  'today.urges': '{count, plural, one {{count} Drang} other {{count} Dränge}}',
  'today.alarms': '{count, plural, one {{count} Alarm zu prüfen} other {{count} Alarme zu prüfen}}',

  'toast.urge': 'Drang erfasst. Deine Serie bleibt unberührt.',
  'toast.bite': 'Biss erfasst. Deine Serie beginnt ab jetzt neu.',
  'toast.biteWith': 'Biss erfasst: {reason}. Deine Serie beginnt ab jetzt neu.',
  'toast.question': 'Was hat es ausgelöst? Du kannst das überspringen.',

  'recent.title': 'Zuletzt',
  'recent.all': 'Gesamter Verlauf',
  'recent.empty': 'Noch nichts erfasst. Tippe oben auf eine Schaltfläche, wenn es passiert.',

  'sync.phoneOnly': 'Nur auf diesem Handy gespeichert.',
  'sync.phoneOnlyCanSync': 'Nur auf diesem Handy gespeichert. Schalte die Synchronisierung in den Einstellungen ein, um es auf deinem Computer zu sehen.',
  'sync.on': 'Die Synchronisierung ist eingeschaltet, daher sieht dein Computer diese Einträge.',
  'sync.openSettings': 'Einstellungen öffnen',
};
