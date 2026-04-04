# Frontend – whispr (Pesan Anonim)

Frontend untuk aplikasi **whispr** – platform pengiriman pesan anonim.  
Pengguna dapat membuat akun, mendapatkan link pribadi (`/@slug`), menerima pesan anonim, serta mengelolanya melalui dashboard.  
Frontend ini merupakan **single-page application (SPA)** murni dalam satu file `index.html` tanpa framework frontend, menggunakan vanilla JavaScript, Tailwind CSS, dan Cloudflare Turnstile untuk proteksi spam.

## ✨ Fitur

- Registrasi & login pengguna
- Dashboard dengan:
  - Link anonim unik (dapat disalin & dibagikan)
  - Statistik jumlah pesan masuk
  - Daftar pesan anonim (dengan status **belum dibaca / sudah dibaca**)
  - **Danger zone**: hapus semua pesan, hapus akun permanen
- Halaman publik `/@slug` untuk menerima pesan anonim
- Proteksi spam menggunakan **Cloudflare Turnstile**
- Tampilan pesan modal penuh (fullscreen viewer)
- Status baca pesan disimpan di `localStorage` per pengguna

## 🧱 Teknologi & Library

- **HTML5 / CSS3 / Vanilla JS** – tanpa build tools
- **Tailwind CSS** (via CDN) – styling cepat
- **Google Fonts** – Syne & DM Mono
- **Cloudflare Turnstile** – captcha modern (tanpa interaksi pengguna)
- **LocalStorage** – session & status baca pesan

## 📁 Struktur Folder

```

ANONYMOUS/
├── BACKUPS/
├── api/
│   ├── clear-messages.js
│   ├── delete-account.js
│   ├── login.js
│   ├── messages.js
│   ├── profile.js
│   ├── register.js
│   ├── send.js
├── index.js
├── node_modules/
├── package.json
├── package-lock.json
└── public/
     └── index.html          # Seluruh frontend (HTML, CSS, JS inline)
```

> Tidak ada file lain karena frontend dikemas dalam satu file.  
> Untuk pengembangan, cukup jalankan `index.html` melalui live server.

## 🚀 Cara Menjalankan

### Prasyarat
- Backend API whispr harus berjalan (lihat repositori backend)
- Ganti `data-sitekey` Turnstile dengan site key Anda sendiri

### Langkah-langkah

1. **Clone repositori** (atau salin file `index.html`)
2. **Letakkan di dalam folder frontend** (misal: `whispr/frontend/index.html`)
3. **Jalankan menggunakan live server** (disarankan agar API dapat diakses):
   ```bash
   npx live-server frontend --port=5500
```

atau gunakan ekstensi "Live Server" di VS Code.

1. Pastikan backend berjalan di http://localhost:3000 (atau ubah endpoint API di script jika perlu).
2. Buka http://localhost:5500

🔧 Konfigurasi

Endpoint API

Secara default, frontend memanggil endpoint relatif:

· POST /api/register
· POST /api/login
· GET /api/messages?username=...
· POST /api/send
· GET /api/profile?slug=...
· POST /api/clear-messages
· POST /api/delete-account

Jika backend berjalan di port/domain berbeda, ubah semua fetch() di dalam file index.html.

Cloudflare Turnstile

Di halaman kirim pesan (/@slug), terdapat widget Turnstile.
Ganti data-sitekey dengan site key Anda:

```html
<div id="captcha-widget" class="cf-turnstile" 
     data-sitekey="xxxxx"
     data-theme="light"></div>
```

Daftar site key di Cloudflare Turnstile.

📝 Catatan Penting

· Status baca pesan disimpan di localStorage dengan kunci whispr_read_<username>.
    Menghapus localStorage akan mereset status baca, tetapi tidak menghapus pesan di server.
· Tidak ada framework frontend – semua routing manual berdasarkan window.location.pathname.
· Halaman 404 ditampilkan jika slug tidak ditemukan.
· Untuk keamanan, backend harus memvalidasi token Turnstile dan melakukan hashing password.

📄 Lisensi

Frontend ini bagian dari proyek whispr – bebas digunakan untuk keperluan belajar dan non-komersial.
