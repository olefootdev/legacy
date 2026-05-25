/**
 * OLEFOOT PYTHON MODE — Daily Digest (agregação pra cards de slot).
 *
 * Função pura: dado intervalo + resultados/consequências, retorna até 3 cards
 * curados pra mostrar no "Boletim do café" (slot curto 5min) ou "Resumo da manhã"
 * (slot longo almoço).
 *
 * Não chama API, não tem efeitos colaterais. Python pode preencher dados
 * mais ricos depois e substituir esta função no servidor — interface estável.
 */
import type { PastResult } from '@/entities/types';
import type { PersistentConsequence } from './consequences/types';
import type { SlotDef } from './daySchedule';

export type DigestCardKind =
  | 'highlight_match'    // melhor partida do intervalo
  | 'alert'              // problema crítico (lesão, vermelho de estrela)
  | 'opportunity'        // ação sugerida (mercado, treino, escalação)
  | 'celebration'        // boa notícia (MVP, hat-trick, vitória clássico)
  | 'reminder';          // bônus de login esperando, etc.

export type DigestCardTone = 'positive' | 'negative' | 'neutral' | 'urgent';

export interface DigestCard {
  id: string;
  kind: DigestCardKind;
  tone: DigestCardTone;
  title: string;
  subtitle: string;
  /** Ação primária 1-clique. Se ausente, card é informativo. */
  cta?: {
    label: string;
    route?: string; // route absoluta, ex: '/manager/scouts'
    action?: string; // action type para dispatch
  };
  /** Quanto "peso" o card tem (0-100) — sorter usa pra escolher top 3. */
  weight: number;
}

export interface DigestInput {
  /** Resultados de partidas do intervalo. */
  results: PastResult[];
  /** Consequências ativas no clube no momento do digest. */
  activeConsequences: PersistentConsequence[];
  /** Bônus de login disponível para claim? */
  loginBonusAvailable?: boolean;
  /** Slot atual — limita quantos cards mostrar e quão denso. */
  slot: SlotDef;
}

export interface DigestOutput {
  /** Cards rankeados (até 3 pra slot curto, até 5 pra slot longo). */
  cards: DigestCard[];
  /** Sumário 1 linha pra header. */
  oneLineSummary: string;
}

// ─── Builders ──────────────────────────────────────────────────────

function celebrationCardsFromResults(results: PastResult[]): DigestCard[] {
  const cards: DigestCard[] = [];
  for (const r of results) {
    if (r.scoutMvp) {
      cards.push({
        id: `mvp_${r.scoutMvp.playerId}_${r.home}_${r.away}`,
        kind: 'celebration',
        tone: 'positive',
        title: `MVP: ${r.scoutMvp.name ?? 'destaque'}`,
        subtitle: `${r.home} ${r.scoreHome}x${r.scoreAway} ${r.away}`,
        cta: { label: 'Ver ficha', route: '/manager/scouts' },
        weight: 60,
      });
    }
    const goalDiff = r.scoreHome - r.scoreAway;
    if (Math.abs(goalDiff) >= 3) {
      const heavy = goalDiff < 0; // assumindo home = nosso time; engine pode inverter
      cards.push({
        id: `score_${r.home}_${r.away}_${r.scoreHome}_${r.scoreAway}`,
        kind: heavy ? 'alert' : 'celebration',
        tone: heavy ? 'negative' : 'positive',
        title: heavy ? 'Goleada sofrida' : 'Goleada aplicada',
        subtitle: `${r.scoreHome}x${r.scoreAway} contra ${r.away}`,
        weight: heavy ? 85 : 55,
      });
    }
  }
  return cards;
}

function alertCardsFromConsequences(consequences: PersistentConsequence[]): DigestCard[] {
  const cards: DigestCard[] = [];
  for (const c of consequences) {
    if (c.dimension !== 'physical') continue;
    if (!c.kind.includes('injury') && !c.kind.includes('suspension')) continue;
    const hoursLeft = Math.max(0, (c.expiresAt - Date.now()) / (60 * 60 * 1000));
    cards.push({
      id: `cons_${c.id}`,
      kind: 'alert',
      tone: hoursLeft > 24 ? 'urgent' : 'negative',
      title: c.kind.includes('severe') ? 'Lesão grave' :
             c.kind.includes('suspension') ? 'Suspensão ativa' : 'Lesão',
      subtitle: `${hoursLeft.toFixed(1)}h restantes`,
      cta: { label: 'Tratamento', route: '/clube/elenco' },
      weight: c.kind.includes('severe') ? 95 :
              c.kind.includes('suspension') ? 75 : 50,
    });
  }
  return cards;
}

function reminderCards(loginBonusAvailable: boolean): DigestCard[] {
  if (!loginBonusAvailable) return [];
  return [{
    id: 'bonus_reminder',
    kind: 'reminder',
    tone: 'neutral',
    title: 'Bônus de login disponível',
    subtitle: 'Resgate antes do próximo slot',
    cta: { label: 'Resgatar', action: 'CLAIM_LOGIN_BONUS' },
    weight: 40,
  }];
}

/** Agrega tudo, ranqueia, corta pelo limite do slot. */
export function buildDailyDigest(input: DigestInput): DigestOutput {
  const all: DigestCard[] = [
    ...celebrationCardsFromResults(input.results),
    ...alertCardsFromConsequences(input.activeConsequences),
    ...reminderCards(input.loginBonusAvailable ?? false),
  ];

  // Sort by weight desc
  all.sort((a, b) => b.weight - a.weight);

  // Slot longo aceita até 5; slot curto até 3
  const limit = input.slot.kind === 'long' ? 5 : 3;
  const cards = all.slice(0, limit);

  const oneLineSummary = buildOneLineSummary(cards, input.results.length);

  return { cards, oneLineSummary };
}

function buildOneLineSummary(cards: DigestCard[], totalMatches: number): string {
  if (totalMatches === 0) return 'Nada novo desde sua última visita.';
  const alerts = cards.filter((c) => c.kind === 'alert').length;
  const celebs = cards.filter((c) => c.kind === 'celebration').length;
  const parts: string[] = [`${totalMatches} partida${totalMatches > 1 ? 's' : ''}`];
  if (celebs) parts.push(`${celebs} destaque${celebs > 1 ? 's' : ''}`);
  if (alerts) parts.push(`${alerts} alerta${alerts > 1 ? 's' : ''}`);
  return parts.join(' · ');
}
