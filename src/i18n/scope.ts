// One scope per area of the app (src/i18n/scopes/<name>.ts). A scope holds its English messages
// and gives back the functions that read them:
//
//   export const messages = { 'title': 'Watch', 'alerts': '{count, plural, one {# alert} other {# alerts}}' };
//   export const { t, useT } = createScope('watch', messages);
//
//   // in a component:               const t = useT();   t('title')   t('alerts', { count: 3 })
//   // outside React (a handler, a notification, a pure helper):   import { t } from '.../scopes/watch'
//   // with a link or bold inside:   t.rich('note', {}, { link: chunks => <a href="/privacy">{chunks}</a> })
//
// Why scopes and not one big catalog: the English text of an area is imported by the code of that
// area, so it lands in that area's lazy chunk, where the same text was before. The main bundle
// pays for this file and core.ts, nothing else. Translations are one object per locale per scope
// (src/i18n/locales/<locale>/<scope>.ts), fetched only for a person who picked that locale.
//
// Keys are typed: t('typo') does not compile. English is the source of truth and the fallback.
// Do not call t() at module level (the value would be frozen in the language of the first render);
// build labels inside the function or component that shows them.

import { createElement, Fragment, useMemo, type ReactNode } from 'react';
import { intlTag, lookup, transformOutput } from './core.ts';
import { useLocaleVersion } from './hooks.ts';
import { formatMessage, formatToParts, parseRich, type Params, type RichNode } from './message.ts';

export type { Params } from './message.ts';
export type RichTags = Readonly<Record<string, (children: ReactNode) => ReactNode>>;

function renderRich(nodes: RichNode[], tags: RichTags): ReactNode[] {
  return nodes.map(n => {
    if (typeof n === 'string') return transformOutput(n);
    const children = createElement(Fragment, null, ...renderRich(n.children, tags));
    const render = tags[n.tag];
    return render ? render(children) : children;
  });
}

export function createScope<M extends Readonly<Record<string, string>>>(scope: string, english: M) {
  type Key = keyof M & string;

  function t(key: Key, params?: Params): string {
    const template = lookup(scope, key) ?? english[key] ?? key;
    return transformOutput(formatMessage(template, params, intlTag()));
  }

  /** Like t(), for a message with <tag>...</tag> pieces: each tag is turned into an element by `tags`. */
  function rich(key: Key, params: Params | undefined, tags: RichTags): ReactNode {
    const template = lookup(scope, key) ?? english[key] ?? key;
    try {
      return createElement(Fragment, null, ...renderRich(parseRich(formatToParts(template, params, intlTag())), tags));
    } catch {
      return transformOutput(formatMessage(template, params, intlTag()));
    }
  }

  const withRich = Object.assign(t, { rich });

  /** The component-side `t`. Subscribes to language changes; the function changes identity when they happen. */
  function useT() {
    const version = useLocaleVersion();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the dependency on purpose: it is the language
    return useMemo(() => Object.assign((key: Key, params?: Params) => t(key, params), { rich }), [version]);
  }

  return { t: withRich, useT, messages: english };
}

export type Scope<M extends Readonly<Record<string, string>>> = ReturnType<typeof createScope<M>>;
