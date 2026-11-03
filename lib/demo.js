'use strict';
// Konten contoh untuk pertama kali dijalankan, supaya situs tidak kosong.
// Semua gambar digambar otomatis (ilustrasi), BUKAN foto proyek asli, dan diberi label "contoh".
// Hapus lewat dashboard: Ringkasan > Hapus semua konten contoh.
const images = require('./images');

const palm = (x, y, h, d) => `<g stroke-linecap="round" fill="none"><path d="M${x} ${y} Q${x + d * 6} ${y - h * .55} ${x + d * 30} ${y - h}" stroke="#5a4231" stroke-width="12"/>` +
  [-3.5, -2.5, -1.5, -.5, .5, 1.5, 2.5, 3.5].map((i) => { const a = -Math.PI / 2 + i * .42, tx = x + d * 30, ty = y - h, L = 130; return `<path d="M${tx} ${ty} Q${tx + Math.cos(a) * L * .6} ${ty + Math.sin(a) * L * .6 - 22} ${tx + Math.cos(a) * L} ${ty + Math.sin(a) * L + 46}" stroke="#2a6a4b" stroke-width="9"/>`; }).join('') + '</g>';

function villa(o) {
  const W = 1600, H = 1100, gy = 800;
  const x0 = o.x0 || 300, bw = o.bw || 1000, fl = o.floors, fh = 215, top = gy - fl * fh;
  const cols = 5, cw = bw / (cols - 1);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.sky[0]}"/><stop offset="1" stop-color="${o.sky[1]}"/></linearGradient>
  <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.glass[0]}"/><stop offset="1" stop-color="${o.glass[1]}"/></linearGradient>
  <linearGradient id="wt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#58bcd4"/><stop offset="1" stop-color="#1b6f98"/></linearGradient>
  <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.ground[0]}"/><stop offset="1" stop-color="${o.ground[1]}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="${o.sun || 1180}" cy="${o.sunY || 300}" r="${o.dusk ? 110 : 70}" fill="${o.dusk ? '#ffd9a0' : '#fff4d6'}" opacity=".85"/>
  <path d="M0 ${gy - 80} Q300 ${gy - 190} 620 ${gy - 110} T1250 ${gy - 140} T1600 ${gy - 90} V${gy} H0Z" fill="${o.hill}" opacity=".9"/>
  <rect y="${gy}" width="${W}" height="${H - gy}" fill="url(#gr)"/>`;
  // bangunan
  for (let f = 0; f < fl; f++) {
    const y = gy - (f + 1) * fh;
    s += `<rect x="${x0}" y="${y}" width="${bw}" height="${fh}" fill="${o.wall}"/>`;
    if (o.stone && f === 0) s += `<rect x="${x0}" y="${y}" width="${cw}" height="${fh}" fill="${o.stone}"/><rect x="${x0 + bw - cw}" y="${y}" width="${cw}" height="${fh}" fill="${o.stone}"/>`;
    const gx = x0 + cw + 18, gw = bw - cw * 2 - 36;
    s += `<rect x="${gx}" y="${y + 22}" width="${gw}" height="${fh - 34}" fill="url(#gl)"/>`;
    if (o.dusk) s += `<rect x="${gx}" y="${y + 22 + (fh - 34) * .4}" width="${gw}" height="${(fh - 34) * .6}" fill="#ffc97a" opacity=".78"/>`;
    for (let k = 1; k < 4; k++) s += `<rect x="${gx + gw * k / 4 - 2}" y="${y + 22}" width="4" height="${fh - 34}" fill="#14233a"/>`;
    s += `<rect x="${gx}" y="${y + 22}" width="${gw}" height="${fh - 34}" fill="none" stroke="#14233a" stroke-width="4"/>`;
    s += `<rect x="${x0 - 30}" y="${y + fh - 10}" width="${bw + 60}" height="14" fill="#9aa4b0"/>`;
    for (let c = 0; c < cols; c++) s += `<rect x="${x0 + c * cw - 8}" y="${y}" width="16" height="${fh}" fill="#b7bfc9"/>`;
  }
  if (o.roof === 'hip') {
    s += `<polygon points="${x0 - 70},${top} ${x0 + bw + 70},${top} ${x0 + bw - 130},${top - 130} ${x0 + 130},${top - 130}" fill="${o.roofC}"/><rect x="${x0 - 70}" y="${top - 5}" width="${bw + 140}" height="8" fill="#C89B3C"/>`;
  } else {
    s += `<rect x="${x0 - 60}" y="${top - 28}" width="${bw + 120}" height="30" fill="${o.roofC}"/><rect x="${x0 - 60}" y="${top - 4}" width="${bw + 120}" height="6" fill="#C89B3C"/>`;
  }
  if (o.pool) s += `<rect x="${x0 - 80}" y="${gy + 40}" width="${bw + 160}" height="190" fill="#b8b09c"/><rect x="${x0 - 40}" y="${gy + 66}" width="${bw + 80}" height="138" fill="url(#wt)"/><rect x="${x0 - 40}" y="${gy + 66}" width="${bw + 80}" height="26" fill="#ffffff" opacity=".22"/>`;
  else s += `<rect x="${x0 - 60}" y="${gy}" width="${bw + 120}" height="22" fill="#a79f8c"/>`;
  s += palm(x0 - 150, gy + 20, 360, -1) + palm(x0 + bw + 170, gy + 20, 300, 1);
  if (o.dusk) s += `<rect width="${W}" height="${H}" fill="#12204a" opacity=".16"/>`;
  return s + '</svg>';
}

function floorSvg(o) {
  const W = 1600, H = 1100;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.wall[0]}"/><stop offset="1" stop-color="${o.wall[1]}"/></linearGradient>
  <linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.floor[0]}"/><stop offset="1" stop-color="${o.floor[1]}"/></linearGradient>
  <linearGradient id="rf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#wall)"/>
  ${[0, 1, 2, 3, 4].map((i) => `<rect x="${130 + i * 310}" y="90" width="190" height="26" rx="13" fill="#fff" opacity=".92"/><rect x="${130 + i * 310}" y="116" width="190" height="380" fill="url(#rf)" opacity=".28"/>`).join('')}
  <polygon points="0,560 ${W},560 ${W},${H} 0,${H}" fill="url(#fl)"/>
  <polygon points="0,560 ${W},560 ${W},700 0,700" fill="#fff" opacity=".1"/>
  ${[0, 1, 2, 3, 4].map((i) => `<polygon points="${210 + i * 310},560 ${240 + i * 310},560 ${150 + i * 330 - 120},${H} ${60 + i * 330 - 120},${H}" fill="#fff" opacity=".13"/>`).join('')}
  ${o.stripes ? [0, 1, 2, 3].map((i) => `<polygon points="${300 + i * 330},640 ${316 + i * 330},640 ${230 + i * 400},${H} ${190 + i * 400},${H}" fill="#e7c24a"/>`).join('') : ''}
  <rect y="548" width="${W}" height="14" fill="${o.trim || '#C89B3C'}"/></svg>`;
}

function roofSvg(o) {
  const W = 1600, H = 1100;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3e86bd"/><stop offset="1" stop-color="#f0cf9c"/></linearGradient>
  <linearGradient id="dk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.deck[0]}"/><stop offset="1" stop-color="${o.deck[1]}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <path d="M0 520 Q400 430 800 500 T1600 470 V640 H0Z" fill="#4b7f7e" opacity=".8"/>
  <polygon points="140,640 1460,640 1600,${H} 0,${H}" fill="url(#dk)"/>
  <polygon points="140,640 1460,640 1470,668 130,668" fill="#C89B3C"/>
  ${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${300 + i * 200}" y1="668" x2="${180 + i * 250}" y2="${H}" stroke="#000" opacity=".1" stroke-width="3"/>`).join('')}
  <ellipse cx="${o.drain || 560}" cy="840" rx="62" ry="22" fill="#2a3544"/><ellipse cx="${o.drain || 560}" cy="840" rx="46" ry="14" fill="#10161f"/>
  <rect x="0" y="560" width="${W}" height="80" fill="#e8ebee"/><rect y="560" width="${W}" height="10" fill="#C89B3C"/></svg>`;
}

function panoSvg(kind) {
  const W = 2048, H = 1024;
  const T = {
    tamu: { ceil: ['#4a3c2e', '#7c6a55'], wall: '#cdbfa6', wallB: '#b6a68a', floor: ['#d9cfbb', '#efe8d8'], label: 'Ruang Tamu' },
    teras: { ceil: ['#2f7fc0', '#bcd9ee'], wall: '#d8d2c4', wallB: '#bdb6a4', floor: ['#c9c0aa', '#b7ad94'], label: 'Teras dan Kolam' },
    dapur: { ceil: ['#3a2a22', '#5e4535'], wall: '#8d6a4c', wallB: '#74543b', floor: ['#cfc9bd', '#e6e1d6'], label: 'Dapur' },
  }[kind];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>
  <linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.ceil[0]}"/><stop offset="1" stop-color="${T.ceil[1]}"/></linearGradient>
  <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.floor[0]}"/><stop offset="1" stop-color="${T.floor[1]}"/></linearGradient>
  <radialGradient id="g"><stop offset="0" stop-color="#fff0c8" stop-opacity=".95"/><stop offset="1" stop-color="#fff0c8" stop-opacity="0"/></radialGradient>
  <linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cc0d8"/><stop offset="1" stop-color="#1b78a0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#c)"/>
  <rect y="330" width="${W}" height="250" fill="${T.wall}"/>`;
  // panel dinding vertikal
  for (let i = 0; i < 16; i++) s += `<rect x="${i * 128 + 2}" y="330" width="124" height="250" fill="${i % 2 ? T.wall : T.wallB}" opacity=".85"/>`;
  if (kind === 'teras') {
    s += `<rect y="330" width="${W}" height="190" fill="#bfe0ee"/><path d="M0 470 Q300 400 620 450 T1250 430 T2048 455 V520 H0Z" fill="#4c8a7c"/>`;
    for (let i = 0; i < 6; i++) s += palm(160 + i * 340, 520, 190 + (i % 3) * 40, i % 2 ? 1 : -1).replace(/stroke-width="12"/, 'stroke-width="9"');
  } else {
    for (let i = 0; i < 8; i++) { const x = 64 + i * 256; s += `<circle cx="${x + 64}" cy="360" r="120" fill="url(#g)"/><rect x="${x + 52}" y="338" width="24" height="12" rx="3" fill="#fff6d8"/>`; }
  }
  s += `<rect y="580" width="${W}" height="${H - 580}" fill="url(#f)"/><rect y="574" width="${W}" height="10" fill="#C89B3C" opacity=".85"/>`;
  if (kind === 'teras') s += `<rect x="300" y="650" width="1000" height="300" rx="10" fill="#b9b19a"/><rect x="340" y="680" width="920" height="240" fill="url(#w)"/><rect x="340" y="680" width="920" height="40" fill="#fff" opacity=".22"/>`;
  else {
    s += `<g fill="#a8957a"><rect x="360" y="650" width="320" height="110" rx="40"/><rect x="760" y="672" width="200" height="90" rx="40"/><rect x="1100" y="640" width="360" height="120" rx="44"/></g><g fill="#8a775e"><rect x="360" y="610" width="320" height="60" rx="26"/><rect x="1100" y="600" width="360" height="62" rx="26"/></g>`;
    s += `<ellipse cx="860" cy="790" rx="160" ry="22" fill="#fff" opacity=".6"/>`;
  }
  // pintu lengkung sebagai penanda menuju ruang lain
  const door = (cx, label) => `<g><rect x="${cx - 70}" y="400" width="140" height="190" rx="70" fill="#1f2b3c"/><rect x="${cx - 54}" y="420" width="108" height="170" rx="54" fill="#f3d9a4" opacity=".85"/></g>`;
  s += door(1536) + door(512) + door(1792);
  s += `<text x="1024" y="900" font-family="sans-serif" font-size="30" fill="#ffffff" opacity=".4" text-anchor="middle">Ilustrasi contoh: ganti dengan foto 360° asli dari dashboard</text>`;
  s += `<text x="${W / 2}" y="270" font-family="sans-serif" font-size="46" font-weight="500" fill="#ffffff" opacity=".7" text-anchor="middle">${T.label}</text>`;
  return s + '</svg>';
}

async function render(svg, w, h) {
  return images.sharp()(Buffer.from(svg)).resize(w, h).png().toBuffer();
}

async function seed(store, uploadDir) {
  if (!images.hasSharp()) throw new Error('modul sharp belum terpasang (jalankan: npm install)');
  const proj = async (svgs) => {
    const out = [];
    for (const svg of svgs) { const r = await images.save(await render(svg, 1600, 1100), 'project', uploadDir); out.push({ src: r.src, thumb: r.thumb }); }
    return out;
  };
  const V = (o) => villa(o);
  const day = { sky: ['#4f93c9', '#cfe3ef'], hill: '#6f9b8c', ground: ['#9c9578', '#7d7660'], glass: ['#9cc4dc', '#2d5678'], wall: '#e6e1d4', roofC: '#3b2f2b' };
  const dusk = { sky: ['#274a7a', '#f2b97c'], hill: '#3e5a6e', ground: ['#6a6350', '#4c4636'], glass: ['#6f93b3', '#1f3f5f'], wall: '#d9d2c3', roofC: '#2d2523', dusk: true, sun: 400, sunY: 520 };

  const projects = [];
  const add = (p) => projects.push({ id: store.uid(), demo: true, published: true, featured: false, description: '', ...p });

  let im = await proj([V({ ...day, floors: 2, pool: true, roof: 'flat', stone: '#8b7860' }), V({ ...dusk, floors: 2, pool: true, roof: 'flat', stone: '#8b7860', x0: 340, bw: 920 }), V({ ...day, floors: 2, pool: false, roof: 'flat', stone: '#8b7860', x0: 260, bw: 1080 })]);
  add({ title: 'Villa Tropis Canggu', category: 'Design & Build', location: 'Canggu, Badung', year: '2024', featured: true, cover: im[0].src, images: im, description: 'Contoh tampilan. Villa dua lantai dengan kolam pribadi. Ganti proyek ini dengan proyek asli Anda dari dashboard.' });
  im = await proj([V({ ...day, floors: 1, pool: false, roof: 'hip', roofC: '#4a3a32', x0: 380, bw: 840 }), V({ ...dusk, floors: 1, pool: false, roof: 'hip', roofC: '#4a3a32', x0: 380, bw: 840 })]);
  add({ title: 'Rumah Modern Sanur', category: 'Design & Build', location: 'Sanur, Denpasar', year: '2023', cover: im[0].src, images: im, description: 'Contoh tampilan. Rumah tinggal satu lantai beratap limasan.' });
  im = await proj([V({ ...day, floors: 2, pool: false, roof: 'flat', wall: '#cfd5dc', x0: 250, bw: 1100 }), V({ ...dusk, floors: 2, pool: false, roof: 'flat', wall: '#bcc3cc', x0: 250, bw: 1100 })]);
  add({ title: 'Ruko Dua Lantai Denpasar', category: 'Komersial', location: 'Denpasar', year: '2023', cover: im[0].src, images: im, description: 'Contoh tampilan. Bangunan usaha dua lantai.' });
  im = await proj([V({ ...day, floors: 2, pool: true, roof: 'hip', roofC: '#523f35', wall: '#efe9dc', x0: 330, bw: 940 })]);
  add({ title: 'Renovasi Villa Ubud', category: 'Renovasi', location: 'Ubud, Gianyar', year: '2022', cover: im[0].src, images: im, description: 'Contoh tampilan. Renovasi villa lama menjadi hunian modern.' });
  im = await proj([floorSvg({ wall: ['#dfe3e8', '#c3cad3'], floor: ['#5d6f86', '#2f3d52'], stripes: true }), floorSvg({ wall: ['#e8eaee', '#cfd3da'], floor: ['#8a9bb0', '#55657c'] })]);
  add({ title: 'Epoxy Flooring Showroom', category: 'Epoxy Flooring', location: 'Denpasar', year: '2024', cover: im[0].src, images: im, description: 'Contoh tampilan. Lantai epoxy untuk showroom dan area parkir.' });
  im = await proj([roofSvg({ deck: ['#8d98a6', '#5a6676'] }), roofSvg({ deck: ['#9aa4b0', '#657183'], drain: 980 })]);
  add({ title: 'Waterproofing Rooftop Seminyak', category: 'Waterproofing', location: 'Seminyak, Badung', year: '2023', cover: im[0].src, images: im, description: 'Contoh tampilan. Pelapisan kedap air untuk atap dak.' });

  // tur
  const pano = async (kind) => { const r = await images.save(await render(panoSvg(kind), 4096, 2048), 'pano', uploadDir); return r; };
  const [p1, p2, p3] = [await pano('tamu'), await pano('teras'), await pano('dapur')];
  const id = [store.uid(), store.uid(), store.uid()];
  const hs = (type, yaw, pitch, extra) => ({ id: store.uid(), type, yaw, pitch, ...extra });
  const tour = {
    enabled: true, title: 'Jelajahi hasil kerja kami',
    intro: 'Berkeliling di dalam proyek yang sudah selesai. Geser untuk melihat sekeliling, klik titik putih untuk berpindah ruang.',
    start: id[0],
    scenes: [
      { id: id[0], demo: true, title: 'Ruang Tamu (contoh)', pano: p1.src, thumb: p1.thumb, yaw: 0, pitch: 0, fov: 85, hotspots: [hs('scene', 90, -4, { target: id[1] }), hs('scene', -90, -4, { target: id[2] }), hs('info', -35, 8, { title: 'Contoh titik info', text: 'Titik seperti ini bisa menjelaskan material, ukuran, atau tahap pekerjaan. Atur dari dashboard, menu Tur 360°.' })] },
      { id: id[1], demo: true, title: 'Teras dan Kolam (contoh)', pano: p2.src, thumb: p2.thumb, yaw: 0, pitch: 0, fov: 85, hotspots: [hs('scene', -90, -4, { target: id[0] })] },
      { id: id[2], demo: true, title: 'Dapur (contoh)', pano: p3.src, thumb: p3.thumb, yaw: 0, pitch: 0, fov: 85, hotspots: [hs('scene', 90, -4, { target: id[0] })] },
    ],
  };
  store.setSection('projects', projects);
  store.setSection('tour', tour);
}

module.exports = { seed };
