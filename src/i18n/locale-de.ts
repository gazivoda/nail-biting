// The entry point for the lazy chunk of de. Fetched only after a person picks this language
// (core.ts). Named locale-* so vite.config.ts can keep these chunks out of the service worker precache.
export { catalog, reviewed } from './locales/de';
