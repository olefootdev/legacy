"""
analyst_beats.py — Leituras do Analista + decisões com peso real.

Cada beat nasce da matchup matrix (verdade setorial dos 22 jogadores) +
estado do jogo no minuto do beat. A escolha "certa" é inferível do texto
do insight — quem lê o cenário acerta. Skill, não sorte.

Os pesos calculados aqui são a FONTE DE VERDADE: o TS só ecoa de volta
{channel, target_side, weight} no replan do 2º tempo, e o simulador aplica
como multiplicador de xG por canal.

Convenção de peso:
  target_side="home", weight > 0  → boost de xG do home no canal
  target_side="home", weight < 0  → corta xG do home no canal + dá fôlego global ao away
  target_side="away", weight > 0  → REDUZ xG do away no canal (escolha defensiva)
"""

import random
from typing import Any, Dict, List

from matchup_matrix import ATTACK_CHANNELS, CHANNEL_LABELS

BEAT_MINUTES_FULL = [18, 35, 58, 78]
BEAT_MINUTES_SECOND_HALF = [58, 78]
BEAT_WINDOW_MS = 5000

# Gênero gramatical dos labels — concordância dos templates PT-BR
CHANNEL_GENDER = {
    "ataque_central": "m",
    "corredor_esquerdo": "m",
    "corredor_direito": "m",
    "criacao": "f",
    "bola_parada": "f",
    "finalizacao_vs_gk": "f",
    "pressao": "f",
}


def _art(ch: str) -> str:
    """Artigo definido: 'o corredor', 'a bola parada'."""
    return "o" if CHANNEL_GENDER.get(ch, "m") == "m" else "a"


def _em(ch: str) -> str:
    """Contração em+artigo: 'no corredor', 'na criação'."""
    return "no" if CHANNEL_GENDER.get(ch, "m") == "m" else "na"


def _por(ch: str) -> str:
    """Contração por+artigo: 'pelo corredor', 'pela bola parada'."""
    return "pelo" if CHANNEL_GENDER.get(ch, "m") == "m" else "pela"

# Clamp de segurança aplicado também no replay (pesos ecoados pelo TS)
WEIGHT_CLAMP = 0.25


def _trend(momentum_curve: List[float]) -> str:
    if len(momentum_curve) < 6:
        return "stable"
    delta = momentum_curve[-1] - momentum_curve[-6]
    if delta > 4:
        return "rising"
    if delta < -4:
        return "falling"
    return "stable"


def build_beat(
    rng: random.Random,
    minute: int,
    half: int,
    home_matrix: Dict[str, Dict[str, Any]],
    away_matrix: Dict[str, Dict[str, Any]],
    home_short: str,
    away_short: str,
    momentum_curve: List[float],
    home_score: int,
    away_score: int,
) -> Dict[str, Any]:
    atk_edges = {ch: home_matrix[ch]["edge"] for ch in ATTACK_CHANNELS}
    best = max(atk_edges, key=lambda ch: atk_edges[ch])
    worst = min(atk_edges, key=lambda ch: atk_edges[ch])
    if worst == best:  # edges uniformes: evita opção duplicada
        worst = next(ch for ch in ATTACK_CHANNELS if ch != best)
    away_edges = {ch: away_matrix[ch]["edge"] for ch in ATTACK_CHANNELS}
    threat = max(away_edges, key=lambda ch: away_edges[ch])

    trend = _trend(momentum_curve)
    lb = CHANNEL_LABELS[best]
    lw = CHANNEL_LABELS[worst]
    lt = CHANNEL_LABELS[threat]

    # --- Insight: leitura do cenário em PT-BR (template local, custo zero) ---
    if atk_edges[best] > 0.05:
        opening = rng.choice([
            f"O {away_short} sofre {_em(best)} {lb} — o espaço está lá, mas ainda falta transformar em chegada.",
            f"Leitura clara: {_art(best)} {lb} é onde o {away_short} mais se expõe.",
            f"O confronto setorial aponta: {_art(best)} {lb} é o caminho menos defendido pelo {away_short}.",
        ])
    else:
        opening = rng.choice([
            f"Jogo truncado: o {away_short} fecha bem todos os setores. {_art(best).upper()} {lb} ainda é a brecha menos vigiada.",
            f"O {away_short} está compacto — nenhum setor cede fácil, mas {_art(best)} {lb} é o menos protegido.",
        ])
    if away_edges[threat] > 0.05:
        threat_txt = f" Do outro lado, o perigo mora {_em(threat)} {lt} deles."
    else:
        threat_txt = f" Defensivamente o seu time controla — {_art(threat)} {lt} deles ainda não assustou."
    momentum_txt = {
        "rising": " Seu time cresce no jogo.",
        "falling": " O momento é deles agora — cuidado.",
        "stable": "",
    }[trend]
    text = opening + threat_txt + momentum_txt

    # --- Decisões: peso proporcional aos edges REAIS ---
    exploit_w = round(max(0.06, 0.08 + atk_edges[best] * 0.14), 3)
    shield_w = round(max(0.04, 0.05 + away_edges[threat] * 0.12), 3)
    trap_w = round(min(-0.04, atk_edges[worst] * 0.15), 3)

    choices = [
        {
            "id": f"beat-{minute}-exploit",
            "label": f"Atacar {_por(best)} {lb}",
            "channel": best,
            "target_side": "home",
            "weight": exploit_w,
        },
        {
            "id": f"beat-{minute}-shield",
            "label": f"Fechar {_art(threat)} {lt} deles",
            "channel": threat,
            "target_side": "away",
            "weight": shield_w,
        },
        {
            "id": f"beat-{minute}-trap",
            "label": f"Insistir {_em(worst)} {lw}",
            "channel": worst,
            "target_side": "home",
            "weight": trap_w,
        },
    ]
    rng.shuffle(choices)

    return {
        "id": f"beat-{minute}",
        "minute": minute,
        "half": half,
        "insight": {
            "text": text,
            "primary_channel": best,
            "threat_channel": threat,
            "momentum_trend": trend,
        },
        "choices": choices,
        "window_ms": BEAT_WINDOW_MS,
    }


def build_decision_modifiers(decisions: List[Dict[str, Any]]):
    """Converte o ledger de decisões em multiplicadores de xG por canal.

    Retorna (home_mult, away_mult, away_global):
      home_mult[ch]  — multiplica xG do home em ch
      away_mult[ch]  — multiplica xG do away em ch (escolhas defensivas reduzem)
      away_global    — boost global do away gerado por escolhas ruins do manager
    """
    home_mult: Dict[str, float] = {}
    away_mult: Dict[str, float] = {}
    away_global = 1.0
    for d in decisions or []:
        ch = d.get("channel")
        if ch not in CHANNEL_LABELS:
            continue
        try:
            w = float(d.get("weight", 0))
        except (TypeError, ValueError):
            continue
        w = max(-WEIGHT_CLAMP, min(WEIGHT_CLAMP, w))
        if d.get("target_side") == "away":
            away_mult[ch] = away_mult.get(ch, 1.0) * (1 - max(0.0, w))
        else:
            home_mult[ch] = home_mult.get(ch, 1.0) * (1 + w)
            if w < 0:
                away_global *= 1 + abs(w) * 0.5
    return home_mult, away_mult, away_global


def decisions_fingerprint(decisions: List[Dict[str, Any]]) -> str:
    """String estável do ledger — entra no seed do 2º tempo (replay coerente)."""
    parts = []
    for d in decisions or []:
        try:
            w = round(float(d.get("weight", 0)), 3)
        except (TypeError, ValueError):
            w = 0.0
        parts.append(f"{d.get('channel')}:{d.get('target_side', 'home')}:{w}")
    return "|".join(parts)
