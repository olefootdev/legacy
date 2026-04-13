/** OLEFOOT GAME — tipos centrais compartilhados */

export type PlayerArchetype =
  | 'profissional'
  | 'novo_talento'
  | 'lenda'
  | 'meme'
  | 'ai_plus';

export type TacticalZone =
  | 'defesa'
  | 'meio'
  | 'ataque'
  | 'lateral_esq'
  | 'lateral_dir'
  | 'gol';

export type PlayerBehavior = 'equilibrado' | 'ofensivo' | 'defensivo' | 'criativo';

/** Pé preferencial — Admin CREATE PLAYER + ficha */
export type PlayerStrongFoot = 'right' | 'left' | 'both';

/**
 * Tipo de jogador (wizard Admin passo 4) — metadado de produto/carta.
 * Distinto de `archetype`, usado pelo motor (ex.: profissional, meme).
 */
export type PlayerCreatorType = 'novo_talento' | 'campeao' | 'amador' | 'olefoot' | 'lenda';

/** Raridade da ficha / carta */
export type PlayerRarity =
  | 'normal'
  | 'premium'
  | 'bronze'
  | 'prata'
  | 'ouro'
  | 'raro'
  | 'ultra_raro'
  | 'epico';

/**
 * Coleção estilo NFT (off-chain): teto global de unidades somadas em todas as cartas da coleção.
 * Persistida em `OlefootGameState.cardCollections`.
 */
export interface CardCollection {
  id: string;
  name: string;
  /** Soma máxima permitida de `cardSupply` de todos os jogadores com este `collectionId`. */
  maxSupply: number;
  createdAt: string;
}

export interface PlayerAttributes {
  passe: number;
  marcacao: number;
  velocidade: number;
  drible: number;
  finalizacao: number;
  fisico: number;
  tatico: number;
  mentalidade: number;
  confianca: number;
  fairPlay: number;
}

export interface PlayerEntity {
  id: string;
  num: number;
  name: string;
  /** Rótulo curto de posição (ATA, MC, GOL…) — alinhado à UI atual */
  pos: string;
  archetype: PlayerArchetype;
  zone: TacticalZone;
  behavior: PlayerBehavior;
  attrs: PlayerAttributes;
  /** 0–100, condição para partida */
  fatigue: number;
  /** 0–100, risco acumulado (substituições, viagem) */
  injuryRisk: number;
  evolutionXp: number;
  /** Partidas em que não pode entrar (lesão curta) */
  outForMatches: number;
  /** Foto do jogador (data URL ou URL https) — Admin CREATE PLAYER */
  portraitUrl?: string;
  /** Valor de mercado em centavos de BRO (0,01 BRO) — mercado / transferências */
  marketValueBroCents?: number;
  /** País (texto livre) */
  country?: string;
  /** Pé bom */
  strongFoot?: PlayerStrongFoot;
  /** Tipo de jogador (Novo talento, Campeão, …) — passo 4 Admin */
  creatorType?: PlayerCreatorType;
  /** Raridade (normal, ouro, épico, …) — passo 4 Admin */
  rarity?: PlayerRarity;
  /** Coleção (NFT-style off-chain) — ver `CardCollection` */
  collectionId?: string;
  /** Unidades desta carta de jogador emitidas na coleção (somam até `maxSupply` da coleção). */
  cardSupply?: number;
  /** “Quem sou eu” — texto livre (prompt / narrativa) */
  bio?: string;
  /** Listado no mercado (Admin “Lançar no Mercado”) */
  listedOnMarket?: boolean;
  /** Prospect criado pelo manager no fluxo Academia OLE (OVR criação / evolução limitados). */
  managerCreated?: boolean;
  /** Idade exibida / narrativa (plantel criado pelo manager). */
  age?: number;
  /** OVR na criação do cartão (Admin: tecto de crescimento = mint + 15). */
  mintOverall?: number;
  /** Multiplicador de ganho/perda de evolução (treino, jogo); 1 = normal. */
  evolutionRate?: number;
}

export interface OpponentStub {
  id: string;
  name: string;
  shortName: string;
  strength: number;
  /** Jogador destaque para UI (banner, pré-jogo); se omitido, o banner usa `strength` como OVR. */
  highlightPlayer?: { name: string; ovr: number };
  /** Escudo “do coração” do clube adversário (ex.: demo TITANS FC → Real Madrid) no matchday / partida rápida. */
  supporterCrestUrl?: string | null;
}

export interface Fixture {
  id: string;
  kickoffLabel: string;
  venue: string;
  competition: string;
  homeName: string;
  awayName: string;
  opponent: OpponentStub;
  isHome: boolean;
}

export interface PastResult {
  home: string;
  away: string;
  scoreHome: number;
  scoreAway: number;
  status: string;
  result: 'win' | 'draw' | 'loss';
  /** ID da partida no Supabase (quando persistida). */
  supabaseMatchId?: string;
}

export interface FinanceState {
  /**
   * Saldo EXP gastável — única métrica do ranking mundial de EXP (`exp_balance`).
   * Nome `ole` mantido por compatibilidade com saves existentes.
   */
  ole: number;
  /** EXP ganho acumulado (conquistas / perfil); não entra na ordenação do ranking. */
  expLifetimeEarned?: number;
  /** Histórico de movimentações de EXP (ganho e gasto). */
  expHistory?: Array<{
    id: string;
    amount: number;
    source: string;
    createdAt: string;
  }>;
  /** BRO em centavos (0,01 BRO); paridade de referência de produto 1 BRO ≈ 1 USD. */
  broCents: number;
  broLifetimeInCents?: number;
  broLifetimeOutCents?: number;
  /**
   * Tesouraria da plataforma (taxas de desafio amistoso em BRO, etc.).
   * Configuração de destino final fica no Admin.
   */
  companyTreasuryBroCents?: number;
  /** Prêmio em BRO retido até liquidação do desafio (MVP cliente). */
  friendlyChallengeEscrowBroCents?: number;
  /** Wallet Financial Hub — estado completo (OLEXP, Referrals, GAT, Ledger). */
  wallet?: import('@/wallet/types').WalletState;
}

export interface CrowdState {
  supportPercent: number;
  moodLabel: string;
}

/** W vitória, D empate, L derrota (padrão W-D-L) */
export type FormLetter = 'W' | 'D' | 'L';

export interface ClubEntity {
  id: string;
  name: string;
  shortName: string;
  city: string;
  stadium: string;
}

export interface ClubLogisticsState {
  /** km do último deslocamento aplicado à equipe (narrativa / fadiga) */
  lastTripKm: number;
}
