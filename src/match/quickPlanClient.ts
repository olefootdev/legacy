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
