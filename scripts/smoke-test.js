'use strict';
// Uji cepat end-to-end: jalankan server sementara, login, unggah foto, simpan proyek, cek halaman publik.
// Pakai: npm test
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsb-test-'));
const PORT = 3900 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, DATA_DIR: dir, ADMIN_PASSWORD: 'uji-coba-123' }, stdio: ['ignore', 'pipe', 'inherit'] });
let ok = 0, bad = 0, cookie = '';
const check = (name, cond, extra) => { if (cond) { ok++; console.log('  ok   ' + name); } else { bad++; console.log('  GAGAL ' + name + (extra ? ' -> ' + extra : '')); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(method, p, body, headers = {}) {
  const opt = { method, headers: { cookie, 'x-requested-with': 'bsb', ...headers } };
  if (body !== undefined && !(body instanceof FormData)) { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(body); } else if (body) opt.body = body;
  const r = await fetch(base + p, opt); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) {} return { status: r.status, json: j, text: t };
}
(async () => {
  for (let i = 0; i < 100; i++) { try { await fetch(base + '/robots.txt'); break; } catch (_) { await sleep(200); } }
  // seed demo berjalan di latar belakang; tunggu sampai ada proyek
  let pub; for (let i = 0; i < 120; i++) { pub = await call('GET', '/api/content'); if (pub.json && pub.json.projects.length) break; await sleep(500); }
  check('konten contoh dibuat otomatis', pub.json.projects.length >= 5 && pub.json.tour.scenes.length === 3, JSON.stringify(pub.json && pub.json.projects.length));
  const home = await call('GET', '/'); check('beranda tampil dengan SEO', home.status === 200 && /<title>Bali Solution Building/.test(home.text) && /GeneralContractor/.test(home.text));
  check('CSP terpasang', !!(await fetch(base + '/')).headers.get('content-security-policy'));
  check('API admin menolak tanpa login', (await call('GET', '/api/admin/content')).status === 401);
  check('login salah ditolak', (await call('POST', '/api/admin/login', { password: 'salah' })).status === 401);
  check('login benar', (await call('POST', '/api/admin/login', { password: 'uji-coba-123' })).status === 200 && cookie.startsWith('bsb_sid='));
  check('permintaan tanpa header anti-CSRF ditolak', (await call('PUT', '/api/admin/section/stats', [], { 'x-requested-with': '' })).status === 403);
  // unggah foto proyek (PNG kecil dari sharp)
  const sharp = require('sharp');
  const png = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: { r: 200, g: 155, b: 60 } } }).png().toBuffer();
  const fd = new FormData(); fd.append('file', new Blob([png], { type: 'image/png' }), 'tes.png');
  const up = await call('POST', '/api/admin/upload/project', fd);
  check('unggah foto proyek dikompres ke webp', up.status === 200 && up.json.files[0] && /\.webp$/.test(up.json.files[0].src) && up.json.files[0].w <= 1800, up.text.slice(0, 200));
  const bad1 = new FormData(); bad1.append('file', new Blob([Buffer.from('bukan gambar sungguhan, hanya teks')], { type: 'image/png' }), 'palsu.png');
  check('file palsu ditolak', (await call('POST', '/api/admin/upload/project', bad1)).status === 400);
  const flat = new FormData(); flat.append('file', new Blob([png], { type: 'image/png' }), 'bukan-360.png');
  check('foto 360 non-2:1 ditolak', (await call('POST', '/api/admin/upload/pano', flat)).status === 400);
  const f = up.json.files[0];
  const saved = await call('PUT', '/api/admin/section/projects', [{ title: 'Proyek Uji <b>x</b>', category: 'Renovasi', year: '2025', cover: f.src, images: [{ src: f.src, thumb: f.thumb }], published: true }]);
  check('simpan proyek', saved.status === 200 && saved.json[0].title.includes('Proyek Uji') && saved.json[0].cover === f.src);
  const pub2 = await call('GET', '/api/content');
  check('proyek tampil di API publik', pub2.json.projects.length === 1);
  const x = await call('PUT', '/api/admin/section/projects', [{ title: 'Uji', cover: '/uploads/../../etc/passwd', images: [{ src: '/uploads/../server.js' }] }]);
  check('path foto berbahaya dibuang', x.status === 200 && x.json[0].images.length === 0 && x.json[0].cover === null);
  const img = await fetch(base + f.src); check('foto dilayani dengan cache panjang', img.status === 200 && /immutable/.test(img.headers.get('cache-control')));
  check('path traversal diblokir', [400, 404].includes((await fetch(base + '/uploads/..%2f..%2fserver.js')).status));
  const pw = await call('POST', '/api/admin/password', { current: 'uji-coba-123', next: 'pendek' }); check('password baru terlalu pendek ditolak', pw.status === 400);
  console.log(`\n${ok} lulus, ${bad} gagal`);
  srv.kill(); fs.rmSync(dir, { recursive: true, force: true }); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); srv.kill(); process.exit(1); });
