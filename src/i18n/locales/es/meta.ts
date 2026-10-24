// NEEDS NATIVE REVIEW. Spanish, the meta text of the MARKETING pages (title, descriptions, structured data, 404). Machine-drafted by the WS12b agent.
// Read only by the build (scripts/generate-locale-pages.mjs); the browser never loads it.
import type { MetaCatalog } from '../../scopes/site';
import { messages as meta } from './marketing-meta.ts';

export const catalog = {
  'marketing-meta': meta,
} satisfies MetaCatalog;
