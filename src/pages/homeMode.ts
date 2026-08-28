/**
 * homeMode.ts — A HOME REAGE AO ESTADO DO CLUBE.
 *
 * O problema não era a Home ser um "dashboard": era ela ser ESTÁTICA. Doze
 * blocos na mesma ordem sempre — dia de jogo ou não, com proposta na mesa ou
 * não, em crise ou em festa.
 *
 * Aqui NÃO se cria bloco nenhum. Só se decide, a partir do estado que a Home
 * já lê, QUAL bloco sobe pro topo. Cinco modos, precedência fixa:
 *
 *   celebration > matchday > crisis > offer > normal
 *
 * A festa ganha porque é efêmera (o flash some no próximo tick). Depois o
 * relógio (partida tem hora marcada). Depois o que dói. Depois o que rende.
 *
 * PURO e determinístico — o `nowMs` entra por parâmetro, nunca `Date.now()`
 * aqui dentro, pra ser testável.
 */

export type HomeMode = 'celebration' | 'matchday' | 'crisis' | 'offer' | 'normal';

/** Janela em que a próxima partida domina a Home. */
export const MATCHDAY_WINDOW_MS = 90 * 60 * 1000;

export interface HomeModeInput {
  /** Kickoff da próxima partida da Liga Global (ms epoch). Null = sem jogo marcado. */
  nextKickoffMs: number | null;
  /** Propostas de compra recebidas (P2P) pendentes. */
  incomingOffersCount: number;
  /** Jogadores suspensos agora. */
  suspendedCount: number;
  /** Contratos esgotados (não entram no XI oficial). */
  expiredCount: number;
  /** Jogadores indisponíveis por lesão. */
  injuredCount: number;
  /** Houve título/eliminação recente ainda não visto (flash da Liga Ole ou Legends Cup). */
  hasResultFlash: boolean;
  nowMs: number;
}

/** A partir de quantas pendências o clube entra em modo crise. */
const CRISIS_THRESHOLD = 3;

/**
 * Decide o modo da Home. Precedência documentada acima.
 *
 * `matchday` só vale pra partida FUTURA dentro da janela — um kickoff que já
 * passou não segura o topo da Home (a rodada é processada em outro lugar).
 */
export function resolveHomeMode(input: HomeModeInput): HomeMode {
  if (input.hasResultFlash) return 'celebration';

  if (input.nextKickoffMs != null) {
    const untilKickoff = input.nextKickoffMs - input.nowMs;
    if (untilKickoff >= 0 && untilKickoff <= MATCHDAY_WINDOW_MS) return 'matchday';
  }

  const pending = input.suspendedCount + input.expiredCount + input.injuredCount;
  if (pending >= CRISIS_THRESHOLD) return 'crisis';

  if (input.incomingOffersCount > 0) return 'offer';

  return 'normal';
}

/** Blocos reordenáveis da Home. Nomes = os componentes que JÁ existem. */
export type HomeBlock =
  | 'playerRequest'
  | 'nextMatch'
  | 'managerDesk'
  | 'feed'
  | 'slider'
  | 'managerOfDay'
  | 'legends'
  | 'rankingTop10'
  | 'divisionRanking'
  | 'lastChampion'
  | 'inheritance'
  | 'resenha'
  | 'referralAndMissions';

/**
 * Ordem dos blocos por modo. O hero fica sempre em 1º (é o cockpit); o que
 * muda é o que vem logo depois dele.
 *
 * Regra de leitura: o topo carrega o que EXIGE decisão agora; o rodapé carrega
 * o que é vitrine. Nenhum bloco desaparece — todos continuam na lista.
 */
const ORDER_BY_MODE: Record<HomeMode, readonly HomeBlock[]> = {
  // O pedido do jogador nunca é o 1º: quem manda no topo é o que tem hora
  // marcada ou o que acabou de acontecer. Ele entra logo DEPOIS — perto o
  // bastante pra ser respondido na mesma sessão.
  //
  // Título/eliminação fresquinho: a festa (ou o luto) primeiro, depois o feed.
  celebration: [
    'lastChampion', 'playerRequest', 'feed', 'nextMatch', 'managerDesk', 'slider',
    'rankingTop10', 'divisionRanking', 'managerOfDay', 'legends',
    'inheritance', 'resenha', 'referralAndMissions',
  ],
  // Tem hora marcada: partida no topo, elenco logo abaixo (dá tempo de mexer).
  matchday: [
    'nextMatch', 'playerRequest', 'managerDesk', 'feed', 'divisionRanking', 'slider',
    'rankingTop10', 'managerOfDay', 'legends', 'lastChampion',
    'inheritance', 'resenha', 'referralAndMissions',
  ],
  // Plantel quebrado: a mesa do manager vira a primeira coisa da tela.
  crisis: [
    'managerDesk', 'playerRequest', 'feed', 'nextMatch', 'slider', 'divisionRanking',
    'rankingTop10', 'managerOfDay', 'legends', 'lastChampion',
    'inheritance', 'resenha', 'referralAndMissions',
  ],
  // Dinheiro na mesa: proposta primeiro, mercado logo em seguida.
  offer: [
    'managerDesk', 'playerRequest', 'resenha', 'feed', 'nextMatch', 'slider',
    'rankingTop10', 'divisionRanking', 'managerOfDay', 'legends',
    'lastChampion', 'inheritance', 'referralAndMissions',
  ],
  // Dia comum: a ordem editorial original.
  normal: [
    'playerRequest', 'slider', 'nextMatch', 'feed', 'managerOfDay', 'legends',
    'rankingTop10', 'managerDesk', 'divisionRanking', 'lastChampion',
    'inheritance', 'resenha', 'referralAndMissions',
  ],
};

export function blockOrderFor(mode: HomeMode): readonly HomeBlock[] {
  return ORDER_BY_MODE[mode];
}

/** Rótulo curto pt-BR do modo — usado em telemetria e debug, não na UI. */
export function homeModeLabel(mode: HomeMode): string {
  switch (mode) {
    case 'celebration': return 'Festa';
    case 'matchday': return 'Dia de jogo';
    case 'crisis': return 'Crise no elenco';
    case 'offer': return 'Proposta na mesa';
    case 'normal': return 'Dia comum';
  }
}
