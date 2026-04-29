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
  /**
   * @deprecated Use `state.playerHealth[id].fatigue` (SSOT). Mantido só durante migração.
   * Será removido após Fase 4 (engine in-match também ler do SSOT).
   */
  fatigue: number;
  /**
   * @deprecated Use `state.playerHealth[id].injuryRisk` (SSOT). Idem acima.
   */
  injuryRisk: number;
  evolutionXp: number;
  /**
   * @deprecated Use `state.playerHealth[id].outForMatches` (SSOT). Idem acima.
   */
  outForMatches: number;
  /** Foto do jogador formato card (data URL ou URL https) — Admin CREATE PLAYER */
  portraitUrl?: string;
  /** Foto circular para token na partida ao vivo (crop separado otimizado para 1:1) */
  portraitTokenUrl?: string;
  /** Valor de mercado em centavos de BRO (0,01 BRO) — mercado / transferências */
  marketValueBroCents?: number;
  /** Valor de mercado em EXP (ex.: catálogo Genesis); quando definido, UI e livro usam EXP em vez de BRO. */
  marketValueExp?: number;
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
  /** Tag de coleção admin-market (ex.: 'welcomepack'). Separado do collectionId NFT. */
  adminMarketTag?: string;
  /** Prospect criado pelo manager no fluxo Academia OLE (OVR criação / evolução limitados). */
  managerCreated?: boolean;
  /** Idade exibida / narrativa (plantel criado pelo manager). */
  age?: number;
  /** OVR na criação do cartão (Admin: tecto de crescimento = mint + 15). */
  mintOverall?: number;
  /** Multiplicador de ganho/perda de evolução (treino, jogo); 1 = normal. */
  evolutionRate?: number;
  /** Jogos restantes no contrato (amistoso + oficial); omitir = legado sem limite. */
  contractMatchesRemaining?: number;
  /** Jogos incluídos ao assinar (UI). */
  contractMatchesIncluded?: number;
  /** Contrato sem fim de jogos (só catálogo Admin / excepções). */
  contractIsLifetime?: boolean;
  /** Contrato esgotado — recomprar no mercado; não entra em XI oficial. */
  contractExpired?: boolean;
  /** Id no catálogo `genesis_market_players` (ex. GEN-001), sem prefixo `genesis-`. */
  genesisCatalogId?: string;
  /**
   * Conhecimento de posição acumulado via sessões de treino com agentes de lenda.
   * Contém pesos de ação por zona + traits comportamentais.
   * Zero tokens durante a partida — motor lê este JSON localmente.
   */
  positionKnowledge?: import('@/gamespirit/legacy/positionKnowledgeTypes').PositionKnowledge;
  /** Marca este jogador como Legacy DNA (comprado em loja, criado no admin). */
  isLegacy?: boolean;
  /** Booster numérico de time ativo quando este legacy é titular (ex.: {morale:3, possession_pct:5}). */
  legacyTeamBooster?: Record<string, number>;
  /** Atributos que este legacy ensina aos jogadores da mesma posição no elenco. */
  legacyTaughtAttributes?: string[];
  /** IDs de Coach Skills equipadas (ex.: ['skl_lateral_overlap_cross']). Max 3 skills ativas. */
  skills?: string[];
  /** Perfil de agente offline (comportamento, decisão, aprendizado) */
  agentProfile?: import('@/agents/types').AgentProfile;
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
  /**
   * Elenco visitante real (ex.: plantel Genesis de teste). Quando preenchido, partida rápida / test2d
   * usam estes jogadores no lugar do roster sintético (cérebro + atributos).
   */
  genesisAwayPlayers?: PlayerEntity[];
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
  /** MVP e top-3 de scout da partida. */
  scoutMvp?: import('@/gamespirit/scoutScoring').ScoutMvpEntry;
  scoutTop3?: import('@/gamespirit/scoutScoring').ScoutMvpEntry[];
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
  /** Disponibilidade para amistosos: ONLINE (aceita convites, impacta ranking) ou OFFLINE (só vs bots). */
  friendlyAvailability?: 'ONLINE' | 'OFFLINE';
  /** Aceita convites automaticamente quando ONLINE. */
  friendlyAutoAccept?: boolean;
}

export interface ClubLogisticsState {
  /** km do último deslocamento aplicado à equipe (narrativa / fadiga) */
  lastTripKm: number;
}
