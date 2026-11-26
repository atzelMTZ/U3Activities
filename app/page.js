'use client';
import { useState, useEffect } from 'react';
const T = {
  default: { n: 'General', bg: '#f4f6f8', fg: '#1d2733', ac: '#2f6fed', cd: '#fff', f: 'system-ui,sans-serif', i: '🔎' },
  egypt: { n: 'Ancient Egypt', bg: '#efd9a0', fg: '#3b2a10', ac: '#b8860b', cd: '#fff4d6', f: 'Georgia,serif', i: '🏺' },
  space: { n: 'Space', bg: '#0b1026', fg: '#e6e9ff', ac: '#8a7dff', cd: '#151c3f', f: '"Trebuchet MS",sans-serif', i: '🚀' },
  ocean: { n: 'Ocean', bg: '#d6f0f7', fg: '#08303f', ac: '#0a8fb5', cd: '#f0fbfe', f: 'Verdana,sans-serif', i: '🌊' },
  rome: { n: 'Rome', bg: '#e9e1d6', fg: '#3a1f1f', ac: '#8b1e2d', cd: '#f8f3ea', f: '"Times New Roman",serif', i: '🏛️' },
};
const tk = () => localStorage.getItem('tk');
async function api(p, o = {}) {
  const r = await fetch('/api/' + p, { method: o.m || 'GET', headers: { 'Content-Type': 'application/json', ...(tk() ? { Authorization: 'Bearer ' + tk() } : {}) }, body: o.b && JSON.stringify(o.b) });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && tk()) { localStorage.clear(); dispatchEvent(new Event('lo')); location.hash = '/login?next=' + encodeURIComponent(location.hash.slice(1)); }
  if (!r.ok) throw new Error(d.error || 'Error');
  return d;
}
export default function App() {
  const [me, setMe] = useState(null), [h, setH] = useState('/'), [ok, setOk] = useState(false), [th, setTh] = useState('default'), [site, setSite] = useState('Atlas');
  useEffect(() => {
    const s = () => setH(location.hash.slice(1) || '/'), lo = () => setMe(null);
    try { setMe(JSON.parse(localStorage.getItem('me'))); } catch {}
    s(); setOk(true); addEventListener('hashchange', s); addEventListener('lo', lo);
    api('settings').then(d => setSite(d.siteName)).catch(() => {});
    return () => { removeEventListener('hashchange', s); removeEventListener('lo', lo); };
  }, []);
  const [path, qs] = h.split('?'), q = new URLSearchParams(qs || ''), P = path.split('/').filter(Boolean);
  const guarded = ['account', 'admin', 'edit', 'saved'].includes(P[0]);
  useEffect(() => { if (ok && guarded && !me) location.hash = '/login?next=' + encodeURIComponent(h); }, [ok, guarded, me, h]);
  useEffect(() => { if (P[0] !== 'topic') setTh('default'); }, [h]);
  const t = T[th] || T.default;
  const logout = async () => { try { await api('logout', { m: 'POST' }); } catch {} localStorage.clear(); setMe(null); location.hash = '/'; };
  const go = x => () => (location.hash = x);
  const card = { background: t.cd, border: `2px solid ${t.ac}`, borderRadius: 10, padding: 16, margin: '12px 0' };
  const btn = { background: t.ac, color: t.bg === '#0b1026' ? '#fff' : '#fff', border: 0, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', margin: 2 };
  const inp = { display: 'block', width: '100%', boxSizing: 'border-box', padding: 8, margin: '6px 0', borderRadius: 6, border: `1px solid ${t.ac}` };
  const ctx = { me, t, card, btn, inp, setTh, go, setMe };
  if (!ok) return null;
  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.fg, fontFamily: t.f }}>
      <header style={{ background: t.ac, color: '#fff', padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 20, cursor: 'pointer' }} onClick={go('/')}>{t.i} {site}</b><span style={{ flex: 1 }} />
        {me ? (<>
          <span>{me.name} ({me.role})</span>
          {['investigator', 'admin'].includes(me.role) && <button style={btn} onClick={go('/edit/new')}>+ Topic</button>}
          {me.role === 'admin' && <button style={btn} onClick={go('/admin')}>Admin</button>}
          <button style={btn} onClick={go('/saved')}>Saved</button><button style={btn} onClick={go('/account')}>Account</button><button style={btn} onClick={logout}>Logout</button>
        </>) : <button style={btn} onClick={go('/login')}>Login</button>}
      </header>
      <main style={{ maxWidth: 820, margin: '0 auto', padding: 20 }}>
        {P[0] === 'login' || P[0] === 'register' || P[0] === 'forgot' || P[0] === 'reset' ? <Auth {...ctx} mode={P[0]} q={q} /> :
          P[0] === 'topic' ? <Topic {...ctx} id={P[1]} /> :
          P[0] === 'edit' && me ? (['investigator', 'admin'].includes(me.role) ? <Edit {...ctx} id={P[1]} /> : <p>403 Forbidden: investigators only</p>) : P[0] === 'saved' && me ? <Saved {...ctx} /> :
          P[0] === 'account' && me ? <Account {...ctx} /> :
          P[0] === 'admin' && me ? <Admin {...ctx} /> : !guarded ? <Home {...ctx} /> : null}
      </main>
    </div>
  );
}
function Err({ e }) { return e ? <p style={{ color: '#c0392b' }}>{e}</p> : null; }
function Auth({ mode, q, btn, inp, card, setMe, go }) {
  const [f, sf] = useState({}), [m, sm] = useState(''), [e, se] = useState('');
  const set = k => ev => sf({ ...f, [k]: ev.target.value });
  const submit = async () => {
    se(''); sm('');
    try {
      if (mode === 'register') { await api('register', { m: 'POST', b: f }); location.hash = '/login'; }
      else if (mode === 'login') { const d = await api('login', { m: 'POST', b: f }); localStorage.setItem('tk', d.token); localStorage.setItem('me', JSON.stringify(d.user)); setMe(d.user); location.hash = q.get('next') || '/'; }
      else if (mode === 'forgot') sm((await api('password/forgot', { m: 'POST', b: f })).message);
      else { await api('password/reset', { m: 'POST', b: { token: q.get('token'), password: f.password } }); location.hash = '/login'; }
    } catch (x) { se(x.message); }
  };
  return (<div style={card}><h2>{mode}</h2>
    {mode === 'register' && <input style={inp} placeholder="Name" onChange={set('name')} />}
    {mode !== 'reset' && <input style={inp} placeholder="Email" onChange={set('email')} />}
    {mode !== 'forgot' && <input style={inp} type="password" placeholder="Password" onChange={set('password')} />}
    <button style={btn} onClick={submit}>Submit</button><Err e={e} />{m && <p>{m}</p>}
    {mode === 'login' && <p><a href="#/register">Register</a> · <a href="#/forgot">Forgot password?</a></p>}
  </div>);
}
function Home({ card, setTh }) {
  const [ts, st] = useState([]); useEffect(() => { api('topics').then(st).catch(() => {}); }, []);
  return (<><h2>Research topics</h2>{ts.map(x => { const th = T[x.theme] || T.default; return (
    <div key={x._id} style={{ ...card, background: th.cd, borderColor: th.ac, color: th.fg, fontFamily: th.f, cursor: 'pointer' }} onClick={() => (location.hash = '/topic/' + x._id)}>
      <h3>{th.i} {x.title}</h3><p>{x.summary}</p></div>); })}</>);
}
function Topic({ id, me, card, btn, inp, setTh }) {
  const [t, st] = useState(null), [posts, sp] = useState([]), [img, si] = useState(''), [favs, sf] = useState([]), [txt, sx] = useState(''), [e, se] = useState('');
  const load = () => { if (!me) return; api(`topics/${id}/posts`).then(sp).catch(x => se(x.message)); api('favs').then(sf).catch(() => {}); };
  useEffect(() => { api('topics/' + id).then(d => { st(d); setTh(d.theme); }); load(); }, [id, me]);
  useEffect(() => { if (!me || !t?.hasImage) return; fetch('/api/media/' + id, { headers: { Authorization: 'Bearer ' + tk() } }).then(r => r.ok ? r.blob() : null).then(b => b && si(URL.createObjectURL(b))); }, [t, me]);
  if (!t) return null;
  const has = k => favs.some(f => f.tid === id && f.kind === k);
  const tog = k => async () => { await api('favs', { m: 'POST', b: { tid: id, kind: k } }); load(); };
  const post = async (parent) => { await api('favs').catch(() => {}); try { await api(`topics/${id}/posts`, { m: 'POST', b: { text: txt, parent } }); sx(''); load(); } catch (x) { se(x.message); } };
  const roots = posts.filter(p => !p.parent);
  return (<><h2>{t.title}</h2><p>{t.summary}</p>
    {!me ? <div style={card}>🔒 Images and discussions are members-only. <button style={btn} onClick={() => (location.hash = '/login?next=' + encodeURIComponent('/topic/' + id))}>Login to continue</button></div> : <>
      {img && <img src={img} alt="" style={{ maxWidth: '100%', borderRadius: 10 }} />}
      <div><button style={btn} onClick={tog('favorite')}>{has('favorite') ? '★ Favorited' : '☆ Favorite'}</button><button style={btn} onClick={tog('bookmark')}>{has('bookmark') ? '🔖 Bookmarked' : '🔖 Bookmark'}</button>
        {['investigator', 'admin'].includes(me.role) && <button style={btn} onClick={() => (location.hash = '/edit/' + id)}>Edit</button>}</div>
      <h3>Discussion</h3>
      {roots.map(r => (<div key={r._id} style={card}><b>{r.name}</b>: {r.text}
        {posts.filter(c => c.parent === r._id).map(c => <div key={c._id} style={{ marginLeft: 20 }}><b>{c.name}</b>: {c.text}</div>)}
        <Reply btn={btn} inp={inp} send={async t => { try { await api(`topics/${id}/posts`, { m: 'POST', b: { text: t, parent: r._id } }); load(); } catch (x) { se(x.message); } }} /></div>))}
      <textarea style={inp} rows={3} value={txt} onChange={ev => sx(ev.target.value)} placeholder="Write a comment or start a thread" />
      <button style={btn} onClick={() => post(null)}>New thread</button><Err e={e} /></>}
  </>);
}
function Edit({ id, me, card, btn, inp }) {
  const [f, sf] = useState({ title: '', summary: '', theme: 'default' }), [e, se] = useState('');
  useEffect(() => { if (id !== 'new') api('topics/' + id).then(d => sf({ title: d.title, summary: d.summary, theme: d.theme })); }, [id]);
  const file = ev => { const r = new FileReader(); r.onload = () => sf({ ...f, image: r.result }); r.readAsDataURL(ev.target.files[0]); };
  const save = async () => { try { id === 'new' ? await api('topics', { m: 'POST', b: f }) : await api('topics/' + id, { m: 'PUT', b: f }); location.hash = '/'; } catch (x) { se(x.message); } };
  const del = async () => { try { await api('topics/' + id, { m: 'DELETE' }); location.hash = '/'; } catch (x) { se(x.message); } };
  return (<div style={card}><h2>{id === 'new' ? 'New' : 'Edit'} topic</h2>
    <input style={inp} placeholder="Title" value={f.title} onChange={ev => sf({ ...f, title: ev.target.value })} />
    <textarea style={inp} rows={5} placeholder="Summary" value={f.summary} onChange={ev => sf({ ...f, summary: ev.target.value })} />
    <select style={inp} value={f.theme} onChange={ev => sf({ ...f, theme: ev.target.value })}>{Object.entries(T).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}</select>
    <input type="file" accept="image/*" onChange={file} /><br />
    <button style={btn} onClick={save}>Save</button>{me.role === 'admin' && id !== 'new' && <button style={btn} onClick={del}>Delete</button>}<Err e={e} /></div>);
}
function Account({ card, btn, inp }) {
  const [f, sf] = useState({}), [m, sm] = useState(''), [ss, sS] = useState([]);
  const L = () => api('sessions').then(sS); useEffect(() => { L(); }, []);
  const ch = async () => { try { await api('password/change', { m: 'POST', b: f }); sm('Password updated'); } catch (x) { sm(x.message); } };
  return (<><div style={card}><h2>Change password</h2>
    <input style={inp} type="password" placeholder="Current" onChange={ev => sf({ ...f, current: ev.target.value })} />
    <input style={inp} type="password" placeholder="New (8+, upper, lower, digit)" onChange={ev => sf({ ...f, password: ev.target.value })} />
    <button style={btn} onClick={ch}>Update</button><p>{m}</p></div>
    <div style={card}><h2>Active devices (max 2)</h2>{ss.map(s => <div key={s.id}>{s.current ? '● this device · ' : ''}{s.device.slice(0, 60)} · {new Date(s.createdAt).toLocaleString()}
      {!s.current && <button style={btn} onClick={async () => { await api('sessions/' + s.id, { m: 'DELETE' }); L(); }}>End</button>}</div>)}</div></>);
}
function Admin({ me, card, btn, inp }) {
  const [us, su] = useState([]), [n, sn] = useState(''), [e, se] = useState('');
  const L = () => api('admin/users').then(su).catch(x => se(x.message)); useEffect(() => { L(); }, []);
  if (me.role !== 'admin') return <p>403 Forbidden</p>;
  return (<><div style={card}><h2>Users & roles</h2>{us.map(u => <div key={u.id}>{u.name} · {u.email}
    <select value={u.role} onChange={async ev => { await api('admin/users/' + u.id, { m: 'PUT', b: { role: ev.target.value } }); L(); }}><option>user</option><option>investigator</option><option>admin</option></select>
    <button style={btn} onClick={async () => { try { await api('admin/users/' + u.id, { m: 'DELETE' }); L(); } catch (x) { se(x.message); } }}>Delete</button></div>)}<Err e={e} /></div>
    <div style={card}><h2>Platform settings</h2><input style={inp} placeholder="Site name" onChange={ev => sn(ev.target.value)} /><button style={btn} onClick={() => api('admin/settings', { m: 'PUT', b: { siteName: n } })}>Save</button></div></>);
}

function Reply({ send, btn, inp }) {
  const [t, st] = useState('');
  return (<div><input style={inp} placeholder="Reply to this thread" value={t} onChange={e => st(e.target.value)} /><button style={btn} onClick={() => { if (t) { send(t); st(''); } }}>Reply</button></div>);
}
function Saved({ card, btn }) {
  const [f, sf] = useState([]), [ts, st] = useState([]);
  const L = () => { api('favs').then(sf).catch(() => {}); api('topics').then(st).catch(() => {}); };
  useEffect(() => { L(); }, []);
  const sec = (k, title) => (<div style={card}><h2>{title}</h2>{f.filter(x => x.kind === k).map(x => { const t = ts.find(y => y._id === x.tid); return t ? (<div key={x._id}><a href={'#/topic/' + t._id}>{t.title}</a><button style={btn} onClick={async () => { await api('favs', { m: 'POST', b: { tid: x.tid, kind: k } }); L(); }}>Remove</button></div>) : null; })}</div>);
  return (<>{sec('favorite', '★ Favorites')}{sec('bookmark', '🔖 Bookmarks')}</>);
}
