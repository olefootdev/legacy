"""
motor_posses.py — O MOTOR DE POSSES (Partida Viva, Fase 1; docs/MOTOR-DE-POSSES.md).

A partida é uma sequência de POSSES de bola (uma por minuto, 90 por jogo).
Cada posse é uma cadeia de ações decididas por quem tem a bola, cada ação um
DUELO de atributo com lugar no campo (grade 3×3: terço × corredor), contra o
ocupante da célula — quem marca é quem está lá, pela formação, não um sorteio.

O que decide o resultado:
  - o portador escolhe (passe, condução, drible, lançamento, cruzamento, chute,
    recuo) por pesos: atributos, célula, DNA, intensidade, comandos, urgência;
  - cada ação é um duelo: drible × marcação, passe × linha de passe, lançamento ×
    leitura, cruzamento × físico do zagueiro e cabeceio × marcação, chute × goleiro
    (atributo próprio: 0,55·marcação + 0,25·velocidade + 0,20·confiança);
  - perdeu o duelo, a bola muda de lado ALI (o contra-ataque nasce onde roubou);
  - a posse acaba em gol, defesa, fora, escanteio, falta (cartão PESSOAL; segundo
    amarelo é vermelho; o expulso sai do mapa), pênalti ou perda;
  - o cansaço é por ação e abate o atributo de quem joga.

O que NÃO muda em relação ao motor por minutos (match_simulator.py):
  - os DADOS são por minuto (`seed|minuto`), nos três modos: replan reusa os dados;
  - a saída é o MESMO MatchPlan v1.1 (events, momentum_curve, matchup_matrix,
    analyst_beats, fluxo, team_stats, cadeia, decisivo, penalti, assist_id);
  - momento decisivo e pênalti vêm de decisivo.py; comandos de comandos_ao_vivo.py;
    narração de match_simulator.event_text; skills com nome de cadeia_lances.

A CADEIA do lance é a posse de verdade (não é desenhada depois do resultado).
Calibração: todas as constantes em CAL; a bateria é test_motor_posses.py.
"""

import hashlib
import math
import random
import time
from typing import Any, Dict, List, Optional, Set, Tuple

import idioma
from analyst_beats import BEAT_MINUTES_FULL, BEAT_MINUTES_SECOND_HALF, build_beat, build_decision_modifiers
from cadeia_lances import nomear_skills
from comandos_ao_vivo import aplicar_ordens, dna_no_minuto, limpar_comandos, marcacoes
from prova_de_causa import comparar, sem_a_causa
from decisivo import momento_decisivo, penalti_da_casa, penalti_de_fora
from plano_salvo import PlanoDoAusente, limpar_plano
from matchup_matrix import ATTACK_CHANNELS, channel_reason, compute_matchup_matrix
from narrative_weighter import classify_event_weight, detect_narrative_arc
from xg_model import shot_outcome_weights

# ── CALIBRAÇÃO (ponto de partida: docs/MOTOR-DE-POSSES.md §2) ───────────────
CAL: Dict[str, float] = {
    # decisão do portador (§2.2)
    "temperatura": 0.55,
    "w_passe": 1.00, "w_conducao": 0.40, "w_drible": 0.25, "w_lancamento": 0.20,
    "w_cruzamento": 0.30, "w_chute": 0.20, "w_chute_centro": 0.50, "w_recuo": 0.15,
    "chute_mid_min_fin": 78,
    # duelos (§2.3): base + 0,38·σ(d/0,12) − 0,19
    "base_passe": 0.89, "base_conducao": 0.82, "base_lancamento": 0.62,
    "base_cruzamento": 0.55, "base_drible": 0.46, "base_cabeceio": 0.38,
    "duelo_escala": 0.12, "duelo_ganho": 0.38,
    # faltas e cartões (§2.4): o duelo físico (condução/drible) pode virar falta,
    # ganho ou perdido; o passe interceptado sob pressão também (o bote atrasado).
    "falta_base": 0.30, "falta_fair": 0.22, "falta_duelo_perdido": 0.7, "falta_no_passe": 0.20,
    "amarelo_base": 0.07, "amarelo_fair": 0.16, "amarelo_terco": 0.05, "amarelo_drible": 0.08,
    "vermelho_direto": 0.010, "penalti_na_area": 0.04,
    # chute × goleiro (§2.5)
    "xg_centro": 0.16, "xg_corredor": 0.08, "xg_meio": 0.035, "xg_cabeceio": 0.11, "xg_falta_direta": 0.06,
    "xg_pressao": 0.45, "xg_goleiro": 0.25, "xg_livre": 1.25,
    # mando de campo: confiança, um empurrão nos duelos e no xG (calibrado pra 42–48% no confronto igual)
    "mando_confianca": 2.0, "mando_peso": 0.06, "mando_duelo": 4.0, "mando_xg": 0.08,
    # fadiga (§2.6)
    "fad_base_min": 0.30, "fad_agir": 0.12, "fad_marcar": 0.08, "fad_conduzir": 0.20, "fad_pressao_alta": 0.05,
    "fad_limiar": 55.0, "fad_escala": 300.0,
    # atmosfera (eventos de construção, como no motor antigo)
    "p_buildup": 0.35, "p_counter": 0.60, "max_acoes": 7,
    # reinícios de verdade (Fase 2): bola errada no corredor sai pela lateral; lançamento
    # errado pro terço de ataque às vezes é impedimento.
    "p_lateral": 0.40, "p_impedimento": 0.35,
}

C, L = 105.0, 68.0
PROF = {0: 0.22, 1: 0.52, 2: 0.80}
ZREL = {0: 0.17, 1: 0.50, 2: 0.83}
INTENSITY_MUL = {"defensive": 0.85, "balanced": 1.0, "offensive": 1.18}
DEF_EXPOSURE = {"defensive": 1.08, "balanced": 1.0, "offensive": 0.92}
FAT_IM = {"defensive": 0.85, "balanced": 1.0, "offensive": 1.2}
SENT_OFF_STRENGTH_PENALTY = 6.0
HOME_ADVANTAGE_TILT = 2.0

CASA_DA_POS: Dict[str, Tuple[int, int]] = {
    "GOL": (0, 1), "GK": (0, 1), "ZAG": (0, 1), "CB": (0, 1), "LAT": (0, 0), "LE": (0, 0), "LB": (0, 0), "LD": (0, 2), "RB": (0, 2),
    "VOL": (1, 1), "DM": (1, 1), "MC": (1, 1), "CM": (1, 1), "MEI": (1, 1), "AM": (1, 1), "ME": (1, 0), "MD": (1, 2),
    "PE": (2, 0), "LW": (2, 0), "PD": (2, 2), "RW": (2, 2), "ATA": (2, 1), "CA": (2, 1), "SA": (2, 1), "ST": (2, 1),
}
CASA_DO_ROLE = {"gk": (0, 1), "def": (0, 1), "mid": (1, 1), "attack": (2, 1)}

Jogador = Dict[str, Any]
Celula = Tuple[int, int]


def _rng(chave: str) -> random.Random:
    """Random determinístico por chave de texto, sem o sha512 do Random(str) (10× mais rápido)."""
    return random.Random(int.from_bytes(hashlib.blake2b(chave.encode("utf-8"), digest_size=8).digest(), "big"))


def _sig(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-max(-30.0, min(30.0, x))))


def _celula_base(p: Jogador) -> Celula:
    pos = str(p.get("pos", "")).upper()
    return CASA_DA_POS.get(pos) or CASA_DO_ROLE.get(p.get("role", "mid"), (1, 1))


def _efetivo(p: Jogador, k: str, padrao: int = 60) -> float:
    """Atributo abatido pelo cansaço (§2.6): `_fx` é o fator do minuto (ver `fator_do_minuto`)."""
    v = p.get(k)
    if v is None:
        v = padrao
    return v * p.get("_fx", 1.0)


def fator_do_minuto(p: Jogador) -> None:
    """Escreve no jogador os fatores do cansaço deste minuto: atributo (`_fx`) e peso de ocupação (`_wf`)."""
    f = float(p.get("fatigue", 0.0))
    p["_fx"] = 1.0 - max(0.0, f - CAL["fad_limiar"]) / CAL["fad_escala"]
    p["_wf"] = 1.0 - max(0.0, f - CAL["fad_limiar"]) / 400.0


def _goleiro_attr(gk: Optional[Jogador]) -> float:
    """Atributo próprio (`goleiro` na ficha) quando existir; senão derivado (§2.5)."""
    if not gk:
        return 60.0
    proprio = gk.get("goleiro")
    if isinstance(proprio, (int, float)) and 1 <= proprio <= 99:
        return float(proprio) * gk.get("_fx", 1.0)
    return 0.55 * _efetivo(gk, "marcacao") + 0.25 * _efetivo(gk, "velocidade") + 0.20 * _efetivo(gk, "confianca")


# FASE 1b — a classe do SMART-PROFILE muda ONDE o jogador pesa (§1.3) e O QUE ele
# prefere fazer com a bola (§2.2). Vem da rota (classesDaPartida, o classificador oficial).
CLASSES_CONHECIDAS = {
    "paredao", "goleiro_libero", "xerife", "zagueiro_construtor", "lateral_apoiador", "lateral_marcador",
    "volante_destruidor", "regista", "box_to_box", "maestro", "meia_chegada",
    "ponta_driblador", "velocista", "pivo", "falso_9", "matador",
}
# (fase, Δterço, Δcorredor relativo: 0 = mesmo, "centro" = c=1) → peso extra
CLASSE_OCUPA: Dict[str, List[Tuple[str, int, str, float]]] = {
    "regista": [("of", -1, "mesmo", 0.55)],
    "falso_9": [("of", -1, "centro", 0.6)],
    "ponta_driblador": [("of", 0, "mesmo", 0.2)],
    "velocista": [("of", 0, "mesmo", 0.2)],
    "matador": [("of", 0, "centro", 0.3)],
    "pivo": [("of", 0, "centro", 0.2)],
    "meia_chegada": [("of", 1, "centro", 0.3)],
    "box_to_box": [("of", 1, "centro", 0.3), ("def", -1, "centro", 0.3)],
    "lateral_apoiador": [("of", 2, "mesmo", 0.25)],
    "volante_destruidor": [("def", 0, "mesmo", 0.3)],
    "xerife": [("def", 0, "mesmo", 0.2)],
}
CLASSE_DECIDE: Dict[str, Dict[str, float]] = {
    "velocista": {"conducao": 0.30},
    "ponta_driblador": {"drible": 0.50},
    "regista": {"lancamento": 0.40},
    "maestro": {"lancamento": 0.25, "passe": 0.15},
    "matador": {"chute": 0.40},
    "meia_chegada": {"chute": 0.20},
    "falso_9": {"passe": 0.20},
    "zagueiro_construtor": {"passe": 0.15, "recuo": -0.10},
    "lateral_apoiador": {"cruzamento": 0.20, "conducao": 0.15},
}


def _espalhar(p: Jogador, fase: str, ajuste: float) -> List[Tuple[Celula, float]]:
    """Onde o jogador pesa, na fase ofensiva ('of') ou defensiva ('def') do SEU time.
    `ajuste` empurra o bloco pra frente (>0: pressão/vertical) ou pra trás (<0: solidez)."""
    t0, c0 = _celula_base(p)
    role = p.get("role", "mid")
    out: List[Tuple[Celula, float]] = []

    def add(t: int, c: int, w: float) -> None:
        if 0 <= t <= 2 and 0 <= c <= 2 and w > 0.02:
            out.append(((t, c), w))

    lateral = c0 != 1 and t0 == 0
    if fase == "of":
        add(t0, c0, 1.0)
        if role == "def":
            add(t0 + 1, c0, 0.5 if lateral else 0.25 + ajuste)
            if lateral:
                add(t0 + 2, c0, 0.2 + ajuste)
        elif role == "mid":
            add(t0 + 1, c0, 0.4 + ajuste)
            add(t0, 0 if c0 == 1 else 1, 0.3)
            add(t0, 2 if c0 == 1 else 1, 0.3 if c0 == 1 else 0.0)
        else:  # attack
            if c0 == 1:
                add(2, 0, 0.3)
                add(2, 2, 0.3)
            else:
                add(2, 1, 0.35)
                add(1, c0, 0.3 - ajuste)
    else:
        if role == "def":
            add(t0, c0, 1.0)
            add(t0, 0 if c0 == 1 else 1, 0.3)
            add(t0, 2 if c0 == 1 else 1, 0.3 if c0 == 1 else 0.0)
            if lateral:
                add(1, c0, 0.4 + ajuste)
        elif role == "mid":
            add(t0, c0, 0.8)
            add(t0 - 1, c0, 0.55 - ajuste)
            add(t0, 0 if c0 == 1 else 1, 0.3)
            add(t0, 2 if c0 == 1 else 1, 0.3 if c0 == 1 else 0.0)
            add(t0 + 1, c0, 0.15 + ajuste)
        else:
            add(t0, c0, 0.55 + ajuste)
            add(t0 - 1, c0, 0.5 - ajuste)
    for f, dt, onde, w in CLASSE_OCUPA.get(p.get("classe") or "", []):
        if f == fase:
            add(t0 + dt, 1 if onde == "centro" else c0, w)
    return out


def _ocupacao_estatica(lineup: List[Jogador], fase: str, ajuste: float,
                       cache: Dict[Tuple[str, str, float], Dict[Celula, List[Tuple[Jogador, float]]]], chave_time: str) -> Dict[Celula, List[Tuple[Jogador, float]]]:
    """Quem pesa em cada célula, pela formação (sem cansaço/cartão/expulsão, que entram na hora)."""
    chave = (chave_time, fase, round(ajuste, 2))
    tab = cache.get(chave)
    if tab is not None:
        return tab
    tab = {(t, c): [] for t in range(3) for c in range(3)}
    for p in lineup:
        if p.get("role") == "gk":
            continue
        for cell, w in _espalhar(p, fase, round(ajuste, 2)):
            tab[cell].append((p, w))
    cache[chave] = tab
    return tab


def _espelho(cell: Celula) -> Celula:
    """A célula do atacante vista pelo defensor (terço e corredor invertidos)."""
    return (2 - cell[0], 2 - cell[1])


def _pick(rng: random.Random, itens: List[Tuple[Jogador, float]], expo: float = 2.0) -> Optional[Jogador]:
    if not itens:
        return None
    pesos = [max(0.01, w) ** expo for _, w in itens]
    r = rng.random() * sum(pesos)
    acc = 0.0
    for (p, _), w in zip(itens, pesos):
        acc += w
        if acc >= r:
            return p
    return itens[-1][0]


def _duelo(rng: random.Random, base: float, a: float, d: float, mando: float = 0.0) -> bool:
    """`mando` > 0: a casa ataca (soma ao nosso); < 0: a casa defende (soma ao deles)."""
    a += max(0.0, mando)
    d += max(0.0, -mando)
    p = base + CAL["duelo_ganho"] * _sig(((a - d) / 100.0) / CAL["duelo_escala"]) - CAL["duelo_ganho"] / 2.0
    return rng.random() < max(0.03, min(0.97, p))


def _em_metros(acs: List[Dict[str, Any]], geo: "_Lado", rng_c: random.Random) -> List[Dict[str, Any]]:
    """Ações da posse (célula da grade) → pontos em metros no referencial do campo."""
    saida: List[Dict[str, Any]] = []
    for a in acs:
        t, c = a["cell"]
        if a["t"] in ("chute", "cabeceio", "cobranca", "cobranca_falta"):
            prof, zr = 1.0, 0.5
        elif a["t"] == "desvio":
            prof, zr = 1.0, a["zr"] if a["zr"] is not None else (0.0 if rng_c.random() < 0.5 else 1.0)
        elif a["t"] == "escanteio":
            prof, zr = 0.91, 0.45 + rng_c.random() * 0.1
        else:
            prof = (a["prof"] if a["prof"] is not None else PROF[t]) + (rng_c.random() - 0.5) * 0.08
            zr = (a["zr"] if a["zr"] is not None else ZREL[c]) + (rng_c.random() - 0.5) * 0.12
        x, z = geo.ponto(prof, zr)
        saida.append({"t": a["t"], "de": a["de"]["id"], "para": a["para"]["id"] if a["para"] else None, "x": x, "z": z,
                      **({} if a["ok"] else {"ok": 0})})
    return saida


class _Lado:
    def __init__(self, lado: str):
        self.casa = lado == "home"

    def ponto(self, prof: float, z_rel: float) -> Tuple[float, float]:
        x = prof * C if self.casa else (1 - prof) * C
        z = z_rel * L if self.casa else (1 - z_rel) * L
        return round(max(0.5, min(C - 0.5, x)), 1), round(max(0.5, min(L - 0.5, z)), 1)


def simular(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """O plano. Com `prova_de_causa` num replan de comando/decisão, também a PROVA:
    as próximas 10 posses com e sem a causa, com os mesmos dados (prova_de_causa.py)."""
    plano = _simular(input_data)
    causa = input_data.get("prova_de_causa")
    if isinstance(causa, dict) and plano.get("mode") == "from_minute" and not input_data.get("sem_cadeia"):
        pedido_sem = sem_a_causa(input_data, causa)
        if pedido_sem is not None:
            sem = _simular({**pedido_sem, "prova_de_causa": None})
            casa_ids = [p.get("id") for p in (input_data.get("home_team") or {}).get("lineup", []) if isinstance(p, dict)]
            plano["prova"] = comparar(plano, sem, int(plano["start_minute"]), causa, [i for i in casa_ids if isinstance(i, str)])
    return plano


_ACAO_DO_ESTILO = {
    "defend": ("fecha o time", "shuts up shop"), "counter": ("joga no contra-ataque", "sits back to counter"),
    "possession": ("pede a bola no pé", "asks to keep the ball"), "press": ("manda pressionar", "orders the press"),
    "attack": ("manda o time pro ataque", "sends the team forward"),
}
_ACAO_DO_GRITO = {"incentivar": ("incentiva o time", "fires the team up"), "cobrar": ("cobra o time", "demands more"),
                  "acalmar": ("pede calma", "calls for calm")}
_SITUACAO = {"ganhando": ("ganhando", "winning"), "empatando": ("empatando", "level"), "perdendo": ("perdendo", "losing"),
             "qualquer": ("como sempre", "as always")}


def _evento_do_plano_salvo(minute: int, regra: Dict[str, Any], dele: int, outro: int) -> Dict[str, Any]:
    """A narração do plano salvo disparando (o adversário ausente "comandando" pelo que fez de verdade)."""
    from plano_salvo import situacao
    i = 1 if idioma.en() else 0
    acoes = [a[i] for a in (_ACAO_DO_ESTILO.get(regra.get("estilo", "")), _ACAO_DO_GRITO.get(regra.get("grito", ""))) if a]
    sit = _SITUACAO[situacao(dele, outro)][i]
    texto = (f"Plano salvo do técnico deles ({sit}): {' e '.join(acoes)}." if i == 0
             else f"Their manager's saved plan ({sit}): {' and '.join(acoes)}.")
    return {"minute": minute, "kind": "narrative", "actor_side": "away", "xg": 0, "weight_tier": "minor", "zone": "mid",
            "text": texto, "plano_salvo": {k: regra[k] for k in ("depois", "quando", "estilo", "grito") if k in regra}}


def _simular(input_data: Dict[str, Any]) -> Dict[str, Any]:
    # Importa aqui pra não criar ciclo (match_simulator despacha pra cá).
    from match_simulator import event_text, fadiga_ate_o_replan, normalize_banco, normalize_lineup, read_dna, dz, team_strength

    idioma.definir(input_data.get("lang"))
    started = time.time()
    seed = str(input_data.get("seed", "default"))
    mode = input_data.get("mode", "full")
    if mode not in ("full", "second_half", "from_minute"):
        mode = "full"
    decisions = input_data.get("decisions") or []
    comandos = limpar_comandos(input_data.get("comandos")) if mode != "full" else []
    try:
        from_minute = max(2, min(90, int(input_data.get("from_minute", 2))))
    except (TypeError, ValueError):
        from_minute = 2
    sem_cadeia = bool(input_data.get("sem_cadeia"))
    # Fase 4 — LENDA COMO AGENTE: id → contagem das escolhas do atleta (decisivo.py).
    agentes = input_data.get("agentes") if isinstance(input_data.get("agentes"), dict) else None
    # Fase 4 — o adversário AUSENTE joga pelo plano salvo (plano_salvo.py): regras por situação.
    plano_fora = PlanoDoAusente(limpar_plano(input_data.get("plano_fora")))

    home_team = input_data.get("home_team", {})
    away_team = input_data.get("away_team", {})
    home_lineup = normalize_lineup(home_team)
    away_lineup = normalize_lineup(away_team)
    home_banco = normalize_banco(home_team)
    lineups = {"home": home_lineup, "away": away_lineup}
    classes = input_data.get("classes") if isinstance(input_data.get("classes"), dict) else {}
    for p in home_lineup + away_lineup + home_banco:
        c = classes.get(p["id"])
        p["classe"] = c if c in CLASSES_CONHECIDAS else None
    home_base = int(home_team.get("strength", 70))
    away_base = int(away_team.get("strength", 70))
    is_derby = bool(input_data.get("is_derby", False))
    derby_mult = 1.12 if is_derby else 1.0

    home_matrix = compute_matchup_matrix(home_lineup, away_lineup)
    away_matrix = compute_matchup_matrix(away_lineup, home_lineup)
    matrices = {"home": home_matrix, "away": away_matrix}
    home_mult, away_mult, away_global, home_global, away_suppress = build_decision_modifiers(decisions)
    home_atk_edge = sum(home_matrix[ch]["edge"] for ch in ATTACK_CHANNELS) / len(ATTACK_CHANNELS)
    away_atk_edge = sum(away_matrix[ch]["edge"] for ch in ATTACK_CHANNELS) / len(ATTACK_CHANNELS)

    home_dna_base = read_dna(home_team)
    home_dna = home_dna_base
    away_dna = read_dna(away_team)
    dnas = {"home": home_dna, "away": away_dna}
    intensities = {"home": home_team.get("intensity", "balanced"), "away": away_team.get("intensity", "balanced")}

    # Mando de campo (§2.5): confiança, não multiplicador de xG.
    for p in home_lineup:
        p["confianca"] = min(99, p["confianca"] + CAL["mando_confianca"])

    # ── estado herdado (replan) ──────────────────────────────────────────────
    first_half = input_data.get("first_half") or {}
    if mode == "from_minute":
        first_half = input_data.get("estado") or first_half
    if mode in ("second_half", "from_minute"):
        start_minute = 46 if mode == "second_half" else from_minute
        home_score = int(first_half.get("home_score", 0))
        away_score = int(first_half.get("away_score", 0))
        momentum_home = max(5.0, min(95.0, float(first_half.get("momentum_end", 50.0))))
        cards = {"home": int(first_half.get("cards_home", 0)), "away": int(first_half.get("cards_away", 0))}
        sent_off = {"home": int(first_half.get("sent_off_home", 0)), "away": int(first_half.get("sent_off_away", 0))}
        beat_minutes = BEAT_MINUTES_SECOND_HALF if mode == "second_half" else [
            b for b in (BEAT_MINUTES_SECOND_HALF if from_minute >= 46 else BEAT_MINUTES_FULL) if b >= from_minute]
    else:
        start_minute = 1
        home_score = away_score = 0
        momentum_home = 50.0
        cards = {"home": 0, "away": 0}
        sent_off = {"home": 0, "away": 0}
        beat_minutes = BEAT_MINUTES_FULL

    def fatigue_rate(side: str) -> float:
        base = CAL["fad_base_min"] * FAT_IM.get(intensities[side], 1.0)
        return base * (1 + dz(dnas[side], "intensidade") * 0.5 + dz(dnas[side], "pressao") * 0.3)

    # Replan: o fôlego gasto desde o APITO (o reserva só desde que entrou) — o intervalo não zera.
    if mode in ("second_half", "from_minute"):
        taxa_media = 0.46  # por minuto, medido na bateria (base + ações)
        fadiga_ate_o_replan(home_lineup, taxa_media * FAT_IM.get(intensities["home"], 1.0), 1, start_minute)
        for p in away_lineup:
            p["fatigue"] = min(100, p["fatigue"] + taxa_media * FAT_IM.get(intensities["away"], 1.0) * (start_minute - 1))

    # Expulsos herdados de um replan não têm id: o time joga com um a menos pela força e pela ocupação (peso).
    fora: Dict[str, Set[str]] = {"home": set(), "away": set()}
    amarelos: Dict[str, int] = {}
    # Replan (Fase 3): quem foi expulso continua fora do mapa; quem tem amarelo, o 2º é vermelho.
    if mode in ("second_half", "from_minute"):
        ids_casa = {p["id"] for p in home_lineup}
        for pid in (first_half.get("expulsos") or [])[:22]:
            if isinstance(pid, str):
                fora["home" if pid in ids_casa else "away"].add(pid)
        for pid in (first_half.get("amarelados") or [])[:22]:
            if isinstance(pid, str):
                amarelos[pid] = 1

    events: List[Dict[str, Any]] = []
    momentum_curve: List[float] = []
    analyst_beats: List[Dict[str, Any]] = []
    fluxo: List[List[Any]] = []
    jogadas_brutas: List[Dict[str, Any]] = []
    folego: List[List[Any]] = []
    pressure = {"home": max(0.0, momentum_home - 50.0) * 1.1, "away": max(0.0, 50.0 - momentum_home) * 1.1}
    momentum_shock = 0.0
    id_stats = {s: {"recoveries": 0, "high_recoveries": 0, "shots": 0, "xg": 0.0, "fouls": 0, "chances_created": 0} for s in ("home", "away")}
    posses = {"home": 0, "away": 0, "acoes": 0}
    scorer_counts: Dict[str, Dict[str, Any]] = {}

    def strength_eff(side: str) -> float:
        base = home_base if side == "home" else away_base
        return team_strength(lineups[side], base) - SENT_OFF_STRENGTH_PENALTY * sent_off[side]

    diff = max(-1.0, min(1.0, (strength_eff("home") - strength_eff("away")) / 25.0))
    hot_home = max((p.get("finalizacao", 60) for p in home_lineup), default=60)
    hot_away = max((p.get("finalizacao", 60) for p in away_lineup), default=60)
    base_tilt = HOME_ADVANTAGE_TILT + diff * 9.0 + (home_atk_edge - away_atk_edge) * 22.0 + max(-3.0, min(3.0, (hot_home - hot_away) * 0.12))
    base_tilt += (float(home_team.get("form", 0)) - float(away_team.get("form", 0))) * 1.5
    base_tilt = max(-16.0, min(16.0, base_tilt))
    if start_minute >= 46:
        base_tilt *= 0.85

    def mentalidade(side: str) -> float:
        lu = lineups[side]
        return sum(p["mentalidade"] for p in lu) / max(1, len(lu))

    cache_ocupacao: Dict[Tuple[str, str, float], Dict[Celula, List[Tuple[Jogador, float]]]] = {}
    # A próxima posse: quem, onde, como começa.
    proximo: Dict[str, Any] = {"lado": "home" if diff >= 0 else "away", "cell": (1, 1), "tipo": "saida", "roubou": False, "origem": [], "vitima": None, "recuperador": None, "zr": None}

    # ── a posse ──────────────────────────────────────────────────────────────
    for minute in range(start_minute, 91):
        rng = _rng(f"{seed}|{minute}")
        if comandos:
            home_dna = dna_no_minuto(home_dna_base, comandos, minute)
            dnas["home"] = home_dna
            aplicar_ordens(home_lineup, comandos, minute)
        if plano_fora.regras:
            for regra in plano_fora.no_minuto(minute, away_score, home_score):
                events.append(_evento_do_plano_salvo(minute, regra, away_score, home_score))
            if plano_fora.comandos:
                dnas["away"] = dna_no_minuto(away_dna, plano_fora.comandos, minute)
        lado = proximo["lado"]
        outro = "away" if lado == "home" else "home"
        meu = lineups[lado]
        deles = lineups[outro]
        dna_a = dnas[lado]
        dna_d = dnas[outro]
        int_a = intensities[lado]
        int_d = intensities[outro]
        posses[lado] += 1
        casa = lado == "home"

        # Ocupação da posse: ataque de quem tem a bola, defesa de quem não tem.
        ajuste_of = 0.12 * dz(dna_a, "vertical") + 0.08 * dz(dna_a, "pressao") - 0.10 * dz(dna_a, "solidez")
        ajuste_def = 0.15 * dz(dna_d, "pressao") - 0.15 * dz(dna_d, "solidez") + (0.05 if int_d == "offensive" else -0.05 if int_d == "defensive" else 0.0)
        for p in meu:
            fator_do_minuto(p)
        for p in deles:
            fator_do_minuto(p)
        of_est = _ocupacao_estatica(meu, "of", ajuste_of, cache_ocupacao, lado)
        def_est = _ocupacao_estatica(deles, "def", ajuste_def, cache_ocupacao, outro)
        exposicao = DEF_EXPOSURE.get(int_d, 1.0)
        fora_a, fora_d = fora[lado], fora[outro]
        # Por célula do ATACANTE: os defensores (já espelhados, com cansaço, cartão e exposição),
        # a pressão e a linha de passe — uma vez por minuto.
        of_tab: Dict[Celula, List[Tuple[Jogador, float]]] = {}
        def_atk: Dict[Celula, List[Tuple[Jogador, float]]] = {}
        pressao_cel: Dict[Celula, float] = {}
        linha_cel: Dict[Celula, float] = {}
        # FASE 3 — "marcar o 10": quem recebeu a ordem é o ocupante PRIORITÁRIO das células
        # onde o alvo joga (todo duelo do alvo passa a ser contra ele).
        marca: Dict[Celula, List[Jogador]] = {}
        marcados: Set[str] = set()
        if comandos and lado == "away":
            por_id_casa = {p["id"]: p for p in home_lineup if p["id"] not in fora["home"]}
            por_id_fora = {p["id"]: p for p in away_lineup if p["id"] not in fora["away"]}
            for jid, aid in marcacoes(comandos, minute).items():
                marcador, alvo_m = por_id_casa.get(jid), por_id_fora.get(aid)
                if not marcador or not alvo_m or marcador.get("role") == "gk":
                    continue
                marcados.add(aid)
                for cell_a, w_a in _espalhar(alvo_m, "of", round(ajuste_of, 2)):
                    if w_a >= 0.2:
                        marca.setdefault(cell_a, []).append(marcador)
        for t in range(3):
            for c in range(3):
                cell = (t, c)
                of_tab[cell] = [(p, w * p["_wf"]) for p, w in of_est[cell] if p["id"] not in fora_a]
                ds = [(p, w * p["_wf"] * exposicao * (0.85 if amarelos.get(p["id"], 0) >= 1 else 1.0)) for p, w in def_est[_espelho(cell)] if p["id"] not in fora_d]
                for mk in marca.get(cell, []):
                    ds = [(p, w) for p, w in ds if p is not mk] + [(mk, 1.6 * mk["_wf"] * exposicao)]
                def_atk[cell] = ds
                tot = 0.0
                soma = 0.0
                for p, w in ds:
                    tot += w
                    soma += w * (0.6 * p["marcacao"] + 0.4 * p["tatico"]) * p["_fx"]
                pressao_cel[cell] = min(1.8, tot)
                linha_cel[cell] = (soma / tot + (6.0 if tot > 1.2 else 0.0)) if tot > 0 else 35.0

        def defensores_em(cell: Celula) -> List[Tuple[Jogador, float]]:
            return def_atk[cell]

        def pressao_em(cell: Celula) -> float:
            return pressao_cel[cell]

        def linha_de_passe(cell: Celula) -> float:
            return linha_cel[cell]

        def marcador_em(cell: Celula) -> Optional[Jogador]:
            return _pick(rng, def_atk[cell])

        def receptor_em(cell: Celula, excluir: str) -> Optional[Jogador]:
            # Marcado de perto, o colega procura menos (a linha de passe dele está fechada).
            cands = [(p, w * (0.45 if p["id"] in marcados else 1.0)) for p, w in of_tab[cell] if p["id"] != excluir]
            return _pick(rng, cands, 1.5)

        def goleiro(side: str) -> Optional[Jogador]:
            return next((p for p in lineups[side] if p.get("role") == "gk" and p["id"] not in fora[side]), None)

        gk_deles = goleiro(outro)
        gk_attr = _goleiro_attr(gk_deles)
        mando = CAL["mando_duelo"] if casa else -CAL["mando_duelo"]

        # estado da posse
        cell: Celula = tuple(proximo["cell"])  # type: ignore[assignment]
        acoes: List[Dict[str, Any]] = []
        cartoes_do_minuto: List[Dict[str, Any]] = []
        roubou = bool(proximo["roubou"])
        tipo_inicio = proximo["tipo"]
        livre = False
        passes = 0
        segundos = 0.0
        fim: Optional[str] = None
        fim_info: Dict[str, Any] = {}
        terco_max = cell[0]

        def p_falta_de(marc: Optional[Jogador]) -> float:
            if marc is None:
                return 0.0
            # DNA de quem defende (e o grito "cobrar", que baixa a disciplina): indisciplina derruba mais, pressão alta também.
            dna_mult = max(0.3, 1 - dz(dna_d, "disciplina") * 1.2 + dz(dna_d, "pressao") * 0.4)
            return (CAL["falta_base"] + CAL["falta_fair"] * (100 - marc["fair_play"]) / 100.0) * dna_mult * derby_mult

        def cansa(p: Optional[Jogador], quanto: float) -> None:
            if p is not None:
                p["fatigue"] = min(100.0, float(p.get("fatigue", 0.0)) + quanto)

        def registrar(t: str, de: Jogador, para: Optional[Jogador], onde: Celula, ok: bool = True, prof: Optional[float] = None, zr: Optional[float] = None) -> None:
            acoes.append({"t": t, "de": de, "para": para, "cell": onde, "ok": ok, "prof": prof, "zr": zr})

        # Portador inicial: quem roubou (a cadeia do contra-ataque começa no desarme
        # de verdade), o goleiro no tiro de meta, ou o ocupante da célula.
        portador: Optional[Jogador] = None
        if tipo_inicio == "roubada" and proximo.get("recuperador") and proximo.get("vitima"):
            rec, vit = proximo["recuperador"], proximo["vitima"]
            if rec["id"] not in fora[lado] and vit["id"] not in fora[outro] and rec.get("role") != "gk":
                registrar("desarme", rec, vit, cell)
                portador = rec
        segue = proximo.get("com") if tipo_inicio == "normal" else None
        if portador is None and segue is not None and segue["id"] not in fora[lado]:
            portador = segue
        if portador is None:
            portador = _pick(rng, of_tab[cell], 1.5) or _pick(rng, [(p, 1.0) for p in meu if p["id"] not in fora[lado] and p.get("role") != "gk"]) or meu[0]
        if tipo_inicio == "tiro_meta":
            gk_meu = goleiro(lado)
            if gk_meu:
                portador = gk_meu

        urg = 0.0
        if minute >= 65:
            gd = (home_score - away_score) if casa else (away_score - home_score)
            if gd < 0:
                urg = 0.35 * ((minute - 65) / 25.0) * min(2, -gd) * (1 + (mentalidade(lado) - 60) / 160.0)
            elif gd > 0:
                urg = -0.18 * ((minute - 65) / 25.0)

        # ── bola parada herdada: escanteio / falta perto da área ────────────
        def cabecear(cobrador: Jogador, origem_t: str, de_onde: Celula, canal: Optional[str]) -> None:
            """Cruzamento/escanteio/falta alçada: a bola no ar, o melhor cabeceador × o zagueiro."""
            nonlocal fim, livre
            area = (2, 1)
            cands = [(p, w * (0.5 + _efetivo(p, "cabeceio", 55) / 100.0)) for p, w in of_tab[area] if p["id"] != cobrador["id"]]
            cabeca = _pick(rng, cands) or receptor_em(area, cobrador["id"]) or portador
            zag = marcador_em(area)
            d_fis = _efetivo(zag, "fisico") if zag else 40.0
            d_mar = _efetivo(zag, "marcacao") if zag else 40.0
            pe = cobrador.get("pe")
            pe_bom = 4 if (pe == "left" and de_onde[1] == 0) or (pe == "right" and de_onde[1] == 2) else 0
            # O cruzamento/escanteio termina na área (onde a bola cai), vindo do corredor.
            zr_corredor = ZREL[de_onde[1]] if de_onde[1] != 1 else (0.17 if rng.random() < 0.5 else 0.83)
            if origem_t == "escanteio" and acoes and acoes[-1]["t"] == "desvio" and acoes[-1]["zr"] is not None:
                zr_corredor = 0.17 if acoes[-1]["zr"] < 0.5 else 0.83
            registrar(origem_t, cobrador, cabeca, (2, de_onde[1]) if origem_t == "cruzamento" else area, True,
                      0.88 + rng.random() * 0.05 if origem_t == "cruzamento" else 0.91,
                      0.5 + (zr_corredor - 0.5) * (0.3 + rng.random() * 0.4) if origem_t == "cruzamento" else 0.45 + rng.random() * 0.1)
            fim_info["zr_canto"] = 0.0 if zr_corredor < 0.5 else 1.0
            chegou = _duelo(rng, CAL["base_cruzamento"], _efetivo(cobrador, "passe") + pe_bom + (4 if origem_t == "escanteio" else 0), d_fis, mando)
            if not chegou:
                # A zaga afasta: pra fora (escanteio, o desvio entra na próxima posse) ou alívio.
                if rng.random() < 0.30:
                    fim = "escanteio"
                else:
                    fim = "perda"
                fim_info.update({"recuperador": zag, "cell": area})
                return
            if _duelo(rng, CAL["base_cabeceio"], _efetivo(cabeca, "cabeceio", 55), d_mar, mando):
                chutar(cabeca, "cabeceio", canal)
            else:
                fim = "escanteio" if rng.random() < 0.35 else "perda"
                fim_info.update({"recuperador": zag, "cell": area})

        def chutar(quem: Jogador, como: str, canal_forcado: Optional[str] = None) -> None:
            """Chute × goleiro: xG, desfecho e o evento."""
            nonlocal fim, home_score, away_score, momentum_home, momentum_shock
            onde = cell if como != "cabeceio" else (2, 1)
            if como == "cabeceio":
                xg = CAL["xg_cabeceio"]
            elif como == "cobranca_falta":
                xg = CAL["xg_falta_direta"] + max(0.0, _efetivo(quem, "bola_parada", 55) - 60) / 400.0
            elif onde[0] == 2:
                xg = CAL["xg_centro"] if onde[1] == 1 else CAL["xg_corredor"]
            else:
                xg = CAL["xg_meio"]
            xg *= 0.55 + 0.9 * _efetivo(quem, "finalizacao") / 100.0 + 0.2 * _efetivo(quem, "confianca") / 100.0
            xg *= 1.0 - CAL["xg_pressao"] * (pressao_em(onde) / 1.8) * (0.4 if como in ("cabeceio", "cobranca_falta") else 1.0)
            xg *= 1.0 - CAL["xg_goleiro"] * (gk_attr - 60.0) / 40.0
            xg *= 1.0 + 0.30 * dz(dna_a, "criatividade") + 0.15 * dz(dna_a, "posse") - 0.10 * dz(dna_a, "vertical")
            if livre:
                xg *= CAL["xg_livre"]
            xg *= 1.0 + max(0.0, urg) * 0.5
            xg *= 1.0 + (derby_mult - 1.0) * 0.5
            if casa:
                xg *= 1.0 + CAL["mando_xg"]
            # canal e leitura do analista (pesos por canal + fôlego global)
            if canal_forcado:
                canal = canal_forcado
            elif acoes and acoes[-1]["t"] in ("cruzamento",):
                canal = "corredor_esquerdo" if acoes[-1]["cell"][1] == 0 else "corredor_direito"
            elif onde[1] != 1:
                canal = "corredor_esquerdo" if onde[1] == 0 else "corredor_direito"
            elif passes >= 3:
                canal = "criacao"
            else:
                canal = "ataque_central"
            if casa:
                xg *= home_mult.get(canal, 1.0) * home_global
            else:
                xg *= away_mult.get(canal, 1.0) * away_global * away_suppress
            xg = max(0.02, min(0.65, xg))
            outcome_weights = shot_outcome_weights(xg)
            roll = rng.random()
            acc = 0.0
            outcome = "wide"
            for o, w in outcome_weights.items():
                acc += w
                if roll <= acc:
                    outcome = o
                    break
            is_goal = outcome == "goal"
            id_stats[lado]["shots"] += 1
            id_stats[lado]["xg"] += xg
            if is_goal:
                base = "goal"
            elif outcome == "save":
                base = "save"
            elif outcome == "block":
                # O bloqueio é um chute (a cadeia acaba no chute); o escanteio que
                # ele pode dar é a posse SEGUINTE (com a cobrança de verdade).
                base = "chance" if xg > 0.22 else "shot"
            elif outcome == "wide":
                base = "chance" if xg > 0.30 else "shot"
            else:
                base = "shot"
            if not is_goal and xg > 0.25 and rng.random() < 0.10:
                base = "woodwork"
            registrar("chute" if como != "cabeceio" else "cabeceio", quem, None, onde, is_goal, 1.0, 0.5)
            if como == "cobranca_falta":
                acoes[-1]["t"] = "cobranca_falta"
            kind = f"{base}_{lado}"
            tier = classify_event_weight(kind=kind, minute=minute, home_score=home_score, away_score=away_score, xg=xg)
            zona = "att" if onde[0] == 2 else "mid"
            edge = matrices[lado][canal]["edge"] if canal in matrices[lado] else 0.0
            ev: Dict[str, Any] = {
                "minute": minute, "kind": kind, "actor_id": quem["id"], "actor_name": quem["name"], "actor_side": lado,
                "xg": round(xg, 3), "weight_tier": tier, "zone": zona, "channel": canal,
                "reason": channel_reason(canal, edge, False),
                "text": event_text(kind, quem["name"], zona, minute, xg, tier),
            }
            # Assistência: o último passe pro autor.
            assist = next((a for a in reversed(acoes[:-1]) if a["t"] in ("passe", "lancamento", "cruzamento", "escanteio") and a["para"] is not None and a["para"]["id"] == quem["id"]), None)
            if is_goal:
                ev["decisivo"] = momento_decisivo(seed, minute, kind, quem, home_lineup, away_lineup, agentes)
                if assist and assist["de"]["id"] != quem["id"]:
                    ev["assist_id"] = assist["de"]["id"]
                    ast = scorer_counts.setdefault(assist["de"]["id"], {"goals": 0, "assists": 0, "name": assist["de"]["name"]})
                    ast["assists"] += 1
                st = scorer_counts.setdefault(quem["id"], {"goals": 0, "assists": 0, "name": quem["name"]})
                st["goals"] += 1
                if casa:
                    home_score += 1
                    momentum_home = min(95, momentum_home + 16)
                    momentum_shock += 14
                else:
                    away_score += 1
                    momentum_home = max(5, momentum_home - 16)
                    momentum_shock -= 14
                pressure[lado] *= 0.6
                pressure[outro] *= 0.72
                fim = "gol"
            else:
                if base in ("chance", "save", "woodwork"):
                    pressure[lado] = min(100.0, pressure[lado] + 11)
                elif base == "shot":
                    pressure[lado] = min(100.0, pressure[lado] + 5)
                if base == "save":
                    fim = "defesa"
                elif outcome == "block" and rng.random() < 0.5:
                    fim = "escanteio"
                elif outcome == "block":
                    fim = "perda"
                    fim_info.update({"recuperador": marcador_em(onde), "cell": onde})
                else:
                    fim = "fora"
            ev["_acoes"] = list(acoes)
            events.append(ev)

        def falta_sofrida(vitima: Jogador, zag: Jogador, onde: Celula, drible_vencido: bool) -> None:
            """O defensor derrubou: cartão pessoal, pênalti na área, ou bola parada."""
            nonlocal fim, home_score, away_score, momentum_home, momentum_shock
            id_stats[outro]["fouls"] += 1
            terco_dele = onde[0] == 2  # terço de defesa DELE (nosso ataque)
            p_amarelo = CAL["amarelo_base"] + CAL["amarelo_fair"] * (100 - zag["fair_play"]) / 100.0 \
                + (CAL["amarelo_terco"] if terco_dele else 0.0) + (CAL["amarelo_drible"] if drible_vencido else 0.0)
            p_amarelo *= max(0.3, 1 - dz(dna_d, "disciplina") * 0.8) * derby_mult
            p_vermelho = (CAL["vermelho_direto"] + 0.02 * (100 - zag["fair_play"]) / 100.0) if terco_dele else 0.0
            r = rng.random()
            cartao: Optional[str] = None
            if r < p_vermelho:
                cartao = "red"
            elif r < p_vermelho + p_amarelo:
                cartao = "yellow"
            if cartao:
                segundo = cartao == "yellow" and amarelos.get(zag["id"], 0) >= 1
                if cartao == "yellow":
                    amarelos[zag["id"]] = amarelos.get(zag["id"], 0) + 1
                    cards[outro] += 1
                cadeia_cartao = [{"t": "conducao", "de": vitima, "para": None, "cell": onde, "ok": True, "prof": None, "zr": None},
                                 {"t": "falta", "de": zag, "para": vitima, "cell": onde, "ok": False, "prof": None, "zr": None}]
                # Os cartões entram DEPOIS dos lances do minuto (como no motor antigo): o
                # vermelho não tem cadeia, e ninguém age em cadeia depois de expulso.
                for k in ([cartao] if not segundo else ["yellow", "red"]):
                    kind = f"{k}_{outro}"
                    tier = classify_event_weight(kind, minute, home_score, away_score, 0.0)
                    cartoes_do_minuto.append({
                        "minute": minute, "kind": kind, "actor_id": zag["id"], "actor_name": zag["name"], "actor_side": outro,
                        "xg": 0, "weight_tier": tier, "zone": "def" if terco_dele else "mid",
                        "text": event_text(kind, zag["name"], "def", minute, 0, tier),
                        **({"_acoes": cadeia_cartao, "_cartao": True} if k == "yellow" else {}),
                    })
                if cartao == "red" or segundo:
                    fora[outro].add(zag["id"])
                    sent_off[outro] += 1
                    momentum_shock += 12 if outro == "away" else -12
            # Pênalti ou bola parada.
            if onde == (2, 1) and rng.random() < CAL["penalti_na_area"] * derby_mult:
                batedor = max((p for p in meu if p["id"] not in fora[lado]), key=lambda p: p["finalizacao"])
                if casa:
                    penalti = penalti_da_casa(seed, minute, batedor, home_lineup + home_banco)
                    gol = penalti["por_batedor"][batedor["id"]]
                else:
                    penalti = penalti_de_fora(seed, minute, batedor)
                    gol = penalti["gol"]
                kind = f"penalty_{lado}"
                pen_xg = max(0.58, min(0.90, 0.76 + (batedor["mentalidade"] - 60) / 380.0))
                acoes_pen = [{"t": "conducao", "de": vitima, "para": None, "cell": (2, 1), "ok": True, "prof": 0.86, "zr": None},
                             {"t": "falta", "de": zag, "para": vitima, "cell": (2, 1), "ok": False, "prof": 0.87, "zr": None},
                             {"t": "cobranca", "de": batedor, "para": None, "cell": (2, 1), "ok": gol, "prof": 1.0, "zr": 0.5}]
                events.append({
                    "minute": minute, "kind": kind, "actor_id": batedor["id"], "actor_name": batedor["name"], "actor_side": lado,
                    "xg": pen_xg, "weight_tier": "epic", "zone": "att", "channel": "finalizacao_vs_gk",
                    "reason": "penalty" if idioma.en() else "pênalti",
                    "text": event_text(kind, batedor["name"], "att", minute, 0, "epic"), "penalti": penalti, "_acoes": acoes_pen,
                })
                if gol:
                    if casa:
                        home_score += 1
                        momentum_home = min(95, momentum_home + 16)
                        momentum_shock += 14
                    else:
                        away_score += 1
                        momentum_home = max(5, momentum_home - 16)
                        momentum_shock -= 14
                    pressure[lado] *= 0.6
                    pressure[outro] *= 0.72
                    st = scorer_counts.setdefault(batedor["id"], {"goals": 0, "assists": 0, "name": batedor["name"]})
                    st["goals"] += 1
                    fim = "gol"
                else:
                    pressure[lado] *= 0.55
                    fim = "defesa"
                return
            registrar("falta", zag, vitima, onde, False)
            fim = "falta"
            fim_info.update({"cell": onde})

        # ── a bola parada que começa esta posse ──────────────────────────────
        herdadas = 0  # ações da posse anterior repetidas como contexto do lance (não entram na jogada)
        if tipo_inicio == "escanteio":
            cobrador = max((p for p in meu if p["id"] not in fora[lado] and p.get("role") != "gk"), key=lambda p: p.get("bola_parada", 55)) if meu else portador
            # a jogada que deu o escanteio (da posse anterior) entra na cadeia
            acoes.extend(proximo.get("origem") or [])
            herdadas = len(acoes)
            canto = tuple(proximo["cell"])
            cell = (2, 1)
            cabecear(cobrador, "escanteio", canto, "bola_parada")  # type: ignore[arg-type]
            if acoes and acoes[-1]["t"] == "desvio":
                pass
            segundos = 25.0
            terco_max = 2
            posses["acoes"] += 2
        elif tipo_inicio == "falta" and cell[0] == 2:
            acoes.extend(proximo.get("origem") or [])
            herdadas = len(acoes)
            cobrador = max((p for p in meu if p["id"] not in fora[lado] and p.get("role") != "gk"), key=lambda p: max(p.get("bola_parada", 55), p.get("finalizacao", 60) - 6)) if meu else portador
            direta = cell[1] == 1 and max(_efetivo(cobrador, "bola_parada", 55), _efetivo(cobrador, "finalizacao")) >= 62 and rng.random() < 0.45
            if direta:
                chutar(cobrador, "cobranca_falta", "bola_parada")
            else:
                cabecear(cobrador, "cruzamento", cell, "bola_parada")
            segundos = 25.0
            terco_max = 2
            posses["acoes"] += 2

        # ── jogo corrido ──────────────────────────────────────────────────────
        passo = 0
        while fim is None and passo < int(CAL["max_acoes"]) and segundos < 55.0:
            passo += 1
            t, c = cell
            P = pressao_em(cell)
            fad = float(portador.get("fatigue", 0.0))
            pesos: Dict[str, float] = {}
            im = INTENSITY_MUL.get(int_a, 1.0)
            pesos["passe"] = CAL["w_passe"] + _efetivo(portador, "passe") / 100.0 + 0.40 * dz(dna_a, "posse") - 0.30 * P
            if t < 2:
                pesos["conducao"] = CAL["w_conducao"] + _efetivo(portador, "velocidade") / 120.0 + 0.20 * dz(dna_a, "vertical")
            if t >= 1 and P > 0.15:
                pesos["drible"] = CAL["w_drible"] + 1.20 * _efetivo(portador, "drible") / 100.0 - 0.20 * fad / 100.0
            if t <= 1:
                pesos["lancamento"] = CAL["w_lancamento"] + _efetivo(portador, "passe") / 120.0 + 0.40 * dz(dna_a, "vertical")
            if t == 2 and c != 1:
                melhor_cabeca = max((_efetivo(p, "cabeceio", 55) for p, _ in of_tab[(2, 1)]), default=55.0)
                pesos["cruzamento"] = (CAL["w_cruzamento"] + _efetivo(portador, "passe") / 100.0 + 0.05 * max(0.0, (melhor_cabeca - 60.0)) / 10.0) * im
            if t == 2:
                pesos["chute"] = (CAL["w_chute"] + _efetivo(portador, "finalizacao") / 100.0 + (CAL["w_chute_centro"] if c == 1 else 0.0)
                                  + 0.30 * dz(dna_a, "vertical") + urg + (CAL["mando_peso"] if casa else 0.0)) * im
                if roubou and passo == 1:
                    pesos["chute"] *= 0.5
            elif t == 1 and c == 1 and _efetivo(portador, "finalizacao") >= CAL["chute_mid_min_fin"]:
                pesos["chute"] = (0.10 + (_efetivo(portador, "finalizacao") - CAL["chute_mid_min_fin"]) / 60.0) * im
            if t > 0:
                pesos["recuo"] = CAL["w_recuo"] + 0.40 * P + 0.20 * dz(dna_a, "solidez") - 0.20 * dz(dna_a, "vertical") + (0.2 if urg < 0 else 0.0)
                if int_a == "defensive":
                    pesos["recuo"] += 0.15
            # Classe do SMART-PROFILE: o jeito de jogar vira preferência na decisão (Fase 1b).
            for k, extra in CLASSE_DECIDE.get(portador.get("classe") or "", {}).items():
                if k in pesos:
                    pesos[k] += extra
            # softmax
            chaves = list(pesos.keys())
            exps = [math.exp(max(0.0, pesos[k]) / CAL["temperatura"]) for k in chaves]
            r = rng.random() * sum(exps)
            acc = 0.0
            acao = chaves[-1]
            for k, e in zip(chaves, exps):
                acc += e
                if acc >= r:
                    acao = k
                    break

            cansa(portador, CAL["fad_agir"] * FAT_IM.get(int_a, 1.0))
            posses["acoes"] += 1
            if acao == "passe":
                segundos += 4
                passes += 1
                # célula alvo: avança (mais com DNA vertical) ou roda pro lado
                laterais = [(t, c2) for c2 in (0, 1, 2) if c2 != c]
                if t < 2 and rng.random() < 0.55 + 0.3 * dz(dna_a, "vertical"):
                    alvo = (t + 1, c)
                else:
                    alvo = laterais[int(rng.random() * len(laterais)) % len(laterais)]
                receptor = receptor_em(alvo, portador["id"])
                if receptor is None:
                    alvo = (t, c)
                    receptor = receptor_em(alvo, portador["id"])
                if receptor is None:
                    registrar("conducao", portador, None, cell)
                    continue
                marc = marcador_em(alvo)
                if _duelo(rng, CAL["base_passe"], _efetivo(portador, "passe"), linha_de_passe(alvo), mando):
                    registrar("passe", portador, receptor, alvo)
                    portador, cell = receptor, alvo
                    livre = False
                elif marc and pressao_em(alvo) > 0.6 and rng.random() < CAL["falta_no_passe"]:
                    registrar("passe", portador, receptor, alvo, False)
                    cansa(marc, CAL["fad_marcar"])
                    falta_sofrida(receptor, marc, alvo, False)
                else:
                    registrar("passe", portador, receptor, alvo, False)
                    cansa(marc, CAL["fad_marcar"])
                    fim = "perda"
                    fim_info.update({"recuperador": marc, "vitima": portador, "cell": alvo})
            elif acao == "conducao":
                segundos += 6
                alvo = (t + 1, c)
                marc = marcador_em(alvo)
                cansa(portador, CAL["fad_conduzir"] - CAL["fad_agir"])
                cansa(marc, CAL["fad_marcar"])
                d = _efetivo(marc, "velocidade") if marc else 40.0
                p_falta = p_falta_de(marc)
                if _duelo(rng, CAL["base_conducao"], _efetivo(portador, "velocidade"), d, mando):
                    registrar("conducao", portador, None, alvo)
                    cell = alvo
                    if marc and rng.random() < p_falta:
                        falta_sofrida(portador, marc, alvo, False)
                elif marc and rng.random() < p_falta * CAL["falta_duelo_perdido"]:
                    # O bote chegou atrasado: parou a jogada com falta.
                    registrar("conducao", portador, None, alvo, False)
                    falta_sofrida(portador, marc, alvo, False)
                else:
                    registrar("conducao", portador, None, alvo, False)
                    fim = "perda"
                    fim_info.update({"recuperador": marc, "vitima": portador, "cell": alvo})
            elif acao == "drible":
                segundos += 5
                marc = marcador_em(cell)
                cansa(portador, CAL["fad_conduzir"] - CAL["fad_agir"])
                cansa(marc, CAL["fad_marcar"])
                d = (_efetivo(marc, "marcacao") + _efetivo(marc, "fisico") / 4.0) if marc else 45.0
                p_falta = p_falta_de(marc)
                if _duelo(rng, CAL["base_drible"], _efetivo(portador, "drible") + _efetivo(portador, "velocidade") / 4.0, d, mando):
                    alvo = (min(2, t + 1), c)
                    registrar("drible", portador, marc, alvo if t < 2 else cell)
                    if marc and rng.random() < p_falta:
                        falta_sofrida(portador, marc, alvo if t < 2 else cell, True)
                        continue
                    if t == 2:
                        livre = True
                    else:
                        cell = alvo
                elif marc and rng.random() < p_falta * CAL["falta_duelo_perdido"]:
                    registrar("drible", portador, marc, cell, False)
                    falta_sofrida(portador, marc, cell, False)
                else:
                    registrar("drible", portador, marc, cell, False)
                    fim = "perda"
                    fim_info.update({"recuperador": marc, "vitima": portador, "cell": cell})
            elif acao == "lancamento":
                segundos += 6
                inverter = t >= 1 and rng.random() < 0.35
                alvo = (t, 2 - c) if (inverter and c != 1) else (min(2, t + 2), c if rng.random() < 0.6 else rng.choice([0, 1, 2]))
                receptor = receptor_em(alvo, portador["id"])
                if receptor is None:
                    alvo = (min(2, t + 1), c)
                    receptor = receptor_em(alvo, portador["id"])
                if receptor is None:
                    registrar("conducao", portador, None, cell)
                    continue
                marc = marcador_em(alvo)
                d = (0.4 * _efetivo(marc, "marcacao") + 0.6 * _efetivo(marc, "tatico")) if marc else 35.0
                if _duelo(rng, CAL["base_lancamento"], _efetivo(portador, "passe") + _efetivo(portador, "tatico") / 4.0 - 10.0, d, mando):
                    registrar("lancamento", portador, receptor, alvo)
                    portador, cell = receptor, alvo
                    passes += 1
                else:
                    registrar("lancamento", portador, receptor, alvo, False)
                    cansa(marc, CAL["fad_marcar"])
                    fim = "perda"
                    fim_info.update({"recuperador": marc, "vitima": portador, "cell": alvo})
            elif acao == "cruzamento":
                segundos += 5
                cabecear(portador, "cruzamento", cell, None)
                if fim is None:
                    fim = "perda"
            elif acao == "chute":
                segundos += 3
                chutar(portador, "chute")
            elif acao == "recuo":
                segundos += 4
                alvo = (t - 1, c if rng.random() < 0.5 else 1)
                receptor = receptor_em(alvo, portador["id"])
                if receptor is None:
                    registrar("conducao", portador, None, cell)
                    continue
                registrar("passe", portador, receptor, alvo)
                portador, cell = receptor, alvo
                livre = False
                passes += 1
            terco_max = max(terco_max, cell[0])
            if fim is None and cell[0] == 2:
                id_stats[lado]["chances_created"] += 0  # contado abaixo por evento
        if fim is None:
            fim = "continua"

        # ── eventos de atmosfera: escanteio sem finalização, contra-ataque, construção ──
        teve_evento = any(e["minute"] == minute and e["actor_side"] == lado and not e.get("_cartao") for e in events)
        if not teve_evento and terco_max == 2 and fim not in ("gol", "defesa"):
            contra = roubou and tipo_inicio == "roubada" and proximo["cell"][0] >= 1 and passo <= 3
            if tipo_inicio == "escanteio" and any(a["t"] == "escanteio" for a in acoes):
                base = "corner"
            elif contra and rng.random() < CAL["p_counter"]:
                base = "counter"
            elif len(acoes) >= 3 and rng.random() < CAL["p_buildup"]:
                base = "buildup"
            else:
                base = None
            if base:
                autor = portador
                if base == "corner":
                    cobranca = next(a for a in acoes if a["t"] == "escanteio")
                    autor = cobranca["para"] or cobranca["de"]
                else:
                    for a in reversed(acoes):
                        if a["t"] not in ("falta", "desvio"):
                            autor = a["de"]
                            break
                canal = "bola_parada" if base == "corner" else ("corredor_esquerdo" if cell[1] == 0 else "corredor_direito" if cell[1] == 2 else ("criacao" if passes >= 3 else "ataque_central"))
                kind = f"{base}_{lado}"
                id_stats[lado]["chances_created"] += 1
                tier = classify_event_weight(kind, minute, home_score, away_score, 0.0)
                edge = matrices[lado][canal]["edge"]
                events.append({
                    "minute": minute, "kind": kind, "actor_id": autor["id"], "actor_name": autor["name"], "actor_side": lado,
                    "xg": 0, "weight_tier": tier, "zone": "att", "channel": canal, "reason": channel_reason(canal, edge, False),
                    "text": event_text(kind, autor["name"], "att", minute, 0, tier), "_acoes": list(acoes), "_corner_sem_cobranca": base == "corner",
                })

        events.extend(cartoes_do_minuto)

        def em_campo(a: Dict[str, Any], lado_a: str) -> bool:
            """A ação ainda vale na cadeia da próxima posse? (ninguém expulso em `de`/`para`)."""
            outro_a = "away" if lado_a == "home" else "home"
            lado_de = outro_a if a["t"] in ("falta", "desvio") else lado_a
            lado_para = outro_a if a["t"] in ("drible", "desarme", "falta") else lado_a
            if a["t"] == "falta":
                lado_para = lado_a
            if a["de"]["id"] in fora[lado_de]:
                return False
            return a["para"] is None or a["para"]["id"] not in fora[lado_para]

        # ── a próxima posse ──────────────────────────────────────────────────
        if fim == "gol":
            proximo = {"lado": outro, "cell": (1, 1), "tipo": "saida", "roubou": False, "origem": [], "recuperador": None}
        elif fim == "defesa":
            proximo = {"lado": outro, "cell": (0, 1), "tipo": "tiro_meta", "roubou": False, "origem": [], "recuperador": None}
        elif fim == "fora":
            proximo = {"lado": outro, "cell": (0, 1), "tipo": "tiro_meta", "roubou": False, "origem": [], "recuperador": None}
        elif fim == "escanteio":
            # A jogada que deu o escanteio, só o que aconteceu perto da área (um passe lá
            # atrás faria o time inteiro correr pra longe da bandeirinha antes da cobrança).
            ultimas = [a for a in acoes if a["t"] in ("conducao", "cruzamento", "passe", "drible") and a["cell"][0] == 2 and em_campo(a, lado)][-2:]
            if tipo_inicio == "escanteio":
                ultimas = []  # escanteio em cima de escanteio: a bola saiu de novo, a cadeia começa no desvio
            elif not ultimas:
                quem_levou = next((a["de"] for a in reversed(acoes) if a["t"] not in ("falta", "desvio", "escanteio") and a["de"]["id"] not in fora[lado]), portador)
                ultimas = [{"t": "conducao", "de": quem_levou, "para": None, "cell": (2, cell[1] if cell[0] == 2 else 1), "ok": True, "prof": 0.80, "zr": None}]
            quem = fim_info.get("recuperador") or marcador_em(cell)
            zr_canto = fim_info.get("zr_canto")
            if zr_canto is None:
                zr_canto = 0.0 if cell[1] == 0 else 1.0 if cell[1] == 2 else (0.0 if rng.random() < 0.5 else 1.0)
            desvio = ([{"t": "desvio", "de": quem, "para": None, "cell": (2, 1), "ok": False, "prof": 1.0, "zr": zr_canto}]
                      if quem and quem["id"] not in fora[outro] else [])
            canto = (2, 0 if zr_canto < 0.5 else 2)
            proximo = {"lado": lado, "cell": canto, "tipo": "escanteio", "roubou": False, "origem": ultimas + desvio, "recuperador": None}
        elif fim == "falta":
            origem = [a for a in acoes if a["t"] in ("conducao", "drible", "falta") and em_campo(a, lado)][-2:]
            proximo = {"lado": lado, "cell": tuple(fim_info.get("cell", cell)), "tipo": "falta", "roubou": False, "origem": origem, "recuperador": None}
        elif fim == "perda":
            onde = tuple(fim_info.get("cell", cell))
            rec = fim_info.get("recuperador")
            ultima = acoes[-1] if acoes else None
            errou_bola = ultima is not None and not ultima["ok"] and ultima["t"] in ("passe", "lancamento")
            # FASE 2 — o reinício que aconteceu: o lançamento que pega o atacante adiantado
            # é IMPEDIMENTO (falta pra defesa, lá atrás); a bola errada pela lateral é LATERAL.
            if errou_bola and ultima["t"] == "lancamento" and onde[0] == 2 and rng.random() < CAL["p_impedimento"]:
                proximo = {"lado": outro, "cell": (0, 2 - onde[1]), "tipo": "impedimento", "roubou": False, "origem": [], "recuperador": None}
                fim = "impedimento"
            elif errou_bola and onde[1] != 1 and rng.random() < CAL["p_lateral"]:
                proximo = {"lado": outro, "cell": _espelho(onde), "tipo": "lateral", "roubou": False, "origem": [], "recuperador": None}
                fim = "lateral"
            else:
                proximo = {"lado": outro, "cell": _espelho(onde), "tipo": "roubada", "roubou": True, "origem": [], "recuperador": rec, "vitima": fim_info.get("vitima")}
                id_stats[outro]["recoveries"] += 1
                if _espelho(onde)[0] >= 2:
                    id_stats[outro]["high_recoveries"] += 1
        else:  # continua: a mesma bola, nos mesmos pés, no minuto seguinte
            proximo = {"lado": lado, "cell": cell, "tipo": "normal", "roubou": False, "origem": [], "recuperador": None, "com": portador}

        # LESÃO (Fase 1b): rara, só a casa (o adversário não tem banco), mais provável
        # em quem está cansado — e o lesionado SAI DO MAPA: o time joga com um a menos
        # até o replan da substituição trazer quem entra. Goleiro não se machuca aqui.
        linha = [p for p in home_lineup if p["id"] not in fora["home"] and p.get("role") != "gk"]
        cansados = [p for p in linha if p["fatigue"] > 55]
        if rng.random() < 0.012 and lado == "home" and linha:
            inj_actor = rng.choice(cansados or linha)
            fora["home"].add(inj_actor["id"])
            # A próxima posse já estava montada: o lesionado sai dela também.
            fora_id = inj_actor["id"]
            for chave in ("com", "recuperador", "vitima"):
                if (proximo.get(chave) or {}).get("id") == fora_id:
                    proximo[chave] = None
            if proximo.get("origem"):
                proximo["origem"] = [a for a in proximo["origem"]
                                     if a["de"]["id"] != fora_id and (a["para"] is None or a["para"]["id"] != fora_id)]
            tier = classify_event_weight("injury_home", minute, home_score, away_score, 0.0)
            events.append({
                "minute": minute, "kind": "injury_home", "actor_id": inj_actor["id"], "actor_side": "home", "xg": 0,
                "weight_tier": tier, "zone": "mid", "text": event_text("injury_home", inj_actor["name"], "mid", minute, 0, tier),
            })

        # Fôlego do minuto (todo mundo corre) + pressão alta cobra de quem pressiona.
        for side in ("home", "away"):
            taxa = fatigue_rate(side)
            for p in lineups[side]:
                if p["id"] in fora[side]:
                    continue
                p["fatigue"] = min(100.0, p["fatigue"] + taxa)
        if dz(dna_d, "pressao") > 0.05:
            for p in deles:
                if p.get("role") in ("mid", "attack") and p["id"] not in fora[outro]:
                    p["fatigue"] = min(100.0, p["fatigue"] + CAL["fad_pressao_alta"])

        # Fluxo do minuto: quem teve a bola, em que terço, se roubou, quem carregou.
        fluxo.append([minute, "h" if lado == "home" else "a", ("def", "mid", "att")[terco_max], 1 if roubou else 0, (acoes[0]["de"] if acoes else portador)["id"]])
        # FASE 2 — a posse inteira deste minuto, pro campo encenar o que aconteceu de verdade.
        jogadas_brutas.append({"m": minute, "lado": lado, "acoes": acoes[herdadas:], "fim": fim, "inicio": tipo_inicio,
                               "portador": portador, "cell": cell, "reinicio": proximo["tipo"]})
        if minute % 5 == 0 or minute == 90:
            folego.append([minute, {p["id"]: int(round(p["fatigue"])) for p in home_lineup + away_lineup}])

        # ── pressão e momento (mesma mecânica do motor antigo) ──────────────
        pressure["home"] *= 0.90
        pressure["away"] *= 0.90
        side_imul = INTENSITY_MUL.get(int_a, 1.0) * (1 + dz(dna_a, "intensidade") * 0.4 + dz(dna_a, "vertical") * 0.2)
        build = 8.5 if terco_max == 2 else 2.6 if terco_max == 1 else 0.0
        if build > 0:
            edge_a = home_atk_edge if casa else away_atk_edge
            glob = home_global if casa else away_global * away_suppress
            pressure[lado] = min(100.0, pressure[lado] + build * side_imul * (1 + edge_a * 0.8) * (1 + (strength_eff(lado) - 70) / 130) * glob)
        momentum_shock *= 0.90
        man_down_bias = (sent_off["away"] - sent_off["home"]) * 13.0
        if minute >= 60:
            hf = sum(p["fatigue"] for p in home_lineup) / max(1, len(home_lineup))
            af = sum(p["fatigue"] for p in away_lineup) / max(1, len(away_lineup))
            fatigue_bias = (af - hf) * 0.5 * ((minute - 60) / 30.0)
        else:
            fatigue_bias = 0.0
        target = max(8.0, min(92.0, 50.0 + (pressure["home"] - pressure["away"]) * 0.5 + base_tilt + momentum_shock + man_down_bias + fatigue_bias))
        momentum_home += (target - momentum_home) * 0.24
        momentum_home = max(5.0, min(95.0, momentum_home))
        momentum_curve.append(round(momentum_home, 1))

        if minute in beat_minutes:
            analyst_beats.append(build_beat(
                rng=rng, minute=minute, half=1 if minute <= 45 else 2, home_matrix=home_matrix, away_matrix=away_matrix,
                home_short=input_data.get("home_short", "HOM"), away_short=input_data.get("away_short", "AWA"),
                momentum_curve=momentum_curve, home_score=home_score, away_score=away_score,
            ))

    # ── cadeias (a posse de verdade), em metros ──────────────────────────────
    for ev in events:
        acs = ev.pop("_acoes", None)
        cartao = ev.pop("_cartao", False)
        corner_sem = ev.pop("_corner_sem_cobranca", False)
        ev.pop("_roubada_anexada", None)
        if sem_cadeia or acs is None:
            continue
        rng_c = _rng(f"{seed}|cadeia|{ev['minute']}|{ev['kind']}")
        lado_ev = ev["actor_side"]
        outro_ev = "away" if lado_ev == "home" else "home"
        geo = _Lado(outro_ev if cartao else lado_ev)
        base = ev["kind"].rsplit("_", 1)[0]
        finaliza = base in ("goal", "shot", "chance", "save", "woodwork", "penalty")
        # Comprimento: as últimas ações antes da finalização (gol = 3–6 ações).
        if finaliza and len(acs) > 6:
            acs = acs[-6:]
        elif len(acs) > 7:
            acs = acs[-7:]
        saida = _em_metros(acs, geo, rng_c)
        if not saida:
            continue
        if corner_sem and saida[-1]["t"] != "escanteio":
            pass
        p0 = saida[0]
        inicio = (p0["x"] - (4.0 if geo.casa else -4.0), p0["z"])
        fim_t = saida[-1]["t"] if finaliza and saida[-1]["t"] in ("chute", "cabeceio", "cobranca", "cobranca_falta") else None
        ev["cadeia"] = {"inicio": {"x": round(max(0.5, min(C - 0.5, inicio[0])), 1), "z": round(inicio[1], 1)}, "acoes": saida, "finalizacao": fim_t}
        nomear_skills(ev["cadeia"], ev, home_lineup + away_lineup)

    # FASE 2 — as jogadas de cada minuto (o campo encena as posses sem lance também).
    # Formato: {m, lado: 'h'|'a', inicio: como a posse começou, acoes: [{t,de,para,x,z,ok?}],
    # fim: como acabou, reinicio: como a próxima começa}. `ok: 0` = a ação falhou ali.
    jogadas: List[Dict[str, Any]] = []
    if not sem_cadeia:
        for j in jogadas_brutas:
            geo = _Lado(j["lado"])
            acs = j["acoes"][-8:]
            rng_j = _rng(f"{seed}|jogada|{j['m']}")
            item: Dict[str, Any] = {"m": j["m"], "lado": "h" if j["lado"] == "home" else "a", "inicio": j["inicio"],
                                    "acoes": _em_metros(acs, geo, rng_j), "fim": j["fim"], "reinicio": j["reinicio"]}
            if not acs:
                x, z = geo.ponto(PROF[j["cell"][0]], ZREL[j["cell"][1]])
                item["portador"] = {"id": j["portador"]["id"], "x": x, "z": z}
            jogadas.append(item)

    mvp = None
    if scorer_counts:
        best_id = max(scorer_counts, key=lambda k: scorer_counts[k]["goals"] * 3 + scorer_counts[k].get("assists", 0))
        g = scorer_counts[best_id]["goals"]
        a = scorer_counts[best_id].get("assists", 0)
        mvp = {"player_id": best_id, "name": scorer_counts[best_id]["name"], "rating": round(6.5 + g * 0.8 + a * 0.4, 1), "goals": g, "assists": a}

    arc = detect_narrative_arc(home_score=home_score, away_score=away_score, momentum_curve=momentum_curve, events=events)
    total_poss = posses["home"] + posses["away"]
    possession_home_pct = round(100.0 * posses["home"] / total_poss, 1) if total_poss else 50.0

    return {
        "version": "1.1",
        "motor": "posses",
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
        "possession_home_pct": possession_home_pct,
        "fluxo": fluxo,
        "jogadas": jogadas,
        "folego": folego,
        "narrative_arc": arc,
        "team_stats": {
            side: {
                "possession_pct": possession_home_pct if side == "home" else round(100.0 - possession_home_pct, 1),
                "recoveries": id_stats[side]["recoveries"],
                "high_recoveries": id_stats[side]["high_recoveries"],
                "shots": id_stats[side]["shots"],
                "xg": round(id_stats[side]["xg"], 2),
                "fouls": id_stats[side]["fouls"],
                "cards": cards[side],
                "chances_created": id_stats[side]["chances_created"],
            }
            for side in ("home", "away")
        },
        "posses": {"home": posses["home"], "away": posses["away"], "acoes": posses["acoes"]},
        "dna_applied": {"home": home_dna_base, "away": away_dna},
        "comandos_aplicados": len(comandos),
        "generated_at_ms": int(time.time() * 1000),
        "duration_ms": int((time.time() - started) * 1000),
    }
