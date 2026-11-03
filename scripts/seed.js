'use strict';
// Membuat ulang konten contoh (proyek ilustrasi + 3 ruang tur). Aman dijalankan ulang: konten asli Anda tidak dihapus.
// Pakai: node scripts/seed.js
const path = require('path');
const { createStore } = require('../lib/store');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const store = createStore(DATA_DIR, UPLOAD_DIR);
const before = store.load();
const keepProjects = before.projects.filter((p) => !p.demo);
const keepScenes = before.tour.scenes.filter((s) => !s.demo);
require('../lib/demo').seed(store, UPLOAD_DIR).then(() => {
  const c = store.load();
  if (keepProjects.length) store.setSection('projects', keepProjects.concat(c.projects));
  if (keepScenes.length) { const t = JSON.parse(JSON.stringify(c.tour)); t.scenes = keepScenes.concat(t.scenes); store.setSection('tour', t); }
  console.log('Konten contoh dibuat ulang.');
}).catch((e) => { console.error(e.message); process.exit(1); });
