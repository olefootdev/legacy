#!/usr/bin/env python3
"""
match_simulator.py — Pré-computa uma Partida Rápida (90') do Olefoot.

Lê JSON via stdin com:
  {
    "seed": "abc123",
    "home_short": "FLA",
    "away_short": "PAL",
    "home_team": {"strength": 78, "intensity": "balanced", "lineup": [{...}, ...]},
    "away_team": {"strength": 75, "lineup": [{...}, ...]}
  }

Escreve JSON via stdout com o MatchPlan (ver schema no fim).

Filosofia:
- Resultado determinístico por seed (mesmo input → mesma simulação)
- 90 minutos simulados em <200ms
- Cada evento ganha um "weight_tier" pra o TS animar com timing variável
- Sem numpy/scipy — random stdlib basta pra esse uso

Use:
  echo '{"seed":"x",...}' | python3 match_simulator.py
"""

import json
import math
import random
import sys
import time
from typing import Any, Dict, List, Optional

from xg_model import shot_outcome_weights, xg_from_context
from narrative_weighter import classify_event_weight, detect_narrative_arc


def normalize_lineup(team: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Garante 11 jogadores com campos mínimos."""
    out = []
    for p in team.get("lineup", [])[:11]:
        out.append({
            "id": p.get("id", f"unk-{len(out)}"),
            "name": p.get("name", "Jogador"),
            "pos": p.get("pos", "MC"),
            "role": p.get("role", "mid"),
            "finalizacao": int(p.get("finalizacao", 60)),
            "passe": int(p.get("passe", 60)),
            "marcacao": int(p.get("marcacao", 60)),
            "velocidade": int(p.get("velocidade", 60)),
            "fisico": int(p.get("fisico", 60)),
            "confianca": int(p.get("confianca", 60)),
            "fatigue": float(p.get("fatigue", 0)),
        })
    while len(out) < 11:
        out.append({
            "id": f"filler-{len(out)}",
            "name": "Reserva",
            "pos": "MC", "role": "mid",
            "finalizacao": 55, "passe": 55, "marcacao": 55,
            "velocidade": 55, "fisico": 55, "confianca": 55, "fatigue": 0,
        })
    return out


def team_strength(team_lineup: List[Dict[str, Any]], base_strength: int) -> float:
    """Força efetiva: média ponderada da lineup × base_strength do clube (50% cada)."""
    if not team_lineup:
        return float(base_strength)
    # Ponderado por role: atacante pesa finalização; meio pesa passe; def pesa marcação.
    total = 0.0
    for p in team_lineup:
        role = p["role"]
        if role == "attack":
            total += p["finalizacao"] * 0.5 + p["velocidade"] * 0.3 + p["confianca"] * 0.2
        elif role == "mid":
            total += p["passe"] * 0.5 + p["confianca"] * 0.25 + p["velocidade"] * 0.25
        elif role == "def":
            total += p["marcacao"] * 0.55 + p["fisico"] * 0.3 + p["passe"] * 0.15
        else:  # gk
            total += p["marcacao"] * 0.6 + p["confianca"] * 0.4
    avg = total / len(team_lineup)
    # Fadiga corta força (cada 10% de fadiga média = -2 pontos)
    avg_fatigue = sum(p["fatigue"] for p in team_lineup) / len(team_lineup)
    avg -= avg_fatigue * 0.2
    return 0.5 * avg + 0.5 * base_strength


def pick_zone(rng: random.Random, possession: str) -> str:
    """Distribui posse em 3 zonas (def/mid/att) com bias pra meio."""
    r = rng.random()
    if r < 0.30:
        return "def"
    if r < 0.75:
        return "mid"
    return "att"


def pick_actor(rng: random.Random, lineup: List[Dict[str, Any]], zone: str, prev_actor_id: Optional[str]) -> dict:
    """Escolhe ator do tick com viés por zona + role (espelha pickBallCarrier do TS)."""
    weights = []
    for p in lineup:
        w = 1.0
        if zone == "att":
            w *= {"attack": 3.0, "mid": 1.6, "def": 0.3, "gk": 0.05}[p["role"]]
            w *= 0.78 + (p["finalizacao"] - 30) / 60 * 0.55
        elif zone == "mid":
            w *= {"attack": 1.6, "mid": 3.0, "def": 1.2, "gk": 0.05}[p["role"]]
            w *= 0.78 + (p["passe"] - 30) / 60 * 0.55
        else:
            w *= {"attack": 0.4, "mid": 1.6, "def": 3.0, "gk": 1.5}[p["role"]]
            w *= 0.78 + (p["marcacao"] - 30) / 60 * 0.55
        # Fadiga reduz peso
        if p["fatigue"] > 70:
            w *= 0.6
        if p["id"] == prev_actor_id:
            w *= 0.32  # anti-repeat
        weights.append(max(0.01, w))
    total = sum(weights)
    pick_r = rng.random() * total
    cumulative = 0.0
    for p, w in zip(lineup, weights):
        cumulative += w
        if cumulative >= pick_r:
            return p
    return lineup[-1]


def event_text(kind: str, actor_name: str, zone: str, minute: int, xg: float, tier: str) -> str:
    """Texto humano-pronto pro feed do TS."""
    flair = {
        "epic": "!!",
        "big": "!",
        "normal": ".",
        "minor": ".",
    }[tier]
    if kind == "goal_home":
        if tier == "epic":
            return f"{minute}' — GOLAÇO de {actor_name}{flair} Estádio explode."
        return f"{minute}' — {actor_name} marca! Bola no fundo da rede{flair}"
    if kind == "goal_away":
        return f"{minute}' — Adversário marca contra a corrente{flair}"
    if kind == "shot_home":
        if xg > 0.35:
            return f"{minute}' — {actor_name} obriga o goleiro a defesa difícil{flair}"
        return f"{minute}' — {actor_name} arrisca de fora; bola sai{flair}"
    if kind == "shot_away":
        return f"{minute}' — Adversário finaliza; goleiro segura{flair}"
    if kind == "yellow_home":
        return f"{minute}' — Amarelo pra {actor_name} por falta tática{flair}"
    if kind == "yellow_away":
        return f"{minute}' — Amarelo pro adversário{flair}"
    if kind == "red_home":
        return f"{minute}' — VERMELHO pra {actor_name}! Saída por entrada dura{flair}"
    if kind == "red_away":
        return f"{minute}' — Adversário expulso! Vantagem numérica{flair}"
    if kind == "injury_home":
        return f"{minute}' — {actor_name} cai com dores no gramado{flair}"
    if kind == "penalty_home":
        return f"{minute}' — PÊNALTI pra casa! {actor_name} pra bater{flair}"
    if kind == "penalty_away":
        return f"{minute}' — Pênalti pro adversário{flair}"
    return f"{minute}' — Jogada construída por {actor_name}{flair}"


def simulate(input_data: Dict[str, Any]) -> Dict[str, Any]:
    started = time.time()
    seed = str(input_data.get("seed", "default"))
    rng = random.Random(seed)

    home_team = input_data.get("home_team", {})
    away_team = input_data.get("away_team", {})
    home_lineup = normalize_lineup(home_team)
    away_lineup = normalize_lineup(away_team)
    home_strength = team_strength(home_lineup, int(home_team.get("strength", 70)))
    away_strength = team_strength(away_lineup, int(away_team.get("strength", 70)))

    # Diferença normalizada: -1 (away muito forte) .. +1 (home muito forte)
    diff = (home_strength - away_strength) / 25.0
    diff = max(-1.0, min(1.0, diff))

    intensity = input_data.get("home_team", {}).get("intensity", "balanced")
    intensity_goal_mul = {"defensive": 0.85, "balanced": 1.0, "offensive": 1.18}.get(intensity, 1.0)

    events: List[Dict[str, Any]] = []
    momentum_curve = []
    home_score = 0
    away_score = 0
    possession = "home" if diff >= 0 else "away"
    prev_actor_id = None
    prev_actor_id_away = None
    cards_home = 0
    cards_away = 0
    sent_off_home = 0
    sent_off_away = 0
    momentum_home = 50.0  # 0–100

    # Goal scorers tracking
    scorer_counts: Dict[str, Dict[str, Any]] = {}

    for minute in range(1, 91):
        # Possession flip (depende de força e momentum)
        flip_prob = 0.42 - diff * 0.08 - (momentum_home - 50) / 250
        flip_prob = max(0.18, min(0.62, flip_prob))
        if rng.random() < flip_prob:
            possession = "away" if possession == "home" else "home"

        zone = pick_zone(rng, possession)
        lineup_active = home_lineup if possession == "home" else away_lineup
        prev_id = prev_actor_id if possession == "home" else prev_actor_id_away
        actor = pick_actor(rng, lineup_active, zone, prev_id)
        if possession == "home":
            prev_actor_id = actor["id"]
        else:
            prev_actor_id_away = actor["id"]

        side_strength = home_strength if possession == "home" else away_strength
        opp_strength = away_strength if possession == "home" else home_strength

        # Decide se houve TIRO (depende de zona, força ofensiva, momentum)
        shot_prob = 0.0
        if zone == "att":
            shot_prob = 0.32 * intensity_goal_mul
            shot_prob *= 1 + (side_strength - 70) / 100
            mom_factor = (momentum_home - 50) if possession == "home" else (50 - momentum_home)
            shot_prob *= 1 + mom_factor / 200

        if rng.random() < shot_prob:
            # Calcula xG
            xg = xg_from_context(
                shooter_finishing=actor["finalizacao"],
                shooter_confidence=actor["confianca"],
                team_strength=side_strength,
                opponent_strength=opp_strength,
                zone=zone,
                intensity=intensity,
            )
            # Resolve outcome
            outcome_weights = shot_outcome_weights(xg)
            roll = rng.random()
            cumulative = 0.0
            outcome = "wide"
            for o, w in outcome_weights.items():
                cumulative += w
                if roll <= cumulative:
                    outcome = o
                    break

            is_goal = outcome == "goal"
            kind = ("goal_" if is_goal else "shot_") + possession
            tier = classify_event_weight(
                kind=kind,
                minute=minute,
                home_score=home_score,
                away_score=away_score,
                xg=xg,
            )
            text = event_text(kind, actor["name"], zone, minute, xg, tier)
            events.append({
                "minute": minute,
                "kind": kind,
                "actor_id": actor["id"],
                "actor_side": possession,
                "xg": round(xg, 3),
                "weight_tier": tier,
                "zone": zone,
                "text": text,
            })
            if is_goal:
                if possession == "home":
                    home_score += 1
                    momentum_home = min(95, momentum_home + 12)
                else:
                    away_score += 1
                    momentum_home = max(5, momentum_home - 12)
                stats = scorer_counts.setdefault(actor["id"], {"goals": 0, "name": actor["name"]})
                stats["goals"] += 1

        # Eventos disciplinares (raros)
        if rng.random() < 0.025 and zone != "att":
            side = possession  # quem comete falta = quem está defendendo? simplificação
            # Inverte: quem perde a bola comete falta
            foul_side = "away" if possession == "home" else "home"
            foul_lineup = away_lineup if foul_side == "away" else home_lineup
            foul_actor = rng.choice([p for p in foul_lineup if p["role"] != "gk"])
            yellow_kind = "yellow_" + foul_side
            tier = classify_event_weight(yellow_kind, minute, home_score, away_score, 0.0)
            events.append({
                "minute": minute,
                "kind": yellow_kind,
                "actor_id": foul_actor["id"],
                "actor_side": foul_side,
                "xg": 0,
                "weight_tier": tier,
                "zone": zone,
                "text": event_text(yellow_kind, foul_actor["name"], zone, minute, 0, tier),
            })
            if foul_side == "home":
                cards_home += 1
                if cards_home > 4 and rng.random() < 0.18 and sent_off_home == 0:
                    sent_off_home = 1
                    red_text = event_text("red_home", foul_actor["name"], zone, minute, 0, "epic")
                    events.append({
                        "minute": minute,
                        "kind": "red_home", "actor_id": foul_actor["id"],
                        "actor_side": "home", "xg": 0, "weight_tier": "epic",
                        "zone": zone, "text": red_text,
                    })
            else:
                cards_away += 1

        # Lesão (rara)
        if rng.random() < 0.012 and possession == "home":
            inj_actor = rng.choice([p for p in home_lineup if p["fatigue"] > 55] or home_lineup)
            tier = classify_event_weight("injury_home", minute, home_score, away_score, 0.0)
            events.append({
                "minute": minute,
                "kind": "injury_home",
                "actor_id": inj_actor["id"],
                "actor_side": "home",
                "xg": 0,
                "weight_tier": tier,
                "zone": zone,
                "text": event_text("injury_home", inj_actor["name"], zone, minute, 0, tier),
            })

        # Atualiza fatigue por minuto (in-place)
        for p in home_lineup + away_lineup:
            p["fatigue"] = min(100, p["fatigue"] + 0.55)

        # Momentum drift
        if possession == "home":
            momentum_home = min(95, momentum_home + 0.4)
        else:
            momentum_home = max(5, momentum_home - 0.4)
        # Recuo gradual ao 50 se nada acontece
        momentum_home += (50 - momentum_home) * 0.05

        momentum_curve.append(round(momentum_home, 1))

    # MVP projection — home apenas
    mvp = None
    if scorer_counts:
        best_id = max(scorer_counts, key=lambda k: scorer_counts[k]["goals"])
        mvp = {
            "player_id": best_id,
            "name": scorer_counts[best_id]["name"],
            "rating": 6.5 + scorer_counts[best_id]["goals"] * 0.8,
            "goals": scorer_counts[best_id]["goals"],
            "assists": 0,
        }

    arc = detect_narrative_arc(
        home_score=home_score,
        away_score=away_score,
        momentum_curve=momentum_curve,
        events=events,
    )

    return {
        "version": "1.0",
        "seed": seed,
        "home_short": input_data.get("home_short", "HOM"),
        "away_short": input_data.get("away_short", "AWA"),
        "home_score": home_score,
        "away_score": away_score,
        "events": events,
        "momentum_curve": momentum_curve,
        "mvp_projection": mvp,
        "narrative_arc": arc,
        "generated_at_ms": int(time.time() * 1000),
        "duration_ms": int((time.time() - started) * 1000),
    }


def main():
    raw = sys.stdin.read()
    try:
        input_data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"invalid_json: {e}"}), file=sys.stderr)
        sys.exit(1)
    plan = simulate(input_data)
    sys.stdout.write(json.dumps(plan, ensure_ascii=False))


if __name__ == "__main__":
    main()
