/**
 * MatchStory — memória cumulativa da partida.
 *
 * A cada evento relevante, registra um "beat" narrativo. O Coach AI
 * consulta esses beats no snapshot — passa a citar momentos passados
 * ("lembra que sofreu na ala esquerda aos 23'?") em vez de raciocinar só
 * com stats agregadas.
 *
 * NÃO é um log de eventos completo (isso é caro). É uma seleção curada:
 *   - gols (sempre)
 *   - chutes contra a trave / rebote crítico
 *   - sequência de chutes do mesmo time (3+ em 5min) → "pressão sustentada"
 *   - jogador entrando em chama
 *   - virada de placar
 *   - dangerZone (ataques persistentes pela mesma flank do adversário)
 */

import type { ClassicPlayer, MatchEvent, MatchScore } from './types';
import { FIELD_W_LOGIC, FIELD_H_LOGIC } from './formations';

export interface StoryBeat {
  minute: number;
  text: string;            // frase curta editorial — o coach lê isso
  kind: 'goal' | 'post' | 'pressure' | 'on_fire' | 'turnover' | 'comeback' | 'flank_attack';
  team?: 'home' | 'away';
}

export interface MatchStory {
  beats: StoryBeat[];
  /** Último placar visto — pra detectar viradas. */
  lastScore: { home: number; away: number };
  /** Contagem de chutes do AWAY pela ala — flank attack detector. */
  awayFlankAttacks: { left: number; center: number; right: number };
  /** Sequência de chutes recente. */
  recentShots: Array<{ minute: number; team: 'home' | 'away' }>;
  /** Jogadores que já entraram em chama (pra não duplicar beat). */
  onFireSeen: Set<number>;
  /** Quem estava na frente no último beat de virada. */
  lastLeader: 'home' | 'away' | 'draw' | null;
}

export function createMatchStory(): MatchStory {
  return {
    beats: [],
    lastScore: { home: 0, away: 0 },
    awayFlankAttacks: { left: 0, center: 0, right: 0 },
    recentShots: [],
    onFireSeen: new Set(),
    lastLeader: 'draw',
  };
}

/** Limita beats armazenados — sempre mantém os mais recentes + gols. */
function trimBeats(beats: StoryBeat[]): StoryBeat[] {
  if (beats.length <= 12) return beats;
  // Sempre preserva todos os gols + os 8 últimos não-gols
  const goals = beats.filter(b => b.kind === 'goal');
  const others = beats.filter(b => b.kind !== 'goal').slice(-8);
  return [...goals, ...others].sort((a, b) => a.minute - b.minute);
}

/** Classifica posição da bola em flank do AWAY (do ponto de vista do HOME). */
function flankFromBallPos(ballX: number, ballY: number): 'left' | 'center' | 'right' | null {
  // Só conta se está no terço final do AWAY (lado do HOME = baixo X)
  if (ballX > FIELD_W_LOGIC * 0.35) return null;
  if (ballY < FIELD_H_LOGIC * 0.33) return 'right'; // alto = right (camera POV)
  if (ballY > FIELD_H_LOGIC * 0.67) return 'left';
  return 'center';
}

const flankPT: Record<'left' | 'right' | 'center', string> = {
  left: 'ala esquerda',
  right: 'ala direita',
  center: 'corredor central',
};

/**
 * Atualiza a story após um evento. Retorna NOVA story (imutável).
 */
export function updateMatchStory(
  prev: MatchStory,
  event: MatchEvent,
  players: ClassicPlayer[],
  score: MatchScore,
): MatchStory {
  let beats = prev.beats;
  let lastScore = prev.lastScore;
  let lastLeader = prev.lastLeader;
  const onFireSeen = new Set(prev.onFireSeen);
  const awayFlankAttacks = { ...prev.awayFlankAttacks };
  let recentShots = prev.recentShots;

  // ─── Gol ─────────────────────────────────────────────────────────────────
  if (event.type === 'goal') {
    const teamName = event.team === 'home' ? 'casa' : 'visitante';
    const scorer = event.playerName ?? 'jogador';
    beats = [...beats, {
      minute: event.minute,
      kind: 'goal',
      team: event.team,
      text: `${event.minute}' GOL ${teamName}: ${scorer}`,
    }];

    // Detecta virada
    const newLeader: 'home' | 'away' | 'draw' =
      score.home > score.away ? 'home' :
      score.away > score.home ? 'away' : 'draw';
    if (lastLeader !== null && lastLeader !== newLeader && lastLeader !== 'draw' && newLeader !== 'draw') {
      beats = [...beats, {
        minute: event.minute,
        kind: 'comeback',
        team: newLeader,
        text: `${event.minute}' VIRADA — ${newLeader === 'home' ? 'TIGRES' : 'visitante'} assume`,
      }];
    }
    lastLeader = newLeader;
    lastScore = { home: score.home, away: score.away };
  }

  // ─── Trave / chute perto demais ─────────────────────────────────────────
  if (event.type === 'post') {
    beats = [...beats, {
      minute: event.minute,
      kind: 'post',
      team: event.team,
      text: `${event.minute}' ${event.playerName ?? 'jogador'} acertou a trave`,
    }];
  }

  // ─── Sequência de chutes do mesmo time (3+ em 5min) → pressão sustentada
  if (event.type === 'shot' || event.type === 'goal' || event.type === 'save') {
    recentShots = [...recentShots, { minute: event.minute, team: event.team }]
      .filter(s => event.minute - s.minute <= 5);
    const sameTeamShots = recentShots.filter(s => s.team === event.team).length;
    if (sameTeamShots >= 3) {
      const lastBeat = beats[beats.length - 1];
      // não duplica
      const recentlyPressed =
        lastBeat?.kind === 'pressure' && lastBeat?.team === event.team && (event.minute - lastBeat.minute) < 4;
      if (!recentlyPressed) {
        beats = [...beats, {
          minute: event.minute,
          kind: 'pressure',
          team: event.team,
          text: `${event.minute}' ${event.team === 'home' ? 'TIGRES' : 'visitante'} pressionando — 3 chutes em 5'`,
        }];
      }
    }
  }

  // ─── DangerZone — AWAY atacando a mesma flank do HOME repetidamente ─────
  if (event.team === 'away' && (event.type === 'shot' || event.type === 'cross' || event.type === 'danger')) {
    const flank = flankFromBallPos(event.ballX, event.ballY);
    if (flank) {
      awayFlankAttacks[flank]++;
      // Se mesma flank ≥ 3 vezes → emite beat (uma vez por flank por partida)
      if (awayFlankAttacks[flank] === 3) {
        beats = [...beats, {
          minute: event.minute,
          kind: 'flank_attack',
          team: 'away',
          text: `${event.minute}' visitante explora a ${flankPT[flank]}`,
        }];
      }
    }
  }

  // ─── On Fire — primeiro momento do jogador em chama ─────────────────────
  for (const p of players) {
    if (p.team === 'home' && p.onFire && !onFireSeen.has(p.id)) {
      onFireSeen.add(p.id);
      beats = [...beats, {
        minute: event.minute,
        kind: 'on_fire',
        team: 'home',
        text: `${event.minute}' ${p.shortName} pegou fogo (${p.archetype})`,
      }];
    }
  }

  // ─── Turnover crítico — interceptação no terço final adversário ─────────
  if ((event.type === 'interception' || event.type === 'tackle') && event.team === 'home') {
    const inFinalThird = event.ballX > FIELD_W_LOGIC * 0.66;
    if (inFinalThird) {
      const lastBeat = beats[beats.length - 1];
      const recentlySaid = lastBeat?.kind === 'turnover' && (event.minute - lastBeat.minute) < 3;
      if (!recentlySaid) {
        beats = [...beats, {
          minute: event.minute,
          kind: 'turnover',
          team: 'home',
          text: `${event.minute}' TIGRES roubou no campo deles — ${event.playerName ?? 'agente'}`,
        }];
      }
    }
  }

  return {
    beats: trimBeats(beats),
    lastScore,
    awayFlankAttacks,
    recentShots,
    onFireSeen,
    lastLeader,
  };
}

/**
 * Resume a story em strings curtas pra mandar no snapshot do Coach AI.
 * Devolve até 6 beats — os mais relevantes recentes + gols.
 */
export function storyBeatsForCoach(story: MatchStory, currentMinute: number): string[] {
  // Prioridade: gols (sempre) + 4 mais recentes não-gol nas últimas 25min
  const recent = story.beats
    .filter(b => b.kind !== 'goal' && currentMinute - b.minute <= 25)
    .slice(-4);
  const goals = story.beats.filter(b => b.kind === 'goal');
  const merged = [...goals, ...recent]
    .sort((a, b) => a.minute - b.minute)
    .slice(-6);
  return merged.map(b => b.text);
}
