import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Customer Frontend — runs on port 5173
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    strictPort: true,
  },

  build: {
    // Smaller, faster bundles in production
    minify: 'terser',
    sourcemap: false,
    // Split code into logical chunks — avoids one monolithic JS file
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — cached separately, changes rarely
          'vendor-react':  ['react', 'react-dom'],
          // Routing — separate chunk, loaded early
          'vendor-router': ['react-router-dom'],
          // State management — separate chunk
          'vendor-redux':  ['@reduxjs/toolkit', 'react-redux'],
          // HTTP client
          'vendor-axios':  ['axios'],
        },
      },
    },
    // Warn if any chunk exceeds 500 kB
    chunkSizeWarningLimit: 500,
  },

  // Pre-bundle heavy dependencies for faster dev-server cold start
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@reduxjs/toolkit', 'react-redux', 'axios'],
  },
})
