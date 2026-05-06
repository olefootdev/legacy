/**
 * Decision Engine — o jogador que recebe a bola PENSA antes de agir.
 *
 * Substitui o `pickPlayerForZone` aleatório por uma avaliação real:
 *   1. Quais companheiros estão livres? (freedom)
 *   2. Quais avançam o jogo? (progress)
 *   3. Quais tem chance de gol? (threat)
 *   4. Qual continua o buildup da equipe? (coherence)
 *
 * O arquétipo do portador modula os pesos: FINISHER prefere threat,
 * MAESTRO prefere progress+coherence, ENGINE prefere segurança, WILD arrisca.
 *
 * Sob pressão alta → passe rápido 1-toque. Sem pressão e na ala → cruzamento.
 * MAESTRO sem urgência → passe planejado. Goleiro tem lógica própria.
 *
 * É heurística, mas é heurística com cabeça — não é roleta.
 */

import type {
  ClassicPlayer,
  EventType,
  PassSubtype,
  EventChainContext,
  ManagerSkillId,
  PassStyle,
  MatchScore,
} from './types';
import { ARCHETYPES } from './archetypes';
import { FIELD_W_LOGIC, FIELD_H_LOGIC } from './formations';

// ─── Tipos internos ───────────────────────────────────────────────────────────

export interface FieldState {
  players: ClassicPlayer[];
  ballHolder: ClassicPlayer;
  attackDir: 1 | -1;       // +1 = HOME ataca direita; -1 = AWAY ataca esquerda
  sequence: { zones: string[]; styleKey: PassStyle } | null;
  zoneIndex: number;
  chain: EventChainContext | null;
  minute: number;
  score: MatchScore;
  activeSkills: ManagerSkillId[];
  passStyle: PassStyle;
}

export interface Decision {
  action: EventType;
  target?: ClassicPlayer;
  passSubtype?: PassSubtype;
  ballPos: { x: number; y: number };
  rationale: string;
}

// ─── Métricas de avaliação (puras, testáveis) ─────────────────────────────────

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToNearestOpponent(target: ClassicPlayer, opponents: ClassicPlayer[]): number {
  if (opponents.length === 0) return 999;
  let min = Infinity;
  for (const o of opponents) {
    const d = distance(target.position, o.position);
    if (d < min) min = d;
  }
  return min;
}

/** 0..1 — quanto mais distante do defensor mais perto, mais livre. */
export function computeFreedom(target: ClassicPlayer, opponents: ClassicPlayer[]): number {
  const dist = distanceToNearestOpponent(target, opponents);
  return Math.min(1, dist / 80);
}

/** 0..1 — passe avança o jogo na direção de ataque? */
export function computeProgress(target: ClassicPlayer, holder: ClassicPlayer, attackDir: 1 | -1): number {
  const delta = (target.position.x - holder.position.x) * attackDir;
  return Math.max(0, Math.min(1, (delta + 50) / 200));
}

/** 0..1 — receptor tem chance real de finalização? Baseado em distância ao gol e linha de chute. */
export function computeScoringThreat(
  target: ClassicPlayer,
  opponents: ClassicPlayer[],
  attackDir: 1 | -1,
): number {
  const goalX = attackDir > 0 ? FIELD_W_LOGIC - 30 : 30;
  const goalY = FIELD_H_LOGIC / 2;
  const distToGoal = distance(target.position, { x: goalX, y: goalY });
  if (distToGoal > 280) return 0;
  const closest = distanceToNearestOpponent(target, opponents);
  return Math.min(1, ((300 - distToGoal) / 300) * (closest / 60));
}

/** 0..1 — passe continua a sequência tática prevista? */
export function computePassCoherence(
  target: ClassicPlayer,
  zoneIndex: number,
  sequence: { zones: string[]; styleKey: PassStyle } | null,
  ZONE_ROLES: Record<string, string[]>,
): number {
  if (!sequence || zoneIndex >= sequence.zones.length - 1) return 0.5;
  const nextZone = sequence.zones[zoneIndex + 1];
  const preferred = ZONE_ROLES[nextZone] ?? [];
  return preferred.includes(target.role) ? 1.0 : 0.4;
}

/** Portador está pressionado por defensor a < 35px? */
export function isUnderPressure(holder: ClassicPlayer, opponents: ClassicPlayer[]): boolean {
  return distanceToNearestOpponent(holder, opponents) < 35;
}

/**
 * Linha de chute limpa? Projeta cada defensor sobre a linha portador→gol;
 * se algum estiver a < 25px perpendicular E entre os dois → bloqueado.
 */
export function hasCleanShot(
  holder: ClassicPlayer,
  opponents: ClassicPlayer[],
  attackDir: 1 | -1,
): boolean {
  const goalX = attackDir > 0 ? FIELD_W_LOGIC - 30 : 30;
  const goalY = FIELD_H_LOGIC / 2;
  const distToGoal = distance(holder.position, { x: goalX, y: goalY });
  if (distToGoal > 220) return false;

  const dx = goalX - holder.position.x;
  const dy = goalY - holder.position.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return true;

  for (const o of opponents) {
    if (o.role === 'GK') continue; // goleiro é parte da finalização
    const ox = o.position.x - holder.position.x;
    const oy = o.position.y - holder.position.y;
    const proj = (ox * dx + oy * dy) / len;
    if (proj < 25 || proj > len - 10) continue; // não está entre
    const perp = Math.abs(ox * dy - oy * dx) / len;
    if (perp < 22) return false; // bloqueio
  }
  return true;
}

/** Goal mouth oposto ao team. */
function goalMouthPos(team: 'home' | 'away'): { x: number; y: number } {
  return {
    x: team === 'home' ? FIELD_W_LOGIC - 30 : 30,
    y: FIELD_H_LOGIC / 2 + (Math.random() - 0.5) * 40,
  };
}

// ─── Decisão do goleiro ───────────────────────────────────────────────────────

/**
 * Goleiro com bola NÃO chuta no automático — pensa.
 * Se LB/RB livre → sai pelo pé. Se time PassStyle = LONGO → chutão.
 * Se pressionado e CMs livres → chutão pro meio.
 */
function decideGoalkeeperDistribution(
  gk: ClassicPlayer,
  teammates: ClassicPlayer[],
  opponents: ClassicPlayer[],
  passStyle: PassStyle,
): Decision {
  const lb = teammates.find(t => t.role === 'LB');
  const rb = teammates.find(t => t.role === 'RB');
  const lbFree = lb ? computeFreedom(lb, opponents) > 0.65 : false;
  const rbFree = rb ? computeFreedom(rb, opponents) > 0.65 : false;

  // Sair pela lateral (preferido em TIKTAK/LATERAL)
  if ((lbFree || rbFree) && passStyle !== 'LONGO') {
    const target = lbFree && rbFree
      ? (Math.random() < 0.5 ? lb! : rb!)
      : (lbFree ? lb! : rb!);
    return {
      action: 'pass',
      target,
      passSubtype: 'curto',
      ballPos: { x: target.position.x, y: target.position.y },
      rationale: `${gk.shortName} sai pelo pé — ${target.role} livre`,
    };
  }

  // Chutão pro meio — busca CM/DM livre
  const mids = teammates.filter(t => t.role === 'CM' || t.role === 'DM');
  const freeMid = mids
    .map(t => ({ p: t, free: computeFreedom(t, opponents) }))
    .sort((a, b) => b.free - a.free)[0];

  if (freeMid && freeMid.free > 0.4) {
    return {
      action: 'pass',
      target: freeMid.p,
      passSubtype: 'planejado',
      ballPos: { x: freeMid.p.position.x, y: freeMid.p.position.y },
      rationale: `${gk.shortName} chutão calculado para o meio`,
    };
  }

  // Fallback: chutão longo pro atacante mais à frente
  const fwd = teammates
    .filter(t => t.role === 'ST' || t.role === 'LW' || t.role === 'RW')
    .sort((a, b) => {
      const aRel = gk.team === 'home' ? a.position.x : (FIELD_W_LOGIC - a.position.x);
      const bRel = gk.team === 'home' ? b.position.x : (FIELD_W_LOGIC - b.position.x);
      return bRel - aRel;
    })[0];

  if (fwd) {
    return {
      action: 'pass',
      target: fwd,
      passSubtype: 'planejado',
      ballPos: { x: fwd.position.x, y: fwd.position.y },
      rationale: `${gk.shortName} chutão longo no atacante`,
    };
  }

  // Último recurso: passe pra qualquer companheiro
  const any = teammates[0];
  return {
    action: 'pass',
    target: any,
    passSubtype: 'curto',
    ballPos: { x: any.position.x, y: any.position.y },
    rationale: `${gk.shortName} passe seguro`,
  };
}

// ─── Decisão principal ────────────────────────────────────────────────────────

export function decideNextAction(
  state: FieldState,
  ZONE_ROLES: Record<string, string[]>,
): Decision {
  const { players, ballHolder, attackDir, sequence, zoneIndex, chain, minute, passStyle, activeSkills } = state;
  const teammates = players.filter(p => p.team === ballHolder.team && p.id !== ballHolder.id);
  const opponents = players.filter(p => p.team !== ballHolder.team);
  const cfg = ARCHETYPES[ballHolder.archetype];
  const teamSide: 'home' | 'away' = ballHolder.team;

  // Goleiro tem lógica própria
  if (ballHolder.role === 'GK') {
    return decideGoalkeeperDistribution(ballHolder, teammates, opponents, passStyle);
  }

  const underPressure = isUnderPressure(ballHolder, opponents);
  const cleanShot = hasCleanShot(ballHolder, opponents, attackDir);

  // ─── Casos defensivos: tackle / interception / pressure ───────────────────
  // Não é o portador que decide isso — a roleta antiga ainda gera esses
  // eventos quando a bola é "perdida". Aqui focamos em ATAQUE.
  // (eventGenerator.ts ainda decide eventos defensivos via chain)

  // ─── Decisão de finalização (chute) ───────────────────────────────────────
  const isFinisher = cfg.shotFreq >= 0.7;
  const isWild = cfg.unpredictable;
  const inFinalZone = sequence !== null && zoneIndex >= sequence.zones.length - 1;
  const chainShot =
    chain?.lastType === 'corner' ||
    chain?.lastType === 'cross' ||
    chain?.lastType === 'foul' ||
    chain?.lastType === 'rebound';

  // Manager skill FOCO OFENSIVO sobe agressividade no chute
  const focusBoost = activeSkills.includes('offens');

  const wantsToShoot =
    cleanShot &&
    !underPressure &&
    (
      (isFinisher && (inFinalZone || chainShot || focusBoost)) ||
      (inFinalZone && (chainShot || isWild)) ||
      (chainShot && (isFinisher || isWild)) ||
      (focusBoost && Math.random() < 0.4 && cfg.shotFreq >= 0.5)
    );

  if (wantsToShoot) {
    return {
      action: 'shot',
      ballPos: goalMouthPos(teamSide),
      rationale: `${ballHolder.shortName} (${ballHolder.archetype}): chute em zona ${zoneIndex} — linha limpa, sem pressão`,
    };
  }

  // ─── Avaliação de companheiros para passe ─────────────────────────────────
  const scored = teammates.map(t => {
    const freedom = computeFreedom(t, opponents);
    const progress = computeProgress(t, ballHolder, attackDir);
    const threat = computeScoringThreat(t, opponents, attackDir);
    const coherence = computePassCoherence(t, zoneIndex, sequence, ZONE_ROLES);
    const dist = distance(ballHolder.position, t.position);

    // Pesos por arquétipo do PORTADOR
    let weight: number;
    if (cfg.shotFreq >= 0.7) {
      // FINISHER/COLD_BLOOD: prefere passar pra quem tem chance de gol ou tá livre na frente
      weight = threat * 0.50 + freedom * 0.25 + progress * 0.25;
    } else if (cfg.passFreq >= 0.85 && cfg.slowsRhythm) {
      // MAESTRO/VETERAN: criativo — equilibra progresso e coerência
      weight = progress * 0.35 + coherence * 0.30 + freedom * 0.25 + threat * 0.10;
    } else if (cfg.unpredictable) {
      // WILD: arrisca — quebra coerência se vê threat ou progresso alto
      weight = progress * 0.40 + threat * 0.40 + (1 - coherence) * 0.20;
    } else if (cfg.tackleFreq >= 0.8) {
      // DESTROYER: jogo simples, segurança total
      weight = freedom * 0.55 + coherence * 0.30 + progress * 0.15;
    } else if (cfg.aerialFreq >= 0.7) {
      // BOX_INVADER: corre pra área — prefere passar pra quem cria
      weight = threat * 0.40 + progress * 0.35 + freedom * 0.25;
    } else {
      // ENGINE/HUNTER/COLD_BLOOD: balanceado, prefere segurança
      weight = freedom * 0.40 + coherence * 0.35 + progress * 0.25;
    }

    // Penalidades de distância
    if (dist < 35) weight *= 0.45;       // muito perto, passe inútil
    if (dist > 260) weight *= 0.55;      // muito longe, risco alto
    if (dist > 350) weight *= 0.30;      // praticamente um chutão

    // Bônus de continuidade de sequência tática
    if (sequence && zoneIndex < sequence.zones.length - 1) {
      const nextZone = sequence.zones[zoneIndex + 1];
      if ((ZONE_ROLES[nextZone] ?? []).includes(t.role)) weight *= 1.25;
    }

    // Penalty quando passa pra TRÁS (na direção contrária ao ataque)
    const backwards = (t.position.x - ballHolder.position.x) * attackDir < -20;
    if (backwards) weight *= 0.65;

    return { player: t, weight, freedom, progress, threat, coherence, dist };
  });

  // Top 3 ponderado — não 100% determinístico, dá variedade humana
  scored.sort((a, b) => b.weight - a.weight);
  const top = scored.slice(0, Math.min(3, scored.length));
  const totalW = top.reduce((s, x) => s + x.weight, 0) || 1;
  let r = Math.random() * totalW;
  let picked = top[0];
  for (const c of top) {
    r -= c.weight;
    if (r <= 0) { picked = c; break; }
  }
  if (!picked) picked = top[0];

  const target = picked.player;

  // ─── Subtipo do passe ─────────────────────────────────────────────────────
  let subtype: PassSubtype;

  // CRUZAMENTO: portador na ala (y<100 ou y>300) E receptor na área final
  const inFlank = ballHolder.position.y < 100 || ballHolder.position.y > 300;
  const targetX = target.position.x;
  const targetInBox = teamSide === 'home' ? targetX > 460 : targetX < 140;
  const inFinalThird = teamSide === 'home' ? ballHolder.position.x > 360 : ballHolder.position.x < 240;

  if (inFlank && inFinalThird && targetInBox) {
    subtype = 'cruzamento';
  } else if (underPressure) {
    subtype = 'rapido'; // 1-toque sob pressão
  } else if ((cfg.passFreq >= 0.85 && cfg.slowsRhythm) && minute < 80) {
    subtype = 'planejado'; // MAESTRO/VETERAN com tempo
  } else if (passStyle === 'TIKTAK') {
    subtype = 'curto';
  } else if (passStyle === 'LONGO' && picked.dist > 200) {
    subtype = 'planejado'; // chutão calculado
  } else {
    subtype = 'curto';
  }

  return {
    action: subtype === 'cruzamento' ? 'cross' : 'pass',
    target,
    passSubtype: subtype,
    ballPos: { x: target.position.x, y: target.position.y },
    rationale: `${ballHolder.shortName} → ${target.shortName} [${subtype}] f=${picked.freedom.toFixed(2)} p=${picked.progress.toFixed(2)} t=${picked.threat.toFixed(2)} c=${picked.coherence.toFixed(2)}`,
  };
}

// ─── Resolução de chute (diversidade de outcomes) ─────────────────────────────

export type ShotOutcome = 'goal' | 'save' | 'post' | 'wide' | 'rebound' | 'corner_def';

export function resolveShot(
  shooter: ClassicPlayer,
  hadCleanLine: boolean,
  minute: number,
): ShotOutcome {
  const cfg = ARCHETYPES[shooter.archetype];

  // Probabilidade de gol — quality compounding
  let goalProb = 0.16;
  if (shooter.onFire) goalProb += 0.08;
  if (cfg.shotFreq >= 0.85) goalProb += 0.10;
  if (cfg.stressImmune) goalProb += 0.05;
  if (hadCleanLine) goalProb += 0.06;
  if (shooter.fatigue > 70) goalProb -= 0.05;
  if (minute > 85) goalProb += 0.03; // dramaticidade dos finais

  const r = Math.random();
  if (r < goalProb) return 'goal';

  // Distribuir o restante: save 38% / wide 28% / post 6% / rebound 14% / corner 14%
  const r2 = Math.random();
  if (r2 < 0.38) return 'save';
  if (r2 < 0.66) return 'wide';
  if (r2 < 0.72) return 'post';
  if (r2 < 0.86) return 'rebound';
  return 'corner_def';
}

// ─── Team Phase (Fase 2) ──────────────────────────────────────────────────────

import type { TeamPhase } from './types';

export function computeTeamPhase(
  team: 'home' | 'away',
  ballHolder: ClassicPlayer,
  ballPos: { x: number; y: number },
): TeamPhase {
  const isAttacking = ballHolder.team === team;
  // xRel: 0 = backline própria, 1 = backline adversária
  const xRel = team === 'home' ? ballPos.x / FIELD_W_LOGIC : 1 - ballPos.x / FIELD_W_LOGIC;

  if (!isAttacking) {
    if (xRel > 0.6) return 'DEFENDING';      // bola no nosso terço
    if (xRel > 0.35) return 'CONSOLIDATION'; // meio-campo
    return 'TRANSITION';                      // bola perto do gol adversário (raro)
  }
  // Atacando
  if (xRel < 0.30) return 'BUILDUP';         // bola atrás
  if (xRel > 0.55) return 'ATTACKING';       // bola no terço final
  return 'CONSOLIDATION';
}

/**
 * Shift do time baseado na fase. Não move o jogador individualmente —
 * desloca o BLOCO inteiro. Aplicar a TODOS os jogadores do time.
 *
 * Retorna offsets em FRAÇÃO do campo lógico (somar a base.x, base.y).
 *  - x positivo = pra frente na direção de ataque
 *  - compress = quanto puxa a linha defensiva pra cima e o ataque pra trás
 *               (contração vertical em torno de y=center)
 */
export function teamShift(
  team: 'home' | 'away',
  phase: TeamPhase,
): { dx: number; compress: number } {
  const dir = team === 'home' ? 1 : -1;
  switch (phase) {
    case 'BUILDUP':
      return { dx: 0, compress: 0 };
    case 'CONSOLIDATION':
      return { dx: dir * 0.025, compress: 0 };
    case 'ATTACKING':
      return { dx: dir * 0.06, compress: -0.04 }; // expande pra criar espaço
    case 'DEFENDING':
      return { dx: -dir * 0.045, compress: 0.06 }; // recua + comprime
    case 'TRANSITION':
      return { dx: 0, compress: 0 };
  }
}
