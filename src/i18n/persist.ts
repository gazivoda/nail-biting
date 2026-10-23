// Plugs the storage module in as the place the picked language is kept (kv 'i18n' / 'locale').
// Imported for its effect by the parts of the signed-in app that read or change the pick (LocaleHost,
// the language card). It is NOT imported by core.ts, scope.ts or any scope, so the alarm overlay and the
// detection hook (also loaded by the marketing demo) never reach the storage module through i18n.
import { kv } from '../storage/kv';
import { configurePersistence } from './core';

configurePersistence({
  read: () => kv.get<unknown>('i18n', 'locale', 'en'),
  write: locale => { kv.set('i18n', 'locale', locale); },
});
