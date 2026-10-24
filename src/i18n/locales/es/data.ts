// NEEDS NATIVE REVIEW (machine draft). Scope "data", locale es.
import type { messages as en } from '../../scopes/data';

export const messages: Record<keyof typeof en, string> = {
  // ── Ajustes > Datos: la tarjeta ────────────────────────────────────────────
  'card.title': 'Datos',

  // ── Exportar ───────────────────────────────────────────────────────────────
  'export.label': 'Exporta tu historial',
  'export.description': 'JSON restaura todo, incluidas las fechas de tu racha. CSV se abre en una hoja de cálculo. Ambos se guardan en tu dispositivo; no se sube nada.',
  'export.json': 'Exportar JSON',
  'export.csv': 'Exportar CSV',
  'export.savedJson': 'Se {count, plural, one {guardó # evento} other {guardaron # eventos}} en un archivo desde el que puedes restaurar.',
  'export.savedCsv': 'Se {count, plural, one {guardó # fila} other {guardaron # filas}} para una hoja de cálculo.',

  // ── Restaurar (importar) ───────────────────────────────────────────────────
  'restore.label': 'Restaurar desde un archivo',
  'restore.description': 'Elige un archivo JSON que exportaste antes. Primero ves lo que cambiaría. Los eventos que ya tienes no se duplican y los más recientes que hay aquí nunca se sobrescriben.',
  'restore.fileLabel': 'Elige un archivo de historial para restaurar',
  'restore.chooseFile': 'Elegir archivo',
  'restore.ok': 'Aceptar',

  'preview.aria': 'Vista previa de la importación',
  'preview.title': '{fileName}: {total, plural, one {# entrada} other {# entradas}}',
  'preview.titleExported': '{fileName}: {total, plural, one {# entrada} other {# entradas}}, exportado el {when}',
  'preview.restoresWhole': 'Este dispositivo aún no tiene historial, así que esto restaura todo lo del archivo, incluidas las fechas de tu racha.',
  'preview.added': '{count, plural, one {Se añadirá # evento nuevo} other {Se añadirán # eventos nuevos}}',
  'preview.addedRange': '{count, plural, one {Se añadirá # evento nuevo} other {Se añadirán # eventos nuevos}} (del {from} al {to})',
  'preview.updated': '{count, plural, one {# de los que hay aquí se reemplazará por una versión más reciente del archivo} other {# de los que hay aquí se reemplazarán por una versión más reciente del archivo}}',
  'preview.deletions': '{count, plural, one {Se aplicará # registro de eliminación del archivo} other {Se aplicarán # registros de eliminación del archivo}}',
  'preview.unchanged': '{count, plural, one {# ya está aquí y no ha cambiado} other {# ya están aquí y no han cambiado}}',
  'preview.keptNewer': '{count, plural, one {# de los que hay aquí es más reciente que la versión del archivo y se queda como está} other {# de los que hay aquí son más recientes que la versión del archivo y se quedan como están}}',
  'preview.duplicates': '{count, plural, one {# aparece dos veces en el archivo (se cuenta una vez)} other {# aparecen dos veces en el archivo (se cuentan una vez)}}',
  'preview.invalid': '{count, plural, one {# entrada no es válida y se omitirá} other {# entradas no son válidas y se omitirán}}',
  'preview.exceedsLimit': 'La app guarda los {max, number} eventos más recientes, así que los más antiguos de este archivo se dejarán fuera.',
  'preview.sampleHeading': 'Eventos más recientes que se añaden',
  'preview.sampleLine': '{when} · {source, select, alarm {alarma} other {registrado a mano}} · {behavior}',
  'preview.noop': 'No hay nada nuevo en este archivo. Tu historial se queda exactamente como está.',
  'preview.import': 'Importar',

  'behavior.nail_biting': 'morderse las uñas',
  'behavior.cuticle_skin_biting': 'morderse las cutículas y la piel',
  'behavior.nose_picking': 'hurgarse la nariz',
  'behavior.eye_area_pulling': 'arrancarse pestañas y cejas',
  'behavior.face_skin_picking': 'rascarse la piel de la cara',
  'behavior.hair_pulling': 'arrancarse el pelo',

  // ── Después de importar ────────────────────────────────────────────────────
  'done.added': 'Listo. Añadidos: {added, plural, one {# evento} other {# eventos}}.',
  'done.addedUpdated': 'Listo. Añadidos: {added, plural, one {# evento} other {# eventos}}, actualizados: {updated, number}.',
  'done.addedDeletions': 'Listo. Añadidos: {added, plural, one {# evento} other {# eventos}}, aplicadas: {deletions, plural, one {# eliminación} other {# eliminaciones}}.',
  'done.addedUpdatedDeletions': 'Listo. Añadidos: {added, plural, one {# evento} other {# eventos}}, actualizados: {updated, number}, aplicadas: {deletions, plural, one {# eliminación} other {# eliminaciones}}.',
  'done.keptNewer': '{count, plural, one {Se conservó # evento más reciente tal como estaba.} other {Se conservaron # eventos más recientes tal como estaban.}}',
  'done.andMore': 'y {count, number} más',

  // ── Por qué se rechazó un archivo ──────────────────────────────────────────
  'import.tooBig': 'Ese archivo supera los {mb} MB. Una exportación del historial es mucho más pequeña, así que probablemente no lo sea.',
  'import.notJson': 'Ese archivo no es un JSON válido. Elige un archivo que hayas exportado desde Stop Biting.',
  'import.notHistory': 'Ese archivo no parece una exportación del historial de Stop Biting.',
  'import.tooMany': 'Ese archivo tiene más de {max, number} entradas.',
  'import.noEvents': 'Ese archivo no contiene eventos.',
  'import.noneValid': 'Ninguna de las entradas de ese archivo es un evento válido.',
  'import.unreadable': 'No se pudo leer ese archivo.',

  // ── Por qué falló una eliminación ──────────────────────────────────────────
  'failure.network': 'No se pudo conectar con el servidor. No se eliminó nada. Revisa tu conexión e inténtalo de nuevo.',
  'failure.signedOut': 'Tu sesión está cerrada. Inicia sesión de nuevo y vuelve a intentarlo.',
  'failure.rateLimited': 'Demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.',
  'failure.server': 'El servidor no pudo eliminarlo. No se eliminó nada. Inténtalo de nuevo en un momento.',

  // ── Eliminar datos sincronizados ───────────────────────────────────────────
  'wipe.label': 'Eliminar datos sincronizados',
  'wipe.description': 'Elimina la copia de tu historial guardada en tu cuenta. El historial de este dispositivo se queda y la sincronización se desactiva.',
  'wipe.checking': 'Comprobando…',
  'wipe.confirmAria': 'Confirmar la eliminación de los datos sincronizados',
  'wipe.confirmSome': 'Esto elimina de forma permanente {count, plural, one {# evento sincronizado} other {# eventos sincronizados}} de tu cuenta. Los demás dispositivos dejarán de sincronizarse. No se puede deshacer.',
  'wipe.confirmNone': 'Esto borra de forma permanente el historial guardado en tu cuenta. Los demás dispositivos dejarán de sincronizarse. No se puede deshacer.',
  'wipe.yes': 'Sí, eliminar datos sincronizados',
  'wipe.deleting': 'Eliminando…',
  'wipe.doneSome': 'Se {count, plural, one {eliminó # evento sincronizado} other {eliminaron # eventos sincronizados}} de tu cuenta. La sincronización está desactivada. El historial de este dispositivo no se ha tocado.',
  'wipe.doneNone': 'Se borró el historial guardado en tu cuenta. La sincronización está desactivada. El historial de este dispositivo no se ha tocado.',

  // ── Eliminar todo ──────────────────────────────────────────────────────────
  'all.label': 'Eliminar todo',
  'all.description': 'Borra tu historial, tu racha, los motivos de tus mordiscos y los ajustes de este dispositivo.',
  'all.confirmAria': 'Confirmar la eliminación de todo',
  'all.confirm': 'Esto borra tu historial, tu racha, los motivos de tus mordiscos y todos los ajustes de este dispositivo. No se puede deshacer.',
  'all.alsoSynced': 'Eliminar también la copia sincronizada con mi cuenta. Si lo dejas desactivado, la copia se queda y la sincronización se desactiva en este dispositivo.',
  'all.yes': 'Sí, eliminar todo',
  'all.deleting': 'Eliminando…',
  'all.done': 'Se ha borrado todo lo de este dispositivo.',

  // ── Ajustes > Cuenta y sincronización ──────────────────────────────────────
  'sync.title': 'Cuenta y sincronización',
  'sync.dismiss': 'Descartar',
  'sync.toggle': 'Sincronizar mi historial entre dispositivos',
  'sync.toggleDescription': 'Tu historial se sincroniza con tu cuenta cuando esto está activado. Los datos de la cámara nunca salen de tu dispositivo.',
  'sync.signInToUse': 'Inicia sesión para usar la sincronización.',
  'sync.whatSyncs': 'Qué se sincroniza: de cada entrada, su hora, su tipo, el motivo del mordisco que elegiste, qué mano si se sabe, y si completaste una respuesta competidora. Nunca video, fotos, puntos de seguimiento de la cara o las manos, ni tu diario de fotos. Está desactivada hasta que la actives, y puedes desactivarla o eliminar la copia sincronizada en cualquier momento (consulta Datos).',
  'sync.statusLabel': 'Estado',
  'sync.syncNow': 'Sincronizar ahora',
  'sync.deviceLabel': 'Este dispositivo',
  'sync.deviceDescription': 'Solo tú ves este nombre. Se queda en este dispositivo.',
  'sync.deviceNameLabel': 'Nombre de este dispositivo',

  // ── El nombre predeterminado de este dispositivo ───────────────────────────
  'device.browserOnOs': '{browser} en {os}',
  'device.app': 'App de Stop Biting',
  'device.fallback': 'Este dispositivo',

  // ── Las palabras de lo que hace la sincronización ──────────────────────────
  'status.syncing': 'Sincronizando…',
  'status.offline.headline': 'Estás sin conexión.',
  'status.offline.detail': 'Todo está guardado en este dispositivo y se sincronizará cuando vuelvas a tener conexión.',
  'status.offline.detailPending': 'Todo está guardado en este dispositivo y se sincronizará cuando vuelvas a tener conexión. {pending, plural, one {Hay # cambio esperando} other {Hay # cambios esperando}} para enviarse.',
  'status.backoff.headline': 'No se pudo conectar con el servidor.',
  'status.backoff.detailAt': 'Tu historial está a salvo en este dispositivo. Se volverá a intentar {when}.',
  'status.backoff.detailSoon': 'Tu historial está a salvo en este dispositivo. Se volverá a intentar pronto.',
  'status.signedOut.headline': 'Tu sesión se ha cerrado.',
  'status.signedOut.detail': 'Inicia sesión de nuevo para seguir sincronizando. Tu historial en este dispositivo no se ha tocado.',
  'status.unavailable.headline': 'La sincronización no está disponible ahora mismo.',
  'status.unavailable.detail': 'Tu historial está a salvo en este dispositivo. Se volverá a intentar más tarde.',
  'status.rejected.headline': 'El servidor no aceptó algunos cambios.',
  'status.rejected.detail': 'No se pierde nada en este dispositivo. Prueba con Sincronizar ahora.',
  'status.quota.headline': 'Tu historial sincronizado está lleno.',
  'status.quota.detail': 'Exporta una copia desde Datos, más abajo, y luego elimina la copia sincronizada para empezar de cero.',
  'status.serverReset.headline': 'Se eliminaron los datos sincronizados, así que la sincronización está desactivada.',
  'status.serverReset.detail': 'Tu historial en este dispositivo no se ha tocado.',
  'status.firstSync': 'Esperando la primera sincronización.',
  'status.lastSynced': 'Última sincronización {when}.',
  'status.waiting': '{pending, plural, one {Hay # cambio esperando} other {Hay # cambios esperando}} para enviarse.',
  'notice.serverReset.headline': 'Tus datos sincronizados se eliminaron desde otro dispositivo, así que la sincronización está desactivada aquí.',
  'notice.serverReset.detail': 'Tu historial en este dispositivo no se ha tocado. Activa la sincronización para volver a subirlo.',
};
