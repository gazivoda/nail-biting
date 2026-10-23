// NEEDS NATIVE REVIEW (machine draft). Scope "alarm", locale de.
import type { messages as en } from '../../scopes/alarm';

export const messages: Record<keyof typeof en, string> = {
  'overlay.title': 'Hände runter',
  'overlay.hint': 'Drücke deinen Daumen nacheinander gegen jede Fingerspitze.',

  'alert.tabTitle': '⚠️ Nicht beißen! – Stop Biting',
  'alert.notification.title': 'Nicht beißen!',
  'alert.notification.body': 'Nägelkauen erkannt – nimm die Hände weg.',

  'suggestion.thumbs': 'Drücke den Daumen gegen jede Fingerspitze',
  'suggestion.fist': 'Faust ballen und lösen · 5×',
  'suggestion.exhale': 'Atme langsam durch die Nase aus',
  'suggestion.water': 'Trinke achtsam einen Schluck Wasser',

  'reminder.title': 'Hände-Check',
  'reminder.body.thumbs': 'Wo sind deine Hände? Falls sie nah an deinem Gesicht sind, probier Folgendes: Drücke den Daumen gegen jede Fingerspitze.',
  'reminder.body.fist': 'Wo sind deine Hände? Falls sie nah an deinem Gesicht sind, probier Folgendes: Balle die Faust und löse sie wieder · 5×.',
  'reminder.body.exhale': 'Wo sind deine Hände? Falls sie nah an deinem Gesicht sind, probier Folgendes: Atme langsam durch die Nase aus.',
  'reminder.body.water': 'Wo sind deine Hände? Falls sie nah an deinem Gesicht sind, probier Folgendes: Trinke achtsam einen Schluck Wasser.',

  'notABite.announce.offered': 'Alarm. Falls es ein Fehlalarm war, tippe auf Kein Biss.',
  'notABite.announce.marked': 'Als „Kein Biss“ markiert. Er wird nicht gezählt. Tippe auf Rückgängig, um es zurückzunehmen.',
  'notABite.toast.alarm': 'Alarm.',
  'notABite.toast.question': 'Nur die Hand abgelegt?',
  'notABite.toast.marked': 'Als „Kein Biss“ markiert. Er wird nicht gezählt.',
  'notABite.toast.calibrateOffer': 'Möchtest du der Erkennung beibringen, wie du dein Kinn abstützt? Das dauert nur eine Minute.',
  'notABite.calibrate': 'Kalibrieren',
  'notABite.button': 'Kein Biss',
  'notABite.undo': 'Rückgängig',
  'notABite.close': 'Schließen',
};
