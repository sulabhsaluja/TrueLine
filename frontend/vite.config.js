import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The React app is served by Vite, but the reconciliation API is a separate
// Express process (server.js) listening on port 3000. The app calls the
// relative URL `/api/reconcile`, so without this proxy that request hits the
// Vite dev/preview server — which has no /api route — and returns 404.
// Forwarding /api to the Express origin is what makes the fetch reach the API.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:3000'

const proxy = {
  '/api': {
    target: API_TARGET,
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    globals: true
  }
})
