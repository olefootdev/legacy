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
import type { PlayerEntity } from '@/entities/types';

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
  fatigue: number;
}

export interface FetchQuickPlanInput {
  seed: string;
  homeShort: string;
  awayShort: string;
  homeStrength: number;
  awayStrength: number;
  intensity?: 'defensive' | 'balanced' | 'offensive';
  homeLineup: QuickPlanPlayerPayload[];
  awayLineup: QuickPlanPlayerPayload[];
  /** 'second_half' = replan dos minutos 46-90 com o ledger de decisões (Fase A). */
  mode?: 'full' | 'second_half';
  /** Obrigatório quando mode='second_half': estado real do 1º tempo. */
  firstHalf?: QuickPlanFirstHalfState;
  /** Ledger de decisões dos analyst beats — pesos calculados pelo Python, ecoados de volta. */
  decisions?: QuickPlanDecision[];
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
): QuickPlanPlayerPayload {
  return {
    id: p.id,
    name: shortPlayerName(p.name),
    pos: p.pos,
    role,
    finalizacao: p.attrs.finalizacao,
    passe: p.attrs.passe,
    marcacao: p.attrs.marcacao,
    velocidade: p.attrs.velocidade,
    fisico: p.attrs.fisico,
    confianca: p.attrs.confianca,
    fatigue,
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
    const res = await fetch(`${API_BASE}/api/match/quick-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed: input.seed,
        home_short: input.homeShort,
        away_short: input.awayShort,
        home_team: {
          strength: input.homeStrength,
          intensity: input.intensity ?? 'balanced',
          lineup: input.homeLineup,
        },
        away_team: {
          strength: input.awayStrength,
          lineup: input.awayLineup,
        },
        mode: input.mode ?? 'full',
        first_half: input.firstHalf,
        decisions: input.decisions,
      }),
    });
    if (!res.ok) {
      console.warn('[quickPlan] backend returned', res.status);
      return null;
    }
    const body = await res.json();
    if (!body?.ok || !body?.plan) return null;
    return body.plan as MatchPlan;
  } catch (e) {
    console.warn('[quickPlan] fetch failed', e);
    return null;
  }
}
