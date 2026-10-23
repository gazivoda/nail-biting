/**
 * Vite config for the Electron preload script: dist-electron/preload.cjs.
 *
 * Separate from the main-process build on purpose. A preload script has to be
 * one self-contained CommonJS file: built together with main it would share a
 * chunk with it (both import src/desktop/ipc.ts) and `import` that chunk, which
 * a preload loaded as an ES module cannot do early enough. Runs after
 * vite.electron.config.ts, which empties dist-electron/, so it must not.
 */

import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  publicDir: false,

  build: {
    outDir: 'dist-electron',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'electron/preload.ts'),
      formats: ['cjs'],
      // `.cjs` stays CommonJS although package.json says "type": "module".
      fileName: () => 'preload.cjs',
    },
    rollupOptions: {
      external: ['electron', 'path', 'fs', 'url', 'os', 'node:path', 'node:fs', 'node:url', 'node:os'],
    },
    minify: false,
    sourcemap: true,
  },

  resolve: {
    conditions: ['node', 'import'],
  },
});
