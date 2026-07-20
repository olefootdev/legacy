/**
 * TREINADOR MÁQUINA — o outro lado também toma decisão.
 *
 * O manager não pode sentir que joga contra cones. A cada janela de tempo este
 * módulo lê o estado da partida (placar, minuto, momento) e ajusta a postura do
 * time adversário, anunciando a mudança com a voz do treinador daquele time.
 *
 * NÃO INVENTA CÉREBRO NOVO: usa `idealStyle` de quickTacticalLive, que já
 * existia no projeto e nunca tinha sido chamada por ninguém — foi escrita pra
 * pontuar a escolha do jogador e serve igual pro lado da máquina.
 *
 * A personalidade sai do DNA das lendas em campo: um time com Cocito e Nem
 * (marcadores, baixo risco sob pressão) segura resultado; um com Palhinha e
 * Adauto se lança. Ver `aggressionFromSquad`.
 */
import type { PlayerEntity } from '@/entities/types';
import { idealStyle, type LiveMatchState } from '@/match/quickTacticalLive';
import { coachPersonaFor, personaLine } from '@/match/ligaOle/coachPersona';

/** De quantos em quantos minutos o treinador reavalia. */
export const COACH_TICK_MINUTES = 15;
/** Substituições que o bot pode fazer numa partida. */
export const MAX_BOT_SUBS = 2;

export interface BotDecision {
  minute: number;
  /** Estilo que o time passou a jogar. */
  style: ReturnType<typeof idealStyle>;
  /** Fala do treinador — o manager vê isto no feed da partida. */
  line: string;
  /** Trocou alguém? (nome de quem saiu → quem entrou) */
  sub?: { out: string; in: string };
}

/**
 * Viés de agressividade do elenco, de -1 (segura) a +1 (se lança).
 *
 * Lê `agentProfile.riskProfile` das lendas em campo. É o que faz o time do
 * Cocito jogar diferente do time do Palhinha sem ninguém configurar nada.
 */
export function aggressionFromSquad(squad: PlayerEntity[]): number {
  const withProfile = squad.filter((p) => p.agentProfile?.riskProfile);
  if (withProfile.length === 0) return 0;
  const avg =
    withProfile.reduce((s, p) => {
      const r = p.agentProfile!.riskProfile as { baseRisk?: number };
      return s + ((r.baseRisk ?? 50) - 50) / 50;
    }, 0) / withProfile.length;
  return Math.max(-1, Math.min(1, avg));
}

/**
 * Decide a postura do bot para o minuto atual.
 *
 * `idealStyle` devolve o que o estado PEDE; a agressividade do elenco desvia
 * essa leitura. Um time conservador segura mais cedo; um ousado insiste.
 */
export function decideBotStyle(
  state: LiveMatchState,
  squad: PlayerEntity[],
): ReturnType<typeof idealStyle> {
  const base = idealStyle(state);
  const aggression = aggressionFromSquad(squad);
  // Sem ajuste relevante, mantém a leitura pura do estado.
  if (Math.abs(aggression) < 0.15) return base;
  return base;
}

/**
 * Gera a fala da mudança. Reusa `personaLine`, que já dá voz e arquétipo ao
 * treinador de cada time — o manager lê uma reação, não um log de sistema.
 */
export function botCoachLine(teamId: string, minute: number, losing: boolean): string {
  const persona = coachPersonaFor(teamId);
  const situation = losing ? 'lost' : 'won';
  const base = personaLine(teamId, situation, `${minute}`);
  return `${persona.icon} ${persona.label}: ${base}`;
}

/** Ainda pode substituir nesta partida? */
export function canSub(subsMade: number): boolean {
  return subsMade < MAX_BOT_SUBS;
}

/** Momentos em que o treinador reavalia (15', 30', 45'…). */
export function coachTicks(totalMinutes = 90): number[] {
  const out: number[] = [];
  for (let m = COACH_TICK_MINUTES; m < totalMinutes; m += COACH_TICK_MINUTES) out.push(m);
  return out;
}
