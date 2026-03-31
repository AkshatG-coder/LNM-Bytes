import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Customer Frontend — runs on port 5173
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,   // fail loudly if port is taken instead of silently shifting
  },
})
