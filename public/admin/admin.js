/* Dashboard admin Bali Solution Building. Tanpa framework.
 * Alur: ambil seluruh konten (GET /content) -> edit di memori -> simpan per bagian (PUT /section/<nama>). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var C = null, ME = {}, view = 'ringkasan', cleanup = null;

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') n.textContent = v; else if (k === 'value') n.value = v; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined && c !== false) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  var uid = function () { var a = new Uint8Array(5); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  /* ---------- API ---------- */
  function api(method, path, body) {
    var opt = { method: method, headers: { 'X-Requested-With': 'bsb' }, credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch('/api/admin' + path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401 && path !== '/login') { showLogin(); throw new Error('Sesi berakhir. Masuk lagi.'); }
        if (!r.ok) throw new Error(d.error || 'Terjadi kesalahan (' + r.status + ')');
        return d;
      });
    });
  }
  function upload(kind, files, onProgress) {
    var list = Array.prototype.slice.call(files), done = 0, out = [], errors = [];
    var chain = Promise.resolve();
    for (var i = 0; i < list.length; i += 3) (function (batch) {
      chain = chain.then(function () {
        var fd = new FormData(); batch.forEach(function (f) { fd.append('file', f, f.name); });
        return fetch('/api/admin/upload/' + kind, { method: 'POST', body: fd, headers: { 'X-Requested-With': 'bsb' }, credentials: 'same-origin' })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (r.status === 401) { showLogin(); throw new Error('Sesi berakhir. Masuk lagi.'); } return d; }); })
          .then(function (d) { (d.files || []).forEach(function (f) { out.push(f); }); (d.errors || []).forEach(function (e) { errors.push(e); }); if (d.error) errors.push(d.error); })
          .catch(function (e) { errors.push(e.message); })
          .then(function () { done += batch.length; if (onProgress) onProgress(done, list.length); });
      });
    })(list.slice(i, i + 3));
    return chain.then(function () { return { files: out, errors: errors }; });
  }

  var toastT;
  function toast(msg, bad) {
    var t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, bad ? 6000 : 2600);
  }
  var saveSection = function (name, data) {
    return api('PUT', '/section/' + name, data).then(function (res) { C[name] = res; return res; });
  };
  function guard(btn, fn) {
    return function (e) {
      if (e && e.preventDefault) e.preventDefault();
      var old = btn.textContent; btn.disabled = true;
      Promise.resolve().then(fn).catch(function (err) { toast(err.message, true); }).then(function () { btn.disabled = false; btn.textContent = old; });
    };
  }

  /* ---------- login ---------- */
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; }
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = e.target.password.value, err = $('#loginErr'); err.hidden = true;
    api('POST', '/login', { password: pw }).then(boot).catch(function (x) { err.textContent = x.message; err.hidden = false; });
  });
  $('#logout').addEventListener('click', function () { api('POST', '/logout').then(function () { C = null; showLogin(); }); });

  function boot() {
    return Promise.all([api('GET', '/me'), api('GET', '/content')]).then(function (r) {
      ME = r[0]; C = r[1]; $('#login').hidden = true; $('#app').hidden = false; $('#loginForm').password.value = ''; render();
    });
  }

  /* ---------- tab & router ---------- */
  var TABS = [['ringkasan', 'Ringkasan'], ['proyek', 'Proyek'], ['hero', 'Animasi awal'], ['tur', 'Tur 360°'], ['layanan', 'Layanan'], ['testimoni', 'Testimoni dan angka'], ['pengaturan', 'Pengaturan']];
  function render() {
    if (cleanup) { cleanup(); cleanup = null; }
    var nav = $('#tabs'); nav.textContent = '';
    TABS.forEach(function (t) { nav.appendChild(h('button', { class: 'tab', type: 'button', 'aria-current': t[0] === view ? 'page' : 'false', text: t[1], onclick: function () { go(t[0]); } })); });
    var main = $('#main'); main.textContent = '';
    var fn = { ringkasan: vHome, proyek: vProjects, hero: vHero, tur: vTour, layanan: vServices, testimoni: vTesti, pengaturan: vSettings }[view];
    fn(main); window.scrollTo(0, 0);
  }
  function go(v) { view = v; render(); }

  var head = function (title, extra) { return h('div', { class: 'page-head' }, [h('h2', { text: title }), extra || null]); };
  var field = function (label, input, hint, cls) { return h('label', { class: cls || '' }, [label, input, hint ? h('span', { class: 'hint', text: hint }) : null]); };
  var inp = function (v, attrs) { return h('input', Object.assign({ type: 'text', value: v || '' }, attrs || {})); };

  /* ---------- ringkasan ---------- */
  function vHome(m) {
    m.appendChild(head('Ringkasan', h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener', text: 'Lihat situs' })));
    var pub = C.projects.filter(function (p) { return p.published !== false; }).length;
    var demoP = C.projects.filter(function (p) { return p.demo; }).length, demoS = C.tour.scenes.filter(function (s) { return s.demo; }).length;
    if (!ME.sharp) m.appendChild(h('div', { class: 'notice bad' }, ['Kompres foto belum aktif di server ini, jadi foto tersimpan apa adanya dan situs bisa lambat. Jalankan ', h('b', { text: 'npm install' }), ' lalu mulai ulang server.']));
    m.appendChild(h('div', { class: 'stat-row' }, [
      h('div', { class: 'stat' }, [h('b', { text: String(C.projects.length) }), h('span', { text: 'Proyek (' + pub + ' tampil di situs)' })]),
      h('div', { class: 'stat' }, [h('b', { text: String(C.projects.reduce(function (n, p) { return n + p.images.length; }, 0)) }), h('span', { text: 'Foto proyek' })]),
      h('div', { class: 'stat' }, [h('b', { text: String(C.tour.scenes.length) }), h('span', { text: 'Ruang tur 360°' })])
    ]));
    if (demoP || demoS) {
      var b = h('button', { class: 'btn danger', type: 'button', text: 'Hapus semua konten contoh' });
      b.addEventListener('click', guard(b, function () {
        if (!confirm('Hapus ' + demoP + ' proyek contoh dan ' + demoS + ' ruang tur contoh? Proyek dan foto asli Anda tidak ikut terhapus.')) return;
        var t = clone(C.tour); t.scenes = t.scenes.filter(function (s) { return !s.demo; });
        return saveSection('projects', C.projects.filter(function (p) { return !p.demo; })).then(function () { return saveSection('tour', t); }).then(function () { toast('Konten contoh dihapus'); render(); });
      }));
      m.appendChild(h('div', { class: 'notice' }, [h('b', { text: 'Situs masih berisi konten contoh. ' }), 'Proyek dan ruang tur bertanda "contoh" hanyalah ilustrasi. Setelah foto asli Anda masuk, hapus semuanya di sini. ', h('div', { class: 'actions' }, [b])]));
    }
    m.appendChild(h('div', { class: 'panel' }, [
      h('h3', { text: 'Cara cepat' }),
      h('p', { class: 'muted', text: 'Proyek baru: buka menu Proyek, tekan Tambah proyek, pilih banyak foto sekaligus, lalu Simpan. Foto otomatis dikecilkan agar situs tetap cepat dibuka.' }),
      h('p', { class: 'muted', text: 'Tur 360°: buka menu Tur 360°, unggah foto panorama (rasio 2:1), lalu letakkan titik putih untuk berpindah antar ruang.' }),
      h('p', { class: 'muted', text: 'Animasi awal: tanpa foto, situs menampilkan animasi gedung yang dibangun. Anda bisa menggantinya dengan 4 foto tahap pembangunan.' })
    ]));
    if (!C.stats.length) m.appendChild(h('div', { class: 'notice' }, ['Angka pencapaian (misalnya jumlah proyek) masih kosong dan tidak tampil di situs. Isi dengan angka asli di menu Testimoni dan angka.']));
  }

  /* ---------- proyek ---------- */
  function vProjects(m) {
    var add = h('button', { class: 'btn primary', type: 'button', text: 'Tambah proyek', onclick: function () { editProject(m, null); } });
    m.appendChild(head('Proyek', add));
    if (!C.projects.length) { m.appendChild(h('div', { class: 'empty', text: 'Belum ada proyek. Tekan Tambah proyek untuk mulai.' })); return; }
    var rows = h('div', { class: 'rows' }); m.appendChild(rows);
    C.projects.forEach(function (p, i) {
      var th = (p.images.filter(function (x) { return x.src === p.cover; })[0] || {}).thumb || p.cover;
      var tags = h('div', { class: 'tags' }, [
        h('span', { class: 'tag ' + (p.published !== false ? 'ok' : 'warn'), text: p.published !== false ? 'Tampil' : 'Disembunyikan' }),
        p.featured ? h('span', { class: 'tag', text: 'Unggulan' }) : null, p.demo ? h('span', { class: 'tag demo', text: 'Contoh' }) : null,
        h('span', { class: 'tag', text: p.images.length + ' foto' })]);
      var move = function (d) { return function () { var a = clone(C.projects), j = i + d; if (j < 0 || j >= a.length) return; var t = a[i]; a[i] = a[j]; a[j] = t; saveSection('projects', a).then(render).catch(function (e) { toast(e.message, true); }); }; };
      var del = h('button', { class: 'btn sm danger', type: 'button', text: 'Hapus' });
      del.addEventListener('click', function () {
        if (!confirm('Hapus proyek "' + p.title + '" beserta fotonya? Tindakan ini tidak bisa dibatalkan.')) return;
        saveSection('projects', C.projects.filter(function (x) { return x.id !== p.id; })).then(function () { toast('Proyek dihapus'); render(); }).catch(function (e) { toast(e.message, true); });
      });
      rows.appendChild(h('div', { class: 'row' }, [
        th ? h('img', { src: th, alt: '', loading: 'lazy' }) : h('div', { class: 'ph', text: 'Tanpa foto' }),
        h('div', null, [h('b', { text: p.title }), h('div', { class: 'meta', text: [p.category, p.location, p.year].filter(Boolean).join(', ') }), tags]),
        h('div', { class: 'row-actions' }, [
          h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Naikkan', text: '↑', onclick: move(-1) }),
          h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Turunkan', text: '↓', onclick: move(1) }),
          h('button', { class: 'btn sm', type: 'button', text: 'Edit', onclick: function () { editProject(m, p); } }), del])
      ]));
    });
  }

  function dropzone(kind, multiple, onFiles, label) {
    var inpF = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: multiple, hidden: true });
    var box = h('div', { class: 'drop', tabindex: '0', role: 'button' }, [h('strong', { text: label || 'Tarik foto ke sini atau tekan untuk memilih' }), h('span', { class: 'hint', text: 'Format JPG, PNG, atau WebP. Foto besar dari HP tidak masalah, otomatis dikecilkan.' }), inpF]);
    var pick = function () { inpF.click(); };
    box.addEventListener('click', function (e) { if (e.target !== inpF) pick(); });
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    inpF.addEventListener('change', function () { if (inpF.files.length) onFiles(inpF.files); inpF.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { box.addEventListener(ev, function (e) { e.preventDefault(); box.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { box.addEventListener(ev, function (e) { e.preventDefault(); box.classList.remove('over'); }); });
    box.addEventListener('drop', function (e) { var fs = Array.prototype.filter.call(e.dataTransfer.files, function (f) { return /^image\//.test(f.type); }); if (fs.length) onFiles(multiple ? fs : [fs[0]]); });
    return box;
  }
  function progressBar() { var i = h('i'), w = h('div', { class: 'progress', hidden: true }, [i]); w.set = function (a, b) { w.hidden = a >= b; i.style.width = (a / b * 100) + '%'; }; return w; }

  function editProject(m, orig) {
    var p = orig ? clone(orig) : { id: uid(), title: '', category: '', location: '', year: String(new Date().getFullYear()), description: '', cover: null, images: [], featured: false, published: true };
    m.textContent = '';
    m.appendChild(head(orig ? 'Edit proyek' : 'Proyek baru', h('button', { class: 'btn', type: 'button', text: 'Kembali', onclick: function () { if (confirm('Keluar tanpa menyimpan perubahan?')) render(); } })));
    var cats = []; C.projects.forEach(function (x) { if (x.category && cats.indexOf(x.category) < 0) cats.push(x.category); });
    ['Design & Build', 'Renovasi', 'Komersial', 'Waterproofing', 'Epoxy Flooring'].forEach(function (c) { if (cats.indexOf(c) < 0) cats.push(c); });
    var dl = h('datalist', { id: 'cats' }, cats.map(function (c) { return h('option', { value: c }); }));
    var fT = inp(p.title, { maxlength: 100, required: true }), fC = inp(p.category, { list: 'cats', maxlength: 40 }), fL = inp(p.location, { maxlength: 80 }), fY = inp(p.year, { maxlength: 4, inputmode: 'numeric' });
    var fD = h('textarea', { rows: 5, maxlength: 1200, value: p.description });
    var cPub = h('input', { type: 'checkbox' }), cFea = h('input', { type: 'checkbox' }); cPub.checked = p.published !== false; cFea.checked = !!p.featured;
    m.appendChild(h('div', { class: 'panel' }, [dl, h('div', { class: 'form-grid' }, [
      field('Nama proyek', fT, null, 'full'), field('Kategori', fC, 'Ketik baru atau pilih yang ada'), field('Lokasi', fL), field('Tahun', fY), h('span'),
      field('Deskripsi singkat', fD, 'Ceritakan lingkup pekerjaan, luas, atau tantangan proyek.', 'full'),
      h('label', { class: 'check' }, [cPub, 'Tampilkan di situs']), h('label', { class: 'check' }, [cFea, 'Proyek unggulan (kartu lebih besar)'])])]));

    var photos = h('div', { class: 'photos' }), bar = progressBar(), msg = h('p', { class: 'err', hidden: true });
    function drawPhotos() {
      photos.textContent = '';
      if (!p.images.length) photos.appendChild(h('p', { class: 'muted', text: 'Belum ada foto. Foto pertama otomatis menjadi foto sampul.' }));
      p.images.forEach(function (im, i) {
        var isCover = im.src === p.cover;
        var mv = function (d) { return function () { var j = i + d; if (j < 0 || j >= p.images.length) return; var t = p.images[i]; p.images[i] = p.images[j]; p.images[j] = t; drawPhotos(); }; };
        photos.appendChild(h('div', { class: 'photo' + (isCover ? ' cover' : '') }, [
          h('img', { src: im.thumb, alt: 'Foto ' + (i + 1), loading: 'lazy' }), isCover ? h('span', { class: 'badge', text: 'Sampul' }) : null,
          h('div', { class: 'bar' }, [
            h('button', { type: 'button', 'aria-label': 'Geser ke kiri', text: '←', onclick: mv(-1) }),
            h('button', { type: 'button', 'aria-label': 'Jadikan sampul', title: 'Jadikan sampul', text: '★', onclick: function () { p.cover = im.src; drawPhotos(); } }),
            h('button', { type: 'button', 'aria-label': 'Geser ke kanan', text: '→', onclick: mv(1) }),
            h('button', { type: 'button', 'aria-label': 'Hapus foto', title: 'Hapus foto', text: '✕', onclick: function () { p.images.splice(i, 1); if (p.cover === im.src) p.cover = p.images[0] ? p.images[0].src : null; drawPhotos(); } })])]));
      });
    }
    drawPhotos();
    var dz = dropzone('project', true, function (files) {
      msg.hidden = true; bar.set(0, files.length);
      upload('project', files, function (a, b) { bar.set(a, b); }).then(function (res) {
        res.files.forEach(function (f) { p.images.push({ src: f.src, thumb: f.thumb }); });
        if (!p.cover && p.images[0]) p.cover = p.images[0].src;
        drawPhotos();
        if (res.errors.length) { msg.textContent = res.errors.join('\n'); msg.style.whiteSpace = 'pre-line'; msg.hidden = false; }
        else toast(res.files.length + ' foto ditambahkan. Jangan lupa tekan Simpan proyek.');
      });
    });
    m.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Foto proyek' }), dz, bar, msg, photos]));

    var save = h('button', { class: 'btn primary', type: 'button', text: 'Simpan proyek' });
    save.addEventListener('click', guard(save, function () {
      if (!fT.value.trim()) { fT.focus(); throw new Error('Isi nama proyek dulu.'); }
      p.title = fT.value; p.category = fC.value; p.location = fL.value; p.year = fY.value; p.description = fD.value; p.published = cPub.checked; p.featured = cFea.checked;
      var all = clone(C.projects), i = all.findIndex(function (x) { return x.id === p.id; });
      if (i >= 0) all[i] = p; else all.unshift(p);
      return saveSection('projects', all).then(function () { toast('Proyek tersimpan'); render(); });
    }));
    m.appendChild(h('div', { class: 'actions' }, [save, h('button', { class: 'btn', type: 'button', text: 'Batal', onclick: render })]));
  }

  /* ---------- animasi awal (hero) ---------- */
  function vHero(m) {
    m.appendChild(head('Animasi awal'));
    m.appendChild(h('div', { class: 'notice' }, ['Tanpa foto, beranda menampilkan animasi gedung yang dibangun saat halaman digulir. Jika Anda mengunggah foto tahap pembangunan, foto itu menggantikan animasi dan berganti halus mengikuti gulir. Foto lanskap (mendatar) paling bagus. Anda boleh mengisi sebagian tahap saja.']));
    var st = clone(C.hero.stages), labels = ['Tahap 1: persiapan dan fondasi', 'Tahap 2: struktur', 'Tahap 3: dinding, atap, kedap air', 'Tahap 4: bangunan jadi'];
    var panel = h('div', { class: 'panel' }); m.appendChild(panel);
    var tI = [], xI = [];
    function draw() {
      panel.textContent = ''; tI = []; xI = [];
      st.forEach(function (s, i) {
        var t = inp(s.title, { maxlength: 80 }), x = h('textarea', { rows: 2, maxlength: 260, value: s.text || '' }); tI.push(t); xI.push(x);
        var bar = progressBar();
        var thumb = h('div', { class: 'thumb', style: s.image ? 'background-image:url(' + s.image + ')' : '', text: s.image ? '' : 'Belum ada foto, memakai animasi' });
        var dz = dropzone('hero', false, function (files) { upload('hero', files, function (a, b) { bar.set(a, b); }).then(function (r) { if (r.files[0]) { sync(); st[i].image = r.files[0].src; draw(); toast('Foto ditambahkan. Tekan Simpan animasi awal agar tampil di situs.'); } else toast(r.errors[0] || 'Gagal mengunggah', true); }); }, s.image ? 'Ganti foto' : 'Pilih foto tahap ini');
        var rm = s.image ? h('button', { class: 'btn sm danger', type: 'button', text: 'Hapus foto', onclick: function () { sync(); st[i].image = null; draw(); } }) : null;
        panel.appendChild(h('div', { class: 'stage' }, [h('div', null, [thumb, bar, rm]), h('div', { class: 'form-grid' }, [h('h3', { class: 'full', text: labels[i] }), field('Judul', t, null, 'full'), field('Keterangan', x, null, 'full'), h('div', { class: 'full' }, [dz])])]));
      });
    }
    function sync() { st.forEach(function (s, i) { s.title = tI[i].value; s.text = xI[i].value; }); }
    draw();
    var save = h('button', { class: 'btn primary', type: 'button', text: 'Simpan animasi awal' });
    save.addEventListener('click', guard(save, function () { sync(); return saveSection('hero', { stages: st }).then(function () { toast('Tersimpan'); }); }));
    m.appendChild(h('div', { class: 'actions' }, [save]));
  }

  /* ---------- tur 360 ---------- */
  function vTour(m) {
    var T = clone(C.tour), selScene = T.scenes[0] ? T.scenes[0].id : null, selHs = null, mode = null, viewer = null, curPano = null;
    m.appendChild(head('Tur 360°'));
    var top = h('div', { class: 'panel' });
    var cEn = h('input', { type: 'checkbox' }); cEn.checked = !!T.enabled;
    var fT = inp(T.title, { maxlength: 100 }), fI = h('textarea', { rows: 2, maxlength: 300, value: T.intro || '' });
    top.appendChild(h('div', { class: 'form-grid' }, [h('label', { class: 'check full' }, [cEn, 'Tampilkan tur 360° di situs']), field('Judul bagian', fT), field('Pengantar', fI)]));
    m.appendChild(top);

    var bar = progressBar(), msg = h('p', { class: 'err', hidden: true }), sceneBox = h('div', { class: 'panel' }), editor = h('div', { class: 'panel' });
    var dz = dropzone('pano', true, function (files) {
      msg.hidden = true; bar.set(0, files.length);
      upload('pano', files, function (a, b) { bar.set(a, b); }).then(function (res) {
        res.files.forEach(function (f) { var s = { id: uid(), title: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 60) || 'Ruang', pano: f.src, thumb: f.thumb, yaw: 0, pitch: 0, fov: 85, hotspots: [] }; T.scenes.push(s); selScene = s.id; });
        if (!T.start && T.scenes[0]) T.start = T.scenes[0].id;
        drawScenes(); drawEditor();
        if (res.errors.length) { msg.textContent = res.errors.join('\n'); msg.style.whiteSpace = 'pre-line'; msg.hidden = false; }
      });
    }, 'Tarik foto panorama 360° ke sini atau tekan untuk memilih');
    var hintBox = h('p', { class: 'hint', text: 'Foto harus equirectangular dengan rasio 2:1 (misalnya 6000×3000). Bisa dibuat dengan kamera 360°, atau fitur Panorama/Photo Sphere di HP. Satu foto = satu ruang.' });
    m.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Tambah ruang' }), dz, bar, msg, hintBox]));
    m.appendChild(sceneBox); m.appendChild(editor);

    var scene = function () { return T.scenes.filter(function (s) { return s.id === selScene; })[0]; };
    function drawScenes() {
      sceneBox.textContent = ''; sceneBox.appendChild(h('h3', { text: 'Ruang (' + T.scenes.length + ')' }));
      if (!T.scenes.length) { sceneBox.appendChild(h('p', { class: 'muted', text: 'Belum ada ruang. Unggah foto panorama di atas.' })); return; }
      var list = h('div', { class: 'scene-list' });
      T.scenes.forEach(function (s, i) {
        var mv = function (d) { return function (e) { e.stopPropagation(); var j = i + d; if (j < 0 || j >= T.scenes.length) return; var t = T.scenes[i]; T.scenes[i] = T.scenes[j]; T.scenes[j] = t; drawScenes(); }; };
        var row = h('div', { class: 'scene', role: 'button', tabindex: '0', 'aria-current': s.id === selScene ? 'true' : 'false' }, [
          h('img', { src: s.thumb, alt: '' }), h('div', null, [h('b', { text: s.title }), h('div', { class: 'meta muted', text: (T.start === s.id ? 'Ruang pertama, ' : '') + s.hotspots.length + ' titik' + (s.demo ? ', contoh' : '') })]),
          h('div', { class: 'row-actions' }, [h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Naikkan', text: '↑', onclick: mv(-1) }), h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Turunkan', text: '↓', onclick: mv(1) })])]);
        var pick = function () { selScene = s.id; selHs = null; mode = null; drawScenes(); drawEditor(); };
        row.addEventListener('click', pick); row.addEventListener('keydown', function (e) { if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(); } });
        list.appendChild(row);
      });
      sceneBox.appendChild(list);
    }

    function drawEditor() {
      if (viewer) { viewer.destroy(); viewer = null; curPano = null; }
      editor.textContent = '';
      var s = scene(); if (!s) { editor.hidden = true; return; } editor.hidden = false;
      editor.appendChild(h('h3', { text: 'Atur ruang: ' + s.title }));
      var fName = inp(s.title, { maxlength: 60 }); fName.addEventListener('input', function () { s.title = fName.value; });
      var box = h('div', { class: 'pano-box', tabindex: '0', 'aria-label': 'Pratinjau panorama' }), tip = h('div', { class: 'pano-tip' });
      var side = h('div', { class: 'form-grid' });
      var hsList = h('div', { class: 'rows', style: 'margin-top:14px' });
      function setTip() { tip.textContent = mode ? (mode.move ? 'Klik di foto untuk memindahkan titik.' : 'Klik di foto untuk meletakkan titik baru.') : 'Geser untuk melihat sekeliling. Pilih tombol tambah titik, lalu klik lokasi di foto.'; box.classList.toggle('placing', !!mode); }
      var supportsGL = window.BSBPano && BSBPano.supported();
      if (!supportsGL) box.appendChild(h('div', { class: 'pano-tip', text: 'Browser ini tidak mendukung WebGL, pratinjau tidak bisa tampil.' }));
      editor.appendChild(h('div', { class: 'tour-edit' }, [h('div', null, [box, hsList]), side]));
      box.appendChild(tip); setTip();

      function hsEls() {
        return s.hotspots.map(function (hs) {
          var el = h('button', { class: 'hs hs-' + (hs.type === 'info' ? 'info' : 'scene') + (hs.id === selHs ? ' sel' : ''), type: 'button', 'aria-label': 'Titik ' + (hs.title || hs.type) }, [h('span', { class: 'hs-dot', text: hs.type === 'info' ? 'i' : '' })]);
          el.addEventListener('click', function (e) { e.stopPropagation(); selHs = hs.id; drawHs(); });
          return { yaw: hs.yaw, pitch: hs.pitch, el: el };
        });
      }
      function drawHs() {
        if (viewer) viewer.setHotspots(hsEls());
        hsList.textContent = '';
        if (!s.hotspots.length) hsList.appendChild(h('p', { class: 'muted', text: 'Belum ada titik di ruang ini.' }));
        s.hotspots.forEach(function (hs) {
          var tgt = h('select', null, T.scenes.filter(function (x) { return x.id !== s.id; }).map(function (x) { return h('option', { value: x.id, text: x.title }); }));
          tgt.value = hs.target || ''; tgt.addEventListener('change', function () { hs.target = tgt.value; });
          var ti = inp(hs.title || '', { maxlength: 80 }); ti.addEventListener('input', function () { hs.title = ti.value; });
          var tx = h('textarea', { rows: 3, maxlength: 500, value: hs.text || '' }); tx.addEventListener('input', function () { hs.text = tx.value; });
          var body = hs.type === 'scene' ? [field('Pergi ke ruang', tgt)] : [field('Judul info', ti), field('Isi info', tx)];
          hsList.appendChild(h('div', { class: 'hs-card' + (hs.id === selHs ? ' sel' : '') }, [
            h('b', { text: hs.type === 'scene' ? 'Titik pindah ruang' : 'Titik info' })].concat(body, [h('div', { class: 'row-actions', style: 'justify-content:flex-start' }, [
              h('button', { class: 'btn sm', type: 'button', text: 'Pindahkan', onclick: function () { selHs = hs.id; mode = { move: hs.id }; setTip(); } }),
              h('button', { class: 'btn sm danger', type: 'button', text: 'Hapus', onclick: function () { s.hotspots = s.hotspots.filter(function (x) { return x.id !== hs.id; }); selHs = null; drawHs(); } })])])));
        });
      }
      if (supportsGL) {
        try {
          viewer = new BSBPano(box, {}); curPano = s.pano;
          viewer.load(s.pano, { yaw: s.yaw, pitch: s.pitch, fov: s.fov }).then(drawHs).catch(function () { toast('Foto panorama gagal dimuat', true); });
          viewer.onPick = function (yaw, pitch) {
            if (!mode) return;
            yaw = Math.round(yaw * 10) / 10; pitch = Math.round(pitch * 10) / 10;
            if (mode.move) { var hs = s.hotspots.filter(function (x) { return x.id === mode.move; })[0]; if (hs) { hs.yaw = yaw; hs.pitch = pitch; } }
            else {
              var other = T.scenes.filter(function (x) { return x.id !== s.id; })[0];
              var n = { id: uid(), type: mode.type, yaw: yaw, pitch: pitch, target: mode.type === 'scene' && other ? other.id : null, title: '', text: '' };
              s.hotspots.push(n); selHs = n.id;
            }
            mode = null; setTip(); drawHs();
          };
        } catch (e) { toast('Pratinjau 360° tidak bisa dimulai di perangkat ini', true); }
      }
      var addScene = h('button', { class: 'btn sm', type: 'button', text: '+ Titik pindah ruang', onclick: function () { if (T.scenes.length < 2) return toast('Tambahkan minimal dua ruang agar bisa berpindah.', true); mode = { type: 'scene' }; setTip(); } });
      var addInfo = h('button', { class: 'btn sm', type: 'button', text: '+ Titik info', onclick: function () { mode = { type: 'info' }; setTip(); } });
      var setView = h('button', { class: 'btn sm', type: 'button', text: 'Jadikan arah awal ruang ini', onclick: function () { if (!viewer) return; s.yaw = Math.round(viewer.yaw); s.pitch = Math.round(viewer.pitch); s.fov = Math.round(viewer.fov); toast('Arah awal disimpan (tekan Simpan tur untuk menyimpan)'); } });
      var setStart = h('button', { class: 'btn sm', type: 'button', text: 'Jadikan ruang pertama', onclick: function () { T.start = s.id; drawScenes(); toast('Ruang ini jadi ruang pertama'); } });
      var delScene = h('button', { class: 'btn sm danger', type: 'button', text: 'Hapus ruang ini', onclick: function () {
        if (!confirm('Hapus ruang "' + s.title + '"? Titik yang mengarah ke ruang ini juga dihapus.')) return;
        T.scenes = T.scenes.filter(function (x) { return x.id !== s.id; });
        T.scenes.forEach(function (x) { x.hotspots = x.hotspots.filter(function (hh) { return hh.target !== s.id; }); });
        if (T.start === s.id) T.start = T.scenes[0] ? T.scenes[0].id : null;
        selScene = T.scenes[0] ? T.scenes[0].id : null; selHs = null; drawScenes(); drawEditor(); } });
      side.appendChild(field('Nama ruang', fName, null, 'full'));
      side.appendChild(h('div', { class: 'full actions', style: 'margin-top:0' }, [addScene, addInfo]));
      side.appendChild(h('div', { class: 'full actions', style: 'margin-top:0' }, [setView, setStart, delScene]));
      side.appendChild(h('p', { class: 'hint full', text: 'Titik pindah ruang tampil sebagai lingkaran putih, titik info sebagai lingkaran emas bertanda i. Letakkan titik pindah di pintu atau lorong.' }));
      drawHs();
    }
    drawScenes(); drawEditor();
    cleanup = function () { if (viewer) viewer.destroy(); };

    var save = h('button', { class: 'btn primary', type: 'button', text: 'Simpan tur' });
    save.addEventListener('click', guard(save, function () {
      T.enabled = cEn.checked; T.title = fT.value; T.intro = fI.value;
      return saveSection('tour', T).then(function () { toast('Tur tersimpan'); C.tour = clone(C.tour); });
    }));
    m.appendChild(h('div', { class: 'actions' }, [save]));
  }

  /* ---------- daftar generik: layanan, testimoni, angka ---------- */
  function listEditor(items, makeRow, blank, addLabel) {
    var box = h('div', { class: 'rows' });
    function draw() {
      box.textContent = '';
      items.forEach(function (it, i) {
        var mv = function (d) { return function () { var j = i + d; if (j < 0 || j >= items.length) return; var t = items[i]; items[i] = items[j]; items[j] = t; draw(); }; };
        box.appendChild(h('div', { class: 'hs-card' }, [makeRow(it)].concat([h('div', { class: 'row-actions', style: 'justify-content:flex-start' }, [
          h('button', { class: 'btn sm', type: 'button', text: '↑', 'aria-label': 'Naikkan', onclick: mv(-1) }), h('button', { class: 'btn sm', type: 'button', text: '↓', 'aria-label': 'Turunkan', onclick: mv(1) }),
          h('button', { class: 'btn sm danger', type: 'button', text: 'Hapus', onclick: function () { items.splice(i, 1); draw(); } })])])));
      });
      box.appendChild(h('button', { class: 'btn', type: 'button', text: addLabel, onclick: function () { items.push(blank()); draw(); } }));
    }
    draw(); return box;
  }
  var bindText = function (obj, key, input) { input.addEventListener('input', function () { obj[key] = input.value; }); return input; };
  var ICON_NAMES = [['home', 'Rumah'], ['building', 'Gedung'], ['layers', 'Lapisan (renovasi)'], ['drop', 'Tetesan (waterproofing)'], ['floor', 'Lantai'], ['clipboard', 'Papan catatan'], ['shield', 'Perisai'], ['tool', 'Perkakas']];

  function vServices(m) {
    m.appendChild(head('Layanan'));
    var items = clone(C.services);
    var ed = listEditor(items, function (it) {
      var sel = h('select', null, ICON_NAMES.map(function (n) { return h('option', { value: n[0], text: n[1] }); })); sel.value = it.icon; sel.addEventListener('change', function () { it.icon = sel.value; });
      return h('div', { class: 'form-grid' }, [field('Nama layanan', bindText(it, 'title', inp(it.title, { maxlength: 60 }))), field('Ikon', sel), field('Penjelasan singkat', bindText(it, 'text', h('textarea', { rows: 2, maxlength: 220, value: it.text })), null, 'full')]);
    }, function () { return { id: uid(), icon: 'tool', title: '', text: '' }; }, 'Tambah layanan');
    m.appendChild(h('div', { class: 'panel' }, [ed]));
    var save = h('button', { class: 'btn primary', type: 'button', text: 'Simpan layanan' });
    save.addEventListener('click', guard(save, function () { return saveSection('services', items).then(function () { toast('Tersimpan'); }); }));
    m.appendChild(h('div', { class: 'actions' }, [save]));
  }

  function vTesti(m) {
    m.appendChild(head('Testimoni dan angka'));
    var st = clone(C.stats), ts = clone(C.testimonials);
    m.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Angka pencapaian' }), h('p', { class: 'muted', text: 'Isi hanya angka yang benar. Contoh: nilai "150+" dengan keterangan "Proyek selesai". Kosongkan semua jika belum mau ditampilkan.' }),
      listEditor(st, function (it) { return h('div', { class: 'form-grid' }, [field('Angka', bindText(it, 'value', inp(it.value, { maxlength: 14 }))), field('Keterangan', bindText(it, 'label', inp(it.label, { maxlength: 40 })))]); }, function () { return { value: '', label: '' }; }, 'Tambah angka')]));
    m.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Testimoni klien' }), h('p', { class: 'muted', text: 'Tulis kutipan asli dari klien (dengan izin mereka). Bagian ini tidak tampil di situs selama kosong.' }),
      listEditor(ts, function (it) { return h('div', { class: 'form-grid' }, [field('Nama klien', bindText(it, 'name', inp(it.name, { maxlength: 60 }))), field('Keterangan (opsional)', bindText(it, 'role', inp(it.role, { maxlength: 80 })), 'Contoh: Pemilik Villa, Canggu'), field('Kutipan', bindText(it, 'text', h('textarea', { rows: 3, maxlength: 400, value: it.text })), null, 'full')]); }, function () { return { id: uid(), name: '', role: '', text: '' }; }, 'Tambah testimoni')]));
    var save = h('button', { class: 'btn primary', type: 'button', text: 'Simpan' });
    save.addEventListener('click', guard(save, function () { return saveSection('stats', st).then(function () { return saveSection('testimonials', ts); }).then(function () { toast('Tersimpan'); }); }));
    m.appendChild(h('div', { class: 'actions' }, [save]));
  }

  /* ---------- pengaturan ---------- */
  function vSettings(m) {
    m.appendChild(head('Pengaturan'));
    var s = clone(C.settings), F = {};
    var f = function (key, label, hint, attrs, cls) { F[key] = inp(s[key], attrs); return field(label, F[key], hint, cls); };
    m.appendChild(h('div', { class: 'panel' }, [h('h3', { text: 'Profil perusahaan' }), h('div', { class: 'form-grid' }, [
      f('name', 'Nama perusahaan', null, { maxlength: 80 }), f('tagline', 'Slogan (judul besar di beranda)', null, { maxlength: 120 }),
      f('description', 'Deskripsi untuk Google dan WhatsApp', 'Satu atau dua kalimat. Muncul di hasil pencarian.', { maxlength: 300 }, 'full'),
      f('whatsapp', 'Nomor WhatsApp', 'Boleh ditulis 0821... atau 62821...', { inputmode: 'tel', maxlength: 30 }), f('ctaLabel', 'Tulisan tombol utama', null, { maxlength: 24 }),
      f('email', 'Email (opsional)', null, { type: 'email', maxlength: 120 }), f('instagram', 'Instagram (opsional)', 'Nama akun atau tautan', { maxlength: 120 }),
      f('address', 'Alamat kantor', null, { maxlength: 250 }, 'full'), f('mapsUrl', 'Tautan Google Maps', 'Salin dari tombol Bagikan di Google Maps', { type: 'url', maxlength: 500 }, 'full'),
      f('hours', 'Jam kerja', null, { maxlength: 120 })])]));
    var save = h('button', { class: 'btn primary', type: 'button', text: 'Simpan pengaturan' });
    save.addEventListener('click', guard(save, function () { Object.keys(F).forEach(function (k) { s[k] = F[k].value; }); return saveSection('settings', s).then(function () { toast('Tersimpan'); }); }));
    m.appendChild(h('div', { class: 'actions' }, [save]));
    var cur = inp('', { type: 'password', autocomplete: 'current-password' }), nw = inp('', { type: 'password', autocomplete: 'new-password' });
    var pw = h('button', { class: 'btn', type: 'button', text: 'Ganti password' });
    pw.addEventListener('click', guard(pw, function () { return api('POST', '/password', { current: cur.value, next: nw.value }).then(function () { cur.value = nw.value = ''; toast('Password diganti'); }); }));
    m.appendChild(h('div', { class: 'panel', style: 'margin-top:24px' }, [h('h3', { text: 'Keamanan' }), h('div', { class: 'form-grid' }, [field('Password saat ini', cur), field('Password baru', nw, 'Minimal 8 karakter')]), h('div', { class: 'actions' }, [pw])]));
  }

  /* ---------- mulai ---------- */
  api('GET', '/me').then(boot).catch(function () { showLogin(); });
})();
