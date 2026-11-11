import logging
import re
from typing import Dict, Any, Optional
from pydantic import BaseModel
import httpx

from backend.app.config import settings

logger = logging.getLogger("tip_jev_triage")

class BinaryTriageResult(BaseModel):
    is_incident_jabodetabek: bool
    incident_probability: float
    is_noise_or_promo: bool
    noise_probability: float
    requires_analyst_dispatch: bool
    confidence: float
    triage_engine: str  # "jev_api" | "fast_llm" | "fast_rule_engine"
    reason: str

# Noise and commercial promotion patterns in Indonesian news/social media
PROMO_NOISE_PATTERNS = [
    r"\b(diskon|promo|voucher|cashback|belanja|harga miring|flash sale)\b",
    r"\b(banjir order|banjir diskon|banjir hadiah|banjir promo|banjir bonus)\b",
    r"\b(investasi bodong|slot gacor|judi online|link gacor)\b",
    r"\b(undian berhadiah|giveaway|kode promo|kupon belanja)\b",
]

# Physical and public infrastructure disaster/incident keywords in Jabodetabek
INCIDENT_PATTERNS = [
    r"\b(banjir|genangan|luapan kali|tanggul jebol|pompa mati|air naik|tenggelam)\b",
    r"\b(macet total|lalin lumpuh|rekayasa lalu lintas|kecelakaan beruntun|truk terguling)\b",
    r"\b(kebakaran|si jago merah|hangus terbakar|ledakan|pemadam)\b",
    r"\b(gempa|gempa bumi|magnitudo|bmkg|patahan|getaran)\b",
    r"\b(jalan ambles|longsor|pohon tumbang|tiang roboh|lampu padam|mati listrik)\b",
    r"\b(gangguan server|antrean membludak|pelayanan terhenti|pasokan air terputus)\b",
]

JABODETABEK_KEYWORDS = [
    "jakarta", "jaksel", "jaktim", "jakbar", "jakpus", "jakut", "kepulauan seribu",
    "bogor", "depok", "tangerang", "tangsel", "bekasi", "kemang", "pejaten",
    "bidara cina", "kampung melayu", "mampang", "ciliwung", "pesanggrahan",
    "angke", "cisadane", "katulampa", "manggarai", "pluit", "priok"
]


def evaluate_binary_triage(
    title: str,
    content: Optional[str] = "",
    publisher: Optional[str] = ""
) -> BinaryTriageResult:
    """
    Fast-Binary Yes/No Triage Gatekeeper.
    Evaluates whether raw content is a genuine Jabodetabek incident, noise/promo, or high priority.
    """
    if not settings.JEV_ENABLED:
        # Pass-through if triage is disabled
        return BinaryTriageResult(
            is_incident_jabodetabek=True,
            incident_probability=1.0,
            is_noise_or_promo=False,
            noise_probability=0.0,
            requires_analyst_dispatch=False,
            confidence=1.0,
            triage_engine="pass_through",
            reason="Jev triage disabled in settings."
        )

    # 1. Try JEV API if key is configured
    if settings.JEV_API_KEY:
        try:
            return _call_jev_api(title, content, publisher)
        except Exception as e:
            logger.warning(f"JEV API call failed, falling back to fast rule engine: {e}")

    # 2. Fast Rule-Based Triage Engine (Deterministic sub-millisecond evaluation)
    return _evaluate_fast_rules(title, content, publisher)


def _evaluate_fast_rules(title: str, content: Optional[str], publisher: Optional[str]) -> BinaryTriageResult:
    text = f"{title} {content or ''}".lower()

    # Step A: Evaluate Noise / Promo Proposition (Yes/No)
    noise_hits = 0
    for pat in PROMO_NOISE_PATTERNS:
        if re.search(pat, text):
            noise_hits += 1

    noise_prob = min(0.1 + (noise_hits * 0.45), 0.99) if noise_hits > 0 else 0.05
    is_noise = noise_prob >= settings.JEV_NOISE_THRESHOLD

    # Step B: Evaluate Jabodetabek Location Relevance
    is_jabodetabek = any(loc in text for loc in JABODETABEK_KEYWORDS)
    if "bmkg" in text or "dki" in text or "dishub" in (publisher or "").lower():
        is_jabodetabek = True

    # Step C: Evaluate Incident / Emergency Proposition (Yes/No)
    incident_hits = 0
    for pat in INCIDENT_PATTERNS:
        matches = len(re.findall(pat, text))
        incident_hits += matches

    incident_score = 0.1
    if incident_hits > 0:
        incident_score = min(0.35 + (incident_hits * 0.2), 0.98)
    if is_jabodetabek and incident_hits > 0:
        incident_score = min(incident_score + 0.15, 0.99)
    if is_noise:
        incident_score = max(0.05, incident_score - 0.5)

    is_incident = (incident_score >= settings.JEV_INCIDENT_THRESHOLD) and is_jabodetabek and not is_noise

    # Step D: Evaluate Analyst Dispatch Urgency (Yes/No)
    # Critical keywords that demand instant human review
    urgent_patterns = [r"\b(korban|tewas|lumpuh total|evakuasi|siaga 1|darurat)\b"]
    urgent_hits = sum(1 for p in urgent_patterns if re.search(p, text))
    requires_dispatch = is_incident and (urgent_hits > 0 or incident_score >= 0.80)

    reason = []
    if is_noise:
        reason.append("Terdeteksi pola promosi/diskon/noise komersial.")
    elif is_incident:
        reason.append(f"Terdeteksi indikasi insiden publik di Jabodetabek (skor {incident_score:.2f}).")
        if requires_dispatch:
            reason.append("Mengandung sinyal urgensi tinggi yang membutuhkan analis.")
    else:
        reason.append("Informasi umum/kondusif tanpa anomali insiden mendesak.")

    return BinaryTriageResult(
        is_incident_jabodetabek=is_incident,
        incident_probability=round(incident_score, 2),
        is_noise_or_promo=is_noise,
        noise_probability=round(noise_prob, 2),
        requires_analyst_dispatch=requires_dispatch,
        confidence=0.88 if (is_incident or is_noise) else 0.80,
        triage_engine="fast_rule_engine",
        reason=" ".join(reason)
    )


def _call_jev_api(title: str, content: Optional[str], publisher: Optional[str]) -> BinaryTriageResult:
    """Direct API caller for TypeSafe AI Jev noul binary evaluator."""
    url = f"{settings.JEV_BASE_URL.rstrip('/')}/triage"
    headers = {
        "Authorization": f"Bearer {settings.JEV_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "input_state": {
            "title": title,
            "body": (content or "")[:1500],
            "source": publisher
        },
        "questions": [
            {"id": "is_incident", "primitive": "noul", "prompt": "Does this report describe an active public service disruption, disaster, flood, fire, or infrastructure breakdown in Jabodetabek?"},
            {"id": "is_noise", "primitive": "noul", "prompt": "Is this a commercial advertisement, sales discount, marketing promotion, or spam?"},
            {"id": "requires_dispatch", "primitive": "noul", "prompt": "Does this situation represent an emergency that requires immediate public sector intervention?"}
        ]
    }
    with httpx.Client(timeout=4.0) as client:
        res = client.post(url, json=payload, headers=headers)
        res.raise_for_status()
        data = res.json()
        answers = {q["id"]: q for q in data.get("answers", [])}
        
        inc_prob = float(answers.get("is_incident", {}).get("probability", 0.5))
        noise_prob = float(answers.get("is_noise", {}).get("probability", 0.1))
        disp_prob = float(answers.get("requires_dispatch", {}).get("probability", 0.2))

        return BinaryTriageResult(
            is_incident_jabodetabek=inc_prob >= settings.JEV_INCIDENT_THRESHOLD and noise_prob < settings.JEV_NOISE_THRESHOLD,
            incident_probability=round(inc_prob, 2),
            is_noise_or_promo=noise_prob >= settings.JEV_NOISE_THRESHOLD,
            noise_probability=round(noise_prob, 2),
            requires_analyst_dispatch=disp_prob >= 0.70,
            confidence=round(float(data.get("overall_confidence", 0.90)), 2),
            triage_engine="jev_api",
            reason=f"Jev Evaluator: P(incident)={inc_prob:.2f}, P(noise)={noise_prob:.2f}."
        )
