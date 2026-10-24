// Every scope, for the compiler (the locale files must cover each English key) and for the tests.
// Import this only from tests and tooling: it pulls every area's English text into one place.
import * as common from './common';
import * as shell from './shell';
import * as alarm from './alarm';
import * as watch from './watch';
import * as background from './background';
import * as calibration from './calibration';
import * as history from './history';
import * as insights from './insights';
import * as photos from './photos';
import * as settings from './settings';
import * as data from './data';
import * as sharing from './sharing';
import * as billing from './billing';
import * as auth from './auth';
import * as coaching from './coaching';
import * as phone from './phone';
import * as language from './language';
import * as trial from './trial';
import * as labels from './labels';
import * as plans from './plans';

export const SCOPES = {
  plans,
  labels,
  trial,
  common,
  shell,
  alarm,
  watch,
  background,
  calibration,
  history,
  insights,
  photos,
  settings,
  data,
  sharing,
  billing,
  auth,
  coaching,
  phone,
  language,
} as const;

export type ScopeName = keyof typeof SCOPES;
export type EnglishCatalog = { [S in ScopeName]: (typeof SCOPES)[S]['messages'] };
/** A translation covers every key of every scope. */
export type LocaleCatalog = { [S in ScopeName]: { [K in keyof EnglishCatalog[S]]: string } };
