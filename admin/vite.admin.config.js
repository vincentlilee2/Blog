import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Blog 发布后台构建配置（产出到 Blog/admin/admin-dist，由 admin/server.js 托管在 /admin/ 下）
// 注意：
//  1. root 设为配置文件目录，保证从仓库根执行 npm run admin:build 也能正确解析入口与输出
//  2. input/outDir 相对 root（即 admin/ 目录）解析，产物平铺在 admin-dist/ 下
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  base: '/admin/',
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, 'admin-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, 'admin.html'),
    },
  },
});
