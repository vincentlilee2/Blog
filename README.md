# 记忆花园 · MemoryGarden Blog

现代精美的个人博客系统，基于 [Astro](https://astro.build) 构建，内容为本地 Markdown 文件，构建为纯静态站点。

> 这是 [MyCenter](https://github.com/vincentlilee2) 生态的子项目，对外品牌名为 **记忆花园 (MemoryGarden)**。

## ✨ 特性

- ⚡ **Astro 5** 静态生成，零运行时、极快加载
- 📝 **Markdown 即内容**：每篇文章是一个 `.md` 文件，Git 版本化
- 🏷️ 标签系统、按月归档、RSS 订阅
- 🌗 明/暗主题切换
- 📱 响应式，移动端友好
- 🖼️ 封面图、媒体上传（内置本地发布后台，可选）
- 🖥️ 自带本地发布后台（文章/媒体/站点/部署配置，无鉴权仅本机）
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

打开 http://localhost:3003/vincent/ 即可预览（多用户子站模式：本地 dev 由 start.sh 注入 `PUBLIC_BASE=/vincent`；如需裸根路径预览，`PUBLIC_BASE=/ npm run dev` 启动）。

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

### 多用户子站模式（多人共用一台服务器）

支持多人在**同一台服务器**上各自发布博客，无需注册登录（SSH key 即身份），每人一个子路径：

```
https://your-domain.com/vincent/   ← 用户 A
https://your-domain.com/wesley/    ← 用户 B
```

- 每人 clone 本仓库，构建时注入自己的子路径：`PUBLIC_BASE="/wesley" npm run build`（`astro.config.mjs` 已支持 `PUBLIC_BASE` 环境变量，不设则部署在根路径）
- 每人把构建产物上传到服务器专属子目录（如 `/var/www/example.com/wesley/`）；`scripts/deploy.ps1` 是 Windows 一键部署脚本（tar+ssh 管道，无需 rsync）
- 本地发布后台同样支持：`admin/server-config.json` 写 `{"publicBase": "/wesley"}`，上传的媒体 URL 自动带前缀（`/wesley/media/...`）
- 站点根目录放一个导航页（列出各子站入口），nginx 的 `try_files` 无需改动即支持子目录
- 服务器安全：每个用户的 SSH key 建议用 `authorized_keys` 限制只能写入自己的目录

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

通过本仓库自带的本地发布后台「站点设置」配置，存于 `Blog/site-config.json`（已被 `.gitignore` 忽略，不含在开源仓；首次运行使用默认值）。

## 🪪 电子名片页（展会 / 社交分享）

名片页是一个独立的 H5 页面（`src/pages/card/index.astro`），适合在展会、线下活动扫码分享——手机打开即看到你的介绍、作品、社交链接和微信二维码。

- 线上地址：`https://your-domain.com/<base>/card/`（如 `blog.mgarden.org.cn/vincent/card/`）
- **微信分享卡片**：页面带完整的 `og:` 标签 + 一张方形 `card-og-square.jpg`，在微信里发链接会显示带图卡片
- **6 套主题配色**：记忆花园（墨绿金）/ 深海商务蓝 / 黑金奢华 / 极简白 / 典雅酒红 / 科技紫，后台一键切换
- **左右双二维码**：个人微信 + 微信公众号，后台分别上传，名片页左右并排展示（个人微信码留空时回退到默认 `wechat-qr.png`）
- **导出图片**：后台「名片」页点「导出图片」，用本机 Chrome 把名片页渲染成 PNG（@2x 高清），可直接发微信/打印
- 名片页内容（姓名/头衔/简介/微信号/作品/社交链接/主题/二维码）统一在后台「**名片**」tab 编辑，存 `site-config.json`，保存即同步上线

> 名片页引用的图片（默认 Logo、og 图、长图）随仓库提供在 `public/media/images/`；你自己的头像、微信二维码等私人图片通过后台上传，存于本地 `site-config.json` + `public/media/`，**不进开源仓**。

生成 og 图的脚本：`scripts/make-card-og.py`（需 Pillow）。

## 🖥️ 本地发布后台（可选，无鉴权）

本仓库自带一个**本地发布后台**，提供网页界面写文章、传图片、配站点信息——无需命令行、无需登录。

> ⚠️ **仅限本机使用，无任何登录鉴权，切勿暴露到公网（不要用 `0.0.0.0` 监听）。**

### 启动

```bash
npm install
npm run admin          # 启动发布后台 (默认 http://localhost:18792/admin)
```

打开 http://localhost:18792/admin 即可：

- **文章**：新建 / 编辑 / 删除。新建时 **slug（文件名）留空会自动生成** `post-<时间戳>.md`，无需手填英文文件名
- **媒体**：上传图片/视频/音频，自动存入 `public/media/`，可一键复制 URL 或插入正文、设为封面
- **设置**：站点信息（名称/简介/头像/GitHub/小红书/B站/个人博客）+ 部署配置（SSH 地址/远程目录/域名/端口）单页统一管理
- **名片**：电子名片页专属编辑器——姓名/头衔/简介/微信号、6 套主题配色、头像/Logo 上传、个人微信与微信公众号双二维码上传、作品列表增删；「预览」看线上效果、「导出图片」下载高清 PNG

**编辑器特性**
- 正文区支持「**编辑 / 预览**」双模式：预览按博客文章样式渲染 Markdown（标题/粗体/斜体/链接/代码块/列表/引用），图片以真实尺寸显示在文字流中，可随时检查图文布局
- 正文输入框下方实时显示文中图片缩略图；封面图输入框带 `?` 帮助提示（悬停/点击可见用法）
- 保存/发布/取消置顶，不会被遮挡；编辑态宽度与后台列表一致

### 媒体上传限制（重要）

为避免服务器端下载渲染过慢，后台对上传做了压缩与大小限制：

| 类型 | 限制 | 处理 |
| ---- | ---- | ---- |
| 图片 | 自动压缩：最长边缩放至 ≤2048px，转 **WebP** 渐进压缩至 **≤5MB** | 压缩后仍 >5MB → 仅本地预览显示，发布后不可见 |
| GIF | 跳过压缩（保留动画） | — |
| 视频 | **≤100MB** 才能上传 | 超限 → 仅本地预览显示，发布后不可见 |

- 压缩在**浏览器本地**完成（canvas），上传的是压缩后的文件；媒体库与博客文章中均为压缩图
- 视频上传后自动用 **ffmpeg** 提取首帧生成缩略图（媒体库中显示；需本机安装 ffmpeg，无则仅显示视频图标）
- 正文中若有「仅本地显示」的图片（`blob:` 地址），**保存会被拦截**并提示，避免发布后图片失效

保存文章后立即触发 `npm run build`，静态产物更新到 `dist/`；再按 [DEPLOY.md](./DEPLOY.md) 同步到你的服务器即可上线。

### 开发模式（热更新前端）

```bash
npm run admin:dev      # Vite 开发服务器，改 UI 即时刷新
npm run admin:build    # 构建后台前端到 admin/admin-dist/（已由 npm run admin 自动托管）
```

### 目录结构

```
Blog/admin/
├── server.js              # Express 服务（无鉴权，文章/媒体/站点配置 API + 托管 UI）
├── vite.admin.config.js   # 后台前端构建配置
├── admin.html             # 后台入口
├── src/
│   ├── main.jsx
│   ├── AdminApp.jsx       # 发布后台 React 组件
│   └── admin.css
└── admin-dist/            # 构建产物（git 忽略）
```

## 📜 开源协议

MIT —— 自由使用、修改、分发。

---

Made with ❤️ by Vincent · MemoryGarden
