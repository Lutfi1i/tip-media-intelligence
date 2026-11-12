import os

def _load_env_file(filepath: str = ".env"):
    """Simple robust .env loader using standard library."""
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k, v = k.strip(), v.strip().strip("'\"")
                        if k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

_load_env_file()

class Settings:
    PROJECT_NAME: str = "TIP Media Intelligence"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "tip-media-intelligence-secret-key-2026")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./tip_media.db")
    PILOT_REGION: str = "DKI Jakarta & Bodetabek"
    DEFAULT_SLA_HOURS: int = 2

    # Multi-Model AI Engine Settings
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "openai_compatible") # openai_compatible | gemini | claude | ollama
    AI_BASE_URL: str = os.getenv("AI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
    AI_API_KEY: str = os.getenv("AI_API_KEY", "")
    AI_MODEL_NAME: str = os.getenv("AI_MODEL_NAME", "gemini-1.5-flash")
    AI_TEMPERATURE: float = float(os.getenv("AI_TEMPERATURE", "0.1"))
    AI_MAX_TOKENS: int = int(os.getenv("AI_MAX_TOKENS", "1500"))

    # JEV / Fast-Binary Triage Gate Settings
    JEV_ENABLED: bool = os.getenv("JEV_ENABLED", "true").lower() in ("1", "true", "yes")
    JEV_API_KEY: str = os.getenv("JEV_API_KEY", "")
    JEV_BASE_URL: str = os.getenv("JEV_BASE_URL", "https://api.typesafe.ai/v1")
    JEV_INCIDENT_THRESHOLD: float = float(os.getenv("JEV_INCIDENT_THRESHOLD", "0.60"))
    JEV_NOISE_THRESHOLD: float = float(os.getenv("JEV_NOISE_THRESHOLD", "0.75"))

    # Penarikan data otomatis (menit). 0 = nonaktif, data hanya ditarik lewat tombol/endpoint poll.
    AUTO_COLLECT_MINUTES: int = int(os.getenv("AUTO_COLLECT_MINUTES", "0"))

    # Alert thresholds
    CRITICAL_SCORE_MIN: float = 85.0
    HIGH_SCORE_MIN: float = 70.0
    MEDIUM_SCORE_MIN: float = 40.0

settings = Settings()
