/**
 * LEGENDS CUP — o manager enfrenta os times das lendas da OLEFOOT.
 *
 * Formato: 3 jogos de classificatória (bots Genesis) e depois mata-mata de 5
 * fases, cada uma com um time montado a partir dos cards REAIS de lenda que
 * estão no mercado. A cada fase entra mais lenda e o time fica mais forte.
 *
 * REUSO: roda no motor da Partida Rápida e espelha a estrutura da Liga Ole
 * (fases nomeadas, prêmio por fase, estado ativo/campeão/eliminado, crônica).
 * O que muda é o adversário — aqui não é manager real, é elenco de lenda.
 *
 * REGRA DO CARD (decisão do fundador): o card que entra no time adversário é
 * sempre o MELHOR das 3 fases de cada lenda. Ver LEGENDS_CUP_SQUADS.
 */

export const LEGENDS_CUP_ROUNDS = [
  'Classificatória',
  'Playoff',
  'Oitavas',
  'Quartas',
  'Semifinal',
  'Final',
] as const;

export type LegendsCupRound = (typeof LEGENDS_CUP_ROUNDS)[number];

/** Jogos da fase classificatória. Precisa vencer a maioria pra avançar. */
export const GROUP_MATCHES = 3;
export const GROUP_WINS_TO_ADVANCE = 2;

/**
 * Elenco de lenda por fase, por `collection_id` — não por id de card. O modelo
 * resolve o MELHOR card de cada coleção em runtime, então quando o fundador
 * lançar uma fase nova de alguém, o time do Cup acompanha sozinho.
 *
 * `null` na Classificatória = só Genesis, sem lenda.
 */
export const LEGENDS_CUP_SQUADS: Record<LegendsCupRound, string[] | null> = {
  'Classificatória': null,
  'Playoff': [
    'mem-juca-1970',
    'mem-nando-2026',
    'mem-johnson-macaba-2026',
    'mem-breno-liborge-2026',
  ],
  'Oitavas': [
    'mem-adauto-2026',
    'mem-willian-xavier-2026',
    'mem-nando-2026',
    'mem-johnson-macaba-2026',
    'mem-breno-liborge-2026',
  ],
  'Quartas': [
    'mem-adauto-2026',
    'mem-willian-xavier-2026',
    'mem-breno-liborge-2026',
    'mem-nem-lima-2026',
    'mem-cocito-2026',
  ],
  'Semifinal': [
    'mem-adauto-2026',
    'mem-willian-xavier-2026',
    'mem-nem-lima-2026',
    'mem-cocito-2026',
    'mem-breno-liborge-2026',
    'mem-nando-2026',
    'mem-marcelo-goncalves-2026',
  ],
  'Final': [
    'mem-adauto-2026',
    'mem-willian-xavier-2026',
    'mem-nem-lima-2026',
    'mem-cocito-2026',
    'mem-breno-liborge-2026',
    'mem-nando-2026',
    'mem-marcelo-goncalves-2026',
    'mem-palhinha-2026',
  ],
};

/**
 * Nome do time adversário de cada fase. É o que o manager vê antes de entrar —
 * a fase tem que soar como um degrau, não como "adversário 4".
 */
export const LEGENDS_CUP_OPPONENT_NAME: Record<LegendsCupRound, string> = {
  'Classificatória': 'Seletiva Genesis',
  'Playoff': 'Os Convocados',
  'Oitavas': 'Os Artilheiros',
  'Quartas': 'A Muralha',
  'Semifinal': 'Os Campeões',
  'Final': 'Os Imortais',
};

/**
 * Um time tem 11. As lendas cobrem as posições delas; o resto é preenchido com
 * Genesis. Sem isto, o Playoff entraria em campo com 2 atacantes, 1 meia e 1
 * lateral — sem goleiro e sem zaga.
 */
export const SQUAD_SIZE = 11;

export interface LegendsCupState {
  seed: string;
  /** 0 = Classificatória … 5 = Final. */
  roundIndex: number;
  /** Vitórias e jogos na classificatória (só usados na fase 0). */
  groupWins: number;
  groupPlayed: number;
  status: 'active' | 'champion' | 'eliminated';
  /** Até onde chegou — preenchido na eliminação ou no título. */
  reachedRound: LegendsCupRound;
  /**
   * Nº da campanha deste manager (1 = primeira). Define o multiplicador de EXP:
   * o card exclusivo só sai na PRIMEIRA vez que a fase é vencida; da segunda
   * campanha em diante o prêmio é só EXP, dobrado.
   */
  runNumber: number;
}

export function roundOf(index: number): LegendsCupRound {
  const i = Math.max(0, Math.min(LEGENDS_CUP_ROUNDS.length - 1, index));
  return LEGENDS_CUP_ROUNDS[i]!;
}

export function isFinalRound(index: number): boolean {
  return index >= LEGENDS_CUP_ROUNDS.length - 1;
}

/** Estado inicial de uma campanha. */
export function createLegendsCupState(seed: string, runNumber = 1): LegendsCupState {
  return {
    seed,
    roundIndex: 0,
    groupWins: 0,
    groupPlayed: 0,
    status: 'active',
    reachedRound: 'Classificatória',
    runNumber: Math.max(1, Math.floor(runNumber)),
  };
}

/**
 * Aplica o resultado de uma partida e devolve o estado novo.
 *
 * Classificatória: 3 jogos, precisa de 2 vitórias. Elimina quando não há mais
 * como alcançar (2 derrotas). Mata-mata: derrota elimina na hora.
 */
export function applyMatchResult(state: LegendsCupState, won: boolean): LegendsCupState {
  if (state.status !== 'active') return state;
  const s = { ...state };

  if (s.roundIndex === 0) {
    s.groupPlayed += 1;
    if (won) s.groupWins += 1;
    const losses = s.groupPlayed - s.groupWins;
    if (s.groupWins >= GROUP_WINS_TO_ADVANCE) {
      s.roundIndex = 1;
      s.reachedRound = roundOf(1);
    } else if (losses > GROUP_MATCHES - GROUP_WINS_TO_ADVANCE) {
      s.status = 'eliminated';
    }
    return s;
  }

  if (!won) {
    s.status = 'eliminated';
    return s;
  }
  if (isFinalRound(s.roundIndex)) {
    s.status = 'champion';
    s.reachedRound = 'Final';
    return s;
  }
  s.roundIndex += 1;
  s.reachedRound = roundOf(s.roundIndex);
  return s;
}
