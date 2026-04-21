import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

const isWeb = process.env.VITE_BUILD_TARGET === 'web'

export default defineConfig({
  // Electron (file://) needs relative base './'; web server needs absolute '/'.
  // Set VITE_BUILD_TARGET=web when building for Docker/Coolify.
  base: isWeb ? '/' : './',

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
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  plugins: [
    react(),
    // PWA only for web builds — Electron handles its own install/update flow.
    ...(isWeb ? [VitePWA({
      registerType: 'autoUpdate',
      // Service worker file name
      filename: 'sw.js',
      // Manual registration (in main.tsx) defers SW from the critical path.
      injectRegister: null,
      manifest: {
        name: 'Stop Biting — AI Nail Habit Tracker',
        short_name: 'Stop Biting',
        description: 'Break the nail biting habit with on-device AI detection. Real-time webcam monitoring, 100% private.',
        theme_color: '#020617',
        background_color: '#020617',
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
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
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
        navigateFallbackDenylist: [/^\/api\//, /^\/downloads\//],
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
        ],
      },
    })] : []),
  ],
})
