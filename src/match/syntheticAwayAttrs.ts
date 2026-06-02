/**
 * Atributos sintéticos do visitante para Partida Rápida.
 *
 * Problema resolvido: o `awayRoster` sintético só carregava `{id, num, name, pos}`,
 * sem atributos. Resultado: defensor adversário não bloqueava, goleiro não era
 * individualizado, artilheiro adversário não pesava. A partida virava "meu time
 * vs. um número (opponentStrength)".
 *
 * Esta camada deriva atributos por jogador a partir de (OVR do clube × posição),
 * com pequena variação determinística por id — mesmo adversário sente igual em
 * matches diferentes. Sem custo de DB: tudo computado no client a partir do
 * roster e da força do clube já disponível.
 */

import type { PitchPlayerState } from '@/engine/types';
import type { MatchPlayerAttributes } from '@/match/playerInMatch';
import { normalizeMatchAttributes } from '@/match/playerInMatch';
import { hashStringSeed } from '@/match/seededRng';

/** Curvas de base por grupo posicional. Cada faixa = (atributo dominante, atributo secundário). */
interface PosArchetype {
  finalizacao: number;
  drible: number;
  passeCurto: number;
  passeLongo: number;
  cruzamento: number;
  marcacao: number;
  velocidade: number;
  fisico: number;
  tatico: number;
  fairPlay: number;
  mentalidade: number;
  confianca: number;
}

/** Mapeamento POSICAO → arquétipo (offsets sobre o OVR base). */
const POS_OFFSETS: Record<string, Partial<PosArchetype>> = {
  // Goleiro: reflexos = mentalidade alta + posicionamento (tatico). Sem ataque.
  GOL: { finalizacao: -30, drible: -25, marcacao: +6, velocidade: -8, fisico: +2, tatico: +6, mentalidade: +8, confianca: +4, passeLongo: -4, cruzamento: -20 },
  GK: { finalizacao: -30, drible: -25, marcacao: +6, velocidade: -8, fisico: +2, tatico: +6, mentalidade: +8, confianca: +4, passeLongo: -4, cruzamento: -20 },
  // Zagueiros: marcacao + fisico altos, finalizacao baixa
  ZAG: { finalizacao: -16, drible: -10, marcacao: +12, velocidade: -2, fisico: +8, tatico: +6, mentalidade: +4 },
  ZAGUEIRO: { finalizacao: -16, drible: -10, marcacao: +12, velocidade: -2, fisico: +8, tatico: +6, mentalidade: +4 },
  CB: { finalizacao: -16, drible: -10, marcacao: +12, velocidade: -2, fisico: +8, tatico: +6, mentalidade: +4 },
  // Laterais: velocidade + cruzamento; marcacao ok
  LE: { finalizacao: -10, drible: +2, marcacao: +6, velocidade: +6, cruzamento: +6, fisico: +2, tatico: +2 },
  LD: { finalizacao: -10, drible: +2, marcacao: +6, velocidade: +6, cruzamento: +6, fisico: +2, tatico: +2 },
  LB: { finalizacao: -10, drible: +2, marcacao: +6, velocidade: +6, cruzamento: +6, fisico: +2, tatico: +2 },
  RB: { finalizacao: -10, drible: +2, marcacao: +6, velocidade: +6, cruzamento: +6, fisico: +2, tatico: +2 },
  // Volantes: marcacao + tatico + fisico (quebra de jogo)
  VOL: { finalizacao: -8, drible: -2, marcacao: +8, velocidade: -2, fisico: +6, tatico: +6, passeCurto: +2 },
  CDM: { finalizacao: -8, drible: -2, marcacao: +8, velocidade: -2, fisico: +6, tatico: +6, passeCurto: +2 },
  // Meio-campistas: passe + tatico
  MC: { finalizacao: -4, drible: +2, marcacao: -2, passeCurto: +6, passeLongo: +4, tatico: +6, mentalidade: +2 },
  CM: { finalizacao: -4, drible: +2, marcacao: -2, passeCurto: +6, passeLongo: +4, tatico: +6, mentalidade: +2 },
  // Meia-armador/ofensivo
  MEI: { finalizacao: +2, drible: +6, marcacao: -8, passeCurto: +6, cruzamento: +2, tatico: +2, mentalidade: +2 },
  MO: { finalizacao: +2, drible: +6, marcacao: -8, passeCurto: +6, cruzamento: +2, tatico: +2, mentalidade: +2 },
  CAM: { finalizacao: +2, drible: +6, marcacao: -8, passeCurto: +6, cruzamento: +2, tatico: +2, mentalidade: +2 },
  // Pontas: velocidade + drible + cruzamento + finalizacao média
  PE: { finalizacao: +4, drible: +10, velocidade: +8, cruzamento: +6, marcacao: -10, fisico: -2 },
  PD: { finalizacao: +4, drible: +10, velocidade: +8, cruzamento: +6, marcacao: -10, fisico: -2 },
  LW: { finalizacao: +4, drible: +10, velocidade: +8, cruzamento: +6, marcacao: -10, fisico: -2 },
  RW: { finalizacao: +4, drible: +10, velocidade: +8, cruzamento: +6, marcacao: -10, fisico: -2 },
  // Atacantes: finalização + físico + confiança
  ATA: { finalizacao: +14, drible: +4, marcacao: -14, velocidade: +4, fisico: +4, mentalidade: +2, confianca: +4 },
  ATACANTE: { finalizacao: +14, drible: +4, marcacao: -14, velocidade: +4, fisico: +4, mentalidade: +2, confianca: +4 },
  ST: { finalizacao: +14, drible: +4, marcacao: -14, velocidade: +4, fisico: +4, mentalidade: +2, confianca: +4 },
};

function applyOffsets(base: number, offsets: Partial<PosArchetype>, key: keyof PosArchetype): number {
  return base + (offsets[key] ?? 0);
}

/**
 * Deriva atributos sintéticos para um jogador visitante.
 *
 * - `opponentStrength` é o OVR do clube (0-120 normalizado, usado em quick mode).
 *   Convertemos pra escala 0-100 e usamos como base do jogador "médio" dele.
 * - `pos` define o arquétipo (offsets sobre a base).
 * - `playerId` semeia uma pequena variação determinística (±4) por jogador,
 *   pra mesmo OVR ter 11 jogadores distintos em vez de robôs clonados.
 */
export function synthesizeAwayAttrsForPlayer(args: {
  opponentStrength: number;
  pos: string;
  playerId: string;
}): MatchPlayerAttributes {
  const baseOvr = Math.max(40, Math.min(95, args.opponentStrength * (100 / 120)));
  const offsets = POS_OFFSETS[args.pos.toUpperCase()] ?? POS_OFFSETS.MC ?? {};
  // Variação determinística por jogador (±4 pontos)
  const h = hashStringSeed(args.playerId);
  const jitter = ((h % 9) - 4); // -4..+4

  return normalizeMatchAttributes({
    finalizacao: applyOffsets(baseOvr, offsets, 'finalizacao') + jitter,
    drible: applyOffsets(baseOvr, offsets, 'drible') + jitter,
    passeCurto: applyOffsets(baseOvr, offsets, 'passeCurto') + jitter,
    passeLongo: applyOffsets(baseOvr, offsets, 'passeLongo') + jitter,
    cruzamento: applyOffsets(baseOvr, offsets, 'cruzamento') + jitter,
    marcacao: applyOffsets(baseOvr, offsets, 'marcacao') + jitter,
    velocidade: applyOffsets(baseOvr, offsets, 'velocidade') + jitter,
    fisico: applyOffsets(baseOvr, offsets, 'fisico') + jitter,
    tatico: applyOffsets(baseOvr, offsets, 'tatico') + jitter,
    fairPlay: applyOffsets(baseOvr, offsets, 'fairPlay') + jitter,
    mentalidade: applyOffsets(baseOvr, offsets, 'mentalidade') + jitter,
    confianca: applyOffsets(baseOvr, offsets, 'confianca') + jitter,
  });
}

/**
 * Mapa POS → role usado pelo engine ('attack' | 'mid' | 'def' | 'gk').
 * Espelha a lógica de `slotToRole` mas a partir da string posicional do roster.
 */
export function posToRole(pos: string): 'attack' | 'mid' | 'def' | 'gk' {
  const p = pos.toUpperCase();
  if (p === 'GOL' || p === 'GK') return 'gk';
  if (p === 'ZAG' || p === 'ZAGUEIRO' || p === 'CB' || p === 'LE' || p === 'LD' || p === 'LB' || p === 'RB') return 'def';
  if (p === 'VOL' || p === 'CDM' || p === 'MC' || p === 'CM' || p === 'MEI' || p === 'MO' || p === 'CAM') return 'mid';
  return 'attack';
}

/**
 * Posições aproximadas (eixo x espelhado: visitante ataca da direita pra esquerda).
 * Apenas pro `pickAction.countOpponentsWithin` e `awayDefensePress` saberem onde
 * cada jogador está. Não é tactical positioning real — quick mode não desenha
 * o visitante; só precisa de coordenadas plausíveis para densidade.
 */
const QUICK_AWAY_LAYOUT: Record<string, { x: number; y: number }> = {
  GOL: { x: 4, y: 50 },
  GK: { x: 4, y: 50 },
  ZAG: { x: 18, y: 38 },
  CB: { x: 18, y: 38 },
  LE: { x: 22, y: 14 },
  LD: { x: 22, y: 86 },
  LB: { x: 22, y: 14 },
  RB: { x: 22, y: 86 },
  VOL: { x: 32, y: 50 },
  CDM: { x: 32, y: 50 },
  MC: { x: 40, y: 38 },
  CM: { x: 40, y: 62 },
  MEI: { x: 48, y: 50 },
  MO: { x: 48, y: 50 },
  CAM: { x: 48, y: 50 },
  PE: { x: 62, y: 18 },
  PD: { x: 62, y: 82 },
  LW: { x: 62, y: 18 },
  RW: { x: 62, y: 82 },
  ATA: { x: 70, y: 50 },
  ATACANTE: { x: 70, y: 50 },
  ST: { x: 70, y: 50 },
};

function quickAwayPosition(pos: string, index: number): { x: number; y: number } {
  const base = QUICK_AWAY_LAYOUT[pos.toUpperCase()] ?? { x: 40, y: 50 };
  // Pequena variação pra dois jogadores da mesma pos não ocuparem o mesmo ponto.
  const yJit = (index % 2 === 0 ? -8 : 8) * (Math.random() * 0.4 + 0.6);
  return { x: base.x, y: Math.min(92, Math.max(8, base.y + yJit)) };
}

/**
 * Constrói um `PitchPlayerState[]` sintético do visitante para uso em SpiritContext
 * (não para renderização). Habilita awareness real em Quick Mode: defensores
 * realmente bloqueiam, GK realmente individualiza, atacantes pesam em pGoalAway.
 *
 * Determinístico por (opponentStrength × roster ids). Mesmo adversário sente igual.
 */
export function synthesizeAwayPitchPlayers(
  awayRoster: { id: string; num: number; name: string; pos: string }[] | undefined,
  opponentStrength: number,
): PitchPlayerState[] {
  if (!awayRoster || awayRoster.length === 0) return [];
  return awayRoster.slice(0, 11).map((pl, i) => {
    const role = posToRole(pl.pos);
    const xy = quickAwayPosition(pl.pos, i);
    return {
      playerId: pl.id,
      slotId: pl.pos.toLowerCase(),
      name: pl.name,
      num: pl.num,
      pos: pl.pos,
      x: xy.x,
      y: xy.y,
      fatigue: 0,
      role,
      attributes: synthesizeAwayAttrsForPlayer({
        opponentStrength,
        pos: pl.pos,
        playerId: pl.id,
      }),
    };
  });
}

/**
 * Mentalidade do visitante (0-100, semelhante a `tacticalMentality` da casa).
 *
 * - Base derivada de `opponentStrength`: time forte joga mais agressivo (55-72).
 * - Ajuste situacional: perdendo no final → +20 (ataca); vencendo no final → -15 (bunker).
 * - Time pequeno fora de casa naturalmente joga mais retraído (clamp inferior 35).
 */
export function deriveAwayMentality(input: {
  opponentStrength: number;
  homeScore: number;
  awayScore: number;
  minute: number;
}): number {
  // Base: 40-72 conforme força (clube fraco = 40, elite = 72)
  const ovr01 = Math.max(0, Math.min(1, (input.opponentStrength - 60) / 50));
  let base = 45 + ovr01 * 27;

  const diff = input.awayScore - input.homeScore;
  const lateGame = input.minute >= 70;
  const desperate = input.minute >= 85;

  if (diff < 0 && desperate) base += 22;        // Perdendo nos acréscimos: ataca tudo
  else if (diff < 0 && lateGame) base += 14;    // Perdendo após 70': agressivo
  else if (diff < -1 && input.minute >= 60) base += 8; // Sufoco prolongado
  else if (diff > 0 && desperate) base -= 18;   // Vencendo nos acréscimos: bunker
  else if (diff > 0 && lateGame) base -= 10;    // Vencendo após 70': segura

  return Math.max(28, Math.min(85, Math.round(base)));
}
