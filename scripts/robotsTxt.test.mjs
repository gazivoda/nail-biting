// public/robots.txt is a static file (Vite copies public/ into dist/, express.static serves it); nothing generates it.
// What it pins is what the 2026-11-09 crawler audit (docs/seo/audits/2026-11-09/geo-citability.md, section 4) found:
//   · every group that explicitly allows a crawler carries the same Content-Signal line as the `*` group. Per the
//     Content Signals spec a named group replaces `*` for that crawler, so a signal that sits only under `*` is not
//     seen by GPTBot, ClaudeBot and the rest;
//   · no `anthropic-ai` group: it is not one of Anthropic's documented robots (ClaudeBot, Claude-User, Claude-SearchBot;
//     support.claude.com article 8896518), so a block on it does nothing;
//   · the blocked groups (Bytespider, cohere-ai, Google-Extended) stay blocked. Google-Extended is the owner's call.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TEXT = readFileSync(fileURLToPath(new URL('../public/robots.txt', import.meta.url)), 'utf8');
const SIGNAL = 'Content-Signal: search=yes, ai-input=yes, ai-train=no';

/** Groups in file order: consecutive User-agent lines open one. Comments, blank lines and Sitemap (a global line) are skipped. */
function groups(text) {
  const out = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [field, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (/^sitemap$/i.test(field)) continue;
    if (/^user-agent$/i.test(field)) {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; out.push(current); }
      current.agents.push(value);
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current) current.rules.push(`${field.trim()}: ${value}`);
    }
  }
  return out;
}

const GROUPS = groups(TEXT);
const byAgent = name => GROUPS.find(g => g.agents.includes(name));
const ALLOWED = ['*', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot'];
const BLOCKED = ['Bytespider', 'cohere-ai', 'Google-Extended'];

describe('public/robots.txt', () => {
  it.each(ALLOWED)('%s: allowed, and carries the same Content-Signal line as every other allowed group', agent => {
    const group = byAgent(agent);
    expect(group, `${agent} group`).toBeTruthy();
    expect(group.rules).toContain('Allow: /');
    expect(group.rules).toContain('Disallow: /api/');
    expect(group.rules.filter(r => /^content-signal:/i.test(r))).toEqual([SIGNAL]);
  });

  it('has no anthropic-ai group (not a documented Anthropic robot)', () => {
    expect(TEXT).not.toMatch(/anthropic-ai/i);
  });

  it.each(BLOCKED)('%s: still blocked from the whole site', agent => {
    const group = byAgent(agent);
    expect(group, `${agent} group`).toBeTruthy();
    expect(group.rules).toEqual(['Disallow: /']);
  });

  it('names exactly the groups above, nothing added or dropped by accident', () => {
    expect(GROUPS.flatMap(g => g.agents).sort()).toEqual([...ALLOWED, ...BLOCKED].sort());
  });

  it('still points at the sitemap', () => {
    expect(TEXT).toMatch(/^Sitemap: https:\/\/stopbiting\.today\/sitemap\.xml$/m);
  });
});
