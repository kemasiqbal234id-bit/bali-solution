'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ICONS = ['home', 'layers', 'drop', 'floor', 'tool', 'clipboard', 'building', 'shield'];
const SECTIONS = ['settings', 'hero', 'services', 'stats', 'testimonials', 'projects', 'tour'];

function uid() { return crypto.randomBytes(5).toString('hex'); }

function defaults() {
  return {
    settings: {
      name: 'Bali Solution Building',
      tagline: 'Building Dreams Into Reality',
      description: 'Kontraktor design & build di Bali: villa, rumah, bangunan komersial, renovasi, waterproofing dan epoxy flooring.',
      whatsapp: '6282147354396',
      email: '',
      address: 'Jl. Pulau Kawe No.90, Pedungan, Denpasar Selatan, Kota Denpasar, Bali 80222',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Bali+Solution+Building+Denpasar',
      instagram: '',
      hours: 'Senin–Sabtu, 08.00–17.00 WITA',
      ctaLabel: 'Konsultasi',
    },
    hero: {
      stages: [
        { title: 'Fondasi & Visi', text: 'Survei lahan, gambar kerja dan RAB yang rinci, sebelum satu sak semen pun dibuka.', image: null },
        { title: 'Struktur yang Kokoh', text: 'Beton bertulang dan rangka dikerjakan sesuai standar, siap menghadapi gempa dan iklim tropis Bali.', image: null },
        { title: 'Dinding, Atap, Kedap Air', text: 'Pasangan, atap dan waterproofing dikerjakan teliti supaya bangunan awet di musim hujan.', image: null },
        { title: 'Selamat Datang di Rumah Anda', text: 'Finishing rapi, serah terima dengan garansi, dan bangunan yang siap dihuni.', image: null },
      ],
    },
    services: [
      { id: uid(), icon: 'home', title: 'Design & Build', text: 'Dari konsep, gambar kerja sampai bangunan jadi, satu tim yang bertanggung jawab penuh.' },
      { id: uid(), icon: 'building', title: 'Villa, Rumah & Komersial', text: 'Pembangunan villa, rumah tinggal, ruko dan bangunan usaha dengan jadwal yang jelas.' },
      { id: uid(), icon: 'layers', title: 'Renovasi', text: 'Perbaikan dan penambahan ruang tanpa mengorbankan struktur yang sudah ada.' },
      { id: uid(), icon: 'drop', title: 'Waterproofing', text: 'Pelapisan kedap air untuk atap, kolam, kamar mandi dan basement.' },
      { id: uid(), icon: 'floor', title: 'Epoxy Flooring', text: 'Lantai epoxy tahan gores dan mudah dibersihkan untuk rumah, kafe dan gudang.' },
      { id: uid(), icon: 'clipboard', title: 'Manajemen Proyek', text: 'Pengawasan biaya, mutu dan waktu, dengan laporan progres berkala.' },
    ],
    stats: [],
    testimonials: [],
    projects: [],
    tour: { enabled: true, title: 'Jelajahi hasil kerja kami', intro: 'Berkeliling di dalam proyek yang sudah selesai. Geser untuk melihat sekeliling, klik titik putih untuk berpindah ruang.', start: null, scenes: [] },
  };
}

// ---------- sanitasi ----------
const str = (v, max = 200) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '');
const num = (v, min, max, def = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
const bool = (v) => v === true || v === 'true';

function makeSanitizer(uploadDir) {
  const img = (v) => {
    if (typeof v !== 'string' || !/^\/uploads\/[A-Za-z0-9._-]+$/.test(v)) return null;
    return fs.existsSync(path.join(uploadDir, path.basename(v))) ? v : null;
  };
  const url = (v) => { const s = str(v, 500); return /^https?:\/\/[^\s]+$/i.test(s) ? s : ''; };
  const id = (v) => (typeof v === 'string' && /^[a-f0-9]{6,16}$/.test(v) ? v : uid());
  const phone = (v) => { let d = str(v, 30).replace(/\D/g, ''); if (d.startsWith('0')) d = '62' + d.slice(1); return d; };
  const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

  return {
    settings(b) {
      const d = defaults().settings;
      return {
        name: str(b.name, 80) || d.name, tagline: str(b.tagline, 120), description: str(b.description, 300),
        whatsapp: phone(b.whatsapp) || d.whatsapp, email: str(b.email, 120), address: str(b.address, 250),
        mapsUrl: url(b.mapsUrl), instagram: str(b.instagram, 120), hours: str(b.hours, 120),
        ctaLabel: str(b.ctaLabel, 24) || d.ctaLabel,
      };
    },
    hero(b) {
      const d = defaults().hero.stages;
      const st = arr(b.stages, 4);
      return { stages: d.map((def, i) => ({ title: str(st[i] && st[i].title, 80) || def.title, text: str(st[i] && st[i].text, 260), image: img(st[i] && st[i].image) })) };
    },
    services(b) {
      return arr(b, 12).map((s) => ({ id: id(s.id), icon: ICONS.includes(s.icon) ? s.icon : 'tool', title: str(s.title, 60), text: str(s.text, 220) })).filter((s) => s.title);
    },
    stats(b) { return arr(b, 6).map((s) => ({ value: str(s.value, 14), label: str(s.label, 40) })).filter((s) => s.value && s.label); },
    testimonials(b) {
      return arr(b, 12).map((s) => ({ id: id(s.id), name: str(s.name, 60), role: str(s.role, 80), text: str(s.text, 400) })).filter((s) => s.name && s.text);
    },
    projects(b) {
      return arr(b, 300).map((p) => {
        const images = arr(p.images, 40).map((i) => ({ src: img(i && i.src), thumb: img(i && i.thumb) })).filter((i) => i.src).map((i) => ({ src: i.src, thumb: i.thumb || i.src }));
        let cover = img(p.cover);
        if (!images.some((i) => i.src === cover)) cover = images[0] ? images[0].src : null;
        return {
          id: id(p.id), title: str(p.title, 100) || 'Proyek tanpa judul', category: str(p.category, 40), location: str(p.location, 80),
          year: str(p.year, 4).replace(/\D/g, ''), description: str(p.description, 1200), cover, images,
          featured: bool(p.featured), demo: bool(p.demo), published: p.published === undefined ? true : bool(p.published),
        };
      });
    },
    tour(b) {
      const scenes = arr(b.scenes, 30).map((s) => ({ ...s, id: id(s.id) })).filter((s) => img(s.pano));
      const ids = new Set(scenes.map((s) => s.id));
      const out = scenes.map((s) => ({
        id: s.id, demo: bool(s.demo), title: str(s.title, 60) || 'Ruang', pano: img(s.pano), thumb: img(s.thumb) || img(s.pano),
        yaw: num(s.yaw, -180, 180), pitch: num(s.pitch, -80, 80), fov: num(s.fov, 50, 110, 85),
        hotspots: arr(s.hotspots, 30).map((h) => ({
          id: id(h.id), type: h.type === 'info' ? 'info' : 'scene', yaw: num(h.yaw, -180, 180), pitch: num(h.pitch, -85, 85),
          target: ids.has(h.target) && h.target !== s.id ? h.target : null, title: str(h.title, 80), text: str(h.text, 500), image: img(h.image),
        })).filter((h) => (h.type === 'scene' ? h.target : h.title || h.text)),
      }));
      return { enabled: bool(b.enabled), title: str(b.title, 100), intro: str(b.intro, 300), start: ids.has(b.start) ? b.start : (out[0] ? out[0].id : null), scenes: out };
    },
  };
}

// ---------- penyimpanan ----------
function createStore(dataDir, uploadDir) {
  const file = path.join(dataDir, 'content.json');
  const backupDir = path.join(dataDir, 'backups');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  const sanitizers = makeSanitizer(uploadDir);
  let cache = null;
  let lastBackup = 0;

  function load() {
    if (cache) return cache;
    let raw = null;
    try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { /* file belum ada */ }
    const d = defaults();
    cache = raw ? { ...d, ...raw, settings: { ...d.settings, ...raw.settings }, hero: raw.hero || d.hero, tour: { ...d.tour, ...(raw.tour || {}) } } : d;
    cache.isFresh = !raw;
    return cache;
  }
  function persist() {
    const { isFresh, ...clean } = cache;
    if (fs.existsSync(file) && Date.now() - lastBackup > 10 * 60 * 1000) {
      fs.mkdirSync(backupDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
      fs.copyFileSync(file, path.join(backupDir, `content-${stamp}.json`));
      lastBackup = Date.now();
      const old = fs.readdirSync(backupDir).sort().slice(0, -30);
      old.forEach((f) => fs.unlinkSync(path.join(backupDir, f)));
    }
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(clean, null, 2));
    fs.renameSync(tmp, file);
    cache.isFresh = false;
  }
  function setSection(name, body) {
    if (!SECTIONS.includes(name)) throw new Error('Bagian tidak dikenal');
    const data = load();
    data[name] = sanitizers[name](body);
    persist();
    return data[name];
  }
  function replaceAll(content) { cache = content; persist(); }

  function referencedFiles() {
    const c = load(); const set = new Set();
    const add = (v) => { if (typeof v === 'string' && v.startsWith('/uploads/')) set.add(path.basename(v)); };
    c.hero.stages.forEach((s) => add(s.image));
    c.projects.forEach((p) => { add(p.cover); p.images.forEach((i) => { add(i.src); add(i.thumb); }); });
    c.tour.scenes.forEach((s) => { add(s.pano); add(s.thumb); s.hotspots.forEach((h) => add(h.image)); });
    return set;
  }
  // Hapus file upload yang tidak dipakai lagi (dan sudah lebih dari 20 menit, supaya upload yang belum disimpan aman).
  function gc() {
    const used = referencedFiles(); let removed = 0;
    for (const f of fs.readdirSync(uploadDir)) {
      if (used.has(f) || f.startsWith('.')) continue;
      const p = path.join(uploadDir, f);
      try { if (Date.now() - fs.statSync(p).mtimeMs > 20 * 60 * 1000) { fs.unlinkSync(p); removed++; } } catch (_) {}
    }
    return removed;
  }
  return { load, setSection, replaceAll, gc, sanitizers, uid, SECTIONS };
}

module.exports = { createStore, defaults, uid };
