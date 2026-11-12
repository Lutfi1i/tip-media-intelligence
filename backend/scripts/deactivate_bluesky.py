import sqlite3

con = sqlite3.connect('tip_media.db')
cur = con.cursor()
cur.execute("UPDATE sources SET status_izin = 'nonaktif' WHERE nama LIKE '%Bluesky%'")
con.commit()
print('Rows updated in sources:', cur.rowcount)
rows = cur.execute('SELECT id, nama, status_izin FROM sources').fetchall()
for r in rows:
    print(r)
con.close()
