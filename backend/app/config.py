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

    # Auth, MFA & Keycloak OIDC (FR-22, NFR-07/08)
    AUTH_REQUIRED: bool = os.getenv("AUTH_REQUIRED", "false").lower() in ("1", "true", "yes")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
    KEYCLOAK_ENABLED: bool = os.getenv("KEYCLOAK_ENABLED", "false").lower() in ("1", "true", "yes")
    KEYCLOAK_SERVER_URL: str = os.getenv("KEYCLOAK_SERVER_URL", "http://localhost:8080")
    KEYCLOAK_REALM: str = os.getenv("KEYCLOAK_REALM", "tip-media")
    KEYCLOAK_CLIENT_ID: str = os.getenv("KEYCLOAK_CLIENT_ID", "tip-backend")
    KEYCLOAK_CLIENT_SECRET: str = os.getenv("KEYCLOAK_CLIENT_SECRET", "")

    # Redis & Celery
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

    # MinIO / S3 Object Storage
    S3_ENDPOINT: str = os.getenv("S3_ENDPOINT", "")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "minioadmin")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "minioadmin123")
    S3_BUCKET: str = os.getenv("S3_BUCKET", "tip-media-artifacts")
    S3_BACKUP_BUCKET: str = os.getenv("S3_BACKUP_BUCKET", "tip-media-backups")
    LOCAL_STORAGE_DIR: str = os.getenv("LOCAL_STORAGE_DIR", "./storage")

    # Notifikasi Eksekutif (FR-16 & FR-17)
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_DEFAULT_CHAT_ID: str = os.getenv("TELEGRAM_DEFAULT_CHAT_ID", "")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "noreply@tip-media.local")
    EMAIL_DEFAULT_TO: str = os.getenv("EMAIL_DEFAULT_TO", "")
    WA_BSP_URL: str = os.getenv("WA_BSP_URL", "")
    WA_BSP_TOKEN: str = os.getenv("WA_BSP_TOKEN", "")
    WA_DEFAULT_TO: str = os.getenv("WA_DEFAULT_TO", "")
    QUIET_HOURS_START: int = int(os.getenv("QUIET_HOURS_START", "22"))
    QUIET_HOURS_END: int = int(os.getenv("QUIET_HOURS_END", "6"))

    # Multi-Model AI Engine Settings
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "openai_compatible")
    AI_BASE_URL: str = os.getenv("AI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
    AI_API_KEY: str = os.getenv("AI_API_KEY", "")
    AI_MODEL_NAME: str = os.getenv("AI_MODEL_NAME", "gemini-1.5-flash")
    AI_TEMPERATURE: float = float(os.getenv("AI_TEMPERATURE", "0.1"))
    AI_MAX_TOKENS: int = int(os.getenv("AI_MAX_TOKENS", "1500"))
    INDOBERT_ENDPOINT: str = os.getenv("INDOBERT_ENDPOINT", "")
    EMBEDDING_ENDPOINT: str = os.getenv("EMBEDDING_ENDPOINT", "")

    # JEV / Fast-Binary Triage Gate Settings
    JEV_ENABLED: bool = os.getenv("JEV_ENABLED", "true").lower() in ("1", "true", "yes")
    JEV_API_KEY: str = os.getenv("JEV_API_KEY", "")
    JEV_BASE_URL: str = os.getenv("JEV_BASE_URL", "https://api.typesafe.ai/v1")
    JEV_INCIDENT_THRESHOLD: float = float(os.getenv("JEV_INCIDENT_THRESHOLD", "0.60"))
    JEV_NOISE_THRESHOLD: float = float(os.getenv("JEV_NOISE_THRESHOLD", "0.75"))

    # OpenSearch (FR-21)
    OPENSEARCH_ENABLED: bool = os.getenv("OPENSEARCH_ENABLED", "false").lower() in ("1", "true", "yes")
    OPENSEARCH_URL: str = os.getenv("OPENSEARCH_URL", "http://localhost:9200")

    # Social Pulse Real-Time Legal (FR-25)
    X_BEARER_TOKEN: str = os.getenv("X_BEARER_TOKEN", "")
    X_STREAM_RULES: str = os.getenv("X_STREAM_RULES", "place_country:ID")
    SOCIAL_WEBHOOK_SECRET: str = os.getenv("SOCIAL_WEBHOOK_SECRET", "tip-webhook-secret")

    # Penarikan data otomatis (menit). 0 = nonaktif via thread lokal (gunakan Celery Beat di produksi).
    AUTO_COLLECT_MINUTES: int = int(os.getenv("AUTO_COLLECT_MINUTES", "0"))

    # Retensi & Observability
    RETENTION_DAYS: int = int(os.getenv("RETENTION_DAYS", "365"))
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")

    # Alert thresholds
    CRITICAL_SCORE_MIN: float = 85.0
    HIGH_SCORE_MIN: float = 70.0
    MEDIUM_SCORE_MIN: float = 40.0

settings = Settings()
