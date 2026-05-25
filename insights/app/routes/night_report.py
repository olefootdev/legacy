"""
Relatório da noite — agregado pro slot "Café com o time" (5:30 BRT).

Pergunta-chave que responde:
  "O que aconteceu enquanto eu dormi?"

Pega:
  - Consequências que EXPIRARAM nas últimas N horas (resolvidas)
  - Consequências NOVAS criadas na noite (novas ameaças/oportunidades)
  - Estado atual: contagens + alertas críticos
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException

from ..auth import ManagerId
from ..models import DigestCard, NightReport
from ..supabase_client import get_supabase

router = APIRouter(prefix="/club", tags=["night-report"])

NIGHT_HOURS = 10  # 23:00-05:30 ≈ 6.5h, mas damos folga pra cobrir o dia anterior


@router.get("/{path_manager_id}/night-report", response_model=NightReport)
async def night_report(path_manager_id: str, manager_id: ManagerId) -> NightReport:
    if path_manager_id != manager_id:
        raise HTTPException(status_code=403, detail="Manager ID mismatch")

    sb = get_supabase()
    now = datetime.now(timezone.utc)
    window_start = (now - timedelta(hours=NIGHT_HOURS)).isoformat()
    now_iso = now.isoformat()

    # 1) Resolvidas: criadas antes da janela, expiradas dentro dela
    resolved = await sb.select(
        "club_consequences",
        filters={
            "manager_id": f"eq.{manager_id}",
            "expires_at": f"gte.{window_start}",
        },
        select="id,kind,dimension,expires_at,scope,player_id",
        limit=200,
    )
    resolved_overnight = [
        r for r in resolved
        if datetime.fromisoformat(r["expires_at"].replace("Z", "+00:00")) <= now
    ]

    # 2) Ainda ativas
    still_active_rows = await sb.select(
        "club_consequences",
        filters={
            "manager_id": f"eq.{manager_id}",
            "expires_at": f"gt.{now_iso}",
        },
        select="id,kind,dimension,magnitude,scope,player_id,expires_at",
        order="expires_at.asc",
    )

    # 3) Novas na noite (criadas no período)
    new_in_night = await sb.select(
        "club_consequences",
        filters={
            "manager_id": f"eq.{manager_id}",
            "starts_at": f"gte.{window_start}",
            "expires_at": f"gt.{now_iso}",
        },
        select="id,kind,dimension,magnitude,scope,player_id,starts_at",
        limit=100,
    )

    # Cards: até 5 cards mais relevantes
    cards: list[DigestCard] = []

    # Alertas críticos (lesões + suspensões ativas)
    UNAVAILABILITY_KINDS = {
        "red_card_suspension",
        "red_card_suspension_repeat",
        "injury_light_out",
        "injury_medium_out",
        "injury_severe_out",
        "forced_rest",
    }
    for c in still_active_rows[:10]:
        if c["kind"] in UNAVAILABILITY_KINDS:
            label_map = {
                "red_card_suspension": "Suspensão ativa",
                "red_card_suspension_repeat": "Suspensão reincidente",
                "injury_light_out": "Lesão leve",
                "injury_medium_out": "Lesão moderada",
                "injury_severe_out": "Lesão grave",
                "forced_rest": "Descanso obrigatório",
            }
            cards.append(
                DigestCard(
                    id=f"alert_{c['id']}",
                    kind="alert",
                    tone="urgent" if "severe" in c["kind"] else "negative",
                    title=label_map.get(c["kind"], c["kind"]),
                    subtitle="Voltou ainda indisponível",
                    weight=90 if "severe" in c["kind"] else 70,
                )
            )

    # Celebrações (MVPs, hat-tricks) ainda ativos
    for c in still_active_rows[:10]:
        if c["kind"] in ("morale_boost_mvp", "morale_boost_hat_trick"):
            cards.append(
                DigestCard(
                    id=f"celeb_{c['id']}",
                    kind="celebration",
                    tone="positive",
                    title=(
                        "Hat-trick recente"
                        if c["kind"] == "morale_boost_hat_trick"
                        else "MVP recente"
                    ),
                    subtitle="Moral elevado",
                    weight=60,
                )
            )

    cards.sort(key=lambda c: c.weight, reverse=True)
    cards = cards[:5]

    # Sumário 1 linha
    parts = []
    if resolved_overnight:
        parts.append(f"{len(resolved_overnight)} resolvida{'s' if len(resolved_overnight) > 1 else ''}")
    if still_active_rows:
        parts.append(f"{len(still_active_rows)} ativa{'s' if len(still_active_rows) > 1 else ''}")
    if new_in_night:
        parts.append(f"{len(new_in_night)} nova{'s' if len(new_in_night) > 1 else ''}")
    one_line = " · ".join(parts) or "Nada novo desde sua última visita."

    return NightReport(
        generated_at=now,
        manager_id=manager_id,
        cards=cards,
        one_line_summary=one_line,
        resolved_overnight=len(resolved_overnight),
        still_active=len(still_active_rows),
        new_alerts=sum(1 for c in new_in_night if c["dimension"] in ("physical", "reputational")),
    )
