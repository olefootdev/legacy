"""
SMARTFIELD — Data structures for field geometry, zones, anchors and player spatial state.

All coordinates in metres; origin (0, 0) = bottom-left of pitch viewed from the home team.
X = length axis (0 → 105), Z = width axis (0 → 68).
Aligned with the existing OLEFOOT TypeScript convention (field.ts / fieldZones.ts).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ── Pitch + goal mouth (aligned with src/simulation/field.ts) ───────
# Goal mouth wider/taller than IFAB (7.32 × 2.44) for higher scoring.

PITCH_LENGTH = 105.0
PITCH_WIDTH = 68.0
GOAL_WIDTH = 10.0
GOAL_HEIGHT = 3.0
GOAL_HALF_WIDTH = GOAL_WIDTH / 2
PENALTY_AREA_DEPTH = 16.5
PENALTY_AREA_HALF_WIDTH = 20.16
GOAL_AREA_DEPTH = 5.5
GOAL_AREA_HALF_WIDTH = 9.16
PENALTY_SPOT_DEPTH = 11.0
CENTER_CIRCLE_RADIUS = 9.15
CORNER_ARC_RADIUS = 1.0


# ── Enums ───────────────────────────────────────────────────────────

class TeamSide(str, Enum):
    HOME = "home"
    AWAY = "away"


class MatchHalf(int, Enum):
    FIRST = 1
    SECOND = 2


class TeamPhase(str, Enum):
    ORGANIZED_ATTACK = "organized_attack"
    OFFENSIVE_TRANSITION = "offensive_transition"
    DEFENSIVE_TRANSITION = "defensive_transition"
    DEFENSIVE_BLOCK = "defensive_block"
    HIGH_PRESS = "high_press"
    MID_BLOCK = "mid_block"
    LOW_BLOCK = "low_block"
    SET_PIECE = "set_piece"


class TacticalThird(str, Enum):
    DEFENSIVE = "defensive"
    MIDDLE = "middle"
    ATTACKING = "attacking"


class TacticalLane(str, Enum):
    LEFT_WING = "left_wing"
    LEFT_HALFSPACE = "left_halfspace"
    CENTER = "center"
    RIGHT_HALFSPACE = "right_halfspace"
    RIGHT_WING = "right_wing"


class SubZoneId(str, Enum):
    BUILD_UP_LEFT = "build_up_left"
    BUILD_UP_CENTER = "build_up_center"
    BUILD_UP_RIGHT = "build_up_right"
    PRESS_LEFT = "press_left"
    PRESS_CENTER = "press_center"
    PRESS_RIGHT = "press_right"
    CREATION_LEFT = "creation_left"
    CREATION_CENTER = "creation_center"
    CREATION_RIGHT = "creation_right"
    BOX_LEFT = "box_left"
    BOX_CENTER = "box_center"
    BOX_RIGHT = "box_right"
    SIX_YARD_LEFT = "six_yard_left"
    SIX_YARD_CENTER = "six_yard_center"
    SIX_YARD_RIGHT = "six_yard_right"
    GOALMOUTH_LEFT = "goalmouth_left"
    GOALMOUTH_CENTER = "goalmouth_center"
    GOALMOUTH_RIGHT = "goalmouth_right"
    RECOVERY_LEFT = "recovery_left"
    RECOVERY_CENTER = "recovery_center"
    RECOVERY_RIGHT = "recovery_right"


class RoleId(str, Enum):
    GK = "GK"
    RB = "RB"
    RCB = "RCB"
    LCB = "LCB"
    LB = "LB"
    DM = "DM"
    CM = "CM"
    AM = "AM"
    RW = "RW"
    LW = "LW"
    ST = "ST"


# ── Geometry primitives ─────────────────────────────────────────────

@dataclass(frozen=True)
class Point:
    x: float
    z: float


@dataclass(frozen=True)
class Rect:
    """Axis-aligned rectangle defined by two corners."""
    x_min: float
    z_min: float
    x_max: float
    z_max: float

    @property
    def center(self) -> Point:
        return Point((self.x_min + self.x_max) / 2, (self.z_min + self.z_max) / 2)

    def contains(self, x: float, z: float) -> bool:
        return self.x_min <= x <= self.x_max and self.z_min <= z <= self.z_max


# ── Zone definitions ────────────────────────────────────────────────

@dataclass(frozen=True)
class ZoneDefinition:
    id: str
    rect: Rect
    third: TacticalThird
    lane: TacticalLane


@dataclass(frozen=True)
class GoalZoneDefinition:
    """Posts, mouth and sub-regions of the goal."""
    goal_line_x: float
    near_post: Point
    far_post: Point
    center: Point
    mouth_rect: Rect
    six_yard_box: Rect
    penalty_box: Rect
    penalty_spot: Point
    near_post_zone: Rect
    far_post_zone: Rect
    central_channel: Rect


# ── Tactical anchor ─────────────────────────────────────────────────

@dataclass
class TacticalAnchor:
    role: RoleId
    base_anchor: Point
    allowed_radius: float = 12.0
    support_zones: list[SubZoneId] = field(default_factory=list)
    defensive_zones: list[SubZoneId] = field(default_factory=list)
    attack_zones: list[SubZoneId] = field(default_factory=list)
    transition_zones: list[SubZoneId] = field(default_factory=list)
    pressure_zones: list[SubZoneId] = field(default_factory=list)
    forbidden_zones: list[SubZoneId] = field(default_factory=list)
    recovery_priority: float = 0.5
    role_intent_weights: dict[str, float] = field(default_factory=dict)


# ── Player spatial state ────────────────────────────────────────────

@dataclass
class PlayerSpatialState:
    player_id: str
    role: RoleId
    current_position: Point
    current_zone: Optional[str] = None
    current_subzone: Optional[SubZoneId] = None
    base_anchor: Optional[Point] = None
    target_zone: Optional[str] = None
    tactical_state: Optional[TeamPhase] = None
    side_of_play: TeamSide = TeamSide.HOME
    role_mode: str = "normal"
    freedom_radius: float = 12.0
    distance_to_ball: float = 0.0
    nearest_opponent: float = 999.0
    nearest_teammate_support: float = 999.0
    is_out_of_shape: bool = False
    should_recover_shape: bool = False


@dataclass
class BallSpatialState:
    position: Point
    zone: Optional[str] = None
    subzone: Optional[SubZoneId] = None
    in_penalty_box: bool = False
    in_six_yard_box: bool = False
    between_posts: bool = False


@dataclass
class TeamShapeState:
    side: TeamSide
    phase: TeamPhase
    compactness_horizontal: float = 0.0
    compactness_vertical: float = 0.0
    avg_x: float = 0.0
    avg_z: float = 0.0
    defensive_line_x: float = 0.0
    forward_line_x: float = 0.0
    width: float = 0.0


@dataclass
class SpatialEventContext:
    ball: BallSpatialState
    actor_zone: Optional[str] = None
    actor_subzone: Optional[SubZoneId] = None
    target_zone: Optional[str] = None
    is_shot_between_posts: bool = False
    finishing_angle_quality: str = "neutral"
    in_six_yard: bool = False
    in_penalty_box: bool = False
    should_press: bool = False
    should_cover: bool = False
    should_recover: bool = False


@dataclass
class SmartfieldSnapshot:
    home_players: list[PlayerSpatialState]
    away_players: list[PlayerSpatialState]
    ball: BallSpatialState
    home_shape: TeamShapeState
    away_shape: TeamShapeState
    home_goals: GoalZoneDefinition
    away_goals: GoalZoneDefinition
    zones: list[ZoneDefinition]
    subzones: list[ZoneDefinition]
    half: MatchHalf = MatchHalf.FIRST
