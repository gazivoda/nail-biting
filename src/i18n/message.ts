// The message format. Pure TypeScript: no React, no DOM, no storage.
//
//   "Hello"                                         plain text
//   "{name} logged this"                            a named placeholder, inserted as written
//   "{n, number} entries"                           a number in the active locale (1,234 / 1.234)
//   "{n, plural, =0 {No alerts} one {# alert} other {# alerts}}"
//                                                   plural by Intl.PluralRules of the active locale;
//                                                   "=0" matches exactly; "#" is the number, in the
//                                                   locale's format; "other" is required
//   "{kind, select, low {Quiet} high {Loud} other {Normal}}"
//                                                   a choice by a string value; "other" is required
//   "Read the <link>privacy note</link>"            rich tags, read only by `rich()` in scope.ts
//
// Literal braces are not supported (nothing in the app's copy needs one). Apostrophes are plain text:
// this is a subset of ICU MessageFormat, with ICU's quoting left out on purpose, so English copy such
// as "don't" is written as it reads.
//
// A placeholder with no value is left visible as "{name}", so a missing parameter shows up in a
// screenshot or a test instead of silently becoming an empty string.

export type ParamValue = string | number | boolean | null | undefined;
export type Params = Readonly<Record<string, ParamValue>>;

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

type Node =
  | { t: 'text'; v: string }
  | { t: 'arg'; name: string }
  | { t: 'number'; name: string }
  | { t: 'hash' }
  | { t: 'plural'; name: string; cases: Array<{ key: string; body: Node[] }> }
  | { t: 'select'; name: string; cases: Array<{ key: string; body: Node[] }> };

class MessageSyntaxError extends Error {}

// ── Parser ───────────────────────────────────────────────────────────────────

function parseNodes(src: string, start: number, inPlural: boolean, stopAtBrace: boolean): { nodes: Node[]; end: number } {
  const nodes: Node[] = [];
  let text = '';
  let i = start;
  const flush = () => { if (text) { nodes.push({ t: 'text', v: text }); text = ''; } };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '}') {
      if (stopAtBrace) { flush(); return { nodes, end: i }; }
      throw new MessageSyntaxError(`Unexpected "}" at ${i} in: ${src}`);
    }
    if (ch === '#' && inPlural) {
      flush();
      nodes.push({ t: 'hash' });
      i += 1;
      continue;
    }
    if (ch !== '{') { text += ch; i += 1; continue; }
    flush();
    // an argument: {name} | {name, number} | {name, plural, ...} | {name, select, ...}
    let j = i + 1;
    let name = '';
    while (j < src.length && src[j] !== ',' && src[j] !== '}') { name += src[j]; j += 1; }
    name = name.trim();
    if (!name || j >= src.length) throw new MessageSyntaxError(`Bad placeholder at ${i} in: ${src}`);
    if (src[j] === '}') { nodes.push({ t: 'arg', name }); i = j + 1; continue; }
    j += 1; // the comma
    let kind = '';
    while (j < src.length && src[j] !== ',' && src[j] !== '}') { kind += src[j]; j += 1; }
    kind = kind.trim();
    if (j >= src.length) throw new MessageSyntaxError(`Unclosed placeholder at ${i} in: ${src}`);
    if (kind === 'number') {
      if (src[j] !== '}') throw new MessageSyntaxError(`"number" takes no options at ${i} in: ${src}`);
      nodes.push({ t: 'number', name });
      i = j + 1;
      continue;
    }
    if (kind !== 'plural' && kind !== 'select') throw new MessageSyntaxError(`Unknown placeholder type "${kind}" in: ${src}`);
    if (src[j] !== ',') throw new MessageSyntaxError(`"${kind}" needs cases in: ${src}`);
    j += 1;
    const cases: Array<{ key: string; body: Node[] }> = [];
    for (;;) {
      while (j < src.length && /\s/.test(src[j])) j += 1;
      if (src[j] === '}') { j += 1; break; }
      let key = '';
      while (j < src.length && src[j] !== '{' && !/\s/.test(src[j]) && src[j] !== '}') { key += src[j]; j += 1; }
      while (j < src.length && /\s/.test(src[j])) j += 1;
      if (!key || src[j] !== '{') throw new MessageSyntaxError(`Bad case "${key}" in: ${src}`);
      const body = parseNodes(src, j + 1, kind === 'plural' ? true : inPlural, true);
      cases.push({ key, body: body.nodes });
      j = body.end + 1;
    }
    if (!cases.some(c => c.key === 'other')) throw new MessageSyntaxError(`"${kind}" needs an "other" case in: ${src}`);
    nodes.push({ t: kind as 'plural' | 'select', name, cases });
    i = j;
  }
  if (stopAtBrace) throw new MessageSyntaxError(`Unclosed case in: ${src}`);
  flush();
  return { nodes, end: i };
}

const cache = new Map<string, Node[]>();

function parse(src: string): Node[] {
  let nodes = cache.get(src);
  if (!nodes) {
    nodes = parseNodes(src, 0, false, false).nodes;
    cache.set(src, nodes);
  }
  return nodes;
}

// ── Intl helpers (cached per locale tag) ─────────────────────────────────────

const numberFormats = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

function numberFormat(tag: string): Intl.NumberFormat {
  let f = numberFormats.get(tag);
  if (!f) numberFormats.set(tag, (f = new Intl.NumberFormat(tag)));
  return f;
}

function pluralFor(tag: string, n: number): PluralCategory {
  let r = pluralRules.get(tag);
  if (!r) pluralRules.set(tag, (r = new Intl.PluralRules(tag)));
  return r.select(n) as PluralCategory;
}

/** The plural categories Intl says `tag` has (always includes "other"). */
export function pluralCategoriesOf(tag: string): PluralCategory[] {
  return new Intl.PluralRules(tag).resolvedOptions().pluralCategories as PluralCategory[];
}

// ── Evaluator ────────────────────────────────────────────────────────────────

/** A piece of output: literal text from the template, or a value that came from `params`. */
export interface Part { text: string; value: boolean }

interface Ctx { tag: string; params: Params; plural?: { n: number } }

function evaluate(nodes: Node[], ctx: Ctx, out: Part[]): void {
  for (const node of nodes) {
    switch (node.t) {
      case 'text':
        out.push({ text: node.v, value: false });
        break;
      case 'arg': {
        const v = ctx.params[node.name];
        out.push({ text: v === undefined || v === null ? `{${node.name}}` : String(v), value: v !== undefined && v !== null });
        break;
      }
      case 'number': {
        const v = ctx.params[node.name];
        const n = typeof v === 'number' ? v : Number(v);
        out.push(Number.isFinite(n) ? { text: numberFormat(ctx.tag).format(n), value: true } : { text: `{${node.name}}`, value: false });
        break;
      }
      case 'hash':
        out.push({ text: ctx.plural ? numberFormat(ctx.tag).format(ctx.plural.n) : '#', value: !!ctx.plural });
        break;
      case 'plural': {
        const raw = ctx.params[node.name];
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (raw === undefined || raw === null || !Number.isFinite(n)) { out.push({ text: `{${node.name}}`, value: false }); break; }
        const chosen =
          node.cases.find(c => c.key === `=${n}`) ??
          node.cases.find(c => c.key === pluralFor(ctx.tag, n)) ??
          node.cases.find(c => c.key === 'other')!;
        evaluate(chosen.body, { ...ctx, plural: { n } }, out);
        break;
      }
      case 'select': {
        const raw = ctx.params[node.name];
        const key = raw === undefined || raw === null ? 'other' : String(raw);
        const chosen = node.cases.find(c => c.key === key) ?? node.cases.find(c => c.key === 'other')!;
        evaluate(chosen.body, ctx, out);
        break;
      }
    }
  }
}

/** The message as parts (text and inserted values), for `rich()`. Never throws. */
export function formatToParts(template: string, params: Params | undefined, tag: string): Part[] {
  try {
    const out: Part[] = [];
    evaluate(parse(template), { tag, params: params ?? {} }, out);
    return out;
  } catch {
    return [{ text: template, value: false }]; // a malformed template is shown as written; tests catch it
  }
}

/** The message as a string. Never throws. Plain text (no "{") is returned as is, with no parsing. */
export function formatMessage(template: string, params: Params | undefined, tag: string): string {
  if (template.indexOf('{') < 0) return template;
  return formatToParts(template, params, tag).map(p => p.text).join('');
}

// ── Rich tags ────────────────────────────────────────────────────────────────

export type RichNode = string | { tag: string; children: RichNode[] };

const TAG = /<(\/?)([a-z][a-z0-9]*)>/g;

/** Splits the parts into text and `<tag>...</tag>` elements. Tags exist only in the literal text of the template. */
export function parseRich(parts: Part[]): RichNode[] {
  const root: RichNode[] = [];
  const stack: Array<{ tag: string; children: RichNode[] }> = [];
  const top = () => (stack.length ? stack[stack.length - 1].children : root);
  for (const part of parts) {
    if (part.value) { top().push(part.text); continue; }
    let last = 0;
    TAG.lastIndex = 0;
    for (let m = TAG.exec(part.text); m; m = TAG.exec(part.text)) {
      if (m.index > last) top().push(part.text.slice(last, m.index));
      last = m.index + m[0].length;
      const [, closing, tag] = m;
      if (!closing) {
        stack.push({ tag, children: [] });
      } else {
        const open = stack.pop();
        if (!open || open.tag !== tag) throw new MessageSyntaxError(`Mismatched </${tag}>`);
        top().push({ tag: open.tag, children: open.children });
      }
    }
    if (last < part.text.length) top().push(part.text.slice(last));
  }
  if (stack.length) throw new MessageSyntaxError(`Unclosed <${stack[stack.length - 1].tag}>`);
  return root;
}

// ── Inspection (the catalog tests) ───────────────────────────────────────────

export interface MessageInfo {
  /** placeholder name -> how it is used ("arg", "number", "plural", "select"); a name used two ways reads "arg+plural". */
  placeholders: Record<string, string>;
  /** plural categories and exact matches the template mentions (e.g. "one", "other", "=0"). */
  pluralKeys: string[];
  /** select keys. */
  selectKeys: string[];
  /** rich tag names. */
  tags: string[];
}

export function inspectMessage(template: string): MessageInfo {
  const placeholders: Record<string, Set<string>> = {};
  const pluralKeys = new Set<string>();
  const selectKeys = new Set<string>();
  const tags = new Set<string>();
  const add = (name: string, kind: string) => { (placeholders[name] ??= new Set()).add(kind); };
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.t === 'text') {
        TAG.lastIndex = 0;
        for (let m = TAG.exec(n.v); m; m = TAG.exec(n.v)) if (!m[1]) tags.add(m[2]);
      } else if (n.t === 'arg') add(n.name, 'arg');
      else if (n.t === 'number') add(n.name, 'number');
      else if (n.t === 'plural' || n.t === 'select') {
        add(n.name, n.t);
        for (const c of n.cases) { (n.t === 'plural' ? pluralKeys : selectKeys).add(c.key); walk(c.body); }
      }
    }
  };
  walk(parse(template));
  return {
    placeholders: Object.fromEntries(Object.entries(placeholders).map(([k, v]) => [k, [...v].sort().join('+')])),
    pluralKeys: [...pluralKeys].sort(),
    selectKeys: [...selectKeys].sort(),
    tags: [...tags].sort(),
  };
}

/** Throws a readable error when the template cannot be parsed (the catalog tests call this on every message). */
export function assertParses(template: string): void {
  parse(template);
}
