// The entry point for the lazy MARKETING chunk of es (WS12b): the text of /es, /es/pricing, ... Fetched only by a visitor
// who opened one of those pages (core.ts). Named locale-* so vite.config.ts keeps it out of the service worker precache.
export { reviewed } from './locales/es/reviewed';
export { catalog } from './locales/es/site';
