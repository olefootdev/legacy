#!/usr/bin/env python3
"""
match_simulator.py — Pré-computa uma Partida Rápida (90') do Olefoot.

Lê JSON via stdin com:
  {
    "seed": "abc123",
    "home_short": "FLA",
    "away_short": "PAL",
    "home_team": {"strength": 78, "intensity": "balanced", "lineup": [{...}, ...]},
    "away_team": {"strength": 75, "lineup": [{...}, ...]},

    // Fase A (Quick Match 2.0) — opcionais:
    "mode": "full" | "second_half",
    "first_half": {"home_score": 1, "away_score": 0, "momentum_end": 62,
                   "cards_home": 1, "cards_away": 2,
                   "sent_off_home": 0, "sent_off_away": 0},
    "decisions": [{"beat_id": "...", "choice_id": "...",
                   "channel": "corredor_esquerdo", "target_side": "home",
                   "weight": 0.18}]
  }

Escreve JSON via stdout com o MatchPlan (schema espelhado em
src/match/quickPlanTypes.ts, versão 1.1).

Filosofia:
- Resultado determinístico por seed (mesmo input → mesma simulação)
- 2º tempo re-seedado por seed + fingerprint das decisões (replay coerente)
- 90 minutos simulados em <200ms
- MATCHUP MATRIX: gol não nasce de canal dominado pelo adversário — canais
  com edge muito negativo exigem momento de brilho (confiança >= 80, raro)
- Cada evento de chute/gol carrega channel + reason
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
from matchup_matrix import (
    ATTACK_CHANNELS,
    channel_reason,
    compute_matchup_matrix,
)
from analyst_beats import (
    BEAT_MINUTES_FULL,
    BEAT_MINUTES_SECOND_HALF,
    build_beat,
    build_decision_modifiers,
    decisions_fingerprint,
)

BRILLIANCE_MIN_CONFIDENCE = 80
BRILLIANCE_PROB = 0.35
SENT_OFF_STRENGTH_PENALTY = 6.0

# Vantagem do MANAGER ATIVO (online) contra um adversário no AUTOMÁTICO: quem
# decide o jogo merece um empurrão no ataque (nivela o fato de só ele "sofrer"
# com decisões ruins, já que o outro lado nunca erra uma escolha). Moderado de
# propósito — respeita os números do Python e não vira goleada injusta. Empate
# segue indo pros pênaltis. Aplicado ao xG do home.
HOME_ACTIVE_XG = 1.18


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
            # Ponte #1: atributos antes ignorados pelo motor.
            "drible": int(p.get("drible", 60)),
            "tatico": int(p.get("tatico", 60)),
            "mentalidade": int(p.get("mentalidade", 60)),
            "fair_play": int(p.get("fair_play", 70)),
            "fatigue": float(p.get("fatigue", 0)),
        })
    while len(out) < 11:
        out.append({
            "id": f"filler-{len(out)}",
            "name": "Reserva",
            "pos": "MC", "role": "mid",
            "finalizacao": 55, "passe": 55, "marcacao": 55,
            "velocidade": 55, "fisico": 55, "confianca": 55,
            "drible": 55, "tatico": 55, "mentalidade": 55, "fair_play": 70, "fatigue": 0,
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
    """Distribui posse em 3 zonas (def/mid/att). Mais presença no terço
    ofensivo = mais lances de construção e chances (jogo com ritmo)."""
    r = rng.random()
    if r < 0.26:
        return "def"
    if r < 0.66:
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


def pick_channel(rng: random.Random, matrix: Dict[str, Dict[str, Any]]) -> str:
    """Escolhe o canal de origem da jogada — edges positivos pesam mais (exp)."""
    weights = []
    total = 0.0
    for ch in ATTACK_CHANNELS:
        # Expoente 2.0: o canal dominante puxa o jogo pra si — o perigo flui por
        # um setor (textura), em vez de distribuição quase uniforme entre canais.
        w = math.exp(matrix[ch]["edge"] * 2.0)
        if ch == "bola_parada":
            w *= 0.45  # bola parada é evento menos frequente
        weights.append((ch, w))
        total += w
    r = rng.random() * total
    cumulative = 0.0
    for ch, w in weights:
        cumulative += w
        if cumulative >= r:
            return ch
    return ATTACK_CHANNELS[0]


def _seeded_pick(options: List[str], minute: int, salt: int) -> str:
    """Escolha estável (sem rng global) pra variar texto sem quebrar determinismo."""
    return options[(minute * 7 + salt) % len(options)]


def event_text(kind: str, actor_name: str, zone: str, minute: int, xg: float, tier: str) -> str:
    """Narração de resenha — direta, brasileira, com personalidade.

    Frases curtas, voz de quem está vendo o jogo. Cada tipo de evento constrói
    o ambiente: construção, chance clara, defensaça, trave, gol.
    """
    n = actor_name

    if kind == "goal_home":
        if tier == "epic":
            return _seeded_pick([
                f"GOLAÇO! {n} decide no detalhe — pra história!",
                f"{n} no ângulo! Que pintura, virou jogo!",
                f"NÃO ACREDITO! {n} resolve no sufoco!",
            ], minute, 1)
        return _seeded_pick([
            f"GOL! {n} empurrou pra rede, sem dó.",
            f"{n} apareceu na hora certa. É gol!",
            f"Pode comemorar — {n} fez o dele.",
        ], minute, 2)
    if kind == "goal_away":
        return _seeded_pick([
            "Calou o estádio. O adversário balançou a rede.",
            "Levou. O outro lado aproveitou a brecha.",
            "Gol do adversário, no contra-pé. Dói.",
        ], minute, 3)

    if kind == "chance_home":
        return _seeded_pick([
            f"CARA A CARA! {n} mandou por cima — era o gol feito.",
            f"{n} perdeu o impossível! Faltou o capricho.",
            f"Na cara do gol, {n} isolou. Que desperdício.",
        ], minute, 4)
    if kind == "chance_away":
        return "O adversário perdeu cara a cara. Respira, torcida."

    if kind == "save_home":
        return _seeded_pick([
            f"QUE DEFESA! {n} carimbou e o goleiro voou pra espalmar.",
            f"{n} obrigou o goleiro a fazer um milagre.",
            f"Que bomba do {n}! O goleiro pegou no susto.",
        ], minute, 5)
    if kind == "save_away":
        return "Chegou o adversário, mas o nosso goleiro garantiu."

    if kind == "woodwork_home":
        return _seeded_pick([
            f"NA TRAVE! {n} carimbou o travessão, que azar!",
            f"Quase! {n} acertou o pau. Faltou um nada.",
        ], minute, 6)
    if kind == "woodwork_away":
        return "UFA! O adversário acertou a trave. Sobrou pra nós."

    if kind == "counter_home":
        return f"Contra-ataque puxado por {n} — o time voou!"
    if kind == "counter_away":
        return "Cuidado! Adversário saiu em velocidade no contra-ataque."

    if kind == "corner_home":
        return f"Escanteio. {n} cobra e a área vira fervura."
    if kind == "corner_away":
        return "Escanteio pro adversário. Atenção na bola parada."

    if kind == "buildup_home":
        return _seeded_pick([
            f"{n} comanda o meio, time todo no toque.",
            f"Posse trabalhada, {n} pedindo paciência.",
            f"{n} segura a bola e organiza a saída.",
        ], minute, 7)
    if kind == "buildup_away":
        return "Adversário com a bola, tentando montar o ataque."

    if kind == "shot_home":
        return _seeded_pick([
            f"{n} arriscou de longe — passou raspando.",
            f"Chute de fora do {n}, sem perigo real.",
        ], minute, 8)
    if kind == "shot_away":
        return "Adversário tentou de longe, o goleiro tranquilo."

    if kind == "yellow_home":
        return f"Amarelo pra {n}. Entrada dura, tem que segurar."
    if kind == "yellow_away":
        return "Amarelo pro adversário. Faltou e levou."
    if kind == "red_home":
        return f"VERMELHO pra {n}! Saiu mais cedo, time com um a menos."
    if kind == "red_away":
        return "EXPULSO! O adversário ficou com dez. Vantagem nossa!"
    if kind == "injury_home":
        return f"{n} sentiu e caiu. Atenção no departamento médico."
    if kind == "penalty_home":
        return f"PÊNALTI PRA GENTE! {n} já pega a bola pra bater."
    if kind == "penalty_away":
        return "Pênalti pro adversário. Prende a respiração."

    return f"{n} aparece na jogada."


def simulate(input_data: Dict[str, Any]) -> Dict[str, Any]:
    started = time.time()
    seed = str(input_data.get("seed", "default"))
    mode = input_data.get("mode", "full")
    if mode not in ("full", "second_half"):
        mode = "full"
    decisions = input_data.get("decisions") or []

    if mode == "second_half":
        # Seed derivado: mesma partida + mesmas decisões = mesmo 2º tempo
        rng = random.Random(f"{seed}|h2|{decisions_fingerprint(decisions)}")
    else:
        rng = random.Random(seed)

    home_team = input_data.get("home_team", {})
    away_team = input_data.get("away_team", {})
    home_lineup = normalize_lineup(home_team)
    away_lineup = normalize_lineup(away_team)
    home_base = int(home_team.get("strength", 70))
    away_base = int(away_team.get("strength", 70))
    home_strength = team_strength(home_lineup, home_base)
    away_strength = team_strength(away_lineup, away_base)

    # MATCHUP MATRIX — cruzamento setorial dos 22 jogadores (Fase A).
    # Toda jogada de chute nasce de um canal; gol exige edge positivo.
    home_matrix = compute_matchup_matrix(home_lineup, away_lineup)
    away_matrix = compute_matchup_matrix(away_lineup, home_lineup)

    # Peso das decisões do manager → multiplicadores de xG por canal + BUFFER global
    home_mult, away_mult, away_global, home_global, away_suppress = build_decision_modifiers(decisions)

    # Edge ofensivo MÉDIO de cada time (estático no jogo) — alimenta o build-up
    # de pressão: quem tem vantagem setorial constrói cerco mais rápido.
    home_atk_edge = sum(home_matrix[ch]["edge"] for ch in ATTACK_CHANNELS) / len(ATTACK_CHANNELS)
    away_atk_edge = sum(away_matrix[ch]["edge"] for ch in ATTACK_CHANNELS) / len(ATTACK_CHANNELS)

    # Controle de MEIO-CAMPO (#5) → posse: quem domina o meio perde menos a bola.
    def _mid_quality(team_lineup: List[Dict[str, Any]]) -> float:
        mids = [p for p in team_lineup if p["role"] == "mid"]
        if not mids:
            return 60.0
        # Ponte #1: o tático pesa no controle de meio (leitura, menos perda de bola).
        return sum(p["passe"] * 0.42 + p["tatico"] * 0.25 + p["confianca"] * 0.18 + p["velocidade"] * 0.15 for p in mids) / len(mids)
    mid_adv_home = _mid_quality(home_lineup) - _mid_quality(away_lineup)  # >0 = casa controla o meio

    # Mentalidade média (#1): pesa no clutch (urgência por placar) e no pênalti.
    def _avg_mentality(team_lineup: List[Dict[str, Any]]) -> float:
        if not team_lineup:
            return 60.0
        return sum(p["mentalidade"] for p in team_lineup) / len(team_lineup)
    home_mentality = _avg_mentality(home_lineup)
    away_mentality = _avg_mentality(away_lineup)

    # Estado herdado do 1º tempo (replan)
    first_half = input_data.get("first_half") or {}
    if mode == "second_half":
        start_minute = 46
        home_score = int(first_half.get("home_score", 0))
        away_score = int(first_half.get("away_score", 0))
        momentum_home = float(first_half.get("momentum_end", 50.0))
        momentum_home = max(5.0, min(95.0, momentum_home))
        cards_home = int(first_half.get("cards_home", 0))
        cards_away = int(first_half.get("cards_away", 0))
        sent_off_home = int(first_half.get("sent_off_home", 0))
        sent_off_away = int(first_half.get("sent_off_away", 0))
        beat_minutes = BEAT_MINUTES_SECOND_HALF
    else:
        start_minute = 1
        home_score = 0
        away_score = 0
        momentum_home = 50.0  # 0–100
        cards_home = 0
        cards_away = 0
        sent_off_home = 0
        sent_off_away = 0
        beat_minutes = BEAT_MINUTES_FULL

    # Jogar com um a menos pesa na força coletiva
    home_strength -= SENT_OFF_STRENGTH_PENALTY * sent_off_home
    away_strength -= SENT_OFF_STRENGTH_PENALTY * sent_off_away

    # Diferença normalizada: -1 (away muito forte) .. +1 (home muito forte)
    diff = (home_strength - away_strength) / 25.0
    diff = max(-1.0, min(1.0, diff))

    home_intensity = home_team.get("intensity", "balanced")
    away_intensity = away_team.get("intensity", "balanced")
    intensity_mul = {"defensive": 0.85, "balanced": 1.0, "offensive": 1.18}
    # Exposição defensiva (#3): quem defende "ofensivo" se abre e concede mais;
    # "defensivo" se fecha e concede menos. Torna o estilo um risco/recompensa real.
    DEF_EXPOSURE = {"defensive": 0.85, "balanced": 1.0, "offensive": 1.16}

    events: List[Dict[str, Any]] = []
    momentum_curve = []
    analyst_beats: List[Dict[str, Any]] = []
    # PRESSÃO ACUMULADA (0–100 por lado) — o coração do momento lógico. Constrói
    # quando um time cerca (posse no ataque, chutes, quase-gols) e descarrega no
    # gol/pênalti. O momento ESPELHA a diferença de pressão, então a barra se move
    # de acordo com os dados, não por random walk. No 2º tempo, herda do momento.
    pressure_home = max(0.0, (momentum_home - 50.0)) * 1.1
    pressure_away = max(0.0, (50.0 - momentum_home)) * 1.1
    possession = "home" if diff >= 0 else "away"
    prev_actor_id = None
    prev_actor_id_away = None

    # ── ASSIMETRIA PRÉ-JOGO (#3) ────────────────────────────────────────────
    # Futebol é decidido por pequenas vantagens AMPLIFICADAS. Mesmo com OVRs
    # próximos, o jogo TENDE pra quem tem: mando de campo, força, melhor leitura
    # setorial (edges) e um jogador "quente". Sem isso a barra fica colada no 50.
    HOME_ADVANTAGE = 4.0
    hot_home = max((p.get("finalizacao", 60) for p in home_lineup), default=60)
    hot_away = max((p.get("finalizacao", 60) for p in away_lineup), default=60)
    hot_tilt = max(-3.0, min(3.0, (hot_home - hot_away) * 0.12))   # craque inclina o jogo
    edge_tilt = (home_atk_edge - away_atk_edge) * 22.0             # vantagem setorial pesa
    form_tilt = (float(home_team.get("form", 0)) - float(away_team.get("form", 0))) * 1.5
    base_tilt = HOME_ADVANTAGE + diff * 9.0 + edge_tilt + hot_tilt + form_tilt
    base_tilt = max(-16.0, min(16.0, base_tilt))
    if mode == "second_half":
        base_tilt *= 0.85  # no 2º tempo o mando pesa um pouco menos

    # ── CHOQUES DE EVENTO (#2) ──────────────────────────────────────────────
    # Gol/pênalti perdido empurram FORTE e o efeito PERSISTE (decai devagar), em
    # vez de ser engolido pelo retorno ao 50. man_down e fadiga são bias vivos.
    momentum_shock = 0.0
    fat_im = {"defensive": 0.85, "balanced": 1.0, "offensive": 1.2}

    def fatigue_rate(intensity_key: str, strength: float) -> float:
        # press/ataque cansam mais; time mais fraco corre mais atrás.
        return 0.5 * fat_im.get(intensity_key, 1.0) * (1 + max(0.0, (72 - strength)) / 160.0)
    home_fat_rate = fatigue_rate(home_intensity, home_strength)
    away_fat_rate = fatigue_rate(away_intensity, away_strength)

    # Goal scorers tracking
    scorer_counts: Dict[str, Dict[str, Any]] = {}

    for minute in range(start_minute, 91):
        # Possession flip (depende de força e momentum)
        flip_prob = 0.42 - diff * 0.08 - (momentum_home - 50) / 250
        # Meio-campo (#5): quem controla o meio segura mais a bola (perde menos posse).
        flip_prob -= (mid_adv_home if possession == "home" else -mid_adv_home) / 400.0
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

        # Força EFETIVA do minuto (#1): recalcula com a fadiga ACUMULADA — time
        # fundo/fresco atropela no fim; quem não rodou o elenco murcha. Inclui a
        # penalidade de expulsão. (A assimetria pré-jogo `base_tilt` segue estática.)
        home_eff = team_strength(home_lineup, home_base) - SENT_OFF_STRENGTH_PENALTY * sent_off_home
        away_eff = team_strength(away_lineup, away_base) - SENT_OFF_STRENGTH_PENALTY * sent_off_away
        side_strength = home_eff if possession == "home" else away_eff
        opp_strength = away_eff if possession == "home" else home_eff
        side_intensity = home_intensity if possession == "home" else away_intensity
        def_intensity = away_intensity if possession == "home" else home_intensity

        # PÊNALTI — MARCADOR (o placar NÃO muda aqui; o cliente resolve). Agora é
        # CONQUISTADO: só nasce de CERCO real (pressão acumulada alta), nunca do
        # nada num meio-campo equilibrado. Antes do pênalti, o build-up de pressão
        # já moveu a barra e gerou lances — a jogada tem construção e emoção.
        atk_pressure = pressure_home if possession == "home" else pressure_away
        pen_chance = 0.0
        if zone == "att" and minute > start_minute and atk_pressure > 28:
            pen_chance = 0.020 + (atk_pressure - 28) / 60.0 * 0.05  # ~2%→~6% conforme o cerco aperta
        penalty_awarded = pen_chance > 0 and rng.random() < pen_chance

        # Decide se houve TIRO (depende de zona, força ofensiva, momentum)
        shot_prob = 0.0
        if zone == "att":
            shot_prob = 0.42 * intensity_mul.get(side_intensity, 1.0)
            shot_prob *= 1 + (side_strength - 70) / 100
            mom_factor = (momentum_home - 50) if possession == "home" else (50 - momentum_home)
            shot_prob *= 1 + mom_factor / 200
            # Exposição do adversário (#3): defesa ofensiva concede mais chances.
            shot_prob *= DEF_EXPOSURE.get(def_intensity, 1.0)
            # Urgência por placar (#4): no fim, quem perde empurra; quem ganha administra.
            if minute >= 65:
                my_score = home_score if possession == "home" else away_score
                their_score = away_score if possession == "home" else home_score
                gd = my_score - their_score
                urgency = (minute - 65) / 25.0
                # Clutch (#1): mentalidade amplifica a reação de quem corre atrás.
                my_ment = home_mentality if possession == "home" else away_mentality
                ment_clutch = 1 + (my_ment - 60) / 160.0
                if gd < 0:
                    shot_prob *= 1 + 0.35 * urgency * min(2, -gd) * ment_clutch
                elif gd > 0:
                    shot_prob *= 1 - 0.18 * urgency

        if penalty_awarded:
            # Batedor sugerido = melhor finalizador em campo (cliente pode trocar).
            pen_actor = max(lineup_active, key=lambda p: p["finalizacao"])
            kind = "penalty_" + possession
            # Pênalti (#1): mentalidade do batedor calibra a conversão (frieza).
            pen_xg = max(0.58, min(0.90, 0.76 + (pen_actor["mentalidade"] - 60) / 380.0))
            events.append({
                "minute": minute,
                "kind": kind,
                "actor_id": pen_actor["id"],
                "actor_name": pen_actor["name"],
                "actor_side": possession,
                "xg": pen_xg,
                "weight_tier": "epic",
                "zone": "att",
                "channel": "finalizacao_vs_gk",
                "reason": "pênalti",
                "text": event_text(kind, pen_actor["name"], zone, minute, 0, "epic"),
            })
            # O cerco culminou no pênalti — descarrega a pressão.
            if possession == "home":
                pressure_home *= 0.55
            else:
                pressure_away *= 0.55
        elif rng.random() < shot_prob:
            # Canal de origem da jogada — vem da matchup matrix
            matrix_side = home_matrix if possession == "home" else away_matrix
            channel = pick_channel(rng, matrix_side)
            edge = matrix_side[channel]["edge"]
            gk_edge = matrix_side["finalizacao_vs_gk"]["edge"]

            # Calcula xG base e aplica o cruzamento setorial
            xg = xg_from_context(
                shooter_finishing=actor["finalizacao"],
                shooter_confidence=actor["confianca"],
                team_strength=side_strength,
                opponent_strength=opp_strength,
                zone=zone,
                intensity=side_intensity,
            )
            xg *= (1 + edge * 0.35) * (1 + gk_edge * 0.15)
            # Peso das decisões: canal a canal + BUFFER global (boas leituras
            # levantam o ataque inteiro / seguram a defesa inteira no 2º tempo).
            # Home ainda ganha a vantagem do manager ativo (HOME_ACTIVE_XG).
            if possession == "home":
                xg *= home_mult.get(channel, 1.0) * home_global * HOME_ACTIVE_XG
            else:
                xg *= away_mult.get(channel, 1.0) * away_global * away_suppress
            # Goleiro de verdade (#2): a qualidade do GK adversário abate o xG.
            # GK 62 = neutro; ~90 → -12%, ~40 → +9%. Clamp pra não zerar/explodir.
            def_lineup = away_lineup if possession == "home" else home_lineup
            gk = next((p for p in def_lineup if p["role"] == "gk"), None)
            if gk:
                gk_q = gk["marcacao"] * 0.6 + gk["confianca"] * 0.4
                xg *= max(0.6, min(1.12, 1 - (gk_q - 62) / 240.0))
            # Drible (#1): driblador cria chance melhor (rompe a marcação).
            xg *= 1 + (actor["drible"] - 60) / 300.0
            xg = max(0.02, min(0.65, xg))

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

            # REGRA DE OURO: gol não nasce de canal dominado pelo adversário.
            # Canal neutro (edge ~0) é futebol normal; quanto mais negativo o
            # edge, mais raro o gol — abaixo de ~-0.45 só com momento de brilho
            # (confiança alta), pra zebra existir.
            brilliance = False
            if outcome == "goal" and edge <= 0:
                allow_prob = max(0.0, 1.0 + edge * 2.2)
                if rng.random() < allow_prob:
                    pass  # canal disputado — gol possível, sem domínio adversário
                elif actor["confianca"] >= BRILLIANCE_MIN_CONFIDENCE and rng.random() < BRILLIANCE_PROB:
                    brilliance = True
                else:
                    outcome = "save"

            is_goal = outcome == "goal"

            # Mapeia o desfecho do chute em um EVENTO RICO (constrói ambiente):
            #   goal → gol | save → defensaça do goleiro | block→ cara a cara
            #   bloqueado ou escanteio | wide → cara a cara perdido ou chute fora
            # Trave (woodwork) entra como drama em chutes de boa chance.
            suffix = possession
            if is_goal:
                base = "goal"
            elif outcome == "save":
                base = "save"
            elif outcome == "block":
                base = "chance" if xg > 0.22 else "corner"
            elif outcome == "wide":
                base = "chance" if xg > 0.30 else "shot"
            else:  # miss_far
                base = "shot"
            # Bola na trave: drama extra em chutes perigosos que não viraram gol
            if not is_goal and xg > 0.25 and rng.random() < 0.10:
                base = "woodwork"

            kind = f"{base}_{suffix}"
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
                "actor_name": actor["name"],
                "actor_side": possession,
                "xg": round(xg, 3),
                "weight_tier": tier,
                "zone": zone,
                "channel": channel,
                "reason": channel_reason(channel, edge, brilliance),
                "text": text,
            })
            if is_goal:
                if possession == "home":
                    home_score += 1
                    pressure_home *= 0.6     # descarregou, mas a confiança fica
                    pressure_away *= 0.72     # adversário abalado
                    momentum_home = min(95, momentum_home + 16)
                    momentum_shock += 14      # ONDA: empurra forte e PERSISTE (#2)
                else:
                    away_score += 1
                    pressure_away *= 0.6
                    pressure_home *= 0.72
                    momentum_home = max(5, momentum_home - 16)
                    momentum_shock -= 14
                stats = scorer_counts.setdefault(actor["id"], {"goals": 0, "name": actor["name"]})
                stats["goals"] += 1
            elif base in ("chance", "save", "woodwork"):
                # Quase-gol INTENSIFICA o cerco — a pressão sobe de verdade.
                if possession == "home":
                    pressure_home = min(100.0, pressure_home + 11)
                else:
                    pressure_away = min(100.0, pressure_away + 11)
            elif base == "shot":
                # Finalização de longe: cerco leve.
                if possession == "home":
                    pressure_home = min(100.0, pressure_home + 5)
                else:
                    pressure_away = min(100.0, pressure_away + 5)
        else:
            # SEM chute neste minuto: emite evento de CONSTRUÇÃO pra dar ritmo.
            # Contra-ataque, escanteio ou posse trabalhada — o jogo "respira".
            # Densidade reduzida (anti-frenético): o jogo respira pela barra de
            # momento; construção aparece com parcimônia pra cada lance pesar.
            build_prob = 0.0
            if zone == "att":
                build_prob = 0.30
            elif zone == "mid":
                build_prob = 0.16
            # Sob CERCO (pressão alta), o jogo respira mais: escanteios e sufoco
            # aparecem com frequência, dando construção VISÍVEL antes do clímax
            # (pênalti/gol não saem "do nada" — vêm de um cerco que a barra mostra).
            siege = atk_pressure > 34
            if siege:
                build_prob += 0.22
            if rng.random() < build_prob:
                matrix_side = home_matrix if possession == "home" else away_matrix
                channel = pick_channel(rng, matrix_side)
                edge = matrix_side[channel]["edge"]
                mom_for_side = (momentum_home - 50) if possession == "home" else (50 - momentum_home)
                r = rng.random()
                if zone == "att" and r < (0.55 if siege else 0.34):
                    base = "corner"
                elif mom_for_side > 8 and r < 0.6:
                    base = "counter"
                else:
                    base = "buildup"
                kind = f"{base}_{possession}"
                tier = classify_event_weight(kind, minute, home_score, away_score, 0.0)
                events.append({
                    "minute": minute,
                    "kind": kind,
                    "actor_id": actor["id"],
                    "actor_name": actor["name"],
                    "actor_side": possession,
                    "xg": 0,
                    "weight_tier": tier,
                    "zone": zone,
                    "channel": channel,
                    "reason": channel_reason(channel, edge, False),
                    "text": event_text(kind, actor["name"], zone, minute, 0, tier),
                })

        # Eventos disciplinares (raros)
        if rng.random() < 0.025 and zone != "att":
            side = possession  # quem comete falta = quem está defendendo? simplificação
            # Inverte: quem perde a bola comete falta
            foul_side = "away" if possession == "home" else "home"
            foul_lineup = away_lineup if foul_side == "away" else home_lineup
            # Fair play (#1): quem comete a falta tende a ser o menos disciplinado
            # (sorteia 2, fica com o de menor fair_play); e o vermelho sai mais fácil.
            _foul_pool = [p for p in foul_lineup if p["role"] != "gk"]
            foul_actor = min(rng.sample(_foul_pool, min(2, len(_foul_pool))), key=lambda p: p["fair_play"]) if _foul_pool else rng.choice(foul_lineup)
            red_prob = 0.18 * (1 + max(0, 60 - foul_actor["fair_play"]) / 45.0)
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
                if cards_home > 4 and rng.random() < red_prob and sent_off_home == 0:
                    sent_off_home = 1
                    home_strength -= SENT_OFF_STRENGTH_PENALTY  # um a menos pesa JÁ
                    momentum_shock -= 12                        # e empurra o jogo pro adversário
                    red_text = event_text("red_home", foul_actor["name"], zone, minute, 0, "epic")
                    events.append({
                        "minute": minute,
                        "kind": "red_home", "actor_id": foul_actor["id"],
                        "actor_side": "home", "xg": 0, "weight_tier": "epic",
                        "zone": zone, "text": red_text,
                    })
            else:
                cards_away += 1
                if cards_away > 4 and rng.random() < red_prob and sent_off_away == 0:
                    sent_off_away = 1
                    away_strength -= SENT_OFF_STRENGTH_PENALTY
                    momentum_shock += 12                        # vantagem numérica pra casa
                    red_text = event_text("red_away", foul_actor["name"], zone, minute, 0, "epic")
                    events.append({
                        "minute": minute,
                        "kind": "red_away", "actor_id": foul_actor["id"],
                        "actor_side": "away", "xg": 0, "weight_tier": "epic",
                        "zone": zone, "text": red_text,
                    })

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

        # Atualiza fatigue por minuto (in-place) — DIVERGENTE: press/ataque e o time
        # mais fraco cansam mais. Vira "abafa"/"blitz final" no 2º tempo (#2).
        for p in home_lineup:
            p["fatigue"] = min(100, p["fatigue"] + home_fat_rate)
        for p in away_lineup:
            p["fatigue"] = min(100, p["fatigue"] + away_fat_rate)

        # ── PRESSÃO & MOMENTO ───────────────────────────────────────────────
        # Decaimento natural do cerco (o ímpeto esfria se o time não insiste).
        pressure_home *= 0.90
        pressure_away *= 0.90
        # Build-up do lado com a posse, conforme a zona (terço ofensivo = cerco).
        # Edge setorial + força + intensidade + BUFFER de decisão aceleram o cerco.
        side_imul = intensity_mul.get(side_intensity, 1.0)
        build = 8.5 if zone == "att" else 2.6 if zone == "mid" else 0.0
        if build > 0:
            if possession == "home":
                pressure_home = min(100.0, pressure_home
                    + build * side_imul * (1 + home_atk_edge * 0.8)
                    * (1 + (home_strength - 70) / 130) * home_global)
            else:
                pressure_away = min(100.0, pressure_away
                    + build * side_imul * (1 + away_atk_edge * 0.8)
                    * (1 + (away_strength - 70) / 130) * away_global * away_suppress)
        # O MOMENTO ESPELHA a diferença de pressão + os DESEQUILÍBRIOS reais:
        # assimetria pré-jogo (#3), choque de gol/cartão que persiste (#2),
        # um-a-menos o jogo todo (#2) e fadiga divergente no fim (#2).
        momentum_shock *= 0.90  # a onda do gol/cartão dura ~8-10 min
        man_down_bias = (sent_off_away - sent_off_home) * 13.0
        if minute >= 60:
            home_fat = sum(p["fatigue"] for p in home_lineup) / max(1, len(home_lineup))
            away_fat = sum(p["fatigue"] for p in away_lineup) / max(1, len(away_lineup))
            fatigue_bias = (away_fat - home_fat) * 0.5 * ((minute - 60) / 30.0)
        else:
            fatigue_bias = 0.0
        target = (50.0 + (pressure_home - pressure_away) * 0.5
                  + base_tilt + momentum_shock + man_down_bias + fatigue_bias)
        target = max(8.0, min(92.0, target))
        momentum_home += (target - momentum_home) * 0.24
        momentum_home = max(5.0, min(95.0, momentum_home))

        momentum_curve.append(round(momentum_home, 1))

        # Analyst beat — leitura do cenário + decisão pesada (Fase A)
        if minute in beat_minutes:
            analyst_beats.append(build_beat(
                rng=rng,
                minute=minute,
                half=1 if minute <= 45 else 2,
                home_matrix=home_matrix,
                away_matrix=away_matrix,
                home_short=input_data.get("home_short", "HOM"),
                away_short=input_data.get("away_short", "AWA"),
                momentum_curve=momentum_curve,
                home_score=home_score,
                away_score=away_score,
            ))

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
        "version": "1.1",
        "seed": seed,
        "mode": mode,
        "start_minute": start_minute,
        "home_short": input_data.get("home_short", "HOM"),
        "away_short": input_data.get("away_short", "AWA"),
        "home_score": home_score,
        "away_score": away_score,
        "events": events,
        "momentum_curve": momentum_curve,
        "matchup_matrix": {"home": home_matrix, "away": away_matrix},
        "analyst_beats": analyst_beats,
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
