// NEEDS NATIVE REVIEW (machine draft). Scope "photos", locale es.
import type { messages as en } from '../../scopes/photos';

export const messages: Record<keyof typeof en, string> = {
  // ── The diary screen ────────────────────────────────────────────────────────
  'diary.title': 'Diario de fotos',
  'diary.intro': 'Una vez por semana, haz una foto de tus manos. Con el tiempo podrás poner dos fotos una junto a otra y comprobar cómo están tus uñas ahora en comparación con antes.',
  'diary.privacy.statement': 'Las fotos se quedan en este dispositivo. Se guardan solo en este navegador y nunca se suben, sincronizan, exportan ni envían por correo.',
  'diary.privacy.detail': 'No forman parte de la exportación, la sincronización ni el correo semanal. Si borras los datos del sitio, cambias de navegador o cierras una ventana privada, se eliminan.',
  'diary.notSaved': 'Este navegador no está guardando las fotos en el disco ahora mismo, así que desaparecerán cuando cierres esta pestaña.',
  'diary.notMedical': 'Un diario de fotos sirve para mirar atrás; no es un diagnóstico ni un tratamiento.',
  'diary.takeFirst': 'Haz tu primera foto',
  'diary.takeThisWeek': 'Haz la foto de esta semana',
  'diary.due': 'Tu última foto fue {age}. Toca hacer una nueva.',
  'diary.cannotDecode': 'Este navegador no puede mostrar las fotos guardadas. Actualízalo o abre el diario en una versión reciente de Chrome, Edge, Firefox o Safari.',
  'diary.loading': 'Leyendo tus fotos de este dispositivo',
  'diary.count': 'Tus fotos ({count})',
  'diary.size': '{size} en este dispositivo',
  'diary.photoLabel': 'Foto del {date}',
  'diary.keep': 'Conservar',
  'diary.deleteOne.aria': 'Eliminar la foto del {date}',
  'diary.deleteOne.question': '¿Eliminar esta foto?',
  'diary.compareHeading': 'Antes y después',
  'diary.deleteNote': 'Al eliminar una foto, se quita de este navegador de forma definitiva.',
  'diary.deleteAll': 'Eliminar todas las fotos',
  'diary.deleteAll.question': '{count, plural, one {¿Eliminar la foto?} other {¿Eliminar todas las fotos (#)?}}',
  'diary.deleteAll.confirm': 'Eliminar todas',
  'diary.deleteAll.keep': 'Conservar mis fotos',

  'status.saved': 'Foto guardada en este dispositivo.',
  'status.savedTabOnly': 'Foto conservada solo en esta pestaña. Este navegador no la está guardando en el disco.',
  'status.deleted': 'Foto eliminada.',
  'status.deletedAll': 'Se eliminaron las {count} fotos.',

  // ── Before / after ──────────────────────────────────────────────────────────
  'compare.needTwo': 'Necesitas dos fotos para comparar. Haz otra la semana que viene y aquí podrás superponerla a la de hoy.',
  'compare.before': 'Antes',
  'compare.after': 'Después',
  'compare.same': 'Los dos lados muestran la misma foto. Elige dos fechas distintas para ver la diferencia.',
  'compare.photoBefore': 'Foto del {date} (antes)',
  'compare.photoAfter': 'Foto del {date} (después)',
  'compare.badgeBefore': 'Antes, {date}',
  'compare.badgeAfter': 'Después, {date}',
  'compare.sliderLabel': 'Mostrar la foto anterior',
  'compare.sliderValue': 'La foto anterior se muestra en el {percent} por ciento de la imagen',
  'compare.hint': 'Arrastra la imagen o el control deslizante para moverte entre las dos.',

  // ── Taking a photo ──────────────────────────────────────────────────────────
  'capture.title': 'Haz una foto de tus manos',
  'capture.idle': 'La cámara solo se abre mientras esta pantalla está abierta y se apaga en cuanto se hace la foto.',
  'capture.start': 'Iniciar la cámara',
  'capture.opening': 'Abriendo la cámara. Es posible que tu navegador te pida permiso.',
  'capture.photoLabel': 'La foto que acabas de hacer',
  'capture.reviewNote': 'La cámara está apagada. Guarda esta foto en tu diario en este dispositivo o hazla de nuevo.',
  'capture.saving': 'Guardando',
  'capture.save': 'Guardar foto',
  'capture.retake': 'Repetir',
  'capture.discard': 'Descartar',
  'capture.saved': 'Guardada en tu diario.',
  'capture.stopWatching': 'Dejar de vigilar y reintentar',
  'capture.previewLabel': 'Vista previa en directo de la cámara',
  'capture.guide': 'Coloca las manos planas dentro del marco, con las uñas hacia la cámara',
  'capture.mirrorNote': 'Mantén tu cara fuera de la imagen. La vista previa es un espejo y la foto se guarda tal como la ves.',
  'capture.countdown': 'Haciendo la foto en {n}',
  'capture.waiting': 'Esperando la imagen de la cámara',
  'capture.cancelTimer': 'Cancelar el temporizador',
  'capture.takeIn': 'Hacer foto en {seconds} segundos',
  'capture.takeNow': 'Hacerla ahora',
  'capture.notReady': 'La cámara todavía no ha mostrado ninguna imagen. Espera a que aparezca la vista previa y vuelve a intentarlo.',
  'capture.saveFailed': 'No se pudo guardar la foto. Inténtalo de nuevo.',
  'capture.hiddenNotice': 'La cámara se apagó porque saliste de esta página. Vuelve a iniciarla cuando quieras.',

  // ── Why the camera did not open ─────────────────────────────────────────────
  'problem.blocked.title': 'La cámara está bloqueada',
  'problem.blocked.detail': 'Tu navegador no permitió el acceso a la cámara. Permítelo para este sitio en la barra de direcciones o en los ajustes del navegador y vuelve a intentarlo.',
  'problem.noCamera.title': 'No se encontró ninguna cámara',
  'problem.noCamera.detail': 'Conecta una cámara web o comprueba que esté encendida y que no la bloquee un interruptor de privacidad; luego vuelve a intentarlo.',
  'problem.watching.title': 'La vigilancia está usando la cámara',
  'problem.watching.detail': 'Tu cámara no se abre por segunda vez mientras la vigilancia está activada. Detén la vigilancia, haz la foto y vuelve a iniciarla desde la pestaña Vigilar.',
  'problem.busy.title': 'La cámara está ocupada',
  'problem.busy.detail': 'Otra aplicación o pestaña del navegador está usando la cámara. Ciérrala y vuelve a intentarlo.',
  'problem.insecure.title': 'La cámara necesita una página segura',
  'problem.insecure.detail': 'Las cámaras solo funcionan en páginas https (o localhost). Abre Stop Biting en su dirección https y vuelve a intentarlo.',
  'problem.unknown.title': 'La cámara no se inició',
  'problem.unknown.detail': 'Algo salió mal al abrir la cámara. Inténtalo de nuevo o recarga la página.',
  'problem.frame.title': 'No se pudo hacer la foto',

  // ── Storage limits ──────────────────────────────────────────────────────────
  'store.full': 'El diario admite {max} fotos. Elimina algunas antiguas para añadir más.',
  'store.writeFailed': 'Este navegador no quiso guardar la foto. Libera espacio o inténtalo de nuevo.',

  // ── The weekly reminder strip (inside the app only) ─────────────────────────
  'reminder.aria': 'Recordatorio del diario de fotos',
  'reminder.text': '<b>Es hora de la foto de manos de esta semana.</b> La última fue {age}.',
  'reminder.open': 'Abrir el diario de fotos',
  'reminder.snooze': 'Ahora no',

  // ── Settings > Data > Photo diary ───────────────────────────────────────────
  'settings.saved': '{count, plural, =0 {No hay fotos guardadas.} one {# foto guardada, {size} en este navegador.} other {# fotos guardadas, {size} en este navegador.}}',
  'settings.deleteQuestion': '{count, plural, one {¿Eliminar la foto de este navegador?} other {¿Eliminar todas las fotos (#) de este navegador?}}',
  'settings.note': 'Borrar tu historial, o usar «Eliminar todo» en esta sección, no elimina las fotos. Usa este botón para ellas.',
  'settings.allDeleted': 'Se eliminaron todas las fotos.',

  // ── Small helpers ───────────────────────────────────────────────────────────
  'age.ago': '{count, plural, =0 {hoy} one {hace {count} día} other {hace {count} días}}',
};
