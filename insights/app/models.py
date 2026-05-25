"""Pydantic models — espelham PersistentConsequence + ManagerPresence do TS."""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Dimension = Literal["physical", "psychological", "reputational", "financial"]
DecayCurve = Literal["step", "linear", "exponential"]
Scope = Literal["player", "club"]


class Consequence(BaseModel):
    """PersistentConsequence (espelha src/systems/consequences/types.ts)."""

    id: str
    manager_id: str
    club_id: str
    player_id: str | None = None
    kind: str
    dimension: Dimension
    scope: Scope
    magnitude: float
    decay_curve: DecayCurve = "linear"
    starts_at: datetime
    expires_at: datetime
    source_event_id: str | None = None
    metadata: dict[str, Any] | None = None


class EvaluatedConsequence(BaseModel):
    """Consequência com decay aplicado pro momento atual."""

    consequence: Consequence
    current_value: float
    life_remaining: float = Field(ge=0, le=1)
    ms_until_expiry: int


class ConsequencesByDimension(BaseModel):
    """Agrupamento por dimensão pra UI."""

    physical: list[EvaluatedConsequence] = []
    psychological: list[EvaluatedConsequence] = []
    reputational: list[EvaluatedConsequence] = []
    financial: list[EvaluatedConsequence] = []


class ClubSummary(BaseModel):
    """Resumo do clube — usado por badges e indicadores."""

    total_active: int
    unavailable_players: int
    alerts: int
    celebrations: int
    next_expiry_at: datetime | None = None
    most_impacted_player_id: str | None = None


class DigestCard(BaseModel):
    """Cartão de digest (alinhado com src/systems/dailyDigest.ts)."""

    id: str
    kind: Literal["alert", "celebration", "opportunity", "reminder", "highlight_match"]
    tone: Literal["positive", "negative", "neutral", "urgent"]
    title: str
    subtitle: str
    weight: int


class NightReport(BaseModel):
    """Relatório da noite — agregado pro slot "Café com o time" 5:30."""

    generated_at: datetime
    manager_id: str
    cards: list[DigestCard]
    one_line_summary: str
    resolved_overnight: int  # consequências que expiraram
    still_active: int
    new_alerts: int


# ─── Transparência por jogador / plantel ──────────────────────────────


class ExplainedConsequence(BaseModel):
    """Consequência avaliada + frase humana de explicação."""

    consequence: Consequence
    current_value: float
    life_remaining: float = Field(ge=0, le=1)
    ms_until_expiry: int
    title: str  # frase humana (vem de explanations.py)
    subtitle: str
    severity: Literal["info", "alert", "celebration", "neutral"]


class PlayerTimelineEvent(BaseModel):
    """Evento na timeline do jogador (consequência aplicada, expirada, etc.)."""

    at: datetime
    kind: Literal["consequence_applied", "consequence_expired"]
    consequence_id: str
    source_event_id: str | None = None
    title: str
    subtitle: str
    severity: Literal["info", "alert", "celebration", "neutral"]
    dimension: Dimension
    magnitude: float


class PlayerTransparency(BaseModel):
    """Resumo completo de um jogador específico — para painel detail."""

    player_id: str
    active: list[ExplainedConsequence]
    timeline: list[PlayerTimelineEvent]  # ordem decrescente (mais recente primeiro)
    total_active: int
    is_unavailable: bool  # tem injury_* ou red_card_suspension
    most_recent_event_at: datetime | None = None


class SquadPlayerEntry(BaseModel):
    """Linha de plantel — agregação por jogador para a lista do SCOUTS."""

    player_id: str
    active_count: int
    alerts: int  # consequências negativas
    celebrations: int  # consequências positivas
    is_unavailable: bool
    next_expiry_at: datetime | None = None
    dominant_dimension: Dimension | None = None  # qual dimensão tem mais consequências


class SquadOverview(BaseModel):
    """Visão completa do plantel — todos os jogadores com pelo menos 1 consequência ativa."""

    manager_id: str
    generated_at: datetime
    players: list[SquadPlayerEntry]
    total_players_affected: int
    total_unavailable: int
