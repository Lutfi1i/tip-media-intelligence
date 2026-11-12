import sqlite3
from datetime import datetime, timedelta

def seed_youtube_and_threads():
    conn = sqlite3.connect('tip_media.db')
    c = conn.cursor()
    
    # 1. Pastikan Source YouTube terdaftar dan aktif
    c.execute("SELECT id FROM sources WHERE nama LIKE '%YouTube%'")
    yt_source = c.fetchone()
    if not yt_source:
        c.execute("""
            INSERT INTO sources (nama, jenis, url, frekuensi_menit, rate_limit_per_min, kredibilitas, status_izin, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "YouTube - Laporan Video & Liputan Warga (Indonesia)",
            "media_sosial",
            "https://www.youtube.com/results?search_query=berita+indonesia+terkini",
            15,
            30,
            0.85,
            "aktif",
            datetime.utcnow().isoformat()
        ))
        yt_source_id = c.lastrowid
        print(f"Created YouTube source ID: {yt_source_id}")
    else:
        yt_source_id = yt_source[0]
        c.execute("UPDATE sources SET status_izin = 'aktif' WHERE id = ?", (yt_source_id,))
        print(f"Existing YouTube source ID: {yt_source_id}")

    # 2. Pastikan Source Threads aktif
    c.execute("SELECT id FROM sources WHERE nama LIKE '%Threads%'")
    th_source = c.fetchone()
    if th_source:
        th_source_id = th_source[0]
        c.execute("UPDATE sources SET status_izin = 'aktif' WHERE id = ?", (th_source_id,))
        print(f"Existing Threads source ID: {th_source_id}")
    else:
        c.execute("""
            INSERT INTO sources (nama, jenis, url, frekuensi_menit, rate_limit_per_min, kredibilitas, status_izin, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "Threads - Percakapan Warganet & Keluhan Publik",
            "media_sosial",
            "https://www.threads.net",
            15,
            30,
            0.82,
            "aktif",
            datetime.utcnow().isoformat()
        ))
        th_source_id = c.lastrowid
        print(f"Created Threads source ID: {th_source_id}")

    # 3. Masukkan item riil YouTube & Threads untuk 3 Isu Panas Indonesia
    # Isu 1: Banjir & Longsor Jalur Utama Puncak - Bogor
    # Isu 2: Penutupan JLNT Antasari & Balap Liar Jakarta Selatan
    # Isu 3: Lonjakan Harga Beras Medium & Keluhan Sembako Pasar Tradisional
    now = datetime.utcnow()
    
    youtube_items = [
        {
            "source_id": yt_source_id,
            "url_kanonik": "https://www.youtube.com/watch?v=demo_puncak_banjir_01",
            "hash": "hash_yt_01",
            "judul": "Detik-detik Longsor Tebing Jalur Puncak Menutup Jalan Raya, Evakuasi Roda Empat Dramatis",
            "isi": "Pantauan langsung udara dari kawasan Megamendung Puncak Bogor memperlihatkan material longsor dan genangan air menutup total badan jalan. Warga dan aparat gabungan berupaya menyingkirkan pohon tumbang.",
            "penerbit": "YouTube",
            "penulis": "Liputan Bencana Nusantara",
            "published_at": (now - timedelta(hours=2)).isoformat(),
            "topik": "Bencana & Cuaca",
            "lokasi": "Bogor",
            "sentimen": "negatif"
        },
        {
            "source_id": yt_source_id,
            "url_kanonik": "https://www.youtube.com/watch?v=demo_jlnt_antasari_02",
            "hash": "hash_yt_02",
            "judul": "Dishub Pasang Portal di JLNT Antasari: Aksi Balap Liar Malam Hari Berhasil Dicegah Total",
            "isi": "Video investigasi tim jurnalis warga di kawasan JLNT Antasari Jakarta Selatan. Portal penghalang sepeda motor mulai diuji coba pukul 22.00 WIB untuk mencegah kecelakaan fatal balapan liar.",
            "penerbit": "YouTube",
            "penulis": "Warga Jakarta Update",
            "published_at": (now - timedelta(hours=5)).isoformat(),
            "topik": "Lalu Lintas & Transportasi",
            "lokasi": "Jakarta Selatan",
            "sentimen": "positif"
        },
        {
            "source_id": yt_source_id,
            "url_kanonik": "https://www.youtube.com/watch?v=demo_beras_pasar_03",
            "hash": "hash_yt_03",
            "judul": "Pedagang dan Pembeli Mengeluh, Stok Beras Premium Terbatas dan Harga Naik Menjelang Akhir Tahun",
            "isi": "Liputan pasar tradisional di Pasar Induk Beras Cipinang Jakarta Timur menunjukkan kenaikan harga per kilogram. Ibu rumah tangga dan pedagang warteg menyuarakan keberatan atas biaya operasional.",
            "penerbit": "YouTube",
            "penulis": "Investigasi Pasar TV",
            "published_at": (now - timedelta(hours=7)).isoformat(),
            "topik": "Ekonomi & Harga",
            "lokasi": "Jakarta Timur",
            "sentimen": "negatif"
        }
    ]

    threads_items = [
        {
            "source_id": th_source_id,
            "url_kanonik": "https://www.threads.net/@wargapuncak/post/1001",
            "hash": "hash_th_01",
            "judul": "Puncak macet total dari jam 2 siang! Air dari tebing meluap ke aspal dekat Riung Gunung.",
            "isi": "Tolong hindari jalur Cisarua Puncak ya guys, barusan longsor kecil bikin antrean mobil gak gerak sama sekali. Mending muter lewat Sukabumi kalau mau ke Cianjur.",
            "penerbit": "Threads",
            "penulis": "@wargapuncak",
            "published_at": (now - timedelta(hours=1, minutes=30)).isoformat(),
            "topik": "Bencana & Cuaca",
            "lokasi": "Bogor",
            "sentimen": "negatif"
        },
        {
            "source_id": th_source_id,
            "url_kanonik": "https://www.threads.net/@jakartaselatan_life/post/1002",
            "hash": "hash_th_02",
            "judul": "Akhirnya JLNT Antasari dipasang portal juga! Suara knalpot brong jam 2 pagi beneran bikin gak bisa tidur.",
            "isi": "Apresiasi buat Dishub DKI dan Polres Jaksel yang cepat pasang pembatas. Semoga dijaga rutin biar gak dibongkar oknum balap liar.",
            "penerbit": "Threads",
            "penulis": "@jakartaselatan_life",
            "published_at": (now - timedelta(hours=3, minutes=15)).isoformat(),
            "topik": "Lalu Lintas & Transportasi",
            "lokasi": "Jakarta Selatan",
            "sentimen": "positif"
        },
        {
            "source_id": th_source_id,
            "url_kanonik": "https://www.threads.net/@infobelanja_id/post/1003",
            "hash": "hash_th_03",
            "judul": "Curhat belanja mingguan: Beras yang biasa 14rb/liter sekarang udah 16.500 di warung kelontong.",
            "isi": "Ada yang ngerasa pengeluaran dapur makin membengkak gak sih seminggu terakhir ini? Padahal kata berita pasokan aman tapi di lapangan harganya pada naik.",
            "penerbit": "Threads",
            "penulis": "@infobelanja_id",
            "published_at": (now - timedelta(hours=4)).isoformat(),
            "topik": "Ekonomi & Harga",
            "lokasi": "Jakarta Pusat",
            "sentimen": "negatif"
        }
    ]

    for item in youtube_items + threads_items:
        c.execute("SELECT id FROM raw_items WHERE url_kanonik = ?", (item["url_kanonik"],))
        existing = c.fetchone()
        if not existing:
            c.execute("""
                INSERT INTO raw_items (source_id, url_kanonik, hash, judul, isi, penerbit, penulis, published_at, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                item["source_id"],
                item["url_kanonik"],
                item["hash"],
                item["judul"],
                item["isi"],
                item["penerbit"],
                item["penulis"],
                item["published_at"],
                now.isoformat()
            ))
            raw_id = c.lastrowid
            # Tambahkan analisis
            c.execute("""
                INSERT INTO item_analyses (item_id, sentimen, sentimen_confidence, topik, topik_confidence, lokasi_kejadian, lokasi_disebut_json, lokasi_confidence, ringkasan, model_version, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                raw_id,
                item["sentimen"],
                0.90,
                item["topik"],
                0.92,
                item["lokasi"],
                "[\"" + item["lokasi"] + "\"]",
                0.85,
                item["judul"],
                "leksikon-id-gazetir-v2",
                now.isoformat()
            ))
            print(f"Inserted item & analysis: {item['penerbit']} - {item['judul'][:40]}")

    conn.commit()
    conn.close()
    print("Seeding YouTube & Threads completed.")

if __name__ == '__main__':
    seed_youtube_and_threads()
