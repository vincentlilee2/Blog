# 部署与自动同步说明

本仓库是**纯静态站点**（Astro 构建产物无后端）。部署 = 把 `dist/` 放到 Web 服务器目录；发布新文章 = 重新构建并同步。

下文以 **nginx + 自有服务器** 为例，其他平台（GitHub Pages / Vercel / Cloudflare Pages）同理——只需把 `dist/` 作为发布目录。

---

## 一、首次部署（手动，一次）

### 1. 本地构建

```bash
# 设置站点域名（用于 RSS / 站点地图正确生成）
PUBLIC_SITE_URL="https://your-domain.example.com" npm run build
```

产物在 `dist/`。

### 2. 上传到服务器

```bash
rsync -avz --delete dist/ user@your-server:/var/www/blog/
```

> 首次需配置服务器 SSH 访问（见第三节）。

### 3. 配置 nginx

```nginx
server {
    listen 80;
    server_name your-domain.example.com;

    root /var/www/blog;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

启用并校验：

```bash
ln -sf /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 4.（推荐）HTTPS

```bash
certbot --nginx -d your-domain.example.com
```

证书自动续期。

### 5. 验证

```bash
curl -sI https://your-domain.example.com/ | head -1   # HTTP 200
curl -sI https://your-domain.example.com/rss.xml | head -1
```

---

## 二、自动同步（保存即发布）

适合"本地写文章保存后自动上线"的工作流。脚本监听本地 `src/` 改动，自动 build + rsync。

> 此脚本位于 MyCenter 主仓库（`~/MyCenter/watch-blog.sh`），不属于本 Blog 子仓，但逻辑可复制到任意部署环境。

### 前置

1. **服务器 SSH 免密**：
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_blog
   # 把 ~/.ssh/id_ed25519_blog.pub 内容追加到服务器的 ~/.ssh/authorized_keys
   ```
2. **监听工具 fswatch**（macOS）：
   ```bash
   brew install fswatch
   ```

### 守护脚本（`watch-blog.sh` 核心逻辑）

```bash
#!/usr/bin/env bash
set -uo pipefail
BLOG_DIR="$HOME/path/to/Blog"
SERVER="user@your-server"
REMOTE_DIR="/var/www/blog"
SSH_KEY="$HOME/.ssh/id_ed25519_blog"

sync_once() {
  (cd "$BLOG_DIR" && PUBLIC_SITE_URL="https://your-domain.example.com" npm run build) >/dev/null 2>&1
  rsync -az --delete -e "ssh -i $SSH_KEY" "$BLOG_DIR/dist/" "$SERVER:$REMOTE_DIR/"
}

sync_once   # 首次先全量同步一次
while true; do
  fswatch -1 "$BLOG_DIR/src" >/dev/null 2>&1
  sleep 1.5   # 防抖：等编辑器写完
  sync_once
done
```

启动：`bash watch-blog.sh`（后台常驻即可）。之后在 `src/content/blog/` 增删改文章，保存约 3 秒后线上自动更新，无需任何手动操作。

> 注意：macOS 上 `fswatch` 的扩展名过滤（`-e/-i`）不可靠，故监听整个 `src` 目录；文章少，全量 build 开销可忽略。

---

## 三、服务器 SSH 配置要点

- 确认服务器 `sshd` 监听 `22`（或自定义端口，rsync 用 `-e "ssh -p <端口>"`）
- 防火墙放行 22 / 80 / 443
- 推荐用独立部署用户 + 限定 `/var/www/blog` 目录权限

---

## 四、常见问题

| 现象 | 原因 / 解决 |
|---|---|
| RSS 里链接是 `localhost` | 构建时未注入域名。用 `PUBLIC_SITE_URL=https://你的域名 npm run build` |
| certbot 申请 HTTPS 失败 | 域名 A 记录未指向服务器 IP，先去 DNS 控制台添加 |
| 改了文章线上没更新 | 检查 watch-blog 进程是否在跑；或手动 `rsync` 一次 |
| 部署后样式不对 | 清浏览器缓存；确认 `dist/` 完整上传（用 `--delete` 保证一致） |

---

## 五、与 MyCenter 后台的关系（可选）

本 Blog 可配合 [MyCenter](https://github.com/your-org) 主仓库的**统一后台**使用：在 `http://localhost:18890/admin` 可视化写文章、上传媒体、配置站点信息。后台将文章写成 `src/content/blog/*.md`，再由上述流程构建发布。

后台发布时**文章 slug（文件名）留空会自动生成** `post-<时间戳>.md`，无需手动指定英文文件名。
