# 示例文章（Example Posts）

本目录存放**开源仓自带的示例文章**，用于展示 Blog 的功能（frontmatter 写法、标签、封面图）。

> ⚠️ **重要**：本仓库的 `src/content/blog/` 目录被 `.gitignore` 忽略——你的**个人文章永远只存在本地**，不会进入开源仓。请把你自己的文章直接写到 `src/content/blog/`，按本目录的示例格式即可。

## 如何开始写自己的文章

1. 在 `src/content/blog/` 下新建 `.md` 文件（如 `my-first-post.md`）
2. frontmatter 参考本目录示例：

```markdown
---
title: "我的第一篇文章"
description: "一句话摘要"
date: 2026-08-31
tags: ["随笔", "开始"]
cover: ""            # 可选封面图（放 public/media/images/ 并填 /media/xxx.png）
published: true     # false 则不发布
---

正文用 Markdown 写……
```

3. `npm run dev` 本地预览，`npm run build` 构建
4. 构建产物在 `dist/`，按 [DEPLOY.md](../DEPLOY.md) 同步到你的服务器

## 文件名规则

- 文件名即 URL slug（建议英文/数字/连字符）
- 本地后台发布时留空 slug 会自动生成 `post-<时间戳>.md`
