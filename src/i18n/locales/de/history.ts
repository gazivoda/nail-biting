// NEEDS NATIVE REVIEW (machine draft). Scope "history", locale de.
import type { messages as en } from '../../scopes/history';

export const messages: Record<keyof typeof en, string> = {
  'title': 'Verlauf',

  'switch.label': 'Verlaufsansicht',
  'switch.history': 'Verlauf',
  'switch.insights': 'Einblicke',
  'switch.photos': 'Fotos',

  'empty.title': 'Noch kein Verlauf',
  'empty.body': 'Alarme aus dem Tab „Überwachen“ und Bisse, die du mit „Ich habe gerade an den Nägeln gekaut“ einträgst, erscheinen hier, Tag für Tag. Wähle zu jedem einen Grund aus, dann zeigt dir diese Seite, was dich auslöst.',
  'empty.goToWatch': 'Zu „Überwachen“',

  'undo.deleted': 'Eintrag von {time} gelöscht.',
  'filter.label': 'Verhalten anzeigen',
  'filter.all': 'Alle',

  'list.count': '{count, plural, one {{count} Eintrag} other {{count} Einträge}}',
  'list.countMarked': '{counted, plural, one {{counted} Eintrag} other {{counted} Einträge}}, {marked} als „Kein Biss“ markiert',
  'list.hidden': '{count, plural, one {{count} älterer Eintrag ist} other {{count} ältere Einträge sind}} auf diesem Gerät gespeichert und erscheinen mit einem Tarif wieder.',
  'clear.button': 'Alles löschen',
  'clear.confirm': 'Gesamten Verlauf löschen? Das lässt sich nicht rückgängig machen.',
  'clear.yes': 'Ja, löschen',

  'tag.bite': 'Biss',
  'tag.biteWith': 'Biss, {reason}',
  'tag.alarm': 'Alarm',
  'tag.notABite': 'Kein Biss',
  'tag.urgeFinished': '{label}, Timer beendet',
  'row.confirmAria': 'Alarm um {time} als Biss bestätigen',
  'row.confirmTitle': 'Das war tatsächlich ein Biss',
  'row.undoAria': 'Rückgängig: den Alarm um {time} wieder mitzählen',
  'row.undoTitle': 'Diesen Alarm wieder mitzählen',
  'row.notABiteAria': 'Alarm um {time} als „Kein Biss“ markieren',
  'row.notABiteTitle': 'Meine Hand lag nur dort',
  'row.deleteAria': 'Eintrag von {time} löschen',

  'summary.title': 'Zusammenfassung',
  'summary.bites': 'Bisse',
  'summary.alarms': 'Alarme zu prüfen',
  'summary.topTrigger': 'Häufigster Auslöser',
  'summary.tagged': '({count} von {total} mit Grund)',
  'summary.mostBites': 'Meiste Bisse',

  'week.title': 'Letzte 7 Tage',
  'week.bitesThisWeek': '{count, plural, one {Biss diese Woche} other {Bisse diese Woche}}',
  'week.entriesThisWeek': '{count, plural, one {Eintrag diese Woche} other {Einträge diese Woche}}',
  'week.captionBites': 'Bisse pro Tag. Die meisten am {day} ({count}).',
  'week.captionAll': 'Alarme und Bisse pro Tag. Die meisten am {day} ({count}).',
  'week.captionBitesNone': 'Bisse pro Tag. Keine Bisse in den letzten 7 Tagen.',
  'week.captionAllNone': 'Alarme und Bisse pro Tag. Keine Einträge in den letzten 7 Tagen.',
  'week.chartShows': 'Diagramm zeigt',
  'week.filterAll': 'Alle',
  'week.filterBites': 'Bisse',
  'week.seriesBites': 'Bisse',
  'week.seriesEntries': 'Einträge',

  'time.daysHours': '{days} T {hours} Std.',
  'time.days': '{count, plural, one {{count} Tag} other {{count} Tage}}',
  'time.hoursMinutes': '{hours} Std. {minutes} Min.',
  'time.hours': '{hours} Std.',
  'time.minutes': '{minutes} Min.',
  'time.justNow': 'gerade eben',
  'date.today': 'Heute',
  'date.yesterday': 'Gestern',

  'hourRange': '{from} bis {to}',
};
