/**
 * renown.ts — Renome do Clube (reputação PÚBLICA com títulos).
 *
 * Filosofia Fable: renome é separado de moralidade — é o quanto o MUNDO te
 * conhece. Nunca decai (fama não se perde) e é alimentado por FEITOS, não por
 * login (isso é o engagementScore, que é privado e utilitário).
 *
 * Fontes (plugadas no reducer):
 *   vitória na Quick +2 · comeback +15 · fase da Liga Ole +30 · título Liga
 *   Ole +100 · desafio diário resgatado +10 · campeão de divisão +100 ·
 *   prêmio KO +50 · compra de Legacy +50.
 *
 * PURO — sem Date/Math.random (timestamps vêm do caller).
 */
import { L } from '@/i18n/L';

export interface RenownEntry {
  amount: number;
  reason: string;
  atMs: number;
}

export interface ClubRenownState {
  total: number;
  /** Últimos feitos (mostra "como cheguei aqui" na UI). */
  log: RenownEntry[];
}

export function createInitialRenown(): ClubRenownState {
  return { total: 0, log: [] };
}

const LOG_MAX = 12;

/** Adiciona renome. Fama nunca decai — amount negativo é ignorado. */
export function addRenown(
  state: ClubRenownState | undefined,
  amount: number,
  reason: string,
  atMs: number,
): ClubRenownState {
  const cur = state ?? createInitialRenown();
  const amt = Math.max(0, Math.round(amount));
  if (amt === 0) return cur;
  return {
    total: cur.total + amt,
    log: [{ amount: amt, reason, atMs }, ...cur.log].slice(0, LOG_MAX),
  };
}

/** Faixas-título (o "Herói de Oakvale" do futebol). */
export const RENOWN_TIERS = [
  { min: 0, title: L('Clube de Bairro', 'Neighbourhood Club') },
  { min: 150, title: L('Nome do Distrito', 'District Name') },
  { min: 400, title: L('Força Nacional', 'National Force') },
  { min: 700, title: L('Gigante Continental', 'Continental Giant') },
  { min: 1000, title: L('Lenda Viva', 'Living Legend') },
] as const;

export function renownTitle(total: number): string {
  let title: string = RENOWN_TIERS[0].title;
  for (const t of RENOWN_TIERS) if (total >= t.min) title = t.title;
  return title;
}

/** Progresso até o próximo título (pra barra da UI). null = teto. */
export function renownNextTier(total: number): { title: string; min: number; pct: number } | null {
  const next = RENOWN_TIERS.find((t) => total < t.min);
  if (!next) return null;
  const prev = [...RENOWN_TIERS].reverse().find((t) => total >= t.min) ?? RENOWN_TIERS[0];
  const span = next.min - prev.min;
  return { title: next.title, min: next.min, pct: span > 0 ? Math.round(((total - prev.min) / span) * 100) : 0 };
}

/**
 * Fama tem preço: contra um clube muito mais famoso, o caldeirão adversário
 * ferve (+até 3% de crowd contra o famoso). Multiplica crowdSupport via
 * contextFactors (mesmo canal do derby).
 */
export function renownCrowdFactor(myRenown: number, oppRenown: number): number {
  const gap = Math.max(0, Math.min(1, (myRenown - oppRenown) / 1000));
  return 1 + gap * 0.03;
}
