// Which Rollup chunk each node_modules module goes in (called from the `manualChunks` of vite.config.ts), kept here
// so a test can run it against a small fake module graph (chunks.test.ts) without a build.
//
// The rule that matters: `vendor` holds the libraries the ENTRY needs and nothing else. Every marketing page
// (home, pricing, a blog post) downloads the entry and `vendor` before React can render, so a library only the
// signed-in app uses must not be in it. It used to be one lump (`id.includes('node_modules') -> vendor`), which put
// recharts' own dependencies (redux toolkit, immer, reselect, es-toolkit, decimal.js ...), date-fns and the icons
// only the signed-in app draws into the file the home page waits for: 101 KB gzipped, of which react-dom, react,
// scheduler and zustand (the 60 KB it is now) were the part a marketing page runs.
//
// "The libraries the entry needs" is read off the module graph, not from a list of package names, so a library
// added to the signed-in app later lands in `vendor-app` by itself:
//   vendor      node_modules modules the entry reaches through static imports (react, react-dom, scheduler, zustand)
//   charts      recharts and the node_modules modules only recharts uses
//   mediapipe   the detector's WebAssembly glue (only the demo and the signed-in app import it, lazily)
//   paddle      the checkout SDK (lazily)
//   (none)      lucide-react: see below
//   vendor-app  every other node_modules module (date-fns ...): fetched by the lazy chunks that import it, never by
//               a marketing page
// A static import can only point "down" this list (vendor-app, charts and the rest import vendor, never the other
// way round), because `vendor` is closed under static imports by construction: no cycle between them.
//
// lucide-react is left to Rollup (no manual chunk). It is a barrel that imports every one of its icons, so the entry
// "reaches" all of them through it, whichever it draws, and a graph rule would put the icons only the signed-in app
// uses into `vendor`. Left alone, Rollup puts each icon that is used in the chunk that uses it, and an icon two lazy
// chunks share in a small chunk named after it (arrow-left-*.js ...). Measured: 4.4 KB gzipped less in the two files
// the home page waits for.
import type { GetManualChunk, GetModuleInfo } from 'rollup';

const NODE_MODULES = /[\\/]node_modules[\\/]/;
const isChartsLibrary = (id: string) =>
  id.includes('recharts') || id.includes('victory-vendor') || /node_modules[\\/]d3-/.test(id);

/** Every module reachable from `roots` through static imports only (a dynamic `import()` starts another chunk). */
function staticClosure(roots: Iterable<string>, getModuleInfo: GetModuleInfo): Set<string> {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of getModuleInfo(id)?.importedIds ?? []) stack.push(next);
  }
  return seen;
}

/**
 * The node_modules modules recharts uses and nothing outside recharts imports: its closure, minus the modules the
 * entry needs, minus (repeatedly) any module that something outside this set imports, statically or dynamically.
 */
function chartsOnly(getModuleInfo: GetModuleInfo, ids: Iterable<string>, entry: Set<string>): Set<string> {
  const roots = [...ids].filter((id) => NODE_MODULES.test(id) && isChartsLibrary(id));
  const set = new Set([...staticClosure(roots, getModuleInfo)].filter((id) => NODE_MODULES.test(id) && !entry.has(id)));
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of set) {
      if (isChartsLibrary(id)) continue;
      const info = getModuleInfo(id);
      const importers = [...(info?.importers ?? []), ...(info?.dynamicImporters ?? [])];
      if (importers.some((importer) => !set.has(importer))) {
        set.delete(id);
        changed = true;
      }
    }
  }
  return set;
}

export function createNodeModulesChunks(): GetManualChunk {
  let entry: Set<string> | undefined;
  let charts: Set<string> | undefined;
  return (id, { getModuleIds, getModuleInfo }) => {
    if (!NODE_MODULES.test(id)) return undefined;

    if (id.includes('@mediapipe')) return 'mediapipe';
    if (isChartsLibrary(id)) return 'charts';
    if (id.includes('@paddle')) return 'paddle';
    if (id.includes('lucide-react')) return undefined;

    if (!entry) {
      const ids = [...getModuleIds()];
      entry = staticClosure(ids.filter((m) => getModuleInfo(m)?.isEntry), getModuleInfo);
      charts = chartsOnly(getModuleInfo, ids, entry);
    }
    if (entry.has(id)) return 'vendor';
    if (charts?.has(id)) return 'charts';
    return 'vendor-app';
  };
}
