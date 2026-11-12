import sqlite3

def migrate_status_and_taxonomy():
    conn = sqlite3.connect('tip_media.db')
    c = conn.cursor()
    
    # 1. Update status 'kandidat' -> 'otomatis'
    c.execute("UPDATE issues SET status = 'otomatis' WHERE status = 'kandidat'")
    print(f"Updated status kandidat -> otomatis: {c.rowcount} rows")
    
    # 2. Update topics to match PRD Lampiran A
    # "Bencana" -> "Bencana & Cuaca"
    # "Infrastruktur" -> "Infrastruktur & Jalan"
    # "Pelayanan Publik" -> "Layanan Publik"
    # "Keamanan" -> "Keamanan & Kriminalitas"
    # "Ekonomi" -> "Ekonomi & Harga"
    # "Kesehatan" -> "Kesehatan & Lingkungan"
    # "Umum" -> "Sosial & Warga"
    
    mapping = {
        'Bencana': 'Bencana & Cuaca',
        'Infrastruktur': 'Infrastruktur & Jalan',
        'Pelayanan Publik': 'Layanan Publik',
        'Keamanan': 'Keamanan & Kriminalitas',
        'Ekonomi': 'Ekonomi & Harga',
        'Kesehatan': 'Kesehatan & Lingkungan',
        'Umum': 'Sosial & Warga'
    }
    
    for old_t, new_t in mapping.items():
        c.execute("UPDATE issues SET kategori = ? WHERE kategori = ?", (new_t, old_t))
        print(f"Issues kategori {old_t} -> {new_t}: {c.rowcount} rows")
        c.execute("UPDATE item_analyses SET topik = ? WHERE topik = ?", (new_t, old_t))
        print(f"ItemAnalyses topik {old_t} -> {new_t}: {c.rowcount} rows")
        
    conn.commit()
    conn.close()
    print("Migration successful.")

if __name__ == '__main__':
    migrate_status_and_taxonomy()
