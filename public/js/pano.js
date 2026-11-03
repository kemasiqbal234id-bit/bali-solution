/* Viewer panorama 360° ringan (WebGL, tanpa library). Dipakai situs publik dan dashboard admin.
 *
 *   const v = new BSBPano(elemen, { autorotate: true });
 *   await v.load('/uploads/pano-x.webp', { yaw: 0, pitch: 0, fov: 85 });
 *   v.setHotspots([{ id, yaw, pitch, el }]);      // el = elemen DOM tombol
 *   v.onPick = (yaw, pitch) => {};                // klik di area kosong (dipakai admin)
 *   await v.goTo(url, { yaw, pitch, fov });       // pindah ruang dengan transisi
 *
 * Sudut dalam derajat. yaw 0 = tengah gambar, positif = ke kanan. pitch positif = ke atas.
 */
(function () {
  'use strict';
  var RAD = Math.PI / 180;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FRAG = [
    'precision highp float;',
    'uniform sampler2D t;uniform vec2 res;uniform float yaw,pitch,fov;',
    'void main(){',
    ' vec2 q=gl_FragCoord.xy/res*2.-1.; q.x*=res.x/res.y;',
    ' float f=tan(fov*.5);',
    ' vec3 d=normalize(vec3(q.x*f,q.y*f,-1.));',
    ' float cp=cos(pitch),sp=sin(pitch);',
    ' d=vec3(d.x,d.y*cp-d.z*sp,d.y*sp+d.z*cp);',
    ' float cy=cos(yaw),sy=sin(yaw);',
    ' d=vec3(d.x*cy-d.z*sy,d.y,d.x*sy+d.z*cy);',
    ' float lon=atan(d.x,-d.z),lat=asin(clamp(d.y,-1.,1.));',
    ' gl_FragColor=texture2D(t,vec2(lon/6.2831853+.5,.5-lat/3.14159265));',
    '}'
  ].join('\n');

  function supported() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  function BSBPano(root, opts) {
    opts = opts || {};
    this.root = root;
    this.yaw = 0; this.pitch = 0; this.fov = 85;
    this.minFov = 40; this.maxFov = 100;
    this.autorotate = !!opts.autorotate;
    this.onPick = null;
    this.onChange = null;
    this.hotspots = [];
    this.dirty = true;
    this.vy = 0; this.vp = 0;
    this.alive = true;
    this.texture = null;
    this.busy = false;
    this._pointers = new Map();
    this._pinch = 0;

    var canvas = this.canvas = document.createElement('canvas');
    canvas.className = 'pano-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    root.appendChild(canvas);
    var layer = this.layer = document.createElement('div');
    layer.className = 'pano-layer';
    root.appendChild(layer);
    if (!root.hasAttribute('tabindex')) root.tabIndex = 0;

    var gl = this.gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false }) || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL tidak tersedia');
    var sh = function (type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    var prog = this.prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Shader gagal dirakit');
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {
      res: gl.getUniformLocation(prog, 'res'), yaw: gl.getUniformLocation(prog, 'yaw'),
      pitch: gl.getUniformLocation(prog, 'pitch'), fov: gl.getUniformLocation(prog, 'fov')
    };

    this._bind();
    var self = this;
    if (window.ResizeObserver) { this._ro = new ResizeObserver(function () { self._resize(); }); this._ro.observe(root); }
    else window.addEventListener('resize', this._onResize = function () { self._resize(); });
    this._resize();
    this._last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }
  BSBPano.supported = supported;

  var P = BSBPano.prototype;

  P._resize = function () {
    var r = this.root.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    var cap = 1920; if (w > cap) { h = Math.round(h * cap / w); w = cap; }
    this.canvas.width = w; this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    this.W = r.width; this.H = r.height;
    this.dirty = true;
  };

  P.load = function (url, view) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        if (!self.alive) return resolve();
        var gl = self.gl;
        var t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (self.texture) gl.deleteTexture(self.texture);
        self.texture = t;
        if (view) self.setView(view.yaw, view.pitch, view.fov);
        self.dirty = true;
        resolve();
      };
      img.onerror = function () { reject(new Error('Foto panorama gagal dimuat')); };
      img.src = url;
    });
  };

  P.setView = function (yaw, pitch, fov) {
    if (typeof yaw === 'number') this.yaw = yaw;
    if (typeof pitch === 'number') this.pitch = clamp(pitch, -85, 85);
    if (typeof fov === 'number') this.fov = clamp(fov, this.minFov, this.maxFov);
    this.dirty = true;
  };

  // Pindah ruang: zoom masuk sedikit sambil memudar, ganti foto, lalu memudar masuk.
  P.goTo = function (url, view) {
    var self = this;
    if (this.busy) return Promise.resolve();
    this.busy = true;
    var c = this.canvas, l = this.layer;
    var startFov = this.fov;
    c.style.transition = 'opacity .38s ease'; l.style.transition = 'opacity .25s ease';
    c.style.opacity = '0'; l.style.opacity = '0';
    var t0 = performance.now();
    var zoom = function (now) {
      var k = clamp((now - t0) / 380, 0, 1);
      self.fov = clamp(startFov - 14 * k, self.minFov, self.maxFov); self.dirty = true;
      if (k < 1 && self.alive) requestAnimationFrame(zoom);
    };
    requestAnimationFrame(zoom);
    var wait = new Promise(function (r) { setTimeout(r, 380); });
    return Promise.all([self.load(url), wait]).then(function () {
      var from = Math.min((view && view.fov) || 85, self.maxFov) - 12;
      self.setView(view && view.yaw, view && view.pitch, from);
      c.style.opacity = '1'; l.style.opacity = '1';
      var target = clamp((view && view.fov) || 85, self.minFov, self.maxFov);
      var t1 = performance.now();
      var out = function (now) {
        var k = clamp((now - t1) / 600, 0, 1), e = 1 - Math.pow(1 - k, 3);
        self.fov = from + (target - from) * e; self.dirty = true;
        if (k < 1 && self.alive) requestAnimationFrame(out); else self.busy = false;
      };
      requestAnimationFrame(out);
    }).catch(function (e) { c.style.opacity = '1'; l.style.opacity = '1'; self.busy = false; throw e; });
  };

  // ---- matematika proyeksi ----
  // arah dunia untuk (yaw, pitch)
  function dirFrom(yaw, pitch) {
    var y = yaw * RAD, p = pitch * RAD;
    return [Math.cos(p) * Math.sin(y), Math.sin(p), -Math.cos(p) * Math.cos(y)];
  }
  P.project = function (yaw, pitch) {
    var d = dirFrom(yaw, pitch);
    var cy = Math.cos(this.yaw * RAD), sy = Math.sin(this.yaw * RAD);
    var cp = Math.cos(this.pitch * RAD), sp = Math.sin(this.pitch * RAD);
    var x1 = d[0] * cy + d[2] * sy, z1 = -d[0] * sy + d[2] * cy, y1 = d[1];       // balik yaw
    var y2 = y1 * cp + z1 * sp, z2 = -y1 * sp + z1 * cp;                           // balik pitch
    if (z2 >= -0.01) return null;                                                  // di belakang kamera
    var f = Math.tan(this.fov * RAD / 2), aspect = this.W / this.H;
    var nx = x1 / (-z2) / (f * aspect), ny = y2 / (-z2) / f;
    return { x: (nx + 1) / 2 * this.W, y: (1 - ny) / 2 * this.H, visible: Math.abs(nx) < 1.1 && Math.abs(ny) < 1.1 };
  };
  P.screenToAngles = function (sx, sy) {
    var f = Math.tan(this.fov * RAD / 2), aspect = this.W / this.H;
    var nx = (sx / this.W) * 2 - 1, ny = 1 - (sy / this.H) * 2;
    var x = nx * aspect * f, y = ny * f, z = -1, n = Math.sqrt(x * x + y * y + 1);
    x /= n; y /= n; z /= n;
    var cp = Math.cos(this.pitch * RAD), sp = Math.sin(this.pitch * RAD);
    var y2 = y * cp - z * sp, z2 = y * sp + z * cp;
    var cy = Math.cos(this.yaw * RAD), sy2 = Math.sin(this.yaw * RAD);
    var x3 = x * cy - z2 * sy2, z3 = x * sy2 + z2 * cy;
    return { yaw: Math.atan2(x3, -z3) / RAD, pitch: Math.asin(clamp(y2, -1, 1)) / RAD };
  };

  P.setHotspots = function (list) {
    while (this.layer.firstChild) this.layer.removeChild(this.layer.firstChild);
    this.hotspots = list || [];
    for (var i = 0; i < this.hotspots.length; i++) {
      var el = this.hotspots[i].el; el.classList.add('pano-hs'); el.style.visibility = 'hidden';
      this.layer.appendChild(el);
    }
    this.dirty = true;
  };

  P._place = function () {
    for (var i = 0; i < this.hotspots.length; i++) {
      var h = this.hotspots[i], p = this.project(h.yaw, h.pitch), el = h.el;
      if (!p || !p.visible) { el.style.visibility = 'hidden'; continue; }
      el.style.visibility = 'visible';
      el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0) translate(-50%,-50%)';
    }
  };

  // ---- input ----
  P._bind = function () {
    var self = this, root = this.root;
    var moved = 0, downAt = null;
    root.style.touchAction = 'none';
    root.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('.pano-hs, .pano-ui')) return;
      root.setPointerCapture && root.setPointerCapture(e.pointerId);
      self._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0; downAt = { x: e.clientX, y: e.clientY }; self.vy = self.vp = 0;
      self.autorotate = false; root.classList.add('is-drag');
      if (self._pointers.size === 2) self._pinch = self._dist();
    });
    root.addEventListener('pointermove', function (e) {
      var p = self._pointers.get(e.pointerId); if (!p) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (self._pointers.size === 2) {
        var d = self._dist();
        if (self._pinch) self.setView(null, null, self.fov * self._pinch / d);
        self._pinch = d; moved = 99; return;
      }
      moved += Math.abs(dx) + Math.abs(dy);
      var k = self.fov / self.H;
      self.vy = -dx * k; self.vp = dy * k;
      self.setView(self.yaw - dx * k, self.pitch + dy * k);
    });
    var up = function (e) {
      var had = self._pointers.delete(e.pointerId);
      if (!had) return;
      root.classList.remove('is-drag');
      if (self._pointers.size < 2) self._pinch = 0;
      if (moved < 5 && downAt && self.onPick && e.type === 'pointerup') {
        var r = root.getBoundingClientRect();
        var a = self.screenToAngles(e.clientX - r.left, e.clientY - r.top);
        self.onPick(a.yaw, a.pitch);
      }
      if (moved < 5) { self.vy = self.vp = 0; }
      self.root.dispatchEvent(new CustomEvent('panointeract'));
    };
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    root.addEventListener('wheel', function (e) {
      e.preventDefault(); self.autorotate = false;
      self.setView(null, null, self.fov + clamp(e.deltaY, -60, 60) * 0.06);
    }, { passive: false });
    root.addEventListener('keydown', function (e) {
      var s = 6, m = true;
      if (e.key === 'ArrowLeft') self.setView(self.yaw - s); else if (e.key === 'ArrowRight') self.setView(self.yaw + s);
      else if (e.key === 'ArrowUp') self.setView(null, self.pitch + s); else if (e.key === 'ArrowDown') self.setView(null, self.pitch - s);
      else if (e.key === '+' || e.key === '=') self.setView(null, null, self.fov - 6); else if (e.key === '-') self.setView(null, null, self.fov + 6);
      else m = false;
      if (m) { e.preventDefault(); self.autorotate = false; }
    });
  };
  P._dist = function () {
    var a = Array.from(this._pointers.values());
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
  };

  P._loop = function (now) {
    if (!this.alive) return;
    requestAnimationFrame(this._loop);
    var dt = Math.min(0.05, (now - this._last) / 1000); this._last = now;
    if (this._pointers.size === 0) {
      if (Math.abs(this.vy) > 0.01 || Math.abs(this.vp) > 0.01) {
        this.setView(this.yaw + this.vy, this.pitch + this.vp);
        var damp = Math.pow(0.0015, dt); this.vy *= damp; this.vp *= damp;
      } else if (this.autorotate && !this.busy) { this.setView(this.yaw + 5 * dt); }
    }
    if (!this.dirty || !this.texture) return;
    this.dirty = false;
    if (this.yaw > 180) this.yaw -= 360; else if (this.yaw < -180) this.yaw += 360;
    var gl = this.gl, u = this.u;
    gl.uniform2f(u.res, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.yaw, this.yaw * RAD); gl.uniform1f(u.pitch, this.pitch * RAD); gl.uniform1f(u.fov, this.fov * RAD);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this._place();
    if (this.onChange) this.onChange(this);
  };

  P.destroy = function () {
    this.alive = false;
    if (this._ro) this._ro.disconnect();
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    var ext = this.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    if (this.layer.parentNode) this.layer.parentNode.removeChild(this.layer);
  };

  window.BSBPano = BSBPano;
})();
