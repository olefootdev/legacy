import type { ClassicPlayer, MatchEvent, EventType, MatchScore, ManagerSkillId, EventChainContext, PassStyle, PassSubtype, MatchStats, PlayerMental } from './types';
import { ARCHETYPES } from './archetypes';
import { generateNarration } from './narration';
import { FIELD_W_LOGIC, FIELD_H_LOGIC } from './formations';
import { decideNextAction, resolveShot, hasCleanShot, isUnderPressure } from './decisionEngine';
import { resolvePass } from './resolvePass';
import { tryResolveDuel, type DuelResult } from './duelSystem';
import type { PlayerNarrativeProfile } from '@/gamespirit/playerNarrativeProfile';
import { getFatigueState } from '@/match/fatigueState';

let _eventCounter = 0;

function rng(): number { return Math.random(); }

function pickPlayer(players: ClassicPlayer[]): ClassicPlayer {
  const weights = players.map(p => 0.5 + (p.confidence / 100) * 0.5);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

// ── Zonas do campo (AP-FOOTBALL-KNOWLEDGE seção 3) ───────────────────────────
// Zona 1=Defensiva, 2=Construção, 3=Criação, 4=Finalização
// Corredores: C=Central, E=Esquerdo, D=Direito, HS=Half-space
const ZONE_POS: Record<string, { x: number; y: number }> = {
  // Zona 1 — Defensiva (0–25%)
  Z1C:  { x: 60,  y: 200 },
  Z1E:  { x: 60,  y: 60  },
  Z1D:  { x: 60,  y: 340 },
  // Zona 2 — Construção (25–50%)
  Z2C:  { x: 180, y: 200 },
  Z2E:  { x: 180, y: 60  },
  Z2D:  { x: 180, y: 340 },
  Z2HS: { x: 200, y: 130 },
  // Zona 3 — Criação (50–75%) — half-spaces são a zona mais perigosa
  Z3C:  { x: 360, y: 200 },
  Z3E:  { x: 360, y: 60  },
  Z3D:  { x: 360, y: 340 },
  Z3HS: { x: 340, y: 130 },
  // Zona 4 — Finalização (75–100%) — Zona 14 = corredor central à frente da área
  Z4C:  { x: 500, y: 200 }, // Zona 14
  Z4E:  { x: 500, y: 60  },
  Z4D:  { x: 500, y: 340 },
  Z4HS: { x: 480, y: 130 },
};

// Sequências de progressão por PassStyle — baseadas nos princípios do AP-FOOTBALL-KNOWLEDGE
// TIKTAK: circulação curta, aciona todos os jogadores zona a zona (Circulação + Apoio)
// LONGO: bola direta, pula zonas (Profundidade + Desmarque de ruptura)
// LATERAL: amplitude nos corredores (Amplitude + Overlap lateral)
// COUNTER: transição ofensiva rápida após recuperação (Transição Ofensiva)
const PASS_SEQUENCES: Record<PassStyle, string[][]> = {
  TIKTAK: [
    ['Z2C', 'Z3C', 'Z4C'],              // construção rápida central (3 toques)
    ['Z2C', 'Z3HS', 'Z4C'],             // half-space direto
    ['Z3C', 'Z3HS', 'Z4C'],             // já no meio — 2 toques pro gol
    ['Z2E', 'Z3E', 'Z4C'],              // saída lateral esquerda, ponta cruza
    ['Z2D', 'Z3D', 'Z4C'],              // saída lateral direita, ponta cruza
    ['Z1E', 'Z2E', 'Z3E', 'Z4C'],      // lateral esquerdo inicia, sobe pela ala
    ['Z1D', 'Z2D', 'Z3D', 'Z4C'],      // lateral direito inicia, sobe pela ala
    ['Z1C', 'Z2C', 'Z3C', 'Z4C'],      // construção longa central (4 toques)
    ['Z3HS', 'Z4HS', 'Z4C'],            // half-space direto ao gol
    ['Z2E', 'Z3C', 'Z4C'],              // saída lateral, centraliza
  ],
  LONGO: [
    ['Z1C', 'Z4C'],           // lançamento direto ao ST
    ['Z2C', 'Z4C'],           // chutão do meio
    ['Z1C', 'Z3C', 'Z4C'],   // longo com apoio no meio
    ['Z2C', 'Z4E'],           // diagonal longa para a ponta esquerda
    ['Z2C', 'Z4D'],           // diagonal longa para a ponta direita
    ['Z1E', 'Z4E'],           // lateral lança direto na ponta
    ['Z1D', 'Z4D'],           // lateral lança direto na ponta direita
  ],
  LATERAL: [
    ['Z1E', 'Z2E', 'Z3E', 'Z4E', 'Z4C'],  // overlap esquerdo completo
    ['Z1D', 'Z2D', 'Z3D', 'Z4D', 'Z4C'],  // overlap direito completo
    ['Z2E', 'Z3E', 'Z4E', 'Z4C'],          // lateral sobe, ponta cruza
    ['Z2D', 'Z3D', 'Z4D', 'Z4C'],          // lateral sobe direita, ponta cruza
    ['Z3C', 'Z3E', 'Z4E', 'Z4C'],          // inversão para esquerda
    ['Z3C', 'Z3D', 'Z4D', 'Z4C'],          // inversão para direita
    ['Z2E', 'Z3E', 'Z3C', 'Z4C'],          // ala esquerda corta por dentro
    ['Z2D', 'Z3D', 'Z3C', 'Z4C'],          // ala direita corta por dentro
    ['Z1E', 'Z3D', 'Z4D', 'Z4C'],          // mudança de corredor longa
    ['Z1D', 'Z3E', 'Z4E', 'Z4C'],          // mudança de corredor longa inversa
  ],
  COUNTER: [
    ['Z2C', 'Z4C'],           // contra-ataque direto
    ['Z3C', 'Z4C'],           // transição imediata
    ['Z1C', 'Z3E', 'Z4C'],   // contra-ataque pela esquerda
    ['Z1C', 'Z3D', 'Z4C'],   // contra-ataque pela direita
    ['Z2C', 'Z4HS', 'Z4C'],  // profundidade direta ao half-space
    ['Z1E', 'Z3E', 'Z4E', 'Z4C'],  // contra pela ala esquerda
    ['Z1D', 'Z3D', 'Z4D', 'Z4C'],  // contra pela ala direita
  ],
};

// Roles por zona — quem deve receber a bola em cada zona (seção 7 AP-FOOTBALL-KNOWLEDGE)
const ZONE_ROLES: Record<string, string[]> = {
  Z1C:  ['CB', 'GK'],
  Z1E:  ['LB'],
  Z1D:  ['RB'],
  Z2C:  ['DM', 'CM', 'CB'],
  Z2E:  ['LB', 'LW'],
  Z2D:  ['RB', 'RW'],
  Z2HS: ['CM', 'DM'],
  Z3C:  ['CM', 'ST', 'DM'],
  Z3E:  ['LW', 'LB'],
  Z3D:  ['RW', 'RB'],
  Z3HS: ['CM', 'ST', 'LW', 'RW'],
  Z4C:  ['ST', 'LW', 'RW', 'CM'],
  Z4E:  ['LW', 'LB', 'ST'],
  Z4D:  ['RW', 'RB', 'ST'],
  Z4HS: ['ST', 'LW', 'RW', 'CM'],
};

function zoneToBallPos(zone: string, team: 'home' | 'away'): { x: number; y: number } {
  const base = ZONE_POS[zone] ?? { x: FIELD_W_LOGIC / 2, y: FIELD_H_LOGIC / 2 };
  const x = team === 'away' ? FIELD_W_LOGIC - base.x : base.x;
  const jitter = 20;
  return {
    x: Math.max(20, Math.min(FIELD_W_LOGIC - 20, x + (rng() - 0.5) * jitter)),
    y: Math.max(20, Math.min(FIELD_H_LOGIC - 20, base.y + (rng() - 0.5) * jitter)),
  };
}

function goalMouthPos(team: 'home' | 'away'): { x: number; y: number } {
  return {
    x: team === 'home' ? FIELD_W_LOGIC - 30 : 30,
    y: FIELD_H_LOGIC / 2 + (rng() - 0.5) * 60,
  };
}

function isChanceCreatingEvent(type: EventType, rationale?: string | null, tacticalTrigger?: string | null): boolean {
  return type === 'cross' || type === 'danger' || type === 'rebound' || type === 'corner' ||
    tacticalTrigger === 'false9' ||
    !!rationale?.includes('create_chance') ||
    !!rationale?.includes('attack_box') ||
    !!rationale?.includes('through_ball');
}

function shotCausalTrace(type: EventType, chanceCreated: boolean): string[] | undefined {
  if (!(type === 'goal' || type === 'shot' || type === 'save' || type === 'post' ||
        type === 'wide' || type === 'blocked' || type === 'rebound' || type === 'corner')) {
    return chanceCreated ? ['chance_created'] : undefined;
  }
  return [
    ...(chanceCreated ? ['chance_created'] : []),
    'shot_decision',
    'shot_start',
    'ball_flight',
    'mini_slowmo',
    'shot_resolution',
    'result_reveal',
    ...(type === 'goal' ? ['score_update'] : []),
    'timeline_update',
    'event_feed_update',
  ];
}

// Escolhe o jogador mais adequado para a zona atual da sequência
function pickPlayerForZone(
  players: ClassicPlayer[],
  zone: string,
  team: 'home' | 'away',
  excludeId?: number,
): ClassicPlayer {
  const teamPlayers = players.filter(p => p.team === team && p.id !== excludeId);
  const preferredRoles = ZONE_ROLES[zone] ?? [];
  const preferred = teamPlayers.filter(p => preferredRoles.includes(p.role));
  const pool = preferred.length > 0 ? preferred : teamPlayers;
  return pickPlayer(pool);
}

function chooseEventType(
  player: ClassicPlayer,
  minute: number,
  score: MatchScore,
  activeSkills: ManagerSkillId[],
  chain: EventChainContext | null,
  passStyle: PassStyle,
  zoneIndex: number,   // posição na sequência (0=início, último=finalização)
  sequenceLen: number,
): EventType {
  const cfg = ARCHETYPES[player.archetype];
  const tension = minute > 70 ? 1.4 : 1.0;
  // Fadiga unificada: tabela canônica de `getFatigueState`. attrMultiplier
  // (1.0 / 0.97 / 0.92 / 0.85) substitui a escada linear antiga e bate com
  // o que a UI mostra no badge — sem mais drift entre engine e visual.
  const fatSt = getFatigueState(player.fatigue ?? 0);
  const fatigueFactor = fatSt.attrMultiplier;
  const foulBoost = fatSt.level === 'critical' ? 1.6 : fatSt.level === 'exhausted' ? 1.35 : 1.0;
  const confBoost = player.onFire ? 1.35 : 1.0;

  const pressBoost   = activeSkills.includes('press')   ? 1.6 : 1.0;
  const crossBoost   = activeSkills.includes('cross')   ? 1.6 : 1.0;
  const offensBoost  = activeSkills.includes('offens')  ? 1.4 : 1.0;

  // Chained events
  let chainShotBoost = 1.0, chainPassBoost = 1.0, chainTackleBoost = 1.0;
  if (chain) {
    if (chain.lastType === 'corner')       chainShotBoost = 2.5;
    if (chain.lastType === 'cross')        chainShotBoost = 2.0;
    if (chain.lastType === 'tackle')       chainPassBoost = 1.8;
    if (chain.lastType === 'interception') chainPassBoost = 2.0;
    if (chain.lastType === 'foul')         chainShotBoost = 1.6;
    if (chain.lastType === 'pressure')     chainTackleBoost = 1.5;
  }

  // Na última zona da sequência → muito mais chance de chute
  const isFinalizingZone = zoneIndex >= sequenceLen - 1;
  const shotZoneBoost = isFinalizingZone ? 3.0 : 0.4;

  // PassStyle modifica o tipo de evento em cada zona
  const stylePassBoost = passStyle === 'TIKTAK' ? 1.8
    : passStyle === 'LATERAL' ? 1.4
    : passStyle === 'COUNTER' ? 0.8  // counter prefere chute rápido
    : 1.0;

  const styleCrossBoost = passStyle === 'LATERAL' ? 2.0 : 1.0;

  const r = rng();
  const weights: Array<[EventType, number]> = [
    ['shot',         cfg.shotFreq * tension * 0.35 * fatigueFactor * confBoost * offensBoost * chainShotBoost * shotZoneBoost],  // 0.25→0.35 mais chutes
    ['pass',         cfg.passFreq * 0.30 * chainPassBoost * stylePassBoost],  // 0.35→0.30 menos passes mortos
    ['tackle',       cfg.tackleFreq * 0.18 * chainTackleBoost],
    ['interception', cfg.interceptionFreq * 0.12 * pressBoost],  // menos interceptações (resetam jogo)
    ['cross',        0.12 * crossBoost * styleCrossBoost],  // mais cruzamentos → mais chutes de área
    ['pressure',     cfg.pressureFreq * 0.10 * pressBoost],
    ['foul',         cfg.foulFreq * 0.07 * foulBoost],  // 0.10→0.07 menos paradas
    ['corner',       0.05],  // mais escanteios
    ['danger',       isFinalizingZone ? 0.15 : 0.04],  // mais momentos de perigo
  ];

  const total = weights.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [type, w] of weights) {
    acc += w / total;
    if (r < acc) return type;
  }
  return 'pass';
}

// isGoal removido — substituído por resolveShot() calibrado no decisionEngine.

// ── Aplica resultado do duelo ao fluxo de eventos ────────────────────────────

function applyDuelToEvent(
  duel: DuelResult,
  attacker: ClassicPlayer,
  allPlayers: ClassicPlayer[],
  attackTeam: 'home' | 'away',
  minute: number,
  score: MatchScore,
  ballPos: { x: number; y: number },
  narrativeProfiles?: Map<number, PlayerNarrativeProfile>,
): GenerateEventResult | null {
  const opposingTeam: 'home' | 'away' = attackTeam === 'home' ? 'away' : 'home';

  // Outcomes que mudam posse → evento do defensor
  const defenderWins: string[] = [
    'tackle_won', 'interception', 'possession_lost', 'blocked_shot',
    'keeper_save', 'aerial_win_defender', 'forced_back_pass', 'forced_bad_pass',
    'cross_blocked',
  ];

  // Outcomes que geram falta → evento de falta
  const foulOutcomes: string[] = ['foul', 'yellow_card', 'red_card'];

  if (foulOutcomes.includes(duel.outcome)) {
    const teamName = attackTeam === 'home' ? 'Tigres' : 'Alvorada';
    const text = `Falta em ${attacker.shortName}! ${duel.foulSeverity === 'yellow' ? 'Cartão amarelo!' : duel.foulSeverity === 'red' ? 'CARTÃO VERMELHO!' : 'Falta marcada.'}`;
    const event: MatchEvent = {
      id: `evt_${++_eventCounter}`,
      minute,
      type: 'foul',
      team: opposingTeam,
      playerId: attacker.id,
      playerName: attacker.shortName,
      archetype: attacker.archetype,
      text,
      ballX: ballPos.x,
      ballY: ballPos.y,
      rationale: duel.log,
    };
    return { event, nextSequence: null, receiverId: null };
  }

  if (defenderWins.includes(duel.outcome)) {
    // Encontra o defensor que ganhou
    const defenders = allPlayers.filter(p =>
      p.team === opposingTeam &&
      p.role !== 'GK' &&
      Math.hypot(p.position.x - ballPos.x, p.position.y - ballPos.y) < 80,
    );
    const defender = defenders.sort((a, b) =>
      Math.hypot(a.position.x - ballPos.x, a.position.y - ballPos.y) -
      Math.hypot(b.position.x - ballPos.x, b.position.y - ballPos.y),
    )[0];

    if (!defender) return null;

    const isKeeperSave = duel.outcome === 'keeper_save';
    const actor = isKeeperSave
      ? allPlayers.find(p => p.team === opposingTeam && p.role === 'GK') ?? defender
      : defender;

    const eventType: EventType = duel.outcome === 'interception' ? 'interception'
      : duel.outcome === 'tackle_won' ? 'tackle'
      : duel.outcome === 'blocked_shot' ? 'blocked'
      : duel.outcome === 'keeper_save' ? 'save'
      : 'duel';

    const defTeamName = opposingTeam === 'home' ? 'Tigres' : 'Alvorada';
    const defProfile = narrativeProfiles?.get(actor.id);
    const text = generateNarration(eventType, actor.archetype, actor.shortName, defTeamName, minute, score, defProfile, eventType === 'duel' ? 'duel_win' : null);

    const event: MatchEvent = {
      id: `evt_${++_eventCounter}`,
      minute,
      type: eventType,
      team: opposingTeam,
      playerId: actor.id,
      playerName: actor.shortName,
      archetype: actor.archetype,
      text,
      ballX: actor.position.x,
      ballY: actor.position.y,
      rationale: duel.log,
      tacticalTrigger: eventType === 'duel' ? 'duel_win' : null,
      chanceCreated: eventType === 'save' || eventType === 'blocked',
      causalTrace: shotCausalTrace(eventType, eventType === 'save' || eventType === 'blocked'),
    };
    return { event, nextSequence: null, receiverId: null };
  }

  // Attacker wins — outcomes like successful_dribble, chance_created, keeper_beaten
  // These don't replace the event, they let it flow through (the original event proceeds)
  // But for chance_created and successful_dribble, we can boost the event
  if (duel.outcome === 'keeper_beaten') {
    // Attacker beats keeper → force goal resolution
    const teamName = attackTeam === 'home' ? 'Tigres' : 'Alvorada';
    const playerProfile = narrativeProfiles?.get(attacker.id);
    const text = generateNarration('goal', attacker.archetype, attacker.shortName, teamName, minute, score, playerProfile);
    const goalPos = {
      x: attackTeam === 'home' ? FIELD_W_LOGIC - 30 : 30,
      y: FIELD_H_LOGIC / 2 + (rng() - 0.5) * 60,
    };
    const event: MatchEvent = {
      id: `evt_${++_eventCounter}`,
      minute,
      type: 'goal',
      team: attackTeam,
      playerId: attacker.id,
      playerName: attacker.shortName,
      archetype: attacker.archetype,
      text,
      ballX: goalPos.x,
      ballY: goalPos.y,
      rationale: duel.log,
      chanceCreated: true,
      causalTrace: shotCausalTrace('goal', true),
    };
    return { event, nextSequence: null, receiverId: null };
  }

  // Other attacker wins: let the original event proceed (return null)
  return null;
}

export interface GenerateEventOptions {
  activeSkills?: ManagerSkillId[];
  chain?: EventChainContext | null;
  passStyle?: PassStyle;
  // Sequência em andamento — se fornecida, continua a jogada
  sequence?: { zones: string[]; index: number };
  // Perfis narrativos dos jogadores — enriquece as frases geradas
  narrativeProfiles?: Map<number, PlayerNarrativeProfile>;
}

export interface GenerateEventResult {
  event: MatchEvent;
  // Próxima sequência a continuar (se a jogada não terminou)
  nextSequence: { zones: string[]; index: number } | null;
  // Jogador que recebeu (para conexão visual)
  receiverId: number | null;
}

export function generateEvent(
  allPlayers: ClassicPlayer[],
  minute: number,
  score: MatchScore,
  possession: 'home' | 'away',
  opts: GenerateEventOptions = {},
): GenerateEventResult {
  const { activeSkills = [], chain = null, passStyle = 'TIKTAK' } = opts;
  const narrativeProfiles = opts.narrativeProfiles;

  const counterActive = activeSkills.includes('counter');
  const possessionBias = counterActive ? 0.45 : 0.55;
  const team = rng() < possessionBias ? possession : (possession === 'home' ? 'away' : 'home');

  // ── Progressão por sequência ──────────────────────────────────────────────
  let sequence = opts.sequence;
  let zoneIndex = 0;

  if (!sequence || sequence.index >= sequence.zones.length) {
    // Inicia nova sequência baseada no PassStyle
    const styleKey: PassStyle = counterActive ? 'COUNTER' : passStyle;
    const options = PASS_SEQUENCES[styleKey];
    const zones = options[Math.floor(rng() * options.length)];
    sequence = { zones, index: 0 };
  }

  zoneIndex = sequence.index;
  const currentZone = sequence.zones[zoneIndex];
  const isLastZone = zoneIndex >= sequence.zones.length - 1;

  // Portador: jogador na zona atual (quem tem a bola agora)
  const player = pickPlayerForZone(allPlayers, currentZone, team);

  // ─── EVENTOS DEFENSIVOS (decisão fora do portador): chain-driven ────────
  // Se o último evento foi pressão alta E o time ATACANTE perdeu posse,
  // pode virar tackle/interception. Decisão pelo eventGenerator antigo
  // continua valendo, mas agora intercala com decisões inteligentes.
  const r = rng();
  const defensiveTrigger =
    chain?.lastType === 'pressure' && r < 0.18 ? 'tackle' :
    chain?.lastType === 'cross' && r < 0.15 ? 'danger' :
    activeSkills.includes('press') && r < 0.06 ? 'interception' :
    null;

  if (defensiveTrigger) {
    const ballPos = {
      x: Math.max(20, Math.min(FIELD_W_LOGIC - 20, player.position.x + (rng() - 0.5) * 25)),
      y: Math.max(20, Math.min(FIELD_H_LOGIC - 20, player.position.y + (rng() - 0.5) * 25)),
    };
    const teamName = team === 'home' ? 'Tigres' : 'Alvorada';
    const playerProfile = narrativeProfiles?.get(player.id);
    const text = generateNarration(defensiveTrigger, player.archetype, player.shortName, teamName, minute, score, playerProfile);
    const event: MatchEvent = {
      id: `evt_${++_eventCounter}`,
      minute, type: defensiveTrigger, team,
      playerId: player.id, playerName: player.shortName, archetype: player.archetype,
      text, ballX: ballPos.x, ballY: ballPos.y,
    };
    return { event, nextSequence: null, receiverId: null };
  }

  // ─── DECISÃO INTELIGENTE DO PORTADOR ───────────────────────────────────
  const attackDir: 1 | -1 = team === 'home' ? 1 : -1;
  const decision = decideNextAction({
    players: allPlayers,
    ballHolder: player,
    attackDir,
    sequence: { zones: sequence.zones, styleKey: passStyle },
    zoneIndex,
    chain,
    minute,
    score,
    activeSkills,
    passStyle,
  }, ZONE_ROLES);

  let type: EventType = decision.action;
  const passSubtype: PassSubtype | undefined = decision.passSubtype;
  let receiverId: number | null = decision.target?.id ?? null;
  let ballPos = decision.ballPos;

  // ─── Resolução de chute com diversidade de outcomes (calibrado) ─────────
  // REGRA DE ZONA: só pode chutar ao gol se estiver na ZA (xRel >= 0.70).
  // Se o decision engine retornou 'shot' mas o jogador não está na ZA,
  // cancela o chute e força um passe (construção de jogada).
  const xRelShooter = team === 'home'
    ? player.position.x / FIELD_W_LOGIC
    : 1 - player.position.x / FIELD_W_LOGIC;

  if (type === 'shot' && xRelShooter < 0.70) {
    // Jogador fora da ZA — não pode chutar. Converte em passe progressivo.
    type = 'pass';
    const ahead = allPlayers.filter(p =>
      p.team === team && p.id !== player.id &&
      ((team === 'home' ? p.position.x > player.position.x : p.position.x < player.position.x))
    );
    const target = ahead.length > 0
      ? ahead[Math.floor(Math.random() * ahead.length)]
      : allPlayers.find(p => p.team === team && p.id !== player.id) ?? player;
    receiverId = target.id;
    ballPos = { x: target.position.x, y: target.position.y };
  }

  if (type === 'shot') {
    const cleanLine = hasCleanShot(player, allPlayers.filter(p => p.team !== team), attackDir);
    const outcome = resolveShot(player, cleanLine, minute, attackDir);

    // Linha de gol do oponente
    const oppGoalX = team === 'home' ? FIELD_W_LOGIC : 0;
    const goalY = FIELD_H_LOGIC / 2;
    const oppGK = allPlayers.find(p => p.team !== team && p.role === 'GK');

    if (outcome === 'goal') {
      type = 'goal';
      ballPos = goalMouthPos(team);
    } else if (outcome === 'save') {
      type = 'save';
      ballPos = oppGK ? { x: oppGK.position.x, y: oppGK.position.y } : goalMouthPos(team);
    } else if (outcome === 'blocked') {
      type = 'blocked';
      // Bloqueado por defensor — bola sobra perto do atirador
      ballPos = {
        x: Math.max(20, Math.min(FIELD_W_LOGIC - 20, player.position.x + (rng() - 0.5) * 40)),
        y: Math.max(20, Math.min(FIELD_H_LOGIC - 20, player.position.y + (rng() - 0.5) * 40)),
      };
    } else if (outcome === 'post') {
      type = 'post';
      ballPos = { x: team === 'home' ? FIELD_W_LOGIC - 35 : 35, y: goalY + (rng() < 0.5 ? -28 : 28) };
    } else if (outcome === 'wide') {
      type = 'wide';
      const offsetY = rng() < 0.5 ? -90 : 90;
      ballPos = { x: oppGoalX + (team === 'home' ? 10 : -10), y: goalY + offsetY };
    } else if (outcome === 'rebound') {
      type = 'rebound';
      ballPos = { x: team === 'home' ? FIELD_W_LOGIC - 90 : 90, y: goalY + (rng() - 0.5) * 80 };
    } else if (outcome === 'corner_def') {
      type = 'corner';
      ballPos = { x: oppGoalX + (team === 'home' ? -10 : 10), y: rng() < 0.5 ? 8 : FIELD_H_LOGIC - 8 };
    }
    receiverId = null;
  }

  if (type === 'cross') {
    // Cruzamento já tem ballPos do receptor (decideNextAction calculou)
    // Mantém receiverId do decision
  }

  // ─── Resolução de passe — o passe CHEGA ao receptor? ─────────────────────
  if ((type === 'pass' || type === 'cross') && decision.target) {
    const opponents = allPlayers.filter(p => p.team !== team);
    const passResult = resolvePass(
      {
        passer: player,
        receiver: decision.target,
        subtype: passSubtype ?? 'curto',
        distance: Math.hypot(
          player.position.x - decision.target.position.x,
          player.position.y - decision.target.position.y,
        ),
        underPressure: isUnderPressure(player, opponents),
        minute,
      },
      opponents,
    );

    if (passResult.outcome === 'intercepted' && passResult.interceptedBy) {
      // Defensor intercepta — posse inverte
      const defName = passResult.interceptedBy.shortName;
      const defTeam = passResult.interceptedBy.team;
      const defTeamName = defTeam === 'home' ? 'Tigres' : 'Alvorada';
      const defProfile = narrativeProfiles?.get(passResult.interceptedBy.id);
      const interceptText = generateNarration(
        'interception', passResult.interceptedBy.archetype,
        defName, defTeamName, minute, score, defProfile,
      );
      const interceptEvent: MatchEvent = {
        id: `evt_${++_eventCounter}`,
        minute,
        type: 'interception',
        team: defTeam,
        playerId: passResult.interceptedBy.id,
        playerName: defName,
        archetype: passResult.interceptedBy.archetype,
        text: interceptText,
        ballX: passResult.interceptedBy.position.x,
        ballY: passResult.interceptedBy.position.y,
        rationale: `Passe ${passSubtype} de ${player.shortName} interceptado por ${defName}`,
      };
      return { event: interceptEvent, nextSequence: null, receiverId: passResult.interceptedBy.id };
    }

    if (passResult.outcome === 'out_of_play') {
      // Bola sai — lateral para o time adversário (simplificado)
      const outTeam: 'home' | 'away' = team === 'home' ? 'away' : 'home';
      const outTeamName = outTeam === 'home' ? 'Tigres' : 'Alvorada';
      const midY = (player.position.y + (decision.target?.position.y ?? player.position.y)) / 2;
      const outX = midY < FIELD_H_LOGIC / 2 ? 10 : FIELD_W_LOGIC - 10; // lateral
      const teamName = team === 'home' ? 'Tigres' : 'Alvorada';
      const outText = `Passe de ${player.shortName} sai pela lateral — reposição ${outTeamName}.`;
      const outEvent: MatchEvent = {
        id: `evt_${++_eventCounter}`,
        minute,
        type: 'pass', // lateral é um passe de reposição
        team: outTeam,
        text: outText,
        ballX: Math.max(20, Math.min(FIELD_W_LOGIC - 20, (player.position.x + (decision.target?.position.x ?? player.position.x)) / 2)),
        ballY: Math.max(20, Math.min(FIELD_H_LOGIC - 20, midY)),
        rationale: `Passe ${passSubtype} de ${player.shortName} saiu de campo`,
      };
      return { event: outEvent, nextSequence: null, receiverId: null };
    }
    // passResult.outcome === 'completed' → continua normalmente
  }

  const teamName = team === 'home' ? 'Tigres' : 'Alvorada';
  const playerProfile = narrativeProfiles?.get(player.id);
  const tacticalTrigger = decision.tacticalTrigger ?? null;
  const text = generateNarration(type, player.archetype, player.shortName, teamName, minute, score, playerProfile, tacticalTrigger);
  const chanceCreated = isChanceCreatingEvent(type, decision.rationale, tacticalTrigger);

  const event: MatchEvent = {
    id: `evt_${++_eventCounter}`,
    minute,
    type,
    team,
    playerId: player.id,
    playerName: player.shortName,
    archetype: player.archetype,
    text,
    ballX: ballPos.x,
    ballY: ballPos.y,
    receiverPlayerId: receiverId ?? undefined,
    passSubtype,
    rationale: decision.rationale,
    tacticalTrigger,
    skillActivated: decision.skillActivated,
    chanceCreated,
    causalTrace: shotCausalTrace(type, chanceCreated),
  };

  // ─── SISTEMA DE DUELOS — campo inteiro ──────────────────────────────────
  // Cada ação importante pode gerar oposição baseada em atributos.
  // Um duelo principal por jogada, um defensor primário.
  const duelResult = tryResolveDuel({
    ballHolder: player,
    allPlayers,
    eventType: type,
    team,
    ballPos,
    minute,
    chain,
    score,
  });

  if (duelResult && duelResult.shouldNarrate) {
    // Duelo disparou e é narrativamente relevante — pode alterar o evento
    const duelEvent = applyDuelToEvent(
      duelResult, player, allPlayers, team, minute, score, ballPos, narrativeProfiles,
    );
    if (duelEvent) return duelEvent;
  }

  // Duelo resolvido internamente (atacante venceu) — enriquece rationale
  if (duelResult && !duelResult.shouldNarrate) {
    event.rationale = `${event.rationale ?? ''} | ${duelResult.log}`;
  }

  // Avança sequência se passe; reseta nos eventos terminais
  const sequenceEnded =
    type === 'goal' || type === 'shot' || type === 'save' || type === 'post' ||
    type === 'wide' || type === 'rebound' || type === 'corner' || type === 'cross' ||
    type === 'tackle' || type === 'interception' || type === 'foul' || type === 'duel' ||
    type === 'blocked' || isLastZone;

  const nextSequence = sequenceEnded
    ? null
    : { zones: sequence.zones, index: zoneIndex + 1 };

  return { event, nextSequence, receiverId };
}

export function applyEventToPlayers(
  players: ClassicPlayer[],
  evt: MatchEvent,
): ClassicPlayer[] {
  return players.map(p => {
    const isActor = p.id === evt.playerId;
    const isReceiver = p.id === evt.receiverPlayerId;
    // Mental decai/atualiza pra TODOS (não só ator/receptor) — recentInvolvement
    // e anxiousScore drift naturalmente.
    const baseMental = p.mental ?? { lastInvolvedMinute: -10, recentInvolvement: 0, anxiousScore: 0, lastShotMinute: -10 };
    const minutesSinceInvolved = evt.minute - baseMental.lastInvolvedMinute;
    const decayedRecent = minutesSinceInvolved > 2 ? 0 : baseMental.recentInvolvement;
    const decayedAnxious = Math.max(0, baseMental.anxiousScore - 4); // -4/evento

    if (!isActor && !isReceiver) {
      // Adversário próximo da bola → ansioso (pressão sustentada).
      // Eventos perigosos (shot/danger/cross/goal) elevam mais.
      const isOpposingTeam = p.team !== evt.team;
      const distToBall = Math.hypot(p.position.x - evt.ballX, p.position.y - evt.ballY);
      let anxiousScore = decayedAnxious;
      if (isOpposingTeam && distToBall < 80) {
        const aggressive = evt.type === 'shot' || evt.type === 'danger' || evt.type === 'cross' || evt.type === 'goal';
        anxiousScore = Math.min(100, anxiousScore + (aggressive ? 14 : 6));
      }
      const mental = { ...baseMental, recentInvolvement: decayedRecent, anxiousScore };
      return mental.recentInvolvement === baseMental.recentInvolvement &&
             mental.anxiousScore === baseMental.anxiousScore
        ? p
        : { ...p, mental };
    }

    let fatigue = p.fatigue;
    let confidence = p.confidence;
    const ms = p.matchStats ?? { goals:0, shots:0, passes:0, tackles:0, interceptions:0, fouls:0, duelsWon:0, tikTakCount:0, longBallCount:0 };

    if (isActor) {
      fatigue = Math.min(100, fatigue + (evt.type === 'pressure' || evt.type === 'tackle' || evt.type === 'duel' ? 3 : 1));

      if (evt.type === 'goal')         { confidence = Math.min(100, confidence + 20); }
      else if (evt.type === 'interception' || evt.type === 'tackle') { confidence = Math.min(100, confidence + 8); }
      else if (evt.type === 'shot')    { confidence = Math.min(100, confidence + 4); }
      else if (evt.type === 'duel')    { confidence = Math.min(100, confidence + 6); }
      else if (evt.type === 'pass' && p.archetype === 'FINISHER' && evt.minute > 80) { confidence = Math.max(0, confidence - 8); }

      if (fatigue > 80) confidence = Math.max(0, confidence - 3);

      // Acumula stats individuais
      const newMs = { ...ms };
      if (evt.type === 'goal')         newMs.goals++;
      if (evt.type === 'shot' || evt.type === 'goal') newMs.shots++;
      if (evt.type === 'pass' || evt.type === 'cross') newMs.passes++;
      if (evt.type === 'tackle')       newMs.tackles++;
      if (evt.type === 'interception') newMs.interceptions++;
      if (evt.type === 'foul')         newMs.fouls++;
      if (evt.tacticalTrigger === 'duel_win') newMs.duelsWon++;
      if (evt.tacticalTrigger === 'tiktak')   newMs.tikTakCount++;
      if (evt.tacticalTrigger === 'long_ball') newMs.longBallCount++;

      const onFire = confidence > 85;
      // Mental do ator: envolvimento + tipo do evento
      const isShootEvent = evt.type === 'shot' || evt.type === 'goal' || evt.type === 'save' || evt.type === 'post' || evt.type === 'wide' || evt.type === 'blocked';
      const isAggressionFromOpponent = false; // ator gerou, não sofreu
      const mental: PlayerMental = {
        lastInvolvedMinute: evt.minute,
        recentInvolvement: decayedRecent + 1,
        anxiousScore: isAggressionFromOpponent ? Math.min(100, decayedAnxious + 12) : decayedAnxious,
        lastShotMinute: isShootEvent ? evt.minute : baseMental.lastShotMinute,
      };
      return { ...p, fatigue, confidence, onFire, matchStats: newMs, mental };
    }

    // Receptor do passe: leve boost de confiança + mental aware/engaged
    if (isReceiver && (evt.type === 'pass' || evt.type === 'cross')) {
      confidence = Math.min(100, confidence + 2);
      const newMs = { ...ms, passes: ms.passes + 1 };
      const mental: PlayerMental = {
        lastInvolvedMinute: evt.minute,
        recentInvolvement: decayedRecent + 1,
        anxiousScore: decayedAnxious,
        lastShotMinute: baseMental.lastShotMinute,
      };
      return { ...p, confidence, matchStats: newMs, mental };
    }

    return p;
  });
}

/**
 * Deriva MatchStats incrementais a partir de um evento.
 * Chamado no ClassicMatchScreen para atualizar stats em tempo real.
 */
export function deriveStatsDelta(
  evt: MatchEvent,
  currentStats: MatchStats,
  possession: 'home' | 'away',
): MatchStats {
  const isHome = evt.team === 'home';
  const s = { ...currentStats };
  s.shots         = { ...s.shots };
  s.shotsOnTarget = { ...s.shotsOnTarget };
  s.passes        = { ...s.passes };
  s.fouls         = { ...s.fouls };
  s.corners       = { ...s.corners };
  s.possession    = { ...s.possession };

  if (evt.type === 'shot' || evt.type === 'goal' || evt.type === 'save' || evt.type === 'post' || evt.type === 'wide' || evt.type === 'rebound' || evt.type === 'blocked') {
    if (isHome) s.shots.home++; else s.shots.away++;
  }
  if (evt.type === 'goal' || evt.type === 'save') {
    if (isHome) s.shotsOnTarget.home++; else s.shotsOnTarget.away++;
  }
  if (evt.type === 'pass' || evt.type === 'cross') {
    if (isHome) s.passes.home++; else s.passes.away++;
  }
  if (evt.type === 'foul') {
    if (isHome) s.fouls.home++; else s.fouls.away++;
  }
  if (evt.type === 'corner') {
    if (isHome) s.corners.home++; else s.corners.away++;
  }

  // Posse: recalcula baseado em quem tem mais passes acumulados
  const totalPasses = s.passes.home + s.passes.away;
  if (totalPasses > 0) {
    s.possession.home = Math.round((s.passes.home / totalPasses) * 100);
    s.possession.away = 100 - s.possession.home;
  }

  return s;
}
