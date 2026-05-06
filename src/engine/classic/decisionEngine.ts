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
  PlayerZone,
} from './types';
import { zoneFromRole } from './types';
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

  // ─── Zona do portador — base da lógica binária do CLASSIC ──────────────
  const holderZone: PlayerZone = zoneFromRole(ballHolder.role);

  // Posição relativa da bola: 0 = backline própria, 1 = backline adversária
  const xRel = teamSide === 'home'
    ? ballHolder.position.x / FIELD_W_LOGIC
    : 1 - ballHolder.position.x / FIELD_W_LOGIC;

  // ─── Decisão de finalização (chute) — POR ZONA ─────────────────────────
  const isFinisher = cfg.shotFreq >= 0.7;
  const isWild = cfg.unpredictable;
  const isMaestro = cfg.passFreq >= 0.85 && cfg.slowsRhythm;
  const isBoxInvader = cfg.aerialFreq >= 0.7;
  const inFinalZone = sequence !== null && zoneIndex >= sequence.zones.length - 1;
  const chainShot =
    chain?.lastType === 'corner' ||
    chain?.lastType === 'cross' ||
    chain?.lastType === 'foul' ||
    chain?.lastType === 'rebound';
  const focusBoost = activeSkills.includes('offens');

  // Probabilidade de tentar chutar agora (decisão psicológica do agente)
  // Atacante (zona attack) PRECISA finalizar — não toca pra trás. Meio chuta
  // moderado de fora. Defesa NUNCA chuta.
  let shotProb = 0;
  if (holderZone === 'attack' && xRel >= 0.55) {
    // Em terço final adversário, atacante busca chute
    shotProb = isFinisher ? 0.65
             : isBoxInvader ? 0.55
             : isWild ? 0.55
             : 0.42; // mesmo um ponta "comum" tenta o gol
    if (cleanShot) shotProb += 0.12;
    if (underPressure) shotProb -= 0.18;  // pressionado prefere passe rápido
    if (chainShot) shotProb += 0.20;       // após corner/cross/rebote
    if (focusBoost) shotProb += 0.15;
    if (ballHolder.onFire) shotProb += 0.15;
  } else if (holderZone === 'creative' && xRel >= 0.55) {
    // Meio na zona final tenta chute moderado, principalmente de fora
    shotProb = isMaestro ? 0.32
             : isWild ? 0.40
             : 0.18;
    if (cleanShot) shotProb += 0.10;
    if (underPressure) shotProb -= 0.10;
    if (chainShot) shotProb += 0.18;
    if (focusBoost) shotProb += 0.12;
  }
  // holderZone === 'defense' → shotProb = 0 (zagueiro não chuta)

  if (Math.random() < shotProb) {
    return {
      action: 'shot',
      ballPos: goalMouthPos(teamSide),
      rationale: `${ballHolder.shortName} (${ballHolder.archetype}, ${holderZone}) → CHUTE @ ${(shotProb*100).toFixed(0)}%`,
    };
  }

  // ─── Avaliação de companheiros para passe ─────────────────────────────────
  const scored = teammates.map(t => {
    const freedom = computeFreedom(t, opponents);
    const progress = computeProgress(t, ballHolder, attackDir);
    const threat = computeScoringThreat(t, opponents, attackDir);
    const coherence = computePassCoherence(t, zoneIndex, sequence, ZONE_ROLES);
    const dist = distance(ballHolder.position, t.position);

    // Pesos base por arquétipo do PORTADOR
    let weight: number;
    if (cfg.shotFreq >= 0.7) {
      weight = threat * 0.50 + freedom * 0.25 + progress * 0.25;
    } else if (cfg.passFreq >= 0.85 && cfg.slowsRhythm) {
      weight = progress * 0.35 + coherence * 0.30 + freedom * 0.25 + threat * 0.10;
    } else if (cfg.unpredictable) {
      weight = progress * 0.40 + threat * 0.40 + (1 - coherence) * 0.20;
    } else if (cfg.tackleFreq >= 0.8) {
      weight = freedom * 0.55 + coherence * 0.30 + progress * 0.15;
    } else if (cfg.aerialFreq >= 0.7) {
      weight = threat * 0.40 + progress * 0.35 + freedom * 0.25;
    } else {
      weight = freedom * 0.40 + coherence * 0.35 + progress * 0.25;
    }

    // ─── BIAS POR ZONA — núcleo do conceito binário ──────────────────────
    const targetZone = zoneFromRole(t.role);

    // DEFESA com posse: prefere passar pra DEFESA (lateral), CRIATIVA (DM/CM),
    // ATRAI pressão. Evita longas pra ATAQUE diretamente (só sob skill LONGO).
    if (holderZone === 'defense') {
      if (targetZone === 'creative') weight *= 1.45;
      if (targetZone === 'defense') weight *= 1.10;
      if (targetZone === 'attack' && passStyle !== 'LONGO') weight *= 0.55;
      if (targetZone === 'attack' && passStyle === 'LONGO') weight *= 1.30;
    }

    // CRIATIVA com posse: É ONDE O JOGO ACONTECE — busca o atacante/ponta
    if (holderZone === 'creative') {
      if (targetZone === 'attack') weight *= 1.55;     // bola pra frente
      if (targetZone === 'creative') weight *= 1.05;   // troca lateral OK
      if (targetZone === 'defense') weight *= 0.50;    // só recicla se fechado
    }

    // ATAQUE com posse: NUNCA toca pra trás (penalidade brutal). Se for passar,
    // troca com outro atacante OU devolve pra criativa só se SEM linha mesmo.
    if (holderZone === 'attack') {
      if (targetZone === 'attack') weight *= 1.35;
      if (targetZone === 'creative') weight *= 0.55;   // só se sem outra opção
      if (targetZone === 'defense') weight *= 0.10;    // proibido pelos princípios
    }

    // Penalidades de distância (mantém)
    if (dist < 35) weight *= 0.45;
    if (dist > 260) weight *= 0.55;
    if (dist > 350) weight *= 0.30;

    // Bônus de continuidade de sequência tática
    if (sequence && zoneIndex < sequence.zones.length - 1) {
      const nextZone = sequence.zones[zoneIndex + 1];
      if ((ZONE_ROLES[nextZone] ?? []).includes(t.role)) weight *= 1.25;
    }

    // Penalty pra trás — escala por zona do PORTADOR (atacante quase nunca)
    const backwards = (t.position.x - ballHolder.position.x) * attackDir < -20;
    if (backwards) {
      if (holderZone === 'attack')   weight *= 0.18;  // atacante NÃO toca pra trás
      else if (holderZone === 'creative') weight *= 0.55;
      else                            weight *= 0.85;
    }

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
 * (Legado — substituído por playerShift). Mantido temporariamente para
 * compatibilidade com chamadas existentes. Devolve neutro.
 */
export function teamShift(
  _team: 'home' | 'away',
  _phase: TeamPhase,
): { dx: number; compress: number } {
  return { dx: 0, compress: 0 };
}

/**
 * Shift POR JOGADOR baseado em (zona, posse, posição da bola).
 *
 * Princípio binário do CLASSIC:
 *  - Time ATACANDO segue a bola pra frente, GRADUALMENTE
 *  - Time DEFENDENDO recua + fecha o gol, GRADUALMENTE
 *  - Cada zona tem magnitude própria (defesa cauteloso, ataque agressivo)
 *
 * @param player    jogador a deslocar
 * @param ballPos   posição atual da bola (x, y em coords lógicas 600x400)
 * @param holderTeam time que tem a bola
 */
export function playerShift(
  player: ClassicPlayer,
  ballPos: { x: number; y: number },
  holderTeam: 'home' | 'away',
): { dx: number; dy: number } {
  const team = player.team;
  const dir = team === 'home' ? 1 : -1;
  const zone = zoneFromRole(player.role);
  const isAttacking = holderTeam === team;

  // Posição relativa da bola pro time deste jogador (0 = nossa backline, 1 = deles)
  const xRelOurs = team === 'home'
    ? ballPos.x / FIELD_W_LOGIC
    : 1 - ballPos.x / FIELD_W_LOGIC;

  // ─── ATACANDO ────────────────────────────────────────────────────────
  // Time inteiro avança gradualmente conforme bola progride.
  // Defesa avança POUCO (não se expõe). Criativa avança MÉDIO. Ataque já tá lá,
  // mas se aproxima da área quando bola entra no terço final.
  if (isAttacking) {
    // base de avanço proporcional ao avanço da bola, dosado por zona
    const ballProgress = Math.max(0, xRelOurs - 0.30); // só conta após sair da própria área
    const baseDx =
      zone === 'defense'  ? ballProgress * 0.04   // até +4% só
      : zone === 'creative' ? ballProgress * 0.07 // até +7%
      : ballProgress * 0.05;                       // ataque já posicionado
    return { dx: dir * baseDx, dy: 0 };
  }

  // ─── DEFENDENDO ──────────────────────────────────────────────────────
  // Time recua proporcionalmente a quanto a bola está perto da nossa área.
  // Defesa recua POUCO (já está atrás, fecha vertical). Criativa recua MÉDIO
  // (forma bloco). Ataque recua MAIS (pra ajudar) OU pressiona alto se mentalidade.
  const ballThreat = Math.max(0, 1 - xRelOurs); // 1 quando bola na nossa área
  const baseDx =
    zone === 'defense'  ? -ballThreat * 0.025   // -2.5% no pior caso
    : zone === 'creative' ? -ballThreat * 0.05  // -5%
    : -ballThreat * 0.07;                        // -7% (ataque ajuda na marcação)

  // Compressão vertical leve: defesa fecha o miolo quando bola perto da área
  const compress = zone === 'defense' ? ballThreat * 0.04 : 0;
  const yCenter = FIELD_H_LOGIC / 2;
  const dy = (yCenter - player.position.y) * compress / FIELD_H_LOGIC;

  return { dx: dir * baseDx, dy };
}
