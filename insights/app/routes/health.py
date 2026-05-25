"""Health check + version."""
from fastapi import APIRouter

from .. import __version__
from ..config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    s = get_settings()
    # JWT verification pode rodar via dois caminhos:
    #   - JWKS (sistema novo, ES256/RS256) → precisa só de SUPABASE_URL
    #   - HS256 legacy                     → precisa de SUPABASE_JWT_SECRET
    # Reportar ambos pra diagnóstico claro.
    return {
        "ok": True,
        "service": "olefoot-insights",
        "version": __version__,
        "supabase_configured": s.is_configured,
        "jwt_verification": bool(s.supabase_url) or bool(s.supabase_jwt_secret),
        "jwks_enabled": bool(s.supabase_url),
        "hs256_enabled": bool(s.supabase_jwt_secret),
    }
