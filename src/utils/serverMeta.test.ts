import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// seo:check only measures blog post descriptions. The page metas live as
// literals in server.js, where /pricing once shipped at 203 characters and
// was cut off in results. Same ceiling the posts use (160 since round 7).
describe('server.js page meta descriptions', () => {
  const src = readFileSync('server.js', 'utf8');
  const literals = [...src.matchAll(/\n\s+description: '((?:[^'\\]|\\.)*)'/g)].map(m =>
    m[1].replace(/\\'/g, "'"),
  );

  it('finds the page metas', () => {
    expect(literals.length).toBeGreaterThan(20);
  });

  it('keeps every literal description at 160 characters or fewer', () => {
    const tooLong = literals.filter(d => d.length > 160).map(d => `${d.length}: ${d.slice(0, 60)}`);
    expect(tooLong).toEqual([]);
  });
});
