// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// site 域名来自部署配置（make-deploy-package.sh 注入 PUBLIC_SITE_URL），本地默认 localhost
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'http://localhost:3003',
  devToolbar: { enabled: false },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
