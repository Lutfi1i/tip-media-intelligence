import urllib.request
import os

out_dir = "frontend/public/logos"
os.makedirs(out_dir, exist_ok=True)

urls = {
    # 1. X (Official Brand Vector)
    "x.svg": "https://cdn.simpleicons.org/x/000000",
    # 2. TikTok (Official Brand Vector)
    "tiktok.svg": "https://cdn.simpleicons.org/tiktok/000000",
    # 3. Threads (Official Brand Vector)
    "threads.svg": "https://cdn.simpleicons.org/threads/000000",
    # 4. Detikcom (Official Detikcom Logo Vector)
    "detikcom.svg": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Detikcom_logo.svg",
    # 5. CNN Indonesia (Official CNN Indonesia Vector)
    "cnnindonesia.svg": "https://upload.wikimedia.org/wikipedia/commons/4/43/CNN_Indonesia_logo.svg",
    # 6. Antara News (Official Antara Logo)
    "antaranews.png": "https://upload.wikimedia.org/wikipedia/id/3/36/Logo_Antara_News.png",
    # 7. BMKG (Official Logo Badan Meteorologi Klimatologi dan Geofisika)
    "bmkg.png": "https://upload.wikimedia.org/wikipedia/commons/6/64/Logo_BMKG.png",
    # 8. Dishub DKI Jakarta (Lencana Resmi Pemprov DKI / Jaya Raya)
    "dishub.png": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Coat_of_arms_of_Jakarta.svg/450px-Coat_of_arms_of_Jakarta.svg.png",
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

for filename, url in urls.items():
    dest = os.path.join(out_dir, filename)
    print(f"Downloading {filename} from {url}...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            with open(dest, "wb") as f:
                f.write(data)
            print(f"  OK -> {filename} ({len(data)} bytes)")
    except Exception as e:
        print(f"  ERROR for {filename}: {e}")
