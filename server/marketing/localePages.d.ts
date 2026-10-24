// Types for the one function of server/marketing/localePages.js that the TypeScript tests import (src/i18n/marketing/articles.test.tsx):
// the rest of the module is plain server code, tested by server/marketing/localePages.test.js.

/** A language's dist/i18n file resolved for one set of flags: the {{if}} markers and {{TOKENS}} replaced. Same shape in, same shape out. */
export function resolveForProcess<T>(raw: T, copyIsOn: (name: string) => boolean): T;
