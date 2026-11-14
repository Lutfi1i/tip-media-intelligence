# Rencana: Perubahan ke Social Trend Intelligence

Status: semua 8 menu sudah dibangun (14 November 2026). Tersisa dua langkah yang menunggu persetujuan pemilik (bagian 7).

Arah baru: dari monitoring krisis untuk instansi (isu, verifikasi, kasus SLA) menjadi
pemantauan tren sosial per wilayah dan rekomendasi ide konten, dengan 8 menu:

1. Dashboard
2. Tren Wilayah
3. Live Social Monitoring
4. Konten Viral
5. Hashtag & Keyword
6. Influencer & Akun Populer
7. AI Trend Analysis
8. Laporan & Insight

---

## 1. Keputusan (diambil 14 Nov 2026)

| # | Keputusan | Dampak ke rencana |
|---|---|---|
| K1 | **Modul lama dibiarkan dulu.** | 8 menu baru ditambahkan sebagai grup sendiri di navigasi, di route baru `/tren/...`. Menu lama (Isu, Kasus, Audit, Pengguna, Monitoring Feed) tetap jalan apa adanya. |
| K2 | **Hanya sumber data gratis.** | Metrik engagement hanya dari platform yang menyediakannya gratis: YouTube (yt-dlp, sudah ada), Bluesky (API publik), Reddit (JSON publik), Telegram (views). TikTok, Instagram, X, dan Threads tetap tanpa angka: tampil sebagai tautan dan volume sebutan saja, dengan label "metrik tidak tersedia". Menu Konten Viral dan Influencer dibangun dengan batasan ini. |
| K3 | **AI memakai kunci dari `be_internal_sales`.** | Ternyata itu kunci **OpenAI** (`gpt-4o-mini`), bukan OpenCode. Sudah dipasang di `.env` proyek ini dan diuji valid. Penggunaan ditagih per token ke akun OpenAI tersebut, jadi hasil AI wajib di-cache dan dibatasi frekuensinya. |
| K4 | **Tanpa Facebook.** | Facebook dihapus dari filter platform. |
| K5 | **Cakupan nasional.** | Perlu sumber per provinsi (Google News, GDELT, pencarian YouTube) untuk 38 provinsi. Gazetteer wilayah (`geo_hierarchy.py`) sudah berisi 38 provinsi tetapi baru **112 dari 514 kota/kabupaten**: Pulau Jawa lengkap, 25 provinsi lain hanya ibu kotanya. Postingan hanya bisa dipetakan ke kota yang ada di gazetteer, jadi daftar ini harus dilengkapi (dengan alias) di Fase 1. Tabel `Region` tidak dipakai menu tren. Beban job pengumpulan naik; perlu penjadwalan bergilir. |

## 2. Kondisi data saat ini (dicek 14 Nov 2026)

- 840 item: 454 berita, 386 postingan medsos, rentang 18 Sep sampai 14 Nov 2026.
- Per platform: Instagram 76, Telegram 70, X 64, YouTube 63, TikTok 40, Threads 26, Reddit 26, Bluesky 21. **Facebook 0.**
- **Engagement hampir kosong.** Hanya YouTube yang punya views, likes, dan followers (38 postingan). Bluesky punya likes. TikTok, Instagram, X, dan Threads tidak punya angka apa pun.
- Penyebabnya: TikTok, Instagram, X, dan Threads diambil lewat pencarian Google News `site:tiktok.com ...`. Yang didapat hanya judul dan tautan halaman yang sudah terindeks, bukan metrik, dan biasanya terlambat beberapa jam sampai hari.
- Hierarki wilayah Kemendagri sudah lengkap sampai kelurahan (Kota Bogor 32.71, Kabupaten Bogor 32.01, dan seterusnya), lewat `/social-pulse/geo/hierarchy` dan `/geo/search`.
- Kategori topik sudah mencakup Kuliner, Wisata & Event, Hiburan & Viral, Olahraga, Teknologi, dan kategori layanan publik.
- Sudah ada: tren dengan laju terhadap baseline, live feed per lokasi, pencarian konten dan ekspor CSV, akun pantauan, peta panas, perbandingan periode dan wilayah, tagar yang dipakai bersama, jejak penyebaran, ringkasan (brief), dan laporan PDF.

Kesimpulan: menu 1, 2, 3, 5, dan 8 bisa dibangun dari data yang ada. Menu 7 bisa (kunci AI sudah terpasang). Menu 4 dan 6 dibangun dari platform bermetrik gratis saja (K2).

---

## 3. Pemetaan menu ke kondisi sekarang

| Menu | Yang sudah ada | Yang perlu dibangun | Bisa dengan data sekarang? |
|---|---|---|---|
| 1. Dashboard | `overview`, `trends`, `platforms`, `heatmap` | Kartu ringkas: total tren hari ini, tren naik, topik teratas, platform teraktif, wilayah teraktif, tren mulai viral, rekomendasi topik | Ya, kecuali "rekomendasi" yang butuh AI (K3) |
| 2. Tren Wilayah | Hierarki wilayah, filter scope, `trends` per wilayah | Halaman per wilayah: top 10 tren lokal, berita ramai, dan bagian per kategori (kuliner, wisata/event, keluhan, komunitas). Tabel Topik / Kategori / Tren | Ya, tapi tipis di luar Jabodetabek (K5) |
| 3. Live Social Monitoring | `live-feed`, `stream`, sentimen, emosi | Panel: jumlah postingan dan interaksi, porsi sentimen, kata yang sering muncul, sumber platform, waktu, lokasi | Ya. Jumlah interaksi hanya akurat untuk YouTube |
| 4. Konten Viral | `search` dengan urutan engagement | Kartu konten: views, likes, komentar, shares, kecepatan pertumbuhan. Jenis media (video/foto) | **Tidak** (K2). Butuh metrik per platform dan snapshot berkala |
| 5. Hashtag & Keyword | `trends` (kunci `#tag`, `p:frasa`), tagar co-occurrence | Daftar tagar dan keyword trending, keyword lokal, keyword mulai naik, perbandingan beberapa keyword, grafik riwayat | Ya. Riwayat butuh tabel agregat harian (bagian 5) |
| 6. Influencer & Akun Populer | `watched-accounts` (aktivitas dan sebutan) | Peringkat akun per wilayah dan platform, pertumbuhan followers, engagement rate, rata-rata views, kategori konten | **Tidak** (K2). Followers hanya ada di YouTube, dan pertumbuhan butuh riwayat |
| 7. AI Trend Analysis | `brief`, `ai-insight`, prompt di `ai_prompts.py` | Ringkasan tren, deteksi tren baru, analisis penyebab, ide konten, caption dan hashtag, brief video | Sebagian. Deteksi tren dan sentimen sudah ada; bagian generatif butuh K3 |
| 8. Laporan & Insight | Laporan PDF kedinasan, laporan Social Pulse | Laporan tren harian/mingguan/bulanan, perbandingan wilayah dan platform, grafik, **ekspor Excel** | Ya. Excel butuh `openpyxl` |

---

## 4. Tahapan

### Fase 0: Fondasi (selesai 14 Nov 2026)
- Grup navigasi baru "Tren Sosial" berisi 8 menu di `/tren`, `/tren/wilayah`, `/tren/live`, `/tren/viral`, `/tren/hashtag`, `/tren/akun`, `/tren/ai`, `/tren/laporan`. Menu lama tetap (K1).
- **Filter global** yang dipakai bersama semua menu tren dan tersimpan di URL:
  - Lokasi: pemilih wilayah bertingkat (Indonesia, provinsi, kota/kabupaten). Komponen `GeographicScopeSelector` sudah ada.
  - Periode: Hari ini, 7 hari, 30 hari. "Hari ini" berarti sejak 00:00 WIB, beda dengan "24 jam" yang dipakai sekarang.
  - Platform: TikTok, Instagram, YouTube, Threads, X (tanpa Facebook, K4).
- Satu endpoint bundel per menu agar tiap halaman cukup satu permintaan.
- Selesai: periode `today` di backend (sejak 00.00 WIB, dibandingkan jam yang sama 7 hari sebelumnya), grup navigasi "Tren Sosial" (menu yang belum dibangun tampil "Segera"), filter global di `lib/trendFilters.ts` + `TrendFiltersContext`, dan menu Dashboard Tren di `/tren`.
- Catatan: pengumpulan medsos baru berjalan sejak 12 Nov 2026, jadi baseline laju belum penuh dan sebagian besar tren berstatus "Baru muncul". Dashboard menampilkan peringatan ini.

### Fase 1: Menu dari data yang ada (sekitar 1-1,5 minggu)
- **Backend**: lengkapi gazetteer ke 514 kota/kabupaten beserta alias (K5).
- **Dashboard**: 6 kartu KPI, daftar tren naik, wilayah teraktif, dan "mulai viral" (laju tinggi dengan volume masih kecil).
- **Tren Wilayah**: halaman per wilayah dengan top 10 tren lokal dan bagian per kategori.
  - "Keluhan masyarakat" = sentimen negatif di kategori layanan publik, air, listrik, transportasi, dan sampah.
  - "Tempat viral" butuh ekstraksi nama tempat; versi awal memakai frasa dari kategori Kuliner dan Wisata.
- **Live Social Monitoring**: pakai ulang live feed, tambah panel statistik dan awan kata.
- **Hashtag & Keyword**: daftar trending, keyword mulai naik, perbandingan sampai 4 keyword, riwayat 30 hari.

### Fase 2: AI dan laporan (sekitar 1 minggu, setelah K3)
- **AI Trend Analysis**: ringkasan per tren, analisis penyebab viral, ide konten, caption dan hashtag, brief video.
  - Setiap keluaran AI harus menampilkan postingan sumbernya, supaya bisa dicek dan tidak mengarang.
  - "Prediksi tren" ditampilkan sebagai proyeksi dari laju saat ini, dengan label jelas bahwa itu perkiraan.
- **Laporan & Insight**: laporan tren harian, mingguan, bulanan; perbandingan wilayah dan platform; ekspor PDF dan Excel.

### Fase 3: Sumber data gratis dan menu bermetrik (K2, K5)
- Adaptor baru: Bluesky (API publik: likes, reposts, replies, followers) dan Reddit (JSON publik: skor, komentar). YouTube dan Telegram sudah ada.
- Sumber nasional: kueri Google News dan pencarian YouTube per provinsi, dijadwalkan bergilir.
- Snapshot metrik berkala (misalnya tiap jam) untuk kecepatan pertumbuhan engagement dan followers.
- **Konten Viral** dan **Influencer & Akun Populer** dari platform bermetrik. Platform tanpa metrik tampil dengan label "metrik tidak tersedia", bukan angka 0.

### Fase 4: Rapikan
- Tinjauan antislop (UI, copy, mobile) sesuai AGENTS.md: tanyakan dulu apakah dilakukan selama atau setelah pengerjaan.
- Uji di layar 360px, dark mode, dan dengan data kosong.

---

## 5. Perubahan backend yang diperlukan

- **Tabel agregat harian** `keyword_daily (tanggal, kode_wilayah, platform, kunci, jumlah, akun_unik, sentimen)` untuk riwayat tren dan perbandingan keyword. Diisi job terjadwal; hitung ulang dari data lama sekali di awal.
- **Tabel snapshot metrik** `post_metrics_snapshot` dan `account_metrics_snapshot` (Fase 3).
- **Periode "hari ini"** di `_load_dataset` (saat ini hanya 24h/7d/30d).
- **Kolom jenis media** (video, foto, teks) di `RawItem`, diisi dari URL atau metadata adaptor.
- **Ekstraksi nama tempat** sederhana (gazetteer POI atau pola frasa) untuk "tempat viral".
- **Ekspor Excel** dengan `openpyxl` di endpoint laporan dan pencarian.
- **Sumber baru** per wilayah untuk Bandung, Sukabumi, dan wilayah lain sesuai K5.

---

## 6. Risiko

- **Data tipis.** 386 postingan dalam 2 bulan, sebagian besar Jabodetabek. "Top 10 tren lokal" untuk satu kota sering hanya berisi beberapa topik. UI harus jujur menampilkan jumlah data, bukan mengisi kekosongan dengan contoh.
- **Angka engagement palsu.** Jangan menampilkan views atau likes untuk platform yang tidak punya datanya. Tampilkan "tidak tersedia", bukan 0.
- **Syarat layanan platform.** Scraping TikTok dan Instagram melanggar syarat layanannya dan rawan diblokir, jadi tidak dilakukan (K2).
- **Biaya AI.** OpenAI ditagih per token ke akun `be_internal_sales`. Cache hasil per tren dan periode, batasi pemanggilan per menit, dan catat pemakaian.
- **Halusinasi AI.** Rekomendasi dan analisis penyebab harus menyertakan sumber dan ditandai sebagai keluaran AI.
- **Fitur lama.** Kalau modul krisis dihapus (K1), endpoint dan tesnya juga perlu dibersihkan agar tidak jadi kode mati.

---

## 7. Status dan langkah berikutnya

Selesai (branch `feat/ui-ux-perbaikan`):
- Gazetir nasional 514 kota/kabupaten, filter provinsi mencakup kotanya, kode Papua diperbaiki.
- API `/api/v1/tren/*` dan 8 halaman di `/tren`, analisis AI dengan cache dan batas 30 panggilan per jam.
- Ekspor laporan PDF (fpdf2) dan Excel (openpyxl).

Menunggu persetujuan pemilik, karena mengubah database dan menyalakan pengambilan data otomatis ke Google News:
1. Tambahkan sumber medsos per provinsi (37 sumber, frekuensi 60 menit):
   `backend/venv/bin/python -m backend.scripts.seed_national_social_sources` (batalkan dengan `--hapus`).
2. Nyalakan pengumpulan otomatis: tambahkan `AUTO_COLLECT_MINUTES=10` ke `.env`, lalu restart backend.
   Tanpa ini data hanya bertambah saat tombol "Tarik Berita Nyata" diklik, sehingga periode "Hari ini"
   sering kosong dan baseline laju tidak pernah terisi.

Belum dikerjakan (di luar sumber gratis):
- Metrik TikTok, Instagram, X, dan Threads. Reddit JSON publik tidak dipakai karena syarat API Reddit
  mewajibkan OAuth untuk aplikasi.
