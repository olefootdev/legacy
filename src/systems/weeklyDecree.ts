/**
 * weeklyDecree.ts — Decreto da Semana (Liga Global).
 *
 * Filosofia Fable 3 (decisões de reinado): 1 dilema binário por semana; a
 * escolha muda REGRAS da semana pra quem votou — o mundo responde à decisão.
 *
 * V1 (client-side): o voto do manager é persistido no save e o efeito vale
 * pro PRÓPRIO clube na semana (via MatchContextModifiers). A agregação
 * cross-user (o decreto vencedor valer pra TODOS) chega com a tabela
 * `decree_votes` do Supabase (migration pronta em supabase/migrations) — o
 * client já grava o voto lá quando a tabela existir; a leitura do vencedor
 * global é o próximo passo.
 *
 * PURO — semana vem de fora (caller passa Date.now()).
 */

export type DecreeOption = 'espetaculo' | 'ferro';

export interface WeeklyDecreeState {
  /** Semana ISO ('2026-W27'). Voto/decreto valem só na própria semana. */
  weekKey: string;
  /** Voto do manager (pode não existir se só o resultado global chegou). */
  vote?: DecreeOption;
  votedAtMs?: number;
  /**
   * V2 (cross-user): decreto VENCEDOR da semana (tally do Supabase). Quando
   * presente, prevalece sobre o voto individual — o reino decidiu.
   */
  globalOption?: DecreeOption | null;
}

export interface DecreeDefinition {
  weekKey: string;
  title: string;
  question: string;
  options: Record<DecreeOption, { label: string; effectText: string }>;
}

/** Semana ISO 8601 ('2026-W27') — mesma chave da Liga da Semana. */
export function isoWeekKey(nowMs: number): string {
  const d = new Date(nowMs);
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** O dilema da semana (fixo por enquanto — 1 par de decretos bem calibrado). */
export function decreeForWeek(weekKey: string): DecreeDefinition {
  return {
    weekKey,
    title: 'Decreto da Semana',
    question: 'Como a liga joga esta semana?',
    options: {
      espetaculo: {
        label: 'Semana do Espetáculo',
        effectText: 'Todo jogo ferve como clássico (+5% torcida) — mais gols, mais risco.',
      },
      ferro: {
        label: 'Semana de Ferro',
        effectText: 'Calendário protegido: o desgaste entre jogos pesa menos (piso de descanso).',
      },
    },
  };
}

/** Decreto ativo da semana: o VENCEDOR global prevalece; senão, o voto local.
 *  Fora da semana do registro, nada vale (decreto expira no domingo). */
export function activeDecreeOption(state: WeeklyDecreeState | undefined, nowMs: number): DecreeOption | null {
  if (!state || state.weekKey !== isoWeekKey(nowMs)) return null;
  return state.globalOption ?? state.vote ?? null;
}

export interface DecreeEffects {
  /** Piso do derbyIntensity (espetáculo: todo jogo tem um quê de clássico). */
  derbyIntensityFloor?: number;
  /** Piso do restMultiplier (ferro: congestão de calendário pesa menos). */
  restMultiplierFloor?: number;
}

export function decreeEffects(option: DecreeOption | null): DecreeEffects {
  if (option === 'espetaculo') return { derbyIntensityFloor: 1.05 };
  if (option === 'ferro') return { restMultiplierFloor: 0.95 };
  return {};
}
