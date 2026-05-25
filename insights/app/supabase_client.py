"""
Cliente leve do Supabase via REST API (PostgREST + GoTrue).

Usa service_role key (server-side, bypassa RLS). Por isso, TODO endpoint
DEVE filtrar manualmente por manager_id — caso contrário, vaza dados de
outro user. A camada de auth (auth.py) garante que manager_id veio de
JWT verificado.
"""
import logging
from typing import Any
from datetime import datetime, timezone

import httpx

from .config import get_settings

logger = logging.getLogger(__name__)


class SupabaseClient:
    """Wrapper minimalista sobre PostgREST."""

    def __init__(self):
        s = get_settings()
        if not s.is_configured:
            raise RuntimeError(
                "Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
            )
        self.base_url = s.supabase_url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey": s.supabase_service_role_key,
            "Authorization": f"Bearer {s.supabase_service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self._client = httpx.AsyncClient(timeout=10.0)

    async def aclose(self):
        await self._client.aclose()

    async def select(
        self,
        table: str,
        *,
        select: str = "*",
        filters: dict[str, str] | None = None,
        order: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """SELECT com filtros PostgREST (ex: filters={"manager_id": "eq.xxx"})."""
        params: dict[str, str] = {"select": select}
        if filters:
            params.update(filters)
        if order:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)

        r = await self._client.get(
            f"{self.base_url}/{table}",
            headers=self.headers,
            params=params,
        )
        if r.status_code >= 400:
            logger.warning("Supabase SELECT %s falhou: %s %s", table, r.status_code, r.text[:200])
            return []
        return r.json()


# Singleton lazy
_instance: SupabaseClient | None = None


def get_supabase() -> SupabaseClient:
    global _instance
    if _instance is None:
        _instance = SupabaseClient()
    return _instance


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
