from backend.app.services.ai_engine import _validated_topic

FALLBACK = {"topik": "Bencana & Cuaca", "topik_confidence": 0.77}


def test_official_label_is_kept():
    out = _validated_topic({"topik": "Infrastruktur & Jalan", "topik_confidence": 0.9}, FALLBACK)
    assert out == {"topik": "Infrastruktur & Jalan", "topik_confidence": 0.9}


def test_unknown_or_short_label_falls_back_to_heuristic():
    # Label pendek dari prompt lama ("Bencana") tidak cocok dengan taksonomi aplikasi.
    assert _validated_topic({"topik": "Bencana", "topik_confidence": 0.9}, FALLBACK) == FALLBACK
    assert _validated_topic({}, FALLBACK) == FALLBACK
