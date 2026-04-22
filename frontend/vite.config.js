import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // Use environment variables with process.env in config files
        target: process.env.VITE_API_URL + (process.env.VITE_API_PORT || ''),
        changeOrigin: true
      }
    }
  },
  build: {
    // Split chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'http-vendor': ['axios'],
        }
      }
    },
    // Target modern browsers for smaller bundle
    target: 'es2020',
    // Enable source maps for debugging
    sourcemap: false,
  },
  // Optimize deps
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios']
  }
})