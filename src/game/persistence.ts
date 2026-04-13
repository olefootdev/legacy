import type { CardCollection, ClubEntity } from '@/entities/types';
import type {
  ManagerProspectArtRequest,
  ManagerProspectConfig,
  ManagerProspectMarketState,
  OlefootGameState,
  PlayerCreationStep,
} from './types';
import type { ManagerProspectHeritageBrief, ManagerProspectPortraitStyleRegion } from '@/entities/managerProspect';
import { buildNpcManagerProspectSnapshot, PORTRAIT_STYLE_REGION_LABELS } from '@/entities/managerProspect';
import { createInitialGameState } from './initialState';
import { normalizeFixture } from '@/entities/team';
import { mergeLineupWithDefaults } from '@/entities/lineup';
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

const KEY = 'olefoot-game-v1';

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
  const npcRaw = raw?.npcOffers;
  let npcOffers = Array.isArray(npcRaw)
    ? npcRaw.filter(
        (o) =>
          o &&
          typeof o === 'object' &&
          typeof (o as { listingId?: string }).listingId === 'string' &&
          typeof (o as { priceExp?: number }).priceExp === 'number' &&
          (o as { snapshot?: { id?: string } }).snapshot?.id,
      )
    : base.npcOffers;
  if (!npcOffers.length) {
    const seed = 'hydrate';
    npcOffers = Array.from({ length: 5 }, (_, i) => ({
      listingId: `npc_lst_${seed}_${i}`,
      snapshot: buildNpcManagerProspectSnapshot(seed, i),
      priceExp: 88_000 + ((i * 41_000) % 310_000),
    }));
  }
  return { ownListings, npcOffers };
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
    players[id] = clampPlayerToEvolutionCap(
      ensureMintOverall({
        ...p,
        outForMatches: p.outForMatches ?? 0,
      }),
    );
  }
  const rawFsEarly = raw.manager?.formationScheme;
  const resolvedFormationScheme: FormationSchemeId =
    rawFsEarly && rawFsEarly in FORMATION_BASES ? rawFsEarly : base.manager.formationScheme;

  let liveMatch = raw.liveMatch;
  if (liveMatch) {
    const lu = mergeLineupWithDefaults(raw.lineup ?? {}, players);
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

  const finance = {
    ...base.finance,
    ...raw.finance,
    expLifetimeEarned: raw.finance?.expLifetimeEarned ?? 0,
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
    staff: raw.manager?.staff
      ? {
          ...createInitialStaffState(),
          ...raw.manager.staff,
          roles: { ...createInitialStaffState().roles, ...(raw.manager.staff.roles ?? {}) },
          assignedByPlayer: raw.manager.staff.assignedByPlayer ?? {},
          assignedCollective: raw.manager.staff.assignedCollective ?? createInitialStaffState().assignedCollective,
        }
      : base.manager.staff,
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

  return {
    ...base,
    ...raw,
    cardCollections,
    players,
    liveMatch,
    finance,
    leagueSeason,
    manager,
    nextFixture: normalizeFixture(rawState.nextFixture),
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
    managerProspectMarket: hydrateManagerProspectMarket(
      (raw as Partial<OlefootGameState>).managerProspectMarket,
      base.managerProspectMarket,
    ),
    managerProspectConfig: hydrateManagerProspectConfig(
      (raw as Partial<OlefootGameState>).managerProspectConfig,
      base.managerProspectConfig,
    ),
    managerProspectArtQueue: hydrateManagerProspectArtQueue(
      (raw as Partial<OlefootGameState>).managerProspectArtQueue,
    ),
  };
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
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}
