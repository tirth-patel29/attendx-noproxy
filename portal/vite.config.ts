import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://api.atmyhome.tech',
        changeOrigin: true,
        secure: false,
      },
      // Proxy Socket.IO so the ClassroomProjector "dumb terminal" can connect in dev.
      '/socket.io': {
        target: 'https://api.atmyhome.tech',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});