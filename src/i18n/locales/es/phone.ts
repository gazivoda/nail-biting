// NEEDS NATIVE REVIEW (machine draft). Scope "phone", locale es.
import type { messages as en } from '../../scopes/phone';

export const messages: Record<keyof typeof en, string> = {
  'home.greeting.named': '{part, select, morning {Buenos días} afternoon {Buenas tardes} other {Buenas noches}}, <name>{name}</name>.',
  'home.greeting.anon': '{part, select, morning {Buenos <name>días</name>.} afternoon {Buenas <name>tardes</name>.} other {Buenas <name>noches</name>.}}',
  'home.freePlan': 'Plan gratuito.',
  'home.freePlanHistory': 'Plan gratuito: el Historial muestra {days, plural, one {tu último día} other {tus últimos {days} días}}.',
  'home.trial': 'Prueba gratuita: {left}.',
  'home.choosePlan': 'Elegir un plan',
  'home.logAria': 'Registrar',
  'home.bite': 'Me mordí',
  'home.urge': 'Siento un impulso',
  'home.send.share': 'Enviar el enlace a mi computadora',
  'home.send.email': 'Enviarme por correo el enlace para mi computadora',
  'home.openFull': 'Abrir la app completa en este dispositivo',

  'entry.bite': 'Mordisco',
  'entry.biteWith': 'Mordisco, {reason}',
  'entry.urgeDone': '{urge}, temporizador terminado',
  'entry.notBite': 'No fue un mordisco',
  'entry.alarm': 'Alarma',

  'today.none': 'Nada registrado hoy',
  'today.some': '{list} hoy',
  'today.bites': '{count, plural, one {{count} mordisco} other {{count} mordiscos}}',
  'today.urges': '{count, plural, one {{count} impulso} other {{count} impulsos}}',
  'today.alarms': '{count, plural, one {{count} alarma por revisar} other {{count} alarmas por revisar}}',

  'toast.urge': 'Impulso registrado. Tu racha no se ve afectada.',
  'toast.bite': 'Mordisco registrado. Tu racha vuelve a empezar desde ahora.',
  'toast.biteWith': 'Mordisco registrado: {reason}. Tu racha vuelve a empezar desde ahora.',
  'toast.question': '¿Qué lo desencadenó? Puedes omitirlo.',

  'recent.title': 'Reciente',
  'recent.all': 'Todo el historial',
  'recent.empty': 'Todavía no hay nada registrado. Toca un botón de arriba cuando ocurra.',

  'sync.phoneOnly': 'Guardado solo en este teléfono.',
  'sync.phoneOnlyCanSync': 'Guardado solo en este teléfono. Activa la sincronización en Ajustes para verlo en tu computadora.',
  'sync.on': 'La sincronización está activada, así que tu computadora ve estos registros.',
  'sync.openSettings': 'Abrir Ajustes',
};
