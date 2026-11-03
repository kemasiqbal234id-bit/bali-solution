# Website Bali Solution Building

Situs perusahaan dengan hero yang membangun gedung saat halaman digulir, galeri proyek, tur 360° antar ruang, dan dashboard admin untuk menambah proyek sendiri. Tanpa framework: hanya Node.js dan HTML/CSS/JS biasa, sehingga ringan dan mudah dirawat.

## Menjalankan di komputer sendiri

1. Pasang Node.js versi 18 atau lebih baru (nodejs.org).
2. Di folder ini jalankan `npm install`, lalu `npm start`.
3. Buka http://localhost:3000 untuk situs, dan http://localhost:3000/admin untuk dashboard.
4. Saat pertama jalan, password admin acak tampil di terminal. Catat, lalu ganti di Pengaturan > Keamanan. Atau isi `ADMIN_PASSWORD` di file `.env` (salin dari `.env.example`).

Di terminal harus tertulis `kompres foto: aktif`. Jika tertulis MATI, jalankan `npm install` lagi (modul `sharp` gagal terpasang). Tanpa itu foto tidak dikecilkan dan situs jadi berat.

## Memakai dashboard

| Menu | Gunanya |
|---|---|
| Proyek | Tambah proyek, pilih banyak foto sekaligus, tentukan foto sampul, urutan, tampil atau sembunyikan. |
| Animasi awal | Opsional: ganti animasi gedung dengan 4 foto tahap pembangunan. |
| Tur 360° | Unggah foto panorama 2:1, letakkan titik pindah ruang dan titik info langsung di foto. |
| Layanan, Testimoni dan angka, Pengaturan | Teks, kontak, nomor WhatsApp, alamat, password. |

Konten awal bertanda "contoh" hanyalah ilustrasi. Hapus semuanya lewat Ringkasan > Hapus semua konten contoh setelah foto asli masuk. Isi angka pencapaian dan testimoni hanya dengan data asli.

Foto 360°: pakai kamera 360° atau fitur Panorama/Photo Sphere di HP. Hasilnya harus rasio 2:1 (equirectangular). Dashboard menolak foto yang rasionya salah.

## Struktur folder

```
server.js          server (login, upload, API, halaman)
lib/               penyimpanan konten, kompres foto, parser upload
public/index.html  halaman situs
public/css/site.css  warna dan font ada di bagian :root paling atas
public/js/site.js  hero, galeri, tur, kontak
public/js/pano.js  viewer 360° (WebGL, tanpa library)
public/admin/      dashboard
data/              ISI SITUS: content.json, uploads/ (foto), backups/
```

Semua yang Anda ubah lewat dashboard tersimpan di folder `data/`. Kode tidak perlu disentuh untuk konten rutin.

## Backup dan perawatan

* Backup cukup menyalin folder `data/` secara berkala. Server juga membuat salinan `content.json` otomatis di `data/backups/` (30 terakhir).
* Pindah server: salin seluruh folder proyek termasuk `data/`, jalankan `npm install` dan `npm start`.
* Mengganti warna atau font: ubah variabel di `:root` pada `public/css/site.css` dan link font di `public/index.html`.
* Foto yang dihapus dari dashboard dibersihkan otomatis dari disk.
* `npm test` menjalankan uji otomatis (login, upload, keamanan, API).

## Memasang online (hosting)

Dashboard butuh server Node.js dengan disk yang tidak terhapus. Hosting statis biasa (hanya HTML) tidak cukup. Pilihan umum: VPS (Niagahoster, IDCloudHost, Hostinger, dan sejenisnya), hosting cPanel yang punya fitur "Setup Node.js App", atau Railway/Render dengan volume persisten. Cara memasang di tiap penyedia berbeda dan belum diuji di sini.

Pengaturan di server produksi:
* Pasang HTTPS (misalnya Nginx dengan Let's Encrypt) lalu set `COOKIE_SECURE=true` dan `SITE_URL=https://domain-anda.com` di `.env`.
* Jalankan dengan pengelola proses seperti `pm2 start server.js --name bsb` agar hidup lagi setelah restart.
* Bila disk hosting direset saat deploy, arahkan `DATA_DIR` ke folder persisten.
* Jangan membuka folder `data/` ke publik. Server hanya melayani `data/uploads`.

## Batasan yang perlu diketahui

* Konten ditampilkan lewat JavaScript. Judul, deskripsi, dan data bisnis untuk Google sudah ada di HTML, tetapi daftar proyek tidak terbaca mesin pencari sebaik halaman statis. Tiap proyek belum punya alamat halaman sendiri.
* Tur 360° memakai WebGL. Browser lama tanpa WebGL melihat pesan pengganti.
* Dashboard memakai satu password (satu admin). Belum ada banyak akun.
