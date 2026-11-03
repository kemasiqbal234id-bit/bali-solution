'use strict';
// Bali Solution Building: server tanpa framework. Hanya Node.js bawaan (+ sharp opsional untuk kompres foto).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

// ---- .env sederhana ----
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !l.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (_) {}

const { parseMultipart } = require('./lib/multipart');
const images = require('./lib/images');
const { createStore } = require('./lib/store');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');
const store = createStore(DATA_DIR, UPLOAD_DIR);

// ---- kredensial admin ----
const secretFile = path.join(DATA_DIR, 'secret.key');
const adminFile = path.join(DATA_DIR, 'admin.json');
let SECRET;
try { SECRET = fs.readFileSync(secretFile, 'utf8'); } catch (_) { SECRET = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(secretFile, SECRET, { mode: 0o600 }); }
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
function setPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(adminFile, JSON.stringify({ salt, hash: hashPw(pw, salt) }), { mode: 0o600 });
}
if (!fs.existsSync(adminFile)) {
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  setPassword(pw);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('\n==============================================================');
    console.log(' Password admin awal (dibuat otomatis): ' + pw);
    console.log(' Masuk di /admin lalu segera ganti di menu Pengaturan > Keamanan.');
    console.log('==============================================================\n');
  }
}
function checkPassword(pw) {
  try {
    const { salt, hash } = JSON.parse(fs.readFileSync(adminFile, 'utf8'));
    const a = Buffer.from(hashPw(String(pw), salt), 'hex'); const b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) { return false; }
}

// ---- sesi (cookie bertanda tangan) ----
const SESSION_MS = 7 * 24 * 3600 * 1000;
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
function makeSession() { const exp = String(Date.now() + SESSION_MS); return exp + '.' + sign(exp); }
function isAuthed(req) {
  const m = /(?:^|;\s*)bsb_sid=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
const attempts = new Map();
function throttled(ip) {
  const now = Date.now(); const a = (attempts.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  attempts.set(ip, a); return a.length >= 8;
}

// ---- util HTTP ----
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const COMPRESSIBLE = /^(text\/|application\/(json|xml)|image\/svg)/;
const CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'";

function send(req, res, status, body, headers = {}) {
  const h = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Security-Policy': CSP, ...headers };
  const type = h['Content-Type'] || '';
  if (COMPRESSIBLE.test(type) && body.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    body = zlib.gzipSync(body); h['Content-Encoding'] = 'gzip'; h.Vary = 'Accept-Encoding';
  }
  h['Content-Length'] = body.length;
  res.writeHead(status, h); res.end(req.method === 'HEAD' ? undefined : body);
}
const json = (req, res, status, obj, headers) => send(req, res, status, Buffer.from(JSON.stringify(obj)), { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store', ...headers });
const fail = (req, res, status, message) => json(req, res, status, { error: message });

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Ukuran data terlalu besar'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const readJson = async (req) => { const b = await readBody(req, 2 * 1024 * 1024); try { return JSON.parse(b.toString('utf8') || '{}'); } catch (_) { throw Object.assign(new Error('JSON tidak valid'), { status: 400 }); } };

// ---- halaman publik (SEO + data awal disisipkan ke HTML) ----
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function publicContent() {
  const c = store.load();
  return { settings: c.settings, hero: c.hero, services: c.services, stats: c.stats, testimonials: c.testimonials, projects: c.projects.filter((p) => p.published !== false), tour: c.tour };
}
function renderIndex() {
  const tpl = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const c = publicContent(); const s = c.settings;
  const ld = { '@context': 'https://schema.org', '@type': 'GeneralContractor', name: s.name, description: s.description, telephone: '+' + s.whatsapp, address: { '@type': 'PostalAddress', streetAddress: s.address, addressCountry: 'ID' }, ...(SITE_URL && { url: SITE_URL }) };
  const og = c.projects.find((p) => p.cover); 
  const fill = { TITLE: esc(`${s.name} | ${s.tagline}`), DESC: esc(s.description), OG_IMAGE: og && SITE_URL ? esc(SITE_URL + og.cover) : '',
    JSONLD: JSON.stringify(ld).replace(/</g, '\\u003c'),
    BOOT: JSON.stringify(c).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') };
  return tpl.replace(/\{\{(TITLE|DESC|OG_IMAGE|JSONLD|BOOT)\}\}/g, (_, k) => fill[k]);
}

// ---- file statis ----
function serveFile(req, res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return fail(req, res, 404, 'Tidak ditemukan');
    const ext = path.extname(file).toLowerCase();
    const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', ETag: etag, 'Cache-Control': cache };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
    fs.readFile(file, (e, buf) => (e ? fail(req, res, 500, 'Gagal membaca file') : send(req, res, 200, buf, headers)));
  });
}
function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, decodeURIComponent(rel)));
  return p.startsWith(base + path.sep) || p === base ? p : null;
}

// ---- API admin ----
async function adminApi(req, res, url) {
  const route = url.pathname.replace('/api/admin', '');
  const ip = req.socket.remoteAddress || '';

  if (route === '/login' && req.method === 'POST') {
    if (throttled(ip)) return fail(req, res, 429, 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.');
    const { password } = await readJson(req);
    if (!checkPassword(password || '')) { attempts.get(ip).push(Date.now()); return fail(req, res, 401, 'Password salah'); }
    const secure = process.env.COOKIE_SECURE === 'true' || req.headers['x-forwarded-proto'] === 'https';
    return json(req, res, 200, { ok: true }, { 'Set-Cookie': `bsb_sid=${makeSession()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}` });
  }
  if (route === '/logout' && req.method === 'POST') return json(req, res, 200, { ok: true }, { 'Set-Cookie': 'bsb_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });

  if (!isAuthed(req)) return fail(req, res, 401, 'Silakan masuk dulu');
  if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'bsb') return fail(req, res, 403, 'Permintaan ditolak');

  if (route === '/me') return json(req, res, 200, { ok: true, sharp: images.hasSharp() });
  if (route === '/content' && req.method === 'GET') { const { isFresh, ...c } = store.load(); return json(req, res, 200, c); }

  if (route === '/password' && req.method === 'POST') {
    const { current, next } = await readJson(req);
    if (!checkPassword(current || '')) return fail(req, res, 400, 'Password saat ini salah');
    if (typeof next !== 'string' || next.length < 8) return fail(req, res, 400, 'Password baru minimal 8 karakter');
    setPassword(next);
    return json(req, res, 200, { ok: true });
  }

  let m = /^\/section\/([a-z]+)$/.exec(route);
  if (m && req.method === 'PUT') {
    const body = await readJson(req);
    const result = store.setSection(m[1], body);
    if (['projects', 'tour', 'hero'].includes(m[1])) store.gc();
    return json(req, res, 200, result);
  }

  m = /^\/upload\/(project|pano|hero)$/.exec(route);
  if (m && req.method === 'POST') {
    const buf = await readBody(req, 80 * 1024 * 1024);
    const { files } = parseMultipart(buf, req.headers['content-type']);
    if (!files.length) return fail(req, res, 400, 'Tidak ada file yang dikirim');
    if (files.length > 20) return fail(req, res, 400, 'Maksimal 20 foto sekali kirim');
    const out = []; const errors = [];
    for (const f of files) {
      try { out.push({ name: f.filename, ...(await images.save(f.data, m[1], UPLOAD_DIR)) }); }
      catch (e) { errors.push(`${f.filename}: ${e.message}`); }
    }
    return json(req, res, out.length ? 200 : 400, { files: out, errors });
  }
  return fail(req, res, 404, 'Endpoint tidak ada');
}

// ---- router utama ----
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (!['GET', 'HEAD', 'POST', 'PUT'].includes(req.method)) return fail(req, res, 405, 'Metode tidak didukung');

    if (p.startsWith('/api/admin/')) return await adminApi(req, res, url);
    if (p === '/api/content') return json(req, res, 200, publicContent());
    if (p === '/' || p === '/index.html') return send(req, res, 200, Buffer.from(renderIndex()), { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
    if (p === '/robots.txt') return send(req, res, 200, Buffer.from(`User-agent: *\nDisallow: /admin\nDisallow: /api/\n${SITE_URL ? `Sitemap: ${SITE_URL}/sitemap.xml\n` : ''}`), { 'Content-Type': MIME['.txt'] });
    if (p === '/sitemap.xml' && SITE_URL) return send(req, res, 200, Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}/</loc></url></urlset>`), { 'Content-Type': MIME['.xml'] });
    if (p.startsWith('/uploads/')) {
      const f = safeJoin(UPLOAD_DIR, p.slice('/uploads/'.length));
      return f ? serveFile(req, res, f, 'public, max-age=31536000, immutable') : fail(req, res, 400, 'Path tidak valid');
    }
    let rel = p === '/admin' ? '/admin/' : p;
    if (rel.endsWith('/')) rel += 'index.html';
    const f = safeJoin(PUBLIC, rel);
    if (!f) return fail(req, res, 400, 'Path tidak valid');
    const headers = rel.startsWith('/admin/') ? 'no-cache' : (/\.(html)$/.test(rel) ? 'no-cache' : 'public, max-age=300, must-revalidate');
    return serveFile(req, res, f, headers);
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) fail(req, res, e.status || 500, e.status ? e.message : 'Terjadi kesalahan di server');
  }
});

// ---- data awal (demo) saat pertama jalan ----
(async () => {
  if (store.load().isFresh) {
    try { await require('./lib/demo').seed(store, UPLOAD_DIR); console.log('Konten demo dibuat. Hapus lewat dashboard bila sudah tidak diperlukan.'); }
    catch (e) { console.warn('Konten demo dilewati:', e.message); store.replaceAll(store.load()); }
  }
  setInterval(() => store.gc(), 6 * 3600 * 1000).unref();
  if (require.main === module) server.listen(PORT, () => console.log(`Bali Solution Building berjalan di http://localhost:${PORT}  (admin: /admin)  | kompres foto: ${images.hasSharp() ? 'aktif' : 'MATI (npm install sharp)'}`));
})();
module.exports = server;
