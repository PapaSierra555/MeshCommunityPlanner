import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Build ID changes every build — used to reset "don't show again" tour flags
    __BUILD_ID__: JSON.stringify(Date.now().toString()),
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': 'http://127.0.0.1:8321',
      '/ws': {
        target: 'ws://127.0.0.1:8321',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
