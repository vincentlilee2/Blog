/**
 * Blog 本地发布后台（无鉴权版）
 *
 * 用途：本地写作发布，监听 localhost，提供文章/媒体/站点配置的 HTTP API + 网页 UI。
 * 安全：本服务不实现任何登录注册，仅限本机使用，切勿暴露到公网（0.0.0.0）。
 *
 * 与 MyCenter 主仓的关系：Blog 发布逻辑的唯一真源在此。MyCenter 主仓若需发布 Blog，
 * 应改为转发/或不再重复实现（见 MyCenter 重构计划）。
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, '..'); // Blog 仓根
const BLOG_CONTENT_DIR = path.join(BLOG_DIR, 'src', 'content', 'blog');
const ADMIN_DIST = path.join(__dirname, 'admin-dist');
const MEDIA_DIR = path.join(BLOG_DIR, 'public', 'media');
const SITE_CONFIG = path.join(BLOG_DIR, 'site-config.json');

// ─── Blog 自动构建（保存/删除后触发，异步非阻塞 + 并发锁）───
let buildRunning = false;
let buildPending = false;
function triggerBlogBuild() {
  if (buildRunning) { buildPending = true; return; }
  buildRunning = true;
  console.log('[blog] 自动构建触发中…');
  const child = spawn('npm', ['run', 'build'], {
    cwd: BLOG_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  child.on('close', (code) => {
    buildRunning = false;
    if (code === 0) console.log('[blog] 构建完成 ✅');
    else console.error('[blog] 构建失败 ❌\n' + log.slice(-500));
    if (buildPending) { buildPending = false; triggerBlogBuild(); }
  });
}

// ─── 简易 frontmatter 解析（与 MyCenter 主仓同逻辑）───
function parseFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return { title: '', description: '', date: '', tags: [], published: true };
  const fm = {};
  m[1].split('\n').forEach((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
    } else if (val === 'true') val = true;
    else if (val === 'false') val = false;
    fm[key] = val;
  });
  return fm;
}

const app = express();
app.use(express.json({ limit: '100mb' }));

const PORT = process.env.BLOG_ADMIN_PORT || 18792;

// ─── 文章列表 ───
app.get('/api/blog/posts', (req, res) => {
  try {
    if (!fs.existsSync(BLOG_CONTENT_DIR)) return res.json({ ok: true, posts: [] });
    const files = fs.readdirSync(BLOG_CONTENT_DIR).filter((f) => f.endsWith('.md'));
    const posts = files.map((f) => {
      const raw = fs.readFileSync(path.join(BLOG_CONTENT_DIR, f), 'utf-8');
      return { slug: f.replace(/\.md$/, ''), ...parseFrontmatter(raw) };
    });
    posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    res.json({ ok: true, posts });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── 新建/更新文章（slug 留空自动生成 post-<时间戳>）───
app.post('/api/blog/posts', (req, res) => {
  try {
    const { slug, title, description, date, tags, cover, published, audience, content } = req.body;
    const finalSlug = (slug && String(slug).trim())
      ? String(slug).trim()
      : `post-${Math.floor(Date.now() / 1000)}`;
    if (!/^[a-z0-9一-龥\-]+$/i.test(finalSlug)) {
      return res.status(400).json({ ok: false, error: 'slug 只能含字母/数字/中文/连字符' });
    }
    if (!title || !content) {
      return res.status(400).json({ ok: false, error: '标题和正文不能为空' });
    }
    const file = path.join(BLOG_CONTENT_DIR, `${finalSlug}.md`);
    const fmTags = Array.isArray(tags) ? tags : String(tags || '').split(',').map((t) => t.trim()).filter(Boolean);
    const frontmatter = [
      '---',
      `title: "${String(title).replace(/"/g, '\\"')}"`,
      `description: "${String(description || '').replace(/"/g, '\\"')}"`,
      `date: ${date || new Date().toISOString().slice(0, 10)}`,
      `tags: [${fmTags.map((t) => `"${t}"`).join(', ')}]`,
      `cover: "${cover || ''}"`,
      `published: ${published === false || published === 'false' ? false : true}`,
      `audience: ${audience || 'public'}`,
      '---',
      '',
    ].join('\n');
    fs.writeFileSync(file, frontmatter + content + '\n', 'utf-8');
    triggerBlogBuild();
    res.json({ ok: true, slug: finalSlug, file: path.relative(BLOG_DIR, file) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── 删除文章 ───
app.delete('/api/blog/posts/:slug', (req, res) => {
  try {
    const file = path.join(BLOG_CONTENT_DIR, `${req.params.slug}.md`);
    if (!fs.existsSync(file)) return res.status(404).json({ ok: false, error: '文章不存在' });
    fs.unlinkSync(file);
    triggerBlogBuild();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── 获取单篇文章（含正文）───
app.get('/api/blog/posts/:slug', (req, res) => {
  try {
    const slug = req.params.slug;
    if (!/^[a-z0-9一-龥\-]+$/i.test(slug)) return res.status(400).json({ ok: false, error: 'slug 不合法' });
    const file = path.join(BLOG_CONTENT_DIR, `${slug}.md`);
    if (!fs.existsSync(file)) return res.status(404).json({ ok: false, error: '文章不存在' });
    const raw = fs.readFileSync(file, 'utf-8');
    const m = raw.match(/^---\s*\n[\s\S]*?\n---\s*\n?/);
    const content = m ? raw.slice(m[0].length) : raw;
    res.json({ ok: true, post: { slug, ...parseFrontmatter(raw), content: content.trimStart() } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── 媒体上传 ───
const MIME_SUBDIR = {
  'image/jpeg': 'images', 'image/png': 'images', 'image/gif': 'images',
  'image/webp': 'images', 'image/svg+xml': 'images',
  'video/mp4': 'videos', 'video/webm': 'videos', 'video/quicktime': 'videos',
  'audio/mpeg': 'audio', 'audio/wav': 'audio', 'audio/x-wav': 'audio',
  'audio/mp4': 'audio', 'audio/ogg': 'audio', 'audio/flac': 'audio',
};
const MEDIA_EXT = /\.(jpe?g|png|gif|webp|svg|mp4|webm|mov|m4v|mp3|wav|m4a|ogg|flac)$/i;

// ─── 视频缩略图：ffmpeg 提取首帧 → media/videos/thumbs/<name>.jpg ───
function makeVideoThumb(videoFile) {
  try {
    const dir = path.dirname(videoFile); // .../media/videos
    const base = path.basename(videoFile).replace(/\.[^.]+$/, '');
    const thumbDir = path.join(dir, 'thumbs');
    const thumbFile = path.join(thumbDir, `${base}.jpg`);
    if (!fs.existsSync(thumbFile)) {
      fs.mkdirSync(thumbDir, { recursive: true });
      spawnSync('ffmpeg', ['-y', '-i', videoFile, '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '4', thumbFile], { timeout: 20000 });
    }
    return fs.existsSync(thumbFile) ? `/media/videos/thumbs/${base}.jpg` : null;
  } catch {
    return null;
  }
}

app.post('/api/media/upload', (req, res) => {
  try {
    const { name, mime, data } = req.body || {};
    if (!name || !data) return res.status(400).json({ ok: false, error: '缺少文件名或文件内容' });
    const sub = MIME_SUBDIR[mime];
    if (!sub) return res.status(400).json({ ok: false, error: `不支持的文件类型：${mime || '未知'}` });
    if (!MEDIA_EXT.test(name)) return res.status(400).json({ ok: false, error: '扩展名不在允许列表' });
    const clean = path.basename(name).replace(/[^\w.\-一-龥]+/g, '_');
    const dir = path.join(MEDIA_DIR, sub);
    fs.mkdirSync(dir, { recursive: true });
    const final = fs.existsSync(path.join(dir, clean)) ? `${Date.now()}-${clean}` : clean;
    fs.writeFileSync(path.join(dir, final), Buffer.from(data, 'base64'));
    const thumb = sub === 'videos' ? makeVideoThumb(path.join(dir, final)) : null;
    res.json({ ok: true, url: `/media/${sub}/${final}`, name: final, type: sub, thumb });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/media/list', (req, res) => {
  try {
    const subs = ['images', 'videos', 'audio'];
    const out = [];
    for (const sub of subs) {
      const dir = path.join(MEDIA_DIR, sub);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        const file = path.join(dir, f);
        if (!fs.statSync(file).isFile()) continue;
        const st = fs.statSync(file);
        out.push({ name: f, url: `/media/${sub}/${f}`, type: sub, size: st.size, mtime: st.mtimeMs, thumb: sub === 'videos' ? makeVideoThumb(file) : null });
      }
    }
    out.sort((a, b) => b.mtime - a.mtime);
    res.json({ ok: true, files: out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/api/media/:type/:name', (req, res) => {
  try {
    const { type, name } = req.params;
    if (!['images', 'videos', 'audio'].includes(type)) return res.status(400).json({ ok: false, error: '类型不合法' });
    const clean = path.basename(name);
    const file = path.join(MEDIA_DIR, type, clean);
    if (!file.startsWith(MEDIA_DIR)) return res.status(400).json({ ok: false, error: '非法路径' });
    if (!fs.existsSync(file)) return res.status(404).json({ ok: false, error: '文件不存在' });
    fs.unlinkSync(file);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── 站点配置 ───
app.get('/api/site-config', (req, res) => {
  try {
    if (!fs.existsSync(SITE_CONFIG)) return res.json({ ok: true, config: {} });
    res.json({ ok: true, config: JSON.parse(fs.readFileSync(SITE_CONFIG, 'utf-8')) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.put('/api/site-config', (req, res) => {
  try {
    const author = req.body?.author;
    if (!author || typeof author !== 'object') return res.status(400).json({ ok: false, error: '缺少 author 配置' });
    const clean = {
      name: String(author.name || '').slice(0, 50),
      role: String(author.role || '').slice(0, 100),
      bio: String(author.bio || '').slice(0, 500),
      avatar: String(author.avatar || '').slice(0, 500),
      github: String(author.github || '').slice(0, 200),
      xiaohongshu: String(author.xiaohongshu || '').slice(0, 200),
      bilibili: String(author.bilibili || '').slice(0, 200),
    };
    fs.writeFileSync(SITE_CONFIG, JSON.stringify({ author: clean }, null, 2), 'utf-8');
    res.json({ ok: true, config: { author: clean } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── 服务器部署配置（本地管理，免登录，供打包部署用）───
const DEPLOY_CONFIG_FILE = path.join(BLOG_DIR, 'deploy-config.json');

app.get('/api/deploy-config', (req, res) => {
  try {
    if (!fs.existsSync(DEPLOY_CONFIG_FILE)) return res.json({ ok: true, config: {} });
    res.json({ ok: true, config: JSON.parse(fs.readFileSync(DEPLOY_CONFIG_FILE, 'utf-8')) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.put('/api/deploy-config', (req, res) => {
  try {
    const c = req.body?.config;
    if (!c || typeof c !== 'object') return res.status(400).json({ ok: false, error: '缺少 config' });
    const clean = {
      server: String(c.server || '').slice(0, 200),
      remote_dir: String(c.remote_dir || '').slice(0, 300),
      domain: String(c.domain || '').slice(0, 200),
      ssh_port: String(c.ssh_port || '22').slice(0, 10),
    };
    fs.writeFileSync(DEPLOY_CONFIG_FILE, JSON.stringify(clean, null, 2), 'utf-8');
    res.json({ ok: true, config: clean });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── 静态托管媒体文件（/media/* → Blog/public/media/）───
// 使后台媒体库的缩略图能正确加载（后台运行在独立端口，不依赖前台 3003）
app.use('/media', express.static(MEDIA_DIR));

// ─── 托管后台 UI（构建产物在 admin/admin-dist）───
if (fs.existsSync(ADMIN_DIST)) {
  const adminHtml = path.join(ADMIN_DIST, 'admin.html');
  const assetsDir = path.join(ADMIN_DIST, 'assets');
  const serveAdmin = (req, res) => res.sendFile(adminHtml);
  app.get('/admin/assets/*', (req, res) => res.sendFile(path.join(assetsDir, path.basename(req.path))));
  app.get('/admin', serveAdmin);
  app.get('/admin/', serveAdmin);
  app.get('/admin/*', serveAdmin);
}

app.listen(PORT, () => {
  console.log(`\n============================================`);
  console.log(`📝 Blog 本地发布后台（无鉴权，仅本机）`);
  console.log(`============================================`);
  console.log(`后台地址:  http://localhost:${PORT}/admin`);
  console.log(`文章目录:  ${BLOG_CONTENT_DIR}`);
  console.log(`⚠️  仅限 localhost，请勿暴露到公网`);
  console.log(`============================================\n`);
});
