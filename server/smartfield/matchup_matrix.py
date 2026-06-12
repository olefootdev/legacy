"""
matchup_matrix.py — Cruzamento setorial de forças entre duas lineups.

Núcleo da Fase A do Quick Match 2.0 (docs/QUICK-ENGAGEMENT-REDESIGN.md):
antes de qualquer gol, o motor computa 7 canais de confronto entre os 22
jogadores. Gol não nasce de canal dominado pelo adversário: quanto mais
negativo o edge, mais raro — canais muito perdidos exigem momento de brilho
individual (gateado por confiança alta no simulador).

Canais (perspectiva do time ATACANTE):
  ataque_central     — atacantes centrais × zaga central + volante
  corredor_esquerdo  — lado esquerdo ofensivo × lado direito defensivo deles
  corredor_direito   — lado direito ofensivo × lado esquerdo defensivo deles
  criacao            — meio criativo × meio defensivo
  bola_parada        — cobrador + físico ofensivo × físico defensivo
  finalizacao_vs_gk  — top finalizadores × goleiro (multiplicador, não canal de origem)
  pressao            — pressão pós-perda × resistência à pressão

edge ∈ [-1, +1]: positivo = vantagem do atacante naquele canal.
Sem numpy — stdlib basta (mesma filosofia do match_simulator).
"""

from typing import Any, Dict, List

# Canais de onde um chute/gol pode nascer (origem da jogada)
ATTACK_CHANNELS = [
    "ataque_central",
    "corredor_esquerdo",
    "corredor_direito",
    "criacao",
    "bola_parada",
]

ALL_CHANNELS = ATTACK_CHANNELS + ["finalizacao_vs_gk", "pressao"]

CHANNEL_LABELS = {
    "ataque_central": "ataque central",
    "corredor_esquerdo": "corredor esquerdo",
    "corredor_direito": "corredor direito",
    "criacao": "criação de jogo",
    "bola_parada": "bola parada",
    "finalizacao_vs_gk": "finalização",
    "pressao": "pressão alta",
}

EDGE_SCALE = 25.0  # divisor da diferença att-def → edge normalizado


def _eff(p: Dict[str, Any], attr: str) -> float:
    """Atributo efetivo: fadiga corta rendimento (10% fadiga = -1 ponto)."""
    return float(p.get(attr, 55)) - float(p.get("fatigue", 0)) * 0.1


def _side(p: Dict[str, Any]) -> str:
    """Lado do campo pelo rótulo de posição (LE/PE = esquerda, LD/PD = direita)."""
    pos = str(p.get("pos", "")).upper()
    if pos in ("LE", "PE"):
        return "left"
    if pos in ("LD", "PD"):
        return "right"
    # fallback genérico pra rótulos de 2 letras fora do catálogo
    if len(pos) == 2 and pos.endswith("E"):
        return "left"
    if len(pos) == 2 and pos.endswith("D"):
        return "right"
    return "center"


def _avg(values: List[float], fallback: float = 55.0) -> float:
    return sum(values) / len(values) if values else fallback


def _top(values: List[float], n: int, fallback: float = 55.0) -> float:
    vals = sorted(values, reverse=True)[:n]
    return _avg(vals, fallback)


def _by_role(lineup: List[Dict[str, Any]], *roles: str) -> List[Dict[str, Any]]:
    return [p for p in lineup if p.get("role") in roles]


def attack_strengths(lineup: List[Dict[str, Any]]) -> Dict[str, float]:
    """Força ofensiva por canal (perspectiva de quem ataca)."""
    atts = _by_role(lineup, "attack")
    mids = _by_role(lineup, "mid")
    field = [p for p in lineup if p.get("role") != "gk"]

    central_atts = [p for p in atts if _side(p) == "center"] or atts
    ataque_central = _avg([
        _eff(p, "finalizacao") * 0.5 + _eff(p, "passe") * 0.2 + _eff(p, "confianca") * 0.3
        for p in central_atts
    ])

    def flank_attack(side: str) -> float:
        flankers = [p for p in atts + mids if _side(p) == side]
        if flankers:
            return _avg([
                _eff(p, "velocidade") * 0.5 + _eff(p, "passe") * 0.3 + _eff(p, "finalizacao") * 0.2
                for p in flankers
            ])
        # Sem especialista no corredor: usa o coletivo ofensivo com penalidade
        return _avg([
            _eff(p, "velocidade") * 0.5 + _eff(p, "passe") * 0.3 + _eff(p, "finalizacao") * 0.2
            for p in atts + mids
        ]) - 4.0

    criadores = mids or field
    criacao = _top([
        _eff(p, "passe") * 0.6 + _eff(p, "confianca") * 0.2 + _eff(p, "velocidade") * 0.2
        for p in criadores
    ], 3)

    cobrador = _top([_eff(p, "passe") for p in field], 1)
    torre = _top([_eff(p, "fisico") for p in field], 3)
    bola_parada = cobrador * 0.4 + torre * 0.6

    finalizacao_vs_gk = _top([_eff(p, "finalizacao") for p in atts + mids], 3)

    pressao = _avg([
        _eff(p, "velocidade") * 0.45 + _eff(p, "fisico") * 0.3 + _eff(p, "marcacao") * 0.25
        for p in atts + mids
    ])

    return {
        "ataque_central": ataque_central,
        "corredor_esquerdo": flank_attack("left"),
        "corredor_direito": flank_attack("right"),
        "criacao": criacao,
        "bola_parada": bola_parada,
        "finalizacao_vs_gk": finalizacao_vs_gk,
        "pressao": pressao,
    }


def defense_strengths(lineup: List[Dict[str, Any]]) -> Dict[str, float]:
    """Força defensiva por canal — chaves na perspectiva do ATACANTE adversário.

    Ex.: "corredor_esquerdo" aqui = quem defende o lado DIREITO deste time,
    porque o corredor esquerdo do atacante cai em cima do lateral-direito.
    """
    defs = _by_role(lineup, "def")
    mids = _by_role(lineup, "mid")
    gks = _by_role(lineup, "gk")

    central_defs = [p for p in defs if _side(p) == "center"] or defs
    vols = [p for p in mids if str(p.get("pos", "")).upper() == "VOL"]
    ataque_central = _avg([
        _eff(p, "marcacao") * 0.6 + _eff(p, "fisico") * 0.4
        for p in central_defs + vols
    ])

    def flank_defense(own_side: str) -> float:
        flankers = [p for p in defs + mids if _side(p) == own_side]
        if flankers:
            return _avg([
                _eff(p, "marcacao") * 0.55 + _eff(p, "velocidade") * 0.45
                for p in flankers
            ])
        # Corredor sem dono = exposto
        return _avg([
            _eff(p, "marcacao") * 0.55 + _eff(p, "velocidade") * 0.45
            for p in defs
        ]) - 3.0

    criacao = _top([
        _eff(p, "marcacao") * 0.55 + _eff(p, "fisico") * 0.2 + _eff(p, "velocidade") * 0.25
        for p in mids + defs
    ], 4)

    bola_parada = _avg([
        _eff(p, "fisico") * 0.7 + _eff(p, "marcacao") * 0.3
        for p in defs
    ])

    finalizacao_vs_gk = _avg([
        _eff(p, "marcacao") * 0.6 + _eff(p, "confianca") * 0.4
        for p in gks
    ])

    pressao = _avg([
        _eff(p, "passe") * 0.6 + _eff(p, "confianca") * 0.4
        for p in defs + mids
    ])

    return {
        "ataque_central": ataque_central,
        # corredor esquerdo do atacante × lado direito defensivo daqui
        "corredor_esquerdo": flank_defense("right"),
        "corredor_direito": flank_defense("left"),
        "criacao": criacao,
        "bola_parada": bola_parada,
        "finalizacao_vs_gk": finalizacao_vs_gk,
        "pressao": pressao,
    }


def compute_matchup_matrix(
    att_lineup: List[Dict[str, Any]],
    def_lineup: List[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    """Matrix completa: por canal, força de ataque, defesa, edge e label."""
    atk = attack_strengths(att_lineup)
    dfn = defense_strengths(def_lineup)
    matrix: Dict[str, Dict[str, Any]] = {}
    for ch in ALL_CHANNELS:
        a = atk[ch]
        d = dfn[ch]
        edge = max(-1.0, min(1.0, (a - d) / EDGE_SCALE))
        matrix[ch] = {
            "att": round(a, 1),
            "def": round(d, 1),
            "edge": round(edge, 3),
            "label": CHANNEL_LABELS[ch],
        }
    return matrix


def channel_reason(channel: str, edge: float, brilliance: bool) -> str:
    """Justificativa humana-pronta de por que a jogada nasceu nesse canal."""
    label = CHANNEL_LABELS.get(channel, channel)
    if brilliance:
        return f"momento de brilho individual — {label} estava fechado"
    if edge > 0.25:
        return f"{label} dominado — superioridade clara no confronto"
    if edge > 0:
        return f"vantagem no {label}"
    if edge > -0.15:
        return f"{label} disputado no detalhe"
    return f"{label} sob controle adversário"
