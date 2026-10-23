// NEEDS NATIVE REVIEW (machine draft). Scope "history", locale es.
import type { messages as en } from '../../scopes/history';

export const messages: Record<keyof typeof en, string> = {
  'title': 'Historial',

  'switch.label': 'Vista del historial',
  'switch.history': 'Historial',
  'switch.insights': 'Análisis',
  'switch.photos': 'Fotos',

  'empty.title': 'Aún no hay historial',
  'empty.body': 'Las alarmas de la pestaña Vigilar y los mordiscos que registras con «Me acabo de morder las uñas» aparecen aquí, día a día. Añade un motivo a cada uno y esta página te muestra qué te desencadena.',
  'empty.goToWatch': 'Ir a Vigilar',

  'undo.deleted': 'Registro de las {time} eliminado.',
  'filter.label': 'Mostrar comportamiento',
  'filter.all': 'Todos',

  'list.count': '{count, plural, one {{count} registro} other {{count} registros}}',
  'list.countMarked': '{counted, plural, one {{counted} registro} other {{counted} registros}}, {marked} marcados como «No fue un mordisco»',
  'list.hidden': '{count, plural, one {{count} registro anterior está guardado} other {{count} registros anteriores están guardados}} en este dispositivo y vuelven a aparecer con un plan.',
  'clear.button': 'Borrar todo',
  'clear.confirm': '¿Borrar todo el historial? Esta acción no se puede deshacer.',
  'clear.yes': 'Sí, borrar',

  'tag.bite': 'Mordisco',
  'tag.biteWith': 'Mordisco, {reason}',
  'tag.alarm': 'Alarma',
  'tag.notABite': 'No fue un mordisco',
  'tag.urgeFinished': '{label}, temporizador terminado',
  'row.confirmAria': 'Confirmar la alarma de las {time} como mordisco',
  'row.confirmTitle': 'Fue un mordisco de verdad',
  'row.undoAria': 'Deshacer: volver a contar la alarma de las {time}',
  'row.undoTitle': 'Volver a contar esta alarma',
  'row.notABiteAria': 'Marcar la alarma de las {time} como «No fue un mordisco»',
  'row.notABiteTitle': 'Mi mano solo estaba apoyada ahí',
  'row.deleteAria': 'Eliminar el registro de las {time}',

  'summary.title': 'Resumen',
  'summary.bites': 'Mordiscos',
  'summary.alarms': 'Alarmas por revisar',
  'summary.topTrigger': 'Desencadenante principal',
  'summary.tagged': '({count} de {total} con motivo)',
  'summary.mostBites': 'Más mordiscos',

  'week.title': 'Últimos 7 días',
  'week.bitesThisWeek': '{count, plural, one {mordisco esta semana} other {mordiscos esta semana}}',
  'week.entriesThisWeek': '{count, plural, one {registro esta semana} other {registros esta semana}}',
  'week.captionBites': 'Mordiscos por día. Más el {day} ({count}).',
  'week.captionAll': 'Alarmas y mordiscos por día. Más el {day} ({count}).',
  'week.captionBitesNone': 'Mordiscos por día. Ningún mordisco en los últimos 7 días.',
  'week.captionAllNone': 'Alarmas y mordiscos por día. Ningún registro en los últimos 7 días.',
  'week.chartShows': 'El gráfico muestra',
  'week.filterAll': 'Todo',
  'week.filterBites': 'Mordiscos',
  'week.seriesBites': 'mordiscos',
  'week.seriesEntries': 'registros',

  'time.daysHours': '{days} d {hours} h',
  'time.days': '{count, plural, one {{count} día} other {{count} días}}',
  'time.hoursMinutes': '{hours} h {minutes} min',
  'time.hours': '{hours} h',
  'time.minutes': '{minutes} min',
  'time.justNow': 'ahora mismo',
  'date.today': 'Hoy',
  'date.yesterday': 'Ayer',

  'hourRange': '{from} a {to}',
};
