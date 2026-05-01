import type {
  PlayerArchetype,
  PlayerAttributes,
  PlayerBehavior,
  PlayerEntity,
  PlayerCreatorType,
  PlayerRarity,
  PlayerStrongFoot,
  TacticalZone,
} from './types';
import { countryCodeToFlagEmoji } from '@/lib/flagEmoji';
import { seedPositionKnowledgeFromLegend } from '@/gamespirit/legacy/positionKnowledgeInit';

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Gera um ID único para um jogador
 */
export function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Pilar 2 (impacto agregado no XI / cartões): mapa em `@/lib/veracityPillarsMap`. */
export function overallFromAttributes(a: PlayerAttributes): number {
  const w =
    a.passe * 0.12 +
    a.marcacao * 0.1 +
    a.velocidade * 0.12 +
    a.drible * 0.1 +
    a.finalizacao * 0.12 +
    a.fisico * 0.1 +
    a.tatico * 0.12 +
    a.mentalidade * 0.08 +
    a.confianca * 0.08 +
    a.fairPlay * 0.06;
  return Math.round(clamp(w, 40, 99));
}

export function zoneFromPos(pos: string): TacticalZone {
  const p = pos.toUpperCase();
  if (p === 'GOL') return 'gol';
  if (p === 'ZAG' || p === 'LE' || p === 'LD') return 'defesa';
  if (p === 'VOL' || p === 'MC') return 'meio';
  if (p === 'PE') return 'lateral_esq';
  if (p === 'PD') return 'lateral_dir';
  if (p === 'ATA') return 'ataque';
  return 'meio';
}

export function defaultArchetypeForSeed(name: string): PlayerArchetype {
  const h = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const r = h % 5;
  return (['profissional', 'novo_talento', 'meme', 'profissional', 'ai_plus'] as const)[r];
}

/** Converte entidade → props que a UI de cards já espera (PAC/SHO/PAS + estilo visual) */
export function playerToCardView(p: PlayerEntity, highlightOvr?: number) {
  const ovr = overallFromAttributes(p.attrs);
  const countryRaw = p.country?.trim() ?? '';
  const countryFlagEmoji = countryRaw
    ? countryCodeToFlagEmoji(countryRaw) || '🌍'
    : '';
  return {
    id: p.id,
    num: p.num,
    name: p.name,
    pos: p.pos,
    ovr,
    style: ovr >= highlightOvr! ? 'neon-yellow' : ovr >= 82 ? 'white' : 'gray-400',
    pac: p.attrs.velocidade,
    sho: p.attrs.finalizacao,
    pas: p.attrs.passe,
    fatigue: Math.round(p.fatigue),
    portraitUrl: p.portraitUrl,
    country: p.country,
    countryFlagEmoji,
    strongFoot: p.strongFoot,
    creatorType: p.creatorType,
    rarity: p.rarity,
    collectionId: p.collectionId,
    cardSupply: p.cardSupply,
    bio: p.bio,
    listedOnMarket: p.listedOnMarket,
    /** Partidas que o jogador ainda fica fora (lesão ou suspensão). 0 = disponível. */
    outForMatches: p.outForMatches ?? 0,
    /** Risco 0-100 de sofrer lesão no próximo tick extenuante. */
    injuryRisk: Math.round(p.injuryRisk ?? 0),
  };
}

export function createPlayer(partial: {
  id: string;
  num: number;
  name: string;
  pos: string;
  zone?: TacticalZone;
  archetype?: PlayerArchetype;
  behavior?: PlayerBehavior;
  attrs?: Partial<PlayerAttributes>;
  fatigue?: number;
  injuryRisk?: number;
  evolutionXp?: number;
  outForMatches?: number;
  portraitUrl?: string;
  portraitTokenUrl?: string;
  marketValueBroCents?: number;
  marketValueExp?: number;
  country?: string;
  strongFoot?: PlayerStrongFoot;
  creatorType?: PlayerCreatorType;
  rarity?: PlayerRarity;
  collectionId?: string;
  cardSupply?: number;
  bio?: string;
  /** `false` = não listado; `true` = no mercado; omitir = legado sem flag */
  listedOnMarket?: boolean;
  /** Tag de coleção admin-market (ex.: 'welcomepack'). */
  adminMarketTag?: string;
  managerCreated?: boolean;
  age?: number;
  mintOverall?: number;
  evolutionRate?: number;
  contractMatchesRemaining?: number;
  contractMatchesIncluded?: number;
  contractIsLifetime?: boolean;
  contractExpired?: boolean;
  genesisCatalogId?: string;
  /** DNA de posição pré-carregado (Fase 4 — Legado Perpétuo). */
  positionKnowledge?: import('@/gamespirit/legacy/positionKnowledgeTypes').PositionKnowledge;
  isLegacy?: boolean;
  legacyTeamBooster?: Record<string, number>;
  legacyTaughtAttributes?: string[];
}): PlayerEntity {
  const base: PlayerAttributes = {
    passe: 72,
    marcacao: 70,
    velocidade: 78,
    drible: 70,
    finalizacao: 72,
    fisico: 74,
    tatico: 72,
    mentalidade: 75,
    confianca: 78,
    fairPlay: 80,
    ...partial.attrs,
  };
  const archetype = partial.archetype ?? defaultArchetypeForSeed(partial.name);
  const behavior: PlayerBehavior = partial.behavior ?? 'equilibrado';
  const mintOvr = overallFromAttributes(base);
  const evolutionRate =
    partial.evolutionRate != null && Number.isFinite(partial.evolutionRate)
      ? Math.min(3, Math.max(0.25, partial.evolutionRate))
      : 1;
  const core: PlayerEntity = {
    id: partial.id,
    num: partial.num,
    name: partial.name,
    pos: partial.pos,
    archetype,
    zone: partial.zone ?? zoneFromPos(partial.pos),
    behavior,
    attrs: base,
    fatigue: partial.fatigue ?? 18 + (partial.num % 12),
    injuryRisk: partial.injuryRisk ?? 5,
    evolutionXp: partial.evolutionXp ?? 0,
    outForMatches: partial.outForMatches ?? 0,
    mintOverall: partial.mintOverall != null && Number.isFinite(partial.mintOverall) ? Math.round(partial.mintOverall) : mintOvr,
    evolutionRate,
  };
  return {
    ...core,
    ...(partial.portraitUrl ? { portraitUrl: partial.portraitUrl } : {}),
    ...(partial.portraitTokenUrl ? { portraitTokenUrl: partial.portraitTokenUrl } : {}),
    ...(partial.marketValueBroCents != null && partial.marketValueBroCents >= 0
      ? { marketValueBroCents: Math.round(partial.marketValueBroCents) }
      : {}),
    ...(partial.marketValueExp != null && Number.isFinite(partial.marketValueExp) && partial.marketValueExp > 0
      ? { marketValueExp: Math.round(partial.marketValueExp) }
      : {}),
    ...(partial.country?.trim() ? { country: partial.country.trim() } : {}),
    ...(partial.strongFoot ? { strongFoot: partial.strongFoot } : {}),
    ...(partial.creatorType ? { creatorType: partial.creatorType } : {}),
    ...(partial.rarity ? { rarity: partial.rarity } : {}),
    ...(partial.collectionId?.trim() &&
    partial.cardSupply != null &&
    Number.isFinite(partial.cardSupply) &&
    Math.floor(partial.cardSupply) >= 1
      ? {
          collectionId: partial.collectionId.trim(),
          cardSupply: Math.floor(partial.cardSupply),
        }
      : {}),
    ...(partial.bio?.trim() ? { bio: partial.bio.trim() } : {}),
    ...(partial.listedOnMarket !== undefined ? { listedOnMarket: partial.listedOnMarket } : {}),
    ...(partial.adminMarketTag?.trim() ? { adminMarketTag: partial.adminMarketTag.trim() } : {}),
    ...(partial.managerCreated ? { managerCreated: true } : {}),
    ...(partial.age != null && Number.isFinite(partial.age)
      ? { age: Math.max(16, Math.min(40, Math.round(partial.age))) }
      : {}),
    ...(partial.genesisCatalogId?.trim() ? { genesisCatalogId: partial.genesisCatalogId.trim() } : {}),
    positionKnowledge: partial.positionKnowledge ?? seedPositionKnowledgeFromLegend(core),
    ...(partial.isLegacy ? { isLegacy: true as const } : {}),
    ...(partial.legacyTeamBooster && Object.keys(partial.legacyTeamBooster).length > 0
      ? { legacyTeamBooster: partial.legacyTeamBooster }
      : {}),
    ...(partial.legacyTaughtAttributes && partial.legacyTaughtAttributes.length > 0
      ? { legacyTaughtAttributes: partial.legacyTaughtAttributes }
      : {}),
    ...(partial.contractExpired === true ? { contractExpired: true as const } : {}),
    ...(partial.contractIsLifetime === true
      ? { contractIsLifetime: true as const, contractExpired: false }
      : partial.contractMatchesRemaining != null && Number.isFinite(partial.contractMatchesRemaining)
        ? {
            contractMatchesRemaining: Math.max(0, Math.round(partial.contractMatchesRemaining)),
            contractMatchesIncluded:
              partial.contractMatchesIncluded != null && Number.isFinite(partial.contractMatchesIncluded)
                ? Math.max(0, Math.round(partial.contractMatchesIncluded))
                : Math.max(0, Math.round(partial.contractMatchesRemaining)),
          }
        : {}),
  };
}
