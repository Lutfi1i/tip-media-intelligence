"""Script untuk seeding data media sosial skenario pengujian geografis:
Kecamatan Cibinong, Bojonggede, Citeureup, dan Konteks Regional Kabupaten Bogor.
Mendukung skenario evaluasi PRD Addendum (Scenario A, B, C, D).
"""

from datetime import datetime, timedelta
import hashlib
from backend.app.database import SessionLocal
from backend.app.models import RawItem, ItemAnalysis, Source, Issue, IssueItem
from backend.app.services.ingestion import ingest_content_item

SAMPLE_SOCIAL_ITEMS = [
    # --- KECAMATAN CIBINONG (32.01.01) ---
    {
        "source_name": "X (Twitter) - Suara Warga & Breaking News (Jabodetabek)",
        "penerbit": "X (Twitter)",
        "penulis": "@wargacibinong_id",
        "url": "https://x.com/wargacibinong_id/status/1789012345678901",
        "title": "Macet Parah di Jalan Raya Bogor Depan Pasar Cibinong Arah Jakarta",
        "body": "Pagi ini lalu lintas macet parah di Jalan Raya Bogor dekat Cibinong arah Depok/Jakarta. Antrean kendaraan mengekor dari Simpang Pemda Bogor sampai Cirimekar dan Flyover Cibinong karena ada genangan air dan perbaikan saluran drainase. Harap waspada pengendara.",
        "hours_ago": 2,
    },
    {
        "source_name": "Threads - Percakapan Warganet & Keluhan Publik",
        "penerbit": "Threads",
        "penulis": "@bogor_update",
        "url": "https://threads.net/@bogor_update/post/C9abc012345",
        "title": "Genangan Air Meluap di Sekitar Stadion Pakansari dan Sukahati Cibinong",
        "body": "Hujan deras sore tadi bikin akses jalan lingkar luar Stadion Pakansari Cibinong sampai Kelurahan Sukahati tergenang air setinggi 30 cm. Saluran air mampet banyak sampah. Warga Karadenan dan Pabuaran yang mau melintas dialihkan ke jalur alternatif.",
        "hours_ago": 4,
    },
    {
        "source_name": "TikTok - Laporan Video Warga (Banjir & Kejadian Viral)",
        "penerbit": "TikTok",
        "penulis": "@lensa.cibinong",
        "url": "https://tiktok.com/@lensa.cibinong/video/734567890123456789",
        "title": "Jalan Rusak Berlubang Parah Dekat RSUD Cibinong dan Stasiun Cibinong Membahayakan Pemotor",
        "body": "Video laporan warga: lubang jalan makin besar dan dalam di Jalan Mayor Oking Cibinong, persis arah Stasiun Cibinong dan RSUD Cibinong. Sudah ada dua pemotor terjatuh semalam karena penerangan jalan minim. Mohon Dinas PUPR Kabupaten Bogor segera perbaiki.",
        "hours_ago": 6,
    },
    {
        "source_name": "YouTube - Laporan Video & Liputan Warga (Indonesia)",
        "penerbit": "YouTube",
        "penulis": "Warta Bogor Raya",
        "url": "https://youtube.com/watch?v=cibinong_pakansari_report",
        "title": "LIPUTAN KHUSUS: Penanganan Banjir dan Drainase Pemukiman Kelurahan Nanggewer Mekar Cibinong",
        "body": "Liputan warga dan Ketua RT di Kelurahan Nanggewer dan Nanggewer Mekar, Kecamatan Cibinong. Drainase pemukiman warga meluber saat hujan lebat merendam puluhan rumah. Warga berharap Pemkab Bogor segera normalisasi saluran kali.",
        "hours_ago": 10,
    },
    {
        "source_name": "Threads - Percakapan Warganet & Keluhan Publik",
        "penerbit": "Threads",
        "penulis": "@suara_warga_karadenan",
        "url": "https://threads.net/@suara_warga_karadenan/post/C9def567890",
        "title": "Keluhan Tumpukan Sampah Liar di Pinggir Rel Karadenan Cibinong",
        "body": "Tolong pihak Kecamatan Cibinong dan DLH Kabupaten Bogor bersihkan tumpukan sampah liar di pinggir rel Kelurahan Karadenan Cibinong. Baunya menyengat sampai ke pemukiman dan mengganggu pengguna KRL.",
        "hours_ago": 12,
    },
    {
        "source_name": "X (Twitter) - Suara Warga & Breaking News (Jabodetabek)",
        "penerbit": "X (Twitter)",
        "penulis": "@bogorcommuter",
        "url": "https://x.com/bogorcommuter/status/1789098765432109",
        "title": "Akses Pintu Masuk Stasiun Pondok Rajeg Cibinong Ramai Lancar",
        "body": "Uji coba aktivasi Stasiun Pondok Rajeg di perbatasan Cibinong dan Depok berjalan kondusif. Transportasi umum angkot mulai terintegrasi dengan baik.",
        "hours_ago": 14,
    },

    # --- KECAMATAN BOJONGGEDE (32.01.02) ---
    {
        "source_name": "X (Twitter) - Suara Warga & Breaking News (Jabodetabek)",
        "penerbit": "X (Twitter)",
        "penulis": "@krl_bojonggede",
        "url": "https://x.com/krl_bojonggede/status/1789111222333444",
        "title": "Kemacetan Parah Pintu Perlintasan KA Bojonggede dan Pasar Bojong Baru",
        "body": "Macet luar biasa di pintu perlintasan kereta Bojonggede dan sekitar pasar Bojong Baru. Kendaraan mengunci dari arah Kedung Waringin sampai Bojonggede kota. Petugas dishub belum terlihat mengatur lalu lintas pagi ini.",
        "hours_ago": 3,
    },
    {
        "source_name": "TikTok - Laporan Video Warga (Banjir & Kejadian Viral)",
        "penerbit": "TikTok",
        "penulis": "@warga_bojong",
        "url": "https://tiktok.com/@warga_bojong/video/7345999888777666",
        "title": "Genangan Jalan Rawa Panjang Bojonggede Bikin Motor Mogok",
        "body": "Hujan deras membuat jalan di Desa Rawa Panjang, Kecamatan Bojonggede tergenang setinggi lutut orang dewasa. Banyak motor mogok terpaksa didorong warga.",
        "hours_ago": 7,
    },

    # --- KECAMATAN CITEUREUP (32.01.03) ---
    {
        "source_name": "Threads - Percakapan Warganet & Keluhan Publik",
        "penerbit": "Threads",
        "penulis": "@citeureup_info",
        "url": "https://threads.net/@citeureup_info/post/C9ghi123456",
        "title": "Debu Truk Tambang dan Kerusakan Jalan Industri di Citeureup Bogor",
        "body": "Warga Karang Asem dan Puspasari Kecamatan Citeureup mengeluhkan debu tebal dari hilir mudik truk tambang dan angkutan industri semen. Jalan berlubang makin membahayakan warga.",
        "hours_ago": 5,
    },

    # --- REGIONAL BOGOR GENERAL (SCENARIO D: UNCERTAIN / REGIONAL CONTEXT) ---
    {
        "source_name": "X (Twitter) - Suara Warga & Breaking News (Jabodetabek)",
        "penerbit": "X (Twitter)",
        "penulis": "@berita_bogor_raya",
        "url": "https://x.com/berita_bogor_raya/status/1789555666777888",
        "title": "BMKG Keluarkan Peringatan Dini Cuaca Ekstrem Hujan Lebat di Wilayah Kabupaten Bogor",
        "body": "BMKG merilis peringatan dini cuaca untuk wilayah Kabupaten Bogor dan sekitarnya berpotensi hujan lebat disertai kilat dan angin kencang hingga malam hari. Masyarakat diimbau waspada terhadap potensi bencana hidrometeorologi.",
        "hours_ago": 8,
    },
]

def seed_geo_scenarios():
    db = SessionLocal()
    try:
        sources_map = {s.nama: s for s in db.query(Source).all()}
        inserted_count = 0

        for item in SAMPLE_SOCIAL_ITEMS:
            src = sources_map.get(item["source_name"])
            src_id = src.id if src else None

            # Cek apakah item sudah ada
            existing = db.query(RawItem).filter(RawItem.url_kanonik == item["url"]).first()
            if existing:
                continue

            pub_time = datetime.utcnow() - timedelta(hours=item["hours_ago"])
            
            # Panggil ingestion pipeline kanonik
            result = ingest_content_item(
                db=db,
                source_id=src_id,
                url=item["url"],
                title=item["title"],
                body=item["body"],
                penerbit=item["penerbit"],
                penulis=item["penulis"],
                published_at=pub_time,
            )

            if result.get("status") == "saved":
                inserted_count += 1

        db.commit()
        print(f"Berhasil seeding {inserted_count} entri data media sosial geografis lokal.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_geo_scenarios()
