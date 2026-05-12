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
  TacticalTrigger,
} from './types';
import { zoneFromRole, deriveMentalState } from './types';
import { ARCHETYPES } from './archetypes';
import { FIELD_W_LOGIC, FIELD_H_LOGIC } from './formations';
import { resolveSkillEffect } from './skillEffects';
import { computeGoalIntent, canAttackerBackpass, shouldWingerCutInside } from './attackFeeling';

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
  tacticalTrigger?: TacticalTrigger;
  skillActivated?: string;
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

  // ─── PLAY INTENTION — camada de inteligência tática ────────────────────
  // Determina a intenção da jogada baseado em posição, role e contexto.
  // Guia toda a decisão subsequente (passe, chute, recuo).
  type PlayIntention = 'build_up' | 'progress' | 'create_chance' | 'attack_box' | 'finish' | 'reset_possession';

  const role = ballHolder.role.toUpperCase();
  const isAttacker = holderZone === 'attack';
  const isCreative = holderZone === 'creative';
  const isDefender = holderZone === 'defense';
  const isGKorFB = role === 'GK' || role === 'LB' || role === 'RB';

  let intention: PlayIntention;

  if (xRel < 0.35) {
    intention = 'build_up';
  } else if (xRel < 0.55) {
    intention = isCreative || isDefender ? 'progress' : 'create_chance';
  } else if (xRel < 0.65) {
    // Zona de transição: atacantes já pensam em gol
    intention = isAttacker ? 'attack_box' : isCreative ? 'create_chance' : 'progress';
  } else if (xRel < 0.70) {
    intention = isAttacker ? 'attack_box' : 'create_chance';
  } else {
    // Na ZA (xRel >= 0.70)
    if (isGKorFB) {
      intention = 'create_chance'; // laterais/GK nunca finalizam
    } else if (isAttacker && xRel >= 0.80) {
      intention = 'finish'; // atacante cara a cara = finaliza
    } else if (isAttacker) {
      intention = 'attack_box';
    } else if (isCreative && xRel >= 0.75) {
      intention = 'attack_box'; // meia avançado pode atacar área
    } else {
      intention = 'create_chance';
    }
  }

  // Se sob pressão total e sem opção progressiva → reset
  // EXCEÇÃO: atacantes em zona ofensiva NÃO resetam — tentam finalizar ou driblar
  const progressiveTargets = teammates.filter(t => {
    const tXRel = teamSide === 'home' ? t.position.x / FIELD_W_LOGIC : 1 - t.position.x / FIELD_W_LOGIC;
    return tXRel > xRel + 0.05 && computeFreedom(t, opponents) > 0.3;
  });
  if (underPressure && progressiveTargets.length === 0 && intention !== 'finish') {
    if (isAttacker && xRel >= 0.60) {
      // Atacante pressionado na zona ofensiva: tenta finalizar, não recua
      intention = xRel >= 0.70 ? 'finish' : 'attack_box';
    } else {
      intention = 'reset_possession';
    }
  }

  // ─── xG simplificado — qualidade da chance de gol ──────────────────────
  const goalX = attackDir > 0 ? FIELD_W_LOGIC : 0;
  const goalY = FIELD_H_LOGIC / 2;
  const distToGoal = distance(ballHolder.position, { x: goalX, y: goalY });
  const angleToGoal = Math.abs(Math.atan2(goalY - ballHolder.position.y, goalX - ballHolder.position.x));
  const xG = Math.max(0, (1 - distToGoal / 300)) * Math.max(0, (1 - angleToGoal / (Math.PI / 2)));

  // ─── ATTACK FEELING — intenção ofensiva baseada em atributos ───────────
  // Atacantes pensam "gol primeiro". O goalIntent modifica shotProb e
  // bloqueia recuo desnecessário.
  const goalIntent = (isAttacker || isCreative) && xRel >= 0.55
    ? computeGoalIntent(
        ballHolder, opponents, attackDir, activeSkills,
        chain?.lastType ?? null,
      )
    : null;

  // Attack feeling pode elevar a intenção do portador
  if (goalIntent) {
    if (goalIntent.decision === 'shoot' && intention !== 'finish' && xRel >= 0.70) {
      intention = 'finish';
    } else if (goalIntent.decision === 'enter_box' && intention === 'create_chance') {
      intention = 'attack_box';
    }
  }

  // ─── Skill Effect — ativação de habilidade do arquétipo ────────────────
  const skillActivated = resolveSkillEffect(ballHolder, intention, xG);
  const skillBias = skillActivated?.biasOverride ?? {};

  // ─── Decisão de finalização (chute) — POR ZONA + INTENÇÃO + xG ─────────
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

  // Probabilidade de tentar chutar — guiada por intenção + xG.
  // Só chuta se intenção é 'finish' ou 'attack_box' E xG é suficiente.
  let shotProb = 0;

  if (isGKorFB || intention === 'build_up' || intention === 'progress' || intention === 'reset_possession') {
    // Nunca chuta nestas intenções
    shotProb = 0;
  } else if (intention === 'finish') {
    // Intenção clara de finalizar — xG alto
    shotProb = 0.90;
    if (skillBias.shotProb) shotProb *= skillBias.shotProb;
  } else if ((intention === 'attack_box' || intention === 'create_chance') && xRel >= 0.70) {
    // Na ZA com intenção ofensiva — xG decide
    if (xG >= 0.40) {
      shotProb = 0.92; // posição de gol clara — chuta obrigatoriamente
    } else if (xG >= 0.20) {
      shotProb = isFinisher ? 0.80 : isBoxInvader ? 0.72 : isWild ? 0.68 : 0.58;
    } else if (xG >= 0.08) {
      shotProb = isFinisher ? 0.45 : isWild ? 0.40 : 0.25; // chance média — reduzida
    } else {
      shotProb = 0.05; // xG muito baixo — prefere passe
    }
    if (cleanShot) shotProb += 0.15;
    if (underPressure) shotProb -= 0.06;
    if (chainShot) shotProb += 0.25;
    if (focusBoost) shotProb += 0.15;
    if (ballHolder.onFire) shotProb += 0.18;
    if (skillBias.shotProb) shotProb *= skillBias.shotProb;
  }
  // holderZone === 'defense' → shotProb SEMPRE 0 (zagueiro NÃO chuta no gol)

  // ─── ATTACK FEELING OVERRIDE — goalIntent pode forçar shotProb ─────────
  if (goalIntent?.shotProbOverride != null && shotProb < goalIntent.shotProbOverride) {
    shotProb = goalIntent.shotProbOverride;
  }

  // Modulação mental do PORTADOR: on_fire arrisca mais, anxious chuta menos
  const holderMental = deriveMentalState(ballHolder, minute);
  if (holderMental === 'on_fire')      shotProb *= 1.20;
  else if (holderMental === 'engaged') shotProb *= 1.10;
  else if (holderMental === 'anxious') shotProb *= 0.55;     // sob pressão → passa
  else if (holderMental === 'recovering') shotProb *= 0.75;  // acabou de chutar mas ainda tenta

  if (Math.random() < shotProb) {
    return {
      action: 'shot',
      ballPos: goalMouthPos(teamSide),
      rationale: `${ballHolder.shortName} (${ballHolder.archetype}, ${intention}, xG=${xG.toFixed(2)}) → CHUTE @ ${(shotProb*100).toFixed(0)}%${goalIntent ? ` | ${goalIntent.rationale}` : ''}`,
      skillActivated: skillActivated?.label ?? undefined,
    };
  }

  // ─── GATILHO: Chute obrigatório na ZA (com xG mínimo) ──────────────────
  // Atacante na ZA sem opção de passe progressivo → finaliza se xG > 0.10
  if (holderZone === 'attack' && xRel >= 0.70 && xG >= 0.10) {
    const attackersAhead = teammates.filter(t => {
      const tZone = zoneFromRole(t.role);
      const tXRel = teamSide === 'home' ? t.position.x / FIELD_W_LOGIC : 1 - t.position.x / FIELD_W_LOGIC;
      const isAhead = (t.position.x - ballHolder.position.x) * attackDir > 20;
      return tZone === 'attack' && tXRel >= 0.72 && isAhead && computeFreedom(t, opponents) > 0.40;
    });

    const inFlank = ballHolder.position.y < 110 || ballHolder.position.y > 290;

    // Sem atacante mais avançado → ele mesmo finaliza
    if (attackersAhead.length === 0 && !inFlank) {
      return {
        action: 'shot',
        ballPos: goalMouthPos(teamSide),
        rationale: `${ballHolder.shortName} → FINALIZAÇÃO (${intention}, xG=${xG.toFixed(2)}, sem opção)`,
        tacticalTrigger: 'forced_shot',
        skillActivated: skillActivated?.label ?? undefined,
      };
    }
    // Senão: deixa pass logic escolher (cross se na ala, combinação se central)
  }

  // (Lógica antiga de duel removida — estava invertida. O duelo é
  // contra-evento: dispara em eventGenerator quando ATACANTE adversário
  // está com a bola perto do nosso defensor, não quando nosso defensor
  // já tem a bola.)

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

    // ─── BIAS POR ZONA + INTENÇÃO — núcleo da inteligência ─────────────────
    const targetZone = zoneFromRole(t.role);
    const tXRel = teamSide === 'home' ? t.position.x / FIELD_W_LOGIC : 1 - t.position.x / FIELD_W_LOGIC;

    // Intenção modula os pesos de zona (camada principal de inteligência)
    if (intention === 'build_up') {
      // Saída de bola: DEVE ir para creative. Proibido pular para attack.
      if (targetZone === 'creative') weight *= 2.0;
      if (targetZone === 'defense') weight *= 1.15;
      if (targetZone === 'attack' && passStyle !== 'LONGO') {
        // Exceção: lateral pode sair jogando pelo ponta do mesmo corredor
        const isWingPairBuildUp =
          (ballHolder.role === 'LB' && t.role === 'LW') ||
          (ballHolder.role === 'RB' && t.role === 'RW');
        weight *= isWingPairBuildUp ? 1.8 : 0.02;
      }
      if (targetZone === 'attack' && passStyle === 'LONGO') weight *= 1.35;
    } else if (intention === 'progress') {
      // Progressão: buscar meias avançados e atacantes
      if (targetZone === 'attack') weight *= 2.0;
      if (targetZone === 'creative' && tXRel > xRel) weight *= 1.8; // meia mais avançado
      if (targetZone === 'creative' && tXRel <= xRel) weight *= 0.6; // meia recuado
      if (targetZone === 'defense') weight *= 0.20;
    } else if (intention === 'create_chance') {
      // Criação: atacantes na ZA recebem peso máximo
      if (targetZone === 'attack') {
        weight *= 3.0;
        // Through-ball: atacante à frente com espaço
        const isAhead = (t.position.x - ballHolder.position.x) * attackDir > 30;
        const hasSpace = freedom > 0.50;
        if (isAhead && hasSpace && tXRel >= 0.65) {
          weight *= 2.5; // jogada que vira gol
        }
      }
      if (targetZone === 'creative' && tXRel >= 0.55) weight *= 1.2; // meia avançado OK
      if (targetZone === 'creative' && tXRel < 0.55) weight *= 0.35;
      if (targetZone === 'defense') weight *= 0.10;
    } else if (intention === 'attack_box') {
      // Invasão da área: ST/LW/RW em posição de xG alto
      if (targetZone === 'attack') {
        weight *= 2.5;
        // Jogador em posição de gol (xG alto) recebe peso máximo
        const tDistToGoal = distance(t.position, { x: goalX, y: goalY });
        if (tDistToGoal < 150 && freedom > 0.4) weight *= 4.0;
      }
      if (targetZone === 'creative' && tXRel >= 0.60) weight *= 0.8;
      if (targetZone === 'creative' && tXRel < 0.60) weight *= 0.10;
      if (targetZone === 'defense') weight *= 0.001;
    } else if (intention === 'reset_possession') {
      // Reciclar: buscar opção segura atrás
      if (targetZone === 'defense') weight *= 2.0;
      if (targetZone === 'creative' && tXRel < xRel) weight *= 1.8; // meia recuado
      if (targetZone === 'creative' && tXRel >= xRel) weight *= 0.8;
      if (targetZone === 'attack') weight *= 0.15;
    }

    // Skill bias: passWeight amplifica peso geral do passe progressivo
    if (skillBias.passWeight && targetZone === 'attack') {
      weight *= skillBias.passWeight;
    }

    // ─── COMBINAÇÃO DE ALA (tabelinha) ─────────────────────────────────
    // Lateral ↔ ponta no mesmo corredor → tabelinha clássica
    const holderOnLeft = ballHolder.position.y < 130;
    const holderOnRight = ballHolder.position.y > 270;
    const targetOnLeft = t.position.y < 130;
    const targetOnRight = t.position.y > 270;
    const sameWing = (holderOnLeft && targetOnLeft) || (holderOnRight && targetOnRight);
    const isWingPair =
      (ballHolder.role === 'LB' && t.role === 'LW') ||
      (ballHolder.role === 'LW' && t.role === 'LB') ||
      (ballHolder.role === 'RB' && t.role === 'RW') ||
      (ballHolder.role === 'RW' && t.role === 'RB');
    if (sameWing && isWingPair) weight *= 1.45;  // tabelinha de ala

    // ─── DISTÂNCIA — MENTALIDADE BUILDUP ─────────────────────────────────
    // Curto = construção (recompensado). Longo = chutão (proibido sem LONGO).
    if (dist < 35) weight *= 0.45;                                    // colado demais
    else if (dist >= 60 && dist <= 160) weight *= 1.30;                // SWEET SPOT do buildup
    else if (dist >= 160 && dist <= 220) weight *= 1.05;               // passe médio OK
    else if (dist > 220 && dist <= 280) weight *= 0.45;                // longo já é problemático
    else if (dist > 280 && dist <= 350) weight *= 0.15;                // chutão — quase banido
    else if (dist > 350) {
      weight *= passStyle === 'LONGO' ? 0.40 : 0.02;                   // só LONGO permite
    }

    // ─── COERÊNCIA DE SEQUÊNCIA — siga o plano tático ────────────────────
    // Bônus FORTE por respeitar a progressão zona-a-zona definida.
    if (sequence && zoneIndex < sequence.zones.length - 1) {
      const nextZone = sequence.zones[zoneIndex + 1];
      if ((ZONE_ROLES[nextZone] ?? []).includes(t.role)) weight *= 1.50;
    }

    // ─── ANTI-PULA-ZONA — buildup precisa atravessar o meio ──────────────
    // Defesa→Ataque direto, criativa→defesa estranhos: já tratados acima.
    // Reforço explícito quando há um meio LIVRE no caminho.
    if (holderZone === 'defense' && targetZone === 'attack' && passStyle !== 'LONGO') {
      const midfielderFree = teammates.some(m => {
        if (zoneFromRole(m.role) !== 'creative') return false;
        return computeFreedom(m, opponents) > 0.45;
      });
      if (midfielderFree) weight *= 0.20;  // tem opção legítima — chutão é covardia
    }

    // Penalty pra trás — REGRA DE OURO: ATACANTE NUNCA TOCA PRA TRÁS
    const backwardsDelta = (t.position.x - ballHolder.position.x) * attackDir;
    const backwards = backwardsDelta < -20;
    const stronglyBackwards = backwardsDelta < -60;  // 60px = significativo
    if (backwards) {
      if (goalIntent?.antiBackpass) {
        // Attack Feeling ativo: proibido recuar (área/pequena área)
        // Exceção: completamente cercado (2+ adversários a < 25px)
        const closeOpps = opponents.filter(o =>
          distance(ballHolder.position, o.position) < 25
        ).length;
        weight *= closeOpps >= 2 ? 0.15 : 0.001;
      } else if (holderZone === 'attack') {
        // Atacante: passe pra trás é PROIBIDO. weight ~0 elimina da escolha.
        weight *= 0.001;
      } else if (holderZone === 'creative') {
        // Criativa: pode reciclar levemente pra trás, mas evita longo.
        weight *= stronglyBackwards ? 0.20 : 0.50;
      } else {
        // Defesa: pode passar pra trás (pro goleiro, recompor)
        weight *= 0.85;
      }
    }

    // ─── BIAS POR ESTADO MENTAL DO RECEPTOR (FSM Light) ──────────────────
    // Jogador "engaged" ou "aware" tem 1.20-1.35× peso — ele JÁ está no jogo,
    // sabe o que está acontecendo. Já o "idle" perde 30% — está desligado.
    // Ansioso perde 25% (não dá pra confiar a bola num jogador sob pressão).
    // On fire ganha 1.45× — está vendendo bola e já gerou momentos.
    const targetMental = deriveMentalState(t, minute);
    if (targetMental === 'on_fire')      weight *= 1.45;
    else if (targetMental === 'engaged') weight *= 1.30;
    else if (targetMental === 'aware')   weight *= 1.15;
    else if (targetMental === 'idle')    weight *= 0.70;
    else if (targetMental === 'anxious') weight *= 0.75;
    else if (targetMental === 'recovering') weight *= 0.85;

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
  let tacticalTrigger: TacticalTrigger = null;

  // CRUZAMENTO: portador na ala (y<100 ou y>300) E receptor na área final
  const inFlank = ballHolder.position.y < 100 || ballHolder.position.y > 300;
  const targetX = target.position.x;
  const targetInBox = teamSide === 'home' ? targetX > 460 : targetX < 140;
  const inFinalThird = teamSide === 'home' ? ballHolder.position.x > 360 : ballHolder.position.x < 240;

  // ─── GATILHO: Bola longa — lateral cruza de um lado ao outro ─────────────
  // LB/RB na ala oposta com receptor no outro corredor → lançamento diagonal
  const isLateral = ballHolder.role === 'LB' || ballHolder.role === 'RB';
  const targetOnOppositeSide = isLateral && (
    (ballHolder.position.y < 150 && target.position.y > 250) ||
    (ballHolder.position.y > 250 && target.position.y < 150)
  );
  if (isLateral && targetOnOppositeSide && Math.random() < 0.65) {
    subtype = 'planejado';
    tacticalTrigger = 'long_ball';
  }
  // ─── GATILHO: Tik-tak — meio de campo toca de primeira ───────────────────
  // CM/DM sob pressão ou em TIKTAK style → passe de 1 toque
  else if (
    (holderZone === 'creative') &&
    (passStyle === 'TIKTAK' || underPressure) &&
    picked.dist < 120 &&
    Math.random() < 0.60
  ) {
    subtype = 'rapido';
    tacticalTrigger = 'tiktak';
  }
  // ─── GATILHO: Falso 9 — atacante segura, recua pro meio e chuta ──────────
  // ST com archetype FINISHER/COLD_BLOOD recebe passe, segura 3s e chuta
  else if (
    holderZone === 'attack' &&
    (ballHolder.archetype === 'FINISHER' || ballHolder.archetype === 'COLD_BLOOD') &&
    xRel >= 0.45 && xRel < 0.60 &&
    Math.random() < 0.40
  ) {
    // Falso 9: devolve pro meio; o próximo evento decide se o meia finaliza.
    const midfielders = teammates.filter(t => zoneFromRole(t.role) === 'creative');
    if (midfielders.length > 0) {
      const mid = midfielders.sort((a, b) =>
        computeFreedom(b, opponents) - computeFreedom(a, opponents)
      )[0];
      return {
        action: 'pass',
        target: mid,
        passSubtype: 'rapido',
        ballPos: { x: mid.position.x, y: mid.position.y },
        rationale: `${ballHolder.shortName} → FALSO 9 → ${mid.shortName} recebe de frente`,
        tacticalTrigger: 'false9',
        skillActivated: skillActivated?.label ?? undefined,
      };
    }
    subtype = 'curto';
  }
  else if (inFlank && inFinalThird && targetInBox) {
    subtype = 'cruzamento';
  } else if (underPressure || holderMental === 'anxious') {
    subtype = 'rapido'; // pressionado OU mentalmente sob estresse → 1-toque
  } else if ((cfg.passFreq >= 0.85 && cfg.slowsRhythm) && minute < 80) {
    subtype = 'planejado';
  } else if (passStyle === 'TIKTAK') {
    subtype = 'curto';
  } else if (passStyle === 'LONGO' && picked.dist > 200) {
    subtype = 'planejado';
  } else {
    subtype = 'curto';
  }

  // ─── WINGER CUT-INSIDE — ponta corta para dentro e finaliza ────────────
  // Se o attack feeling indica que o ponta deve cortar, converte o passe
  // em chute (o ponta conduz para dentro e finaliza).
  if (subtype === 'cruzamento' && shouldWingerCutInside(ballHolder, opponents, attackDir)) {
    return {
      action: 'shot',
      ballPos: goalMouthPos(teamSide),
      rationale: `${ballHolder.shortName} corta para dentro e finaliza! [cut-inside]`,
      skillActivated: skillActivated?.label ?? undefined,
    };
  }

  // ─── ATTACK FEELING: layoff → passe-chave para atacante melhor posicionado
  if (goalIntent?.decision === 'layoff' && holderZone === 'attack') {
    // Busca companheiro com melhor xG na área
    const betterOption = teammates
      .filter(t => {
        const tZone = zoneFromRole(t.role);
        const tXRel = teamSide === 'home' ? t.position.x / FIELD_W_LOGIC : 1 - t.position.x / FIELD_W_LOGIC;
        return (tZone === 'attack' || tZone === 'creative') && tXRel >= 0.65 &&
          computeFreedom(t, opponents) > 0.35;
      })
      .sort((a, b) => computeScoringThreat(b, opponents, attackDir) - computeScoringThreat(a, opponents, attackDir))[0];

    if (betterOption) {
      return {
        action: 'pass',
        target: betterOption,
        passSubtype: 'rapido',
        ballPos: { x: betterOption.position.x, y: betterOption.position.y },
        rationale: `${ballHolder.shortName} → layoff → ${betterOption.shortName} [attack_feeling]`,
        skillActivated: skillActivated?.label ?? undefined,
      };
    }
  }

  return {
    action: subtype === 'cruzamento' ? 'cross' : 'pass',
    target,
    passSubtype: subtype,
    ballPos: { x: target.position.x, y: target.position.y },
    rationale: `${ballHolder.shortName} → ${target.shortName} [${intention}/${subtype}] f=${picked.freedom.toFixed(2)} p=${picked.progress.toFixed(2)} t=${picked.threat.toFixed(2)}`,
    tacticalTrigger,
    skillActivated: skillActivated?.label ?? undefined,
  };
}

// ─── Resolução de chute (calibrado com dados reais) ──────────────────────────

import { SHOT_ZONE_DISTRIBUTIONS, type ShotZone, type ShotOutcomeCalibrated } from './calibrationData';
import { ovrModifier } from './ovrModifier';

export type ShotOutcome = ShotOutcomeCalibrated;

export function classifyShotZone(
  shooter: ClassicPlayer,
  attackDir: 1 | -1,
): ShotZone {
  const xRel = attackDir > 0
    ? shooter.position.x / FIELD_W_LOGIC
    : 1 - shooter.position.x / FIELD_W_LOGIC;
  if (xRel >= 0.85) return 'box';
  if (xRel >= 0.72) return 'edge';
  return 'outside';
}

export function resolveShot(
  shooter: ClassicPlayer,
  hadCleanLine: boolean,
  minute: number,
  attackDir?: 1 | -1,
): ShotOutcome {
  const cfg = ARCHETYPES[shooter.archetype];
  const dir = attackDir ?? (shooter.team === 'home' ? 1 : -1);
  const zone = classifyShotZone(shooter, dir);
  const dist = SHOT_ZONE_DISTRIBUTIONS[zone];

  // GUARDA: zagueiro NÃO chuta no gol — chute vira "wide" (chutão)
  const shooterZone = zoneFromRole(shooter.role);
  if (shooterZone === 'defense') return 'wide';

  // Probabilidade de gol — base calibrada + modificadores
  let goalProb = dist.goalRate;

  // OVR modula efetividade do chute
  goalProb *= ovrModifier(shooter.ovr);

  // Arquétipo: finalizadores natos convertem mais
  if (cfg.shotFreq >= 0.85) goalProb *= 1.30;
  else if (cfg.shotFreq >= 0.7) goalProb *= 1.15;
  if (cfg.stressImmune) goalProb *= 1.12;

  // Contexto do jogo
  if (shooter.onFire) goalProb *= 1.25;
  if (hadCleanLine) goalProb *= 1.20;
  if (shooter.fatigue > 70) goalProb *= 0.90;   // menos penalidade de fadiga (jogo, não sim)
  if (shooter.fatigue > 85) goalProb *= 0.88;

  // ── Drama dos minutos finais ──────────────────────────────────────────
  // Últimos 15min: tudo fica mais intenso. É quando o jogo se decide.
  if (minute > 75) goalProb *= 1.10;
  if (minute > 85) goalProb *= 1.15;   // +26.5% composto nos últimos 5min
  if (minute > 90) goalProb *= 1.20;   // acréscimos = tensão máxima

  // Clamp — até 38% (arcade permite mais que 35%)
  goalProb = Math.max(0.02, Math.min(0.38, goalProb));

  const r = Math.random();
  if (r < goalProb) return 'goal';

  // Non-goal outcomes — distribuição calibrada
  const remaining = 1 - goalProb;
  const saveW    = dist.saveRate;
  const blockedW = dist.blockedRate;
  const wideW    = dist.wideRate;
  const postW    = dist.postRate;
  const reboundW = dist.reboundRate;
  const cornerW  = dist.cornerRate;
  const totalW   = saveW + blockedW + wideW + postW + reboundW + cornerW;

  const r2 = Math.random() * totalW;
  let acc = 0;
  acc += saveW;    if (r2 < acc) return 'save';
  acc += blockedW; if (r2 < acc) return 'blocked';
  acc += wideW;    if (r2 < acc) return 'wide';
  acc += postW;    if (r2 < acc) return 'post';
  acc += reboundW; if (r2 < acc) return 'rebound';
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
