"""Health check + version."""
from fastapi import APIRouter

from .. import __version__
from ..config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    s = get_settings()
    return {
        "ok": True,
        "service": "olefoot-insights",
        "version": __version__,
        "supabase_configured": s.is_configured,
        "jwt_verification": bool(s.supabase_jwt_secret),
    }
