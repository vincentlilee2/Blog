import React, { useState, useEffect, useCallback, useRef } from 'react';

const API = '/api';

// 无鉴权：本地发布后台，所有请求不带 token
const headers = { 'Content-Type': 'application/json' };

const MAX_IMG = 5 * 1024 * 1024;    // 图片压缩后上限 5MB
const MAX_VIDEO = 100 * 1024 * 1024; // 视频上限 100MB

// ─── 图片压缩：缩放最长边 ≤2048，转 webp 渐进降质至 ≤5MB ───
async function compressImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    const MAX_EDGE = 2048;
    let { width, height } = bmp;
    if (Math.max(width, height) > MAX_EDGE) {
      const k = MAX_EDGE / Math.max(width, height);
      width = Math.max(1, Math.round(width * k));
      height = Math.max(1, Math.round(height * k));
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bmp, 0, 0, width, height);
    if (bmp.close) bmp.close();
    let last = null;
    for (const q of [0.85, 0.7, 0.55, 0.4]) {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', q));
      if (!blob) break;
      last = blob;
      if (blob.size <= MAX_IMG) return blob;
    }
    return last || file;
  } catch {
    return file; // 解码失败（如超大图）→ 原样返回
  }
}

// ─── 轻量 Markdown 渲染（预览用，先转义防注入）───
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function inlineMd(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<img src="$2" alt="$1" loading="lazy" />');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
  return s;
}
function renderMarkdown(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  let html = '', inCode = false, codeBuf = [];
  const flushCode = () => {
    if (codeBuf.length) { html += `<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`; codeBuf = []; }
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('```')) {
      if (inCode) { inCode = false; flushCode(); } else inCode = true;
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }
    if (!line.trim()) { html += '<p></p>'; continue; }
    if (/^#{1,4}\s/.test(line)) {
      const lv = line.match(/^(#{1,4})\s/)[1].length;
      html += `<h${lv}>${inlineMd(line.replace(/^#{1,4}\s/, ''))}</h${lv}>`;
    } else if (/^(-{3,}|\*{3,})$/.test(line)) {
      html += '<hr>';
    } else if (/^>\s?/.test(line)) {
      html += `<blockquote>${inlineMd(line.replace(/^>\s?/, ''))}</blockquote>`;
    } else if (/^[-*]\s/.test(line)) {
      html += `<li>${inlineMd(line.replace(/^[-*]\s/, ''))}</li>`;
    } else if (/^\d+\.\s/.test(line)) {
      html += `<li>${inlineMd(line.replace(/^\d+\.\s/, ''))}</li>`;
    } else {
      html += `<p>${inlineMd(line)}</p>`;
    }
  }
  flushCode();
  html = html.replace(/(?:<li>.*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  return html;
}

function AdminView() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    slug: '', title: '', description: '', date: new Date().toISOString().slice(0, 10),
    tags: '', cover: '', published: true, audience: 'public', content: '',
  });
  const [busyUpload, setBusyUpload] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [dragover, setDragover] = useState(false);
  const [coverHelp, setCoverHelp] = useState(false);
  const [preview, setPreview] = useState(false);
  const [view, setView] = useState('posts');
  const contentRef = useRef(null);
  // 封面图自动填充控制：用户手动清空封面后不再自动填（尊重用户选择）
  const coverLockedRef = useRef(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/blog/posts`, { headers });
      const data = await r.json();
      if (data.ok) setPosts(data.posts);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const save = async (e) => {
    e.preventDefault();
    setMsg(null);
    const blobs = (form.content.match(/!\[[^\]]*\]\(blob:[^)]+\)/g) || []);
    if (blobs.length) {
      setMsg({ type: 'err', text: `正文中有 ${blobs.length} 张图片仅本地显示（未上传服务器），发布后不可见。请移除或更换后再保存。` });
      return;
    }
    try {
      const r = await fetch(`${API}/blog/posts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || '保存失败');
      setMsg({ type: 'ok', text: `已保存：${data.slug}.md` });
      setEditing(null);
      setForm({ slug: '', title: '', description: '', date: new Date().toISOString().slice(0, 10), tags: '', cover: '', published: true, audience: 'public', content: '' });
      loadPosts();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    }
  };

  const del = async (slug) => {
    const action = confirm(`「${slug}.md」 要如何处理？\n\n确定 → 删除（永久删除文件，不可恢复）\n取消 → 保留文章\n\n（归档请点「编辑」→ 关闭「发布」勾选后保存）`);
    if (!action) return;
    const r = await fetch(`${API}/blog/posts/${slug}`, { method: 'DELETE', headers });
    const data = await r.json();
    if (data.ok) { setMsg({ type: 'ok', text: `已删除 ${slug}.md` }); loadPosts(); }
    else alert(data.error);
  };

  // 归档：把文章设为未发布（published:false），文件保留、后台列表可见
  const archive = async (p) => {
    if (!confirm(`归档「${p.title || p.slug}」？\n归档后前台不再显示，但后台文章列表仍可见（状态：未发布）。`)) return;
    try {
      const r = await fetch(`${API}/blog/posts/${p.slug}`, { headers });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || '读取失败');
      const post = d.post;
      const save = await fetch(`${API}/blog/posts`, {
        method: 'POST', headers,
        body: JSON.stringify({
          slug: post.slug, title: post.title || '', description: post.description || '',
          date: (post.date || '').slice(0, 10), tags: Array.isArray(post.tags) ? post.tags : [],
          cover: post.cover || '', published: false, audience: post.audience || 'public', content: post.content || '',
        }),
      });
      const sd = await save.json();
      if (!save.ok || !sd.ok) throw new Error(sd.error || '归档失败');
      setMsg({ type: 'ok', text: `已归档：${post.slug}.md（未发布，前台不显示）` });
      loadPosts();
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  // 上传媒体文件 → 压缩后上传 → 自动插入正文光标处
  const uploadFile = async (file) => {
    if (!file) return;
    setBusyUpload(true); setUploadErr('');
    const insert = (url, tip) => {
      const et = contentRef.current;
      const t = et ? et.value : (form.content || '');
      const ins = `\n![](${url})\n`;
      setForm((f) => ({ ...f, content: t + ins }));
      if (tip) setMsg({ type: 'ok', text: tip });
    };
    try {
      const isVideo = file.type.startsWith('video/');
      // 视频超 100MB：仅本地显示
      if (isVideo && file.size > MAX_VIDEO) {
        insert(URL.createObjectURL(file), '⚠️ 视频超过 100MB，无法上传服务器，仅本地预览显示');
        setUploadErr('视频过大（>100MB），仅本地显示，发布后该视频不可见');
        return;
      }
      // 图片：压缩（gif 动图跳过，保留动画）
      let upName = file.name, upMime = file.type;
      if (!isVideo && file.type !== 'image/gif') {
        const compressed = await compressImage(file);
        if (compressed !== file && compressed.size < file.size) {
          upName = file.name.replace(/\.[^.]+$/, '') + '.webp';
          upMime = 'image/webp';
          file = compressed;
          // 压缩后仍超 5MB：仅本地显示
          if (compressed.size > MAX_IMG) {
            insert(URL.createObjectURL(compressed), '⚠️ 图片压缩后仍超过 5MB，仅本地预览显示，发布后不可见');
            setUploadErr('图片过大（压缩后仍 >5MB），仅本地显示，建议换用较小的图片');
            return;
          }
        }
      }
      const b64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = () => reject(new Error('读取文件失败'));
        r.readAsDataURL(file);
      });
      const r = await fetch(`${API}/media/upload`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: upName, mime: upMime, data: b64 }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || '上传失败');
      const url = data.url;
      insert(url, `已上传并插入：${url}`);
    } catch (e) {
      setUploadErr(e.message);
    } finally { setBusyUpload(false); }
  };

  const onPick = (e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadFile(f); };
  const onDrop = (e) => { e.preventDefault(); uploadFile(e.dataTransfer?.files?.[0]); };

  const edit = async (p) => {
    setEditing(p.slug);
    coverLockedRef.current = false; // 进入编辑：允许重新自动填充
    try {
      const r = await fetch(`${API}/blog/posts/${p.slug}`, { headers });
      const d = await r.json();
      if (d.ok) setForm({ slug: d.post.slug, title: d.post.title || '', description: d.post.description || '', date: (d.post.date || '').slice(0, 10), tags: Array.isArray(d.post.tags) ? d.post.tags.join(', ') : (d.post.tags || ''), cover: d.post.cover || '', published: d.post.published !== false, audience: d.post.audience || 'public', content: d.post.content || '' });
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const set = (k) => (e) => {
    const v = e.target.value;
    // 封面字段：用户手动编辑（含清空）后锁定，不再被自动填充覆盖
    if (k === 'cover') coverLockedRef.current = true;
    setForm((f) => {
      const next = { ...f, [k]: v };
      // 正文变更时：若封面为空且未锁定，自动取正文第一张图作为封面
      if (k === 'content' && !coverLockedRef.current && !next.cover) {
        const m = v.match(/!\[[^\]]*\]\(([^)\s]+)\)/);
        if (m) next.cover = m[1];
      }
      return next;
    });
  };

  // 解析正文中的 Markdown 图片 ![alt](url)，用于输入框下方直接预览
  const contentImages = (form.content.match(/!\[[^\]]*\]\([^)\s]+\)/g) || [])
    .map((m) => { const mm = m.match(/!\[([^\]]*)\]\(([^)\s]+)\)/); return mm ? { alt: mm[1], url: mm[2] } : null; })
    .filter(Boolean)
    .slice(0, 8);

  return (
    <div className={editing !== null ? 'admin-wrap admin-wrap--editor' : 'admin-wrap'}>
      <header className="admin-header">
        <h1 className="admin-title">📝 Blog 发布后台</h1>
        <nav className="admin-nav">
          <button className={view === 'posts' ? 'active' : ''} onClick={() => setView('posts')}>文章</button>
          <button className={view === 'media' ? 'active' : ''} onClick={() => setView('media')}>媒体</button>
          <button className={view === 'card' ? 'active' : ''} onClick={() => setView('card')}>名片</button>
          <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>设置</button>
          <a href={`http://localhost:3003${(window.__PUBLIC_BASE__ || '').replace(/\/?$/, '/')}`} className="nav-admin-home" title="返回博客首页">← 返回博客</a>
        </nav>
      </header>

      {msg && <div className={`msg msg-${msg.type}`}>{msg.text}</div>}

      {view === 'posts' && (
        <>
          {editing !== null && (
            <form className="card editor-card" onSubmit={save} style={{ marginBottom: '2rem' }}>
              <div className="editor-toolbar">
                <h3 style={{ margin: 0 }}>{editing ? `编辑：${editing}` : '✍️ 新建文章'}</h3>
                <label className="publish-toggle" title="保存前可随时切换">
                  <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> 发布
                </label>
                <div className="editor-toolbar-actions">
                  <button className="btn" type="button" onClick={() => { setEditing(null); setView('posts'); }}>取消</button>
                  <button className="btn btn-primary" type="submit">保存</button>
                </div>
              </div>

              <input className="editor-title" value={form.title} onChange={set('title')} placeholder="输入文章标题…" required />
              <input className="editor-desc" value={form.description} onChange={set('description')} placeholder="一句话摘要（可选）" />

              <div className="row editor-meta">
                {editing && (
                  <div>
                    <label>slug（不可改）</label>
                    <input value={form.slug} disabled />
                  </div>
                )}
                <div>
                  <label>日期</label>
                  <input type="date" value={form.date} onChange={set('date')} />
                </div>
                <div>
                  <label>标签（逗号分隔）</label>
                  <input value={form.tags} onChange={set('tags')} placeholder="技术, AI" />
                </div>
                <div>
                  <label>封面图</label>
                  <div className="cover-field">
                    <input value={form.cover} onChange={set('cover')} placeholder="留空" />
                    <button
                      type="button"
                      className={`cover-help${coverHelp ? ' open' : ''}`}
                      onClick={() => setCoverHelp((v) => !v)}
                      aria-label="封面图使用说明"
                    >?</button>
                    <div className={`cover-tip${coverHelp ? ' show' : ''}`} role="tooltip">
                      <b>封面图怎么用</b>
                      <ol>
                        <li><b>自动填充</b>：在正文里插入第一张图片时，会自动把它填入封面图链接（无需手动填）</li>
                        <li>想换封面：手动改这里的链接即可；<b>清空链接 → 该文章不显示封面图</b>（清空后不再被自动填充）</li>
                        <li>保存后，博客<b>首页/列表</b>的文章卡片顶部会显示这张封面图；文章<b>详情页</b>标题上方显示封面大图</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              <div className="content-label-row">
                <label style={{ margin: 0 }}>正文（Markdown）</label>
                <div className="editor-mode">
                  <button type="button" className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>编辑</button>
                  <button type="button" className={preview ? 'active' : ''} onClick={() => setPreview(true)}>预览</button>
                </div>
              </div>
              <div
                className={`dropzone${dragover ? ' dragover' : ''}`}
                onDrop={(e) => { setDragover(false); onDrop(e); }}
                onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                onDragLeave={() => setDragover(false)}
              >
                {preview ? (
                  <div className="preview-pane" dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) }} />
                ) : (
                  <textarea ref={contentRef} className="editor-content" value={form.content} onChange={set('content')} placeholder="# 从这里开始写作…" />
                )}
                <div className="dropzone-bar">
                  <input type="file" onChange={onPick} disabled={busyUpload} />
                  {busyUpload && <span> 上传中…</span>}
                  {uploadErr && <span className="msg msg-err"> {uploadErr}</span>}
                  <span className="dropzone-hint">拖拽图片到此处，或选择文件上传并插入正文</span>
                </div>
                {contentImages.length > 0 && (
                  <div className="content-images">
                    {contentImages.map((img, i) => (
                      <div className="content-images__item" key={i}>
                        <img src={img.url} alt={img.alt} />
                        <span title={img.url}>{img.url}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
          )}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ marginTop: 0 }}>文章列表</h3>
              {editing === null && <button className="btn btn-primary" onClick={() => { coverLockedRef.current = false; setEditing(''); setForm({ slug: '', title: '', description: '', date: new Date().toISOString().slice(0, 10), tags: '', cover: '', published: true, audience: 'public', content: '' }); }}>＋ 新建</button>}
            </div>
            {loading ? <p>加载中…</p> : (
              <ul className="post-list">
                {posts.map((p) => (
                  <li key={p.slug} className="post-item">
                    <div>
                      <h4>{p.title || p.slug} {p.published === false && <span className="badge badge--draft">草稿</span>}</h4>
                      <small>{p.date} · {Array.isArray(p.tags) ? p.tags.join(', ') : ''} · <code>{p.slug}.md</code></small>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" onClick={() => edit(p)}>编辑</button>
                      <button className="btn" onClick={() => archive(p)} disabled={p.published === false} title={p.published === false ? '已归档' : '归档（前台不显示，后台仍可见）'}>归档</button>
                      <button className="btn btn-danger" onClick={() => del(p.slug)}>删除</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {view === 'media' && <MediaView onUseCover={(url) => setForm({ ...form, cover: url })} />}
      {view === 'card' && <CardView />}
      {view === 'settings' && <SettingsView />}
    </div>
  );
}

function MediaView({ onUseCover }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/media/list`, { headers });
      const d = await r.json();
      if (d.ok) setFiles(d.files);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);
  const upload = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('读取失败')); r.readAsDataURL(f); });
      const r = await fetch(`${API}/media/upload`, { method: 'POST', headers, body: JSON.stringify({ name: f.name, mime: f.type, data: b64 }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      load();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const del = async (type, name) => {
    if (!confirm(`删除 ${name}？`)) return;
    const r = await fetch(`${API}/media/${type}/${encodeURIComponent(name)}`, { method: 'DELETE', headers });
    const d = await r.json();
    if (d.ok) load(); else alert(d.error);
  };
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>媒体库</h3>
      <input type="file" onChange={upload} disabled={busy} /> {busy && '上传中…'}
      <div className="media-grid">
        {files.map((f) => (
          <div key={f.url} className="media-item">
            {f.type === 'images' ? <img src={f.url} alt={f.name} /> : f.thumb ? <img src={f.thumb} alt={f.name} /> : <span>🎞 {f.name}</span>}
            <div style={{ fontSize: 12 }}>
              <span className="media-name"><code>{f.name}</code></span>
              <button className="btn" onClick={() => { navigator.clipboard?.writeText(f.url).then(() => { setCopied(f.url); setTimeout(() => setCopied(null), 1500); }); }}>{copied === f.url ? '✓ 已复制' : '复制URL'}</button>
              {onUseCover && <button className="btn" onClick={() => onUseCover(f.url)}>设封面</button>}
              <button className="btn btn-danger" onClick={() => del(f.type, f.name)}>删</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 名片主题色（与 card/index.astro 的 data-theme 一一对应）
const THEMES = [
  { id: 'garden', name: '记忆花园', bg: '#0d2318', accent: '#c9a961' },
  { id: 'ocean', name: '深海商务蓝', bg: '#0a1c30', accent: '#7ea8d8' },
  { id: 'night', name: '黑金奢华', bg: '#0d0d10', accent: '#d4af37' },
  { id: 'minimal', name: '极简白', bg: '#faf8f4', accent: '#1f2937' },
  { id: 'wine', name: '典雅酒红', bg: '#241018', accent: '#d98e73' },
  { id: 'violet', name: '科技紫', bg: '#161030', accent: '#a78bfa' },
];

function CardView() {
  const [author, setAuthor] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busyUp, setBusyUp] = useState(false);
  const [busyExp, setBusyExp] = useState(false);

  useEffect(() => {
    fetch(`${API}/site-config`, { headers }).then((r) => r.json()).then((d) => {
      if (d.ok && d.config?.author) setAuthor(d.config.author);
    }).catch(() => {});
  }, []);

  if (!author) return <div className="card"><h3 style={{ marginTop: 0 }}>电子名片</h3><p>加载中…</p></div>;

  const card = author.card || {};
  const projects = Array.isArray(card.projects) ? card.projects : [];
  const setCard = (k) => (e) => setAuthor({ ...author, card: { ...card, [k]: e.target.value } });
  const setProj = (i) => (k) => (e) => {
    const list = projects.map((p, idx) => (idx === i ? { ...p, [k]: e.target.value } : p));
    setAuthor({ ...author, card: { ...card, projects: list } });
  };
  const addProj = () => setAuthor({ ...author, card: { ...card, projects: [...projects, { name: '', desc: '', url: '' }] } });
  const delProj = (i) => setAuthor({ ...author, card: { ...card, projects: projects.filter((_, idx) => idx !== i) } });

  const uploadAvatar = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setBusyUp(true);
    try {
      const bmp = await createImageBitmap(f);
      // 头像 webp：最长边 ≤512 方形裁剪（页面显示用）
      const SZ = 512;
      const canvas = document.createElement('canvas');
      canvas.width = SZ; canvas.height = SZ;
      const ctx = canvas.getContext('2d');
      // 居中裁剪为正方形
      const side = Math.min(bmp.width, bmp.height);
      ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SZ, SZ);
      if (bmp.close) bmp.close();
      const webpBlob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.85));
      const jpgBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
      const toB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('读取失败')); r.readAsDataURL(blob); });
      const base = f.name.replace(/\.[^.]+$/, '');
      // 上传 webp 头像 + jpg og 图（微信卡片用，微信不支持 webp og:image）
      const r1 = await fetch(`${API}/media/upload`, { method: 'POST', headers, body: JSON.stringify({ name: `${base}-avatar.webp`, mime: 'image/webp', data: await toB64(webpBlob) }) });
      const d1 = await r1.json();
      if (!d1.ok) throw new Error(d1.error);
      const r2 = await fetch(`${API}/media/upload`, { method: 'POST', headers, body: JSON.stringify({ name: `${base}-og.jpg`, mime: 'image/jpeg', data: await toB64(jpgBlob) }) });
      const d2 = await r2.json();
      if (!d2.ok) throw new Error(d2.error);
      setAuthor({ ...author, avatar: d1.url, avatarOg: d2.url });
      setMsg({ type: 'ok', text: '头像已上传（含微信卡片图），保存名片后生效' });
    } catch (err) { setMsg({ type: 'err', text: err.message }); } finally { setBusyUp(false); }
  };

  // 通用二维码上传：写入 card[field]
  const uploadQr = (field) => async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('读取失败')); r.readAsDataURL(f); });
      const r = await fetch(`${API}/media/upload`, { method: 'POST', headers, body: JSON.stringify({ name: f.name, mime: f.type || 'image/png', data: b64 }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setAuthor({ ...author, card: { ...card, [field]: d.url } });
      setMsg({ type: 'ok', text: '二维码已上传，保存名片后生效' });
    } catch (err) { setMsg({ type: 'err', text: err.message }); }
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API}/site-config`, { method: 'PUT', headers, body: JSON.stringify({ author }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setMsg({ type: 'ok', text: '名片已保存，站点将自动重新构建并同步上线' });
      if (d.config?.author) setAuthor(d.config.author);
    } catch (err) { setMsg({ type: 'err', text: err.message }); }
  };

  const exportImage = async () => {
    setBusyExp(true);
    setMsg({ type: 'ok', text: '正在生成名片图片…' });
    try {
      const r = await fetch(`${API}/card/export`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `导出失败(${r.status})`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'memorygarden-card.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ type: 'ok', text: '名片图片已生成并开始下载' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusyExp(false);
    }
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>电子名片</h3>
      <p style={{ color: '#888', fontSize: 13, marginTop: 0 }}>对应名片页 your-domain.com/&lt;base&gt;/card/，保存后自动同步上线</p>
      {msg && <div className={`msg msg-${msg.type}`}>{msg.text}</div>}
      <form onSubmit={save}>
        <label>姓名</label>
        <input value={author.name || ''} onChange={(e) => setAuthor({ ...author, name: e.target.value })} />
        <label>身份 / 头衔</label>
        <input value={author.role || ''} onChange={(e) => setAuthor({ ...author, role: e.target.value })} />
        <label>副标题（一句话介绍）</label>
        <input value={card.sub || ''} onChange={setCard('sub')} />
        <label>微信号</label>
        <input value={card.wechatId || ''} onChange={setCard('wechatId')} />

        <label>风格颜色</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {THEMES.map((t) => {
            const active = (card.theme || 'garden') === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setAuthor({ ...author, card: { ...card, theme: t.id } })}
                title={`切换为「${t.name}」配色`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: '8px 12px', borderRadius: 10, fontSize: 13,
                  border: active ? '2px solid #333' : '1px solid #ccc',
                  background: '#fff', boxShadow: active ? '0 1px 6px rgba(0,0,0,.15)' : 'none',
                }}
              >
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: t.bg, border: '1px solid #bbb', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ width: 10, height: 18, borderRadius: 3, background: t.accent, display: 'inline-block', flexShrink: 0 }} />
                {t.name}
              </button>
            );
          })}
        </div>

        <label>头像 / Logo</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <img
            src={author.avatar || '/<base>/media/images/card-logo.png'}
            alt="头像预览"
            style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', background: '#eee', flexShrink: 0 }}
          />
          <div>
            <input type="file" accept="image/*" onChange={uploadAvatar} disabled={busyUp} /> {busyUp && '上传中…'}
            <div style={{ marginTop: 6 }}>
              <button type="button" className="btn" onClick={() => { setAuthor({ ...author, avatar: '', avatarOg: '' }); setMsg({ type: 'ok', text: '已恢复默认 Logo，保存后生效' }); }}>恢复默认 Logo</button>
            </div>
            <small style={{ color: '#999' }}>不上传则默认显示记忆花园 Logo</small>
          </div>
        </div>

        <h4 style={{ margin: '14px 0 6px' }}>二维码（名片页展示）</h4>
        <label>个人微信二维码</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          {card.wechatQr && <img src={card.wechatQr} alt="个人微信二维码" style={{ width: 56, height: 56, objectFit: 'contain', background: '#fff', borderRadius: 8, flexShrink: 0 }} />}
          <div>
            <input type="file" accept="image/*" onChange={uploadQr('wechatQr')} />
            {card.wechatQr && <div style={{ marginTop: 6 }}><button type="button" className="btn" onClick={() => setAuthor({ ...author, card: { ...card, wechatQr: '' } })}>移除</button></div>}
            <small style={{ color: '#999' }}>留空则用默认 wechat-qr.png</small>
          </div>
        </div>
        <label>微信公众号二维码</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          {card.officialQr && <img src={card.officialQr} alt="公众号二维码" style={{ width: 56, height: 56, objectFit: 'contain', background: '#fff', borderRadius: 8, flexShrink: 0 }} />}
          <div>
            <input type="file" accept="image/*" onChange={uploadQr('officialQr')} />
            {card.officialQr && <div style={{ marginTop: 6 }}><button type="button" className="btn" onClick={() => setAuthor({ ...author, card: { ...card, officialQr: '' } })}>移除</button></div>}
            <small style={{ color: '#999' }}>留空则不显示公众号二维码</small>
          </div>
        </div>

        <h4 style={{ margin: '14px 0 6px' }}>作品列表（名片页展示）</h4>
        {projects.map((p, i) => (
          <div key={i} style={{ border: '1px solid #eee', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
            <label>作品 {i + 1} 名称</label>
            <input value={p.name || ''} onChange={setProj(i)('name')} placeholder="名称（留空则不显示该作品）" />
            <label>描述</label>
            <input value={p.desc || ''} onChange={setProj(i)('desc')} />
            <label>链接</label>
            <input value={p.url || ''} onChange={setProj(i)('url')} />
            <button type="button" className="btn btn-danger" onClick={() => delProj(i)}>删除该作品</button>
          </div>
        ))}
        <button type="button" className="btn" onClick={addProj}>+ 添加作品</button>
        <div>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 14 }}>保存名片</button>
          <button type="button" className="btn" style={{ marginTop: 14, marginLeft: 10 }} onClick={() => window.open('https://your-domain.com/<base>/card/', '_blank')}>预览</button>
          <button type="button" className="btn" style={{ marginTop: 14, marginLeft: 10 }} disabled={busyExp} onClick={exportImage}>{busyExp ? '生成中…' : '导出图片'}</button>
        </div>
      </form>
    </div>
  );
}

function SettingsView() {
  const [author, setAuthor] = useState({ name: '', role: '', bio: '', avatar: '', github: '', xiaohongshu: '', bilibili: '' });
  const [deploy, setDeploy] = useState({ server: '', remote_dir: '', domain: '', ssh_port: '22' });
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    fetch(`${API}/site-config`, { headers }).then((r) => r.json()).then((d) => { if (d.ok && d.config?.author) setAuthor(d.config.author); }).catch(() => {});
    fetch(`${API}/deploy-config`, { headers }).then((r) => r.json()).then((d) => { if (d.ok && d.config) setDeploy(d.config); }).catch(() => {});
  }, []);
  const saveAuthor = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API}/site-config`, { method: 'PUT', headers, body: JSON.stringify({ author }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setMsg({ type: 'ok', text: '站点设置已保存' });
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };
  const saveDeploy = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API}/deploy-config`, { method: 'PUT', headers, body: JSON.stringify({ config: deploy }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setMsg({ type: 'ok', text: '部署配置已保存' });
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };
  const setA = (k) => (e) => setAuthor({ ...author, [k]: e.target.value });
  const setD = (k) => (e) => setDeploy({ ...deploy, [k]: e.target.value });
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>站点设置</h3>
      {msg && <div className={`msg msg-${msg.type}`}>{msg.text}</div>}
      <form onSubmit={saveAuthor}>
        <label>名称</label><input value={author.name} onChange={setA('name')} />
        <label>身份/角色</label><input value={author.role} onChange={setA('role')} />
        <label>简介</label><input value={author.bio} onChange={setA('bio')} />
        <label>头像 URL</label><input value={author.avatar} onChange={setA('avatar')} />
        <label>GitHub</label><input value={author.github} onChange={setA('github')} />
        <label>小红书</label><input value={author.xiaohongshu} onChange={setA('xiaohongshu')} />
        <label>B站</label><input value={author.bilibili} onChange={setA('bilibili')} />
        <label>个人博客</label><input value={author.blog} onChange={setA('blog')} />
        <button className="btn btn-primary" type="submit" style={{ marginTop: 12 }}>保存站点设置</button>
      </form>

      <h3 style={{ marginTop: '2rem' }}>部署配置（服务器 SSH 同步）</h3>
      <form onSubmit={saveDeploy}>
        <label>SSH 地址（user@host）</label><input value={deploy.server} onChange={setD('server')} placeholder="root@example.com" />
        <label>远程目录</label><input value={deploy.remote_dir} onChange={setD('remote_dir')} placeholder="/var/www/example.com" />
        <label>域名</label><input value={deploy.domain} onChange={setD('domain')} placeholder="example.com" />
        <label>SSH 端口</label><input value={deploy.ssh_port} onChange={setD('ssh_port')} placeholder="22" />
        <button className="btn btn-primary" type="submit" style={{ marginTop: 12 }}>保存部署配置</button>
      </form>
    </div>
  );
}

export default function AdminApp() {
  return <AdminView />;
}
