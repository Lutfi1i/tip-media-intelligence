from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import engine
from backend.app.schema_sync import ensure_schema
from backend.app.seed_data import seed_database
from backend.app.services import scheduler
from backend.app.routers import (
    profiles, sources, issues, alerts, cases, reports, dashboard, audit, geo, social_pulse
)

ensure_schema(engine)

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
    scheduler.start(settings.AUTO_COLLECT_MINUTES)


@app.on_event("shutdown")
def shutdown_event():
    scheduler.stop()

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

@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "status": "online",
        "pilot_region": settings.PILOT_REGION,
        "docs_url": "/docs"
    }
