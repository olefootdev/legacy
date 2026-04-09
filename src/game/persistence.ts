import type { CardCollection } from '@/entities/types';
import type { OlefootGameState } from './types';
import { createInitialGameState } from './initialState';
import { mergeLineupWithDefaults } from '@/entities/lineup';
import { createInitialWalletState, normalizeWalletState } from '@/wallet/initial';
import { createInitialLeagueSeason } from '@/match/leagueSeason';
import { createInitialStaffState } from '@/systems/staff';
import { migrateTacticalStyle } from '@/tactics/playingStyle';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import type { SocialState } from '@/social/types';
import { pickHomeCaptainPlayerId } from '@/match/impactRules';
import { filterLegacyPlacarFromInbox, hydrateInboxList } from './inboxItem';
import { createHomeInboxSeedExamples } from './homeInboxSeedExamples';
import { inboxHasVisibleHomeFeedItem } from './inboxTypes';
import { mergeSwapKycIntoWallet } from '@/wallet/swapKycStorage';
import { defaultUserSettings } from '@/settings/defaultUserSettings';
import { createDefaultAdminLeagues, hydrateAdminLeagues } from '@/match/adminLeagues';
import { hydrateUiBanners } from '@/ui/banners';

const KEY = 'olefoot-game-v1';

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
    players[id] = {
      ...p,
      outForMatches: p.outForMatches ?? 0,
    };
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
      mode: (liveMatch as { mode?: string }).mode === 'fast' ? 'quick' : liveMatch.mode,
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

  return {
    ...base,
    ...raw,
    cardCollections,
    players,
    liveMatch,
    finance,
    leagueSeason,
    manager,
    lastWorldRealMs: raw.lastWorldRealMs ?? Date.now(),
    clubLogistics: raw.clubLogistics ?? base.clubLogistics,
    structures: raw.structures ?? base.structures,
    memorableTrophyUnlockedIds: Array.isArray(raw.memorableTrophyUnlockedIds)
      ? raw.memorableTrophyUnlockedIds
      : base.memorableTrophyUnlockedIds,
    adminLeagues,
    adminPrimaryLeagueId,
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
