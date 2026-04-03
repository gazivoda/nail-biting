import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // Electron (file://) needs relative base './'; web server needs absolute '/'.
  // Set VITE_BUILD_TARGET=web when building for Docker/Coolify.
  base: process.env.VITE_BUILD_TARGET === 'web' ? '/' : './',

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
  plugins: [
    react(),
  ],
})
