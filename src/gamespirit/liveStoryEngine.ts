import type { Beat, StoryTimeline, StoryWeights } from './storyContracts';
import type { MatchEventEntry } from '@/engine/types';
import {
  injectAway,
  injectName,
  pickAwayBlockLine,
  pickBuildUpLine,
  pickChanceSaveExtra,
  pickCrossLine,
  pickDribbleLine,
  pickFoulAwayLine,
  pickFoulHomeLine,
  pickFoulLine,
  pickFreeKickWallLine,
  pickLongShotFollow,
  pickLongShotLine,
  pickPressLine,
  pickShapeLine,
} from './storyNarrativeCatalog';

export interface StoryEnginePlayerBrief {
  playerId: string;
  name: string;
  role: string;
}

export interface StoryEngineStepResult {
  homeScoreDelta: number;
  awayScoreDelta: number;
  newEvents: MatchEventEntry[];
  updatedFirstHalfBeats?: Beat[];
  updatedSecondHalfBeats?: Beat[];
  spiritPendingRestartSide?: 'home' | 'away';
  redCardHomePlayerId?: string;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function rng01(seed: number, a: number, b: number): number {
  let x = Math.floor(seed + a * 0x9e3779b1 + b * 0x517cc1b7) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xffffffff;
}

function cloneBeats(beats: Beat[]): Beat[] {
  return beats.map((b) => ({ ...b, hints: b.hints?.map((h) => ({ ...h })) }));
}

function pickHomeOutfieldForCard(homePlayerIds: string[]): string | undefined {
  return homePlayerIds.find(() => true);
}

function narr(minute: number, text: string): MatchEventEntry {
  return { id: uid(), minute, text, kind: 'narrative' };
}

function pickName(
  roster: StoryEnginePlayerBrief[],
  role: 'attack' | 'mid' | 'def' | 'any',
  seed: number,
  salt: number,
): string {
  let pool = roster.filter((p) => p.role !== 'gk');
  if (role !== 'any') pool = pool.filter((p) => p.role === role);
  if (!pool.length) pool = roster.filter((p) => p.role !== 'gk');
  if (!pool.length) return 'OLE';
  const j = Math.floor(rng01(seed, salt, 901) * pool.length);
  return pool[j]!.name;
}

/**
 * Um passo do motor de história no minuto de jogo indicado.
 * Budget: O(beats); narração rica (dribles, cruzamentos, remates longe, faltas, cartões).
 */
export function stepLiveStoryEngine(input: {
  displayMinute: number;
  timelineFirst: StoryTimeline;
  timelineSecond?: StoryTimeline;
  activeHalf: 1 | 2;
  weights: StoryWeights;
  simulationSeed: number;
  homeOutfieldIds: string[];
  homePlayersBrief: StoryEnginePlayerBrief[];
  awayShort: string;
}): StoryEngineStepResult {
  const {
    displayMinute,
    activeHalf,
    weights,
    simulationSeed,
    homeOutfieldIds,
    homePlayersBrief,
    awayShort,
  } = input;
  const tl = activeHalf === 1 ? input.timelineFirst : input.timelineSecond ?? input.timelineFirst;
  const beats = cloneBeats(tl.beats);

  let homeScoreDelta = 0;
  let awayScoreDelta = 0;
  const newEvents: MatchEventEntry[] = [];
  let spiritPendingRestartSide: 'home' | 'away' | undefined;
  let redCardHomePlayerId: string | undefined;

  const roster = homePlayersBrief.length ? homePlayersBrief : homeOutfieldIds.map((id) => ({ playerId: id, name: 'OLE', role: 'mid' }));

  let i = 0;
  for (const beat of beats) {
    if (beat.resolved) {
      i++;
      continue;
    }
    if (displayMinute !== beat.minuteStart) {
      i++;
      continue;
    }

    const r = rng01(simulationSeed, displayMinute, i + beat.id.length);
    const r2 = rng01(simulationSeed, displayMinute + 1, i + beat.id.length * 3);

    switch (beat.kind) {
      case 'chance_home': {
        const p =
          0.055 +
          beat.intensity01 * 0.11 * weights.chanceRate +
          (weights.duelIntensity - 1) * 0.02;
        if (r < p) {
          homeScoreDelta += 1;
          beat.outcomeTag = 'goal_home';
          beat.resolved = true;
          newEvents.push({
            id: uid(),
            minute: displayMinute,
            text: `${displayMinute}' — GOL! A casa empurra a Neo Arena.`,
            kind: 'goal_home',
          });
          spiritPendingRestartSide = 'home';
        } else if (r < p + 0.18) {
          beat.outcomeTag = 'save';
          beat.resolved = true;
          newEvents.push(
            narr(displayMinute, `${displayMinute}' — Grande defesa do guarda-redes visitante.`),
          );
          if (r2 < 0.55) {
            newEvents.push(
              narr(displayMinute, `${displayMinute}' — ${pickChanceSaveExtra(simulationSeed, displayMinute)}`),
            );
          }
        } else {
          beat.outcomeTag = 'wide';
          beat.resolved = true;
          if (r2 < 0.45) {
            newEvents.push(
              narr(
                displayMinute,
                `${displayMinute}' — Remate da casa por cima — ${pickName(roster, 'attack', simulationSeed, i)} esteve perto.`,
              ),
            );
          }
        }
        break;
      }
      case 'chance_away': {
        const p =
          0.048 +
          beat.intensity01 * 0.1 * weights.chanceRate +
          (weights.duelIntensity - 1) * 0.018;
        if (r < p) {
          awayScoreDelta += 1;
          beat.outcomeTag = 'goal_away';
          beat.resolved = true;
          newEvents.push({
            id: uid(),
            minute: displayMinute,
            text: `${displayMinute}' — Golo dos visitantes. Silêncio na arena.`,
            kind: 'goal_away',
          });
          spiritPendingRestartSide = 'away';
        } else {
          beat.outcomeTag = 'blocked';
          beat.resolved = true;
          if (r2 < 0.72) {
            newEvents.push(
              narr(
                displayMinute,
                `${displayMinute}' — ${pickAwayBlockLine(simulationSeed, displayMinute)}`,
              ),
            );
          }
        }
        break;
      }
      case 'play_dribble': {
        beat.resolved = true;
        beat.outcomeTag = 'dribble_show';
        const name = pickName(roster, 'attack', simulationSeed, i);
        newEvents.push(
          narr(
            displayMinute,
            `${displayMinute}' — ${injectName(pickDribbleLine(simulationSeed, displayMinute, i), name)}`,
          ),
        );
        break;
      }
      case 'play_cross': {
        beat.resolved = true;
        beat.outcomeTag = 'cross';
        const name = pickName(roster, 'attack', simulationSeed, i + 2);
        newEvents.push(
          narr(
            displayMinute,
            `${displayMinute}' — ${injectName(pickCrossLine(simulationSeed, displayMinute, i), name)}`,
          ),
        );
        if (r2 < 0.35) {
          newEvents.push(
            narr(
              displayMinute,
              `${displayMinute}' — Segunda vaga: sobra na frontal para o remate.`,
            ),
          );
        }
        break;
      }
      case 'play_long_shot': {
        beat.resolved = true;
        beat.outcomeTag = 'long_shot';
        const name = pickName(roster, r2 < 0.5 ? 'mid' : 'attack', simulationSeed, i + 4);
        newEvents.push(
          narr(
            displayMinute,
            `${displayMinute}' — ${injectName(pickLongShotLine(simulationSeed, displayMinute, i), name)}`,
          ),
        );
        const r3 = rng01(simulationSeed, displayMinute + 2, i + 11);
        if (r3 < 0.38) {
          newEvents.push(
            narr(
              displayMinute,
              `${displayMinute}' — ${pickLongShotFollow(simulationSeed, displayMinute, 'save')}`,
            ),
          );
        } else if (r3 < 0.78) {
          newEvents.push(
            narr(
              displayMinute,
              `${displayMinute}' — ${pickLongShotFollow(simulationSeed, displayMinute, 'wide')}`,
            ),
          );
        }
        break;
      }
      case 'foul_home': {
        beat.resolved = true;
        beat.outcomeTag = 'foul_home';
        const name = pickName(roster, 'any', simulationSeed, i + 6);
        newEvents.push(
          narr(
            displayMinute,
            `${displayMinute}' — ${injectAway(injectName(pickFoulHomeLine(simulationSeed, displayMinute, i), name), awayShort)}`,
          ),
        );
        if (r2 < 0.55) {
          newEvents.push(
            narr(
              displayMinute,
              `${displayMinute}' — ${pickFreeKickWallLine(simulationSeed, displayMinute)}`,
            ),
          );
        }
        break;
      }
      case 'foul_away': {
        beat.resolved = true;
        beat.outcomeTag = 'foul_away';
        const name = pickName(roster, 'mid', simulationSeed, i + 8);
        newEvents.push(
          narr(
            displayMinute,
            `${displayMinute}' — ${injectAway(injectName(pickFoulAwayLine(simulationSeed, displayMinute, i), name), awayShort)}`,
          ),
        );
        if (r2 < 0.45) {
          newEvents.push(
            narr(
              displayMinute,
              `${displayMinute}' — ${pickFoulLine(simulationSeed, displayMinute, i + 99)}`,
            ),
          );
        }
        break;
      }
      case 'card_risk_home': {
        if (r < 0.38) {
          newEvents.push(
            narr(
              displayMinute,
              `${displayMinute}' — ${pickFoulLine(simulationSeed, displayMinute, i + 501)}`,
            ),
          );
        }
        const p = 0.04 + beat.intensity01 * 0.12 * weights.cardPressure;
        const rCard = rng01(simulationSeed, displayMinute + 3, i + 701);
        if (rCard < p * 0.45) {
          const pid = pickHomeOutfieldForCard(homeOutfieldIds);
          beat.outcomeTag = 'red_home';
          beat.resolved = true;
          redCardHomePlayerId = pid;
          newEvents.push(
            narr(displayMinute, `${displayMinute}' — Cartão vermelho direto para OLE FC.`),
          );
        } else if (rCard < p) {
          beat.outcomeTag = 'yellow_home';
          beat.resolved = true;
          newEvents.push(
            narr(displayMinute, `${displayMinute}' — Cartão amarelo para OLE FC.`),
          );
        } else {
          beat.outcomeTag = 'no_card';
          beat.resolved = true;
        }
        break;
      }
      case 'card_risk_away': {
        if (r < 0.38) {
          newEvents.push(
            narr(
              displayMinute,
              `${displayMinute}' — ${injectAway(pickFoulLine(simulationSeed, displayMinute, i + 601), awayShort)}`,
            ),
          );
        }
        const p = 0.04 + beat.intensity01 * 0.11 * weights.cardPressure;
        const rCard = rng01(simulationSeed, displayMinute + 4, i + 801);
        if (rCard < p * 0.4) {
          beat.outcomeTag = 'red_away';
          beat.resolved = true;
          newEvents.push(
            narr(displayMinute, `${displayMinute}' — Expulsão na equipa visitante.`),
          );
        } else if (rCard < p) {
          beat.outcomeTag = 'yellow_away';
          beat.resolved = true;
          newEvents.push(
            narr(displayMinute, `${displayMinute}' — Amarelo para o adversário.`),
          );
        } else {
          beat.outcomeTag = 'no_card';
          beat.resolved = true;
        }
        break;
      }
      case 'press': {
        beat.resolved = true;
        beat.outcomeTag = 'press_narrative';
        if (r < 0.62) {
          newEvents.push(
            narr(
              displayMinute,
              `${displayMinute}' — ${injectAway(pickPressLine(simulationSeed, displayMinute), awayShort)}`,
            ),
          );
        }
        break;
      }
      case 'shape': {
        beat.resolved = true;
        beat.outcomeTag = 'shape_narrative';
        if (r < 0.55) {
          newEvents.push(
            narr(displayMinute, `${displayMinute}' — ${pickShapeLine(simulationSeed, displayMinute)}`),
          );
        }
        break;
      }
      case 'narrative': {
        beat.resolved = true;
        beat.outcomeTag = 'narrative_played';
        if (r < 0.58) {
          newEvents.push(
            narr(displayMinute, `${displayMinute}' — ${pickBuildUpLine(simulationSeed, displayMinute)}`),
          );
        }
        break;
      }
      default:
        beat.resolved = true;
        beat.outcomeTag = 'played';
        break;
    }
    i++;
  }

  const out: StoryEngineStepResult = {
    homeScoreDelta,
    awayScoreDelta,
    newEvents,
    spiritPendingRestartSide,
    redCardHomePlayerId,
  };
  if (activeHalf === 1) out.updatedFirstHalfBeats = beats;
  else out.updatedSecondHalfBeats = beats;
  return out;
}

export function withStoryBudgetMs<T>(budgetMs: number, fn: () => T): { ok: true; result: T } | { ok: false } {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const result = fn();
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (t1 - t0 > budgetMs) {
    console.warn(`[GameSpirit] story step exceeded budget ${budgetMs}ms (${(t1 - t0).toFixed(2)}ms)`);
  }
  return { ok: true, result };
}
