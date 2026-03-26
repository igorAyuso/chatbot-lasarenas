/**
 * Configuración de Vite para el Dashboard
 *
 * - React con Fast Refresh para desarrollo
 * - Build estático para deploy en Render (Static Site)
 * - Proxy al backend local en desarrollo (puerto 3000)
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Proxy para desarrollo local — redirige /api al backend Express
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },

  // Build estático para Render
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
