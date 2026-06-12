/**
 * buildQuickPlanInputs — monta os payloads do motor Python a partir do estado
 * do jogo, de forma PURA (sem hooks) pra ser testável e reusável entre a página
 * (MatchQuickEngaged) e o self-test.
 *
 * Fase C do Quick Match 2.0 (docs/QUICK-ENGAGEMENT-REDESIGN.md): centraliza a
 * tradução elenco → payload que o preview fazia inline, e adiciona o away com
 * posições reais (pra matchup matrix detectar corredores nos dois lados).
 */

import type { PlayerEntity } from '@/entities/types';
import type { PlayerHealth } from '@/systems/playerHealth/types';
import { buildFatigueByIdMap, getEffectiveFatigue } from '@/systems/fatigue';
import { mergeLineupWithDefaults } from '@/entities/lineup';
import { roleFromPos } from '@/engine/pitchFromLineup';
import { hashStringSeed } from '@/match/seededRng';
import { overallFromAttributes } from '@/entities/player';
import {
  playerToQuickPlanPayload,
  type QuickPlanPlayerPayload,
  type FetchQuickPlanInput,
} from '@/match/quickPlanClient';

/** Slots do adversário sintético — posições reais p/ a matrix ler corredores. */
const AWAY_SLOTS: { pos: string; num: number; role: 'gk' | 'def' | 'mid' | 'attack' }[] = [
  { pos: 'GOL', num: 1, role: 'gk' },
  { pos: 'ZAG', num: 4, role: 'def' },
  { pos: 'ZAG', num: 5, role: 'def' },
  { pos: 'LE', num: 3, role: 'def' },
  { pos: 'LD', num: 2, role: 'def' },
  { pos: 'VOL', num: 8, role: 'mid' },
  { pos: 'MC', num: 6, role: 'mid' },
  { pos: 'MC', num: 10, role: 'mid' },
  { pos: 'PE', num: 7, role: 'attack' },
  { pos: 'PD', num: 11, role: 'attack' },
  { pos: 'ATA', num: 9, role: 'attack' },
];

export interface QuickHomePlayerView {
  id: string;
  name: string;
  pos: string;
  num: number;
  ovr: number;
  fatigue: number;
  /** OVR efetivo (ovr menos penalidade de fadiga) — rank dos 5 cards. */
  effective: number;
  payload: QuickPlanPlayerPayload;
}

export interface QuickPlanInputsResult {
  input: FetchQuickPlanInput;
  /** Titulares home como PlayerEntity-views, pra cards e substituição. */
  homePlayers: QuickHomePlayerView[];
}

export interface BuildQuickPlanArgs {
  players: Record<string, PlayerEntity>;
  playerHealth: Record<string, PlayerHealth> | undefined;
  /** Record slot→playerId vindo do store (pode carregar `formation`; ignorado aqui). */
  lineup: Record<string, string>;
  homeShort: string;
  awayShort: string;
  awayStrength: number;
  homeStrength?: number;
  intensity?: 'defensive' | 'balanced' | 'offensive';
  seed: string;
  /** Posições/atributos do adversário derivam disto (determinístico). */
  awaySeedKey?: string;
  /** Elenco REAL do adversário (Liga Global). Quando ≥7, usa estes jogadores no
   *  lugar do roster sintético — nomes e atributos de verdade no motor e nos cards. */
  awayPlayers?: PlayerEntity[];
}

/** Penalidade de fadiga no OVR efetivo — espelha team_strength do Python (10%→-2). */
export function effectiveOvr(ovr: number, fatigue: number): number {
  return Math.round(ovr - fatigue * 0.2);
}

/** PlayerEntity → view usada em cards/substituição (titulares e reservas). */
export function playerToHomeView(p: PlayerEntity, fatigue: number): QuickHomePlayerView {
  const ovr = overallFromAttributes(p.attrs);
  return {
    id: p.id,
    name: p.name,
    pos: p.pos,
    num: p.num ?? 0,
    ovr,
    fatigue,
    effective: effectiveOvr(ovr, fatigue),
    payload: playerToQuickPlanPayload(p, fatigue, roleFromPos(p.pos)),
  };
}

const AWAY_SURNAMES = [
  'Ribeiro', 'Nunes', 'Carvalho', 'Mendes', 'Teixeira', 'Barbosa',
  'Cardoso', 'Reis', 'Moreira', 'Castro', 'Freitas', 'Pacheco',
];

function buildAwayPayloads(awayStrength: number, seedKey: string): QuickPlanPlayerPayload[] {
  return AWAY_SLOTS.map((slot, i) => {
    const h = Math.abs(hashStringSeed(`${seedKey}|${i}`));
    const jitter = (h % 7) - 3; // -3..+3
    const base = Math.max(35, Math.min(95, awayStrength + jitter));
    return {
      id: `away-${i}`,
      name: AWAY_SURNAMES[h % AWAY_SURNAMES.length]!,
      pos: slot.pos,
      role: slot.role,
      finalizacao: slot.role === 'attack' ? base + 2 : base - 6,
      passe: slot.role === 'mid' ? base + 2 : base - 2,
      marcacao: slot.role === 'def' || slot.role === 'gk' ? base + 2 : base - 6,
      velocidade: base,
      fisico: base,
      confianca: base,
      fatigue: 0,
    };
  });
}

/** Elenco REAL do adversário → payloads do motor (nomes/atributos de verdade). */
export function awayPayloadsFromPlayers(players: PlayerEntity[]): QuickPlanPlayerPayload[] {
  return players.slice(0, 11).map((p) =>
    playerToQuickPlanPayload(p, p.fatigue ?? 0, roleFromPos(p.pos)),
  );
}

/**
 * Monta os inputs do quick-plan a partir do estado do jogo.
 * `homePlayers` sai ordenado pela ordem de slot da lineup.
 */
export function buildQuickPlanInputs(args: BuildQuickPlanArgs): QuickPlanInputsResult {
  const { players, playerHealth, lineup, intensity = 'balanced' } = args;

  const fatigueById = buildFatigueByIdMap(players, playerHealth);
  const merged = mergeLineupWithDefaults(lineup, players, { fatigueById });

  const homePlayers: QuickHomePlayerView[] = [];
  let ovrSum = 0;
  for (const pid of Object.values(merged)) {
    const p = players[pid];
    if (!p) continue;
    const fat = getEffectiveFatigue(pid, p, playerHealth);
    const view = playerToHomeView(p, fat);
    ovrSum += view.ovr;
    homePlayers.push(view);
  }

  const homeStrength = args.homeStrength
    ?? (homePlayers.length ? Math.round(ovrSum / homePlayers.length) : 70);

  const input: FetchQuickPlanInput = {
    seed: args.seed,
    homeShort: args.homeShort,
    awayShort: args.awayShort,
    homeStrength,
    awayStrength: args.awayStrength,
    intensity,
    homeLineup: homePlayers.map((h) => h.payload),
    // Elenco real do adversário quando disponível (Liga Global); senão sintetiza.
    awayLineup: args.awayPlayers && args.awayPlayers.length >= 7
      ? awayPayloadsFromPlayers(args.awayPlayers)
      : buildAwayPayloads(args.awayStrength, args.awaySeedKey ?? args.seed),
  };

  return { input, homePlayers };
}

/** Top 3 (melhor rendimento) + Bottom 2 (candidatos a sair) dos titulares. */
export function pickHalftimeFive(homePlayers: QuickHomePlayerView[]): {
  top: QuickHomePlayerView[];
  bottom: QuickHomePlayerView[];
} {
  const sorted = [...homePlayers].sort((a, b) => b.effective - a.effective);
  return {
    top: sorted.slice(0, 3),
    bottom: sorted.slice(-2).reverse(), // pior primeiro
  };
}

/**
 * Substitui um titular (out→in). O JOGADOR QUE ENTRA HERDA O PAPEL DE QUEM SAIU
 * (preenche aquele slot tático). Assim, pôr um goleiro no lugar do atacante faz
 * ele jogar de atacante — com atributos de goleiro — e o ataque despenca na
 * hora (reflete na matchup matrix do replan). Mismatch é consequência real.
 */
export function applySubstitution(
  homePlayers: QuickHomePlayerView[],
  outId: string,
  replacement: QuickHomePlayerView,
): QuickHomePlayerView[] {
  return homePlayers.map((p) => {
    if (p.id !== outId) return p;
    return { ...replacement, payload: { ...replacement.payload, role: p.payload.role } };
  });
}

/** Quantos jogadores de linha (def/mid/attack) cada formação coloca em campo. */
export function formationShape(formation: string): { def: number; mid: number; attack: number } {
  const parts = formation.split('-').map((n) => parseInt(n, 10));
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return { def: parts[0]!, mid: parts[1]!, attack: parts[2]! };
  }
  if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
    // ex.: 4-2-3-1 → def 4, mid 5, attack 1
    return { def: parts[0]!, mid: parts[1]! + parts[2]!, attack: parts[3]! };
  }
  return { def: 4, mid: 3, attack: 3 };
}

/**
 * Reatribui os ROLES dos 11 titulares conforme a formação escolhida no intervalo.
 * Mantém o GK; distribui os 10 de linha em def/mid/attack pela aptidão natural
 * (atacante puxa pra frente, zagueiro pra trás). Muda a matchup matrix de verdade:
 * formação ofensiva = mais peso nos canais de ataque.
 */
export function applyFormationToPayloads(
  payloads: QuickPlanPlayerPayload[],
  formation: string,
): QuickPlanPlayerPayload[] {
  const shape = formationShape(formation);
  const gk = payloads.filter((p) => p.role === 'gk');
  const outfield = payloads.filter((p) => p.role !== 'gk');

  // Ordena RESPEITANDO o papel atual (papel explícito manda; aptidão só desempata).
  // Assim uma substituição que coloca alguém fora de posição PERMANECE fora de
  // posição — o mismatch reflete na matrix em vez de ser "auto-corrigido".
  const roleRank: Record<string, number> = { attack: 3, mid: 2, def: 1, gk: 0 };
  const attackScore = (p: QuickPlanPlayerPayload) =>
    p.finalizacao * 0.5 + p.velocidade * 0.3 - p.marcacao * 0.4;
  const ranked = [...outfield].sort(
    (a, b) => (roleRank[b.role]! - roleRank[a.role]!) || (attackScore(b) - attackScore(a)),
  );

  const assign = new Map<string, 'attack' | 'mid' | 'def'>();
  ranked.slice(0, shape.attack).forEach((p) => assign.set(p.id, 'attack'));
  ranked.slice(shape.attack, shape.attack + shape.mid).forEach((p) => assign.set(p.id, 'mid'));
  ranked.slice(shape.attack + shape.mid).forEach((p) => assign.set(p.id, 'def'));

  // GK preservado só se ainda há um goleiro de fato; senão o slot vira buraco
  // (defense_strengths cai pro fallback → canal de finalização exposto).
  void gk;
  return payloads.map((p) =>
    p.role === 'gk' || !assign.has(p.id) ? p : { ...p, role: assign.get(p.id)! },
  );
}
