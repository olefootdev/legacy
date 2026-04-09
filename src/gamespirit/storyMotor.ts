import type { Beat, BeatKind, MatchupMatrix, SectorStrength, StoryTimeline, StoryWeights } from './storyContracts';
import { TacticalIntent } from './storyContracts';

function hash32(n: number): number {
  let x = Math.floor(n) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xffffffff;
}

function rnd(seed: number, i: number): number {
  return hash32(seed * 0x9e3779b1 + i * 0x517cc1b7);
}

function makeBeat(
  seed: number,
  idx: number,
  half: 1 | 2,
  minuteStart: number,
  minuteEnd: number,
  kind: BeatKind,
  intensity01: number,
  hints?: Beat['hints'],
): Beat {
  return {
    id: `beat-${half}-${minuteStart}-${idx}-${(seed + idx).toString(36)}`,
    minuteStart,
    minuteEnd,
    kind,
    resolved: false,
    intensity01,
    hints,
  };
}

/**
 * Gera timeline de beats com incerteza: oportunidades de golo/cartão só resolvem no tick.
 */
export function generateStoryTimeline(
  half: 1 | 2,
  matrix: MatchupMatrix,
  home: SectorStrength,
  away: SectorStrength,
  weights: StoryWeights,
  variationSeed: number,
): StoryTimeline {
  const beats: Beat[] = [];
  const base = half === 1 ? 0 : 45;
  const span = 44;
  const seed = variationSeed ^ (half * 0xdeadbeef);

  let idx = 0;
  for (let m = 2; m < span; m += 3 + Math.floor(rnd(seed, m) * 4)) {
    const start = base + m;
    const end = Math.min(base + span, start + 2);
    const roll = rnd(seed, idx + 777);

    const duelMul = weights.duelIntensity;
    const chanceMul = weights.chanceRate * (0.85 + 0.15 * matrix.atkVsDef);
    const cardMul = weights.cardPressure * (0.9 + 0.1 * matrix.criVsCri);

    if (roll < 0.14 * duelMul) {
      beats.push(
        makeBeat(seed, idx++, half, start, end, 'press', 0.45 + 0.2 * rnd(seed, idx), [
          { playerRef: 'mc1', targetUx: 48 + rnd(seed, idx) * 10, targetUy: 50, tacticalIntent: TacticalIntent.PressHigh },
        ]),
      );
    } else if (roll < 0.28 * chanceMul) {
      const homeBias = (home.attack + 5) / (home.attack + away.defensive + 20);
      beats.push(
        makeBeat(
          seed,
          idx++,
          half,
          start,
          end,
          rnd(seed, idx + 3) < homeBias ? 'chance_home' : 'chance_away',
          0.35 + 0.25 * matrix.defVsAtk * rnd(seed, idx + 9),
          [
            {
              playerRef: 'attack',
              targetUx: half === 1 ? 72 + rnd(seed, idx) * 8 : 28 + rnd(seed, idx) * 8,
              targetUy: 30 + rnd(seed, idx + 1) * 40,
              tacticalIntent: TacticalIntent.FinalThird,
            },
          ],
        ),
      );
    } else if (roll < 0.42) {
      const sp = rnd(seed, idx + 2048);
      if (sp < 0.34) {
        beats.push(
          makeBeat(seed, idx++, half, start, end, 'play_dribble', 0.42 + 0.15 * rnd(seed, idx), [
            {
              playerRef: 'attack',
              targetUx: half === 1 ? 68 + rnd(seed, idx) * 12 : 32 + rnd(seed, idx) * 10,
              targetUy: 22 + rnd(seed, idx + 1) * 56,
              tacticalIntent: TacticalIntent.Progress,
            },
          ]),
        );
      } else if (sp < 0.67) {
        const uyFrom = rnd(seed, idx + 5) < 0.5 ? 12 + rnd(seed, idx) * 18 : 70 + rnd(seed, idx) * 18;
        beats.push(
          makeBeat(seed, idx++, half, start, end, 'play_cross', 0.4 + 0.12 * rnd(seed, idx), [
            {
              playerRef: 'attack',
              targetUx: half === 1 ? 78 + rnd(seed, idx) * 10 : 22 + rnd(seed, idx) * 10,
              targetUy: uyFrom,
              tacticalIntent: TacticalIntent.WideOverload,
            },
          ]),
        );
      } else {
        beats.push(
          makeBeat(seed, idx++, half, start, end, 'play_long_shot', 0.38 + 0.14 * rnd(seed, idx), [
            {
              playerRef: 'mid',
              targetUx: 52 + rnd(seed, idx) * 14,
              targetUy: 40 + rnd(seed, idx + 2) * 22,
              tacticalIntent: TacticalIntent.FinalThird,
            },
          ]),
        );
      }
    } else if (roll < 0.5) {
      beats.push(
        makeBeat(
          seed,
          idx++,
          half,
          start,
          end,
          rnd(seed, idx + 4096) < 0.5 ? 'foul_home' : 'foul_away',
          0.22 + 0.12 * rnd(seed, idx),
          [
            {
              playerRef: 'mid',
              targetUx: 50 + rnd(seed, idx) * 8,
              targetUy: 48 + rnd(seed, idx + 1) * 12,
              tacticalIntent: TacticalIntent.Recover,
            },
          ],
        ),
      );
    } else if (roll < 0.58 * cardMul) {
      beats.push(
        makeBeat(
          seed,
          idx++,
          half,
          start,
          end,
          rnd(seed, idx) < 0.5 ? 'card_risk_home' : 'card_risk_away',
          0.2 + 0.15 * rnd(seed, idx),
        ),
      );
    } else if (roll < 0.68) {
      beats.push(
        makeBeat(seed, idx++, half, start, end, 'shape', 0.25, [
          { playerRef: 'line', targetUx: 50, targetUy: 50, tacticalIntent: TacticalIntent.HoldShape },
        ]),
      );
    } else {
      beats.push(
        makeBeat(seed, idx++, half, start, end, 'narrative', 0.15 + 0.1 * rnd(seed, idx), [
          { playerRef: 'team', targetUx: 52, targetUy: 48 + rnd(seed, idx) * 20, tacticalIntent: TacticalIntent.BuildUp },
        ]),
      );
    }
  }

  const id = `story-h${half}-${Date.now().toString(36)}-${seed.toString(16)}`;
  return {
    id,
    half,
    beats,
    createdAtMs: Date.now(),
    variationSeed: seed,
  };
}

export function countBeatDifferences(a: StoryTimeline, b: StoryTimeline): number {
  const ka = new Set(a.beats.map((x) => `${x.kind}-${x.minuteStart}`));
  const kb = new Set(b.beats.map((x) => `${x.kind}-${x.minuteStart}`));
  let diff = 0;
  for (const x of ka) if (!kb.has(x)) diff++;
  for (const x of kb) if (!ka.has(x)) diff++;
  return diff;
}
