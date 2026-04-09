# Structural reorganisation — tuning

| Parameter | Value | Location |
|-----------|-------|----------|
| Goal restart walk duration | 2.0 s | `matchPlayFsm.GOAL_RESTART_REPOSITION_SEC` |
| Kickoff → live | 0.5 s | `matchPlayFsm.KICKOFF_TO_LIVE_SEC` |
| Set-piece structural blend | 3.0 s | `StructuralEvent.DEFAULT_SET_PIECE_REPOSITION_SEC` |
| Set-piece auto-resume | 4.5 s | `matchPlayFsm.SET_PIECE_AUTO_RESUME_SEC` |
| Min opponent distance (GK/corner) | 9.15 m | `StructuralEvent.MIN_DIST_*` |
| Transition compaction decay | 3.0 s | `transitionCompaction.TRANSITION_COMPACTION_DECAY_SEC` |
| Max compaction shift | 0.15 (normalized) | `transitionCompaction.COMPACTION_SHIFT_MAX` |
| Central corridor bonus | 1.3× | `transitionCompaction.CENTRAL_CORRIDOR_COMPACTION_BONUS` |

**Tests:** `npm run test:structural`

**No teleport:** player motion uses `setArriveTarget` + Yuka; only the ball uses `placeForKickoff()` at defined spots.
