// NEEDS NATIVE REVIEW. German (informal "du"). Machine-drafted by the WS12a agent; no native speaker has read it.
//
// Before turning the language on for people (FEATURE_FLAGS=locale_de):
//   1. have a native speaker read every file in this folder (and check the terms in docs/agents/ws12a-notes.md),
//   2. then set `reviewed` below to true. While it is false the language picker says the translation is a draft.
import type { LocaleCatalog } from '../../scopes';
import { messages as common } from './common';
import { messages as shell } from './shell';
import { messages as alarm } from './alarm';
import { messages as watch } from './watch';
import { messages as background } from './background';
import { messages as calibration } from './calibration';
import { messages as history } from './history';
import { messages as insights } from './insights';
import { messages as photos } from './photos';
import { messages as settings } from './settings';
import { messages as data } from './data';
import { messages as sharing } from './sharing';
import { messages as billing } from './billing';
import { messages as auth } from './auth';
import { messages as coaching } from './coaching';
import { messages as phone } from './phone';
import { messages as language } from './language';
import { messages as trial } from './trial';
import { messages as labels } from './labels';
import { messages as plans } from './plans';

export const reviewed = false;

export const catalog = {
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
} satisfies LocaleCatalog;
