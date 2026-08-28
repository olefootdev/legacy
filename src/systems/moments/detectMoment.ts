/**
 * detectMoment.ts — DETECTOR DE MOMENTO (Fase 2).
 *
 * Promoção do antigo `src/match/quickRarity.ts`, que já classificava desfecho
 * em comum/raro/épico/lendário, escrevia a manchete editorial e calculava o
 * "1 em X partidas" — mas vivia trancado na Partida Rápida. As outras três
 * competições do jogo (Liga Ole, Legends Cup, Liga Global) fechavam grandes
 * feitos sem que nada os reconhecesse.
 *
 * Aqui a mesma matemática atende as quatro. A conta da Partida Rápida NÃO
 * mudou (o shim em `match/quickRarity.ts` reexporta daqui e os multiplicadores
 * de competição são neutros em `quick`) — o que entrou foi o peso de CONTEXTO:
 * uma final vale mais que uma oitava, e um título vale mais que uma vitória.
 *
 * O índice "1 em X" é LÚDICO, não estatístico: multiplica fatores improváveis
 * pra dar escala a um feito. A UI sempre rotula como "estimada".
 *
 * PURO e determinístico — sem Date/Math.random.
 */

export type MomentCompetition = 'quick' | 'liga-ole' | 'legends-cup' | 'global';

/** Fase do mata-mata, quando houver. Ordena do mais raso ao mais fundo. */
export type MomentStage = 'group' | 'round16' | 'quarter' | 'semi' | 'final';

export interface MomentInput {
  competition: MomentCompetition;
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
  /** Fase do mata-mata — só nas competições que têm chave. */
  stage?: MomentStage;
  /** Este resultado levantou a taça / fechou a temporada como campeão. */
  isTitle?: boolean;
  /** Decidido nos pênaltis — o roteiro mais compartilhável do futebol. */
  wentToPens?: boolean;
}

export type MomentTier = 0 | 1 | 2 | 3; // comum / raro / épico / lendário

export interface Moment {
  /** Manchete do momento (Moret) — ex.: "VIRADA HISTÓRICA". */
  headline: string;
  /** Linha de apoio curta — ex.: "de 0–2 a 3–2". */
  tagline: string;
  /** "1 em X partidas" — quão improvável é este desfecho. */
  oneInX: number;
  tier: MomentTier;
  /** true quando vale a pena empurrar o compartilhamento (raro+). */
  shareWorthy: boolean;
  competition: MomentCompetition;
  /** Rótulo pt-BR da competição — usado na tarja do card. */
  competitionLabel: string;
}

const TIER_LABEL = ['Comum', 'Raro', 'Épico', 'Lendário'] as const;

export function momentTierLabel(tier: MomentTier): string {
  return TIER_LABEL[tier];
}

const COMPETITION_LABEL: Record<MomentCompetition, string> = {
  'quick': 'Partida Rápida',
  'liga-ole': 'Liga Ole · Mata-mata dos 32',
  'legends-cup': 'Legends Cup',
  'global': 'Liga Global',
};

export function momentCompetitionLabel(c: MomentCompetition): string {
  return COMPETITION_LABEL[c];
}

/** Peso da fase: quanto mais fundo na chave, mais raro é o feito. */
const STAGE_MULTIPLIER: Record<MomentStage, number> = {
  group: 1,
  round16: 1.5,
  quarter: 2,
  semi: 3,
  final: 5,
};

const STAGE_LABEL: Record<MomentStage, string> = {
  group: 'na fase de grupos',
  round16: 'nas oitavas',
  quarter: 'nas quartas',
  semi: 'na semifinal',
  final: 'na final',
};

/**
 * Classifica um desfecho.
 *
 * A base (goleada, virada, clean sheet, hat-trick, sequência, domínio) é a
 * calibração original da Partida Rápida, preservada intacta. Por cima dela
 * entram os multiplicadores de contexto — neutros quando não há chave nem taça.
 */
export function detectMoment(i: MomentInput): Moment {
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

  // ── Contexto: fase, taça e pênaltis ──────────────────────────────────────
  // Só pesam quando o resultado foi BOM: perder na final não é feito raro.
  if (i.won || i.isTitle) {
    if (i.stage) x *= STAGE_MULTIPLIER[i.stage];
    // Taça pesa mais que hat-trick (×10): é o feito mais raro do catálogo.
    if (i.isTitle) x *= 12;
    if (i.wentToPens) x *= 2;
  }

  const oneInX = Math.max(1, Math.round(x));
  let tier: MomentTier = oneInX >= 200 ? 3 : oneInX >= 50 ? 2 : oneInX >= 10 ? 1 : 0;

  // PISO DO TÍTULO — decisão de produto, não de matemática: levantar taça nunca
  // é "comum" nem "raro". Um 1–0 magro na final continua sendo o dia em que o
  // manager ganhou tudo, e merece o card. Sem esse piso, um título apertado
  // caía em raro e não abria compartilhamento.
  if (i.isTitle && tier < 2) tier = 2;

  // Manchete: prioriza o feito mais "contável". Título vem antes de tudo —
  // é a única linha que o manager quer ver primeiro.
  let headline: string;
  let tagline: string;
  if (i.isTitle) {
    headline = 'É CAMPEÃO';
    tagline = i.wentToPens
      ? `${i.homeScore}–${i.awayScore} e a taça nos pênaltis`
      : `${i.homeScore}–${i.awayScore} na decisão`;
  } else if (i.hattrick) {
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

  // A fase entra na tagline quando ela ainda não conta essa história.
  if (i.stage && !i.isTitle && (i.won || i.stage === 'final')) {
    tagline = `${tagline} ${STAGE_LABEL[i.stage]}`;
  }

  return {
    headline,
    tagline,
    oneInX,
    tier,
    shareWorthy: tier >= 1,
    competition: i.competition,
    competitionLabel: COMPETITION_LABEL[i.competition],
  };
}
