import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Open Food Facts' text search (search-a-licious) sends no CORS headers, so the browser reaches it through
// this server under /off-search (see src/external.js).
const proxy = {
  '/off-search': {
    target: 'https://search.openfoodfacts.org',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/off-search/, ''),
    headers: { 'User-Agent': 'food-tracker-pwa/0.1' },
  },
  // The backup server (backup/server.mjs), run beside the dev server: `PORT=8787 DATA_DIR=… node backup/server.mjs`.
  '/backup': { target: 'http://localhost:8787' },
}

export default defineConfig({
  plugins: [react()],
  // Listen on all interfaces so the app is reachable from outside the container.
  server: { host: true, port: 5173, strictPort: true, allowedHosts: true, proxy },
  preview: { host: true, port: 4173, strictPort: true, allowedHosts: true, proxy },
})
