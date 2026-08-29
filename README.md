# 记忆花园 · MemoryGarden Blog

现代精美的个人博客系统，基于 [Astro](https://astro.build) 构建，内容为本地 Markdown 文件，构建为纯静态站点。

> 这是 [MyCenter](https://github.com/vincentlilee2) 生态的子项目，对外品牌名为 **记忆花园 (MemoryGarden)**。

## ✨ 特性

- ⚡ **Astro 5** 静态生成，零运行时、极快加载
- 📝 **Markdown 即内容**：每篇文章是一个 `.md` 文件，Git 版本化
- 🏷️ 标签系统、按月归档、RSS 订阅
- 🌗 明/暗主题切换
- 📱 响应式，移动端友好
- 🖼️ 封面图、媒体上传（配合 MyCenter 后台）
- 🔍 已做 SEO（RSS、语义化结构）

## 🚀 快速开始

### 环境要求

- Node.js 18+（推荐 20+）
- npm 12+

### 本地开发

```bash
git clone <your-repo-url> blog
cd blog
npm install
npm run dev          # 启动开发服务器
```

打开 http://localhost:3003 即可预览。

### 写文章

在 `src/content/blog/` 下新建一个 `.md` 文件，文件名即文章 URL 的 slug（建议用英文/数字/连字符）：

```markdown
---
title: 我的第一篇文章
description: 一句话摘要
date: 2026-08-28
tags: [随笔, 开始]
cover: ""            # 可选封面图
published: true     # false 则不发布
---

正文用 Markdown 写……
```

保存后 dev 服务器热更新即可看到。

> **本博客无需后台管理系统**——文章的发布就是「在 `src/content/blog/` 新建一个 `.md` 文件」。构建即发布，Git 即数据库：写文件 → `npm run build` → 上传 `dist/`，文章即上线。如需网页式写作后台，可自建（参考 [DEPLOY.md](./DEPLOY.md) 的自动同步脚本），或接入 MyCenter 生态的统一发布后台；但后台只是「写 `.md` 文件的网页封装」，并非博客运行所必需。

### 用 Obsidian 写作（可选）

如果你用 [Obsidian](https://obsidian.md) 管理笔记，可以把 Blog 的文章目录接入 Vault，直接在 Obsidian 里写作、双链、打标签，保存即写回原文件。

**方式一：把整个 Blog 仓作为独立 Vault 打开**
- Obsidian 菜单 `Open another vault` → 选择 Blog 仓库根目录即可。

**方式二：软链进现有 Vault（推荐，写作与项目笔记分离）**
- 在 Vault 内新建一个文件夹（如 `创作/blog`），用终端建软链指向文章目录：
  ```bash
  ln -s /path/to/Blog/src/content/blog "/path/to/YourVault/创作/blog"
  ```
- 重启或重载 Obsidian（`Cmd/Ctrl+R`），`创作/blog` 下即出现所有文章，可像普通笔记一样编辑。
- 软链只是「视图入口」，文章真实文件仍在 `Blog/src/content/blog/`，Blog 仓库的 Git 跟踪不受影响。

**注意事项**
- 写作时**避免 Obsidian 的 `[[wikilink]]` 互链语法**——Astro 不识别，请用标准 Markdown 链接。
- 编辑 frontmatter 建议用**源代码模式**，勿用 Properties 面板乱加字段（Blog 的 schema 为严格校验，多余字段会导致构建失败）。
- 图片等附件：Obsidian 默认存于 Vault 的附件目录，发布前需将图片放到 `Blog/public/media/` 并在文中引用正确路径。
- 自动发布：在 Obsidian 保存后，若已配置 fswatch + rsync 同步（见 [DEPLOY.md](./DEPLOY.md)），文章会按你的部署流程上线；软链对监听进程透明，无需额外配置。

### 构建静态站点

```bash
npm run build       # 产物输出到 dist/
npm run preview     # 本地预览构建产物
```

## 📦 部署

本项目是纯静态站点，可托管到任意支持静态文件的平台（nginx、GitHub Pages、Vercel、Cloudflare Pages 等）。

最简 nginx 部署示例：

```nginx
server {
    listen 80;
    server_name your-domain.example.com;
    root /var/www/blog;
    index index.html;
    location / { try_files $uri $uri/ =404; }
}
```

将 `dist/` 内容复制到 `/var/www/blog/` 后 `nginx -s reload` 即可。

详细的**打包 + 服务器部署 + 自动同步**流程见 [DEPLOY.md](./DEPLOY.md)。

## 📁 目录结构

```
Blog/
├── src/
│   ├── content/blog/      # 文章 (Markdown)
│   ├── content.config.ts  # 文章 schema
│   ├── layouts/           # 页面外壳
│   ├── components/        # 组件 (Hero / Sidebar / PostList)
│   ├── pages/             # 路由 (首页/文章/标签/归档/RSS)
│   └── styles/global.css  # 设计语言
├── astro.config.mjs       # Astro 配置 (site 域名可在构建时注入)
├── package.json
└── DEPLOY.md              # 部署与自动同步说明
```

## ⚙️ 配置

### 站点域名（RSS / 站点地图）

`astro.config.mjs` 的 `site` 字段支持构建时注入，便于不同环境使用不同域名：

```bash
PUBLIC_SITE_URL="https://your-domain.example.com" npm run build
```

不设置时回退为 `http://localhost:3003`。

### 站点设置（名称/简介/头像/GitHub）

通过 MyCenter 统一后台的「站点设置」配置，存于 `Blog/site-config.json`。开源仓库中不含该文件，首次运行使用默认值。

## 📜 开源协议

MIT —— 自由使用、修改、分发。

---

Made with ❤️ by Vincent · MemoryGarden
