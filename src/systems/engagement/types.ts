/**
 * OLEFOOT PYTHON MODE — Tipos do Sistema E (Engajamento).
 *
 * Rastreia presença do manager, calcula penalidades por ausência e
 * gerencia o ciclo de bônus 3h/1h. Foco: trazer o manager de volta
 * 3-5x por dia, sem ser invasivo.
 */

export interface ManagerPresence {
  managerId: string;
  /** Último timestamp em que o manager abriu o app. */
  lastLoginAt: number;
  /** Última vez que a sessão terminou (close/idle). */
  lastSessionEndAt?: number;
  /** Total de sessões desde o registro. */
  totalSessions: number;
  /** Último claim do bonus 3h/1h. */
  lastBonusClaimAt?: number;
  /** Slots de bonus reivindicados consecutivamente (sem perder janela). */
  bonusStreakSlots: number;
  /** Última vez que aplicamos penalidade de ausência. */
  absencePenaltyLastAppliedAt?: number;
  /** Última tier registrada — pra UI mostrar evolução. */
  lastAbsenceTier?: AbsenceTier;
  /** Score de engajamento 0-100 — buff de +0% a +20% na Liga Global. */
  engagementScore?: number;
}

export const EMPTY_PRESENCE = (managerId: string): ManagerPresence => ({
  managerId,
  lastLoginAt: Date.now(),
  totalSessions: 0,
  bonusStreakSlots: 0,
});

// ─── Absence ────────────────────────────────────────────────────────

export type AbsenceTier =
  | 'normal'        // <12h
  | 'warning_12h'   // 12-24h
  | 'mild_24h'      // 24-36h
  | 'moderate_36h' // 36-48h
  | 'heavy_48h'    // 48-72h
  | 'crisis_72h';  // 72h+

export interface AbsencePenaltyEffect {
  tier: AbsenceTier;
  /** Multiplicador no ganho de treino (1.0 = normal, 0 = parado). */
  trainingMultiplier: number;
  /** Atributos podem evoluir? */
  attrEvolutionEnabled: boolean;
  /** Pontos somados ao injury risk de todos jogadores. */
  injuryRiskAdditive: number;
  /** Fadiga regenera fora de partida? */
  fatigueRegenEnabled: boolean;
  /** Mercado processa atividade automática? */
  marketActivityEnabled: boolean;
  /** Quantas lesões leves aleatórias forçar nesta aplicação. */
  randomInjuryCount: number;
  /** Delta no apoio da torcida (%, negativo). */
  crowdSupportDelta: number;
  /** Apoio da torcida pode chegar a zero? */
  starPlayerDepartureRisk: boolean;
  /** Texto pt-BR pra UI. */
  message: string;
}

// ─── Login bonus ───────────────────────────────────────────────────

export type LoginBonusRewardKind =
  | 'exp_small'      // ~25K
  | 'exp_medium'     // ~100K
  | 'exp_large'      // ~400K
  | 'pack_basic'
  | 'pack_rare';

export interface LoginBonusReward {
  kind: LoginBonusRewardKind;
  expAmount?: number;
  label: string;
}

export interface LoginBonusClaimResult {
  /** Conseguiu reivindicar? */
  claimed: boolean;
  /** Razão de bloqueio se !claimed. */
  blockedReason?: 'too_soon' | 'no_session';
  /** Próximo claim possível (epoch ms). */
  nextClaimAt: number;
  /** Recompensa concedida (se claimed). */
  reward?: LoginBonusReward;
  /** Slot do dia em que claim aconteceu (0-based, pra debug). */
  slotIndex?: number;
  /** É fim de semana? */
  isWeekend?: boolean;
}

// ─── Quick hook (dicas aditivas) ────────────────────────────────────

export type QuickHookKind =
  | 'star_performing'      // "João tá voando — abre aí"
  | 'cliffhanger'          // "Algo aconteceu no vestiário..."
  | 'time_limited_offer'   // "Oferta pelo Pedro expira em 12min"
  | 'streak_preservation'  // "Não perca sua sequência de 7 dias"
  | 'match_starting'       // "Sua próxima partida em 3min"
  | 'rival_challenge';     // "[Rival] te ofereceu amistoso";

export interface QuickHook {
  id: string;
  kind: QuickHookKind;
  /** Texto curto pra notification/badge. */
  title: string;
  /** Texto complementar opcional. */
  body?: string;
  /** Slot mais apropriado pra disparar. */
  preferredSlotKind?: 'short' | 'long' | 'any';
  /** Janela em que o hook é relevante. */
  validFrom: number;
  validUntil: number;
  /** Route pra abrir quando manager clicar. */
  route?: string;
  /** Prioridade 0-100 — push picker usa pra escolher qual mostrar. */
  priority: number;
}
