/**
 * Persistência da campanha do LEGENDS CUP.
 *
 * localStorage de propósito nesta fase: deixa o modo testável hoje, sem exigir
 * migration nem tabela nova. Quando o prêmio virar card de verdade (que precisa
 * ser à prova de fraude), a campanha migra pro servidor — o formato aqui já
 * antecipa isso guardando `runNumber` e o histórico de títulos.
 *
 * ⚠️ Enquanto for local, o estado é do NAVEGADOR: dá pra editar à mão. Aceitável
 * pra teste e pra prêmio em EXP; NÃO aceitável pra entregar card. Não ligue a
 * entrega de card nisto sem mover pro servidor antes.
 */
import type { LegendsCupState } from './legendsCupModel';
import { createLegendsCupState } from './legendsCupModel';

const KEY = 'olefoot.legendsCup.v1';

export interface LegendsCupSave {
  current: LegendsCupState | null;
  /** Campanhas concluídas com título. */
  titles: number;
  /** Total de campanhas iniciadas — define o multiplicador de EXP. */
  runs: number;
  /** Coleções cujo card de prêmio já foi entregue (uma vez por manager). */
  claimedPrizes: string[];
}

const EMPTY: LegendsCupSave = { current: null, titles: 0, runs: 0, claimedPrizes: [] };

export function loadCup(): LegendsCupSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw) as Partial<LegendsCupSave>;
    return {
      current: p.current ?? null,
      titles: Number(p.titles ?? 0),
      runs: Number(p.runs ?? 0),
      claimedPrizes: Array.isArray(p.claimedPrizes) ? p.claimedPrizes : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveCup(save: LegendsCupSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* modo privado / cota cheia — a campanha segue só nesta sessão */
  }
}

/** Inicia uma campanha nova. A anterior (se houve) já foi contabilizada. */
export function startCampaign(): LegendsCupSave {
  const prev = loadCup();
  const runs = prev.runs + 1;
  const next: LegendsCupSave = {
    ...prev,
    runs,
    current: createLegendsCupState(`cup-${Date.now()}-${runs}`, runs),
  };
  saveCup(next);
  return next;
}

/** Grava o estado atual da campanha; soma título quando vira campeão. */
export function persistState(state: LegendsCupState): LegendsCupSave {
  const prev = loadCup();
  const becameChampion = state.status === 'champion' && prev.current?.status !== 'champion';
  const next: LegendsCupSave = {
    ...prev,
    current: state,
    titles: prev.titles + (becameChampion ? 1 : 0),
  };
  saveCup(next);
  return next;
}

/**
 * Multiplicador de EXP por campanha repetida. Dobra a cada campanha, mas COM
 * TETO — sem isso, 15M viram 120M em três rodadas e o Cup imprime mais EXP que
 * todas as outras fontes do jogo somadas.
 */
export const EXP_MULTIPLIER_CAP = 4;

export function expMultiplier(runNumber: number): number {
  const n = Math.max(1, Math.floor(runNumber));
  return Math.min(EXP_MULTIPLIER_CAP, 2 ** (n - 1));
}

/** O card de prêmio de uma coleção só é entregue uma vez por manager. */
export function hasClaimed(save: LegendsCupSave, collectionId: string): boolean {
  return save.claimedPrizes.includes(collectionId);
}

export function markClaimed(collectionId: string): LegendsCupSave {
  const prev = loadCup();
  if (prev.claimedPrizes.includes(collectionId)) return prev;
  const next = { ...prev, claimedPrizes: [...prev.claimedPrizes, collectionId] };
  saveCup(next);
  return next;
}
