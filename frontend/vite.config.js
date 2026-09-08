import { URL, fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      // Lets modules import as `@/api/client` instead of '../../../api/client'.
      // Keep this in sync with the `paths` entry in jsconfig.json, which is what
      // gives the editor the same resolution.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    // Fail rather than silently moving to 5174: the backend's CORS list and the
    // OAuth-style redirect URLs are pinned to a port, and a silent move turns
    // that into a confusing CORS error instead of a clear "port in use".
    strictPort: true,
    proxy: {
      // Dev-only proxy. It means the frontend can call '/api/...' as a
      // same-origin request, which sidesteps CORS locally and keeps the API
      // base URL identical in development and production.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    // Source maps make a production stack trace readable. They are served only
    // to whoever opens devtools and are worth the build cost.
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split the rarely-changing vendor code out of the app bundle so a
        // deploy does not invalidate React and the router in everyone's cache.
        //
        // Vite 8 bundles with Rolldown, which accepts only the function form of
        // manualChunks — the object form silently type-errors at build time.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (/[\\/]node_modules[\\/](react|react-dom|react-router)/.test(id)) {
            return 'react'
          }
          if (/[\\/]node_modules[\\/](@tanstack|axios)/.test(id)) {
            return 'query'
          }
          return 'vendor'
        },
      },
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: true,
  },
})
