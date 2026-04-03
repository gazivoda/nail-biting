import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // Use relative base so the built index.html works when loaded via file://
  // (Electron packaged app) as well as from a web server.
  base: './',

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
