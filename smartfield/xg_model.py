"""
xg_model.py — Modelo de xG (expected goals) e resolução de chute.

Decisão deliberada: NÃO usar numpy/sklearn. Lookup table simples baseada em:
  zona × atributo do batedor × pressão do oponente × intensidade tática

O xG retornado fica entre 0.03 e 0.55 — coerente com partidas profissionais
(chute médio = ~0.10 xG; pênalti = ~0.76 mas não usamos aqui).

Saída de `shot_outcome_weights` é um dict com pesos relativos pros 5 outcomes.
"""

from typing import Dict

ZONE_BASE_XG = {
    "att": 0.18,   # dentro do terço atacante (não distingue subzona)
    "mid": 0.05,   # chute de fora
    "def": 0.01,   # quase nunca
}


def xg_from_context(
    shooter_finishing: int,
    shooter_confidence: int,
    team_strength: float,
    opponent_strength: float,
    zone: str,
    intensity: str,
) -> float:
    base = ZONE_BASE_XG.get(zone, 0.05)

    # Skill do batedor — finalização pesa muito mais que confiança
    skill_factor = (shooter_finishing / 100) * 1.2 + (shooter_confidence / 100) * 0.3

    # Diferença de força do time × oponente afeta espaço pro chute
    strength_factor = 1.0 + (team_strength - opponent_strength) / 120

    # Intensidade tática
    intensity_factor = {"defensive": 0.78, "balanced": 1.0, "offensive": 1.22}.get(intensity, 1.0)

    raw = base * skill_factor * strength_factor * intensity_factor
    # Clamp em range realista
    return max(0.03, min(0.55, raw))


def shot_outcome_weights(xg: float) -> Dict[str, float]:
    """
    Distribui xG em 5 outcomes:
      goal   — converteu
      save   — goleiro defendeu
      block  — bloqueio na frente
      wide   — saiu fora
      miss_far — chute longe demais
    Total = 1.0
    """
    goal = xg
    # Defesas crescem quando xG é alto (chute mais ameaçador = mais defesas brilhantes)
    save = max(0.05, 0.25 - xg * 0.3)
    block = max(0.05, 0.18 - xg * 0.15)
    wide = max(0.08, 0.30 - xg * 0.4)
    # Remainder vai pra miss_far
    rest = 1.0 - (goal + save + block + wide)
    miss_far = max(0.02, rest)

    total = goal + save + block + wide + miss_far
    return {
        "goal": goal / total,
        "save": save / total,
        "block": block / total,
        "wide": wide / total,
        "miss_far": miss_far / total,
    }
