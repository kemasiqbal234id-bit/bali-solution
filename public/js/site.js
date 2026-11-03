/* Bali Solution Building: perilaku situs publik.
 * Data (teks, foto, proyek, tur) datang dari #boot (diisi server dari data/content.json).
 * Ubah konten lewat /admin, bukan di file ini. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var C;
  try { C = JSON.parse($('#boot').textContent); } catch (e) { C = null; }
  if (!C) return;
  var S = C.settings;

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'text') n.textContent = attrs[k]; else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]); }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  var NS = 'http://www.w3.org/2000/svg';
  var ICONS = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    layers: 'M12 3l9 5-9 5-9-5 9-5zM3 12.500l9 5 9-5M3 16.500l9 5 9-5',
    drop: 'M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z',
    floor: 'M3 20L8 8h8l5 12H3zM6 14h12M11 8L9 20M13 8l2 12',
    tool: 'M14.700 6.300a4 4 0 0 0-5.400 5.200L3 17.800 6.200 21l6.300-6.300a4 4 0 0 0 5.200-5.400l-2.600 2.600-2.300-.5-.5-2.300z',
    clipboard: 'M9 4h6v3H9zM9 5.500H6V21h12V5.500h-3M9 12h6M9 16h6',
    building: 'M5 21V4h9v17M14 9h5v12M8 8h3M8 12h3M8 16h3M3 21h18',
    shield: 'M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z'
  };
  function icon(name) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.3'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(NS, 'path'); p.setAttribute('d', ICONS[name] || ICONS.tool); s.appendChild(p);
    return s;
  }

  /* ---------- WhatsApp ---------- */
  function waLink(text) { return 'https://wa.me/' + S.whatsapp + '?text=' + encodeURIComponent(text); }
  var greet = 'Halo ' + S.name + ', saya ingin berkonsultasi tentang rencana bangunan.';
  $('#ctaTop').textContent = S.ctaLabel || 'Konsultasi';
  $('#ctaTop').href = waLink(greet); $('#ctaTop').target = '_blank';
  $('#waFloat').href = waLink(greet); $('#waFloat').target = '_blank';
  $('#brandName').textContent = S.name;
  $('#footName').textContent = '© ' + new Date().getFullYear() + ' ' + S.name;
  $('#footAddr').textContent = S.address;
  $('#heroTitle').textContent = S.tagline || S.name;
  $('#heroLead').textContent = 'Kontraktor design & build di Bali. Gulir untuk melihat bangunan dibangun dari fondasi.';

  /* ---------- menu mobile & nav ---------- */
  var nav = $('#nav'), menu = $('#menu'), tgl = $('#navToggle');
  tgl.addEventListener('click', function () {
    var o = menu.classList.toggle('open'); tgl.setAttribute('aria-expanded', o); tgl.setAttribute('aria-label', o ? 'Tutup menu' : 'Buka menu');
  });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) { menu.classList.remove('open'); tgl.setAttribute('aria-expanded', 'false'); } });

  /* =====================================================================
   *  HERO: gedung dibangun mengikuti scroll
   *  - Tanpa foto: digambar langsung di canvas (0 KB aset).
   *  - Dengan foto 4 tahap dari dashboard: foto bergantian halus mengikuti scroll.
   * ===================================================================== */
  var hero = $('#hero'), canvas = $('#heroCanvas'), ctx = canvas.getContext('2d');
  var stages = C.hero.stages;
  var stageImgs = stages.map(function (s) { return s.image ? loadImg(s.image) : null; });
  var useImages = stageImgs.some(Boolean);
  function loadImg(src) { var i = new Image(); i.decoding = 'async'; i.src = src; return i; }
  var W = 0, H = 0, DPR = 1, cur = 0, target = 0, running = false, stageIdx = -1;

  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    requestDraw();
  }
  var ease = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var mix = function (a, b, t) { return a + (b - a) * t; };
  var mixc = function (a, b, t, al) { return 'rgba(' + (mix(a[0], b[0], t) | 0) + ',' + (mix(a[1], b[1], t) | 0) + ',' + (mix(a[2], b[2], t) | 0) + ',' + (al === undefined ? 1 : al) + ')'; };

  function drawScene(p) {
    var wide = W > 900;
    var groundY = H * (wide ? .8 : .7), cx = wide ? W * .64 : W * .5;
    var s = Math.min((wide ? W * .58 : W * .94) / 760, groundY * .86 / 580);
    var sk = seg(p, .05, .95);
    // langit
    var g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, mixc([9, 22, 44], [40, 96, 150], sk));
    g.addColorStop(.7, mixc([20, 44, 78], [150, 172, 194], sk));
    g.addColorStop(1, mixc([34, 62, 98], [244, 200, 138], sk));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY + 2);
    var glow = ctx.createRadialGradient(cx, groundY - 30 * s, 0, cx, groundY - 30 * s, 560 * s);
    glow.addColorStop(0, 'rgba(255,214,150,' + (.6 * sk).toFixed(3) + ')'); glow.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, groundY);
    // punggung bukit
    function ridge(base, amp, col, seed) {
      ctx.beginPath(); ctx.moveTo(0, groundY);
      for (var x = 0; x <= W; x += 12) ctx.lineTo(x, groundY - base - amp * Math.sin(x * .0042 + seed) - amp * .5 * Math.sin(x * .0111 + seed * 2.3));
      ctx.lineTo(W, groundY); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    }
    ridge(70 * s, 34 * s, mixc([18, 36, 64], [96, 128, 148], sk), 1.2);
    ridge(34 * s, 22 * s, mixc([14, 30, 54], [58, 92, 90], sk), 4.1);
    // tanah
    var gg = ctx.createLinearGradient(0, groundY, 0, H);
    gg.addColorStop(0, mixc([30, 46, 72], [136, 118, 92], sk)); gg.addColorStop(1, mixc([14, 26, 46], [84, 72, 58], sk));
    ctx.fillStyle = gg; ctx.fillRect(0, groundY, W, H - groundY);

    ctx.save(); ctx.translate(cx, groundY); ctx.scale(s, s);
    var cols = [-310, -155, 0, 155, 310], CW = 14, FH = 190, SL = 16;
    var concrete = 'rgb(150,160,174)', concreteDark = 'rgb(104,114,130)';

    // bayangan garis bangunan jadi: petunjuk awal, memudar saat struktur naik
    var gh = (1 - seg(p, .06, .5)) * .5;
    if (gh > 0) {
      ctx.globalAlpha = gh; ctx.strokeStyle = '#E2BC6B'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 8]);
      ctx.strokeRect(-330, -(2 * FH + 3 * SL), 660, 2 * FH + 3 * SL);
      ctx.beginPath(); ctx.moveTo(-405, -(2 * FH + 3 * SL)); ctx.lineTo(-240, -(2 * FH + 3 * SL) - 98); ctx.lineTo(240, -(2 * FH + 3 * SL) - 98); ctx.lineTo(405, -(2 * FH + 3 * SL)); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    // garis patok (bowplank)
    var a0 = 1 - seg(p, .14, .3);
    if (a0 > 0) {
      ctx.globalAlpha = a0; ctx.strokeStyle = '#C89B3C'; ctx.lineWidth = 1.6; ctx.setLineDash([8, 7]);
      ctx.beginPath(); ctx.moveTo(-390, 6); ctx.lineTo(390, 6); ctx.stroke(); ctx.setLineDash([]);
      cols.concat([-380, 380]).forEach(function (x) { ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, -22); ctx.stroke(); });
      ctx.globalAlpha = 1;
    }
    // tapak pondasi
    var f1 = ease(seg(p, .02, .13));
    if (f1 > 0) cols.forEach(function (x) { ctx.fillStyle = 'rgb(46,54,68)'; ctx.fillRect(x - 28, 0, 56, 30 * f1); ctx.fillStyle = concreteDark; ctx.fillRect(x - 22, 0, 44, 22 * f1); });
    // pelat lantai dasar
    var f2 = ease(seg(p, .1, .21));
    if (f2 > 0) { ctx.fillStyle = concrete; ctx.fillRect(-340, -SL * f2, 680, SL * f2); }

    // crane
    var cr = seg(p, 0, .08) * (1 - seg(p, .76, .88));
    if (cr > 0) {
      ctx.globalAlpha = cr; ctx.strokeStyle = '#C89B3C'; ctx.fillStyle = '#C89B3C'; ctx.lineWidth = 2.2;
      var mx = -430, top = -585;
      ctx.beginPath(); ctx.moveTo(mx - 12, 0); ctx.lineTo(mx - 12, top); ctx.moveTo(mx + 12, 0); ctx.lineTo(mx + 12, top); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.beginPath();
      for (var y = 0; y > top; y -= 44) { ctx.moveTo(mx - 12, y); ctx.lineTo(mx + 12, y - 44); ctx.moveTo(mx + 12, y); ctx.lineTo(mx - 12, y - 44); }
      ctx.stroke();
      ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(mx - 130, top); ctx.lineTo(mx + 330, top); ctx.moveTo(mx - 130, top - 0); ctx.lineTo(mx, top - 56); ctx.lineTo(mx + 330, top); ctx.stroke();
      ctx.fillRect(mx - 150, top - 4, 34, 22); ctx.fillRect(mx - 18, top - 70, 36, 16);
      var hx = mx + 120 + 130 * Math.sin(p * 8), hy = top + 120 + 240 * (.5 + .5 * Math.sin(p * 11));
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hx, top); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillRect(hx - 14, hy, 28, 10);
      ctx.globalAlpha = 1;
    }

    // kolom
    cols.forEach(function (x, i) {
      var k = ease(seg(p, .2 + i * .012, .46));
      if (k <= 0) return;
      var hh = (2 * FH + 2 * SL + SL) * k;
      ctx.fillStyle = concrete; ctx.fillRect(x - CW / 2, -SL - hh, CW, hh);
      ctx.fillStyle = concreteDark; ctx.fillRect(x + CW / 2 - 3, -SL - hh, 3, hh);
      var rb = 1 - seg(p, .46, .52);
      if (rb > 0 && k < 1) { ctx.strokeStyle = 'rgba(200,155,60,' + (.9 * rb) + ')'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - 4, -SL - hh); ctx.lineTo(x - 4, -SL - hh - 30); ctx.moveTo(x + 4, -SL - hh); ctx.lineTo(x + 4, -SL - hh - 30); ctx.stroke(); }
    });
    // pelat lantai 2 dan atap beton
    function slab(yTop, k) { if (k <= 0) return; var w = 700 * k; ctx.fillStyle = concrete; ctx.fillRect(-w / 2, yTop, w, SL); ctx.fillStyle = concreteDark; ctx.fillRect(-w / 2, yTop + SL - 4, w, 4); }
    var yS1 = -(SL + FH + SL), yS2 = -(SL + FH + SL + FH + SL);
    slab(yS1, ease(seg(p, .3, .4))); slab(yS2, ease(seg(p, .42, .5)));

    // dinding
    function bay(b, f, k, kind) {
      if (k <= 0) return;
      var x0 = cols[b] + CW / 2, x1 = cols[b + 1] - CW / 2, yb = f === 0 ? -SL : -(SL + FH + SL), hh = FH * k;
      ctx.fillStyle = kind === 'stone' ? 'rgb(122,106,86)' : 'rgb(228,223,212)'; ctx.fillRect(x0, yb - hh, x1 - x0, hh);
      if (kind === 'stone') { ctx.strokeStyle = 'rgba(60,48,36,.45)'; ctx.lineWidth = 1; ctx.beginPath(); for (var y = yb - 14; y > yb - hh; y -= 14) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); } ctx.stroke(); }
      else { ctx.fillStyle = 'rgba(14,34,64,.06)'; ctx.fillRect(x0, yb - hh, 6, hh); }
    }
    for (var b = 0; b < 4; b++) {
      bay(b, 0, ease(seg(p, .5 + b * .015, .6 + b * .015)), (b === 0 || b === 3) ? 'stone' : 'plain');
      bay(b, 1, ease(seg(p, .58 + b * .015, .68 + b * .015)), 'plain');
    }

    // atap
    var rk = ease(seg(p, .62, .78));
    if (rk > 0) {
      var rh = 98 * rk, yb = yS2;
      ctx.beginPath(); ctx.moveTo(-405, yb); ctx.lineTo(405, yb); ctx.lineTo(240 + (405 - 240) * (1 - rk), yb - rh); ctx.lineTo(-240 - (405 - 240) * (1 - rk), yb - rh); ctx.closePath();
      var rg = ctx.createLinearGradient(0, yb - rh, 0, yb); rg.addColorStop(0, 'rgb(86,66,56)'); rg.addColorStop(1, 'rgb(48,38,36)');
      ctx.fillStyle = rg; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.beginPath(); for (var i = 1; i < 6; i++) { var yy = yb - rh * i / 6; ctx.moveTo(-405 + 165 * (i / 6) * (rk), yy); ctx.lineTo(405 - 165 * (i / 6) * (rk), yy); } ctx.stroke();
      ctx.fillStyle = '#C89B3C'; ctx.fillRect(-405, yb - 4, 810, 4);
    }

    // perancah: tampil saat struktur naik, hilang saat selesai
    var sc = seg(p, .18, .28) * (1 - seg(p, .78, .9));
    if (sc > 0) {
      var sh = 440 * ease(seg(p, .2, .56));
      ctx.globalAlpha = .55 * sc; ctx.strokeStyle = '#E2BC6B'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      [-352, 352].forEach(function (x) { ctx.moveTo(x, 0); ctx.lineTo(x, -sh); for (var y = 0; y < sh; y += 62) { ctx.moveTo(x - 18, -y); ctx.lineTo(x + 18, -y); ctx.moveTo(x - 18, -y); ctx.lineTo(x + 18, -Math.min(sh, y + 62)); } });
      for (var y2 = 0; y2 <= sh; y2 += 62) { ctx.moveTo(-352, -y2); ctx.lineTo(352, -y2); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }

    // kaca dan lampu
    var gl = ease(seg(p, .78, .9));
    if (gl > 0) {
      ctx.globalAlpha = gl;
      var lit = ease(seg(p, .88, 1));
      function glass(x0, y0, w, hh) {
        var gr = ctx.createLinearGradient(0, y0, 0, y0 + hh);
        gr.addColorStop(0, mixc([120, 168, 205], [220, 190, 140], sk * .4)); gr.addColorStop(1, 'rgb(34,66,100)');
        ctx.fillStyle = gr; ctx.fillRect(x0, y0, w, hh);
        ctx.fillStyle = 'rgba(255,206,120,' + (.7 * lit).toFixed(3) + ')'; ctx.fillRect(x0, y0 + hh * .45, w, hh * .55);
        ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.moveTo(x0 + w * .2, y0); ctx.lineTo(x0 + w * .55, y0); ctx.lineTo(x0 + w * .15, y0 + hh); ctx.lineTo(x0 - w * .2, y0 + hh); ctx.closePath(); ctx.save(); ctx.clip(); ctx.fill(); ctx.restore();
        ctx.strokeStyle = 'rgb(20,34,56)'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, w, hh); ctx.beginPath(); ctx.moveTo(x0 + w / 2, y0); ctx.lineTo(x0 + w / 2, y0 + hh); ctx.stroke();
      }
      [1, 2].forEach(function (b) {
        var x0 = cols[b] + CW / 2 + 6, w = cols[b + 1] - cols[b] - CW - 12;
        glass(x0, -(SL + FH) + 8, w, FH - 12); glass(x0, -(SL + FH + SL + FH) + 8, w, FH - 14);
      });
      [0, 3].forEach(function (b) { var x0 = cols[b] + CW / 2 + 28, w = cols[b + 1] - cols[b] - CW - 56; glass(x0, -(SL + FH + SL + FH) + 36, w, 110); });
      ctx.globalAlpha = 1;
    }
    // list emas
    var tr = ease(seg(p, .86, .98));
    if (tr > 0) { ctx.fillStyle = '#C89B3C'; var w3 = 700 * tr; ctx.fillRect(-w3 / 2, yS1 - 3, w3, 3); ctx.fillRect(-w3 / 2, yS2 - 3, w3, 3); }
    // kolam renang di depan
    var pl = ease(seg(p, .84, .97));
    if (pl > 0) {
      ctx.globalAlpha = pl;
      ctx.fillStyle = 'rgb(176,168,150)'; ctx.fillRect(-300, 14, 600, 70);
      var wg = ctx.createLinearGradient(0, 26, 0, 74); wg.addColorStop(0, 'rgb(72,176,200)'); wg.addColorStop(1, 'rgb(22,98,138)');
      ctx.fillStyle = wg; ctx.fillRect(-270, 28, 540, 44);
      ctx.fillStyle = 'rgba(255,214,150,' + (.35 * sk) + ')'; ctx.fillRect(-270, 28, 540, 10);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (var q = -240; q < 260; q += 70) { ctx.moveTo(q, 44); ctx.lineTo(q + 34, 44); ctx.moveTo(q + 20, 58); ctx.lineTo(q + 52, 58); } ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // pohon kelapa
    function palm(x, ht, dir, k) {
      if (k <= 0) return;
      var tx = x + dir * 26 * k, ty = -ht * k;
      ctx.strokeStyle = 'rgb(86,64,46)'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + dir * 4, ty * .55, tx, ty); ctx.stroke();
      ctx.strokeStyle = 'rgb(38,98,70)'; ctx.lineWidth = 4.5;
      for (var i = 0; i < 8; i++) { var an = (-Math.PI / 2) + (i - 3.5) * .42; var L = 74 * k; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(an) * L * .6, ty + Math.sin(an) * L * .6 - 14 * k, tx + Math.cos(an) * L, ty + Math.sin(an) * L + 30 * k); ctx.stroke(); }
      ctx.lineCap = 'butt';
    }
    palm(-410, 270, -1, ease(seg(p, .8, .98))); palm(430, 230, 1, ease(seg(p, .82, 1)));
    ctx.restore();
  }

  function drawImages(p) {
    var f = p * 4, i = Math.min(3, Math.floor(f)), fr = f - i;
    function pick(n) { for (var k = n; k >= 0; k--) if (stageImgs[k]) return stageImgs[k]; for (k = n + 1; k < 4; k++) if (stageImgs[k]) return stageImgs[k]; return null; }
    function cover(img, a, zoom) {
      if (!img || !img.complete || !img.naturalWidth) return;
      var sc = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom, dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
      ctx.globalAlpha = a; ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
    ctx.fillStyle = '#081528'; ctx.fillRect(0, 0, W, H);
    cover(pick(i), 1, 1 + .06 * fr);
    if (i < 3) cover(pick(i + 1), ease(seg(fr, .62, 1)), 1.0 + .0 * fr);
    ctx.globalAlpha = 1;
  }

  var drawQueued = false;
  function requestDraw() { if (!drawQueued) { drawQueued = true; requestAnimationFrame(frame); } }
  function frame() {
    drawQueued = false;
    cur = reduce ? target : cur + (target - cur) * .14;
    if (Math.abs(target - cur) < .0004) cur = target;
    if (useImages) drawImages(cur); else drawScene(cur);
    if (cur !== target) requestDraw();
  }

  var introEl = $('#heroIntro'), stageEl = $('#heroStage'), rail = $('#railFill'), railLabel = $('#railLabel'), hint = $('#scrollHint');
  function updateUI() {
    var r = hero.getBoundingClientRect(), max = Math.max(1, hero.offsetHeight - window.innerHeight);
    var p = clamp(-r.top / max, 0, 1);
    target = p;
    var idx = Math.min(3, Math.floor(p * 4));
    if (idx !== stageIdx) {
      stageIdx = idx;
      $('#stageTitle').textContent = stages[idx].title; $('#stageText').textContent = stages[idx].text;
      stageEl.classList.remove('swap'); void stageEl.offsetWidth; stageEl.classList.add('swap');
    }
    var intro = 1 - clamp(p / .06, 0, 1);
    introEl.style.opacity = intro; introEl.style.transform = 'translateY(' + (-58 - (1 - intro) * 10) + '%)';
    if (window.innerWidth <= 760) introEl.style.transform = 'translateY(' + (-(1 - intro) * 24) + 'px)';
    stageEl.style.opacity = clamp((p - .05) / .05, 0, 1);
    rail.style.transform = 'scaleX(' + p.toFixed(3) + ')'; railLabel.textContent = 'Tahap ' + (idx + 1) + ' dari 4';
    hint.style.opacity = p > .02 ? 0 : 1;
    nav.classList.toggle('solid', r.bottom < window.innerHeight * .9 || window.scrollY > 60 && p > .98);
    requestDraw();
  }
  window.addEventListener('scroll', updateUI, { passive: true });
  window.addEventListener('resize', function () { size(); updateUI(); });
  size(); updateUI();
  if (useImages) stageImgs.forEach(function (im) { if (im) im.onload = requestDraw; });

  /* ---------- layanan & angka ---------- */
  var sv = $('#services');
  C.services.forEach(function (x) { sv.appendChild(h('li', null, [icon(x.icon), h('div', null, [h('h3', { text: x.title }), h('p', { text: x.text })])])); });
  var st = $('#stats');
  C.stats.forEach(function (x) { st.appendChild(h('div', null, [h('dt', { text: x.value }), h('dd', { text: x.label })])); });
  if (!C.stats.length) st.hidden = true;
  var jenis = $('#jenis');
  C.services.forEach(function (x) { jenis.appendChild(h('option', { value: x.title, text: x.title })); });
  jenis.appendChild(h('option', { value: 'Lainnya', text: 'Lainnya' }));

  /* ---------- proyek ---------- */
  var PAGE = 9, shown = PAGE, filter = '';
  var list = C.projects;
  var grid = $('#projects'), moreBtn = $('#moreBtn'), filtersEl = $('#filters');
  function thumbOf(p) {
    var im = p.images.filter(function (i) { return i.src === p.cover; })[0];
    return im ? im.thumb : p.cover;
  }
  function renderProjects() {
    var items = list.filter(function (p) { return !filter || p.category === filter; });
    grid.textContent = '';
    items.slice(0, shown).forEach(function (p) {
      var meta = [p.location, p.year].filter(Boolean).join(', ');
      var b = h('button', { class: 'card' + (p.featured ? ' wide' : ''), type: 'button', 'aria-label': 'Lihat proyek ' + p.title }, [
        p.cover ? h('img', { src: thumbOf(p), alt: p.title, loading: 'lazy', decoding: 'async' }) : null,
        p.demo ? h('span', { class: 'badge', text: 'Contoh tampilan' }) : null,
        h('div', { class: 'card-cap' }, [h('strong', { text: p.title }), meta ? h('span', { text: meta }) : null])
      ]);
      b.addEventListener('click', function () { openLightbox(p); });
      grid.appendChild(b);
    });
    moreBtn.hidden = items.length <= shown;
    $('#projectsEmpty').hidden = items.length > 0;
  }
  var cats = []; list.forEach(function (p) { if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); });
  if (cats.length > 1) {
    ['Semua'].concat(cats).forEach(function (c, i) {
      var b = h('button', { class: 'chip', type: 'button', 'aria-pressed': i === 0 ? 'true' : 'false', text: c });
      b.addEventListener('click', function () {
        filter = i === 0 ? '' : c; shown = PAGE;
        Array.prototype.forEach.call(filtersEl.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        renderProjects();
      });
      filtersEl.appendChild(b);
    });
  }
  moreBtn.addEventListener('click', function () { shown += PAGE; renderProjects(); });
  renderProjects();

  /* lightbox */
  var lb = $('#lightbox'), lbImg = $('#lbImg'), lbIdx = 0, lbProj = null;
  function lbShow(i) {
    var ims = lbProj.images; if (!ims.length) return;
    lbIdx = (i + ims.length) % ims.length; lbImg.src = ims[lbIdx].src; lbImg.alt = lbProj.title + ', foto ' + (lbIdx + 1);
    Array.prototype.forEach.call($('#lbThumbs').children, function (b, k) { b.setAttribute('aria-current', k === lbIdx ? 'true' : 'false'); });
    var nx = new Image(); nx.src = ims[(lbIdx + 1) % ims.length].src;
  }
  function openLightbox(p) {
    lbProj = p;
    $('#lbTitle').textContent = p.title;
    $('#lbMeta').textContent = [p.category, p.location, p.year].filter(Boolean).join(', ');
    $('#lbDesc').textContent = p.description;
    var th = $('#lbThumbs'); th.textContent = '';
    p.images.forEach(function (im, i) { var b = h('button', { type: 'button', 'aria-label': 'Foto ' + (i + 1) }, [h('img', { src: im.thumb, alt: '' })]); b.addEventListener('click', function () { lbShow(i); }); th.appendChild(b); });
    var multi = p.images.length > 1; $('#lbPrev').hidden = $('#lbNext').hidden = !multi; th.hidden = !multi;
    lbShow(Math.max(0, p.images.findIndex(function (i) { return i.src === p.cover; })));
    if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
  }
  $('#lbClose').addEventListener('click', function () { lb.close(); });
  $('#lbPrev').addEventListener('click', function () { lbShow(lbIdx - 1); });
  $('#lbNext').addEventListener('click', function () { lbShow(lbIdx + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') lbShow(lbIdx - 1); else if (e.key === 'ArrowRight') lbShow(lbIdx + 1); });
  lb.addEventListener('close', function () { lbImg.removeAttribute('src'); });

  /* ---------- tur 360 ---------- */
  var T = C.tour;
  if (T && T.enabled && T.scenes.length) {
    $('#tur').hidden = false; $('#navTour').hidden = false;
    $('#turH').textContent = T.title || 'Tur 360°'; $('#turIntro').textContent = T.intro || '';
    var byId = {}; T.scenes.forEach(function (s) { byId[s.id] = s; });
    var rooms = $('#tourRooms'), roomBtns = {};
    T.scenes.forEach(function (s) {
      var b = h('button', { class: 'room', type: 'button', 'aria-current': 'false' }, [h('img', { src: s.thumb, alt: '', loading: 'lazy' }), h('span', { text: s.title })]);
      b.addEventListener('click', function () { go(s.id); }); rooms.appendChild(b); roomBtns[s.id] = b;
    });
    if (T.scenes.length < 2) rooms.hidden = true;
    var viewer = null, curScene = null, started = false;
    var info = $('#tourInfo');
    function showInfo(hs) {
      info.textContent = '';
      var close = h('button', { type: 'button', 'aria-label': 'Tutup', text: '×' }); close.addEventListener('click', function () { info.hidden = true; });
      info.appendChild(close);
      if (hs.title) info.appendChild(h('h3', { text: hs.title }));
      if (hs.text) info.appendChild(h('p', { text: hs.text }));
      if (hs.image) info.appendChild(h('img', { src: hs.image, alt: hs.title || '' }));
      info.hidden = false;
    }
    function hotspotsFor(scene) {
      return scene.hotspots.map(function (hs) {
        var tgt = hs.type === 'scene' ? byId[hs.target] : null;
        var label = hs.type === 'scene' ? (tgt ? tgt.title : 'Pindah ruang') : (hs.title || 'Info');
        var el = h('button', { class: 'hs ' + (hs.type === 'info' ? 'hs-info' : 'hs-scene'), type: 'button', 'aria-label': (hs.type === 'scene' ? 'Pergi ke ' : 'Info: ') + label }, [
          h('span', { class: 'hs-dot', text: hs.type === 'info' ? 'i' : '' }), h('span', { class: 'hs-label', text: label })]);
        el.addEventListener('click', function (e) { e.stopPropagation(); if (hs.type === 'scene') go(hs.target); else showInfo(hs); });
        return { yaw: hs.yaw, pitch: hs.pitch, el: el };
      });
    }
    function mark(id) { Object.keys(roomBtns).forEach(function (k) { roomBtns[k].setAttribute('aria-current', k === id ? 'true' : 'false'); }); $('#tourTitle').textContent = byId[id].title; }
    function go(id) {
      var s = byId[id]; if (!s || !viewer || id === curScene) return;
      info.hidden = true; curScene = id; mark(id);
      viewer.setHotspots([]);
      viewer.goTo(s.pano, { yaw: s.yaw, pitch: s.pitch, fov: s.fov }).then(function () { if (curScene === id) viewer.setHotspots(hotspotsFor(s)); }).catch(function () { });
    }
    function startTour() {
      if (started) return; started = true;
      var box = $('#tourView');
      if (!(window.BSBPano && BSBPano.supported())) { box.appendChild(h('div', { class: 'tour-fallback', text: 'Browser ini belum mendukung tur 360°. Coba buka lewat Chrome, Safari, atau Firefox terbaru.' })); return; }
      var first = byId[T.start] || T.scenes[0];
      try { viewer = new BSBPano(box, { autorotate: !reduce }); } catch (e) { box.appendChild(h('div', { class: 'tour-fallback', text: 'Tur 360° tidak bisa dimuat di perangkat ini.' })); return; }
      curScene = first.id; mark(first.id);
      viewer.load(first.pano, { yaw: first.yaw, pitch: first.pitch, fov: first.fov }).then(function () { viewer.setHotspots(hotspotsFor(first)); }).catch(function () { box.appendChild(h('div', { class: 'tour-fallback', text: 'Foto panorama gagal dimuat.' })); });
      box.addEventListener('pointerdown', function () { $('#tourHint').classList.add('gone'); info.hidden = true; }, { once: false });
      box.addEventListener('wheel', function () { $('#tourHint').classList.add('gone'); }, { passive: true });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        en.forEach(function (e) { if (e.isIntersecting) startTour(); if (viewer && !reduce) viewer.autorotate = viewer.autorotate && e.isIntersecting; });
      }, { rootMargin: '300px 0px' }).observe($('#tourStage'));
    } else startTour();
    $('#tourFs').addEventListener('click', function () {
      var st = $('#tourStage');
      if (document.fullscreenElement) document.exitFullscreen(); else if (st.requestFullscreen) st.requestFullscreen(); else if (st.webkitRequestFullscreen) st.webkitRequestFullscreen();
    });
    if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) $('#tourFs').hidden = true;
  }

  /* ---------- testimoni ---------- */
  if (C.testimonials.length) {
    $('#testimoni').hidden = false;
    C.testimonials.forEach(function (t) {
      $('#quotes').appendChild(h('blockquote', null, [h('p', { text: '“' + t.text + '”' }), h('footer', null, [h('strong', { text: t.name }), t.role ? ' ' + t.role : ''])]));
    });
  }

  /* ---------- kontak ---------- */
  var ci = $('#contactInfo');
  function row(label, node) { ci.appendChild(h('div', null, [h('b', { text: label }), node])); }
  if (S.address) { var ad = h('span', { text: S.address }); row('Kantor', ad); if (S.mapsUrl) { ci.lastChild.appendChild(document.createElement('br')); ci.lastChild.appendChild(h('a', { href: S.mapsUrl, target: '_blank', rel: 'noopener', text: 'Buka di Google Maps' })); } }
  if (S.hours) row('Jam kerja', h('span', { text: S.hours }));
  var d = S.whatsapp, shownNum = /^62\d{9,12}$/.test(d) ? '+62 ' + d.slice(2, 5) + '-' + d.slice(5, 9) + '-' + d.slice(9) : '+' + d;
  row('WhatsApp', h('a', { href: waLink(greet), target: '_blank', rel: 'noopener', text: shownNum }));
  if (S.email) row('Email', h('a', { href: 'mailto:' + S.email, text: S.email }));
  if (S.instagram) { var ig = S.instagram.replace(/^@/, ''); var igUrl = /^https?:/.test(ig) ? ig : 'https://instagram.com/' + ig; row('Instagram', h('a', { href: igUrl, target: '_blank', rel: 'noopener', text: /^https?:/.test(ig) ? ig.replace(/^https?:\/\/(www\.)?/, '') : '@' + ig })); }
  $('#waForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, nama = f.nama.value.trim();
    if (!nama) { $('#formErr').hidden = false; f.nama.focus(); return; }
    $('#formErr').hidden = true;
    var t = 'Halo ' + S.name + ', saya ' + nama + '.\nJenis pekerjaan: ' + f.jenis.value + (f.lokasi.value.trim() ? '\nLokasi: ' + f.lokasi.value.trim() : '') + (f.rencana.value.trim() ? '\nRencana: ' + f.rencana.value.trim() : '');
    window.open(waLink(t), '_blank', 'noopener');
  });
})();
