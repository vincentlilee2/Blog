import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Blog 发布后台构建配置（产出到 Blog/admin/admin-dist，由 admin/server.js 托管在 /admin/ 下）
export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  build: {
    outDir: 'admin-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'admin.html',
    },
  },
});
