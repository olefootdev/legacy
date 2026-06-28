/**
 * quickRarity — "raridade estimada" de um desfecho de Partida Rápida.
 *
 * Ideia viral #10 ("Quase impossível"): transforma uma vitória comum num troféu
 * digno de print dando um número concreto de escassez ("1 em X partidas"). NÃO é
 * uma probabilidade estatística real — é um índice lúdico que multiplica fatores
 * improváveis (goleada, virada, clean sheet, hat-trick, sequência). O rótulo na
 * UI deixa claro que é "estimada".
 *
 * Também devolve a MANCHETE editorial do momento (ideia #1 "Momento Imortal"):
 * dá nome ao pico dramático pra alimentar o card compartilhável.
 */

export interface QuickRarityInput {
  homeScore: number;
  awayScore: number;
  won: boolean;
  draw: boolean;
  /** A casa esteve atrás em algum momento (habilita "virada"). */
  wasLosing: boolean;
  possessionHome: number;
  shotsHome: number;
  /** Quantos bônus de performance saíram (clean sheet, hat-trick, etc.). */
  bonusCount: number;
  cleanSheet: boolean;
  hattrick: boolean;
  /** Vitórias seguidas DEPOIS desta partida. */
  streak: number;
}

export type RarityTier = 0 | 1 | 2 | 3; // comum / raro / épico / lendário

export interface QuickRarity {
  /** Manchete do momento (Moret) — ex.: "VIRADA HISTÓRICA". */
  headline: string;
  /** Linha de apoio curta — ex.: "de 0–2 a 3–2". */
  tagline: string;
  /** "1 em X partidas" — quão improvável é este desfecho. */
  oneInX: number;
  tier: RarityTier;
  /** true quando vale a pena empurrar o compartilhamento (raro+). */
  shareWorthy: boolean;
}

const TIER_LABEL = ['Comum', 'Raro', 'Épico', 'Lendário'] as const;

export function rarityTierLabel(tier: RarityTier): string {
  return TIER_LABEL[tier];
}

export function computeQuickRarity(i: QuickRarityInput): QuickRarity {
  const diff = Math.abs(i.homeScore - i.awayScore);
  const goleada = i.won && diff >= 3;
  const comeback = i.won && i.wasLosing;
  const dominance = i.won && i.possessionHome > 65 && i.shotsHome > 15;

  // Índice multiplicativo de improbabilidade (lúdico, não estatístico).
  let x = 1;
  if (diff >= 5) x *= 12;
  else if (diff >= 4) x *= 8;
  else if (diff >= 3) x *= 4;
  else if (diff >= 2) x *= 2;
  if (comeback) x *= 6;
  if (i.cleanSheet) x *= 3;
  if (i.hattrick) x *= 10;
  if (i.streak >= 7) x *= 8;
  else if (i.streak >= 5) x *= 5;
  else if (i.streak >= 3) x *= 2;
  if (dominance) x *= 2;
  if (i.bonusCount >= 3) x *= 2;

  const oneInX = Math.max(1, Math.round(x));
  const tier: RarityTier = oneInX >= 200 ? 3 : oneInX >= 50 ? 2 : oneInX >= 10 ? 1 : 0;

  // Manchete: prioriza o feito mais "contável" da partida.
  let headline: string;
  let tagline: string;
  if (i.hattrick) {
    headline = 'NOITE DE HAT-TRICK';
    tagline = `${i.homeScore}–${i.awayScore} com show individual`;
  } else if (comeback) {
    headline = 'VIRADA HISTÓRICA';
    tagline = `da desvantagem ao ${i.homeScore}–${i.awayScore}`;
  } else if (goleada) {
    headline = 'GOLEADA';
    tagline = `${i.homeScore}–${i.awayScore} sem dó`;
  } else if (i.cleanSheet) {
    headline = 'MURALHA';
    tagline = `${i.homeScore}–0 e ninguém passou`;
  } else if (i.streak >= 3) {
    headline = `${i.streak} SEGUIDAS`;
    tagline = 'a sequência não para';
  } else if (i.won) {
    headline = 'VITÓRIA';
    tagline = `${i.homeScore}–${i.awayScore} no placar`;
  } else if (i.draw) {
    headline = 'BATALHA';
    tagline = `${i.homeScore}–${i.awayScore} dividido`;
  } else {
    headline = 'FOI GUERRA';
    tagline = `${i.homeScore}–${i.awayScore} no fim`;
  }

  return { headline, tagline, oneInX, tier, shareWorthy: tier >= 1 };
}
