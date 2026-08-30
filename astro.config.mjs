// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// site 域名来自部署配置（make-deploy-package.sh 注入 PUBLIC_SITE_URL），本地默认 localhost
// base 子路径：多用户子站模式（如 https://your-domain.com/vincent），PUBLIC_BASE=/vincent 注入；默认根路径
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'http://localhost:3003',
  base: process.env.PUBLIC_BASE || '/',
  devToolbar: { enabled: false },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
