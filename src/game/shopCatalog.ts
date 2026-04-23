import type { LucideIcon } from 'lucide-react';
import {
  Crown,
  Flame,
  Gem,
  Hexagon,
  Package,
  Sparkles,
  Zap,
} from 'lucide-react';

export type ShopTabId = 'boosters' | 'packs' | 'extra';

export type ShopRarity = 'comum' | 'raro' | 'epico' | 'mitico';

export type ShopItemEffect =
  | { kind: 'reset_squad_fatigue' }
  | { kind: 'reduce_player_injury'; matches: number }
  | { kind: 'boost_crowd_support'; deltaPercent: number }
  | { kind: 'reduce_squad_injury_risk'; delta: number }
  | { kind: 'reduce_squad_fatigue'; delta: number }
  | { kind: 'refresh_npc_market' }
  | { kind: 'grant_earned_exp'; amount: number };

export interface ShopCatalogItem {
  id: string;
  title: string;
  blurb: string;
  tab: ShopTabId;
  rarity: ShopRarity;
  iconKey: string;
  featured?: boolean;
  /** Imagem de rótulo do pack/booster (base64 ou URL externa). Tamanho ideal: 480 × 300 px (ratio 8:5). */
  labelImageUrl?: string;
  /** Preço em centavos de BRO (0,01 BRO = 1 centavo). */
  priceBroCents: number | null;
  priceExp: number | null;
  /** Se true, a compra adiciona 1 unidade ao inventário; uso aplica `effect`. */
  consumable: boolean;
  effect: ShopItemEffect | null;
}

const ICON_MAP: Record<string, LucideIcon> = {
  zap: Zap,
  package: Package,
  hexagon: Hexagon,
  crown: Crown,
  flame: Flame,
  gem: Gem,
  sparkles: Sparkles,
};

export function shopItemIcon(key: string): LucideIcon {
  return ICON_MAP[key] ?? Zap;
}

export function shopEffectNeedsPlayer(effect: ShopItemEffect | null | undefined): boolean {
  return effect?.kind === 'reduce_player_injury';
}

export function shopEffectScope(
  effect: ShopItemEffect | null | undefined,
): 'player' | 'squad' | 'club' | 'none' {
  if (!effect) return 'none';
  switch (effect.kind) {
    case 'reduce_player_injury':
      return 'player';
    case 'reset_squad_fatigue':
    case 'reduce_squad_injury_risk':
    case 'reduce_squad_fatigue':
      return 'squad';
    case 'boost_crowd_support':
    case 'refresh_npc_market':
    case 'grant_earned_exp':
      return 'club';
    default:
      return 'none';
  }
}

function isShopTabId(s: unknown): s is ShopTabId {
  return s === 'boosters' || s === 'packs' || s === 'extra';
}

function isShopRarity(s: unknown): s is ShopRarity {
  return s === 'comum' || s === 'raro' || s === 'epico' || s === 'mitico';
}

function normalizeEffect(raw: unknown): ShopItemEffect | null {
  if (!raw || typeof raw !== 'object') return null;
  const k = (raw as { kind?: string }).kind;
  if (k === 'reset_squad_fatigue') return { kind: 'reset_squad_fatigue' };
  if (k === 'refresh_npc_market') return { kind: 'refresh_npc_market' };
  if (k === 'reduce_player_injury') {
    const m = Math.round(Number((raw as { matches?: number }).matches));
    return { kind: 'reduce_player_injury', matches: Math.max(1, Math.min(10, Number.isFinite(m) ? m : 1)) };
  }
  if (k === 'boost_crowd_support') {
    const d = Math.round(Number((raw as { deltaPercent?: number }).deltaPercent));
    return {
      kind: 'boost_crowd_support',
      deltaPercent: Math.max(1, Math.min(40, Number.isFinite(d) ? d : 12)),
    };
  }
  if (k === 'reduce_squad_injury_risk') {
    const d = Math.round(Number((raw as { delta?: number }).delta));
    return {
      kind: 'reduce_squad_injury_risk',
      delta: Math.max(1, Math.min(60, Number.isFinite(d) ? d : 15)),
    };
  }
  if (k === 'reduce_squad_fatigue') {
    const d = Math.round(Number((raw as { delta?: number }).delta));
    return {
      kind: 'reduce_squad_fatigue',
      delta: Math.max(5, Math.min(100, Number.isFinite(d) ? d : 25)),
    };
  }
  if (k === 'grant_earned_exp') {
    const a = Math.round(Number((raw as { amount?: number }).amount));
    return {
      kind: 'grant_earned_exp',
      amount: Math.max(1, Math.min(9_999_999, Number.isFinite(a) ? a : 100)),
    };
  }
  return null;
}

export function normalizeShopCatalogItem(raw: unknown): ShopCatalogItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : '';
  if (!id) return null;
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  if (!title) return null;
  const blurb = typeof o.blurb === 'string' ? o.blurb.trim() : '';
  const tab = isShopTabId(o.tab) ? o.tab : 'extra';
  const rarity = isShopRarity(o.rarity) ? o.rarity : 'comum';
  const iconKey = typeof o.iconKey === 'string' && o.iconKey.trim() ? o.iconKey.trim() : 'zap';
  const featured = Boolean(o.featured);
  const priceBroCents =
    o.priceBroCents != null && Number.isFinite(Number(o.priceBroCents))
      ? Math.max(0, Math.round(Number(o.priceBroCents)))
      : null;
  const priceExp =
    o.priceExp != null && Number.isFinite(Number(o.priceExp))
      ? Math.max(0, Math.round(Number(o.priceExp)))
      : null;
  const consumable = Boolean(o.consumable);
  const effect = consumable ? normalizeEffect(o.effect) : null;
  return {
    id,
    title,
    blurb: blurb || title,
    tab,
    rarity,
    iconKey,
    featured,
    priceBroCents,
    priceExp,
    consumable,
    effect: consumable ? effect : null,
  };
}

export function normalizeShopCatalog(raw: unknown): ShopCatalogItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ShopCatalogItem[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const it = normalizeShopCatalogItem(row);
    if (!it || seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

/** Catálogo inicial (alinhado à loja pública anterior). Preços BRO em centavos. */
export function findShopItem(catalog: ShopCatalogItem[], id: string): ShopCatalogItem | undefined {
  return catalog.find((x) => x.id === id);
}

export function defaultShopCatalog(): ShopCatalogItem[] {
  return normalizeShopCatalog([
    {
      id: 'pack-elite',
      title: 'Pack Elite Draft',
      blurb: '3 jogadores 72+ OVR · chance de carta holográfica.',
      tab: 'packs',
      rarity: 'epico',
      priceBroCents: Math.round(24.99 * 100),
      priceExp: null,
      iconKey: 'package',
      featured: true,
      consumable: false,
      effect: null,
    },
    {
      id: 'pack-starter',
      title: 'Pack Arranque',
      blurb: '5 jogadores 65+ · ideal para reforçar o banco.',
      tab: 'packs',
      rarity: 'comum',
      priceBroCents: Math.round(4.99 * 100),
      priceExp: 1200,
      iconKey: 'hexagon',
      consumable: false,
      effect: null,
    },
    {
      id: 'booster-fatigue',
      title: 'Booster Fadiga Zero',
      blurb: 'Zera fadiga de todo o plantel ao ativar.',
      tab: 'boosters',
      rarity: 'raro',
      priceBroCents: null,
      priceExp: 450,
      iconKey: 'zap',
      consumable: true,
      effect: { kind: 'reset_squad_fatigue' },
    },
    {
      id: 'booster-injury',
      title: 'Kit Médico Premium',
      blurb: 'Reduz jogos de lesão do jogador escolhido.',
      tab: 'boosters',
      rarity: 'epico',
      priceBroCents: Math.round(9.99 * 100),
      priceExp: null,
      iconKey: 'flame',
      consumable: true,
      effect: { kind: 'reduce_player_injury', matches: 1 },
    },
    {
      id: 'pack-legend',
      title: 'Cápsula Lendária',
      blurb: '1 jogador 84+ garantido · supply limitado.',
      tab: 'packs',
      rarity: 'mitico',
      priceBroCents: Math.round(79 * 100),
      priceExp: null,
      iconKey: 'crown',
      featured: true,
      consumable: false,
      effect: null,
    },
    {
      id: 'scout-token',
      title: 'Token Olheiro PRO',
      blurb: 'Renova ofertas do mercado EXP (NPC) na hora.',
      tab: 'extra',
      rarity: 'raro',
      priceBroCents: Math.round(14.5 * 100),
      priceExp: 2800,
      iconKey: 'gem',
      consumable: true,
      effect: { kind: 'refresh_npc_market' },
    },
  ]);
}
