/**
 * Cliente HTTP do MatchPlan — chama o backend Hono que invoca Python.
 *
 * Uso (no MatchQuick.tsx):
 *   const plan = await fetchQuickPlan({ seed, homeShort, awayShort, ... });
 *   if (plan) playMatchPlan(plan);  // render condensado (FIX F)
 *
 * Flag de roll-out: VITE_QUICK_PLAN_ENABLED=1 ativa o caminho novo.
 * Sem a flag, MatchQuick continua usando o loop tick-by-tick (compat).
 */

import type { MatchPlan, QuickPlanDecision, QuickPlanFirstHalfState } from './quickPlanTypes';
import type { PlayerEntity, PlayerBehavior } from '@/entities/types';
import { getSupabase } from '@/supabase/client';

// optional chaining: em runtime de teste (tsx/node) import.meta.env é undefined.
const ENV = (import.meta as { env?: Record<string, string | undefined> }).env;

const API_BASE =
  ENV?.VITE_OLEFOOT_API_URL ||
  ENV?.VITE_API_URL ||
  'http://localhost:4000';

export const QUICK_PLAN_ENABLED = ENV?.VITE_QUICK_PLAN_ENABLED === '1';

export interface QuickPlanPlayerPayload {
  id: string;
  name: string;
  pos: string;
  role: 'attack' | 'mid' | 'def' | 'gk';
  finalizacao: number;
  passe: number;
  marcacao: number;
  velocidade: number;
  fisico: number;
  confianca: number;
  // Ponte #1: atributos antes ignorados pelo motor. Opcionais (Python tem
  // defaults) pra não quebrar construtores sintéticos antigos.
  drible?: number;
  tatico?: number;
  /** Partida Viva (Fase 2): especialistas — só a cadeia de lances lê; o placar não. */
  cabeceio?: number;
  bola_parada?: number;
  penalti?: number;
  pe?: 'left' | 'right' | 'both';
  mentalidade?: number;
  fair_play?: number;
  fatigue: number;
}

// Ponte #4: o comportamento do jogador inclina levemente os atributos efetivos
// enviados ao motor (arquétipo decorativo → vira sinal). Tilt pequeno (±3).
function behaviorTilt(behavior: PlayerBehavior | undefined): {
  fin: number; vel: number; mar: number; pas: number; fis: number; dri: number; tat: number;
} {
  switch (behavior) {
    case 'ofensivo': return { fin: 3, vel: 2, mar: -2, pas: 0, fis: 0, dri: 1, tat: 0 };
    case 'defensivo': return { fin: -2, vel: 0, mar: 3, pas: 0, fis: 1, dri: 0, tat: 2 };
    case 'criativo': return { fin: 0, vel: 0, mar: -1, pas: 3, fis: -1, dri: 3, tat: 1 };
    default: return { fin: 0, vel: 0, mar: 0, pas: 0, fis: 0, dri: 0, tat: 0 };
  }
}

/**
 * PONTE MORAL → MOTOR (Fase 4).
 *
 * A moral do jogador era um SSOT que só a UI lia: escrita a cada partida,
 * mostrada em card, e ignorada pela simulação. Aqui ela vira sinal, no mesmo
 * padrão do `behaviorTilt` acima — tilt PEQUENO nos atributos mentais, que é
 * onde o estado de espírito realmente aparece em campo.
 *
 * É o que faz a decisão do vestiário pagar: responder ao pedido de um jogador
 * mexe na moral dele, e a moral chega ao motor.
 *
 * Escala: moral 50 (neutro) = 0. moral 100 → +5 confiança / +2 mentalidade;
 * moral 0 → −5 / −2. Deliberadamente menor que o tilt de comportamento não ser:
 * moral tempera, não decide.
 */
export function moralTilt(moral: number | undefined): { conf: number; men: number } {
  if (moral == null || !Number.isFinite(moral)) return { conf: 0, men: 0 };
  const delta = (Math.max(0, Math.min(100, moral)) - 50) / 50; // -1 … +1
  return { conf: Math.round(delta * 5), men: Math.round(delta * 2) };
}

/** LEGACY (Fase 4b): um grito (10', recarga 15') ou uma ordem individual (até nova ordem). */
export type ComandoAoVivo =
  | { minuto: number; tipo: 'incentivar' | 'cobrar' | 'acalmar' }
  | { minuto: number; tipo: 'ordem'; ordem: 'segurar' | 'atacar_espaco' | 'marcar'; jogador: string };

export interface FetchQuickPlanInput {
  seed: string;
  homeShort: string;
  awayShort: string;
  homeStrength: number;
  awayStrength: number;
  intensity?: 'defensive' | 'balanced' | 'offensive';
  homeLineup: QuickPlanPlayerPayload[];
  awayLineup: QuickPlanPlayerPayload[];
  /** 'second_half' = replan dos minutos 46-90 com o ledger de decisões (Fase A).
   *  'from_minute' = replan do LEGACY depois de um grito/ordem (Fase 4b). */
  mode?: 'full' | 'second_half' | 'from_minute';
  /** LEGACY: minuto em que o replan começa + estado naquele minuto. */
  fromMinute?: number;
  estado?: QuickPlanFirstHalfState;
  /** LEGACY: todos os gritos e ordens até agora (o Python valida e aplica). */
  comandos?: ComandoAoVivo[];
  /** Obrigatório quando mode='second_half': estado real do 1º tempo. */
  firstHalf?: QuickPlanFirstHalfState;
  /** Ledger de decisões dos analyst beats — pesos calculados pelo Python, ecoados de volta. */
  decisions?: QuickPlanDecision[];
  /** FABLE — DERBY/CLÁSSICO (revanche contra o nêmesis): o Python amplia
   *  finalização/xG/pênalti/cartão dos DOIS lados (~×1.12, simétrico). */
  isDerby?: boolean;
  /**
   * DNA do clube (fundação, `dnaDoClubeParaMotor`). Ausente = neutro: o Python
   * gera exatamente o mesmo plano de antes. Presente, inclina posse, pressão,
   * verticalidade, criação, solidez, faltas e fôlego do time da casa.
   */
  homeDna?: import('@/club/identidade').DnaDoClube | null;
  /** Jogo da Fundação: rival é o fantasma de um time histórico — o DNA dele vai daqui. */
  fantasma?: { dna: import('@/club/identidade').DnaDoClube };
}

/** Corpo do POST pro motor (quick-plan e análise de identidade usam o mesmo). */
function corpoDoMotor(input: FetchQuickPlanInput): Record<string, unknown> {
  return {
    seed: input.seed,
    home_short: input.homeShort,
    away_short: input.awayShort,
    home_team: {
      strength: input.homeStrength,
      intensity: input.intensity ?? 'balanced',
      lineup: input.homeLineup,
      ...(input.homeDna ? { dna: input.homeDna } : {}),
    },
    away_team: {
      strength: input.awayStrength,
      lineup: input.awayLineup,
      ...(input.fantasma ? { dna: input.fantasma.dna } : {}),
    },
    mode: input.mode ?? 'full',
    first_half: input.firstHalf,
    ...(input.mode === 'from_minute' ? { from_minute: input.fromMinute, estado: input.estado } : {}),
    ...(input.comandos?.length ? { comandos: input.comandos } : {}),
    decisions: input.decisions,
    is_derby: input.isDerby === true,
    ...(input.fantasma ? { fantasma: true } : {}),
  };
}

async function cabecalhos(): Promise<Record<string, string>> {
  const sb = getSupabase();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/**
 * RELATÓRIO DE IDENTIDADE: o motor roda o mesmo confronto em ~150 seeds com e
 * sem o DNA da casa (`POST /api/match/identidade`). Null = motor fora do ar.
 */
export async function fetchAnaliseDeIdentidade(
  input: FetchQuickPlanInput,
): Promise<import('@/onboarding/jogoDaFundacao').AnaliseDoMotor | null> {
  try {
    const res = await fetch(`${API_BASE}/api/match/identidade`, {
      method: 'POST',
      headers: await cabecalhos(),
      body: JSON.stringify(corpoDoMotor(input)),
    });
    const body = await res.json().catch(() => null);
    return res.ok && body?.ok && body.analise ? body.analise : null;
  } catch {
    return null;
  }
}

/** Nome curto pra narração/UI: apelido entre aspas ("Juca") ou corta " — fase".
 *  Ex.: 'José Carlos "Juca" de Andrade — Consolidação' → 'Juca'. */
function shortPlayerName(name: string | undefined): string {
  const raw = (name ?? '').trim();
  const nick = raw.match(/"([^"]+)"/);
  if (nick) return nick[1]!.trim();
  return raw.split(' — ')[0]!.trim();
}

/** Converte PlayerEntity local → payload do Python (campos achatados). */
export function playerToQuickPlanPayload(
  p: PlayerEntity,
  fatigue: number,
  role: 'attack' | 'mid' | 'def' | 'gk',
  /** Moral 0–100 (`state.playerMoral[id].moral`). Ausente = neutro. */
  moral?: number,
): QuickPlanPlayerPayload {
  const t = behaviorTilt(p.behavior);
  const mt = moralTilt(moral);
  const clamp = (v: number) => Math.max(1, Math.min(99, Math.round(v)));
  return {
    id: p.id,
    name: shortPlayerName(p.name),
    pos: p.pos,
    role,
    finalizacao: clamp(p.attrs.finalizacao + t.fin),
    passe: clamp(p.attrs.passe + t.pas),
    marcacao: clamp(p.attrs.marcacao + t.mar),
    velocidade: clamp(p.attrs.velocidade + t.vel),
    fisico: clamp(p.attrs.fisico + t.fis),
    confianca: clamp(p.attrs.confianca + mt.conf),
    drible: clamp(p.attrs.drible + t.dri),
    tatico: clamp(p.attrs.tatico + t.tat),
    mentalidade: clamp(p.attrs.mentalidade + mt.men),
    fair_play: p.attrs.fairPlay,
    fatigue,
    cabeceio: p.attrs.cabeceio,
    bola_parada: p.attrs.bolaParada,
    penalti: p.attrs.penalti,
    pe: p.strongFoot,
  };
}

/**
 * Boost PASSIVO das lendas: dobra o team_booster dos legacies EM CAMPO nos
 * atributos do lineup enviado ao Python. Assim a presença da lenda pesa
 * automaticamente na simulação (team_strength + quem chuta + hot finisher),
 * sem depender da ativação manual do buff (que continua sendo o "burst" de 15').
 *
 * Os rótulos vêm de `legacyTeamBooster` (ATAQUE/DEFESA/MORAL/POSSE/...). Cada
 * categoria é somada e capada para não explodir com várias lendas.
 */
export function applyLegacyBoostToLineup(
  lineup: QuickPlanPlayerPayload[],
  boosters: Array<{ label: string; pct: number }>,
): QuickPlanPlayerPayload[] {
  if (!boosters.length) return lineup;
  const acc = { atk: 0, def: 0, mor: 0, pas: 0, vel: 0 };
  for (const b of boosters) {
    const p = Number(b.pct) || 0;
    switch (b.label) {
      case 'DEFESA': acc.def += p; break;
      case 'MORAL': acc.mor += p; break;
      case 'POSSE':
      case 'PASSE': acc.pas += p; break;
      case 'VELOCIDADE': acc.vel += p; break;
      case 'FINALIZAÇÃO':
      case 'ATAQUE':
      default: acc.atk += p; break;
    }
  }
  // Capa cada categoria (várias lendas não viram cheat).
  const CAP = 8;
  const cap = (v: number) => Math.min(CAP, v);
  const clamp = (v: number) => Math.max(1, Math.min(99, Math.round(v)));
  const dAtk = cap(acc.atk), dDef = cap(acc.def), dMor = cap(acc.mor), dPas = cap(acc.pas), dVel = cap(acc.vel);
  if (!dAtk && !dDef && !dMor && !dPas && !dVel) return lineup;
  return lineup.map((pl) => ({
    ...pl,
    finalizacao: clamp(pl.finalizacao + dAtk),
    marcacao: clamp(pl.marcacao + dDef),
    confianca: clamp(pl.confianca + dMor),
    passe: clamp(pl.passe + dPas),
    velocidade: clamp(pl.velocidade + dVel),
  }));
}

export async function fetchQuickPlan(input: FetchQuickPlanInput): Promise<MatchPlan | null> {
  try {
    // Com sessão, o servidor guarda a custódia do plano (SMART-PROFILE 2B).
    const res = await fetch(`${API_BASE}/api/match/quick-plan`, {
      method: 'POST',
      headers: await cabecalhos(),
      body: JSON.stringify(corpoDoMotor(input)),
    });
    if (!res.ok) {
      console.warn('[quickPlan] backend returned', res.status);
      return null;
    }
    const body = await res.json();
    if (!body?.ok || !body?.plan) return null;
    return { ...(body.plan as MatchPlan), plano_id: typeof body.plano_id === 'string' ? body.plano_id : null };
  } catch (e) {
    console.warn('[quickPlan] fetch failed', e);
    return null;
  }
}
