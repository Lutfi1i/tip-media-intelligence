# TIP Media Intelligence

> Sistem Deteksi Dini & Respon Krisis Berbasis AI untuk Pimpinan Eksekutif  
> PT Technosoft Indo Prima

Platform pemantauan berita dan percakapan publik per wilayah dan kata kunci, menganalisis sinyal dengan AI, memvalidasi isu melalui analis (human-in-the-loop), serta mendistribusikan alert terverifikasi ke pimpinan beserta pelacakan tindak lanjut dan laporan berkala.

---

## 1. Arsitektur & Alur Kerja Sistem

```
[Sumber Berita, RSS, Situs Resmi, Pengaduan]
                      │
                      ▼
        [Deduplikasi & MinHash Similarity]
                      │
                      ▼
           [Pipeline Analitik AI]
  ├─ Klasifikasi Sentimen (Positif, Netral, Negatif, Campuran, Tidak Pasti)
  ├─ Klasifikasi Topik Taksonomi (Bencana, Infrastruktur, Pelayanan, dll)
  ├─ Ekstraksi Wilayah (Gazetteer Kemendagri: Kejadian vs Disebut)
  └─ Ekstraksi Fakta & Ringkasan Isu
                      │
                      ▼
     [Deteksi Lonjakan (Rolling Baseline + Z-Score)]
                      │
                      ▼
   [Perhitungan Skor Risiko 0-100 (6 Faktor Berbobot)]
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
   [Low / Medium]            [High / Critical]
         │                         │
         │                         ▼
         │             [Antrean Verifikasi Analis]
         │                         │
         │           ┌─────────────┴─────────────┐
         │           ▼ (Tolak)                   ▼ (Verifikasi / Koreksi)
         │       [Diarsipkan]              [Dispatch Alert Eksekutif]
         │                                       │
         ▼                                       ▼
  [Dashboard Pimpinan & Peta] ◄──────── [Papan Kasus & Pelacakan SLA]
                                                 │
                                                 ▼
                                     [Laporan Eksekutif PDF / HTML]
```

---

## 2. Pemenuhan Kebutuhan Fungsional (PRD Tahap 1)

| ID | Modul | Status | Implementasi Teknis |
|---|---|---|---|
| **FR-01** | Konfigurasi Profil | Selesai | Admin dapat membuat/mengatur nama profil, wilayah, kata kunci, sinonim, pengecualian, dan ambang lonjakan alert. |
| **FR-02** | Versi Profil | Selesai | Setiap modifikasi profil menaikkan nomor versi (`versi += 1`) dan mencatat rekam audit. |
| **FR-03** | Uji Retrospektif 7 Hari | Selesai | Endpoint `POST /api/v1/profiles/{id}/test-7d` menguji parameter terhadap riwayat konten sebelum diaktifkan. |
| **FR-04** | Registri Sumber Data | Selesai | Model data `Source` mencatat URL/feed, jenis sumber, frekuensi, rate limit, kredibilitas, dan status izin resmi. |
| **FR-05** | Pengumpulan Konten | Selesai | Service `ingestion.py` memeriksa status izin, deduplikasi konten, ekstraksi metadata, dan penanganan kesalahan. |
| **FR-06** | Metadata Konten | Selesai | Penyimpanan URL kanonik, judul, isi, waktu terbit, waktu ambil, penerbit, dan penulis. |
| **FR-07** | Deduplikasi & Repost | Selesai | Hash SHA-256 untuk duplikat persis dan MinHash 3-gram Jaccard similarity untuk near-duplicate. Repost dihitung terpisah sebagai indikator sebaran. |
| **FR-08** | Analisis Sentimen | Selesai | Klasifikasi sentimen Bahasa Indonesia (positif, netral, negatif, campuran, tidak pasti) disertai nilai keyakinan (confidence). |
| **FR-09** | Klasifikasi Topik | Selesai | Klasifikasi taksonomi instansi: Bencana, Infrastruktur, Pelayanan Publik, Keamanan, Ekonomi, Kesehatan. |
| **FR-10** | Ekstraksi Lokasi | Selesai | Pencocokan gazetteer Kemendagri untuk wilayah pilot DKI Jakarta & Bodetabek (kelurahan, kecamatan, kota). |
| **FR-11** | Ringkasan Isu | Selesai | Ekstraksi pokok fakta, pihak terlibat, hal yang belum diketahui, dan tautan sumber asli. |
| **FR-12** | Pengelompokan Isu | Selesai | Relasi `issue_items` yang mengelompokkan banyak konten berita/aduan ke satu isu induk. |
| **FR-13** | Deteksi Lonjakan | Selesai | Penghitungan baseline bergerak per profil dan evaluasi z-score lonjakan (ambang default >= 3x baseline). |
| **FR-14** | Skor Risiko Transparan | Selesai | Perhitungan 6 faktor berbobot: Relevansi (25%), Pertumbuhan vs baseline (20%), Dampak (20%), Jangkauan (15%), Kredibilitas (10%), Sentimen (10%). Level: CRITICAL, HIGH, MEDIUM, LOW. |
| **FR-15** | Verifikasi Analis | Selesai | Antrean human-in-the-loop bagi analis untuk memeriksa sumber, mengoreksi label AI, atau menolak false alarm. |
| **FR-16** | Distribusi Alert | Selesai | Alert High/Critical hanya terkirim setelah verifikasi analis via WhatsApp, Telegram, dan Email. |
| **FR-17** | Pengakuan Alert & SLA | Selesai | Pimpinan dapat mengakui alert (`acknowledge`), memicu pembentukan tiket kasus dengan tenggat waktu respons. |
| **FR-18** | Manajemen Kasus | Selesai | Papan Kanban kasus (Menunggu, Ditangani, Selesai), penugasan PIC, hitung mundur SLA, unggah bukti penanganan. |
| **FR-19** | Dashboard Eksekutif | Selesai | 4 KPI utama, grafik tren 7 hari (volume & % negatif), daftar isu prioritas, dan peta sebaran wilayah. |
| **FR-20** | Laporan Otomatis | Selesai | Generator dokumen briefing HTML/PDF harian dan mingguan dengan ringkasan eksekutif, tabel sebaran, dan status kasus. |
| **FR-21** | Pencarian & Filter | Selesai | Filter multi-dimensi berdasarkan status, level risiko, wilayah, dan pencarian teks judul/ringkasan. |
| **FR-22** | Kontrol Hak Akses | Selesai | Role switcher dan otorisasi multi-peran (Pimpinan, Analis, Supervisor, PIC Unit, Admin, Auditor). |
| **FR-23** | Audit Trail | Selesai | Log append-only yang mencatat setiap aksi aktor, peran, objek, IP, dan timestamp. |
| **FR-24** | Evaluasi Akurasi AI | Selesai | Rekapitulasi metrik presisi sentimen, topik, dan lokasi dari hasil verifikasi/koreksi analis (Target NFR-12 >= 80%). |

---

## 3. Struktur Direktori Proyek

```
tip-media-intelligence/
├── backend/
│   ├── app/
│   │   ├── config.py             # Konfigurasi aplikasi & ambang batas
│   │   ├── database.py           # Engine & Session database SQLAlchemy
│   │   ├── models.py             # 13 entitas model data relasional
│   │   ├── schemas.py            # Pydantic schemas (request & response)
│   │   ├── seed_data.py          # Data awal wilayah Kemendagri & skenario pilot
│   │   ├── main.py               # Entrypoint FastAPI & registrasi router
│   │   ├── services/
│   │   │   ├── ai_analyzer.py    # Pipeline analisis AI Bahasa Indonesia
│   │   │   ├── anomaly_detector.py # Deteksi lonjakan z-score & baseline
│   │   │   ├── audit.py          # Logger jejak audit immutable
│   │   │   ├── dedup.py          # MinHash Jaccard & hash deduplikasi
│   │   │   ├── ingestion.py      # Pipeline pengambilan & pembersihan konten
│   │   │   ├── notification.py   # Pengiriman alert multi-kanal
│   │   │   ├── report_generator.py # Template engine laporan eksekutif
│   │   │   └── risk_scorer.py    # Mesin hitung 6 faktor skor risiko
│   │   └── routers/
│   │       ├── alerts.py
│   │       ├── audit.py
│   │       ├── cases.py
│   │       ├── dashboard.py
│   │       ├── issues.py
│   │       ├── profiles.py
│   │       ├── reports.py
│   │       ├── simulation.py     # Simulator skenario Banjir Kemang Slide 14-16
│   │       └── sources.py
│   ├── tests/                    # Pengujian unit pytest
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Dashboard Eksekutif (Slide 8)
│   │   │   ├── peta/page.tsx     # Peta Wilayah Choropleth (Slide 9)
│   │   │   ├── monitoring/page.tsx # Konfigurasi Profil Monitoring (Slide 10)
│   │   │   ├── isu/page.tsx      # Antrean Isu & Alert
│   │   │   ├── isu/[id]/page.tsx # Detail Isu & Verifikasi Analis (Slide 11)
│   │   │   ├── kasus/page.tsx    # Papan Kasus Kanban & Notifikasi (Slide 12)
│   │   │   ├── laporan/page.tsx  # Laporan Eksekutif PDF/HTML (Slide 13)
│   │   │   └── audit/page.tsx    # Audit Trail & Evaluasi AI
│   │   ├── components/
│   │   │   └── Navigation.tsx    # Navigasi utama & Role Switcher
│   │   └── lib/
│   │       └── api.ts            # Klien integrasi API backend
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
├── DESIGN.md                     # Panduan desain & token visual
├── docker-compose.yml
├── start_backend.bat
└── start_frontend.bat
```

---

## 4. Cara Menjalankan Aplikasi

### Opsi A: Menggunakan Script Launcher Lokal

#### 1. Jalankan Backend (FastAPI):
```powershell
# Di terminal 1:
.\start_backend.bat
# Atau:
backend\venv\Scripts\uvicorn backend.app.main:app --reload --reload-dir backend --host 127.0.0.1 --port 8001
```
Backend akan aktif di `http://127.0.0.1:8001`. Dokumentasi OpenAPI Swagger interaktif tersedia di: `http://127.0.0.1:8001/docs`.

#### 2. Jalankan Frontend (Next.js):
```powershell
# Di terminal 2:
.\start_frontend.bat
# Atau:
npm --prefix frontend run dev
```
Buka peramban di: `http://localhost:3000`.

---

### Opsi B: Menggunakan Docker Compose
```bash
docker compose up --build
```
Aplikasi frontend akan tersedia di `http://localhost:3000` dan backend di `http://localhost:8000`.

---

## 5. Menjalankan Pengujian Unit Backend

Jalankan test suite menggunakan pytest:
```powershell
backend\venv\Scripts\python -m pytest backend/tests -v
```

---

## 6. Skenario Studi Kasus Interaktif (Slide 14 - 16)

Anda dapat menguji skenario lengkap "Banjir Pagi Hari di Jakarta Selatan" secara langsung:
1. Klik tombol **"Skenario Demo"** di navigasi kanan atas pada dashboard web.
2. Sistem akan menyimulasikan:
   - **05.40**: Lonjakan 85 mention terdeteksi (8x dari baseline normal).
   - **05.42**: Data dirapikan menjadi 12 konten unik.
   - **05.45**: Analisis AI memetakan lokasi ke Kemang & Pejaten dengan sentimen negatif 82%.
   - **05.47**: Skor risiko terhitung 78 (HIGH) dari 6 faktor berbobot.
   - **05.55**: Analis memverifikasi fakta dan kondisi pompa stasioner.
   - **06.05**: Alert dikirim ke pimpinan via WhatsApp dan Telegram.
   - **06.30 - 09.00**: Tiket kasus aktif dipantau di papan Kanban dengan countdown SLA dan lampiran dokumentasi hingga status selesai.
