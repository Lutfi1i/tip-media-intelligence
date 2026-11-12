import sqlite3

con = sqlite3.connect("tip_media.db")
cur = con.cursor()

# 1. Update source status
cur.execute("UPDATE sources SET status_izin = 'nonaktif' WHERE nama LIKE '%Bluesky%'")
print("Updated sources to nonaktif:", cur.rowcount)

# 2. Get Bluesky raw_item IDs
cur.execute("SELECT id FROM raw_items WHERE url_kanonik LIKE '%bsky.app%' OR penerbit LIKE '%Bluesky%'")
bsky_ids = [r[0] for r in cur.fetchall()]
print(f"Found {len(bsky_ids)} Bluesky items to delete: {bsky_ids}")

if bsky_ids:
    placeholders = ",".join("?" * len(bsky_ids))
    # Delete from issue_items if exists
    try:
        cur.execute(f"DELETE FROM issue_items WHERE item_id IN ({placeholders})", bsky_ids)
        print("Deleted issue_items:", cur.rowcount)
    except Exception as e:
        print("issue_items delete notice:", e)

    # Delete from item_analyses
    cur.execute(f"DELETE FROM item_analyses WHERE item_id IN ({placeholders})", bsky_ids)
    print("Deleted item_analyses:", cur.rowcount)

    # Delete from raw_items
    cur.execute(f"DELETE FROM raw_items WHERE id IN ({placeholders})", bsky_ids)
    print("Deleted raw_items:", cur.rowcount)

con.commit()

# Verify no Bluesky remains
cur.execute("SELECT COUNT(*) FROM raw_items WHERE url_kanonik LIKE '%bsky.app%' OR penerbit LIKE '%Bluesky%'")
remaining = cur.fetchone()[0]
print("Remaining Bluesky items in database:", remaining)

con.close()
