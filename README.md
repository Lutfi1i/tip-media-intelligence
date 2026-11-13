# TIP Media Intelligence

> Sistem Deteksi Dini, Pemantauan Isu Publik & Respon Krisis Berbasis AI  
> PT Technosoft Indo Prima

Platform pemantauan berita nasional/daerah dan percakapan media sosial secara real-time per wilayah Kemendagri, dilengkapi analisis sentimen dan risiko berbasis AI, verifikasi analis (human-in-the-loop), papan kasus SLA, serta pembuatan laporan eksekutif PDF/HTML bergaya kedinasan.

---

## 1. Fitur Utama

- **Dashboard Eksekutif & Peta Wilayah**: Ringkasan KPI, grafik tren, dan peta sebaran isu per provinsi/kabupaten/kota (kode wilayah Kemendagri).
- **Monitoring Feed & Social Pulse**: Pemantauan berita RSS/portal resmi serta percakapan sosial (X, TikTok, Instagram, Facebook, Reddit, Telegram, Bluesky) beserta analisis lonjakan (z-score) dan co-occurrence tagar.
- **Antrean Isu & Verifikasi Analis**: Penilaian skor risiko 0-100 (LOW, MEDIUM, HIGH, CRITICAL) dengan alur verifikasi analis sebelum distribusi alert.
- **Papan Kasus & SLA**: Pengelolaan tindak lanjut kasus (Menunggu, Ditangani, Selesai), penugasan PIC, hitung mundur SLA, dan unggah bukti penanganan.
- **Laporan Eksekutif (HTML & PDF Kedinasan)**: Pembuatan laporan harian, mingguan, bulanan, dan insidentil dengan kop surat resmi, penomoran dokumen, tabel prioritas/wilayah, dan blok pengesahan 3 kolom.
- **Tata Kelola (Audit Trail & RBAC)**: Pencatatan log aktivitas dan manajemen pengguna berbasis peran (`admin`, `analis`, `verifikator`, `eksekutif`, `auditor`) beserta cakupan wilayah.

---

## 2. Struktur Proyek

```text
tip-media-intelligence/
├── backend/
│   ├── app/
│   │   ├── main.py                # Entrypoint FastAPI & registrasi router
│   │   ├── config.py              # Pengaturan environment (.env)
│   │   ├── database.py            # Koneksi SQLAlchemy (PostgreSQL / SQLite)
│   │   ├── models.py              # Model database
│   │   ├── celery_app.py          # Worker & scheduler Celery (opsional/Docker)
│   │   ├── routers/               # Endpoint REST API (/api/v1/...)
│   │   └── services/              # Collector, AI engine, dedup, report PDF, auth, dll.
│   ├── scripts/                   # Skrip migrasi SQLite -> PostgreSQL & backup
│   ├── tests/                     # Pengujian unit pytest
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/app/                   # Halaman Next.js (App Router)
│   ├── src/components/            # Komponen UI dashboard, peta, feed, navigasi
│   ├── src/lib/                   # API client & helper format waktu WIB/WITA/WIT
│   ├── Dockerfile
│   └── package.json
├── .env.example                   # Template konfigurasi environment
├── docker-compose.yml             # Orkestrasi PostgreSQL, Redis, MinIO, Backend, Frontend
├── start_backend.bat              # Launcher cepat backend lokal (Windows)
└── start_frontend.bat             # Launcher cepat frontend lokal (Windows)
```

---

## 3. Cara Setup & Menjalankan Aplikasi

Pilih salah satu dari dua cara di bawah ini sesuai kebutuhan Anda.

### Opsi A: Setup Lokal Cepat (Tanpa Docker, Memakai SQLite)

Cocok untuk pengembangan atau uji coba cepat di laptop Windows tanpa perlu menjalankan PostgreSQL/Redis/Docker.

#### Langkah 1: Siapkan File `.env`
Salin file `.env.example` menjadi `.env`, lalu ubah bagian database agar memakai SQLite:

```powershell
Copy-Item .env.example .env
```

Buka `.env`, beri tanda `#` pada baris `postgresql`, dan aktifkan baris `sqlite`:
```env
# DATABASE_URL=postgresql+psycopg2://tip_user:tip_password@localhost:5432/tip_media
DATABASE_URL=sqlite:///./tip_media.db
```

*(Opsional)* Jika ingin memakai fitur analisis AI eksternal, isi `AI_API_KEY`, `AI_BASE_URL`, dan `AI_MODEL_NAME` di `.env`.

#### Langkah 2: Setup & Jalankan Backend (Python 3.10+)
Buka Terminal 1 di folder root proyek:

```powershell
python -m venv backend\venv
backend\venv\Scripts\activate
pip install -r backend\requirements.txt
```

Jalankan server backend:
```powershell
.\start_backend.bat
```
Atau jalankan manual:
```powershell
backend\venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --reload-dir backend --host 127.0.0.1 --port 8001
```
Backend akan aktif di `http://127.0.0.1:8001` (dokumentasi API Swagger tersedia di `http://127.0.0.1:8001/docs`).

#### Langkah 3: Setup & Jalankan Frontend (Node.js 18+)
Buka Terminal 2 di folder root proyek:

```powershell
npm --prefix frontend install
.\start_frontend.bat
```
Frontend akan berjalan di `http://localhost:3000`.  
*(Jika ingin menjalankan di port 3001, gunakan `npm --prefix frontend run dev -- -p 3001`.)*

---

### Opsi B: Setup Lengkap dengan Docker Compose (Produksi / Tim)

Cocok jika Anda ingin menjalankan stack lengkap: **PostgreSQL 16 (pgvector)**, **Redis**, **MinIO (S3)**, **Celery Worker & Beat**, **Backend**, dan **Frontend**.

#### Langkah 1: Siapkan File `.env`
Salin `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Pastikan `DATABASE_URL` di `.env` mengarah ke PostgreSQL (pengaturan default di `.env.example`), dan isi kredensial/API key yang dibutuhkan.

#### Langkah 2: Build dan Jalankan Container
```bash
docker compose up --build -d
```
Setelah semua container aktif:
- **Frontend**: `http://localhost:3001`
- **Backend API & Docs**: `http://localhost:8001/docs`
- **MinIO Console**: `http://localhost:9001`

*(Opsional)* Untuk menyalakan layanan tambahan OpenSearch atau Keycloak:
```bash
docker compose --profile search --profile auth-idp up -d
```

---

## 4. Penjelasan Variabel Penting di `.env`

| Variabel | Fungsi | Nilai Default / Contoh |
|---|---|---|
| `DATABASE_URL` | Lokasi database utama | `sqlite:///./tip_media.db` (lokal) atau `postgresql+psycopg2://...` (Docker) |
| `AUTH_REQUIRED` | Wajib login untuk akses dashboard/API | `false` (langsung masuk) atau `true` (wajib login JWT) |
| `SECRET_KEY` | Kunci penandatanganan token JWT | String acak minimal 32 karakter |
| `AI_API_KEY` | API Key LLM untuk analisis sentimen & ringkasan | Kosongkan jika hanya memakai fallback lokal |
| `S3_ENDPOINT` | Endpoint MinIO/S3 untuk arsip PDF & bukti kasus | `http://localhost:9000` (otomatis fallback ke folder `storage/` jika MinIO mati) |
| `SOCIAL_WEBHOOK_SECRET` | Secret header `X-Webhook-Secret` untuk webhook partner sosial | Isi string rahasia jika menerima webhook eksternal |

---

## 5. Menjalankan Pengujian Backend

Pastikan virtual environment backend sudah terpasang, lalu jalankan:

```powershell
backend\venv\Scripts\python.exe -m pytest backend\tests -v
```
