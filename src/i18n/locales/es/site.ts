// NEEDS NATIVE REVIEW. Spanish, the MARKETING pages (informal "tú"). Machine-drafted by the WS12b agent; no native speaker has read it.
// The review marker is ./reviewed.ts, shared with the app text. See docs/agents/ws12b-notes.md.
// (Imports carry their .ts extension: the build script loads this file with Node.)
import type { SiteCatalog } from '../../scopes/site';
import { messages as plans } from './plans.ts';
import { messages as chrome } from './marketing-chrome.ts';
import { messages as pricing } from './marketing-pricing.ts';
import { messages as about } from './marketing-about.ts';
import { messages as how } from './marketing-how.ts';
import { messages as home } from './marketing-home.ts';
import { messages as demo } from './marketing-demo.ts';

export const catalog = {
  plans,
  'marketing-chrome': chrome,
  'marketing-pricing': pricing,
  'marketing-about': about,
  'marketing-how': how,
  'marketing-home': home,
  'marketing-demo': demo,
} satisfies SiteCatalog;
