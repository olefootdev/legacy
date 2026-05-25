"""
Transparência por jogador — painel detail do SCOUTS.

`GET /player/{playerId}/transparency` agrega consequências ativas e
constrói timeline (consequências aplicadas + expiradas nos últimos 7 dias)
com explicação humana de cada item.

Segurança: o caller passa um JWT cujo `sub` é o manager_id. Validamos
que o jogador pertence ao manager via `manager_squad.players` no
Supabase — bloqueia IDOR (manager A pedindo dados de jogador do manager B).
"""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException

from ..auth import ManagerId
from ..decay import evaluate
from ..explanations import explain
from ..models import (
    Consequence,
    ExplainedConsequence,
    PlayerTimelineEvent,
    PlayerTransparency,
)
from ..supabase_client import get_supabase, now_iso

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/player", tags=["player-transparency"])

UNAVAILABILITY_KINDS = {
    "red_card_suspension",
    "red_card_suspension_repeat",
    "injury_light_out",
    "injury_medium_out",
    "injury_severe_out",
    "forced_rest",
}


async def _verify_player_belongs_to_manager(player_id: str, manager_id: str) -> bool:
    """Confirma que player_id está no manager_squad do manager_id (anti-IDOR)."""
    sb = get_supabase()
    rows = await sb.select(
        "manager_squad",
        select="players",
        filters={"user_id": f"eq.{manager_id}"},
        limit=1,
    )
    if not rows:
        return False
    players = rows[0].get("players") or []
    # players é um array de PlayerEntity-like dicts; verifica id
    for p in players:
        if isinstance(p, dict) and p.get("id") == player_id:
            return True
    return False


async def _fetch_player_consequences(
    manager_id: str,
    player_id: str,
    include_expired_since: datetime | None = None,
) -> list[Consequence]:
    """Busca consequências do jogador. Se include_expired_since, traz expiradas recentes pra timeline."""
    sb = get_supabase()
    filters: dict[str, str] = {
        "manager_id": f"eq.{manager_id}",
        "player_id": f"eq.{player_id}",
    }
    if include_expired_since is not None:
        filters["starts_at"] = f"gte.{include_expired_since.isoformat()}"
    else:
        filters["expires_at"] = f"gt.{now_iso()}"
    rows = await sb.select(
        "club_consequences",
        filters=filters,
        order="starts_at.desc",
    )
    return [Consequence(**r) for r in rows]


@router.get("/{player_id}/transparency", response_model=PlayerTransparency)
async def player_transparency(
    player_id: str, manager_id: ManagerId
) -> PlayerTransparency:
    """
    Resumo completo de um jogador: consequências ativas (com explicação)
    + timeline de eventos (7 dias).
    """
    # Anti-IDOR: o jogador tem que estar no plantel do manager autenticado
    owns = await _verify_player_belongs_to_manager(player_id, manager_id)
    if not owns:
        raise HTTPException(
            status_code=403,
            detail="Jogador não pertence ao plantel do manager autenticado",
        )

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    # Busca tudo dos últimos 7 dias (ativas + recém-expiradas)
    recent = await _fetch_player_consequences(
        manager_id, player_id, include_expired_since=week_ago
    )

    # Ativas → explicadas
    active: list[ExplainedConsequence] = []
    timeline: list[PlayerTimelineEvent] = []
    is_unavailable = False

    for c in recent:
        explanation = explain(c.kind)
        is_active = c.expires_at > now

        if is_active:
            ev = evaluate(c, now)
            active.append(
                ExplainedConsequence(
                    consequence=c,
                    current_value=ev.current_value,
                    life_remaining=ev.life_remaining,
                    ms_until_expiry=ev.ms_until_expiry,
                    title=explanation["title"],
                    subtitle=explanation["subtitle"],
                    severity=explanation["severity"],
                )
            )
            if c.kind in UNAVAILABILITY_KINDS:
                is_unavailable = True

        # Evento de aplicação (sempre vai pra timeline)
        timeline.append(
            PlayerTimelineEvent(
                at=c.starts_at,
                kind="consequence_applied",
                consequence_id=c.id,
                source_event_id=c.source_event_id,
                title=explanation["title"],
                subtitle=explanation["subtitle"],
                severity=explanation["severity"],
                dimension=c.dimension,
                magnitude=c.magnitude,
            )
        )

        # Se já expirou, adicionar evento de expiração também
        if not is_active:
            timeline.append(
                PlayerTimelineEvent(
                    at=c.expires_at,
                    kind="consequence_expired",
                    consequence_id=c.id,
                    source_event_id=c.source_event_id,
                    title=f"{explanation['title']} — encerrado",
                    subtitle="Efeito expirou naturalmente pela curva de decay.",
                    severity="info",
                    dimension=c.dimension,
                    magnitude=c.magnitude,
                )
            )

    # Ordem cronológica decrescente (mais recente primeiro)
    timeline.sort(key=lambda e: e.at, reverse=True)

    most_recent = timeline[0].at if timeline else None

    return PlayerTransparency(
        player_id=player_id,
        active=active,
        timeline=timeline,
        total_active=len(active),
        is_unavailable=is_unavailable,
        most_recent_event_at=most_recent,
    )
