/**
 * PONTUAÇÃO DO MANAGER — o eixo do rebrand de engajamento.
 *
 * Cada ação de gestão pontua. O score é o número que o manager vê na Home
 * (total + delta de hoje) e a régua de comparação entre managers.
 *
 * V1 client-side no estado do jogo (mesmo padrão do clubRenown), persistido
 * com o save. Migração server-authoritative planejada (tabela + RPC Supabase)
 * antes de virar ranking competitivo com prêmio — client-authority aqui tem o
 * mesmo risco que já cobrou caro em GAT/OLEXP.
 *
 * TABELA CALIBRADA (2026-07-21) — regras de calibração:
 *  - ação diária repetível (treino) vale menos que decisão de mercado;
 *  - vitória OFICIAL (Liga Ole / Legends Cup / Global) vale 2,5× a amistosa;
 *  - comprar LEGEND é o topo (é o funil de receita do jogo);
 *  - derrota pontua um resto (2) — jogar sempre vale mais que não jogar.
 */

export type ManagerScoreKind =
  | 'vitoria_amistosa'      // Partida Rápida amistosa vencida
  | 'vitoria_oficial'       // Liga Ole / Legends Cup / Liga Global vencida
  | 'derrota'               // jogou e perdeu — participação
  | 'treino_concluido'      // plano de treino concluído (por plano)
  | 'compra_jogador'        // Genesis / Academia / mercado NPC
  | 'compra_legend'         // card Legacy (OLEFOOT ou PIX)
  | 'venda_jogador'         // venda no mercado (Market Maker / listagem)
  | 'upgrade_estrutura'     // estrutura do clube evoluída
  | 'upgrade_staff'         // staff evoluído
  | 'negociacao_exchange'   // operação no livro de EXP
  | 'negociacao_manager';   // amistoso/desafio contra manager real

export const MANAGER_SCORE_TABLE: Record<ManagerScoreKind, number> = {
  vitoria_amistosa: 10,
  vitoria_oficial: 25,
  derrota: 2,
  treino_concluido: 8,
  compra_jogador: 15,
  compra_legend: 60,
  venda_jogador: 20,
  upgrade_estrutura: 12,
  upgrade_staff: 10,
  negociacao_exchange: 5,
  negociacao_manager: 15,
};

export interface ManagerScoreEvent {
  kind: ManagerScoreKind;
  points: number;
  label: string;
  atMs: number;
}

export interface ManagerScoreState {
  /** Pontuação de carreira — nunca decai. */
  total: number;
  /** Chave do dia local (YYYY-MM-DD) do acumulador `today`. */
  todayKey: string;
  /** Pontos ganhos hoje — o delta que a Home mostra. */
  today: number;
  /** Últimos eventos (novo → antigo), cap 40 — alimenta o extrato de pontos. */
  log: ManagerScoreEvent[];
}

const LOG_CAP = 40;

export function localDayKey(atMs: number): string {
  const d = new Date(atMs);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function createInitialManagerScore(): ManagerScoreState {
  return { total: 0, todayKey: '', today: 0, log: [] };
}

/** Acumula pontos de uma ação. `points` custom sobrepõe a tabela (bônus). */
export function addManagerScore(
  state: ManagerScoreState | undefined,
  kind: ManagerScoreKind,
  label: string,
  atMs: number,
  points?: number,
): ManagerScoreState {
  const prev = state ?? createInitialManagerScore();
  const pts = Math.max(0, Math.round(points ?? MANAGER_SCORE_TABLE[kind]));
  if (pts === 0) return prev;
  const dayKey = localDayKey(atMs);
  const today = prev.todayKey === dayKey ? prev.today + pts : pts;
  return {
    total: prev.total + pts,
    todayKey: dayKey,
    today,
    log: [{ kind, points: pts, label, atMs }, ...prev.log].slice(0, LOG_CAP),
  };
}

/** Delta de hoje respeitando a virada do dia (sem mutar o estado). */
export function managerScoreToday(state: ManagerScoreState | undefined, nowMs: number): number {
  if (!state) return 0;
  return state.todayKey === localDayKey(nowMs) ? state.today : 0;
}

/** Saneia estado vindo de save antigo/corrompido. */
export function sanitizeManagerScore(raw: unknown): ManagerScoreState {
  if (!raw || typeof raw !== 'object') return createInitialManagerScore();
  const r = raw as Partial<ManagerScoreState>;
  return {
    total: Number.isFinite(r.total) ? Math.max(0, Math.round(r.total!)) : 0,
    todayKey: typeof r.todayKey === 'string' ? r.todayKey : '',
    today: Number.isFinite(r.today) ? Math.max(0, Math.round(r.today!)) : 0,
    log: Array.isArray(r.log)
      ? r.log
          .filter((e) => e && typeof e === 'object' && Number.isFinite((e as ManagerScoreEvent).points))
          .slice(0, LOG_CAP)
      : [],
  };
}
