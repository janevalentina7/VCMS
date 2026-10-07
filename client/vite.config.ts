import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Dev server proxies the REST API and uploaded evidence images to the Express
 * server, so the browser only ever talks to a single origin (which also keeps
 * httpOnly auth cookies + CSRF working without CORS configuration).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // The platform preview is served from a proxied host name.
    allowedHosts: true,
    proxy: {
      '/api': { target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:4000', changeOrigin: true },
      '/uploads': { target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:4000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
});
