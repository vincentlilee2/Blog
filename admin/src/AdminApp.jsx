import React, { useState, useEffect, useCallback, useRef } from 'react';

const API = '/api';

// 无鉴权：本地发布后台，所有请求不带 token
const headers = { 'Content-Type': 'application/json' };

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
  const [view, setView] = useState('posts');
  const contentRef = useRef(null);

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
    if (!confirm(`确定删除 ${slug}.md？`)) return;
    const r = await fetch(`${API}/blog/posts/${slug}`, { method: 'DELETE', headers });
    const data = await r.json();
    if (data.ok) loadPosts(); else alert(data.error);
  };

  // 上传媒体文件 → 自动插入正文光标处
  const uploadFile = async (file) => {
    if (!file) return;
    setBusyUpload(true); setUploadErr('');
    try {
      const b64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = () => reject(new Error('读取文件失败'));
        r.readAsDataURL(file);
      });
      const r = await fetch(`${API}/media/upload`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: file.name, mime: file.type, data: b64 }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || '上传失败');
      const url = data.url;
      const et = contentRef.current;
      const t = et ? et.value : (form.content || '');
      const ins = `\n![](${url})\n`;
      setForm((f) => ({ ...f, content: t + ins }));
      setMsg({ type: 'ok', text: `已上传并插入：${url}` });
    } catch (e) {
      setUploadErr(e.message);
    } finally { setBusyUpload(false); }
  };

  const onPick = (e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadFile(f); };
  const onDrop = (e) => { e.preventDefault(); uploadFile(e.dataTransfer?.files?.[0]); };

  const edit = async (p) => {
    setEditing(p.slug);
    setView('edit');
    try {
      const r = await fetch(`${API}/blog/posts/${p.slug}`, { headers });
      const d = await r.json();
      if (d.ok) setForm({ slug: d.post.slug, title: d.post.title || '', description: d.post.description || '', date: (d.post.date || '').slice(0, 10), tags: Array.isArray(d.post.tags) ? d.post.tags.join(', ') : (d.post.tags || ''), cover: d.post.cover || '', published: d.post.published !== false, audience: d.post.audience || 'public', content: d.post.content || '' });
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="admin-wrap">
      <header className="admin-header">
        <h1 className="admin-title">📝 Blog 发布后台</h1>
        <nav className="admin-nav">
          <button className={view === 'posts' ? 'active' : ''} onClick={() => setView('posts')}>文章</button>
          <button className={view === 'media' ? 'active' : ''} onClick={() => setView('media')}>媒体</button>
          <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>设置</button>
        </nav>
      </header>

      {msg && <div className={`msg msg-${msg.type}`}>{msg.text}</div>}

      {view === 'posts' && (
        <>
          {editing !== null && (
            <form className="card" onSubmit={save} style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginTop: 0 }}>{editing ? `编辑：${editing}` : '新建文章'}</h3>
              <div className="row">
                {editing && (
                  <div>
                    <label>slug（文件名，不可改）</label>
                    <input value={form.slug} disabled />
                  </div>
                )}
                <div>
                  <label>日期</label>
                  <input type="date" value={form.date} onChange={set('date')} />
                </div>
              </div>
              <label>标题</label>
              <input value={form.title} onChange={set('title')} placeholder="文章标题" required />
              <label>摘要</label>
              <input value={form.description} onChange={set('description')} placeholder="一句话摘要" />
              <div className="row">
                <div>
                  <label>标签（逗号分隔）</label>
                  <input value={form.tags} onChange={set('tags')} placeholder="技术, AI" />
                </div>
                <div>
                  <label>封面图</label>
                  <input value={form.cover} onChange={set('cover')} placeholder="留空" />
                </div>
              </div>
              <label>正文（Markdown）</label>
              <div
                className="dropzone"
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{ border: '1px dashed #ccc', borderRadius: 8, padding: 8, marginBottom: 8 }}
              >
                <textarea ref={contentRef} value={form.content} onChange={set('content')} rows={14} style={{ width: '100%', fontFamily: 'monospace' }} />
                <p style={{ fontSize: 12, color: '#888' }}>拖拽图片到此处或点击下方按钮上传并插入正文</p>
                <input type="file" onChange={onPick} disabled={busyUpload} />
                {busyUpload && <span> 上传中…</span>}
                {uploadErr && <span className="msg msg-err"> {uploadErr}</span>}
              </div>
              <div className="row">
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> 发布
                </label>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-primary" type="submit">保存</button>
                <button className="btn" type="button" onClick={() => { setEditing(null); setView('posts'); }} style={{ marginLeft: 8 }}>取消</button>
              </div>
            </form>
          )}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ marginTop: 0 }}>文章列表</h3>
              {editing === null && <button className="btn btn-primary" onClick={() => { setEditing(''); setForm({ slug: '', title: '', description: '', date: new Date().toISOString().slice(0, 10), tags: '', cover: '', published: true, audience: 'public', content: '' }); setView('edit'); }}>＋ 新建</button>}
            </div>
            {loading ? <p>加载中…</p> : (
              <ul className="post-list">
                {posts.map((p) => (
                  <li key={p.slug} className="post-item">
                    <div>
                      <h4>{p.title || p.slug} {p.published === false && <span className="badge">草稿</span>}</h4>
                      <small>{p.date} · {Array.isArray(p.tags) ? p.tags.join(', ') : ''} · <code>{p.slug}.md</code></small>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" onClick={() => edit(p)}>编辑</button>
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
      {view === 'settings' && <SettingsView />}
    </div>
  );
}

function MediaView({ onUseCover }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
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
            {f.type === 'images' ? <img src={f.url} alt={f.name} style={{ maxWidth: '100%' }} /> : <span>🎞 {f.name}</span>}
            <div style={{ fontSize: 12 }}>
              <code>{f.name}</code>
              <button className="btn" onClick={() => { navigator.clipboard?.writeText(f.url); setMsg && null; }}>复制URL</button>
              {onUseCover && <button className="btn" onClick={() => onUseCover(f.url)}>设封面</button>}
              <button className="btn btn-danger" onClick={() => del(f.type, f.name)}>删</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView() {
  const [author, setAuthor] = useState({ name: '', role: '', bio: '', avatar: '', github: '', xiaohongshu: '', bilibili: '' });
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    fetch(`${API}/site-config`, { headers }).then((r) => r.json()).then((d) => { if (d.ok && d.config?.author) setAuthor(d.config.author); }).catch(() => {});
  }, []);
  const save = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API}/site-config`, { method: 'PUT', headers, body: JSON.stringify({ author }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setMsg({ type: 'ok', text: '站点设置已保存' });
    } catch (e) { setMsg({ type: 'err', text: e.message }); }
  };
  const set = (k) => (e) => setAuthor({ ...author, [k]: e.target.value });
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>站点设置</h3>
      {msg && <div className={`msg msg-${msg.type}`}>{msg.text}</div>}
      <form onSubmit={save}>
        <label>名称</label><input value={author.name} onChange={set('name')} />
        <label>身份/角色</label><input value={author.role} onChange={set('role')} />
        <label>简介</label><input value={author.bio} onChange={set('bio')} />
        <label>头像 URL</label><input value={author.avatar} onChange={set('avatar')} />
        <label>GitHub</label><input value={author.github} onChange={set('github')} />
        <label>小红书</label><input value={author.xiaohongshu} onChange={set('xiaohongshu')} />
        <label>B站</label><input value={author.bilibili} onChange={set('bilibili')} />
        <button className="btn btn-primary" type="submit" style={{ marginTop: 12 }}>保存</button>
      </form>
    </div>
  );
}

export default function AdminApp() {
  return <AdminView />;
}
