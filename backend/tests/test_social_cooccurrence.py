from datetime import datetime, timedelta

from backend.app.services.social_cooccurrence import hashtag_groups, hashtag_pairs
from backend.app.services.social_topics import SocialPost, extract_keys


def _post(i, text, author):
    p = SocialPost(id=i, text=text, title=text, platform="X (Twitter)",
                   published_at=datetime(2026, 11, 12, 12, 0) - timedelta(minutes=i), author=author)
    p.keys = extract_keys(text)
    return p


def test_pairs_need_two_accounts_and_groups_follow_strong_links():
    posts = [
        # Satu akun dengan tag tetap di setiap unggahan: bukan isu yang menyebar.
        _post(1, "Gempa M4 di Banten #bmkg #gempa", "@infobmkg"),
        _post(2, "Gempa M3 di Garut #bmkg #gempa", "@infobmkg"),
        _post(3, "Gempa M5 di Sukabumi #bmkg #gempa", "@infobmkg"),
        # Isu yang sama dengan dua tag berbeda dari beberapa akun.
        _post(4, "Ribuan orang turun ke jalan #demodpr #demojakarta", "@a"),
        _post(5, "Massa bertahan sampai malam #demodpr #demojakarta #viral", "@b"),
        _post(6, "Jalan ditutup #demojakarta #demodpr", "@c"),
        # #viral menempel di banyak konten lain, jadi keterikatannya rendah.
        _post(7, "Kuliner malam #viral #kuliner", "@d"),
        _post(8, "Mie pedas #viral #kuliner", "@e"),
        _post(9, "Kucing lucu #viral", "@f"),
        _post(10, "Konten tanpa akun #demodpr #demojakarta", None),
    ]
    pairs = hashtag_pairs(posts)
    keyed = {(r["a"], r["b"]): r for r in pairs}

    assert ("#bmkg", "#gempa") not in keyed
    demo = keyed[("#demodpr", "#demojakarta")]
    assert demo["posts"] == 4 and demo["accounts"] == 3 and demo["jaccard"] == 1.0
    assert keyed[("#kuliner", "#viral")]["jaccard"] == 0.5
    assert ("#demojakarta", "#viral") not in keyed  # hanya satu akun

    groups = hashtag_groups(posts, pairs)
    assert groups[0]["tags"] == ["#demodpr", "#demojakarta"]
    assert groups[0]["posts"] == 4 and groups[0]["accounts"] == 3
    assert all("#bmkg" not in g["tags"] for g in groups)


def test_weak_links_do_not_merge_groups():
    # Tag minimal 3 karakter: extract_keys mengabaikan tag yang lebih pendek.
    posts = [
        _post(1, "a #aaa #bbb", "@a"), _post(2, "b #aaa #bbb", "@b"),
        _post(3, "c #bbb #ccc", "@c"), _post(4, "d #ccc", "@d"), _post(5, "e #ccc", "@e"),
        _post(6, "f #bbb #ccc", "@f"), _post(7, "g #ccc", "@g"), _post(8, "h #ccc", "@h"),
    ]
    pairs = hashtag_pairs(posts)
    bc = next(r for r in pairs if (r["a"], r["b"]) == ("#bbb", "#ccc"))
    assert bc["jaccard"] < 0.5
    assert [g["tags"] for g in hashtag_groups(posts, pairs)] == [["#aaa", "#bbb"]]
