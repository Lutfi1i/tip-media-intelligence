import urllib.request
import os

out_dir = "frontend/public/logos"
os.makedirs(out_dir, exist_ok=True)

targets = [
    # 1. Official Google 128px high-res brand icons directly fetched from the real domains
    ("detikcom.png", "https://www.google.com/s2/favicons?domain=detik.com&sz=128"),
    ("cnn.png", "https://www.google.com/s2/favicons?domain=cnnindonesia.com&sz=128"),
    ("antara.png", "https://www.google.com/s2/favicons?domain=antaranews.com&sz=128"),
    ("bmkg.png", "https://www.google.com/s2/favicons?domain=bmkg.go.id&sz=128"),
    ("dishub.png", "https://www.google.com/s2/favicons?domain=dishub.jakarta.go.id&sz=128"),
    ("x.png", "https://www.google.com/s2/favicons?domain=x.com&sz=128"),
    ("tiktok.png", "https://www.google.com/s2/favicons?domain=tiktok.com&sz=128"),
    ("threads.png", "https://www.google.com/s2/favicons?domain=threads.net&sz=128"),
    # 2. Official Vector SVGs
    ("x.svg", "https://cdn.simpleicons.org/x/000000"),
    ("tiktok.svg", "https://cdn.simpleicons.org/tiktok/000000"),
    ("threads.svg", "https://cdn.simpleicons.org/threads/000000"),
    ("jakarta.svg", "https://upload.wikimedia.org/wikipedia/commons/e/eb/Coat_of_arms_of_Jakarta.svg"),
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

for filename, url in targets:
    dest = os.path.join(out_dir, filename)
    print(f"Fetching {filename}...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            with open(dest, "wb") as f:
                f.write(data)
            print(f"  OK -> {filename} ({len(data)} bytes)")
    except Exception as e:
        print(f"  ERROR {filename}: {e}")
