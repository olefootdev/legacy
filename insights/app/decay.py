"""
Avaliação de consequências com decay — espelha
src/systems/consequences/store.ts::evaluateConsequence.

Mantemos a lógica em sync com o TS pra que o backend não divirja do cliente.
"""
import math
from datetime import datetime, timezone

from .models import Consequence, EvaluatedConsequence


def evaluate(c: Consequence, now: datetime | None = None) -> EvaluatedConsequence:
    """Calcula valor efetivo no instante `now` (default: agora UTC)."""
    if now is None:
        now = datetime.now(timezone.utc)

    total_ms = (c.expires_at - c.starts_at).total_seconds() * 1000
    elapsed_ms = max(0.0, (now - c.starts_at).total_seconds() * 1000)
    life_remaining = max(0.0, min(1.0, 1.0 - (elapsed_ms / total_ms) if total_ms > 0 else 0))
    ms_until_expiry = max(0, int((c.expires_at - now).total_seconds() * 1000))

    current_value = 0.0
    if ms_until_expiry > 0:
        if c.decay_curve == "step":
            current_value = c.magnitude
        elif c.decay_curve == "linear":
            current_value = c.magnitude * life_remaining
        elif c.decay_curve == "exponential":
            half_life = total_ms / 2 if total_ms > 0 else 1
            factor = math.pow(0.5, elapsed_ms / half_life)
            current_value = c.magnitude * factor

    return EvaluatedConsequence(
        consequence=c,
        current_value=current_value,
        life_remaining=life_remaining,
        ms_until_expiry=ms_until_expiry,
    )
