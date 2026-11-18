import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Split big libraries out of the main bundle so the first load is lighter
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            hls: ['hls.js'],
            motion: ['motion'],
            icons: ['lucide-react'],
          },
        },
      },
    },
    server: {
      // The API server (server/index.ts) runs on :3001 in development
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: false },
      },
      // HMR can be toggled via the DISABLE_HMR environment variable.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
