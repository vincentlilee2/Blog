---
title: "快速上手：发布你的第一篇文章"
description: "从新建文件到上线的完整流程示例。"
date: 2026-08-26
tags: ["教程", "博客"]
cover: ""
published: true
audience: public
---

本文演示如何用记忆花园 Blog 发布文章。

## 第一步：新建文章

在 `src/content/blog/` 下创建一个 `.md` 文件，文件名即 URL 的 slug：

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

## 第二步：本地预览

```bash
npm install
npm run dev
```

打开 `http://localhost:3003/` 即可看到。

## 第三步：构建与部署

```bash
npm run build       # 产物输出到 dist/
```

将 `dist/` 部署到任意静态托管平台即可。

> 提示：文章中的图片请放到 `public/media/` 目录，并在文中用 `/media/xxx.png` 引用。
