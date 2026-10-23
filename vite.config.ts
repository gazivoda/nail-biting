import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execFileSync } from 'child_process'
import { VitePWA } from 'vite-plugin-pwa'
import { fillTrialTokens } from './shared/plans.js'

// Regenerates dist/seo-content.json + dist/llms-full.txt from
// src/data/blogPosts.ts and src/data/comparePages.ts after every build.
// server.js reads seo-content.json at startup and derives all crawler-visible
// article HTML and schema data from it — the server carries no copy of any
// content, so the crawler HTML cannot drift from what React renders.
// An error here fails the build, which is the point.
function generateSeoContent(): Plugin {
  return {
    name: 'generate-seo-content',
    apply: 'build',
    closeBundle() {
      execFileSync(
        process.execPath,
        [path.resolve(__dirname, 'scripts/generate-seo-content.mjs')],
        { stdio: 'inherit' },
      )
    },
  }
}

// index.html is static text, so it cannot import the trial length. It spells it as
// {{TRIAL_HYPHEN}}-style placeholders (see shared/plans.js) and this fills them in
// for dist/index.html, which server.js then reads. Nothing else in the file changes.
function fillTrialCopy(): Plugin {
  return {
    name: 'fill-trial-copy',
    transformIndexHtml: { order: 'pre', handler: (html: string) => fillTrialTokens(html) },
  }
}

// WS6: the web manifest is answered by server/routes/phone.js while phone_companion is on (it adds
// the home-screen shortcuts), so it must not be served from the service worker's precache: a
// precached copy would go to every returning visitor and the flag-aware answer would never reach
// them. vite-plugin-pwa adds the manifest to the precache list itself (workbox's manifestTransforms
// never sees that entry), so it is taken out through the plugin's own API, after it was added.
// The browser then fetches the manifest from the network (and its HTTP cache) like any other file.
function manifestOutOfPrecache(): Plugin {
  type Entry = string | { url: string }
  type PwaApi = { extendManifestEntries(fn: (entries: Entry[]) => Entry[] | void): void }
  let api: PwaApi | undefined
  return {
    name: 'manifest-out-of-precache',
    apply: 'build',
    configResolved(config) {
      api = (config.plugins.find((p) => p.name === 'vite-plugin-pwa') as { api?: PwaApi } | undefined)?.api
    },
    buildStart() {
      api?.extendManifestEntries((entries) => entries.filter((e) => (typeof e === 'string' ? e : e.url) !== 'manifest.webmanifest'))
    },
  }
}

const isWeb = process.env.VITE_BUILD_TARGET === 'web'

export default defineConfig({
  // Electron (file://) needs relative base './'; web server needs absolute '/'.
  // Set VITE_BUILD_TARGET=web when building for Docker/Coolify.
  base: isWeb ? '/' : './',

  // The trial length the client copy says, from the build's environment (TRIAL_DAYS, default
  // 3). shared/plans.js reads exactly this expression; with nothing set it stays the default.
  define: {
    'process.env.TRIAL_DAYS': JSON.stringify(process.env.TRIAL_DAYS ?? ''),
  },

  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  resolve: {
    // @mediapipe/tasks-vision has a malformed exports field that rolldown rejects.
    // Alias directly to the ESM bundle to bypass exports map resolution.
    alias: {
      '@mediapipe/tasks-vision': path.resolve(
        __dirname,
        'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs'
      ),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@mediapipe')) return 'mediapipe';
          // Split the libraries only the signed-in app touches into their own
          // chunks. Lumping every node_modules file into one `vendor` chunk
          // undoes route-level code splitting: React lives there too, so the
          // landing page pulls the whole thing in and gets recharts and the
          // Paddle SDK along for the ride.
          if (id.includes('recharts') || id.includes('victory-vendor') || /node_modules[\\/]d3-/.test(id)) {
            return 'charts';
          }
          if (id.includes('@paddle')) return 'paddle';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  plugins: [
    react(),
    fillTrialCopy(),
    generateSeoContent(),
    // PWA only for web builds — Electron handles its own install/update flow.
    ...(isWeb ? [VitePWA({
      registerType: 'autoUpdate',
      // Service worker file name
      filename: 'sw.js',
      // Manual registration (in main.tsx) defers SW from the critical path.
      injectRegister: null,
      manifest: {
        name: 'Stop Biting: AI Nail Habit Tracker',
        short_name: 'Stop Biting',
        description: 'Break the nail biting habit with on-device AI detection. Real-time webcam monitoring. No camera data is sent while it runs.',
        theme_color: '#F7F7F1',
        background_color: '#F7F7F1',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['health', 'lifestyle', 'utilities'],
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            // Full-bleed square (no transparent corners) so Android can mask it
            // to any shape; the lens sits inside the 80% safe zone.
            src: '/icons/maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [],
      },
      workbox: {
        // Cache the app shell (JS/CSS/HTML) with StaleWhileRevalidate.
        // MediaPipe WASM and model files are large and must NOT be cached by
        // the service worker — they have their own loading logic and caching
        // them in the SW cache would break WASM instantiation on some browsers.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/downloads\//, /^\/posts\//, /^\/signin/, /^\/redeem/, /^\/share\//],
        runtimeCaching: [
          {
            // App shell JS/CSS chunks — cache first, background update
            urlPattern: /\/assets\/.+\.(js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-shell',
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // One article's JSON (see hooks/usePost.ts). Network first, so a
            // revised article is never served stale while online (these are
            // health pages), with a short timeout and the last copy the reader
            // saw as the fallback so a post already opened still works offline.
            // Not precached: 149 files, and most readers open one or two.
            urlPattern: /\/posts\/[a-z0-9-]+\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'posts',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            // WS6: the brand fonts and the logo, kept by the worker after the first visit so the
            // installed phone app opens looking like itself with no signal. Before this they relied
            // on the browser's HTTP cache alone, which a browser may empty at any time. Not
            // precached: nobody downloads them earlier than they do today.
            urlPattern: /\/(fonts\/.+\.woff2|logo(-dark)?\.svg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'brand-static',
              expiration: { maxEntries: 12, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // Icons and static images — cache for 7 days
            urlPattern: /\/icons\/.+\.png$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'icons',
              expiration: { maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          // MediaPipe WASM and model files are intentionally NOT cached by
          // the service worker. They are served directly and rely on the
          // browser's HTTP cache (Cache-Control headers from Express).
        ],
        // Exclude WASM, MediaPipe models, and API routes from precaching
        globIgnores: [
          '**/mediapipe-wasm/**',
          '**/mediapipe-models/**',
          // The copy of the pages behind the compare_competitors flag: fetched only
          // once that flag is on, so it must not ride into every visitor's precache.
          '**/assets/competitorPages-*.js',
          // The desktop shell's tray bridge and camera notice (src/desktop). Loaded
          // only when window.desktop exists, which a browser never has.
          '**/assets/desktopHost-*.js',
          // The translations (src/i18n/locale-*.ts): fetched only by a person who picked that language,
          // so an English visitor's worker must not download them on install.
          '**/assets/locale-*.js',
        ],
      },
    })] : []),
    ...(isWeb ? [manifestOutOfPrecache()] : []),
  ],
})
