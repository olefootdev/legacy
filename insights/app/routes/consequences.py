"""
Endpoints de consequências persistentes.

Todos filtram por manager_id derivado do JWT — RLS-equivalent
no nível de aplicação (já que usamos service_role server-side).
"""
from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from ..auth import ManagerId
from ..decay import evaluate
from ..models import (
    ClubSummary,
    Consequence,
    ConsequencesByDimension,
    EvaluatedConsequence,
    SquadOverview,
    SquadPlayerEntry,
)
from ..supabase_client import get_supabase, now_iso

router = APIRouter(prefix="/club", tags=["consequences"])


async def _fetch_active_consequences(manager_id: str) -> list[Consequence]:
    sb = get_supabase()
    rows = await sb.select(
        "club_consequences",
        filters={
            "manager_id": f"eq.{manager_id}",
            "expires_at": f"gt.{now_iso()}",
        },
        order="expires_at.asc",
    )
    return [Consequence(**r) for r in rows]


@router.get("/{path_manager_id}/consequences", response_model=ConsequencesByDimension)
async def list_consequences(path_manager_id: str, manager_id: ManagerId) -> ConsequencesByDimension:
    """
    Lista consequências ativas agrupadas por dimensão.
    Path manager_id DEVE bater com JWT — protege contra IDOR.
    """
    if path_manager_id != manager_id:
        raise HTTPException(status_code=403, detail="Manager ID mismatch")

    consequences = await _fetch_active_consequences(manager_id)
    now = datetime.now(timezone.utc)

    grouped = ConsequencesByDimension()
    for c in consequences:
        ev = evaluate(c, now)
        if ev.current_value == 0 and c.decay_curve != "step":
            continue
        getattr(grouped, c.dimension).append(ev)

    return grouped


@router.get("/{path_manager_id}/summary", response_model=ClubSummary)
async def club_summary(path_manager_id: str, manager_id: ManagerId) -> ClubSummary:
    """Resumo curto pra badges e header do clube."""
    if path_manager_id != manager_id:
        raise HTTPException(status_code=403, detail="Manager ID mismatch")

    consequences = await _fetch_active_consequences(manager_id)

    unavailable_players: set[str] = set()
    alerts = 0
    celebrations = 0
    next_expiry: datetime | None = None
    player_impact: dict[str, int] = {}
    UNAVAILABILITY_KINDS = {
        "red_card_suspension",
        "red_card_suspension_repeat",
        "injury_light_out",
        "injury_medium_out",
        "injury_severe_out",
        "forced_rest",
    }

    for c in consequences:
        if c.player_id and c.kind in UNAVAILABILITY_KINDS:
            unavailable_players.add(c.player_id)
        if c.dimension == "physical" or c.dimension == "reputational":
            if c.magnitude < 0 or c.kind in UNAVAILABILITY_KINDS:
                alerts += 1
        if c.dimension == "psychological" and c.magnitude > 0:
            celebrations += 1
        if next_expiry is None or c.expires_at < next_expiry:
            next_expiry = c.expires_at
        if c.player_id:
            player_impact[c.player_id] = player_impact.get(c.player_id, 0) + 1

    most_impacted = (
        max(player_impact, key=lambda k: player_impact[k]) if player_impact else None
    )

    return ClubSummary(
        total_active=len(consequences),
        unavailable_players=len(unavailable_players),
        alerts=alerts,
        celebrations=celebrations,
        next_expiry_at=next_expiry,
        most_impacted_player_id=most_impacted,
    )


UNAVAILABILITY_KINDS = {
    "red_card_suspension",
    "red_card_suspension_repeat",
    "injury_light_out",
    "injury_medium_out",
    "injury_severe_out",
    "forced_rest",
}


@router.get("/{path_manager_id}/squad-overview", response_model=SquadOverview)
async def squad_overview(
    path_manager_id: str, manager_id: ManagerId
) -> SquadOverview:
    """
    Visão por jogador: lista de todos os jogadores com pelo menos 1
    consequência ativa, agregada por contagens + próxima expiração.
    Front usa essa rota pra montar a lista de "Plantel" na página SCOUTS.
    """
    if path_manager_id != manager_id:
        raise HTTPException(status_code=403, detail="Manager ID mismatch")

    consequences = await _fetch_active_consequences(manager_id)

    by_player: dict[str, list[Consequence]] = {}
    for c in consequences:
        if not c.player_id:
            continue
        by_player.setdefault(c.player_id, []).append(c)

    entries: list[SquadPlayerEntry] = []
    total_unavailable = 0

    for player_id, conseqs in by_player.items():
        alerts = 0
        celebrations = 0
        next_expiry: datetime | None = None
        dim_counter: Counter[str] = Counter()
        is_unavailable = False

        for c in conseqs:
            dim_counter[c.dimension] += 1
            if c.kind in UNAVAILABILITY_KINDS or c.magnitude < 0:
                alerts += 1
            elif c.magnitude > 0:
                celebrations += 1
            if c.kind in UNAVAILABILITY_KINDS:
                is_unavailable = True
            if next_expiry is None or c.expires_at < next_expiry:
                next_expiry = c.expires_at

        if is_unavailable:
            total_unavailable += 1

        dominant = dim_counter.most_common(1)[0][0] if dim_counter else None

        entries.append(
            SquadPlayerEntry(
                player_id=player_id,
                active_count=len(conseqs),
                alerts=alerts,
                celebrations=celebrations,
                is_unavailable=is_unavailable,
                next_expiry_at=next_expiry,
                dominant_dimension=dominant,  # type: ignore[arg-type]
            )
        )

    # Ordena: indisponíveis primeiro, depois mais alertas, depois mais ativos
    entries.sort(
        key=lambda e: (
            -int(e.is_unavailable),
            -e.alerts,
            -e.active_count,
        )
    )

    return SquadOverview(
        manager_id=manager_id,
        generated_at=datetime.now(timezone.utc),
        players=entries,
        total_players_affected=len(entries),
        total_unavailable=total_unavailable,
    )
