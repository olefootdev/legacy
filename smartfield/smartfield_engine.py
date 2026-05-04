"""
SMARTFIELD Engine — Geometric and tactical brain for OLEFOOT.

Builds the canonical field model, zones, subzones, goal definitions and
tactical anchors.  Exports snapshots as JSON consumable by the TypeScript
match engine (TacticalSimLoop / fieldZones).

Uses mplsoccer only for debug visualization — never as a runtime dependency
of the match loop.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Optional

from smartfield_schema import (
    PITCH_LENGTH,
    PITCH_WIDTH,
    GOAL_HALF_WIDTH,
    GOAL_WIDTH,
    PENALTY_AREA_DEPTH,
    PENALTY_AREA_HALF_WIDTH,
    GOAL_AREA_DEPTH,
    GOAL_AREA_HALF_WIDTH,
    PENALTY_SPOT_DEPTH,
    CENTER_CIRCLE_RADIUS,
    BallSpatialState,
    GoalZoneDefinition,
    MatchHalf,
    PlayerSpatialState,
    Point,
    Rect,
    RoleId,
    SmartfieldSnapshot,
    SubZoneId,
    TacticalAnchor,
    TacticalLane,
    TacticalThird,
    TeamPhase,
    TeamShapeState,
    TeamSide,
    ZoneDefinition,
)


# ═══════════════════════════════════════════════════════════════════════
#  A. FIELD MODEL
# ═══════════════════════════════════════════════════════════════════════

_HALF_W = PITCH_WIDTH / 2
_THIRD = PITCH_LENGTH / 3
_LANE_W = PITCH_WIDTH / 5

# Goal definitions per end.  "West" = x=0, "East" = x=105.
def _build_goal(goal_line_x: float) -> GoalZoneDefinition:
    """Build full goal geometry for one end."""
    is_west = goal_line_x < PITCH_LENGTH / 2
    sign = 1 if is_west else -1  # inward direction
    gz = _HALF_W

    near_post = Point(goal_line_x, gz - GOAL_HALF_WIDTH)
    far_post = Point(goal_line_x, gz + GOAL_HALF_WIDTH)
    center = Point(goal_line_x, gz)

    mouth_rect = Rect(
        x_min=goal_line_x,
        z_min=gz - GOAL_HALF_WIDTH,
        x_max=goal_line_x + sign * 0.5,
        z_max=gz + GOAL_HALF_WIDTH,
    )
    # Normalize x_min < x_max
    mouth_rect = _normalize_rect(mouth_rect)

    six_yard = Rect(
        x_min=goal_line_x,
        z_min=gz - GOAL_AREA_HALF_WIDTH,
        x_max=goal_line_x + sign * GOAL_AREA_DEPTH,
        z_max=gz + GOAL_AREA_HALF_WIDTH,
    )
    six_yard = _normalize_rect(six_yard)

    penalty = Rect(
        x_min=goal_line_x,
        z_min=gz - PENALTY_AREA_HALF_WIDTH,
        x_max=goal_line_x + sign * PENALTY_AREA_DEPTH,
        z_max=gz + PENALTY_AREA_HALF_WIDTH,
    )
    penalty = _normalize_rect(penalty)

    spot = Point(goal_line_x + sign * PENALTY_SPOT_DEPTH, gz)

    # Sub-regions of the goal mouth for finishing context
    third_w = GOAL_WIDTH / 3
    near_post_zone = Rect(
        goal_line_x - 0.1 if is_west else goal_line_x - 0.5,
        gz - GOAL_HALF_WIDTH,
        goal_line_x + 0.5 if is_west else goal_line_x + 0.1,
        gz - GOAL_HALF_WIDTH + third_w,
    )
    far_post_zone = Rect(
        goal_line_x - 0.1 if is_west else goal_line_x - 0.5,
        gz + GOAL_HALF_WIDTH - third_w,
        goal_line_x + 0.5 if is_west else goal_line_x + 0.1,
        gz + GOAL_HALF_WIDTH,
    )
    central_channel = Rect(
        goal_line_x - 0.1 if is_west else goal_line_x - 0.5,
        gz - third_w / 2,
        goal_line_x + 0.5 if is_west else goal_line_x + 0.1,
        gz + third_w / 2,
    )

    return GoalZoneDefinition(
        goal_line_x=goal_line_x,
        near_post=near_post,
        far_post=far_post,
        center=center,
        mouth_rect=_normalize_rect(mouth_rect),
        six_yard_box=six_yard,
        penalty_box=penalty,
        penalty_spot=spot,
        near_post_zone=_normalize_rect(near_post_zone),
        far_post_zone=_normalize_rect(far_post_zone),
        central_channel=_normalize_rect(central_channel),
    )


def _normalize_rect(r: Rect) -> Rect:
    return Rect(min(r.x_min, r.x_max), min(r.z_min, r.z_max),
                max(r.x_min, r.x_max), max(r.z_min, r.z_max))


WEST_GOAL = _build_goal(0.0)
EAST_GOAL = _build_goal(PITCH_LENGTH)


# ═══════════════════════════════════════════════════════════════════════
#  B. ZONES — Tactical thirds × lanes → 15 macro zones
# ═══════════════════════════════════════════════════════════════════════

def _lane_bounds(lane: TacticalLane) -> tuple[float, float]:
    idx = list(TacticalLane).index(lane)
    return idx * _LANE_W, (idx + 1) * _LANE_W


def _third_bounds(third: TacticalThird) -> tuple[float, float]:
    idx = list(TacticalThird).index(third)
    return idx * _THIRD, (idx + 1) * _THIRD


def build_macro_zones() -> list[ZoneDefinition]:
    zones: list[ZoneDefinition] = []
    for third in TacticalThird:
        x0, x1 = _third_bounds(third)
        for lane in TacticalLane:
            z0, z1 = _lane_bounds(lane)
            zones.append(ZoneDefinition(
                id=f"{third.value}_{lane.value}",
                rect=Rect(x0, z0, x1, z1),
                third=third,
                lane=lane,
            ))
    return zones


MACRO_ZONES = build_macro_zones()


# ═══════════════════════════════════════════════════════════════════════
#  B′. SUBZONES — Finer game-oriented regions
# ═══════════════════════════════════════════════════════════════════════

def _build_subzones() -> list[ZoneDefinition]:
    """
    Build subzones oriented to gameplay phases.
    Thirds used: own 0–35, build-up 0–35, press 35–70, creation 70–88.5,
    box = penalty area, six-yard = goal area, goalmouth = mouth,
    recovery = own defensive third.
    All referenced from the HOME team attacking east (x=105).
    To get away subzones, mirror X.
    """
    subs: list[ZoneDefinition] = []
    W = PITCH_WIDTH
    L = PITCH_LENGTH
    third_w = W / 3

    def _add(sid: SubZoneId, rect: Rect, third: TacticalThird, lane: TacticalLane):
        subs.append(ZoneDefinition(id=sid.value, rect=rect, third=third, lane=lane))

    # Recovery (own defensive third)
    _add(SubZoneId.RECOVERY_LEFT,   Rect(0, 0, _THIRD, third_w),            TacticalThird.DEFENSIVE, TacticalLane.LEFT_WING)
    _add(SubZoneId.RECOVERY_CENTER, Rect(0, third_w, _THIRD, 2*third_w),    TacticalThird.DEFENSIVE, TacticalLane.CENTER)
    _add(SubZoneId.RECOVERY_RIGHT,  Rect(0, 2*third_w, _THIRD, W),          TacticalThird.DEFENSIVE, TacticalLane.RIGHT_WING)

    # Build-up (own half, behind midline)
    _add(SubZoneId.BUILD_UP_LEFT,   Rect(0, 0, L/2, third_w),               TacticalThird.DEFENSIVE, TacticalLane.LEFT_WING)
    _add(SubZoneId.BUILD_UP_CENTER, Rect(0, third_w, L/2, 2*third_w),       TacticalThird.DEFENSIVE, TacticalLane.CENTER)
    _add(SubZoneId.BUILD_UP_RIGHT,  Rect(0, 2*third_w, L/2, W),             TacticalThird.DEFENSIVE, TacticalLane.RIGHT_WING)

    # Press (middle third)
    _add(SubZoneId.PRESS_LEFT,      Rect(_THIRD, 0, 2*_THIRD, third_w),     TacticalThird.MIDDLE, TacticalLane.LEFT_WING)
    _add(SubZoneId.PRESS_CENTER,    Rect(_THIRD, third_w, 2*_THIRD, 2*third_w), TacticalThird.MIDDLE, TacticalLane.CENTER)
    _add(SubZoneId.PRESS_RIGHT,     Rect(_THIRD, 2*third_w, 2*_THIRD, W),   TacticalThird.MIDDLE, TacticalLane.RIGHT_WING)

    # Creation (attacking third, outside the box)
    att_start = 2 * _THIRD
    box_start = L - PENALTY_AREA_DEPTH
    _add(SubZoneId.CREATION_LEFT,   Rect(att_start, 0, box_start, third_w),          TacticalThird.ATTACKING, TacticalLane.LEFT_WING)
    _add(SubZoneId.CREATION_CENTER, Rect(att_start, third_w, box_start, 2*third_w),  TacticalThird.ATTACKING, TacticalLane.CENTER)
    _add(SubZoneId.CREATION_RIGHT,  Rect(att_start, 2*third_w, box_start, W),        TacticalThird.ATTACKING, TacticalLane.RIGHT_WING)

    # Box (penalty area split into thirds)
    pa = EAST_GOAL.penalty_box
    box_third = (pa.z_max - pa.z_min) / 3
    _add(SubZoneId.BOX_LEFT,   Rect(pa.x_min, pa.z_min, pa.x_max, pa.z_min + box_third),          TacticalThird.ATTACKING, TacticalLane.LEFT_HALFSPACE)
    _add(SubZoneId.BOX_CENTER, Rect(pa.x_min, pa.z_min + box_third, pa.x_max, pa.z_min + 2*box_third), TacticalThird.ATTACKING, TacticalLane.CENTER)
    _add(SubZoneId.BOX_RIGHT,  Rect(pa.x_min, pa.z_min + 2*box_third, pa.x_max, pa.z_max),        TacticalThird.ATTACKING, TacticalLane.RIGHT_HALFSPACE)

    # Six-yard
    sy = EAST_GOAL.six_yard_box
    sy_third = (sy.z_max - sy.z_min) / 3
    _add(SubZoneId.SIX_YARD_LEFT,   Rect(sy.x_min, sy.z_min, sy.x_max, sy.z_min + sy_third),          TacticalThird.ATTACKING, TacticalLane.LEFT_HALFSPACE)
    _add(SubZoneId.SIX_YARD_CENTER, Rect(sy.x_min, sy.z_min + sy_third, sy.x_max, sy.z_min + 2*sy_third), TacticalThird.ATTACKING, TacticalLane.CENTER)
    _add(SubZoneId.SIX_YARD_RIGHT,  Rect(sy.x_min, sy.z_min + 2*sy_third, sy.x_max, sy.z_max),        TacticalThird.ATTACKING, TacticalLane.RIGHT_HALFSPACE)

    # Goalmouth
    gm = EAST_GOAL.mouth_rect
    gm_third = (gm.z_max - gm.z_min) / 3
    _add(SubZoneId.GOALMOUTH_LEFT,   Rect(gm.x_min, gm.z_min, gm.x_max, gm.z_min + gm_third),           TacticalThird.ATTACKING, TacticalLane.LEFT_HALFSPACE)
    _add(SubZoneId.GOALMOUTH_CENTER, Rect(gm.x_min, gm.z_min + gm_third, gm.x_max, gm.z_min + 2*gm_third), TacticalThird.ATTACKING, TacticalLane.CENTER)
    _add(SubZoneId.GOALMOUTH_RIGHT,  Rect(gm.x_min, gm.z_min + 2*gm_third, gm.x_max, gm.z_max),         TacticalThird.ATTACKING, TacticalLane.RIGHT_HALFSPACE)

    return subs


SUBZONES = _build_subzones()


# ═══════════════════════════════════════════════════════════════════════
#  C. TACTICAL ANCHORS (default 4-3-3 attacking east)
# ═══════════════════════════════════════════════════════════════════════

_DEFAULT_ANCHORS_433: dict[RoleId, TacticalAnchor] = {
    RoleId.GK: TacticalAnchor(
        role=RoleId.GK,
        base_anchor=Point(5, 34),
        allowed_radius=6,
        defensive_zones=[SubZoneId.RECOVERY_CENTER],
        forbidden_zones=[SubZoneId.PRESS_LEFT, SubZoneId.PRESS_CENTER, SubZoneId.PRESS_RIGHT,
                         SubZoneId.CREATION_LEFT, SubZoneId.CREATION_CENTER, SubZoneId.CREATION_RIGHT],
        recovery_priority=1.0,
    ),
    RoleId.RB: TacticalAnchor(
        role=RoleId.RB,
        base_anchor=Point(18, 58),
        allowed_radius=14,
        support_zones=[SubZoneId.BUILD_UP_RIGHT],
        defensive_zones=[SubZoneId.RECOVERY_RIGHT],
        attack_zones=[SubZoneId.CREATION_RIGHT],
        recovery_priority=0.85,
    ),
    RoleId.RCB: TacticalAnchor(
        role=RoleId.RCB,
        base_anchor=Point(16, 42),
        allowed_radius=10,
        defensive_zones=[SubZoneId.RECOVERY_CENTER, SubZoneId.RECOVERY_RIGHT],
        recovery_priority=0.95,
    ),
    RoleId.LCB: TacticalAnchor(
        role=RoleId.LCB,
        base_anchor=Point(16, 26),
        allowed_radius=10,
        defensive_zones=[SubZoneId.RECOVERY_CENTER, SubZoneId.RECOVERY_LEFT],
        recovery_priority=0.95,
    ),
    RoleId.LB: TacticalAnchor(
        role=RoleId.LB,
        base_anchor=Point(18, 10),
        allowed_radius=14,
        support_zones=[SubZoneId.BUILD_UP_LEFT],
        defensive_zones=[SubZoneId.RECOVERY_LEFT],
        attack_zones=[SubZoneId.CREATION_LEFT],
        recovery_priority=0.85,
    ),
    RoleId.DM: TacticalAnchor(
        role=RoleId.DM,
        base_anchor=Point(30, 34),
        allowed_radius=14,
        support_zones=[SubZoneId.BUILD_UP_CENTER],
        defensive_zones=[SubZoneId.RECOVERY_CENTER],
        pressure_zones=[SubZoneId.PRESS_CENTER],
        recovery_priority=0.8,
    ),
    RoleId.CM: TacticalAnchor(
        role=RoleId.CM,
        base_anchor=Point(42, 34),
        allowed_radius=16,
        support_zones=[SubZoneId.BUILD_UP_CENTER, SubZoneId.PRESS_CENTER],
        attack_zones=[SubZoneId.CREATION_CENTER],
        pressure_zones=[SubZoneId.PRESS_CENTER, SubZoneId.PRESS_LEFT, SubZoneId.PRESS_RIGHT],
        recovery_priority=0.6,
    ),
    RoleId.AM: TacticalAnchor(
        role=RoleId.AM,
        base_anchor=Point(56, 34),
        allowed_radius=18,
        attack_zones=[SubZoneId.CREATION_CENTER, SubZoneId.BOX_CENTER],
        pressure_zones=[SubZoneId.PRESS_CENTER],
        recovery_priority=0.45,
    ),
    RoleId.RW: TacticalAnchor(
        role=RoleId.RW,
        base_anchor=Point(62, 58),
        allowed_radius=18,
        attack_zones=[SubZoneId.CREATION_RIGHT, SubZoneId.BOX_RIGHT],
        transition_zones=[SubZoneId.PRESS_RIGHT],
        recovery_priority=0.35,
    ),
    RoleId.LW: TacticalAnchor(
        role=RoleId.LW,
        base_anchor=Point(62, 10),
        allowed_radius=18,
        attack_zones=[SubZoneId.CREATION_LEFT, SubZoneId.BOX_LEFT],
        transition_zones=[SubZoneId.PRESS_LEFT],
        recovery_priority=0.35,
    ),
    RoleId.ST: TacticalAnchor(
        role=RoleId.ST,
        base_anchor=Point(72, 34),
        allowed_radius=20,
        attack_zones=[SubZoneId.BOX_CENTER, SubZoneId.SIX_YARD_CENTER],
        transition_zones=[SubZoneId.CREATION_CENTER],
        recovery_priority=0.25,
    ),
}


_DEFAULT_ANCHORS_442: dict[RoleId, TacticalAnchor] = {
    RoleId.GK: TacticalAnchor(
        role=RoleId.GK, base_anchor=Point(5, 34), allowed_radius=6,
        defensive_zones=[SubZoneId.RECOVERY_CENTER], recovery_priority=1.0,
    ),
    RoleId.RB: TacticalAnchor(
        role=RoleId.RB, base_anchor=Point(18, 58), allowed_radius=13,
        support_zones=[SubZoneId.BUILD_UP_RIGHT], defensive_zones=[SubZoneId.RECOVERY_RIGHT],
        recovery_priority=0.85,
    ),
    RoleId.RCB: TacticalAnchor(
        role=RoleId.RCB, base_anchor=Point(16, 42), allowed_radius=10,
        defensive_zones=[SubZoneId.RECOVERY_CENTER, SubZoneId.RECOVERY_RIGHT], recovery_priority=0.95,
    ),
    RoleId.LCB: TacticalAnchor(
        role=RoleId.LCB, base_anchor=Point(16, 26), allowed_radius=10,
        defensive_zones=[SubZoneId.RECOVERY_CENTER, SubZoneId.RECOVERY_LEFT], recovery_priority=0.95,
    ),
    RoleId.LB: TacticalAnchor(
        role=RoleId.LB, base_anchor=Point(18, 10), allowed_radius=13,
        support_zones=[SubZoneId.BUILD_UP_LEFT], defensive_zones=[SubZoneId.RECOVERY_LEFT],
        recovery_priority=0.85,
    ),
    RoleId.CM: TacticalAnchor(
        role=RoleId.CM, base_anchor=Point(34, 42), allowed_radius=15,
        support_zones=[SubZoneId.BUILD_UP_CENTER, SubZoneId.BUILD_UP_RIGHT],
        pressure_zones=[SubZoneId.PRESS_CENTER, SubZoneId.PRESS_RIGHT], recovery_priority=0.7,
    ),
    RoleId.DM: TacticalAnchor(
        role=RoleId.DM, base_anchor=Point(34, 26), allowed_radius=15,
        support_zones=[SubZoneId.BUILD_UP_CENTER, SubZoneId.BUILD_UP_LEFT],
        pressure_zones=[SubZoneId.PRESS_CENTER, SubZoneId.PRESS_LEFT], recovery_priority=0.7,
    ),
    RoleId.RW: TacticalAnchor(
        role=RoleId.RW, base_anchor=Point(55, 58), allowed_radius=17,
        attack_zones=[SubZoneId.CREATION_RIGHT, SubZoneId.BOX_RIGHT],
        transition_zones=[SubZoneId.PRESS_RIGHT], recovery_priority=0.4,
    ),
    RoleId.LW: TacticalAnchor(
        role=RoleId.LW, base_anchor=Point(55, 10), allowed_radius=17,
        attack_zones=[SubZoneId.CREATION_LEFT, SubZoneId.BOX_LEFT],
        transition_zones=[SubZoneId.PRESS_LEFT], recovery_priority=0.4,
    ),
    RoleId.ST: TacticalAnchor(
        role=RoleId.ST, base_anchor=Point(68, 40), allowed_radius=18,
        attack_zones=[SubZoneId.BOX_CENTER, SubZoneId.BOX_RIGHT, SubZoneId.SIX_YARD_CENTER],
        recovery_priority=0.25,
    ),
    RoleId.AM: TacticalAnchor(
        role=RoleId.AM, base_anchor=Point(68, 28), allowed_radius=18,
        attack_zones=[SubZoneId.BOX_CENTER, SubZoneId.BOX_LEFT, SubZoneId.SIX_YARD_CENTER],
        recovery_priority=0.25,
    ),
}

_DEFAULT_ANCHORS_352: dict[RoleId, TacticalAnchor] = {
    RoleId.GK: TacticalAnchor(
        role=RoleId.GK, base_anchor=Point(5, 34), allowed_radius=6,
        defensive_zones=[SubZoneId.RECOVERY_CENTER], recovery_priority=1.0,
    ),
    RoleId.RCB: TacticalAnchor(
        role=RoleId.RCB, base_anchor=Point(16, 48), allowed_radius=10,
        defensive_zones=[SubZoneId.RECOVERY_RIGHT, SubZoneId.RECOVERY_CENTER], recovery_priority=0.95,
    ),
    RoleId.LCB: TacticalAnchor(
        role=RoleId.LCB, base_anchor=Point(14, 34), allowed_radius=10,
        defensive_zones=[SubZoneId.RECOVERY_CENTER], recovery_priority=0.95,
    ),
    RoleId.LB: TacticalAnchor(
        role=RoleId.LB, base_anchor=Point(16, 20), allowed_radius=10,
        defensive_zones=[SubZoneId.RECOVERY_LEFT, SubZoneId.RECOVERY_CENTER], recovery_priority=0.95,
    ),
    RoleId.RB: TacticalAnchor(
        role=RoleId.RB, base_anchor=Point(28, 60), allowed_radius=18,
        support_zones=[SubZoneId.BUILD_UP_RIGHT],
        attack_zones=[SubZoneId.CREATION_RIGHT],
        defensive_zones=[SubZoneId.RECOVERY_RIGHT], recovery_priority=0.75,
    ),
    RoleId.DM: TacticalAnchor(
        role=RoleId.DM, base_anchor=Point(32, 34), allowed_radius=14,
        support_zones=[SubZoneId.BUILD_UP_CENTER],
        pressure_zones=[SubZoneId.PRESS_CENTER], recovery_priority=0.8,
    ),
    RoleId.CM: TacticalAnchor(
        role=RoleId.CM, base_anchor=Point(42, 42), allowed_radius=16,
        support_zones=[SubZoneId.BUILD_UP_CENTER],
        attack_zones=[SubZoneId.CREATION_CENTER],
        pressure_zones=[SubZoneId.PRESS_CENTER, SubZoneId.PRESS_RIGHT], recovery_priority=0.6,
    ),
    RoleId.AM: TacticalAnchor(
        role=RoleId.AM, base_anchor=Point(42, 26), allowed_radius=16,
        support_zones=[SubZoneId.BUILD_UP_CENTER],
        attack_zones=[SubZoneId.CREATION_CENTER],
        pressure_zones=[SubZoneId.PRESS_CENTER, SubZoneId.PRESS_LEFT], recovery_priority=0.6,
    ),
    RoleId.LW: TacticalAnchor(
        role=RoleId.LW, base_anchor=Point(28, 8), allowed_radius=18,
        support_zones=[SubZoneId.BUILD_UP_LEFT],
        attack_zones=[SubZoneId.CREATION_LEFT],
        defensive_zones=[SubZoneId.RECOVERY_LEFT], recovery_priority=0.75,
    ),
    RoleId.ST: TacticalAnchor(
        role=RoleId.ST, base_anchor=Point(68, 40), allowed_radius=20,
        attack_zones=[SubZoneId.BOX_CENTER, SubZoneId.SIX_YARD_CENTER],
        transition_zones=[SubZoneId.CREATION_CENTER], recovery_priority=0.25,
    ),
    RoleId.RW: TacticalAnchor(
        role=RoleId.RW, base_anchor=Point(68, 28), allowed_radius=20,
        attack_zones=[SubZoneId.BOX_CENTER, SubZoneId.BOX_LEFT],
        transition_zones=[SubZoneId.CREATION_LEFT], recovery_priority=0.25,
    ),
}

_DEFAULT_ANCHORS_4231: dict[RoleId, TacticalAnchor] = {
    RoleId.GK: TacticalAnchor(
        role=RoleId.GK, base_anchor=Point(5, 34), allowed_radius=6,
        defensive_zones=[SubZoneId.RECOVERY_CENTER],
        forbidden_zones=[SubZoneId.PRESS_LEFT, SubZoneId.PRESS_CENTER, SubZoneId.PRESS_RIGHT,
                         SubZoneId.CREATION_LEFT, SubZoneId.CREATION_CENTER, SubZoneId.CREATION_RIGHT],
        recovery_priority=1.0,
    ),
    RoleId.RB: TacticalAnchor(
        role=RoleId.RB, base_anchor=Point(18, 58), allowed_radius=14,
        support_zones=[SubZoneId.BUILD_UP_RIGHT], defensive_zones=[SubZoneId.RECOVERY_RIGHT],
        attack_zones=[SubZoneId.CREATION_RIGHT], recovery_priority=0.85,
    ),
    RoleId.RCB: TacticalAnchor(
        role=RoleId.RCB, base_anchor=Point(16, 44), allowed_radius=10,
        defensive_zones=[SubZoneId.RECOVERY_CENTER, SubZoneId.RECOVERY_RIGHT], recovery_priority=0.95,
    ),
    RoleId.LCB: TacticalAnchor(
        role=RoleId.LCB, base_anchor=Point(16, 24), allowed_radius=10,
        defensive_zones=[SubZoneId.RECOVERY_CENTER, SubZoneId.RECOVERY_LEFT], recovery_priority=0.95,
    ),
    RoleId.LB: TacticalAnchor(
        role=RoleId.LB, base_anchor=Point(18, 10), allowed_radius=14,
        support_zones=[SubZoneId.BUILD_UP_LEFT], defensive_zones=[SubZoneId.RECOVERY_LEFT],
        attack_zones=[SubZoneId.CREATION_LEFT], recovery_priority=0.85,
    ),
    RoleId.DM: TacticalAnchor(
        role=RoleId.DM, base_anchor=Point(30, 42), allowed_radius=13,
        support_zones=[SubZoneId.BUILD_UP_CENTER, SubZoneId.BUILD_UP_RIGHT],
        defensive_zones=[SubZoneId.RECOVERY_CENTER],
        pressure_zones=[SubZoneId.PRESS_CENTER, SubZoneId.PRESS_RIGHT], recovery_priority=0.8,
    ),
    RoleId.CM: TacticalAnchor(
        role=RoleId.CM, base_anchor=Point(30, 26), allowed_radius=13,
        support_zones=[SubZoneId.BUILD_UP_CENTER, SubZoneId.BUILD_UP_LEFT],
        defensive_zones=[SubZoneId.RECOVERY_CENTER],
        pressure_zones=[SubZoneId.PRESS_CENTER, SubZoneId.PRESS_LEFT], recovery_priority=0.8,
    ),
    RoleId.AM: TacticalAnchor(
        role=RoleId.AM, base_anchor=Point(52, 34), allowed_radius=18,
        support_zones=[SubZoneId.BUILD_UP_CENTER],
        attack_zones=[SubZoneId.CREATION_CENTER, SubZoneId.BOX_CENTER],
        pressure_zones=[SubZoneId.PRESS_CENTER], recovery_priority=0.5,
    ),
    RoleId.RW: TacticalAnchor(
        role=RoleId.RW, base_anchor=Point(60, 58), allowed_radius=18,
        attack_zones=[SubZoneId.CREATION_RIGHT, SubZoneId.BOX_RIGHT],
        transition_zones=[SubZoneId.PRESS_RIGHT], recovery_priority=0.35,
    ),
    RoleId.LW: TacticalAnchor(
        role=RoleId.LW, base_anchor=Point(60, 10), allowed_radius=18,
        attack_zones=[SubZoneId.CREATION_LEFT, SubZoneId.BOX_LEFT],
        transition_zones=[SubZoneId.PRESS_LEFT], recovery_priority=0.35,
    ),
    RoleId.ST: TacticalAnchor(
        role=RoleId.ST, base_anchor=Point(74, 34), allowed_radius=18,
        attack_zones=[SubZoneId.BOX_CENTER, SubZoneId.SIX_YARD_CENTER],
        transition_zones=[SubZoneId.CREATION_CENTER], recovery_priority=0.2,
    ),
}

_DEFAULT_ANCHORS_451: dict[RoleId, TacticalAnchor] = {
    RoleId.GK: TacticalAnchor(
        role=RoleId.GK, base_anchor=Point(5, 34), allowed_radius=6,
        defensive_zones=[SubZoneId.RECOVERY_CENTER],
        forbidden_zones=[SubZoneId.PRESS_LEFT, SubZoneId.PRESS_CENTER, SubZoneId.PRESS_RIGHT,
                         SubZoneId.CREATION_LEFT, SubZoneId.CREATION_CENTER, SubZoneId.CREATION_RIGHT],
        recovery_priority=1.0,
    ),
    RoleId.RB: TacticalAnchor(
        role=RoleId.RB, base_anchor=Point(18, 58), allowed_radius=13,
        support_zones=[SubZoneId.BUILD_UP_RIGHT], defensive_zones=[SubZoneId.RECOVERY_RIGHT],
        recovery_priority=0.88,
    ),
    RoleId.RCB: TacticalAnchor(
        role=RoleId.RCB, base_anchor=Point(16, 44), allowed_radius=10,
        defensive_zones=[SubZoneId.RECOVERY_CENTER, SubZoneId.RECOVERY_RIGHT], recovery_priority=0.95,
    ),
    RoleId.LCB: TacticalAnchor(
        role=RoleId.LCB, base_anchor=Point(16, 24), allowed_radius=10,
        defensive_zones=[SubZoneId.RECOVERY_CENTER, SubZoneId.RECOVERY_LEFT], recovery_priority=0.95,
    ),
    RoleId.LB: TacticalAnchor(
        role=RoleId.LB, base_anchor=Point(18, 10), allowed_radius=13,
        support_zones=[SubZoneId.BUILD_UP_LEFT], defensive_zones=[SubZoneId.RECOVERY_LEFT],
        recovery_priority=0.88,
    ),
    RoleId.DM: TacticalAnchor(
        role=RoleId.DM, base_anchor=Point(32, 34), allowed_radius=13,
        support_zones=[SubZoneId.BUILD_UP_CENTER],
        defensive_zones=[SubZoneId.RECOVERY_CENTER],
        pressure_zones=[SubZoneId.PRESS_CENTER], recovery_priority=0.82,
    ),
    RoleId.CM: TacticalAnchor(
        role=RoleId.CM, base_anchor=Point(42, 44), allowed_radius=15,
        support_zones=[SubZoneId.BUILD_UP_CENTER, SubZoneId.BUILD_UP_RIGHT],
        pressure_zones=[SubZoneId.PRESS_CENTER, SubZoneId.PRESS_RIGHT], recovery_priority=0.65,
    ),
    RoleId.AM: TacticalAnchor(
        role=RoleId.AM, base_anchor=Point(42, 24), allowed_radius=15,
        support_zones=[SubZoneId.BUILD_UP_CENTER, SubZoneId.BUILD_UP_LEFT],
        pressure_zones=[SubZoneId.PRESS_CENTER, SubZoneId.PRESS_LEFT], recovery_priority=0.65,
    ),
    RoleId.RW: TacticalAnchor(
        role=RoleId.RW, base_anchor=Point(52, 58), allowed_radius=17,
        attack_zones=[SubZoneId.CREATION_RIGHT, SubZoneId.BOX_RIGHT],
        transition_zones=[SubZoneId.PRESS_RIGHT], recovery_priority=0.4,
    ),
    RoleId.LW: TacticalAnchor(
        role=RoleId.LW, base_anchor=Point(52, 10), allowed_radius=17,
        attack_zones=[SubZoneId.CREATION_LEFT, SubZoneId.BOX_LEFT],
        transition_zones=[SubZoneId.PRESS_LEFT], recovery_priority=0.4,
    ),
    RoleId.ST: TacticalAnchor(
        role=RoleId.ST, base_anchor=Point(72, 34), allowed_radius=18,
        attack_zones=[SubZoneId.BOX_CENTER, SubZoneId.SIX_YARD_CENTER],
        transition_zones=[SubZoneId.CREATION_CENTER], recovery_priority=0.22,
    ),
}

_DEFAULT_ANCHORS_343: dict[RoleId, TacticalAnchor] = {
    RoleId.GK: TacticalAnchor(
        role=RoleId.GK, base_anchor=Point(5, 34), allowed_radius=6,
        defensive_zones=[SubZoneId.RECOVERY_CENTER],
        forbidden_zones=[SubZoneId.PRESS_LEFT, SubZoneId.PRESS_CENTER, SubZoneId.PRESS_RIGHT,
                         SubZoneId.CREATION_LEFT, SubZoneId.CREATION_CENTER, SubZoneId.CREATION_RIGHT],
        recovery_priority=1.0,
    ),
    RoleId.RCB: TacticalAnchor(
        role=RoleId.RCB, base_anchor=Point(16, 50), allowed_radius=11,
        defensive_zones=[SubZoneId.RECOVERY_RIGHT, SubZoneId.RECOVERY_CENTER], recovery_priority=0.95,
    ),
    RoleId.LCB: TacticalAnchor(
        role=RoleId.LCB, base_anchor=Point(14, 34), allowed_radius=11,
        defensive_zones=[SubZoneId.RECOVERY_CENTER], recovery_priority=0.95,
    ),
    RoleId.LB: TacticalAnchor(
        role=RoleId.LB, base_anchor=Point(16, 18), allowed_radius=11,
        defensive_zones=[SubZoneId.RECOVERY_LEFT, SubZoneId.RECOVERY_CENTER], recovery_priority=0.95,
    ),
    # Wing-backs (RB/LB slots used as WBs in 3-4-3)
    RoleId.RB: TacticalAnchor(
        role=RoleId.RB, base_anchor=Point(38, 60), allowed_radius=20,
        support_zones=[SubZoneId.BUILD_UP_RIGHT],
        attack_zones=[SubZoneId.CREATION_RIGHT],
        defensive_zones=[SubZoneId.RECOVERY_RIGHT], recovery_priority=0.7,
    ),
    RoleId.DM: TacticalAnchor(
        role=RoleId.DM, base_anchor=Point(38, 8), allowed_radius=20,
        support_zones=[SubZoneId.BUILD_UP_LEFT],
        attack_zones=[SubZoneId.CREATION_LEFT],
        defensive_zones=[SubZoneId.RECOVERY_LEFT], recovery_priority=0.7,
    ),
    RoleId.CM: TacticalAnchor(
        role=RoleId.CM, base_anchor=Point(44, 44), allowed_radius=16,
        support_zones=[SubZoneId.BUILD_UP_CENTER],
        attack_zones=[SubZoneId.CREATION_CENTER],
        pressure_zones=[SubZoneId.PRESS_CENTER, SubZoneId.PRESS_RIGHT], recovery_priority=0.6,
    ),
    RoleId.AM: TacticalAnchor(
        role=RoleId.AM, base_anchor=Point(44, 24), allowed_radius=16,
        support_zones=[SubZoneId.BUILD_UP_CENTER],
        attack_zones=[SubZoneId.CREATION_CENTER],
        pressure_zones=[SubZoneId.PRESS_CENTER, SubZoneId.PRESS_LEFT], recovery_priority=0.6,
    ),
    RoleId.RW: TacticalAnchor(
        role=RoleId.RW, base_anchor=Point(68, 58), allowed_radius=18,
        attack_zones=[SubZoneId.CREATION_RIGHT, SubZoneId.BOX_RIGHT],
        transition_zones=[SubZoneId.PRESS_RIGHT], recovery_priority=0.3,
    ),
    RoleId.ST: TacticalAnchor(
        role=RoleId.ST, base_anchor=Point(72, 34), allowed_radius=18,
        attack_zones=[SubZoneId.BOX_CENTER, SubZoneId.SIX_YARD_CENTER],
        transition_zones=[SubZoneId.CREATION_CENTER], recovery_priority=0.2,
    ),
    RoleId.LW: TacticalAnchor(
        role=RoleId.LW, base_anchor=Point(68, 10), allowed_radius=18,
        attack_zones=[SubZoneId.CREATION_LEFT, SubZoneId.BOX_LEFT],
        transition_zones=[SubZoneId.PRESS_LEFT], recovery_priority=0.3,
    ),
}

_FORMATION_REGISTRY: dict[str, dict[RoleId, TacticalAnchor]] = {
    "4-3-3": _DEFAULT_ANCHORS_433,
    "4-4-2": _DEFAULT_ANCHORS_442,
    "3-5-2": _DEFAULT_ANCHORS_352,
    "4-2-3-1": _DEFAULT_ANCHORS_4231,
    "4-5-1": _DEFAULT_ANCHORS_451,
    "3-4-3": _DEFAULT_ANCHORS_343,
}


_ZONE_MIRROR: dict[SubZoneId, SubZoneId] = {
    SubZoneId.BUILD_UP_LEFT: SubZoneId.BUILD_UP_RIGHT,
    SubZoneId.BUILD_UP_RIGHT: SubZoneId.BUILD_UP_LEFT,
    SubZoneId.BUILD_UP_CENTER: SubZoneId.BUILD_UP_CENTER,
    SubZoneId.PRESS_LEFT: SubZoneId.PRESS_RIGHT,
    SubZoneId.PRESS_RIGHT: SubZoneId.PRESS_LEFT,
    SubZoneId.PRESS_CENTER: SubZoneId.PRESS_CENTER,
    SubZoneId.CREATION_LEFT: SubZoneId.CREATION_RIGHT,
    SubZoneId.CREATION_RIGHT: SubZoneId.CREATION_LEFT,
    SubZoneId.CREATION_CENTER: SubZoneId.CREATION_CENTER,
    SubZoneId.BOX_LEFT: SubZoneId.BOX_RIGHT,
    SubZoneId.BOX_RIGHT: SubZoneId.BOX_LEFT,
    SubZoneId.BOX_CENTER: SubZoneId.BOX_CENTER,
    SubZoneId.SIX_YARD_LEFT: SubZoneId.SIX_YARD_RIGHT,
    SubZoneId.SIX_YARD_RIGHT: SubZoneId.SIX_YARD_LEFT,
    SubZoneId.SIX_YARD_CENTER: SubZoneId.SIX_YARD_CENTER,
    SubZoneId.GOALMOUTH_LEFT: SubZoneId.GOALMOUTH_RIGHT,
    SubZoneId.GOALMOUTH_RIGHT: SubZoneId.GOALMOUTH_LEFT,
    SubZoneId.GOALMOUTH_CENTER: SubZoneId.GOALMOUTH_CENTER,
    SubZoneId.RECOVERY_LEFT: SubZoneId.RECOVERY_RIGHT,
    SubZoneId.RECOVERY_RIGHT: SubZoneId.RECOVERY_LEFT,
    SubZoneId.RECOVERY_CENTER: SubZoneId.RECOVERY_CENTER,
}


def _mirror_zone_list(zones: list[SubZoneId]) -> list[SubZoneId]:
    """When X is mirrored the left wing becomes the right wing and vice versa."""
    return [_ZONE_MIRROR.get(z, z) for z in zones]


def get_anchors_for_formation(
    formation: str = "4-3-3",
    side: TeamSide = TeamSide.HOME,
    half: MatchHalf = MatchHalf.FIRST,
) -> dict[RoleId, TacticalAnchor]:
    """
    Return tactical anchors adjusted for team side and half.
    Home in 1st half attacks east (high X); away attacks west (low X).
    In 2nd half the ends swap.
    """
    base = dict(_FORMATION_REGISTRY.get(formation, _DEFAULT_ANCHORS_433))
    need_mirror = (
        (side == TeamSide.AWAY and half == MatchHalf.FIRST)
        or (side == TeamSide.HOME and half == MatchHalf.SECOND)
    )
    if need_mirror:
        mirrored: dict[RoleId, TacticalAnchor] = {}
        for role, anchor in base.items():
            mirrored[role] = TacticalAnchor(
                role=anchor.role,
                base_anchor=Point(PITCH_LENGTH - anchor.base_anchor.x, anchor.base_anchor.z),
                allowed_radius=anchor.allowed_radius,
                support_zones=_mirror_zone_list(list(anchor.support_zones)),
                defensive_zones=_mirror_zone_list(list(anchor.defensive_zones)),
                attack_zones=_mirror_zone_list(list(anchor.attack_zones)),
                transition_zones=_mirror_zone_list(list(anchor.transition_zones)),
                pressure_zones=_mirror_zone_list(list(anchor.pressure_zones)),
                forbidden_zones=_mirror_zone_list(list(anchor.forbidden_zones)),
                recovery_priority=anchor.recovery_priority,
                role_intent_weights=dict(anchor.role_intent_weights),
            )
        return mirrored
    return base


# ═══════════════════════════════════════════════════════════════════════
#  D–F. QUERY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════

def get_zone_from_xy(x: float, z: float) -> Optional[str]:
    for zone in MACRO_ZONES:
        if zone.rect.contains(x, z):
            return zone.id
    return None


def get_subzone_from_xy(x: float, z: float) -> Optional[SubZoneId]:
    for sub in SUBZONES:
        if sub.rect.contains(x, z):
            return SubZoneId(sub.id)
    return None


def get_ball_zone(ball_x: float, ball_z: float) -> BallSpatialState:
    zone = get_zone_from_xy(ball_x, ball_z)
    subzone = get_subzone_from_xy(ball_x, ball_z)
    in_pen = EAST_GOAL.penalty_box.contains(ball_x, ball_z) or WEST_GOAL.penalty_box.contains(ball_x, ball_z)
    in_six = EAST_GOAL.six_yard_box.contains(ball_x, ball_z) or WEST_GOAL.six_yard_box.contains(ball_x, ball_z)
    between = _is_between_posts(ball_x, ball_z)
    return BallSpatialState(
        position=Point(ball_x, ball_z),
        zone=zone,
        subzone=subzone,
        in_penalty_box=in_pen,
        in_six_yard_box=in_six,
        between_posts=between,
    )


def _is_between_posts(x: float, z: float) -> bool:
    """Check if position is on the goal line between the posts."""
    gz = PITCH_WIDTH / 2
    if not (gz - GOAL_HALF_WIDTH <= z <= gz + GOAL_HALF_WIDTH):
        return False
    return x <= 0.5 or x >= PITCH_LENGTH - 0.5


def get_goal_context(x: float, z: float, attack_dir: int = 1) -> dict:
    """
    Finishing quality context from a world position.
    attack_dir: 1 = attacking east (x→105), -1 = attacking west (x→0).
    """
    goal = EAST_GOAL if attack_dir == 1 else WEST_GOAL
    goal_x = goal.goal_line_x
    goal_z = goal.center.z

    dx = goal_x - x
    dz = goal_z - z
    dist = math.hypot(dx, dz)
    angle_rad = abs(math.atan2(dz, dx)) if dist > 0.01 else 0.0

    # Angle quality: 0 = straight on, π/2 = extreme angle
    if angle_rad < 0.15:
        angle_quality = "excellent"
    elif angle_rad < 0.35:
        angle_quality = "good"
    elif angle_rad < 0.6:
        angle_quality = "tight"
    else:
        angle_quality = "very_tight"

    in_box = goal.penalty_box.contains(x, z)
    in_six = goal.six_yard_box.contains(x, z)

    # Near/far post assessment
    np_dist = math.hypot(goal.near_post.x - x, goal.near_post.z - z)
    fp_dist = math.hypot(goal.far_post.x - x, goal.far_post.z - z)
    closer_post = "near" if np_dist < fp_dist else "far"

    return {
        "distance": round(dist, 2),
        "angle_rad": round(angle_rad, 4),
        "angle_quality": angle_quality,
        "in_penalty_box": in_box,
        "in_six_yard_box": in_six,
        "closer_post": closer_post,
        "near_post_dist": round(np_dist, 2),
        "far_post_dist": round(fp_dist, 2),
        "goal_center": {"x": goal_x, "z": goal_z},
        "near_post": {"x": goal.near_post.x, "z": goal.near_post.z},
        "far_post": {"x": goal.far_post.x, "z": goal.far_post.z},
    }


def get_player_anchor(role: RoleId, formation: str = "4-3-3",
                      side: TeamSide = TeamSide.HOME,
                      half: MatchHalf = MatchHalf.FIRST) -> TacticalAnchor:
    anchors = get_anchors_for_formation(formation, side, half)
    return anchors[role]


def get_player_allowed_movement(
    player: PlayerSpatialState,
    team_phase: TeamPhase,
) -> dict:
    """Compute effective freedom radius and recovery bias by phase."""
    base_r = player.freedom_radius
    phase_mult = {
        TeamPhase.ORGANIZED_ATTACK: 1.2,
        TeamPhase.OFFENSIVE_TRANSITION: 1.3,
        TeamPhase.DEFENSIVE_TRANSITION: 0.7,
        TeamPhase.DEFENSIVE_BLOCK: 0.6,
        TeamPhase.HIGH_PRESS: 1.1,
        TeamPhase.MID_BLOCK: 0.75,
        TeamPhase.LOW_BLOCK: 0.5,
        TeamPhase.SET_PIECE: 0.4,
    }
    r = base_r * phase_mult.get(team_phase, 1.0)
    should_recover = player.is_out_of_shape and team_phase in (
        TeamPhase.DEFENSIVE_BLOCK, TeamPhase.LOW_BLOCK, TeamPhase.DEFENSIVE_TRANSITION,
    )
    return {
        "effective_radius": round(r, 2),
        "should_recover_shape": should_recover,
        "phase_multiplier": phase_mult.get(team_phase, 1.0),
    }


def get_shape_correction(
    player: PlayerSpatialState,
    anchor: TacticalAnchor,
) -> dict:
    """How far the player is from their base anchor and suggested correction vector."""
    dx = anchor.base_anchor.x - player.current_position.x
    dz = anchor.base_anchor.z - player.current_position.z
    dist = math.hypot(dx, dz)
    out_of_shape = dist > anchor.allowed_radius
    correction = None
    if out_of_shape and dist > 0.01:
        strength = min(1.0, (dist - anchor.allowed_radius) / anchor.allowed_radius)
        correction = {
            "dx": round(dx / dist * strength, 4),
            "dz": round(dz / dist * strength, 4),
            "strength": round(strength, 4),
        }
    return {
        "distance_from_anchor": round(dist, 2),
        "is_out_of_shape": out_of_shape,
        "correction": correction,
    }


def evaluate_action_context(
    player_x: float, player_z: float,
    ball_x: float, ball_z: float,
    attack_dir: int = 1,
) -> SpatialEventContext:
    """Spatial context for any action: zone, finishing quality, tactical flags."""
    ball = get_ball_zone(ball_x, ball_z)
    actor_zone = get_zone_from_xy(player_x, player_z)
    actor_subzone = get_subzone_from_xy(player_x, player_z)

    goal_ctx = get_goal_context(player_x, player_z, attack_dir)

    return SpatialEventContext(
        ball=ball,
        actor_zone=actor_zone,
        actor_subzone=actor_subzone,
        is_shot_between_posts=_is_between_posts(player_x, player_z),
        finishing_angle_quality=goal_ctx["angle_quality"],
        in_six_yard=goal_ctx["in_six_yard_box"],
        in_penalty_box=goal_ctx["in_penalty_box"],
    )


def get_finish_quality_context(player_x: float, player_z: float,
                               attack_dir: int = 1) -> dict:
    return get_goal_context(player_x, player_z, attack_dir)


def flip_team_side_for_second_half(
    anchors: dict[RoleId, TacticalAnchor],
) -> dict[RoleId, TacticalAnchor]:
    """Mirror all anchors across X midline for the second half."""
    out: dict[RoleId, TacticalAnchor] = {}
    for role, a in anchors.items():
        out[role] = TacticalAnchor(
            role=a.role,
            base_anchor=Point(PITCH_LENGTH - a.base_anchor.x, a.base_anchor.z),
            allowed_radius=a.allowed_radius,
            support_zones=list(a.support_zones),
            defensive_zones=list(a.defensive_zones),
            attack_zones=list(a.attack_zones),
            transition_zones=list(a.transition_zones),
            pressure_zones=list(a.pressure_zones),
            forbidden_zones=list(a.forbidden_zones),
            recovery_priority=a.recovery_priority,
            role_intent_weights=dict(a.role_intent_weights),
        )
    return out


# ═══════════════════════════════════════════════════════════════════════
#  SNAPSHOT EXPORT — JSON bridge for the TypeScript engine
# ═══════════════════════════════════════════════════════════════════════

def _point_dict(p: Point) -> dict:
    return {"x": p.x, "z": p.z}


def _rect_dict(r: Rect) -> dict:
    return {"x_min": r.x_min, "z_min": r.z_min, "x_max": r.x_max, "z_max": r.z_max}


def _goal_dict(g: GoalZoneDefinition) -> dict:
    return {
        "goal_line_x": g.goal_line_x,
        "near_post": _point_dict(g.near_post),
        "far_post": _point_dict(g.far_post),
        "center": _point_dict(g.center),
        "mouth_rect": _rect_dict(g.mouth_rect),
        "six_yard_box": _rect_dict(g.six_yard_box),
        "penalty_box": _rect_dict(g.penalty_box),
        "penalty_spot": _point_dict(g.penalty_spot),
        "near_post_zone": _rect_dict(g.near_post_zone),
        "far_post_zone": _rect_dict(g.far_post_zone),
        "central_channel": _rect_dict(g.central_channel),
    }


def _anchor_dict(a: TacticalAnchor) -> dict:
    return {
        "role": a.role.value,
        "base_anchor": _point_dict(a.base_anchor),
        "allowed_radius": a.allowed_radius,
        "support_zones": [s.value for s in a.support_zones],
        "defensive_zones": [s.value for s in a.defensive_zones],
        "attack_zones": [s.value for s in a.attack_zones],
        "transition_zones": [s.value for s in a.transition_zones],
        "pressure_zones": [s.value for s in a.pressure_zones],
        "forbidden_zones": [s.value for s in a.forbidden_zones],
        "recovery_priority": a.recovery_priority,
        "role_intent_weights": a.role_intent_weights,
    }


def export_smartfield_snapshot(
    formation: str = "4-3-3",
    half: MatchHalf = MatchHalf.FIRST,
    out_path: Optional[str] = None,
) -> dict:
    """
    Static snapshot of field geometry, zones, goals and anchors for ALL formations.
    Written as JSON for the TypeScript side to import at build or startup.
    The `formation` param is kept for backwards-compat but all formations are exported.
    """
    formations_data: dict[str, dict] = {}
    for fname in _FORMATION_REGISTRY:
        home_anchors = get_anchors_for_formation(fname, TeamSide.HOME, half)
        away_anchors = get_anchors_for_formation(fname, TeamSide.AWAY, half)
        formations_data[fname] = {
            "anchors": {
                "home": {r.value: _anchor_dict(a) for r, a in home_anchors.items()},
                "away": {r.value: _anchor_dict(a) for r, a in away_anchors.items()},
            }
        }

    data = {
        "field": {
            "length": PITCH_LENGTH,
            "width": PITCH_WIDTH,
            "center": _point_dict(Point(PITCH_LENGTH / 2, PITCH_WIDTH / 2)),
            "center_circle_radius": CENTER_CIRCLE_RADIUS,
        },
        "goals": {
            "west": _goal_dict(WEST_GOAL),
            "east": _goal_dict(EAST_GOAL),
        },
        "macro_zones": [
            {"id": z.id, "rect": _rect_dict(z.rect), "third": z.third.value, "lane": z.lane.value}
            for z in MACRO_ZONES
        ],
        "subzones": [
            {"id": z.id, "rect": _rect_dict(z.rect), "third": z.third.value, "lane": z.lane.value}
            for z in SUBZONES
        ],
        "formations": formations_data,
        # Legacy flat anchors for the default formation (backwards compat)
        "anchors": formations_data[formation]["anchors"],
        "half": half.value,
        "formation": formation,
    }

    if out_path:
        p = Path(out_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, indent=2))

    return data


# ═══════════════════════════════════════════════════════════════════════
#  Quick self-test
# ═══════════════════════════════════════════════════════════════════════

def _self_test():
    # Zone lookup
    z = get_zone_from_xy(10, 10)
    assert z is not None, "should find zone at (10,10)"
    assert "defensive" in z, f"expected defensive third, got {z}"

    # Ball zone
    bz = get_ball_zone(98, 34)
    assert bz.in_penalty_box, "ball at (98,34) must be in penalty box"

    # Goal context
    gc = get_goal_context(90, 34, attack_dir=1)
    assert gc["in_penalty_box"], "90,34 is inside penalty box"
    assert gc["angle_quality"] in ("excellent", "good"), f"unexpected quality {gc['angle_quality']}"

    # Between posts
    assert _is_between_posts(105, 34), "dead center of goal line should be between posts"
    assert not _is_between_posts(50, 34), "midfield is not between posts"

    # Second half flip
    h1 = get_anchors_for_formation("4-3-3", TeamSide.HOME, MatchHalf.FIRST)
    h2 = get_anchors_for_formation("4-3-3", TeamSide.HOME, MatchHalf.SECOND)
    gk1 = h1[RoleId.GK].base_anchor.x
    gk2 = h2[RoleId.GK].base_anchor.x
    assert abs(gk1 + gk2 - PITCH_LENGTH) < 0.01, "GK should mirror across X"

    # Export
    snap = export_smartfield_snapshot()
    assert "goals" in snap and "macro_zones" in snap

    print("smartfield_engine self-test: ok")


if __name__ == "__main__":
    _self_test()
