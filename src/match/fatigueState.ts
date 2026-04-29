/**
 * fatigueState — modelo unificado de fadiga do jogador.
 *
 * Pesquisa de mercado (FM, FIFA, eFootball, Top Eleven, SM24):
 *   1. Sempre 3 níveis críticos visíveis (50-70 / 71-89 / 90+).
 *   2. Penalidade de atributos cresce mais rápido perto do limite.
 *   3. Risco de lesão MULTIPLICA na zona vermelha (não apenas soma).
 *   4. Sinal visual redundante: cor + ícone + (às vezes) pulse.
 *
 * Esta tabela é a fonte única — UI consome `getFatigueState()` pra
 * decidir badge/cor; engine (shot resolver, drible, decisão) consome
 * `attrMultiplier` pra reduzir efetividade. Mantém a UX e o gameplay
 * sincronizados sem mágica espalhada pelo código.
 */

export type FatigueLevel = 'fresh' | 'tired' | 'exhausted' | 'critical';

export interface FatigueState {
  level: FatigueLevel;
  /** % numérico (0-100) — útil pra UI direta. */
  pct: number;
  /** Multiplicador a aplicar nos atributos relevantes (0..1).
   *  Ex.: 0.92 = jogador rende 92% do normal. */
  attrMultiplier: number;
  /** Multiplicador de risco de lesão (1.0 = base, 1.25 = +25%). */
  injuryRiskMultiplier: number;
  /** Cor de tema do badge — segue tokens do design system. */
  badgeTone: 'none' | 'warning' | 'alert' | 'danger';
  /** Texto curto pro aria-label / tooltip. */
  shortLabel: string;
}

/** Retorna o estado de fadiga normalizado a partir do % bruto. */
export function getFatigueState(fatigue: number): FatigueState {
  const pct = Math.max(0, Math.min(100, fatigue));

  if (pct >= 90) {
    return {
      level: 'critical',
      pct,
      attrMultiplier: 0.85,
      injuryRiskMultiplier: 1.25,
      badgeTone: 'danger',
      shortLabel: 'Crítico — risco alto de lesão',
    };
  }
  if (pct >= 71) {
    return {
      level: 'exhausted',
      pct,
      attrMultiplier: 0.92,
      injuryRiskMultiplier: 1.15,
      badgeTone: 'alert',
      shortLabel: 'Exausto — atributos reduzidos',
    };
  }
  if (pct >= 50) {
    return {
      level: 'tired',
      pct,
      attrMultiplier: 0.97,
      injuryRiskMultiplier: 1.05,
      badgeTone: 'warning',
      shortLabel: 'Cansado',
    };
  }
  return {
    level: 'fresh',
    pct,
    attrMultiplier: 1,
    injuryRiskMultiplier: 1,
    badgeTone: 'none',
    shortLabel: 'Fresco',
  };
}

/** Cor hex do badge — tokens do design system Olefoot. */
export function fatigueBadgeColor(tone: FatigueState['badgeTone']): string {
  switch (tone) {
    case 'warning':
      return '#FACC15'; // amarelo (atenção)
    case 'alert':
      return '#FB923C'; // laranja (exausto)
    case 'danger':
      return '#EF4444'; // vermelho (crítico)
    default:
      return 'transparent';
  }
}
