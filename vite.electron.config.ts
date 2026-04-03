/**
 * Vite config for building the Electron main process, preload script, and
 * the Express backend server — all compiled into dist-electron/.
 *
 * This is separate from the renderer build (vite.config.ts). It outputs
 * ESM Node.js code that Electron and Node load directly.
 */

import { defineConfig } from 'vite';
import path from 'path';

// Node.js built-ins that must never be bundled
const NODE_BUILTINS = [
  'electron',
  // bare names
  'path', 'fs', 'fs/promises', 'url', 'child_process',
  'os', 'crypto', 'stream', 'util', 'events', 'buffer',
  'http', 'https', 'net', 'tls', 'dgram', 'dns',
  'assert', 'zlib', 'readline', 'process', 'querystring',
  'async_hooks', 'worker_threads',
  // node: prefixed variants
  'node:path', 'node:fs', 'node:fs/promises', 'node:url', 'node:child_process',
  'node:os', 'node:crypto', 'node:stream', 'node:stream/web', 'node:util',
  'node:events', 'node:buffer', 'node:http', 'node:https', 'node:net',
  'node:tls', 'node:dgram', 'node:dns', 'node:assert', 'node:zlib',
  'node:readline', 'node:process', 'node:querystring', 'node:async_hooks',
  'node:worker_threads',
];

export default defineConfig({
  // Do NOT copy public/ into dist-electron/ — that belongs in dist/ (renderer build only)
  publicDir: false,

  build: {
    // Output goes to dist-electron/ so it doesn't clash with the renderer dist/
    outDir: 'dist-electron',
    emptyOutDir: true,

    // Three entry points: main process, preload, and the Express server
    lib: {
      entry: {
        main: path.resolve(__dirname, 'electron/main.ts'),
        preload: path.resolve(__dirname, 'electron/preload.ts'),
        server: path.resolve(__dirname, 'server.js'),
      },
      // ESM — Electron 28+ and modern Node both support it natively
      formats: ['es'],
    },

    rollupOptions: {
      // Electron and Node.js built-ins must NOT be bundled.
      // All third-party deps (express, google-auth-library, etc.) ARE bundled
      // into server.js so the packaged app doesn't need node_modules on disk.
      external: NODE_BUILTINS,
      output: {
        // Preserve entry file names
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
      },
    },

    // Don't minify — keeps stack traces readable and doesn't matter for desktop
    minify: false,

    // Sourcemaps help with debugging
    sourcemap: true,
  },

  resolve: {
    // Ensure TypeScript paths resolve correctly for Node context
    conditions: ['node', 'import'],
  },
});
