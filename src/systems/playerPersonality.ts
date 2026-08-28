/**
 * playerPersonality.ts — PERSONALIDADE MÍNIMA (Fase 4).
 *
 * O jogador do OLEFOOT era um card com números. O `AgentProfile` que já existe
 * é rico, mas serve ao MOTOR (espaço, risco, decisão em campo) — não à mesa do
 * manager. Faltava a camada humana: por que ESTE jogador viria falar com você.
 *
 * Escolhemos TRÊS traços, não nove. Cada um se paga em comportamento visível;
 * o resto seria planilha.
 *
 *   AMBIÇÃO   — quer palco maior. Jovem e bom é ambicioso.
 *   LEALDADE  — quer fazer história aqui. Tempo de casa e minutos criam vínculo.
 *   EGO       — mede-se pelo plantel. Muito acima da média, cobra tratamento.
 *
 * Nada de dado novo, nada de migration: os três são DERIVADOS de campos que já
 * existem (`age`, `mintOverall`, OVR atual, média do plantel, jogos disputados).
 * Determinístico — o mesmo jogador no mesmo estado dá sempre os mesmos números,
 * sem Math.random e sem Date.
 */

export interface PersonalityInput {
  playerId: string;
  /** Idade narrativa. Ausente = trata como 26 (meio de carreira). */
  age?: number;
  /** OVR atual. */
  overall: number;
  /** OVR de emissão do card — a referência de quanto ele já cresceu. */
  mintOverall?: number;
  /** Média de OVR do plantel — o espelho em que o ego se mede. */
  squadAverageOverall: number;
  /** Jogos disputados na temporada (playerSeasonLedger). */
  matchesPlayed: number;
  /** Jogos que o CLUBE disputou na temporada — a régua dos minutos. */
  clubMatchesPlayed: number;
}

export interface PlayerPersonality {
  /** 0–100. Alto = quer competição maior, aceita menos o banco. */
  ambicao: number;
  /** 0–100. Alto = quer ficar e construir história aqui. */
  lealdade: number;
  /** 0–100. Alto = cobra status compatível com o que entrega. */
  ego: number;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));

/** Fração de jogos do clube em que o jogador entrou (0–1). */
export function minutesShare(matchesPlayed: number, clubMatchesPlayed: number): number {
  if (clubMatchesPlayed <= 0) return 0;
  return Math.max(0, Math.min(1, matchesPlayed / clubMatchesPlayed));
}

/**
 * Deriva os três traços. PURO.
 *
 * Ambição: juventude + margem de crescimento (quanto ainda pode subir acima do
 * mint) empurram pra cima; veterano consolidado se acomoda.
 * Lealdade: minutos jogados criam vínculo; ambição alta corrói.
 * Ego: distância pra média do plantel, com piso pra craque de verdade.
 */
export function derivePersonality(i: PersonalityInput): PlayerPersonality {
  const age = i.age ?? 26;
  const share = minutesShare(i.matchesPlayed, i.clubMatchesPlayed);

  // Juventude: 18 anos → 100, 34+ → 0.
  const youth = clamp(((34 - age) / 16) * 100);
  // Margem de crescimento: o quanto já subiu desde a emissão do card.
  const grown = i.mintOverall != null ? clamp((i.overall - i.mintOverall) * 6) : 30;

  const ambicao = clamp(youth * 0.6 + grown * 0.4);

  // Lealdade cresce com minutos e cai com ambição. Base 45 — ninguém nasce
  // nem apaixonado nem mercenário.
  const lealdade = clamp(45 + share * 45 - ambicao * 0.25);

  // Ego: quanto está acima da média do plantel (cada ponto de OVR pesa 4).
  const gap = i.overall - i.squadAverageOverall;
  const ego = clamp(45 + gap * 4);

  return { ambicao, lealdade, ego };
}

// ─── Pedido do jogador ──────────────────────────────────────────────────────

export type PlayerRequestKind = 'minutes' | 'ambition' | 'respect';

/** As três respostas possíveis. Cada uma cobra um preço diferente. */
export type PlayerRequestChoice = 'grant' | 'challenge' | 'promise';

export interface PlayerRequest {
  /** Estável por jogador + tipo: impede pedido duplicado na fila. */
  id: string;
  playerId: string;
  playerName: string;
  kind: PlayerRequestKind;
  /** Fala do jogador, em pt-BR. */
  quote: string;
  createdAt: number;
}

/** Limiares de insatisfação. Acima daqui, o jogador abre a boca. */
const MINUTES_FLOOR = 0.4;
const ANSIOSO = 60;
const CLUB_MATCHES_MIN = 3;

/**
 * Decide se este jogador tem algo a dizer — e o quê.
 *
 * Ordem importa: quem joga pouco reclama de minutos antes de qualquer coisa.
 * Só depois vêm o ambicioso que quer palco maior e o craque que quer status.
 * Devolve `null` quando o jogador está satisfeito (o caso comum).
 */
export function detectPlayerRequest(
  args: {
    playerId: string;
    playerName: string;
    personality: PlayerPersonality;
    matchesPlayed: number;
    clubMatchesPlayed: number;
    /** Relação atual manager↔jogador (0–100). Boa relação segura a reclamação. */
    relation: number;
    now: number;
  },
): PlayerRequest | null {
  const { personality: p, playerName, playerId } = args;
  // Temporada curta demais pra alguém cobrar minutos.
  if (args.clubMatchesPlayed < CLUB_MATCHES_MIN) return null;
  // Relação forte compra paciência.
  if (args.relation >= 85) return null;

  const share = minutesShare(args.matchesPlayed, args.clubMatchesPlayed);
  const mk = (kind: PlayerRequestKind, quote: string): PlayerRequest => ({
    id: `req_${playerId}_${kind}`,
    playerId,
    playerName,
    kind,
    quote,
    createdAt: args.now,
  });

  if (share < MINUTES_FLOOR && (p.ego >= ANSIOSO || p.ambicao >= ANSIOSO)) {
    return mk('minutes', 'Quero começar a próxima partida. Estou pronto.');
  }
  if (p.ambicao >= 75 && p.lealdade < 45) {
    return mk('ambition', 'Quero disputar competições maiores. Aqui dá pra sonhar mais alto?');
  }
  if (p.ego >= 80 && share >= MINUTES_FLOOR) {
    return mk('respect', 'Carrego esse time. Queria sentir isso no meu tratamento.');
  }
  return null;
}

// ─── Consequência da escolha ────────────────────────────────────────────────

export interface RequestOutcome {
  /** Delta na relação manager↔jogador (`managerRelationByPlayer`). */
  relationDelta: number;
  /** Delta na moral do jogador (`playerMoral`). */
  moralDelta: number;
  /** Resposta do manager, em pt-BR — vira o corpo da mensagem no inbox. */
  reply: string;
}

/**
 * O preço de cada resposta.
 *
 * DAR CHANCE compra relação e moral na hora — e é a única que custa alguma
 * coisa ao time (o manager se compromete). MANDAR CONQUISTAR é honesto e
 * áspero: perde relação, mas não mente. PROMETER agrada agora e não resolve —
 * ganha pouco dos dois lados, e o pedido volta.
 *
 * Ninguém aqui é "a escolha certa": é a lógica de halo/chifres do clubDna
 * aplicada à mesa do manager.
 */
export function resolveRequest(kind: PlayerRequestKind, choice: PlayerRequestChoice): RequestOutcome {
  switch (choice) {
    case 'grant':
      return {
        relationDelta: 8,
        moralDelta: 10,
        reply: kind === 'minutes'
          ? 'Você começa a próxima. A vaga é sua pra perder.'
          : 'Combinado. Você vai sentir a diferença.',
      };
    case 'challenge':
      return {
        relationDelta: -5,
        moralDelta: -6,
        reply: 'Vaga aqui se conquista no treino. Mostra que é seu.',
      };
    case 'promise':
      return {
        relationDelta: 2,
        moralDelta: 3,
        reply: 'Sua hora vem. Segura a ansiedade e continua trabalhando.',
      };
  }
}

/** Rótulo curto pt-BR de cada escolha — botões da UI. */
export const CHOICE_LABEL: Record<PlayerRequestChoice, string> = {
  grant: 'Dar chance',
  challenge: 'Conquistar vaga',
  promise: 'Prometer minutos',
};
