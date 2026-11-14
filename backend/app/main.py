from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import SessionLocal, engine
from backend.app.schema_sync import ensure_schema
from backend.app.seed_data import seed_database
from backend.app.services import keyword_monitor, scheduler
from backend.app.services.audit import ensure_audit_append_only
from backend.app.services.auth import ensure_default_admin
from backend.app.routers import (
    profiles, sources, issues, alerts, cases, reports, dashboard, audit, geo, social_pulse, auth, users, trend, keyword
)

if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=0.2)
    except Exception:
        pass

ensure_schema(engine)
ensure_audit_append_only(engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-Powered Media Monitoring, Early Warning & Executive Decision Support API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    seed_database()
    db = SessionLocal()
    try:
        ensure_default_admin(db)
    finally:
        db.close()
    scheduler.start(settings.AUTO_COLLECT_MINUTES)
    keyword_monitor.start_scheduler(settings.KEYWORD_COLLECT_MINUTES)


@app.on_event("shutdown")
def shutdown_event():
    scheduler.stop()
    keyword_monitor.stop_scheduler()

# Register Routers
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(profiles.router, prefix=settings.API_V1_STR)
app.include_router(sources.router, prefix=settings.API_V1_STR)
app.include_router(issues.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(cases.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(geo.router, prefix=settings.API_V1_STR)
app.include_router(social_pulse.router, prefix=settings.API_V1_STR)
app.include_router(trend.router, prefix=settings.API_V1_STR)
app.include_router(keyword.router, prefix=settings.API_V1_STR)
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)

try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except Exception:
    pass

@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "status": "online",
        "pilot_region": settings.PILOT_REGION,
        "docs_url": "/docs"
    }
