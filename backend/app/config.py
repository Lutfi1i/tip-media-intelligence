import os

class Settings:
    PROJECT_NAME: str = "TIP Media Intelligence"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "tip-media-intelligence-secret-key-2026")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./tip_media.db")
    PILOT_REGION: str = "DKI Jakarta & Bodetabek"
    DEFAULT_SLA_HOURS: int = 2
    
    # Alert thresholds
    CRITICAL_SCORE_MIN: float = 85.0
    HIGH_SCORE_MIN: float = 70.0
    MEDIUM_SCORE_MIN: float = 40.0

settings = Settings()
