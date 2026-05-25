"""
OLEFOOT PYTHON MODE — insights service (FastAPI).

Endpoints:
  GET  /health
  GET  /club/{manager_id}/consequences
  GET  /club/{manager_id}/summary
  GET  /club/{manager_id}/night-report

Auth: JWT do Supabase no header Authorization. Manager ID derivado do
token via SUPABASE_JWT_SECRET. Em dev sem secret, aceita X-Manager-Id.

Deploy: Railway via Procfile/railway.toml. Variáveis necessárias:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, CORS_ORIGINS
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import get_settings
from .routes import consequences, health, night_report, player

settings = get_settings()
logging.basicConfig(level=getattr(logging, settings.log_level, logging.INFO))
logger = logging.getLogger(__name__)


app = FastAPI(
    title="Olefoot Insights",
    description="OLEFOOT PYTHON MODE — analytics + intelligence layer",
    version=__version__,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "X-Manager-Id"],
)

app.include_router(health.router)
app.include_router(consequences.router)
app.include_router(night_report.router)
app.include_router(player.router)


@app.get("/", tags=["root"])
async def root():
    return {
        "service": "olefoot-insights",
        "version": __version__,
        "docs": "/docs",
        "endpoints": [
            "GET /health",
            "GET /club/{manager_id}/consequences",
            "GET /club/{manager_id}/summary",
            "GET /club/{manager_id}/squad-overview",
            "GET /club/{manager_id}/night-report",
            "GET /player/{player_id}/transparency",
        ],
    }
