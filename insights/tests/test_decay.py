"""Testa a função de decay — deve bater 1:1 com o TS."""
from datetime import datetime, timedelta, timezone

from app.decay import evaluate
from app.models import Consequence


def make_consequence(decay_curve="linear", magnitude=10.0, duration_hours=10) -> Consequence:
    starts = datetime(2026, 5, 27, 12, 0, tzinfo=timezone.utc)
    return Consequence(
        id="00000000-0000-0000-0000-000000000001",
        manager_id="m1",
        club_id="c1",
        kind="test",
        dimension="psychological",
        scope="club",
        magnitude=magnitude,
        decay_curve=decay_curve,
        starts_at=starts,
        expires_at=starts + timedelta(hours=duration_hours),
    )


def test_step_decay_stays_constant():
    c = make_consequence("step", magnitude=10.0, duration_hours=4)
    e = evaluate(c, c.starts_at + timedelta(hours=2))
    assert e.current_value == 10.0
    assert 0.4 < e.life_remaining < 0.6


def test_step_decay_expires():
    c = make_consequence("step", magnitude=10.0, duration_hours=2)
    e = evaluate(c, c.expires_at + timedelta(seconds=1))
    assert e.current_value == 0
    assert e.ms_until_expiry == 0


def test_linear_decay_halfway():
    c = make_consequence("linear", magnitude=10.0, duration_hours=10)
    e = evaluate(c, c.starts_at + timedelta(hours=5))
    assert 4.5 < e.current_value < 5.5
    assert 0.45 < e.life_remaining < 0.55


def test_exponential_decay_halflife():
    c = make_consequence("exponential", magnitude=10.0, duration_hours=10)
    # No half-life (5h) deve estar em ~50% da magnitude
    e = evaluate(c, c.starts_at + timedelta(hours=5))
    assert 4.5 < e.current_value < 5.5


def test_zero_after_expiry():
    c = make_consequence("linear", magnitude=10.0, duration_hours=2)
    e = evaluate(c, c.expires_at + timedelta(hours=1))
    assert e.current_value == 0
    assert e.life_remaining == 0


def test_negative_magnitude():
    c = make_consequence("step", magnitude=-5.0, duration_hours=4)
    e = evaluate(c, c.starts_at + timedelta(hours=1))
    assert e.current_value == -5.0
