// NEEDS NATIVE REVIEW. Brazilian Portuguese, the MARKETING pages ("você"). Machine-drafted by the WS12b agent; no native speaker has read it.
// The review marker is ./reviewed.ts, shared with the app text. See docs/agents/ws12b-notes.md.
// (Imports carry their .ts extension: the build script loads this file with Node.)
import type { SiteCatalog } from '../../scopes/site';
import { messages as plans } from './plans.ts';
import { messages as chrome } from './marketing-chrome.ts';
import { messages as pricing } from './marketing-pricing.ts';
import { messages as about } from './marketing-about.ts';

export const catalog = {
  plans,
  'marketing-chrome': chrome,
  'marketing-pricing': pricing,
  'marketing-about': about,
} satisfies SiteCatalog;
