import pytest
from backend.app.services.dedup import compute_content_hash, is_near_duplicate
from backend.app.services.ai_analyzer import analyze_sentiment, analyze_topic, extract_locations
from backend.app.services.anomaly_detector import evaluate_surge
from backend.app.services.risk_scorer import compute_risk_score

def test_dedup_hash_and_similarity():
    title1 = "Banjir 40 cm di Kemang Raya Pagi Ini"
    body1 = "Sejumlah ruas jalan tergenang air setinggi 40 cm di Kemang."
    title2 = "Banjir 40 cm di Kemang Raya Pagi Ini"
    body2 = "Sejumlah ruas破坏 jalan tergenang air setinggi 40 cm di Kemang."
    
    # Exact duplicate
    assert compute_content_hash(title1, body1) == compute_content_hash(title1, body1)

    # Near duplicate
    body3 = "Ruas jalan tergenang air setinggi 40 cm di kawasan Kemang Raya."
    is_dup, sim = is_near_duplicate(title1, body1, title2, body3, threshold=0.35)
    assert is_dup is True
    assert sim > 0.35

def test_sentiment_analysis():
    neg_text = "Jalan Kemang rusak parah dan banjir lumpuh total membuat warga kecewa."
    pos_text = "Situasi air telah surut terkendali dan respons cepat petugas diapresiasi."
    neutral_text = "Rapat koordinasi teknis dinas terkait berlangsung sesuai agenda resmi."

    label_neg, conf_neg = analyze_sentiment(neg_text)
    assert label_neg in ("negatif", "campuran")
    assert conf_neg >= 0.70

    label_pos, conf_pos = analyze_sentiment(pos_text)
    assert label_pos == "positif"

    label_neu, _ = analyze_sentiment(neutral_text)
    assert label_neu == "netral"

def test_topic_analysis():
    flood_text = "Genangan air naik di jalan raya akibat curah hujan tinggi dan pompa mati."
    topic, conf = analyze_topic(flood_text)
    assert topic in ("Bencana", "Infrastruktur")
    assert conf >= 0.70

def test_location_gazetteer():
    text = "Genangan di Kemang dan Pejaten Barat wilayah Jakarta Selatan."
    primary, mentioned, conf = extract_locations(text)
    assert primary in ("Kemang", "Pejaten")
    assert "Jakarta Selatan" in mentioned
    assert conf >= 0.70

def test_surge_detector():
    historical = [10, 12, 9, 11, 8, 10]
    surge_result = evaluate_surge(85, historical, multiplier_threshold=3.0)
    assert surge_result["is_surge"] is True
    assert surge_result["growth_ratio"] >= 7.0
    assert surge_result["z_score"] >= 3.0

def test_risk_scorer_high_critical():
    # Simulated high-urgency disaster in Kemang (Slide 15: Skor 78 -> HIGH)
    result_high = compute_risk_score(
        relevance_score=85.0,
        growth_ratio=8.0,
        impact_severity=75.0,
        channel_spread_count=12,
        source_credibility=0.88,
        sentiment_urgency=75.0
    )
    assert result_high["level"] == "HIGH"
    assert 70.0 <= result_high["skor_akhir"] <= 84.0
    assert "faktor" in result_high

    # Simulated critical disaster with casualties / extreme damage
    result_crit = compute_risk_score(
        relevance_score=100.0,
        growth_ratio=16.0,
        impact_severity=95.0,
        channel_spread_count=25,
        source_credibility=0.95,
        sentiment_urgency=95.0
    )
    assert result_crit["level"] == "CRITICAL"
    assert result_crit["skor_akhir"] >= 85.0
