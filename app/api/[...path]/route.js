import bcrypt from 'bcryptjs'; import jwt from 'jsonwebtoken'; import crypto from 'crypto';
import { db, User, Session, Topic, Fav, Post, Setting } from '../../../lib.js';
const J = (d, s = 200) => Response.json(d, { status: s });
const strong = p => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(p || '');
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const pub = u => ({ id: u.id, email: u.email, name: u.name, role: u.role });
const pick = b => ({ title: b.title, summary: b.summary, theme: b.theme || 'default', ...(b.image ? { image: b.image, hasImage: true } : {}) });
async function auth(req) {
  try {
    const t = (req.headers.get('authorization') || '').slice(7);
    const d = jwt.verify(t, process.env.JWT_SECRET);
    if (!(await Session.exists({ _id: d.sid }))) return null;
    const u = await User.findById(d.uid); return u ? { u, sid: d.sid } : null;
  } catch { return null; }
}
async function handle(req, { params }) {
  await db();
  const [a, b, c] = (await params).path; const m = req.method;
  const body = ['POST', 'PUT'].includes(m) ? await req.json().catch(() => ({})) : {};
  const A = await auth(req);
  const need = (...r) => !A ? J({ error: 'Unauthorized' }, 401) : (r.length && !r.includes(A.u.role)) ? J({ error: 'Forbidden' }, 403) : null;
  let e;
  if (a === 'settings' && m === 'GET') { const s = await Setting.findOne({ key: 'siteName' }); return J({ siteName: s?.val || 'Atlas' }); }
  if (a === 'register' && m === 'POST') {
    const { email, name, password } = body;
    if (!email || !name || !strong(password)) return J({ error: 'Valid email, name and strong password (8+, upper, lower, digit) required' }, 400);
    if (await User.exists({ email: email.toLowerCase() })) return J({ error: 'Email already registered' }, 409);
    const first = (await User.countDocuments()) === 0;
    await User.create({ email: email.toLowerCase(), name, hash: await bcrypt.hash(password, 12), role: first ? 'admin' : 'user' });
    return J({ ok: true }, 201);
  }
  if (a === 'login' && m === 'POST') {
    const u = await User.findOne({ email: (body.email || '').toLowerCase() });
    if (!u || !(await bcrypt.compare(body.password || '', u.hash))) return J({ error: 'Invalid credentials' }, 401);
    const act = await Session.find({ uid: u.id }).sort({ createdAt: 1 });
    for (const s of act.slice(0, Math.max(0, act.length - 1))) await s.deleteOne();
    const s = await Session.create({ uid: u.id, device: req.headers.get('user-agent') || 'unknown', ip: req.headers.get('x-forwarded-for') || '' });
    const token = jwt.sign({ uid: u.id, role: u.role, sid: s.id }, process.env.JWT_SECRET, { expiresIn: '2h' });
    return J({ token, user: pub(u) });
  }
  if (a === 'logout' && m === 'POST') { if ((e = need())) return e; await Session.findByIdAndDelete(A.sid); return J({ ok: true }); }
  if (a === 'sessions') {
    if ((e = need())) return e;
    if (m === 'GET') return J((await Session.find({ uid: A.u.id }).sort({ createdAt: -1 })).map(s => ({ id: s.id, device: s.device, ip: s.ip, createdAt: s.createdAt, current: s.id === A.sid })));
    if (m === 'DELETE') { await Session.deleteOne({ _id: b, uid: A.u.id }); return J({ ok: true }); }
  }
  if (a === 'password' && m === 'POST') {
    if (b === 'change') {
      if ((e = need())) return e;
      if (!(await bcrypt.compare(body.current || '', A.u.hash))) return J({ error: 'Current password incorrect' }, 400);
      if (!strong(body.password)) return J({ error: 'Weak password (8+, upper, lower, digit)' }, 400);
      A.u.hash = await bcrypt.hash(body.password, 12); await A.u.save(); return J({ ok: true });
    }
    if (b === 'forgot') {
      const u = await User.findOne({ email: (body.email || '').toLowerCase() });
      if (u) {
        const tok = crypto.randomBytes(32).toString('hex');
        u.reset = { h: sha(tok), exp: new Date(Date.now() + 15 * 60000) }; await u.save();
        const link = `${process.env.APP_URL}/#/reset?token=${tok}`;
        if (process.env.RESEND_API_KEY) await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.MAIL_FROM, to: u.email, subject: 'Reset your password', html: `<a href="${link}">Reset password</a> (valid 15 min)` }) });
        else console.log('RESET LINK (dev):', link);
      }
      return J({ message: 'If that email exists, a reset link has been sent.' });
    }
    if (b === 'reset') {
      if (!strong(body.password)) return J({ error: 'Weak password' }, 400);
      const u = await User.findOne({ 'reset.h': sha(body.token || ''), 'reset.exp': { $gt: new Date() } });
      if (!u) return J({ error: 'Invalid or expired token' }, 400);
      u.hash = await bcrypt.hash(body.password, 12); u.reset = undefined; await u.save();
      await Session.deleteMany({ uid: u.id }); return J({ ok: true });
    }
  }
  if (a === 'topics') {
    if (!b && m === 'GET') {
      if (!(await Topic.countDocuments())) await Topic.create([{ title: 'Ancient Egypt', summary: 'Pharaohs, pyramids and the Nile.', theme: 'egypt' }, { title: 'The Space Race', summary: 'Sputnik to Apollo.', theme: 'space' }]);
      return J(await Topic.find().select('-image').sort({ createdAt: -1 }));
    }
    if (!b && m === 'POST') { if ((e = need('investigator', 'admin'))) return e; const t = await Topic.create({ ...pick(body), by: A.u.name }); return J({ id: t.id }, 201); }
    if (b && !c) {
      if (m === 'GET') return J(await Topic.findById(b).select('-image'));
      if (m === 'PUT') { if ((e = need('investigator', 'admin'))) return e; await Topic.findByIdAndUpdate(b, pick(body)); return J({ ok: true }); }
      if (m === 'DELETE') { if ((e = need('admin'))) return e; await Topic.findByIdAndDelete(b); return J({ ok: true }); }
    }
    if (c === 'posts') {
      if ((e = need())) return e;
      if (m === 'GET') return J(await Post.find({ tid: b }).sort({ createdAt: 1 }));
      if (m === 'POST') { if (!body.text) return J({ error: 'Empty' }, 400); return J(await Post.create({ tid: b, uid: A.u.id, name: A.u.name, parent: body.parent || null, text: body.text }), 201); }
    }
  }
  if (a === 'media' && m === 'GET') {
    if ((e = need())) return e;
    const t = await Topic.findById(b); const mt = /^data:(.+?);base64,(.+)$/.exec(t?.image || '');
    return mt ? new Response(Buffer.from(mt[2], 'base64'), { headers: { 'Content-Type': mt[1], 'Cache-Control': 'private, no-store' } }) : J({ error: 'Not found' }, 404);
  }
  if (a === 'favs') {
    if ((e = need())) return e;
    if (m === 'GET') return J(await Fav.find({ uid: A.u.id }));
    if (m === 'POST') { const q = { uid: A.u.id, tid: body.tid, kind: body.kind }; const x = await Fav.findOne(q); if (x) await x.deleteOne(); else await Fav.create(q); return J({ on: !x }); }
  }
  if (a === 'admin') {
    if ((e = need('admin'))) return e;
    if (b === 'users' && m === 'GET') return J((await User.find()).map(pub));
    if (b === 'users' && m === 'PUT') { if (!['user', 'investigator', 'admin'].includes(body.role)) return J({ error: 'Bad role' }, 400); await User.findByIdAndUpdate(c, { role: body.role }); return J({ ok: true }); }
    if (b === 'users' && m === 'DELETE') { if (c === A.u.id) return J({ error: 'Cannot delete yourself' }, 400); await User.findByIdAndDelete(c); await Session.deleteMany({ uid: c }); return J({ ok: true }); }
    if (b === 'settings' && m === 'PUT') { await Setting.findOneAndUpdate({ key: 'siteName' }, { val: body.siteName }, { upsert: true }); return J({ ok: true }); }
  }
  return J({ error: 'Not found' }, 404);
}
export async function GET(req, ctx) { return handle(req, ctx); }
export async function POST(req, ctx) { return handle(req, ctx); }
export async function PUT(req, ctx) { return handle(req, ctx); }
export async function DELETE(req, ctx) { return handle(req, ctx); }
