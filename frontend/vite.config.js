import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/static/dist/' : '/',
  plugins: [react()],
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: './src/main.jsx',
    },
  },
  server: {
    proxy: Object.fromEntries([
      '^/chat/(?:load_history|connect_users|edit_group|upload|create_group|archive_group|search|uploads)(?:/|$)',
      '^/admin/.+',
      '^/(?:login|logout|signup)(?:/|$)',
      '/static', '/api', '/socket.io',
    ].map(path => [path, {
      target: process.env.BACKEND_URL || 'http://127.0.0.1:5000',
      changeOrigin: true,
      ws: path === '/socket.io',
      configure(proxy) {
        // Socket.IO validates Origin against its backend host. Requests have
        // already passed through this local development server's proxy.
        const rewriteOrigin = req => req.setHeader('Origin', process.env.BACKEND_URL || 'http://127.0.0.1:5000');
        proxy.on('proxyReq', rewriteOrigin);
        proxy.on('proxyReqWs', rewriteOrigin);
      },
    }])),
  },
}))
