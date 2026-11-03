import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = {
  // Our copy of Open Food Facts (off/server.mjs): production's, or $OFF_COPY (e.g. http://localhost:8788 for one run
  // beside the dev server: `PORT=8788 DATA_DIR=… node off/server.mjs`, which first downloads the whole export).
  '^/off/': { target: process.env.OFF_COPY ?? 'https://track-shit.notbru.xyz', changeOrigin: true },
  // The backup server (backup/server.mjs), run beside the dev server: `PORT=8787 DATA_DIR=… node backup/server.mjs`.
  '/backup': { target: 'http://localhost:8787' },
}

export default defineConfig({
  plugins: [react()],
  // When this version was built (shown as its date, Config → "App version").
  define: { __BUILT_AT__: JSON.stringify(new Date().toISOString()) },
  // Listen on all interfaces so the app is reachable from outside the container.
  server: { host: true, port: 5173, strictPort: true, allowedHosts: true, proxy },
  preview: { host: true, port: 4173, strictPort: true, allowedHosts: true, proxy },
})
