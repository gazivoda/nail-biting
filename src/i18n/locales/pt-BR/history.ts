// NEEDS NATIVE REVIEW (machine draft). Scope "history", locale pt-BR.
import type { messages as en } from '../../scopes/history';

export const messages: Record<keyof typeof en, string> = {
  'title': 'Histórico',

  'switch.label': 'Visualização do histórico',
  'switch.history': 'Histórico',
  'switch.insights': 'Análises',
  'switch.photos': 'Fotos',

  'empty.title': 'Nenhum histórico ainda',
  'empty.body': 'Os alarmes da aba Monitorar e as mordidas que você registra com “Acabei de roer as unhas” aparecem aqui, dia a dia. Adicione um motivo a cada uma e esta página mostra o que desencadeia o hábito.',
  'empty.goToWatch': 'Ir para Monitorar',

  'undo.deleted': 'Registro das {time} excluído.',
  'filter.label': 'Mostrar comportamento',
  'filter.all': 'Todos',

  'list.count': '{count, plural, one {{count} registro} other {{count} registros}}',
  'list.countMarked': '{counted, plural, one {{counted} registro} other {{counted} registros}}, {marked} marcados como “Não foi uma mordida”',
  'list.hidden': '{count, plural, one {{count} registro mais antigo está salvo} other {{count} registros mais antigos estão salvos}} neste dispositivo e voltam a aparecer com um plano.',
  'clear.button': 'Apagar tudo',
  'clear.confirm': 'Apagar todo o histórico? Isso não pode ser desfeito.',
  'clear.yes': 'Sim, apagar',

  'tag.bite': 'Mordida',
  'tag.biteWith': 'Mordida, {reason}',
  'tag.alarm': 'Alarme',
  'tag.notABite': 'Não foi uma mordida',
  'tag.urgeFinished': '{label}, timer concluído',
  'row.confirmAria': 'Confirmar o alarme das {time} como mordida',
  'row.confirmTitle': 'Foi uma mordida de verdade',
  'row.undoAria': 'Desfazer: contar novamente o alarme das {time}',
  'row.undoTitle': 'Contar este alarme novamente',
  'row.notABiteAria': 'Marcar o alarme das {time} como “Não foi uma mordida”',
  'row.notABiteTitle': 'Minha mão só estava apoiada ali',
  'row.deleteAria': 'Excluir o registro das {time}',

  'summary.title': 'Resumo',
  'summary.bites': 'Mordidas',
  'summary.alarms': 'Alarmes para revisar',
  'summary.topTrigger': 'Principal gatilho',
  'summary.tagged': '({count} de {total} com motivo)',
  'summary.mostBites': 'Mais mordidas',

  'week.title': 'Últimos 7 dias',
  'week.bitesThisWeek': '{count, plural, one {mordida esta semana} other {mordidas esta semana}}',
  'week.entriesThisWeek': '{count, plural, one {registro esta semana} other {registros esta semana}}',
  'week.captionBites': 'Mordidas por dia. Dia mais movimentado: {day} ({count}).',
  'week.captionAll': 'Alarmes e mordidas por dia. Dia mais movimentado: {day} ({count}).',
  'week.captionBitesNone': 'Mordidas por dia. Nenhuma mordida nos últimos 7 dias.',
  'week.captionAllNone': 'Alarmes e mordidas por dia. Nenhum registro nos últimos 7 dias.',
  'week.chartShows': 'O gráfico mostra',
  'week.filterAll': 'Tudo',
  'week.filterBites': 'Mordidas',
  'week.seriesBites': 'mordidas',
  'week.seriesEntries': 'registros',

  'time.daysHours': '{days}d {hours}h',
  'time.days': '{count, plural, one {{count} dia} other {{count} dias}}',
  'time.hoursMinutes': '{hours}h {minutes}min',
  'time.hours': '{hours}h',
  'time.minutes': '{minutes}min',
  'time.justNow': 'agora mesmo',
  'date.today': 'Hoje',
  'date.yesterday': 'Ontem',

  'hourRange': '{from} às {to}',
};
