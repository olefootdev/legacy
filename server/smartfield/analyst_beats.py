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

# Minutos fixos das decisões do manager — ESPAÇADOS pra criar ritmo (respira →
# tensão → alívio). 2 por tempo + o INTERVALO como reset tático central:
#   1º tempo: 10', 30'  ·  INTERVALO (45')  ·  2º tempo: 60', 80'
# Menos decisões e bem distantes = mais emoção por decisão (anti-frenético).
BEAT_MINUTES_FULL = [10, 30, 60, 80]
BEAT_MINUTES_SECOND_HALF = [60, 80]
BEAT_WINDOW_MS = 6000

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


# Verbo tático ofensivo por canal (curto, pt-BR). target_side=home.
ATTACK_VERB = {
    "ataque_central": "Joga pelo meio",
    "corredor_esquerdo": "Ataca pela esquerda",
    "corredor_direito": "Ataca pela direita",
    "criacao": "Cadencia e cria",
    "bola_parada": "Aposta na bola parada",
    "pressao": "Pressão alta!",
}
# Verbo tático defensivo por canal (trava a ameaça deles). target_side=away.
DEFEND_VERB = {
    "ataque_central": "Fecha o meio deles",
    "corredor_esquerdo": "Fecha a esquerda",
    "corredor_direito": "Fecha a direita",
    "criacao": "Marca a criação deles",
    "bola_parada": "Atenção na bola parada",
    "pressao": "Segura o ímpeto deles",
}


def _attack_choice(minute: int, ch: str, edge: float, tag: str) -> Dict[str, Any]:
    return {
        "id": f"beat-{minute}-{tag}",
        "label": ATTACK_VERB.get(ch, "Ataca"),
        "channel": ch,
        "target_side": "home",
        # Canal forte → peso bom; canal fraco → armadilha (negativo).
        "weight": round(0.06 + edge * 0.30, 3),
    }


def _defend_choice(minute: int, ch: str, threat_edge: float, tag: str) -> Dict[str, Any]:
    return {
        "id": f"beat-{minute}-{tag}",
        "label": DEFEND_VERB.get(ch, "Recua o bloco"),
        "channel": ch,
        "target_side": "away",
        # Travar uma ameaça real vale; travar o que não assusta vale pouco.
        "weight": round(max(0.03, 0.05 + threat_edge * 0.16), 3),
    }


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
    away_edges = {ch: away_matrix[ch]["edge"] for ch in ATTACK_CHANNELS}
    atk_rank = sorted(ATTACK_CHANNELS, key=lambda ch: atk_edges[ch], reverse=True)
    threat_rank = sorted(ATTACK_CHANNELS, key=lambda ch: away_edges[ch], reverse=True)
    best, worst = atk_rank[0], atk_rank[-1]
    threat, threat2 = threat_rank[0], threat_rank[1]
    trend = _trend(momentum_curve)
    diff = home_score - away_score  # >0 ganhando, <0 perdendo
    mom = momentum_curve[-1] if momentum_curve else 50.0

    # INTENÇÃO do momento: o jogo está no ATAQUE da casa, na DEFESA, ou neutro?
    # Momentum manda; placar dá um empurrão (atrás → ataca; na frente → segura).
    score = mom + (-6 if diff < 0 else 5 if diff > 0 and trend != "rising" else 0)
    if score >= 57:
        intent = "attack"
    elif score <= 43:
        intent = "defend"
    else:
        intent = "neutral"

    lb = CHANNEL_LABELS[best]
    lt = CHANNEL_LABELS[threat]

    # --- Insight COMPACTO (pt-BR) — enquadrado pela intenção do momento ---
    if intent == "attack":
        text = rng.choice([
            f"CHANCE! {_art(best).capitalize()} {lb} tá livre — é gol na veia.",
            f"PRA CIMA! O {away_short} cede {_em(best)} {lb}.",
            f"AGORA! Brecha {_em(best)} {lb}, ataca!",
        ])
    elif intent == "defend":
        text = rng.choice([
            f"PERIGO! Eles vêm {_em(threat)} {lt} — segura o gol.",
            f"ATENÇÃO! {_art(threat).capitalize()} {lt} deles tá pegando fogo.",
            f"RECUA! O {away_short} pressiona {_em(threat)} {lt}.",
        ])
    else:
        opening = (f"{_art(best).capitalize()} {lb} tá livre." if atk_edges[best] > 0.05
                   else f"Jogo travado — tenta {_em(best)} {lb}.")
        tail = f" Cuidado com {_art(threat)} {lt} deles." if away_edges[threat] > 0.08 else " Atrás você controla."
        text = opening + tail

    # --- Opções moldadas pela intenção (ataca = fazer gol; defende = salvar) ---
    a_ch = atk_rank[0] if (minute // 20) % 2 == 0 else atk_rank[1]
    b_ch = threat if (minute // 17) % 2 == 0 else threat2

    if intent == "attack":
        # Dois caminhos pro gol + uma armadilha (forçar o canal fechado).
        c2 = next((c for c in atk_rank if c != a_ch), worst)
        choices = [
            _attack_choice(minute, a_ch, atk_edges[a_ch], "atk1"),
            _attack_choice(minute, c2, atk_edges[c2], "atk2"),
            {
                "id": f"beat-{minute}-trap",
                "label": ATTACK_VERB.get(worst, "Insiste"),
                "channel": worst, "target_side": "home",
                "weight": round(min(-0.04, atk_edges[worst] * 0.18), 3),
            },
        ]
    elif intent == "defend":
        # Duas formas de SALVAR o gol + um contra-ataque rápido.
        choices = [
            _defend_choice(minute, threat, away_edges[threat], "def1"),
            _defend_choice(minute, threat2, away_edges[threat2], "def2"),
            {**_attack_choice(minute, best, atk_edges[best], "counter"),
             "label": "Sai no contra-ataque"},
        ]
    else:
        choices = [
            _attack_choice(minute, a_ch, atk_edges[a_ch], "atk"),
            _defend_choice(minute, b_ch, away_edges[b_ch], "def"),
        ]
        if diff < 0:
            c_ch = next((c for c in atk_rank if c != a_ch), worst)
            choices.append(_attack_choice(minute, c_ch, atk_edges[c_ch], "push"))
        elif diff > 0:
            choices.append({
                "id": f"beat-{minute}-park", "label": "Recua o bloco",
                "channel": threat, "target_side": "away",
                "weight": round(max(0.03, 0.04 + away_edges[threat] * 0.10), 3),
            })
        else:
            choices.append({
                "id": f"beat-{minute}-trap", "label": ATTACK_VERB.get(worst, "Insiste"),
                "channel": worst, "target_side": "home",
                "weight": round(min(-0.04, atk_edges[worst] * 0.18), 3),
            })

    # Dedup por canal+lado (evita duas opções idênticas) e embaralha.
    seen = set()
    uniq = []
    for c in choices:
        key = (c["channel"], c["target_side"])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(c)
    while len(uniq) < 3:
        # Completa com um canal ofensivo ainda não usado.
        for c in atk_rank:
            if (c, "home") not in seen:
                uniq.append(_attack_choice(minute, c, atk_edges[c], f"alt{len(uniq)}"))
                seen.add((c, "home"))
                break
        else:
            break
    rng.shuffle(uniq)

    return {
        "id": f"beat-{minute}",
        "minute": minute,
        "half": half,
        "intent": intent,  # attack | defend | neutral — enquadra a UI (CHANCE/PERIGO)
        "insight": {
            "text": text,
            "primary_channel": best,
            "threat_channel": threat,
            "momentum_trend": trend,
        },
        "choices": uniq,
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
