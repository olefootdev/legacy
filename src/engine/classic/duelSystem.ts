/**
 * DuelSystem — sistema de duelos completo para o engine CLASSIC.
 * Cobre o campo inteiro: cada ação importante pode gerar oposição baseada em atributos.
 * Um duelo principal por jogada, um defensor primário, resultado baseado em atributos.
 */

import type { ClassicPlayer, ArchetypeId, EventChainContext, MatchScore } from './types';
import { ARCHETYPES } from './archetypes';
import { FIELD_W_LOGIC, FIELD_H_LOGIC } from './formations';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type DuelKind =
  | 'dribble'
  | 'passing'
  | 'physical'
  | 'sprint'
  | 'aerial'
  | 'shot_block'
  | 'keeper'
  | 'press_resistance';

export type DuelOutcome =
  | 'successful_dribble'
  | 'tackle_won'
  | 'interception'
  | 'foul'
  | 'yellow_card'
  | 'red_card'
  | 'forced_back_pass'
  | 'forced_bad_pass'
  | 'progressive_pass_completed'
  | 'cross_blocked'
  | 'aerial_win_attacker'
  | 'aerial_win_defender'
  | 'blocked_shot'
  | 'shot_under_pressure'
  | 'keeper_save'
  | 'keeper_beaten'
  | 'chance_created'
  | 'possession_retained'
  | 'possession_lost';

export type FieldZone = 'defensive' | 'midfield' | 'lateral' | 'final_third' | 'box' | 'six_yard';

export interface DuelContext {
  attacker: ClassicPlayer;
  defender: ClassicPlayer;
  kind: DuelKind;
  zone: FieldZone;
  minute: number;
  ballPos: { x: number; y: number };
  chain: EventChainContext | null;
  score: MatchScore;
}

export interface DuelResult {
  outcome: DuelOutcome;
  winner: 'attacker' | 'defender';
  attackerScore: number;
  defenderScore: number;
  shouldNarrate: boolean;
  foulSeverity?: 'none' | 'foul' | 'yellow' | 'red';
  log: string;
}

export type DuelTrigger =
  | 'pass_under_pressure'
  | 'pressured_reception'
  | 'ball_progression'
  | 'dribble_attempt'
  | 'interception_chance'
  | 'cross_attempt'
  | 'aerial_contest'
  | 'shot_block_attempt'
  | 'one_on_one_keeper'
  | 'post_loss_press';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rng(): number { return Math.random(); }

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function norm(v: number): number { return clamp(v / 100, 0, 1); }

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function fatigueModifier(fatigue: number): number {
  if (fatigue < 40) return 1.0;
  if (fatigue < 60) return 0.95;
  if (fatigue < 75) return 0.88;
  if (fatigue < 85) return 0.78;
  return 0.65;
}

function confidenceModifier(confidence: number, onFire?: boolean): number {
  const base = 0.85 + (confidence / 100) * 0.30;
  return onFire ? base * 1.12 : base;
}

// ─── Bônus de arquétipo por tipo de duelo ────────────────────────────────────

const ARCHETYPE_ATTACK_BONUS: Record<ArchetypeId, Partial<Record<DuelKind, number>>> = {
  FINISHER:    { shot_block: 0.12, keeper: 0.15, aerial: 0.06 },
  MAESTRO:     { passing: 0.14, press_resistance: 0.12 },
  HUNTER:      { press_resistance: -0.06, sprint: 0.08, physical: 0.04 },
  ENGINE:      { press_resistance: 0.08, physical: 0.06, sprint: 0.04 },
  COLD_BLOOD:  { keeper: 0.14, shot_block: 0.10, press_resistance: 0.08 },
  DESTROYER:   { physical: 0.12, aerial: 0.08 },
  VETERAN:     { passing: 0.10, press_resistance: 0.10 },
  WILD:        { dribble: 0.14, sprint: 0.10, shot_block: 0.06 },
  BOX_INVADER: { aerial: 0.14, physical: 0.10, shot_block: 0.08 },
};

const ARCHETYPE_DEFEND_BONUS: Record<ArchetypeId, Partial<Record<DuelKind, number>>> = {
  FINISHER:    {},
  MAESTRO:     { passing: 0.06 },
  HUNTER:      { press_resistance: 0.12, sprint: 0.10, physical: 0.06 },
  ENGINE:      { press_resistance: 0.06, physical: 0.04, sprint: 0.04 },
  COLD_BLOOD:  {},
  DESTROYER:   { physical: 0.14, dribble: 0.12, shot_block: 0.10, aerial: 0.08 },
  VETERAN:     { passing: 0.08, aerial: 0.06 },
  WILD:        { physical: 0.06 },
  BOX_INVADER: { aerial: 0.10, physical: 0.06 },
};

// ─── Zona do campo ───────────────────────────────────────────────────────────

export function classifyFieldZone(
  ballPos: { x: number; y: number },
  team: 'home' | 'away',
): FieldZone {
  const xRel = team === 'home'
    ? ballPos.x / FIELD_W_LOGIC
    : 1 - ballPos.x / FIELD_W_LOGIC;

  const inFlank = ballPos.y < 80 || ballPos.y > FIELD_H_LOGIC - 80;

  if (xRel >= 0.88) return 'six_yard';
  if (xRel >= 0.78) return 'box';
  if (xRel >= 0.66) return inFlank ? 'lateral' : 'final_third';
  if (xRel <= 0.34) return 'defensive';
  return inFlank ? 'lateral' : 'midfield';
}

// ─── Scoring por tipo de duelo ───────────────────────────────────────────────

function scoreDribbleDuel(attacker: ClassicPlayer, defender: ClassicPlayer): { att: number; def: number } {
  const att =
    norm(attacker.ovr) * 0.20 +
    norm(attacker.ovr + 8) * 0.18 +  // proxy dribble (ovr + archetype)
    norm(attacker.ovr + 4) * 0.14 +  // proxy agility
    norm(attacker.ovr) * 0.12 +      // technique
    confidenceModifier(attacker.confidence, attacker.onFire) * 0.20 +
    fatigueModifier(attacker.fatigue) * 0.16;

  const def =
    norm(defender.ovr + 6) * 0.22 +  // marking
    norm(defender.ovr + 4) * 0.20 +  // tackle
    norm(defender.ovr) * 0.16 +      // anticipation
    norm(defender.ovr + 2) * 0.14 +  // positioning
    confidenceModifier(defender.confidence, defender.onFire) * 0.14 +
    fatigueModifier(defender.fatigue) * 0.14;

  return { att, def };
}

function scorePassingDuel(attacker: ClassicPlayer, defender: ClassicPlayer): { att: number; def: number } {
  const att =
    norm(attacker.ovr + 6) * 0.28 +  // passing
    norm(attacker.ovr + 4) * 0.22 +  // vision
    norm(attacker.ovr) * 0.18 +      // composure
    confidenceModifier(attacker.confidence, attacker.onFire) * 0.18 +
    fatigueModifier(attacker.fatigue) * 0.14;

  const def =
    norm(defender.ovr + 4) * 0.26 +  // anticipation
    norm(defender.ovr + 6) * 0.24 +  // interception
    norm(defender.ovr + 2) * 0.18 +  // positioning
    confidenceModifier(defender.confidence, defender.onFire) * 0.16 +
    fatigueModifier(defender.fatigue) * 0.16;

  return { att, def };
}

function scorePhysicalDuel(attacker: ClassicPlayer, defender: ClassicPlayer): { att: number; def: number } {
  const att =
    norm(attacker.ovr + 4) * 0.30 +  // strength
    norm(attacker.ovr) * 0.22 +      // balance
    norm(attacker.ovr + 2) * 0.18 +  // ball control
    confidenceModifier(attacker.confidence, attacker.onFire) * 0.16 +
    fatigueModifier(attacker.fatigue) * 0.14;

  const def =
    norm(defender.ovr + 6) * 0.28 +  // strength
    norm(defender.ovr + 4) * 0.22 +  // aggression
    norm(defender.ovr + 4) * 0.20 +  // tackle
    norm(defender.ovr) * 0.14 +      // balance
    fatigueModifier(defender.fatigue) * 0.16;

  return { att, def };
}

function scoreSprintDuel(attacker: ClassicPlayer, defender: ClassicPlayer): { att: number; def: number } {
  const att =
    norm(attacker.ovr + 6) * 0.32 +  // speed
    norm(attacker.ovr + 4) * 0.24 +  // acceleration
    norm(attacker.ovr) * 0.16 +      // stamina
    confidenceModifier(attacker.confidence, attacker.onFire) * 0.14 +
    fatigueModifier(attacker.fatigue) * 0.14;

  const def =
    norm(defender.ovr + 4) * 0.30 +  // speed
    norm(defender.ovr + 2) * 0.22 +  // anticipation
    norm(defender.ovr + 2) * 0.20 +  // positioning
    norm(defender.ovr) * 0.12 +      // stamina
    fatigueModifier(defender.fatigue) * 0.16;

  return { att, def };
}

function scoreAerialDuel(attacker: ClassicPlayer, defender: ClassicPlayer): { att: number; def: number } {
  const att =
    norm(attacker.ovr + 4) * 0.28 +  // heading
    norm(attacker.ovr + 6) * 0.24 +  // jumping
    norm(attacker.ovr + 2) * 0.20 +  // strength
    norm(attacker.ovr) * 0.14 +      // timing
    fatigueModifier(attacker.fatigue) * 0.14;

  const def =
    norm(defender.ovr + 4) * 0.26 +  // heading
    norm(defender.ovr + 6) * 0.24 +  // jumping
    norm(defender.ovr + 2) * 0.22 +  // marking
    norm(defender.ovr) * 0.14 +      // positioning
    fatigueModifier(defender.fatigue) * 0.14;

  return { att, def };
}

function scoreShotBlockDuel(attacker: ClassicPlayer, defender: ClassicPlayer): { att: number; def: number } {
  const att =
    norm(attacker.ovr + 8) * 0.30 +  // finishing
    norm(attacker.ovr + 4) * 0.24 +  // shot power
    norm(attacker.ovr + 2) * 0.20 +  // composure
    confidenceModifier(attacker.confidence, attacker.onFire) * 0.14 +
    fatigueModifier(attacker.fatigue) * 0.12;

  const def =
    norm(defender.ovr + 4) * 0.28 +  // positioning
    norm(defender.ovr + 2) * 0.24 +  // reaction
    norm(defender.ovr + 6) * 0.22 +  // block
    norm(defender.ovr) * 0.14 +      // bravery
    fatigueModifier(defender.fatigue) * 0.12;

  return { att, def };
}

function scoreKeeperDuel(attacker: ClassicPlayer, keeper: ClassicPlayer): { att: number; def: number } {
  const att =
    norm(attacker.ovr + 8) * 0.30 +  // finishing
    norm(attacker.ovr + 4) * 0.26 +  // composure
    norm(attacker.ovr + 2) * 0.20 +  // placement
    confidenceModifier(attacker.confidence, attacker.onFire) * 0.14 +
    fatigueModifier(attacker.fatigue) * 0.10;

  const def =
    norm(keeper.ovr + 8) * 0.28 +  // reflex
    norm(keeper.ovr + 6) * 0.24 +  // positioning
    norm(keeper.ovr + 4) * 0.22 +  // one on one
    norm(keeper.ovr + 2) * 0.16 +  // reaction
    fatigueModifier(keeper.fatigue) * 0.10;

  return { att, def };
}

function scorePressResistanceDuel(attacker: ClassicPlayer, defender: ClassicPlayer): { att: number; def: number } {
  const att =
    norm(attacker.ovr + 4) * 0.26 +  // ball control
    norm(attacker.ovr + 2) * 0.22 +  // composure
    norm(attacker.ovr + 4) * 0.20 +  // technique
    norm(attacker.ovr + 2) * 0.16 +  // passing
    fatigueModifier(attacker.fatigue) * 0.16;

  const def =
    norm(defender.ovr + 6) * 0.28 +  // pressing
    norm(defender.ovr + 4) * 0.22 +  // aggression
    norm(defender.ovr + 2) * 0.20 +  // marking
    norm(defender.ovr) * 0.14 +      // stamina
    fatigueModifier(defender.fatigue) * 0.16;

  return { att, def };
}

// ─── Resolução central ───────────────────────────────────────────────────────

function computeScores(ctx: DuelContext): { att: number; def: number } {
  switch (ctx.kind) {
    case 'dribble': return scoreDribbleDuel(ctx.attacker, ctx.defender);
    case 'passing': return scorePassingDuel(ctx.attacker, ctx.defender);
    case 'physical': return scorePhysicalDuel(ctx.attacker, ctx.defender);
    case 'sprint': return scoreSprintDuel(ctx.attacker, ctx.defender);
    case 'aerial': return scoreAerialDuel(ctx.attacker, ctx.defender);
    case 'shot_block': return scoreShotBlockDuel(ctx.attacker, ctx.defender);
    case 'keeper': return scoreKeeperDuel(ctx.attacker, ctx.defender);
    case 'press_resistance': return scorePressResistanceDuel(ctx.attacker, ctx.defender);
  }
}

function applyArchetypeBonus(base: number, archetype: ArchetypeId, kind: DuelKind, side: 'attack' | 'defend'): number {
  const table = side === 'attack' ? ARCHETYPE_ATTACK_BONUS : ARCHETYPE_DEFEND_BONUS;
  const bonus = table[archetype]?.[kind] ?? 0;
  return base + bonus;
}

function applyZoneModifier(attScore: number, defScore: number, zone: FieldZone, kind: DuelKind): { att: number; def: number } {
  let att = attScore;
  let def = defScore;

  if (zone === 'box' || zone === 'six_yard') {
    if (kind === 'shot_block' || kind === 'keeper') att += 0.04;
    if (kind === 'physical') def += 0.04;
  }
  if (zone === 'defensive') {
    def += 0.03;
  }
  if (zone === 'lateral') {
    if (kind === 'sprint' || kind === 'dribble') att += 0.03;
  }
  if (zone === 'midfield') {
    if (kind === 'passing' || kind === 'press_resistance') att += 0.02;
  }

  return { att, def };
}

function determineFoul(defScore: number, attScore: number, defender: ClassicPlayer, zone: FieldZone): 'none' | 'foul' | 'yellow' | 'red' {
  const delta = attScore - defScore;
  if (delta <= 0) return 'none';

  const cfg = ARCHETYPES[defender.archetype];
  const foulBase = cfg.foulFreq * 0.35;
  const desperation = delta * 0.25;
  const fatiguePush = defender.fatigue > 70 ? 0.08 : 0;
  const foulChance = foulBase + desperation + fatiguePush;

  if (rng() >= foulChance) return 'none';

  const yellowChance = zone === 'box' ? 0.55 : zone === 'final_third' ? 0.35 : 0.20;
  const redChance = zone === 'box' ? 0.06 : zone === 'six_yard' ? 0.10 : 0.02;

  const r = rng();
  if (r < redChance) return 'red';
  if (r < redChance + yellowChance) return 'yellow';
  return 'foul';
}

function mapOutcome(winner: 'attacker' | 'defender', kind: DuelKind, zone: FieldZone, foul: 'none' | 'foul' | 'yellow' | 'red'): DuelOutcome {
  if (foul === 'red') return 'red_card';
  if (foul === 'yellow') return 'yellow_card';
  if (foul === 'foul') return 'foul';

  if (winner === 'attacker') {
    switch (kind) {
      case 'dribble': return 'successful_dribble';
      case 'passing': return 'progressive_pass_completed';
      case 'physical': return 'possession_retained';
      case 'sprint': return 'chance_created';
      case 'aerial': return 'aerial_win_attacker';
      case 'shot_block': return 'shot_under_pressure';
      case 'keeper': return 'keeper_beaten';
      case 'press_resistance': return 'progressive_pass_completed';
    }
  }

  // Defender wins
  switch (kind) {
    case 'dribble': return 'tackle_won';
    case 'passing': return 'interception';
    case 'physical': return 'possession_lost';
    case 'sprint': return 'possession_lost';
    case 'aerial': return 'aerial_win_defender';
    case 'shot_block': return 'blocked_shot';
    case 'keeper': return 'keeper_save';
    case 'press_resistance': return zone === 'defensive' ? 'forced_back_pass' : 'forced_bad_pass';
  }
}

function shouldNarrateDuel(outcome: DuelOutcome, zone: FieldZone): boolean {
  const alwaysNarrate: DuelOutcome[] = [
    'foul', 'yellow_card', 'red_card', 'keeper_beaten', 'keeper_save',
    'blocked_shot', 'chance_created', 'successful_dribble',
  ];
  if (alwaysNarrate.includes(outcome)) return true;
  if (zone === 'box' || zone === 'six_yard') return true;
  if (outcome === 'tackle_won' || outcome === 'interception') return rng() < 0.55;
  if (outcome === 'aerial_win_attacker' || outcome === 'aerial_win_defender') return rng() < 0.45;
  return rng() < 0.25;
}

export function resolveDuel(ctx: DuelContext): DuelResult {
  let { att, def } = computeScores(ctx);

  att = applyArchetypeBonus(att, ctx.attacker.archetype, ctx.kind, 'attack');
  def = applyArchetypeBonus(def, ctx.defender.archetype, ctx.kind, 'defend');

  const zoned = applyZoneModifier(att, def, ctx.zone, ctx.kind);
  att = zoned.att;
  def = zoned.def;

  // Controlled randomness: ±8% swing — attributes dominate
  const noise = (rng() - 0.5) * 0.16;
  const finalDelta = (att - def) + noise;

  const winner: 'attacker' | 'defender' = finalDelta >= 0 ? 'attacker' : 'defender';
  const foul = winner === 'defender' ? 'none' : determineFoul(def, att, ctx.defender, ctx.zone);
  const outcome = mapOutcome(foul !== 'none' ? 'defender' : winner, ctx.kind, ctx.zone, foul);
  const narrate = shouldNarrateDuel(outcome, ctx.zone);

  const attScoreDisplay = Math.round(att * 100);
  const defScoreDisplay = Math.round(def * 100);
  const log = `[Duel] ${ctx.kind} | ${ctx.attacker.shortName} vs ${ctx.defender.shortName} | att: ${attScoreDisplay} | def: ${defScoreDisplay} | result: ${outcome}`;

  return {
    outcome,
    winner: foul !== 'none' ? 'attacker' : winner,
    attackerScore: attScoreDisplay,
    defenderScore: defScoreDisplay,
    shouldNarrate: narrate,
    foulSeverity: foul,
    log,
  };
}

// ─── Encontrar defensor primário ─────────────────────────────────────────────

export function findPrimaryDefender(
  ballHolder: ClassicPlayer,
  allPlayers: ClassicPlayer[],
  maxDist = 80,
): ClassicPlayer | null {
  const opponents = allPlayers.filter(p => p.team !== ballHolder.team);
  let best: ClassicPlayer | null = null;
  let bestScore = -Infinity;

  for (const o of opponents) {
    const d = distance(ballHolder.position, o.position);
    if (d > maxDist) continue;
    if (o.role === 'GK') continue;

    const isDefender = o.role === 'CB' || o.role === 'LB' || o.role === 'RB' || o.role === 'DM';
    const roleBonus = isDefender ? 15 : 0;
    const score = (maxDist - d) + roleBonus + (o.confidence * 0.1);
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

export function findKeeper(allPlayers: ClassicPlayer[], team: 'home' | 'away'): ClassicPlayer | null {
  return allPlayers.find(p => p.team === team && p.role === 'GK') ?? null;
}

// ─── Detecção de gatilhos ────────────────────────────────────────────────────

export interface DuelTriggerCheck {
  trigger: DuelTrigger;
  kind: DuelKind;
  probability: number;
}

export function detectDuelTriggers(
  ballHolder: ClassicPlayer,
  allPlayers: ClassicPlayer[],
  eventType: string,
  zone: FieldZone,
  chain: EventChainContext | null,
): DuelTriggerCheck[] {
  const triggers: DuelTriggerCheck[] = [];
  const defender = findPrimaryDefender(ballHolder, allPlayers);
  if (!defender && eventType !== 'shot') return triggers;

  const dist = defender ? distance(ballHolder.position, defender.position) : 999;
  const isClose = dist < 55;
  const isVeryClose = dist < 35;

  // 1. Passe sob pressão
  if ((eventType === 'pass' || eventType === 'cross') && isClose) {
    triggers.push({
      trigger: 'pass_under_pressure',
      kind: 'passing',
      probability: isVeryClose ? 0.55 : 0.30,
    });
  }

  // 2. Recepção pressionada (receptor com marcador)
  if (eventType === 'pass' && isVeryClose) {
    triggers.push({
      trigger: 'pressured_reception',
      kind: 'press_resistance',
      probability: 0.35,
    });
  }

  // 3. Progressão com bola
  if (eventType === 'pass' && isClose && (zone === 'midfield' || zone === 'final_third')) {
    triggers.push({
      trigger: 'ball_progression',
      kind: 'physical',
      probability: 0.25,
    });
  }

  // 4. Drible
  if (isVeryClose && (zone === 'lateral' || zone === 'final_third' || zone === 'box')) {
    triggers.push({
      trigger: 'dribble_attempt',
      kind: 'dribble',
      probability: zone === 'box' ? 0.45 : 0.35,
    });
  }

  // 5. Interceptação
  if ((eventType === 'pass' || eventType === 'cross') && isClose) {
    triggers.push({
      trigger: 'interception_chance',
      kind: 'passing',
      probability: 0.22,
    });
  }

  // 6. Cruzamento
  if (eventType === 'cross' && isClose) {
    triggers.push({
      trigger: 'cross_attempt',
      kind: zone === 'lateral' ? 'sprint' : 'physical',
      probability: 0.40,
    });
  }

  // 7. Bola aérea
  if (eventType === 'cross' || eventType === 'corner' || (chain?.lastType === 'cross')) {
    triggers.push({
      trigger: 'aerial_contest',
      kind: 'aerial',
      probability: 0.50,
    });
  }

  // 8. Finalização bloqueada
  if (eventType === 'shot' && defender && dist < 50) {
    triggers.push({
      trigger: 'shot_block_attempt',
      kind: 'shot_block',
      probability: zone === 'box' ? 0.40 : 0.30,
    });
  }

  // 9. Um contra um com goleiro
  if (eventType === 'shot' && (zone === 'box' || zone === 'six_yard')) {
    triggers.push({
      trigger: 'one_on_one_keeper',
      kind: 'keeper',
      probability: 0.60,
    });
  }

  // 10. Pressão pós-perda
  if (chain?.lastType === 'interception' || chain?.lastType === 'tackle') {
    triggers.push({
      trigger: 'post_loss_press',
      kind: 'press_resistance',
      probability: 0.35,
    });
  }

  return triggers;
}

// ─── Seleção do duelo principal (um por jogada) ──────────────────────────────

export function selectPrimaryDuel(triggers: DuelTriggerCheck[]): DuelTriggerCheck | null {
  if (triggers.length === 0) return null;

  // Filtra por probabilidade — cada gatilho rola seu dado
  const fired = triggers.filter(t => rng() < t.probability);
  if (fired.length === 0) return null;

  // Prioridade: keeper > shot_block > aerial > dribble > passing > physical > sprint > press_resistance
  const priority: DuelKind[] = ['keeper', 'shot_block', 'aerial', 'dribble', 'passing', 'physical', 'sprint', 'press_resistance'];
  fired.sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind));

  return fired[0];
}

// ─── API pública: resolve duelo completo a partir do estado do jogo ──────────

export interface DuelInput {
  ballHolder: ClassicPlayer;
  allPlayers: ClassicPlayer[];
  eventType: string;
  team: 'home' | 'away';
  ballPos: { x: number; y: number };
  minute: number;
  chain: EventChainContext | null;
  score: MatchScore;
}

export function tryResolveDuel(input: DuelInput): DuelResult | null {
  const zone = classifyFieldZone(input.ballPos, input.team);
  const triggers = detectDuelTriggers(
    input.ballHolder, input.allPlayers, input.eventType, zone, input.chain,
  );

  const selected = selectPrimaryDuel(triggers);
  if (!selected) return null;

  let defender: ClassicPlayer | null;
  if (selected.kind === 'keeper') {
    const opposingTeam: 'home' | 'away' = input.team === 'home' ? 'away' : 'home';
    defender = findKeeper(input.allPlayers, opposingTeam);
  } else {
    defender = findPrimaryDefender(input.ballHolder, input.allPlayers);
  }

  if (!defender) return null;

  const ctx: DuelContext = {
    attacker: input.ballHolder,
    defender,
    kind: selected.kind,
    zone,
    minute: input.minute,
    ballPos: input.ballPos,
    chain: input.chain,
    score: input.score,
  };

  return resolveDuel(ctx);
}
