"""
SMARTFIELD Debug Visualizer — mplsoccer-based pitch overlays.

Generates visual validation of zones, anchors, goal regions and player states.
NOT used at runtime; run manually for development / analysis.

Usage:
    python smartfield/smartfield_debug.py              # all debug views
    python smartfield/smartfield_debug.py --zones      # zone overlay only
    python smartfield/smartfield_debug.py --anchors    # anchor map only
    python smartfield/smartfield_debug.py --goals      # goal sub-zones only
    python smartfield/smartfield_debug.py --snapshot   # full snapshot export
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from mplsoccer import Pitch
except ImportError:
    print(
        "smartfield_debug requires matplotlib and mplsoccer.\n"
        "Install with: pip install matplotlib mplsoccer"
    )
    sys.exit(1)

from smartfield_engine import (
    PITCH_LENGTH,
    PITCH_WIDTH,
    MACRO_ZONES,
    SUBZONES,
    EAST_GOAL,
    WEST_GOAL,
    get_anchors_for_formation,
    export_smartfield_snapshot,
)
from smartfield_schema import (
    MatchHalf,
    RoleId,
    TeamSide,
    TacticalThird,
)

OUT_DIR = Path(__file__).parent / "debug_output"


def _ensure_dir():
    OUT_DIR.mkdir(parents=True, exist_ok=True)


# ── Zone colors ─────────────────────────────────────────────────────

_THIRD_COLORS = {
    TacticalThird.DEFENSIVE: "#2ecc71",
    TacticalThird.MIDDLE: "#f1c40f",
    TacticalThird.ATTACKING: "#e74c3c",
}

_SUBZONE_ALPHA = 0.25


# ── Helpers ─────────────────────────────────────────────────────────

def _create_pitch():
    """Custom 105×68 pitch with mplsoccer."""
    pitch = Pitch(
        pitch_type="custom",
        pitch_length=PITCH_LENGTH,
        pitch_width=PITCH_WIDTH,
        pitch_color="#1a472a",
        line_color="white",
        linewidth=1,
        goal_type="box",
    )
    return pitch


def _rect_patch(rect, color, alpha=0.3, label=None):
    return mpatches.Rectangle(
        (rect.x_min, rect.z_min),
        rect.x_max - rect.x_min,
        rect.z_max - rect.z_min,
        linewidth=0.8,
        edgecolor=color,
        facecolor=color,
        alpha=alpha,
        label=label,
    )


# ═══════════════════════════════════════════════════════════════════════
#  1. MACRO ZONES OVERLAY
# ═══════════════════════════════════════════════════════════════════════

def draw_macro_zones():
    _ensure_dir()
    pitch = _create_pitch()
    fig, ax = pitch.draw(figsize=(14, 9))

    for zone in MACRO_ZONES:
        color = _THIRD_COLORS.get(zone.third, "#999")
        ax.add_patch(_rect_patch(zone.rect, color, alpha=0.18))
        cx, cz = zone.rect.center.x, zone.rect.center.z
        ax.text(cx, cz, zone.id.replace("_", "\n"), fontsize=6, ha="center", va="center",
                color="white", fontweight="bold", alpha=0.9)

    ax.set_title("SMARTFIELD — Macro Zones (15)", color="white", fontsize=14, pad=12)
    fig.savefig(OUT_DIR / "macro_zones.png", dpi=150, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"  → {OUT_DIR / 'macro_zones.png'}")


# ═══════════════════════════════════════════════════════════════════════
#  2. SUBZONES OVERLAY
# ═══════════════════════════════════════════════════════════════════════

def draw_subzones():
    _ensure_dir()
    pitch = _create_pitch()
    fig, ax = pitch.draw(figsize=(14, 9))

    colors = {
        "recovery": "#3498db",
        "build_up": "#2ecc71",
        "press": "#f39c12",
        "creation": "#e67e22",
        "box": "#e74c3c",
        "six_yard": "#c0392b",
        "goalmouth": "#8e44ad",
    }

    for zone in SUBZONES:
        prefix = zone.id.rsplit("_", 1)[0] if "_" in zone.id else zone.id
        for key in colors:
            if zone.id.startswith(key):
                prefix = key
                break
        color = colors.get(prefix, "#aaa")
        ax.add_patch(_rect_patch(zone.rect, color, alpha=_SUBZONE_ALPHA))
        cx, cz = zone.rect.center.x, zone.rect.center.z
        label = zone.id.replace("_", "\n")
        ax.text(cx, cz, label, fontsize=5, ha="center", va="center",
                color="white", fontweight="bold", alpha=0.85)

    ax.set_title("SMARTFIELD — Subzones (Gameplay-Oriented)", color="white", fontsize=14, pad=12)
    fig.savefig(OUT_DIR / "subzones.png", dpi=150, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"  → {OUT_DIR / 'subzones.png'}")


# ═══════════════════════════════════════════════════════════════════════
#  3. ANCHORS BY POSITION
# ═══════════════════════════════════════════════════════════════════════

def draw_anchors(formation: str = "4-3-3"):
    _ensure_dir()
    pitch = _create_pitch()
    fig, ax = pitch.draw(figsize=(14, 9))

    role_colors = {
        RoleId.GK: "#f1c40f",
        RoleId.RB: "#3498db", RoleId.RCB: "#2980b9", RoleId.LCB: "#2980b9", RoleId.LB: "#3498db",
        RoleId.DM: "#27ae60",
        RoleId.CM: "#2ecc71", RoleId.AM: "#1abc9c",
        RoleId.RW: "#e74c3c", RoleId.LW: "#e74c3c",
        RoleId.ST: "#c0392b",
    }

    for side in (TeamSide.HOME, TeamSide.AWAY):
        anchors = get_anchors_for_formation(formation, side, MatchHalf.FIRST)
        marker = "o" if side == TeamSide.HOME else "s"
        for role, anchor in anchors.items():
            color = role_colors.get(role, "#fff")
            p = anchor.base_anchor
            circle = plt.Circle((p.x, p.z), anchor.allowed_radius,
                                color=color, alpha=0.12, linewidth=0.6, fill=True)
            ax.add_patch(circle)
            ax.plot(p.x, p.z, marker, color=color, markersize=10, markeredgecolor="white",
                    markeredgewidth=1.2, zorder=5)
            offset = 2.5 if side == TeamSide.HOME else -2.5
            ax.text(p.x, p.z + offset, role.value, fontsize=7, ha="center", va="center",
                    color="white", fontweight="bold", zorder=6)

    ax.set_title(f"SMARTFIELD — Tactical Anchors ({formation}) — Home ● / Away ■",
                 color="white", fontsize=14, pad=12)
    fig.savefig(OUT_DIR / "anchors.png", dpi=150, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"  → {OUT_DIR / 'anchors.png'}")


# ═══════════════════════════════════════════════════════════════════════
#  4. GOAL SUB-ZONES (near post / far post / central channel)
# ═══════════════════════════════════════════════════════════════════════

def draw_goal_zones():
    _ensure_dir()
    pitch = _create_pitch()
    fig, ax = pitch.draw(figsize=(14, 9))

    for goal, label_side in [(EAST_GOAL, "East"), (WEST_GOAL, "West")]:
        ax.add_patch(_rect_patch(goal.penalty_box, "#e74c3c", alpha=0.1))
        ax.add_patch(_rect_patch(goal.six_yard_box, "#c0392b", alpha=0.15))
        ax.add_patch(_rect_patch(goal.near_post_zone, "#3498db", alpha=0.45, label=f"Near post ({label_side})"))
        ax.add_patch(_rect_patch(goal.far_post_zone, "#e67e22", alpha=0.45, label=f"Far post ({label_side})"))
        ax.add_patch(_rect_patch(goal.central_channel, "#2ecc71", alpha=0.45, label=f"Central ({label_side})"))

        np = goal.near_post
        fp = goal.far_post
        ax.plot(np.x, np.z, "D", color="#3498db", markersize=8, zorder=5)
        ax.plot(fp.x, fp.z, "D", color="#e67e22", markersize=8, zorder=5)
        ax.plot(goal.center.x, goal.center.z, "*", color="#2ecc71", markersize=12, zorder=5)
        ax.plot(goal.penalty_spot.x, goal.penalty_spot.z, "x", color="white", markersize=8,
                markeredgewidth=2, zorder=5)

    ax.set_title("SMARTFIELD — Goal Zones (Near Post / Far Post / Central Channel)",
                 color="white", fontsize=14, pad=12)
    ax.legend(loc="upper center", ncol=3, fontsize=7, framealpha=0.4)
    fig.savefig(OUT_DIR / "goal_zones.png", dpi=150, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"  → {OUT_DIR / 'goal_zones.png'}")


# ═══════════════════════════════════════════════════════════════════════
#  5. FULL COMPOSITE VIEW
# ═══════════════════════════════════════════════════════════════════════

def draw_composite():
    _ensure_dir()
    fig, axes = plt.subplots(2, 2, figsize=(22, 14))
    fig.patch.set_facecolor("#0d1117")
    fig.suptitle("SMARTFIELD — Complete Debug Overview", color="white", fontsize=18, y=0.98)

    for idx, (draw_fn, title) in enumerate([
        (draw_macro_zones, "Macro Zones"),
        (draw_subzones, "Subzones"),
        (draw_anchors, "Anchors"),
        (draw_goal_zones, "Goal Zones"),
    ]):
        draw_fn()

    print(f"  All individual views saved to {OUT_DIR}/")


# ═══════════════════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="SMARTFIELD debug visualizer")
    parser.add_argument("--zones", action="store_true", help="Draw macro zones")
    parser.add_argument("--subzones", action="store_true", help="Draw subzones")
    parser.add_argument("--anchors", action="store_true", help="Draw tactical anchors")
    parser.add_argument("--goals", action="store_true", help="Draw goal sub-zones")
    parser.add_argument("--snapshot", action="store_true", help="Export JSON snapshot")
    parser.add_argument("--all", action="store_true", help="Generate everything")

    args = parser.parse_args()
    any_flag = args.zones or args.subzones or args.anchors or args.goals or args.snapshot

    if args.all or not any_flag:
        print("SMARTFIELD debug — generating all views...")
        draw_macro_zones()
        draw_subzones()
        draw_anchors()
        draw_goal_zones()
        snap = export_smartfield_snapshot(
            out_path=str(OUT_DIR / "smartfield_snapshot.json"),
        )
        print(f"  → {OUT_DIR / 'smartfield_snapshot.json'} ({len(snap['macro_zones'])} zones, "
              f"{len(snap['subzones'])} subzones)")
        return

    if args.zones:
        draw_macro_zones()
    if args.subzones:
        draw_subzones()
    if args.anchors:
        draw_anchors()
    if args.goals:
        draw_goal_zones()
    if args.snapshot:
        snap = export_smartfield_snapshot(
            out_path=str(OUT_DIR / "smartfield_snapshot.json"),
        )
        print(f"  → {OUT_DIR / 'smartfield_snapshot.json'}")


if __name__ == "__main__":
    main()
