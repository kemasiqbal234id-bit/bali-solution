'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let sharp = null;
try { sharp = require('sharp'); } catch (_) { /* opsional: tanpa sharp, foto disimpan apa adanya */ }

const PRESETS = {
  project: { width: 1800, quality: 78, thumb: 640 },
  hero: { width: 2200, quality: 74, thumb: 0 },
  pano: { width: 4096, quality: 80, thumb: 480 },
};

function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

async function save(buf, kind, uploadDir) {
  const preset = PRESETS[kind];
  if (!preset) throw new Error('Jenis upload tidak dikenal');
  const type = sniff(buf);
  if (!type) throw new Error('Format tidak didukung. Gunakan JPG, PNG atau WebP.');
  const id = crypto.randomBytes(6).toString('hex');
  const base = `${kind}-${id}`;
  fs.mkdirSync(uploadDir, { recursive: true });

  if (!sharp) {
    const name = `${base}.${type}`;
    fs.writeFileSync(path.join(uploadDir, name), buf);
    return { src: '/uploads/' + name, thumb: '/uploads/' + name, w: 0, h: 0, optimized: false };
  }

  const img = sharp(buf, { failOn: 'none', limitInputPixels: 300e6 }).rotate();
  const meta = await sharp(buf, { failOn: 'none' }).rotate().metadata();
  let w = meta.width, h = meta.height;
  if (meta.orientation && meta.orientation >= 5) [w, h] = [h, w];
  if (!w || !h) throw new Error('Gambar tidak bisa dibaca');
  if (kind === 'pano' && (w / h < 1.8 || w / h > 2.2)) {
    throw new Error(`Foto 360° harus berbentuk panorama equirectangular dengan rasio 2:1 (foto ini ${w}×${h}).`);
  }
  const out = await img.resize({ width: preset.width, withoutEnlargement: true })
    .webp({ quality: preset.quality, effort: 4 }).toBuffer({ resolveWithObject: true });
  fs.writeFileSync(path.join(uploadDir, base + '.webp'), out.data);
  let thumb = '/uploads/' + base + '.webp';
  if (preset.thumb) {
    const t = await sharp(buf, { failOn: 'none' }).rotate()
      .resize({ width: preset.thumb, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
    fs.writeFileSync(path.join(uploadDir, base + '-t.webp'), t);
    thumb = '/uploads/' + base + '-t.webp';
  }
  return { src: '/uploads/' + base + '.webp', thumb, w: out.info.width, h: out.info.height, optimized: true };
}

module.exports = { save, hasSharp: () => !!sharp, sharp: () => sharp };
