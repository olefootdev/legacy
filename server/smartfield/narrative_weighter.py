"""
narrative_weighter.py — Atribui peso editorial a cada evento.

Tiers:
  epic   — gol decisivo (virada, empate no fim), vermelho, gol histórico
  big    — gol normal, pênalti, defesa milagrosa
  normal — chute em direção ao gol, amarelo
  minor  — chute fora, falta comum

O TS usa o tier pra escolher duração da animação:
  epic   → 3-4s (zoom + replay + narrativa cinematográfica)
  big    → 1.5-2s (banner grande + flash)
  normal → 0.5s (toast lateral)
  minor  → 0.15s (badge rápida)
"""

import statistics
from typing import Any, Dict, List


def classify_event_weight(
    kind: str,
    minute: int,
    home_score: int,
    away_score: int,
    xg: float,
) -> str:
    """Decide tier do evento baseado em contexto narrativo."""
    # Golos sempre big, mas viram epic em situações decisivas
    if kind == "goal_home":
        new_score = home_score + 1
        if minute >= 85 and new_score - away_score in (0, 1):  # empate ou virada no fim
            return "epic"
        if minute >= 80 and abs(new_score - away_score) <= 1:
            return "epic"
        if xg > 0.45:  # chance muito clara concretizada
            return "big"
        return "big"
    if kind == "goal_away":
        new_away = away_score + 1
        if minute >= 85 and home_score - new_away in (0, 1):  # adversário empata/vira no fim
            return "epic"
        return "big"

    # Cartão vermelho sempre epic
    if kind in ("red_home", "red_away"):
        return "epic"

    # Pênalti sempre big
    if kind.startswith("penalty_"):
        return "big"

    # Chutes — tier depende do xG
    if kind.startswith("shot_"):
        if xg > 0.30:
            return "big"
        if xg > 0.12:
            return "normal"
        return "minor"

    # Lesões: big se titular chave, senão normal
    if kind.startswith("injury_"):
        return "big" if minute < 60 else "normal"

    # Amarelo: normal
    if kind.startswith("yellow_"):
        return "normal"

    return "minor"


def detect_narrative_arc(
    home_score: int,
    away_score: int,
    momentum_curve: List[float],
    events: List[Dict[str, Any]],
) -> str:
    """Classifica a partida em 5 arcos."""
    if not momentum_curve:
        return "balanced"

    avg_momentum = statistics.mean(momentum_curve)
    second_half_avg = statistics.mean(momentum_curve[45:]) if len(momentum_curve) > 45 else avg_momentum
    first_half_avg = statistics.mean(momentum_curve[:45]) if len(momentum_curve) > 5 else avg_momentum

    # Late drama: gol nos últimos 10 min mudando placar
    late_goals = [e for e in events if e["minute"] >= 80 and e["kind"].startswith("goal_")]
    if late_goals and abs(home_score - away_score) <= 1:
        return "late_drama"

    # Collapse: estava em vantagem e perdeu controle
    if first_half_avg > 60 and second_half_avg < 40:
        return "collapse"

    # Dominant control: momentum sempre alto
    if avg_momentum > 60 and home_score > away_score:
        return "dominant_control"

    # Underdog fight: time fraco que segurou ou venceu mesmo com pouco momentum
    if avg_momentum < 45 and home_score >= away_score:
        return "underdog_fight"

    return "balanced"
