import type { CardCollection, ClubEntity, PlayerEntity } from '@/entities/types';
import type {
  ManagerProspectArtRequest,
  ManagerProspectConfig,
  ManagerProspectMarketState,
  OlefootGameState,
  PlayerCreationStep,
} from './types';
import type { ManagerProspectHeritageBrief, ManagerProspectPortraitStyleRegion } from '@/entities/managerProspect';
import { PORTRAIT_STYLE_REGION_LABELS } from '@/entities/managerProspect';
import { createInitialGameState } from './initialState';
import { normalizeFixture } from '@/entities/team';
import { buildDefaultLineup, mergeLineupWithDefaults } from '@/entities/lineup';
import { createInitialWalletState, normalizeWalletState } from '@/wallet/initial';
import { createInitialLeagueSeason } from '@/match/leagueSeason';
import { createInitialStaffState } from '@/systems/staff';
import { migrateTacticalStyle } from '@/tactics/playingStyle';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import type { SocialState } from '@/social/types';
import { pickHomeCaptainPlayerId } from '@/match/impactRules';
import { clampPlayerToEvolutionCap, ensureMintOverall } from '@/entities/playerEvolution';
import { filterLegacyPlacarFromInbox, hydrateInboxList } from './inboxItem';
import { createHomeInboxSeedExamples } from './homeInboxSeedExamples';
import { inboxHasVisibleHomeFeedItem } from './inboxTypes';
import { mergeSwapKycIntoWallet } from '@/wallet/swapKycStorage';
import { defaultUserSettings } from '@/settings/defaultUserSettings';
import { createDefaultAdminLeagues, hydrateAdminLeagues } from '@/match/adminLeagues';
import { hydrateUiBanners } from '@/ui/banners';
import {
  buildRoundRobinSchedule,
  createEmptyLeagueScheduleState,
  type LeagueScheduleState,
  type ScheduledLeagueFixture,
} from '@/match/leagueSchedule';
import type { ExpExchangeOrder, ExpExchangeState } from '@/economy/expExchange';
import { seedNpcExpExchangeOrders } from '@/economy/expExchange';
import { sanitizePlayerSeasonLedger } from '@/team/playerSeasonLedger';
import { sanitizePlayerEvolutionTimeline } from '@/team/playerEvolutionTimeline';
import { healthFromLegacyPlayer, recomputeAtRisk, emptyHealth } from '@/systems/playerHealth/reducer';
import type { PlayerHealth } from '@/systems/playerHealth/types';
import { hydrateLegacyGenesisContract } from '@/playerContracts/playerContracts';
import { defaultShopCatalog, normalizeShopCatalog } from './shopCatalog';
import { generateMissingAgentProfiles } from '@/agents/agentProfileLoader';
import { createDefaultCoachAgent } from '@/coach/defaultCoach';

const KEY = 'olefoot-game-v1';

/** Escalação só com ids que existem no plantel; preenche slots em falta. */
function sanitizeLineupForRoster(
  saved: Record<string, string>,
  playersById: Record<string, PlayerEntity>,
): Record<string, string> {
  const base = buildDefaultLineup(playersById);
  const kept: Record<string, string> = {};
  for (const [slot, pid] of Object.entries(saved)) {
    if (playersById[pid]) kept[slot] = pid;
  }
  return { ...base, ...kept };
}

function hydrateExpExchange(raw: unknown, base: ExpExchangeState): ExpExchangeState {
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as { npcOrders?: unknown; playerOrders?: unknown };
  const isOrder = (o: unknown): o is ExpExchangeOrder => {
    if (!o || typeof o !== 'object') return false;
    const x = o as Record<string, unknown>;
    return (
      typeof x.id === 'string' &&
      (x.kind === 'npc' || x.kind === 'player') &&
      typeof x.teamName === 'string' &&
      typeof x.expAmount === 'number' &&
      Number.isFinite(x.expAmount) &&
      typeof x.broCents === 'number' &&
      Number.isFinite(x.broCents) &&
      typeof x.createdAtIso === 'string'
    );
  };
  const npcRaw = Array.isArray(r.npcOrders) ? r.npcOrders.filter(isOrder) : [];
  const playerRaw = Array.isArray(r.playerOrders) ? r.playerOrders.filter(isOrder) : [];
  const npcOrders = npcRaw.length ? npcRaw : seedNpcExpExchangeOrders(8);
  return { npcOrders, playerOrders: playerRaw };
}

function hydrateManagerProspectMarket(
  raw: ManagerProspectMarketState | undefined,
  base: ManagerProspectMarketState,
): ManagerProspectMarketState {
  const ownRaw = raw?.ownListings;
  const ownListings = Array.isArray(ownRaw)
    ? ownRaw.filter(
        (l) =>
          l &&
          typeof l === 'object' &&
          typeof (l as { listingId?: string }).listingId === 'string' &&
          typeof (l as { playerId?: string }).playerId === 'string' &&
          typeof (l as { priceExp?: number }).priceExp === 'number',
      )
    : base.ownListings;
  return { ownListings, npcOffers: [] };
}

function hydrateManagerProspectConfig(
  raw: ManagerProspectConfig | undefined,
  base: ManagerProspectConfig,
): ManagerProspectConfig {
  const n =
    raw && typeof raw.createCostExp === 'number' && Number.isFinite(raw.createCostExp)
      ? Math.round(raw.createCostExp)
      : base.createCostExp;
  return { createCostExp: Math.max(0, Math.min(50_000_000, n)) };
}

const ATTR_KEYS: (keyof import('@/entities/types').PlayerAttributes)[] = [
  'passe',
  'marcacao',
  'velocidade',
  'drible',
  'finalizacao',
  'fisico',
  'tatico',
  'mentalidade',
  'confianca',
  'fairPlay',
];

function isFiniteAttrRecord(v: unknown): v is import('@/entities/types').PlayerAttributes {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return ATTR_KEYS.every((k) => typeof o[k as string] === 'number' && Number.isFinite(o[k as string] as number));
}

const PLAYER_CREATION_STEPS: readonly PlayerCreationStep[] = [
  'awaiting_photo',
  'photo_uploaded',
  'validated',
  'approved',
  'launched',
];

function isPlayerCreationStep(s: unknown): s is PlayerCreationStep {
  return typeof s === 'string' && (PLAYER_CREATION_STEPS as readonly string[]).includes(s);
}

function isPortraitStyleRegion(s: unknown): s is ManagerProspectPortraitStyleRegion {
  return typeof s === 'string' && s in PORTRAIT_STYLE_REGION_LABELS;
}

const LEGACY_HERITAGE: ManagerProspectHeritageBrief = {
  portraitStyleRegion: 'americas_sul',
  originTags: [],
  originText: 'Pedido legado — completar nota de origem no Admin ou novo fluxo Academia.',
};

function hydrateHeritage(raw: unknown): ManagerProspectHeritageBrief {
  if (!raw || typeof raw !== 'object') return { ...LEGACY_HERITAGE };
  const h = raw as Record<string, unknown>;
  const region = h.portraitStyleRegion;
  const tagsRaw = h.originTags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim())
    : [];
  const text = typeof h.originText === 'string' ? h.originText.trim() : '';
  if (!isPortraitStyleRegion(region) || text.length < 8) {
    return { ...LEGACY_HERITAGE };
  }
  return { portraitStyleRegion: region, originTags: tags, originText: text };
}

function hydrateManagerProspectArtQueue(raw: unknown, cap = 200): ManagerProspectArtRequest[] {
  if (!Array.isArray(raw)) return [];
  const out: ManagerProspectArtRequest[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.playerId !== 'string') continue;
    if (typeof o.createdAtIso !== 'string') continue;
    if (typeof o.adminArtPrompt !== 'string') continue;
    if (!isFiniteAttrRecord(o.attributesSnapshot)) continue;
    const vb = o.visualBrief;
    const visualBrief =
      vb && typeof vb === 'object'
        ? {
            skinTone: typeof (vb as { skinTone?: unknown }).skinTone === 'string' ? (vb as { skinTone: string }).skinTone : undefined,
            eyeColor: typeof (vb as { eyeColor?: unknown }).eyeColor === 'string' ? (vb as { eyeColor: string }).eyeColor : undefined,
            hairStyle: typeof (vb as { hairStyle?: unknown }).hairStyle === 'string' ? (vb as { hairStyle: string }).hairStyle : undefined,
            extraDetails:
              typeof (vb as { extraDetails?: unknown }).extraDetails === 'string'
                ? (vb as { extraDetails: string }).extraDetails
                : undefined,
          }
        : undefined;
    let playerCreationStep: PlayerCreationStep = 'awaiting_photo';
    if (isPlayerCreationStep(o.playerCreationStep)) {
      playerCreationStep = o.playerCreationStep;
    } else if (o.status === 'fulfilled') {
      playerCreationStep = 'launched';
    } else if (o.status === 'pending') {
      playerCreationStep = 'awaiting_photo';
    }
    const legacyStatus =
      o.status === 'pending' || o.status === 'fulfilled' ? (o.status as 'pending' | 'fulfilled') : undefined;
    const heritage = hydrateHeritage(o.heritage);
    const draftPortraitUrl =
      typeof o.draftPortraitUrl === 'string' && o.draftPortraitUrl.trim()
        ? o.draftPortraitUrl.trim()
        : o.draftPortraitUrl === null
          ? null
          : undefined;
    const marketListingId = typeof o.marketListingId === 'string' ? o.marketListingId : undefined;
    const marketListedAtIso = typeof o.marketListedAtIso === 'string' ? o.marketListedAtIso : undefined;
    const marketPriceExp =
      typeof o.marketPriceExp === 'number' && Number.isFinite(o.marketPriceExp)
        ? o.marketPriceExp
        : undefined;
    out.push({
      id: o.id,
      playerId: o.playerId,
      createdAtIso: o.createdAtIso,
      playerCreationStep,
      ...(legacyStatus ? { legacyStatus } : {}),
      adminArtPrompt: o.adminArtPrompt,
      attributesSnapshot: o.attributesSnapshot,
      visualBrief,
      heritage,
      draftPortraitUrl,
      ...(marketListingId ? { marketListingId } : {}),
      ...(marketListedAtIso ? { marketListedAtIso } : {}),
      ...(marketPriceExp != null ? { marketPriceExp } : {}),
    });
    if (out.length >= cap) break;
  }
  return out;
}

function hydrateLeagueSchedule(
  raw: OlefootGameState,
  adminLeagues: import('@/match/adminLeagues').AdminLeagueConfig[],
  adminPrimaryLeagueId: string,
  club: ClubEntity,
): LeagueScheduleState {
  const rawLs = raw.leagueSchedule as LeagueScheduleState | undefined;
  const out: LeagueScheduleState = createEmptyLeagueScheduleState();
  if (rawLs?.byLeagueId && typeof rawLs.byLeagueId === 'object') {
    for (const [id, bucket] of Object.entries(rawLs.byLeagueId)) {
      if (!bucket || typeof bucket !== 'object') continue;
      const b = bucket as { fixtures?: unknown[]; updatedAtIso?: string };
      out.byLeagueId[id] = {
        fixtures: Array.isArray(b.fixtures) ? (b.fixtures as ScheduledLeagueFixture[]) : [],
        updatedAtIso: typeof b.updatedAtIso === 'string' ? b.updatedAtIso : new Date().toISOString(),
      };
    }
  }
  const pl = adminLeagues.find((l) => l.id === adminPrimaryLeagueId);
  if (pl?.format === 'round_robin' && !out.byLeagueId[pl.id]?.fixtures?.length) {
    out.byLeagueId[pl.id] = buildRoundRobinSchedule(pl, club);
  }
  return out;
}

function hydrateCardCollections(
  raw: unknown,
  base: Record<string, CardCollection>,
): Record<string, CardCollection> {
  if (!raw || typeof raw !== 'object') return { ...base };
  const out: Record<string, CardCollection> = { ...base };
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object' || !id.trim()) continue;
    const o = v as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const maxSupply =
      typeof o.maxSupply === 'number' && Number.isFinite(o.maxSupply) ? Math.max(1, Math.floor(o.maxSupply)) : 1;
    const createdAt = typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString();
    if (name) out[id] = { id, name, maxSupply, createdAt };
  }
  return out;
}

function hydrateState(raw: OlefootGameState): OlefootGameState {
  const base = createInitialGameState();
  const players: OlefootGameState['players'] = { ...base.players };
  for (const [id, p] of Object.entries(raw.players ?? {})) {
    players[id] = hydrateLegacyGenesisContract(
      clampPlayerToEvolutionCap(
        ensureMintOverall({
          ...p,
          outForMatches: p.outForMatches ?? 0,
        }),
      ),
    );
  }
  for (const id of Object.keys(players)) {
    if (!id.startsWith('genesis-')) delete players[id];
  }
  const lineup = sanitizeLineupForRoster(raw.lineup ?? {}, players);
  const rawFsEarly = raw.manager?.formationScheme;
  const resolvedFormationScheme: FormationSchemeId =
    rawFsEarly && rawFsEarly in FORMATION_BASES ? rawFsEarly : base.manager.formationScheme;

  let liveMatch = raw.liveMatch;
  if (liveMatch) {
    const rosterIds = new Set(Object.keys(players));
    const invalidateLive =
      Object.values(liveMatch.matchLineupBySlot ?? {}).some((pid) => pid && !rosterIds.has(pid)) ||
      (liveMatch.homePlayers ?? []).some((hp) => !rosterIds.has(hp.playerId));
    if (invalidateLive) liveMatch = null;
  }
  if (liveMatch) {
    const lu = mergeLineupWithDefaults(lineup, players);
    const lmFs = liveMatch.homeFormationScheme;
    const homeFormationScheme: FormationSchemeId =
      lmFs && lmFs in FORMATION_BASES ? lmFs : resolvedFormationScheme;
    liveMatch = {
      ...liveMatch,
      homeFormationScheme,
      matchLineupBySlot:
        liveMatch.matchLineupBySlot && Object.keys(liveMatch.matchLineupBySlot).length > 0
          ? liveMatch.matchLineupBySlot
          : { ...lu },
      substitutionsUsed: liveMatch.substitutionsUsed ?? 0,
      travelKm: liveMatch.travelKm ?? 0,
      phase: liveMatch.phase ?? 'playing',
      mode: (() => {
        const m = (liveMatch as { mode?: string }).mode;
        if (m === 'fast') return 'quick' as const;
        if (m === 'live' || m === 'ultralive2d') return 'test2d' as const;
        if (m === 'quick' || m === 'auto' || m === 'test2d') return m;
        return 'test2d' as const;
      })(),
      homeImpactLedger: liveMatch.homeImpactLedger ?? [],
      homeCaptainPlayerId:
        liveMatch.homeCaptainPlayerId ?? pickHomeCaptainPlayerId(liveMatch.homePlayers ?? []),
      footballElapsedSec: (liveMatch as unknown as Record<string, unknown>).footballElapsedSec as number ?? (liveMatch.minute ?? 0) * 60,
      spiritPhase: liveMatch.spiritPhase ?? 'open_play',
      spiritOverlay: liveMatch.spiritOverlay ?? null,
      penalty: liveMatch.penalty ?? null,
      spiritBuildupGkTicksRemaining: liveMatch.spiritBuildupGkTicksRemaining ?? 0,
      spiritMomentumClamp01: liveMatch.spiritMomentumClamp01 ?? null,
    };
  }
  const rawWallet = raw.finance?.wallet;
  const walletMerged = rawWallet ? normalizeWalletState(rawWallet) : createInitialWalletState();
  const wallet = mergeSwapKycIntoWallet(walletMerged);

  // Teto defensivo: evita valores absurdos injetados via DevTools.
  // Não substitui validação server-side — só protege a lógica do jogo.
  const MAX_BRO_CENTS = 10_000_000; // 100k BRO (mais realista)
  const MAX_OLE = 10_000_000;       // 10M OLE
  const MAX_EXP = 50_000_000;       // 50M EXP
  const rawBro = raw.finance?.broCents ?? base.finance.broCents;
  const rawOle = raw.finance?.ole ?? base.finance.ole;

  const rawExp = raw.finance?.expLifetimeEarned ?? 0;

  const finance = {
    ...base.finance,
    ...raw.finance,
    broCents: Math.min(MAX_BRO_CENTS, Math.max(0, Number.isFinite(rawBro) ? rawBro : 0)),
    ole: Math.min(MAX_OLE, Math.max(0, Number.isFinite(rawOle) ? rawOle : 0)),
    expLifetimeEarned: Math.min(MAX_EXP, Math.max(0, Number.isFinite(rawExp) ? rawExp : 0)),
    expHistory: raw.finance?.expHistory ?? [],
    companyTreasuryBroCents: raw.finance?.companyTreasuryBroCents ?? base.finance.companyTreasuryBroCents ?? 0,
    friendlyChallengeEscrowBroCents:
      raw.finance?.friendlyChallengeEscrowBroCents ?? base.finance.friendlyChallengeEscrowBroCents ?? 0,
    broLifetimeOutCents: raw.finance?.broLifetimeOutCents ?? 0,
    broLifetimeInCents: raw.finance?.broLifetimeInCents ?? 0,
    wallet,
  };

  const leagueSeason = raw.leagueSeason
    ? { ...createInitialLeagueSeason(), ...raw.leagueSeason }
    : base.leagueSeason;

  const rawSaved = raw.manager?.savedTactics ?? base.manager.savedTactics;
  const formationScheme = resolvedFormationScheme;
  const manager = {
    ...base.manager,
    ...raw.manager,
    formationScheme,
    tacticalStyle: migrateTacticalStyle(raw.manager?.tacticalStyle ?? base.manager.tacticalStyle),
    savedTactics: rawSaved.map((t) => ({ ...t, style: migrateTacticalStyle(t.style) })),
    activeMatchTacticId: raw.manager?.activeMatchTacticId ?? base.manager.activeMatchTacticId,
    activeTrainingTacticId: raw.manager?.activeTrainingTacticId ?? base.manager.activeTrainingTacticId,
    trainingPlans: raw.manager?.trainingPlans ?? base.manager.trainingPlans,
    treatmentPlans: (() => {
      const rawPlans = raw.manager?.treatmentPlans;
      if (!Array.isArray(rawPlans)) return base.manager.treatmentPlans;
      return rawPlans
        .filter(
          (t) =>
            t &&
            typeof t === 'object' &&
            typeof (t as { playerId?: string }).playerId === 'string' &&
            Boolean(players[(t as { playerId: string }).playerId]),
        )
        .slice(0, 40);
    })(),
    staff: raw.manager?.staff
      ? (() => {
          const abp = { ...(raw.manager!.staff!.assignedByPlayer ?? {}) };
          for (const pid of Object.keys(abp)) {
            if (!players[pid]) delete abp[pid];
          }
          return {
            ...createInitialStaffState(),
            ...raw.manager!.staff!,
            roles: { ...createInitialStaffState().roles, ...(raw.manager!.staff!.roles ?? {}) },
            assignedByPlayer: abp,
            assignedCollective:
              raw.manager!.staff!.assignedCollective ?? createInitialStaffState().assignedCollective,
          };
        })()
      : base.manager.staff,
    // Migração do coach: se não existir no save, cria um novo
    coach: raw.manager?.coach ?? createDefaultCoachAgent(),
  };

  const userSettings = {
    ...defaultUserSettings,
    ...(raw.userSettings && typeof raw.userSettings === 'object' ? raw.userSettings : {}),
  };

  const adminLeagues = hydrateAdminLeagues(raw.adminLeagues, createDefaultAdminLeagues());
  let adminPrimaryLeagueId =
    typeof raw.adminPrimaryLeagueId === 'string' && raw.adminPrimaryLeagueId
      ? raw.adminPrimaryLeagueId
      : adminLeagues[0]?.id ?? base.adminPrimaryLeagueId;
  if (!adminLeagues.some((l) => l.id === adminPrimaryLeagueId)) {
    adminPrimaryLeagueId = adminLeagues[0]?.id ?? 'lg_ole_serie_a';
  }

  const cardCollections = hydrateCardCollections(raw.cardCollections, base.cardCollections ?? {});

  const clubHydrated: ClubEntity = {
    ...base.club,
    ...(raw.club && typeof raw.club === 'object' ? raw.club : {}),
  };
  const leagueSchedule = hydrateLeagueSchedule(raw, adminLeagues, adminPrimaryLeagueId, clubHydrated);

  const rawState = raw as OlefootGameState;

  let nextFixture = normalizeFixture(rawState.nextFixture);
  const ga = nextFixture.opponent?.genesisAwayPlayers;
  if (ga?.length) {
    const clean = ga.filter((p) => p?.id?.startsWith('genesis-'));
    if (clean.length !== ga.length) {
      nextFixture = normalizeFixture({
        ...nextFixture,
        opponent: {
          ...nextFixture.opponent,
          genesisAwayPlayers: clean.length > 0 ? clean : undefined,
        },
      });
    }
  }

  const managerProspectMarketHydrated = hydrateManagerProspectMarket(
    (raw as Partial<OlefootGameState>).managerProspectMarket,
    base.managerProspectMarket,
  );
  const managerProspectMarket = {
    ...managerProspectMarketHydrated,
    ownListings: managerProspectMarketHydrated.ownListings.filter((l) => players[l.playerId]),
  };

  const playerHealth = hydratePlayerHealth(
    (raw as Partial<OlefootGameState>).playerHealth,
    players,
  );

  const playerSeasonLedger = sanitizePlayerSeasonLedger(
    (raw as Partial<OlefootGameState>).playerSeasonLedger,
    new Set(Object.keys(players)),
  );

  const playerEvolutionTimeline = sanitizePlayerEvolutionTimeline(
    (raw as Partial<OlefootGameState>).playerEvolutionTimeline,
    new Set(Object.keys(players)),
  );

  const rawShopCat = (raw as Partial<OlefootGameState>).shopCatalog;
  let shopCatalog =
    Array.isArray(rawShopCat) && rawShopCat.length > 0 ? normalizeShopCatalog(rawShopCat) : defaultShopCatalog();
  if (!shopCatalog.length) shopCatalog = defaultShopCatalog();

  const shopInventory: Record<string, number> = {};
  const rawInv = (raw as Partial<OlefootGameState>).shopInventory;
  if (rawInv && typeof rawInv === 'object') {
    for (const [k, v] of Object.entries(rawInv)) {
      if (!k || typeof k !== 'string') continue;
      const n = Math.round(Number(v));
      if (Number.isFinite(n) && n > 0) shopInventory[k] = Math.min(9999, n);
    }
  }

  return {
    ...base,
    ...raw,
    cardCollections,
    players,
    lineup,
    liveMatch,
    finance,
    leagueSeason,
    manager,
    nextFixture,
    lastWorldRealMs: raw.lastWorldRealMs ?? Date.now(),
    clubLogistics: raw.clubLogistics ?? base.clubLogistics,
    structures: raw.structures ?? base.structures,
    memorableTrophyUnlockedIds: Array.isArray(raw.memorableTrophyUnlockedIds)
      ? raw.memorableTrophyUnlockedIds
      : base.memorableTrophyUnlockedIds,
    adminLeagues,
    adminPrimaryLeagueId,
    leagueSchedule,
    club: clubHydrated,
    social: hydrateSocial(raw.social),
    userSettings,
    inbox: (() => {
      if (raw.inbox === undefined) return base.inbox;
      let next = filterLegacyPlacarFromInbox(hydrateInboxList(raw.inbox));
      const hasDemoSeeds = next.some((i) => i.id.startsWith('demo-'));
      if (!inboxHasVisibleHomeFeedItem(next) && !hasDemoSeeds) {
        next = [...createHomeInboxSeedExamples(), ...next].slice(0, 24);
      }
      return next;
    })(),
    uiBanners: hydrateUiBanners((raw as { uiBanners?: unknown }).uiBanners),
    managerProspectMarket,
    managerProspectConfig: hydrateManagerProspectConfig(
      (raw as Partial<OlefootGameState>).managerProspectConfig,
      base.managerProspectConfig,
    ),
    managerProspectArtQueue: hydrateManagerProspectArtQueue(
      (raw as Partial<OlefootGameState>).managerProspectArtQueue,
    ).filter((r) => players[r.playerId]),
    expExchange: hydrateExpExchange((raw as Partial<OlefootGameState>).expExchange, base.expExchange),
    playerHealth,
    playerSeasonLedger,
    playerEvolutionTimeline,
    shopCatalog,
    shopInventory,
  };
}

/**
 * Hidrata `playerHealth` (mapa SSOT) a partir do save:
 * - se já existir o mapa novo, sanitiza e mantém
 * - caso contrário, deriva dos campos legados em `players[id].fatigue/injuryRisk/outForMatches`
 * - garante uma entrada por jogador ativo
 */
function hydratePlayerHealth(
  raw: Record<string, PlayerHealth> | undefined,
  players: Record<string, import('@/entities/types').PlayerEntity>,
): Record<string, PlayerHealth> {
  const out: Record<string, PlayerHealth> = {};
  for (const [id, p] of Object.entries(players)) {
    const fromRaw = raw && typeof raw === 'object' ? raw[id] : undefined;
    if (fromRaw && typeof fromRaw === 'object') {
      out[id] = recomputeAtRisk({
        ...emptyHealth(id),
        ...fromRaw,
        playerId: id,
        yellowCardsByLeague:
          fromRaw.yellowCardsByLeague && typeof fromRaw.yellowCardsByLeague === 'object'
            ? { ...fromRaw.yellowCardsByLeague }
            : {},
      });
    } else {
      out[id] = healthFromLegacyPlayer(p);
    }
  }
  return out;
}

function hydrateSocial(raw: SocialState | undefined): SocialState {
  if (!raw || typeof raw !== 'object') {
    return { friends: [], incoming: [], outgoing: [] };
  }
  return {
    friends: Array.isArray(raw.friends) ? raw.friends : [],
    incoming: Array.isArray(raw.incoming) ? raw.incoming : [],
    outgoing: Array.isArray(raw.outgoing) ? raw.outgoing : [],
  };
}

/** Valida e normaliza um objeto save (import direto no reducer). */
export function rehydrateGameState(raw: unknown): OlefootGameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as OlefootGameState;
  if (s.version !== 1) return null;
  return hydrateState(s);
}

/** Parse de backup JSON (Config / Admin). */
export function tryHydrateGameState(text: string): OlefootGameState | null {
  try {
    const parsed = JSON.parse(text) as OlefootGameState;
    return rehydrateGameState(parsed);
  } catch {
    return null;
  }
}

export function loadGameState(): OlefootGameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createInitialGameState();
    const parsed = JSON.parse(raw) as OlefootGameState;
    if (parsed?.version !== 1) return createInitialGameState();
    return hydrateState(parsed);
  } catch {
    return createInitialGameState();
  }
}

export function saveGameState(state: OlefootGameState): void {
  try {
    const serialized = JSON.stringify(state);
    const sizeKB = new Blob([serialized]).size / 1024;

    if (sizeKB > 4096) { // 4 MB warning
      console.warn(`[persistence] Save muito grande (${sizeKB.toFixed(0)} KB). Considere limpar histórico.`);
    }

    localStorage.setItem(KEY, serialized);
  } catch (e) {
    console.error('[persistence] Falha ao salvar:', e instanceof Error ? e.message : 'quota exceeded');
  }
}
