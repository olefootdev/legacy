---
name: clinical-finisher
version: 1.0.0
position: ST
trigger: hasBall AND distToGoal < 20 AND nearestOpponentDist > 5
intention_override: FINISH
action_override: SHOOT
confidence_bonus: +8
stamina_cost: 2
---

# Clinical Finisher

A striker who activates this skill has identified a clear shooting opportunity.
They ignore zone constraints and shoot immediately — no dribble, no hesitation.

## Trigger conditions
- Agent has the ball (`hasBall = true`)
- Within 20 normalized units of the opponent goal
- Nearest opponent is at least 5 units away (clear sight of goal)

## Behavior override
- Intention forced to `FINISH`
- Action forced to `SHOOT` targeting goal center
- Confidence rises +8 on activation (composure under pressure)
- Stamina costs 2 (explosive effort)

## Failure condition
If `nearestOpponentDist < 5`, skill does NOT activate — agent falls back to
default decision tree (may dribble or pass instead).
