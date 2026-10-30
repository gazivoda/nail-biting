// The node_modules chunk rule (scripts/build/chunks.ts) on a small fake module graph, so it is checked without a build.
// What it protects: `vendor` is what the entry needs and nothing else, so the home page, /pricing and the articles do
// not download recharts' dependencies or the libraries only the signed-in app uses.
import { describe, expect, it } from 'vitest';
import { createNodeModulesChunks } from './chunks';

type Mod = { imports?: string[]; dynamic?: string[]; entry?: boolean };

const NM = '/repo/node_modules/';
const pkg = (name: string) => `${NM}${name}/index.js`;

// html (entry) -> main -> App ---> react, react-dom, zustand, tiny-invariant, lucide-react (static)
//                           `-- (dynamic) SignedInApp ---> Dashboard (dynamic) ---> recharts ---> redux-toolkit, immer,
//                                                    |                               d3-scale, tiny-invariant, clsx, react
//                                                    |                               `-- Dashboard also: date-fns, paddle (dynamic), mediapipe (dynamic)
//                                                    `--> Log (dynamic) ---> clsx, date-fns
const GRAPH: Record<string, Mod> = {
  '/repo/index.html': { entry: true, imports: ['/repo/src/main.tsx'] },
  '/repo/src/main.tsx': { imports: [pkg('react'), pkg('react-dom'), '/repo/src/App.tsx'] },
  '/repo/src/App.tsx': {
    imports: [pkg('zustand'), pkg('tiny-invariant'), pkg('lucide-react')],
    dynamic: ['/repo/src/SignedInApp.tsx'],
  },
  '/repo/src/SignedInApp.tsx': { dynamic: ['/repo/src/Dashboard.tsx', '/repo/src/Log.tsx'] },
  '/repo/src/Dashboard.tsx': { imports: [pkg('recharts'), pkg('date-fns')], dynamic: [pkg('@paddle/paddle-js'), pkg('@mediapipe/tasks-vision')] },
  '/repo/src/Log.tsx': { imports: [pkg('clsx'), pkg('date-fns')] },
  [pkg('recharts')]: { imports: [pkg('@reduxjs/toolkit'), pkg('d3-scale'), pkg('tiny-invariant'), pkg('clsx'), pkg('react')] },
  [pkg('@reduxjs/toolkit')]: { imports: [pkg('immer')] },
  [pkg('immer')]: {},
  [pkg('d3-scale')]: {},
  [pkg('tiny-invariant')]: {},
  [pkg('clsx')]: {},
  [pkg('react')]: {},
  [pkg('react-dom')]: { imports: [pkg('react'), pkg('scheduler')] },
  [pkg('scheduler')]: {},
  [pkg('zustand')]: { imports: [pkg('react')] },
  [pkg('lucide-react')]: {},
  [pkg('date-fns')]: {},
  [pkg('@paddle/paddle-js')]: {},
  [pkg('@mediapipe/tasks-vision')]: {},
};

function chunkOf(graph: Record<string, Mod> = GRAPH) {
  const importers: Record<string, string[]> = {};
  const dynamicImporters: Record<string, string[]> = {};
  for (const [id, m] of Object.entries(graph)) {
    for (const to of m.imports ?? []) (importers[to] ??= []).push(id);
    for (const to of m.dynamic ?? []) (dynamicImporters[to] ??= []).push(id);
  }
  const meta = {
    getModuleIds: () => Object.keys(graph)[Symbol.iterator](),
    getModuleInfo: (id: string) => {
      const m = graph[id];
      return m
        ? ({ id, isEntry: !!m.entry, importedIds: m.imports ?? [], dynamicallyImportedIds: m.dynamic ?? [], importers: importers[id] ?? [], dynamicImporters: dynamicImporters[id] ?? [] } as never)
        : null;
    },
  };
  const fn = createNodeModulesChunks();
  return (id: string) => fn(id, meta as never);
}

describe('node_modules chunks', () => {
  const of = chunkOf();

  it('vendor is what the entry reaches through static imports', () => {
    for (const name of ['react', 'react-dom', 'scheduler', 'zustand']) expect(of(pkg(name)), name).toBe('vendor');
  });

  it('a library the entry and recharts both use stays in vendor, not in charts', () => {
    expect(of(pkg('tiny-invariant'))).toBe('vendor');
  });

  it('recharts and the modules only it uses go to charts', () => {
    for (const name of ['recharts', 'd3-scale', '@reduxjs/toolkit', 'immer']) expect(of(pkg(name)), name).toBe('charts');
  });

  it('a library recharts shares with other lazy code goes to vendor-app, so those pages do not pull in charts', () => {
    expect(of(pkg('clsx'))).toBe('vendor-app');
  });

  it('a library only the signed-in app uses goes to vendor-app, never to vendor', () => {
    expect(of(pkg('date-fns'))).toBe('vendor-app');
  });

  it('keeps the checkout SDK and the detector in their own chunks', () => {
    expect(of(pkg('@paddle/paddle-js'))).toBe('paddle');
    expect(of(pkg('@mediapipe/tasks-vision'))).toBe('mediapipe');
  });

  it('leaves the lucide icons to Rollup, and source files alone', () => {
    expect(of(pkg('lucide-react'))).toBeUndefined();
    expect(of('/repo/src/App.tsx')).toBeUndefined();
  });

  it('a library added to the signed-in app later lands in vendor-app without a list being edited', () => {
    const graph: Record<string, Mod> = {
      ...GRAPH,
      '/repo/src/Log.tsx': { imports: [pkg('clsx'), pkg('date-fns'), pkg('some-new-lib')] },
      [pkg('some-new-lib')]: {},
    };
    expect(chunkOf(graph)(pkg('some-new-lib'))).toBe('vendor-app');
  });

  it('answers the same when asked again (the graph is read once)', () => {
    expect(of(pkg('react'))).toBe('vendor');
    expect(of(pkg('date-fns'))).toBe('vendor-app');
  });
});
