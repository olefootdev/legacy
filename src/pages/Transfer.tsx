import type { RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Filter,
  Gavel,
  Clock,
  X,
  TrendingUp,
  Trophy,
  UserCircle,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { AuctionCurrency } from '@/economy/model';
import { formatExp } from '@/systems/economy';
import { MEMORABLE_TROPHY_SLOTS, type MemorableTrophyId } from '@/trophies/memorableCatalog';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { fetchListedGenesisEntitiesByCatalogId, fetchGenesisMarketAuctionCards } from '@/supabase/genesisMarket';
import { TransferLegaciesTab } from './TransferLegaciesTab';
import { usePlatformConfig } from '@/admin/platformConfigStore';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import type { MockAuctionPlayer } from '@/transfer/mockAuctionPlayer';
import { TransferHeroSlider, type HeroTab } from '@/transfer/TransferHeroSlider';
import { TransferFeaturedBoxes } from '@/transfer/TransferFeaturedBoxes';
import { isSupabaseConfigured } from '@/supabase/client';
import type { PlayerEntity } from '@/entities/types';
import { countryCodeToFlagEmoji } from '@/lib/flagEmoji';
import { trackGrowthCommerce } from '@/admin/platformStore';
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { getSupabase } from '@/supabase/client';
import { useTrackScreen } from '@/progression/trackEvent';

const BIO_MAX_LEN = 250;

/** Cartões: bandeira a partir do código ISO; sem mapeamento → globo (evita abreviatura). */
function natFlagDisplay(nat: string): string {
  const f = countryCodeToFlagEmoji(nat);
  if (f) return f;
  const t = nat.trim();
  if (!t || t === '—') return '';
  return '🌍';
}

function memorableLabels(ids: readonly MemorableTrophyId[] | undefined): string[] {
  if (!ids?.length) return [];
  const map = new Map(MEMORABLE_TROPHY_SLOTS.map((t) => [t.id, t.name]));
  return ids.map((id) => map.get(id) ?? id);
}

function truncateBio(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function playerEntityToManagerMockAuction(
  p: PlayerEntity,
  cardId: number,
  priceExp: number,
  marketKind: 'manager_own' | 'manager_npc',
  opts: { managerListingId?: string; managerPlayerId?: string },
): MockAuctionPlayer {
  const ovr = overallFromAttributes(p.attrs);
  const style = ovr >= 68 ? 'white' : 'gray-400';
  const category: MockAuctionPlayer['category'] = ovr >= 70 ? 'gold' : ovr >= 65 ? 'silver' : 'bronze';
  const ageLabel = p.age != null ? String(p.age) : '—';
  return {
    id: cardId,
    name: p.name,
    pos: p.pos,
    nat: p.country ?? '—',
    ovr,
    style,
    category,
    pac: p.attrs.velocidade,
    sho: p.attrs.finalizacao,
    pas: p.attrs.passe,
    dri: p.attrs.drible,
    def: p.attrs.marcacao,
    phy: p.attrs.fisico,
    auctionCurrency: 'EXP',
    currentBid: priceExp,
    buyNow: priceExp,
    timeLeft: '23:59:59',
    history: [
      {
        year: ageLabel,
        club: marketKind === 'manager_own' ? 'OLE FC' : 'Rede OLE',
        apps: 0,
        goals: 0,
      },
    ],
    bio:
      (p.bio ?? '').trim().slice(0, 250) ||
      (marketKind === 'manager_own'
        ? p.managerCreated
          ? 'Prospect da tua Academia OLE.'
          : 'Jogador do teu plantel no mercado EXP.'
        : 'Prospect da rede de managers OLE.'),
    memorableTrophyIds: [],
    marketKind,
    managerListingId: opts.managerListingId,
    managerPlayerId: opts.managerPlayerId ?? p.id,
    portraitSrc: playerPortraitSrc({ name: p.name, portraitUrl: p.portraitUrl }, 400, 520),
  };
}

/** Chave estável para agrupar homônimos (mesmo nome exibido). */
function auctionNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Homónimos dentro de uma lista já ordenada (ex.: sessão por OVR). */
function homonymRankMapForPlayers(players: MockAuctionPlayer[]): Map<number, { index: number; total: number }> {
  const groups = new Map<string, MockAuctionPlayer[]>();
  for (const p of players) {
    const k = auctionNameKey(p.name);
    const g = groups.get(k);
    if (g) g.push(p);
    else groups.set(k, [p]);
  }
  const map = new Map<number, { index: number; total: number }>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.forEach((p, i) => map.set(p.id, { index: i + 1, total: group.length }));
  }
  return map;
}

/** Uma linha que diferencia anúncios com o mesmo nome: nação, posição, OVR, clube atual. */
function playerIdentityLine(p: MockAuctionPlayer): string {
  const club = p.history[0]?.club ?? '—';
  const nation = natFlagDisplay(p.nat) || '—';
  return `${nation} · ${p.pos} · ${p.ovr} · ${club}`;
}

/** Cartas iniciais no carril “Sessão do mercado” (ordem por OVR); “Ver mais” acrescenta do mesmo ranking. */
/** Carris de descoberta: quantos compactos mostrar de início e por cada “Ver mais” (mesma ordenação do carril). */
const DISCOVERY_CAROUSEL_INITIAL = 10;
const DISCOVERY_CAROUSEL_STEP = 5;

function initialDiscoveryVisibleMap(): Record<'highlights' | 'fresh' | 'valuable' | 'deals', number> {
  return {
    highlights: DISCOVERY_CAROUSEL_INITIAL,
    fresh: DISCOVERY_CAROUSEL_INITIAL,
    valuable: DISCOVERY_CAROUSEL_INITIAL,
    deals: DISCOVERY_CAROUSEL_INITIAL,
  };
}

/** Ordenar “tempo restante” do leilão (mock HH:MM:SS) para rails de oportunidade. */
function timeLeftToSeconds(timeLeft: string): number {
  const parts = timeLeft.trim().split(':').map((x) => Number(x));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 24 * 3600;
  const [h, m, s] = parts as [number, number, number];
  return h * 3600 + m * 60 + s;
}

const POSITIONS = ['ATA', 'PD', 'PE', 'MEI', 'MC', 'VOL', 'LE', 'LD', 'ZAG', 'GOL'];
const NATIONS = ['BR', 'PT', 'ES', 'FR', 'AR', 'UY'];

/** `card`: EXP sempre com valor integral (pt-BR), sem 680k / 2,5M — evita erro de leitura no card. */
function formatAuctionDisplay(
  currency: AuctionCurrency,
  amount: number,
  variant: 'default' | 'card' = 'default',
): string {
  if (currency === 'EXP') {
    if (variant === 'card') return `${formatExp(amount)} EXP`;
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M EXP`;
    if (amount >= 10_000) return `${(amount / 1000).toFixed(0)}k EXP`;
    return `${formatExp(amount)} EXP`;
  }
  const bro = amount / 100;
  return `${bro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BRO`;
}

/**
 * Carril “Destaques da semana”: `PlayerCard` mais largo que os compactos (148px).
 * Define `--highlight-card-px` no contentor de scroll.
 */
function useHighlightRailSizing(
  scrollRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  trackLength: number,
) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (!el) return;
    const sync = () => {
      const cw = el.clientWidth;
      if (cw < 1) return;
      const ideal = Math.floor((cw - 28) / 1.08);
      const cardW = Math.min(280, Math.max(176, ideal), cw - 14);
      el.style.setProperty('--highlight-card-px', `${cardW}px`);
      el.style.paddingInlineEnd = `${Math.max(80, Math.round(cw * 0.22))}px`;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      el.style.removeProperty('--highlight-card-px');
      el.style.removeProperty('padding-inline-end');
    };
  }, [enabled, trackLength]);
}

/** Célula final dos carrosseis (borda tracejada + gradiente), ação “Ver mais”. */
function TransferCarouselVerMaisTile({
  onClick,
  topLabel,
  bottomLabel,
  disabled,
  variant = 'neon',
}: {
  onClick: () => void;
  topLabel?: string;
  bottomLabel?: string;
  disabled?: boolean;
  variant?: 'neon' | 'muted';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={bottomLabel ? `Ver mais — ${bottomLabel}` : 'Ver mais'}
      className={cn(
        'flex w-[min(5.25rem,calc(100vw-2rem))] max-w-[5.5rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-1.5 py-5 text-center transition-colors sm:w-[5.25rem] sm:px-2 sm:py-6',
        variant === 'neon'
          ? 'border-neon-yellow/40 bg-gradient-to-b from-neon-yellow/10 via-black/40 to-black/60 hover:from-neon-yellow/[0.14] hover:border-neon-yellow/55 disabled:pointer-events-none disabled:opacity-40'
          : 'border-white/25 bg-gradient-to-b from-white/[0.07] via-black/40 to-black/55 hover:border-white/35 hover:from-white/[0.11] disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      {topLabel ? (
        <span className="text-[7px] font-bold uppercase leading-tight tracking-widest text-gray-500 sm:text-[8px]">
          {topLabel}
        </span>
      ) : null}
      <span className="font-display text-[11px] font-black uppercase leading-tight tracking-wide text-neon-yellow sm:text-xs">
        Ver mais
      </span>
      {bottomLabel ? (
        <span className="max-w-[4.5rem] px-0.5 text-[7px] leading-tight text-gray-500 sm:max-w-none sm:text-[8px]">
          {bottomLabel}
        </span>
      ) : null}
    </button>
  );
}

// ─── Slides promocionais por aba ────────────────────────────────────────────
// imageUrl aponta pra `/public/transfer-heroes/{tab}-{n}.webp` — o designer
// popula a arte depois. Enquanto ausente, TransferHeroSlider renderiza
// fallback com gradiente temático. Troca de imagem é substituição direta do
// ficheiro; sem necessidade de mexer neste array.

function heroSlidesForTab(tab: HeroTab): { imageUrl?: string; title: string; subtitle: string; tag?: string; ctaLabel?: string; onCta?: () => void }[] {
  switch (tab) {
    case 'genesis':
      return [
        { imageUrl: '/transfer-heroes/genesis-01.webp', title: 'Drops Genesis', subtitle: 'Cartas fundadoras limitadas. A primeira geração do universo OLEFOOT.', tag: 'Coleção original', ctaLabel: 'Ver drops' },
        { imageUrl: '/transfer-heroes/genesis-02.webp', title: 'Hall dos 90+', subtitle: 'Os overalls mais altos da temporada em disputa por lance.', tag: 'Elite', ctaLabel: 'Lance agora' },
        { imageUrl: '/transfer-heroes/genesis-03.webp', title: 'Craques em moeda BRO', subtitle: 'Pague em BRO e leva pra plantel imediatamente.', tag: 'BRO only', ctaLabel: 'Explorar' },
      ];
    case 'legacies':
      return [
        { imageUrl: '/transfer-heroes/legacies-01.webp', title: 'Lendas com DNA', subtitle: 'Cartas Legacy carregam linhagem — cada geração herda parte da história.', tag: 'DNA evolutivo', ctaLabel: 'Ver linhagens' },
        { imageUrl: '/transfer-heroes/legacies-02.webp', title: 'Descendentes em alta', subtitle: 'Filhos de lendas começando a brilhar — aposta pra valorização.', tag: 'Promessa', ctaLabel: 'Descobrir' },
      ];
    case 'newbies':
      return [
        { imageUrl: '/transfer-heroes/newbies-01.webp', title: 'Novos no mercado', subtitle: 'Cartas recém-listadas — aproveite antes da concorrência chegar.', tag: 'Fresco', ctaLabel: 'Ver tudo' },
        { imageUrl: '/transfer-heroes/newbies-02.webp', title: 'Prospectos da Academia', subtitle: 'Talentos formados por outros managers — aprenda a fazer olho clínico.', tag: 'Academia', ctaLabel: 'Garimpar' },
      ];
    case 'highlights':
      return [
        { imageUrl: '/transfer-heroes/highlights-01.webp', title: 'Destaques da semana', subtitle: 'Curadoria do time — cartas com buzz no mercado e overall de topo.', tag: 'Curadoria', ctaLabel: 'Ver destaques' },
        { imageUrl: '/transfer-heroes/highlights-02.webp', title: 'Leilões quentes', subtitle: 'Terminam em horas. Último lance define dono.', tag: 'Encerra hoje', ctaLabel: 'Entrar no leilão' },
        { imageUrl: '/transfer-heroes/highlights-03.webp', title: 'Títulos memoráveis', subtitle: 'Cartas com troféus raros equipados — valor narrativo + desempenho.', tag: 'Memorável', ctaLabel: 'Explorar' },
      ];
  }
}

function featuredBoxesConfigForTab(tab: HeroTab): { title: string; subtitle: string; variant: 'premium' | 'rising' | 'drop' } {
  switch (tab) {
    case 'genesis':   return { title: 'Genesis em foco', subtitle: 'Seleção curada das cartas fundadoras em destaque.', variant: 'premium' };
    case 'legacies':  return { title: 'Legacies em foco', subtitle: 'Linhagens com DNA forte e histórico valioso.', variant: 'premium' };
    case 'newbies':   return { title: 'Chegaram ao mercado', subtitle: 'Cartas recém-listadas — movimento ainda a formar.', variant: 'rising' };
    case 'highlights':return { title: 'Drops em alta', subtitle: 'Valor de compra imediata no topo da temporada.', variant: 'drop' };
  }
}

function featuredBoxesPlayersForTab(tab: HeroTab, pool: MockAuctionPlayer[]): MockAuctionPlayer[] {
  switch (tab) {
    case 'genesis':   return [...pool].filter((p) => p.marketKind === 'genesis' || p.ovr >= 82).sort((a, b) => b.ovr - a.ovr).slice(0, 6);
    case 'legacies':  return [...pool].sort((a, b) => b.ovr - a.ovr).slice(0, 6); // real filter virá quando pool tiver flag legacy
    case 'newbies':   return [...pool].sort((a, b) => b.id - a.id).slice(0, 6);
    case 'highlights':return [...pool].sort((a, b) => b.buyNow - a.buyNow).slice(0, 6);
  }
}

export function Transfer() {
  useTrackScreen('screen_transfer');
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [purchaseCompleteBanner, setPurchaseCompleteBanner] = useState(false);
  const purchaseBannerHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<MockAuctionPlayer | null>(null);
  const [discoveryVisibleCount, setDiscoveryVisibleCount] = useState(initialDiscoveryVisibleMap);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const highlightsScrollRef = useRef<HTMLDivElement>(null);

  const dispatch = useGameDispatch();
  const playersById = useGameStore((s) => s.players);
  const managerProspectMarket = useGameStore((s) => s.managerProspectMarket);
  const oleBal = useGameStore((s) => s.finance.ole);

  // NPC offers removidos — mercado é exclusivamente Genesis.

  const [genesisAuctionCards, setGenesisAuctionCards] = useState<MockAuctionPlayer[]>([]);
  const [genesisListedEntities, setGenesisListedEntities] = useState<Record<string, PlayerEntity>>({});
  const [marketTab, setMarketTab] = useState<HeroTab>('genesis');
  const { flags } = usePlatformConfig();
  const legacyMarketEnabled = flags.LEGACY_MARKET && flags.LEGACY_DNA;

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setGenesisAuctionCards([]);
      setGenesisListedEntities({});
      return;
    }
    let cancelled = false;
    void Promise.all([fetchGenesisMarketAuctionCards(), fetchListedGenesisEntitiesByCatalogId()]).then(
      ([cards, byCatalog]) => {
        if (cancelled) return;
        setGenesisAuctionCards(cards);
        setGenesisListedEntities(byCatalog);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const managerAuctionCards = useMemo(() => {
    // Apenas listagens do próprio utilizador (jogadores genesis relistados).
    // NPC offers (jogadores criados pelo sistema) removidos — mercado é exclusivamente Genesis.
    const out: MockAuctionPlayer[] = [];
    let nid = 9_000_001;
    for (const l of managerProspectMarket.ownListings) {
      const pl = playersById[l.playerId];
      if (!pl) continue;
      out.push(
        playerEntityToManagerMockAuction(pl, nid++, l.priceExp, 'manager_own', {
          managerListingId: l.listingId,
          managerPlayerId: l.playerId,
        }),
      );
    }
    return out;
  }, [managerProspectMarket.ownListings, playersById]);

  const ownedGenesisCatalogIds = useMemo(
    () =>
      new Set(
        Object.keys(playersById)
          .filter((id) => id.startsWith('genesis-'))
          .map((id) => id.slice('genesis-'.length)),
      ),
    [playersById],
  );

  const auctionPool = useMemo(() => {
    const genesisFiltered = genesisAuctionCards.filter(
      (c) => !c.genesisCatalogId || !ownedGenesisCatalogIds.has(c.genesisCatalogId),
    );
    return [...genesisFiltered, ...managerAuctionCards];
  }, [genesisAuctionCards, managerAuctionCards, ownedGenesisCatalogIds]);

  // Filters State
  type SortKey = 'relevance' | 'value_desc' | 'price_asc' | 'new' | 'deals';
  const [filters, setFilters] = useState<{
    pos: string;
    nat: string;
    name: string;
    /** Vazio = todas as moedas. */
    currency: '' | AuctionCurrency;
    sort: SortKey;
  }>({
    pos: '',
    nat: '',
    name: '',
    currency: '',
    sort: 'relevance',
  });

  useEffect(() => {
    if (!showSearch) return;
    const id = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [showSearch]);

  const nameQueryNorm = filters.name.trim().toLowerCase();

  const filteredPlayers = useMemo(
    () =>
      auctionPool.filter((p) => {
        if (filters.pos && p.pos !== filters.pos) return false;
        if (filters.nat && p.nat !== filters.nat) return false;
        if (filters.currency && p.auctionCurrency !== filters.currency) return false;
        if (nameQueryNorm && !p.name.toLowerCase().includes(nameQueryNorm)) return false;
        return true;
      }),
    [auctionPool, filters.pos, filters.nat, filters.currency, nameQueryNorm],
  );

  /** Aplica busca por nome (alfabética) OU ordenação explícita (ecommerce-style). */
  const gridPlayers = useMemo(() => {
    const list = [...filteredPlayers];
    if (nameQueryNorm) {
      list.sort((a, b) => {
        const byName = a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' });
        if (byName !== 0) return byName;
        if (b.ovr !== a.ovr) return b.ovr - a.ovr;
        return a.id - b.id;
      });
      return list;
    }
    switch (filters.sort) {
      case 'value_desc':
        list.sort((a, b) => b.buyNow - a.buyNow);
        break;
      case 'price_asc':
        list.sort((a, b) => a.buyNow - b.buyNow);
        break;
      case 'new':
        list.sort((a, b) => b.id - a.id);
        break;
      case 'deals':
        list.sort((a, b) => timeLeftToSeconds(a.timeLeft) - timeLeftToSeconds(b.timeLeft));
        break;
      case 'relevance':
      default:
        list.sort((a, b) => b.ovr - a.ovr);
        break;
    }
    return list;
  }, [filteredPlayers, nameQueryNorm, filters.sort]);

  /** Dentro do resultado atual, quantos anúncios compartilham o mesmo nome (para mostrar 1/3, 2/3…). */
  const homonymRankById = useMemo(() => {
    const groups = new Map<string, MockAuctionPlayer[]>();
    for (const p of gridPlayers) {
      const k = auctionNameKey(p.name);
      const g = groups.get(k);
      if (g) g.push(p);
      else groups.set(k, [p]);
    }
    const map = new Map<number, { index: number; total: number }>();
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      group.forEach((p, i) => map.set(p.id, { index: i + 1, total: group.length }));
    }
    return map;
  }, [gridPlayers]);

  /** Sem filtros/sort nem busca: vitrine horizontal (escala). Com filtros ou sort não-default: grelha clássica. */
  const isFiltered = Boolean(
    filters.pos || filters.nat || filters.currency || nameQueryNorm || filters.sort !== 'relevance',
  );

  useEffect(() => {
    setDiscoveryVisibleCount(initialDiscoveryVisibleMap());
  }, [isFiltered]);

  const discoveryRails = useMemo(() => {
    const byOvr = [...auctionPool].sort((a, b) => b.ovr - a.ovr);
    return [
      {
        id: 'highlights' as const,
        title: 'Destaques da semana',
        hint: 'Cartas em destaque pelo overall e buzz do mercado.',
        icon: TrendingUp,
        ordered: byOvr,
      },
    ];
  }, [auctionPool]);

  const highlightsOrdered = discoveryRails.find((r) => r.id === 'highlights')?.ordered ?? [];
  const highlightsVisibleCap = discoveryVisibleCount.highlights ?? DISCOVERY_CAROUSEL_INITIAL;
  const highlightsShownLen = Math.min(highlightsVisibleCap, highlightsOrdered.length);

  useHighlightRailSizing(highlightsScrollRef, !isFiltered, highlightsShownLen);

  useEffect(() => {
    return () => {
      if (purchaseBannerHideTimerRef.current) {
        clearTimeout(purchaseBannerHideTimerRef.current);
        purchaseBannerHideTimerRef.current = null;
      }
    };
  }, []);

  const showPurchaseCompleteBanner = useCallback(() => {
    setPurchaseCompleteBanner(true);
    if (purchaseBannerHideTimerRef.current) {
      clearTimeout(purchaseBannerHideTimerRef.current);
      purchaseBannerHideTimerRef.current = null;
    }
    purchaseBannerHideTimerRef.current = window.setTimeout(() => {
      setPurchaseCompleteBanner(false);
      purchaseBannerHideTimerRef.current = null;
    }, 6000);
  }, []);

  const handleMockBuyNow = useCallback(() => {
    showPurchaseCompleteBanner();
    setSelectedPlayer(null);
  }, [showPurchaseCompleteBanner]);

  const handleAcademiaMarketAction = useCallback(async () => {
    if (!selectedPlayer?.marketKind || selectedPlayer.marketKind === 'mock') return;
    if (selectedPlayer.marketKind === 'genesis') {
      const cid = selectedPlayer.genesisCatalogId;
      if (!cid) return;
      const entity = genesisListedEntities[cid];
      if (!entity) return;

      // Validação server-side: preço e unicidade confirmados pelo servidor antes do dispatch.
      const sb = getSupabase();
      const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
      const base = olefootApiBase();
      if (!base) {
        // Sem servidor configurado — fallback para validação client-side apenas (dev local)
        console.warn('[market/buy] servidor não configurado, validando apenas no cliente');
      } else {
        let serverRes: { ok: boolean; price_exp?: number; mint_overall?: number; error?: string } | null = null;
        try {
          const r = await fetch(`${base}/api/market/buy`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ genesis_catalog_id: cid }),
          });
          serverRes = await r.json() as typeof serverRes;
        } catch {
          console.error('[market/buy] falha de rede');
          return;
        }
        if (!serverRes?.ok) {
          console.warn('[market/buy] rejeitado pelo servidor:', serverRes?.error);
          return;
        }
      }

      const priceExp = Math.round(selectedPlayer.listingPriceExp ?? selectedPlayer.buyNow);
      const mintOverall = Math.round(
        selectedPlayer.mintOverall ?? entity.mintOverall ?? overallFromAttributes(entity.attrs),
      );
      if (oleBal < priceExp) return;
      dispatch({
        type: 'BUY_GENESIS_MARKET_PLAYER',
        player: entity,
        priceExp,
        genesisCatalogId: cid,
        mintOverall,
      });
      trackGrowthCommerce('transfer_player', 0, { grossBroCents: priceExp, label: entity.name });
      showPurchaseCompleteBanner();
      setSelectedPlayer(null);
      return;
    }
    if (selectedPlayer.marketKind === 'manager_own' && selectedPlayer.managerListingId) {
      dispatch({ type: 'DELIST_MANAGER_PROSPECT', listingId: selectedPlayer.managerListingId });
      setSelectedPlayer(null);
    }
  }, [selectedPlayer, genesisListedEntities, oleBal, dispatch, showPurchaseCompleteBanner]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden pb-6 md:pb-8">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-white/5 p-1 hide-scrollbar">
        {([
          { id: 'genesis', label: 'Genesis', active: 'bg-neon-yellow text-black' },
          ...(legacyMarketEnabled ? [{ id: 'legacies' as const, label: 'Legacies', active: 'bg-amber-500 text-black' }] : []),
          { id: 'newbies' as const, label: 'Newbies', active: 'bg-emerald-400 text-black' },
          { id: 'highlights' as const, label: 'Highlights', active: 'bg-fuchsia-400 text-black' },
        ] as { id: HeroTab; label: string; active: string }[]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMarketTab(t.id)}
            className={cn(
              'flex-1 shrink-0 rounded-lg py-2 px-3 text-xs font-bold uppercase tracking-wider transition-colors',
              marketTab === t.id ? t.active : 'text-gray-400 hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Hero promocional por aba — arte será substituída pelo designer. */}
      <TransferHeroSlider
        tab={marketTab}
        slides={heroSlidesForTab(marketTab)}
      />

      {legacyMarketEnabled && marketTab === 'legacies' ? <TransferLegaciesTab /> : null}
      <div className={marketTab !== 'legacies' ? 'contents' : 'hidden'}>
      <AnimatePresence>
        {purchaseCompleteBanner && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-between gap-3 rounded-xl border border-neon-green/60 bg-gradient-to-r from-neon-green/25 via-neon-green/15 to-black/80 px-4 py-3 shadow-[0_0_32px_rgba(0,255,102,0.12)] sm:px-5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <CheckCircle2 className="h-8 w-8 shrink-0 text-neon-green" aria-hidden />
              <div className="min-w-0">
                <p className="font-display text-sm font-black uppercase tracking-[0.2em] text-neon-green sm:text-base">
                  COMPRA CONCLUÍDA
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400 sm:text-xs">
                  Compra imediata registada. Continua a negociar no mercado quando quiseres.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (purchaseBannerHideTimerRef.current) {
                  clearTimeout(purchaseBannerHideTimerRef.current);
                  purchaseBannerHideTimerRef.current = null;
                }
                setPurchaseCompleteBanner(false);
              }}
              className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fechar aviso de compra"
            >
              <X className="h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-6 min-w-0 space-y-3">
        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="min-w-0 w-full flex-1">
            <h2 className="min-w-0 break-words text-2xl font-display font-black italic uppercase leading-tight tracking-wider sm:text-3xl lg:text-4xl [overflow-wrap:anywhere]">
              Mercado de Leilões
            </h2>
            <p className="mt-2 w-full min-w-0 max-w-full text-[11px] leading-relaxed text-gray-500 [overflow-wrap:anywhere] break-words sm:max-w-2xl">
              Cada card tem uma moeda única de lance (EXP ou BRO).{' '}
              <Link to="/transfer/exchange" className="text-neon-yellow/90 underline-offset-2 hover:underline">
                Exchange EXP ↔ BRO
              </Link>
            </p>
          </div>
          <div className="grid min-w-0 w-full max-w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-none sm:flex-row sm:justify-end sm:gap-2 md:w-auto">
            <button
              type="button"
              onClick={() => setShowSearch((s) => !s)}
              className={cn(
                'relative flex min-h-11 min-w-0 w-full max-w-full items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-panel px-2 py-2.5 transition-colors min-[400px]:gap-2 min-[400px]:px-3 sm:w-auto sm:min-w-[8.5rem] sm:flex-initial sm:px-4 sm:py-3',
                showSearch ? 'bg-white/20 ring-1 ring-neon-yellow/40' : 'hover:bg-white/10',
              )}
              aria-expanded={showSearch}
              aria-label={showSearch ? 'Fechar busca' : 'Abrir busca por nome'}
            >
              <Search className="h-4 w-4 shrink-0 text-neon-yellow min-[400px]:h-5 min-[400px]:w-5" />
              <span className="min-w-0 max-w-[min(100%,5.5rem)] truncate text-center font-display text-[10px] font-bold uppercase leading-tight tracking-wide text-white min-[400px]:max-w-none min-[400px]:text-[11px] sm:max-w-[8rem] sm:truncate md:max-w-none">
                Buscar
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'relative flex min-h-11 min-w-0 w-full max-w-full items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-panel px-2 py-2.5 transition-colors min-[400px]:gap-2 min-[400px]:px-3 sm:w-auto sm:min-w-[8.5rem] sm:flex-initial sm:px-4 sm:py-3',
                showFilters ? 'bg-white/20' : 'hover:bg-white/10',
              )}
              aria-expanded={showFilters}
              aria-label={showFilters ? 'Fechar filtros' : 'Abrir filtros'}
            >
              <Filter className="h-4 w-4 shrink-0 text-neon-yellow min-[400px]:h-5 min-[400px]:w-5" />
              <span className="min-w-0 max-w-[min(100%,5.5rem)] truncate text-center font-display text-[10px] font-bold uppercase leading-tight tracking-wide text-white min-[400px]:max-w-none min-[400px]:text-[11px] sm:max-w-[8rem] sm:truncate md:max-w-none">
                Filtros
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Busca só por nome (mesmo estado que o campo Nome nos filtros) */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="sports-panel mb-4 flex flex-col gap-3 border-neon-yellow/25 bg-dark-gray p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <label className="sr-only" htmlFor="transfer-search-input">
                  Buscar por nome do jogador
                </label>
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neon-yellow/70" />
                  <input
                    id="transfer-search-input"
                    ref={searchInputRef}
                    type="search"
                    placeholder="Nome no cartão (ex.: SILVA)…"
                    value={filters.name}
                    onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setShowSearch(false);
                    }}
                    className="w-full rounded-lg border border-white/10 bg-black/50 py-2.5 pl-10 pr-10 font-display font-bold uppercase text-white placeholder:text-gray-500 placeholder:normal-case outline-none focus:border-neon-yellow"
                    autoComplete="off"
                  />
                  {filters.name.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => setFilters({ ...filters, name: '' })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-white/10 hover:text-white"
                      aria-label="Limpar busca"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="min-w-0 max-w-full text-[10px] leading-snug text-gray-500 [overflow-wrap:anywhere] break-words sm:max-w-[220px] sm:shrink-0 sm:pt-2">
                  {gridPlayers.length}{' '}
                  {gridPlayers.length === 1 ? 'anúncio listado' : 'anúncios listados'}
                  {nameQueryNorm ? ' · mesmos nomes ordenados por OVR' : ''}
                </p>
              </div>
              {nameQueryNorm && gridPlayers.length > 0 && (
                <div className="border-t border-white/10 pt-3">
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                    Atalho — escolher anúncio
                  </p>
                  <ul
                    className="max-h-44 space-y-1 overflow-y-auto overscroll-y-contain rounded-lg border border-white/5 bg-black/30 p-1"
                    aria-label="Resultados da busca por nome"
                  >
                    {gridPlayers.slice(0, 20).map((p) => {
                      const hm = homonymRankById.get(p.id);
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPlayer(p);
                              setShowSearch(false);
                            }}
                            className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left hover:bg-white/10"
                          >
                            <span className="block min-w-0 max-w-full break-words font-display text-xs font-bold tracking-wide text-white">
                              {p.name}
                              {hm ? (
                                <span className="ml-1.5 text-neon-yellow/90">
                                  ({hm.index}/{hm.total})
                                </span>
                              ) : null}
                            </span>
                            <span className="block min-w-0 max-w-full break-words text-[10px] text-gray-400 [overflow-wrap:anywhere]">
                              {playerIdentityLine(p)}
                            </span>
                            <span className="text-[9px] text-gray-600">Anúncio #{p.id}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="sports-panel mb-6 grid grid-cols-1 gap-4 border-neon-yellow/30 bg-dark-gray p-4 sm:p-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Posição
                </label>
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/50 p-2 font-display font-bold text-white outline-none focus:border-neon-yellow"
                  value={filters.pos}
                  onChange={(e) => setFilters({ ...filters, pos: e.target.value })}
                >
                  <option value="">Todas</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Nacionalidade
                </label>
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/50 p-2 font-display font-bold text-white outline-none focus:border-neon-yellow"
                  value={filters.nat}
                  onChange={(e) => setFilters({ ...filters, nat: e.target.value })}
                >
                  <option value="">Todas</option>
                  {NATIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Compra em
                </label>
                <select
                  className="w-full rounded-lg border border-white/10 bg-black/50 p-2 font-display font-bold text-white outline-none focus:border-neon-yellow"
                  value={filters.currency}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFilters({
                      ...filters,
                      currency: v === 'BRO' || v === 'EXP' ? v : '',
                    });
                  }}
                >
                  <option value="">Todas</option>
                  <option value="BRO">BRO</option>
                  <option value="EXP">EXP</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Nome
                </label>
                <input
                  type="search"
                  placeholder="Buscar por nome…"
                  value={filters.name}
                  onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-black/50 p-2 font-display font-bold uppercase text-white placeholder:text-gray-500 placeholder:normal-case outline-none focus:border-neon-yellow"
                  autoComplete="off"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Ordenar
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { id: 'relevance', label: 'Relevância' },
                    { id: 'value_desc', label: 'Mais valiosos' },
                    { id: 'price_asc', label: 'Mais baratos' },
                    { id: 'new', label: 'Novos' },
                    { id: 'deals', label: 'Oportunidades' },
                  ] as const).map((s) => {
                    const active = filters.sort === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setFilters({ ...filters, sort: s.id })}
                        className={cn(
                          'rounded-full border px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider transition-colors',
                          active
                            ? 'border-neon-yellow bg-neon-yellow text-black'
                            : 'border-white/15 bg-white/5 text-gray-300 hover:bg-white/10',
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grelha completa quando há filtros/busca; vitrine em carris quando o catálogo está “aberto”. */}
      {isFiltered ? (
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {gridPlayers.map((player, i) => (
            <motion.div
              key={player.id}
              className="min-w-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              onClick={() => setSelectedPlayer(player)}
            >
              <PlayerCard player={player} listHomonym={homonymRankById.get(player.id)} />
            </motion.div>
          ))}
          {gridPlayers.length === 0 && (
            <div className="col-span-full py-12 text-center font-display text-xl font-bold text-gray-500">
              Nenhum jogador encontrado com estes filtros.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Boxes em destaque — seleção por aba. Apresentação maior que o carrossel. */}
          <TransferFeaturedBoxes
            title={featuredBoxesConfigForTab(marketTab).title}
            subtitle={featuredBoxesConfigForTab(marketTab).subtitle}
            variant={featuredBoxesConfigForTab(marketTab).variant}
            players={featuredBoxesPlayersForTab(marketTab, auctionPool)}
            onSelect={setSelectedPlayer}
          />
          {discoveryRails.map((rail) => {
            const Icon = rail.icon;
            const vis = discoveryVisibleCount[rail.id] ?? DISCOVERY_CAROUSEL_INITIAL;
            const shown = rail.ordered.slice(0, vis);
            const canMore = vis < rail.ordered.length;
            const nextChunk = Math.min(DISCOVERY_CAROUSEL_STEP, rail.ordered.length - vis);
            const isHighlightsRail = rail.id === 'highlights';
            const railHomonymById = homonymRankMapForPlayers(rail.ordered);
            return (
              <section key={rail.id} className="min-w-0 space-y-3">
                {/* Rail header */}
                <div className="flex min-w-0 items-center gap-2.5 px-0.5">
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    isHighlightsRail ? 'bg-neon-yellow/15 shadow-[0_0_12px_rgba(234,255,0,0.15)]' : 'bg-white/5',
                  )}>
                    <Icon className="h-4 w-4 text-neon-yellow" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-sm font-black uppercase tracking-widest text-white sm:text-base">
                      {rail.title}
                    </h3>
                    <p className="text-[10px] leading-snug text-gray-500">{rail.hint}</p>
                  </div>
                  {canMore && (
                    <button
                      type="button"
                      onClick={() => setDiscoveryVisibleCount((prev) => ({
                        ...prev,
                        [rail.id]: Math.min(rail.ordered.length, (prev[rail.id] ?? DISCOVERY_CAROUSEL_INITIAL) + DISCOVERY_CAROUSEL_STEP),
                      }))}
                      className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-display text-[9px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:border-neon-yellow/40 hover:text-neon-yellow"
                    >
                      +{nextChunk} mais
                    </button>
                  )}
                </div>

                {/* Carousel — sem scrollbar, com fade nas bordas */}
                <div className="relative -mx-3 sm:-mx-4 lg:-mx-8">
                  {/* fade esquerda */}
                  <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-3 bg-gradient-to-r from-deep-black/90 to-transparent sm:w-4 lg:w-8" />
                  {/* fade direita */}
                  <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-16 bg-gradient-to-l from-deep-black/95 via-deep-black/60 to-transparent sm:w-20 lg:w-24" />
                  <div
                    ref={isHighlightsRail ? highlightsScrollRef : undefined}
                    className="hide-scrollbar overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] "
                  >
                    <div className="inline-flex flex-nowrap items-stretch gap-2.5 px-3 py-3 sm:gap-3 sm:px-4 lg:px-8">
                      {shown.map((player, i) => (
                        <motion.div
                          key={`${rail.id}-${player.id}`}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.02, duration: 0.18 }}
                          className={cn(
                            'min-w-0 shrink-0 cursor-pointer ',
                            isHighlightsRail
                              ? 'w-[var(--highlight-card-px,min(200px,calc(100dvw-3rem)))]'
                              : 'w-[min(160px,calc(55dvw))] sm:w-40',
                          )}
                          onClick={() => setSelectedPlayer(player)}
                        >
                          {isHighlightsRail ? (
                            <PlayerCard player={player} listHomonym={railHomonymById.get(player.id)} carouselStrip />
                          ) : (
                            <TransferMarketCompactCard player={player} listHomonym={railHomonymById.get(player.id)} />
                          )}
                        </motion.div>
                      ))}
                      {/* Ver mais tile */}
                      <div className="flex  items-stretch">
                        <TransferCarouselVerMaisTile
                          variant="neon"
                          topLabel={rail.title}
                          bottomLabel={canMore ? `+${nextChunk} neste carril` : `${shown.length}/${rail.ordered.length}`}
                          disabled={!canMore}
                          onClick={() => {
                            if (!canMore) return;
                            setDiscoveryVisibleCount((prev) => ({
                              ...prev,
                              [rail.id]: Math.min(rail.ordered.length, (prev[rail.id] ?? DISCOVERY_CAROUSEL_INITIAL) + DISCOVERY_CAROUSEL_STEP),
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}

          {/* Sessão do mercado removida — era apenas um ranking por OVR, sem
              valor informativo novo depois do hero + featured boxes + rails.
              Mantemos o CTA do Exchange, que é decisão real do manager. */}
          <section id="transfer-exchange-cta" className="min-w-0 scroll-mt-4 border-t border-white/10 pt-8">
            <div className="flex justify-center px-0.5">
              <Link
                to="/transfer/exchange"
                className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-xl border border-neon-yellow/45 bg-gradient-to-r from-neon-yellow/15 via-black/50 to-neon-yellow/10 px-4 py-3 font-display text-xs font-black uppercase tracking-[0.2em] text-neon-yellow shadow-[0_0_24px_rgba(234,255,0,0.12)] transition-colors hover:border-neon-yellow/70 hover:from-neon-yellow/25 sm:text-sm"
              >
                Exchange EXP ↔ BRO
              </Link>
            </div>
          </section>

          {managerAuctionCards.length > 0 ? (
            <section className="min-w-0 space-y-3">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-black uppercase tracking-widest text-neon-yellow sm:text-base">
                    Jogadores anunciados
                  </h3>
                  <p className="text-[10px] text-gray-500">
                    Os teus cards à venda. Clica pra gerir preço ou retirar do mercado.
                  </p>
                </div>
                <Link
                  to="/team"
                  className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider text-white hover:bg-white/10"
                >
                  Anunciar mais
                </Link>
              </div>
              <div className="relative -mx-3 sm:-mx-4 lg:-mx-8">
                <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-3 bg-gradient-to-r from-deep-black/90 to-transparent sm:w-4 lg:w-8" />
                <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-16 bg-gradient-to-l from-deep-black/95 via-deep-black/60 to-transparent sm:w-20 lg:w-24" />
                <div className="hide-scrollbar overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
                  <div className="inline-flex flex-nowrap items-stretch gap-2.5 px-3 py-3 sm:gap-3 sm:px-4 lg:px-8">
                    {managerAuctionCards.map((player) => (
                      <motion.div
                        key={`own-${player.id}`}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-[min(160px,calc(55dvw))] min-w-0 shrink-0 cursor-pointer sm:w-40"
                        onClick={() => setSelectedPlayer(player)}
                      >
                        <TransferMarketCompactCard player={player} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      )}

      {/* Player Details Modal — overlay com scroll; painel limitado a viewport menos safe areas e barra inferior */}
      <AnimatePresence>
        {selectedPlayer && (
          <div className="fixed inset-0 z-50 flex min-h-0 flex-col overflow-y-auto overscroll-y-contain bg-black/90 px-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(1.25rem,calc(env(safe-area-inset-bottom,0px)+5.5rem))] backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+2rem))] sm:pt-[max(1rem,env(safe-area-inset-top,0px))] md:px-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                'sports-panel my-2 flex w-full min-h-0 max-w-[min(100%,64rem)] flex-col overflow-hidden rounded-none p-0 sm:my-4 sm:rounded-xl',
                // Não usar h=100dvh no painel: soma com padding do overlay cortava o fundo; max-h deixa o scroll interior funcionar.
                'max-h-[min(920px,calc(100dvh-7.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] sm:max-h-[min(920px,calc(100dvh-4.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))]',
                selectedPlayer.category === 'gold'
                  ? `border-2 border-neon-yellow ${GOLD_CARD_GLOW}`
                  : 'border-neon-yellow/50 shadow-[0_0_50px_rgba(228,255,0,0.1)]',
              )}
            >
              <div className="z-[60] flex shrink-0 justify-end px-3 pb-1 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlayer(null)}
                  className="rounded-full bg-black/50 p-2 text-gray-400 hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Corpo com scroll até ao fim (leilão, histórico, bio) */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-pb-4 [-webkit-overflow-scrolling:touch]">
                <div className="flex flex-col pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] md:flex-row md:pb-10">
                  {/* Left: Card */}
                  <div className="flex w-full shrink-0 items-start justify-center border-b border-white/10 bg-black/20 p-4 sm:p-6 md:w-2/5 md:border-b-0 md:border-r md:px-8 md:pb-8 md:pt-2">
                    <div className="w-full max-w-[300px]">
                      <PlayerCard player={selectedPlayer} isModal />
                    </div>
                  </div>

                  {/* Right: Details & Bidding */}
                  <div className="min-w-0 flex-1 p-4 sm:p-6 md:px-8 md:pb-8 md:pt-2">
                    <div className="flex flex-col gap-6">
                    {/* Header */}
                    <div className="border-b border-white/10 pb-4">
                      <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                        <h2 className="min-w-0 max-w-full break-words text-2xl font-display font-black italic uppercase tracking-wider text-white [overflow-wrap:anywhere] sm:text-3xl md:text-4xl">
                          {selectedPlayer.name}
                        </h2>
                        <span
                          className="shrink-0 rounded border border-white/20 bg-white/10 px-2 py-1 text-xl leading-none"
                          title={
                            selectedPlayer.nat?.trim() && selectedPlayer.nat !== '—'
                              ? `País (código): ${selectedPlayer.nat}`
                              : undefined
                          }
                        >
                          {natFlagDisplay(selectedPlayer.nat) || '—'}
                        </span>
                      </div>
                      <p className="min-w-0 max-w-full break-words text-sm font-bold uppercase tracking-widest text-neon-yellow [overflow-wrap:anywhere]">
                        {selectedPlayer.pos} • Overall {selectedPlayer.ovr}
                      </p>
                      <p className="mt-1.5 text-[10px] text-gray-500">
                        Anúncio #{selectedPlayer.id} · {playerIdentityLine(selectedPlayer)}
                      </p>
                    </div>

                    {/* Bio (até 250 caracteres) */}
                    <div className="rounded-xl border border-white/10 bg-black/35 p-4">
                      <h3 className="font-bold text-gray-400 uppercase text-xs mb-2 flex items-center gap-2 tracking-wider">
                        <UserCircle className="w-4 h-4" /> Bio
                      </h3>
                      <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">
                        {(selectedPlayer.bio ?? '').trim() || 'Sem bio disponível para este anúncio.'}
                      </p>
                      {selectedPlayer.bio && (
                        <p className="mt-2 text-[10px] text-gray-500">
                          {Math.min(selectedPlayer.bio.length, BIO_MAX_LEN)} / {BIO_MAX_LEN} caracteres
                        </p>
                      )}
                    </div>

                    <TransferMemorablesInfoBox ids={selectedPlayer.memorableTrophyIds} />

                    {/* Attributes Grid */}
                    <div>
                      <h3 className="font-bold text-gray-400 uppercase text-xs mb-4 flex items-center gap-2 tracking-wider">
                        <TrendingUp className="w-4 h-4"/> Atributos Detalhados
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <StatBar label="PAC" value={selectedPlayer.pac} />
                        <StatBar label="DRI" value={selectedPlayer.dri} />
                        <StatBar label="SHO" value={selectedPlayer.sho} />
                        <StatBar label="DEF" value={selectedPlayer.def} />
                        <StatBar label="PAS" value={selectedPlayer.pas} />
                        <StatBar label="PHY" value={selectedPlayer.phy} />
                      </div>
                    </div>

                    {/* History */}
                    <div className="bg-black/40 p-5 rounded-xl border border-white/5">
                      <h3 className="font-bold text-gray-400 uppercase text-xs mb-3 tracking-wider">Histórico Recente</h3>
                      <div className="space-y-2">
                        {selectedPlayer.history.map((h: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex flex-col gap-2 border-b border-white/5 pb-3 text-sm last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:pb-2"
                          >
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
                              <span className="font-bold text-gray-500">{h.year}</span>
                              <span className="font-medium text-white">{h.club}</span>
                            </div>
                            <div className="flex shrink-0 gap-4 text-gray-400">
                              <span>{h.apps} Jogos</span>
                              <span className="font-bold text-white">{h.goals} Gols</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bidding Area */}
                    <div className="pt-2">
                      <div className="relative overflow-hidden rounded-xl border border-neon-green/50 bg-gradient-to-br from-neon-green/20 to-transparent p-4 sm:p-6">
                        <div className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'radial-gradient(#00FF66 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
                        
                        <div className="relative z-10">
                          <div className="mb-5 flex flex-col gap-4 md:mb-6 md:flex-row md:items-end md:justify-between">
                            <div className="min-w-0">
                              <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neon-green">
                                <Gavel className="h-4 w-4 shrink-0" /> Lance Atual
                              </div>
                              <div className="max-w-full break-words text-xl font-display font-black text-white drop-shadow-md [overflow-wrap:anywhere] sm:text-2xl md:text-3xl lg:text-4xl">
                                {formatAuctionDisplay(selectedPlayer.auctionCurrency, selectedPlayer.currentBid)}
                              </div>
                            </div>
                            <div className="text-left md:text-right">
                              <div className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">Tempo Restante</div>
                              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 font-display text-lg font-bold tabular-nums text-white sm:text-xl md:text-2xl">
                                <Clock className="h-5 w-5 shrink-0 text-neon-yellow sm:h-6 sm:w-6" aria-hidden />
                                <span className="min-w-0 break-all">{selectedPlayer.timeLeft}</span>
                              </div>
                            </div>
                          </div>
                          
                          {selectedPlayer.marketKind === 'manager_own' ||
                          selectedPlayer.marketKind === 'genesis' ? (
                            <div className="space-y-3">
                              {selectedPlayer.marketKind === 'manager_own' ? (
                                <p className="text-[10px] text-gray-400">
                                  Anúncio teu — retira o prospect do mercado quando quiseres (sem custo).
                                </p>
                              ) : (
                                <>
                                  <p className="text-[10px] text-gray-400">
                                    Saldo EXP:{' '}
                                    <span className="font-display font-bold text-white">{formatExp(oleBal)}</span>
                                    {selectedPlayer.marketKind === 'genesis' &&
                                    oleBal < selectedPlayer.buyNow ? (
                                      <span className="mt-1 block text-red-300">
                                        Saldo insuficiente para compra imediata.
                                      </span>
                                    ) : null}
                                  </p>
                                  {selectedPlayer.marketKind === 'genesis' && selectedPlayer.genesisCatalogId ? (
                                    <p className="text-[10px] text-gray-400">
                                      {genesisListedEntities[selectedPlayer.genesisCatalogId] == null
                                        ? 'A sincronizar catálogo Genesis… recarrega se o botão ficar bloqueado.'
                                        : genesisListedEntities[selectedPlayer.genesisCatalogId]!.contractIsLifetime
                                          ? 'Contrato vitalício (admin) — não expira com jogos.'
                                          : `Contrato: ${
                                              genesisListedEntities[selectedPlayer.genesisCatalogId]!
                                                .contractMatchesIncluded ?? 70
                                            } jogos (amistoso ou oficial).`}
                                    </p>
                                  ) : null}
                                </>
                              )}
                              <button
                                type="button"
                                onClick={handleAcademiaMarketAction}
                                disabled={
                                  selectedPlayer.marketKind === 'genesis' &&
                                  (oleBal < selectedPlayer.buyNow ||
                                    (!!selectedPlayer.genesisCatalogId &&
                                      genesisListedEntities[selectedPlayer.genesisCatalogId] == null))
                                }
                                className={cn(
                                  'btn-primary min-h-12 w-full bg-neon-green px-3 py-3 text-black hover:bg-white sm:py-4',
                                  selectedPlayer.marketKind === 'genesis' &&
                                    (oleBal < selectedPlayer.buyNow ||
                                      (!!selectedPlayer.genesisCatalogId &&
                                        genesisListedEntities[selectedPlayer.genesisCatalogId] == null)) &&
                                    'pointer-events-none opacity-40',
                                )}
                              >
                                <span className="skew-x-6 block text-center text-sm font-black uppercase sm:text-base">
                                  {selectedPlayer.marketKind === 'manager_own'
                                    ? 'Retirar do mercado'
                                    : `Comprar agora · ${formatAuctionDisplay(
                                        selectedPlayer.auctionCurrency,
                                        selectedPlayer.buyNow,
                                      )}`}
                                </span>
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                                <div className="relative min-w-0 flex-1">
                                  <span className="pointer-events-none absolute left-3 top-1/2 w-12 -translate-y-1/2 text-center font-display text-[10px] font-bold text-gray-400 sm:left-4 sm:text-xs sm:w-14">
                                    {selectedPlayer.auctionCurrency === 'EXP' ? 'EXP' : '¢'}
                                  </span>
                                  <input
                                    type="number"
                                    placeholder={
                                      selectedPlayer.auctionCurrency === 'EXP'
                                        ? `${selectedPlayer.currentBid + 100000}`
                                        : `${selectedPlayer.currentBid + 1000}`
                                    }
                                    className="w-full min-h-12 rounded-lg border border-white/20 bg-black/60 py-3 pl-14 pr-3 font-display text-lg font-bold text-white transition-colors focus:border-neon-green focus:outline-none sm:min-h-0 sm:py-4 sm:pl-16 sm:pr-4 sm:text-xl"
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="btn-primary min-h-12 w-full max-w-full shrink-0 bg-neon-green px-3 py-3 text-black hover:bg-white sm:w-auto sm:min-h-0 sm:self-stretch sm:px-8 sm:py-4"
                                >
                                  <span className="skew-x-6 flex min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal text-center text-sm leading-tight sm:text-base md:text-lg">
                                    <Gavel className="h-5 w-5 shrink-0" aria-hidden />
                                    Confirmar Lance
                                  </span>
                                </button>
                              </div>
                              <div className="mt-4 text-center">
                                <button
                                  type="button"
                                  onClick={handleMockBuyNow}
                                  className="mx-auto block max-w-full break-words px-2 text-left text-xs text-gray-400 underline underline-offset-4 transition-colors [overflow-wrap:anywhere] hover:text-white sm:text-center"
                                >
                                  Ou comprar agora por{' '}
                                  {formatAuctionDisplay(selectedPlayer.auctionCurrency, selectedPlayer.buyNow)}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

/** Mesmo espírito visual do box MEMORÁVEIS na Sala de Troféus (Perfil). */
function TransferMemorablesInfoBox({ ids }: { ids?: MemorableTrophyId[] }) {
  const labels = memorableLabels(ids);
  const has = labels.length > 0;
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border-2 p-5 md:p-6',
        has
          ? 'border-neon-yellow bg-gradient-to-b from-[#1a1508] via-black/80 to-black/90 shadow-[0_0_28px_rgba(234,255,0,0.35),0_0_56px_rgba(250,204,21,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'border-white/10 bg-black/50',
      )}
    >
      {has && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(234,255,0,0.5), transparent 55%)',
          }}
        />
      )}
      <div className="relative z-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <span
            className={cn(
              'inline-flex max-w-full min-w-0 -skew-x-6 self-start px-3 py-1.5 font-display text-xs font-black uppercase tracking-[0.2em] md:px-4 md:text-sm md:tracking-[0.25em]',
              has
                ? 'bg-neon-yellow text-black shadow-[0_0_20px_rgba(234,255,0,0.45)]'
                : 'bg-white/10 text-gray-400 border border-white/10',
            )}
          >
            <span className="skew-x-6 flex items-center gap-2">
              <Trophy className="w-4 h-4 shrink-0 skew-x-6" strokeWidth={2.2} />
              MEMORÁVEIS
            </span>
          </span>
          <p
            className={cn(
              'min-w-0 max-w-full text-[11px] font-medium leading-relaxed [overflow-wrap:anywhere] break-words md:max-w-md md:text-xs',
              has ? 'text-amber-200/70' : 'text-gray-500',
            )}
          >
            {has
              ? 'Títulos de campeonato ligados a esta carta: liga, copa e supercopa OLE.'
              : 'Sem títulos memoráveis neste anúncio.'}
          </p>
        </div>
        {has && (
          <ul className="space-y-2">
            {labels.map((label) => (
              <li
                key={label}
                className="flex min-w-0 items-center gap-3 rounded-lg border border-neon-yellow/40 bg-neon-yellow/10 px-3 py-2.5 shadow-[0_0_18px_rgba(234,255,0,0.2)]"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-neon-yellow bg-gradient-to-br from-neon-yellow to-amber-500 text-black -skew-x-6 shadow-[0_0_22px_rgba(250,204,21,0.45)] shrink-0">
                  <Trophy className="w-5 h-5 skew-x-6" strokeWidth={2.2} />
                </div>
                <span className="min-w-0 flex-1 break-words font-display text-sm font-bold uppercase tracking-wide text-white [overflow-wrap:anywhere]">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatBar({ label, value }: { label: string, value: number }) {
  const color = value >= 90 ? 'bg-neon-yellow' : value >= 80 ? 'bg-neon-green' : value >= 70 ? 'bg-blue-400' : 'bg-gray-400';
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <span className="w-7 shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-400 sm:w-8 sm:text-xs">
        {label}
      </span>
      <div className="min-w-0 flex-1 overflow-hidden rounded-full border border-white/5 bg-black/50 h-2.5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn("h-full rounded-full", color)} 
        />
      </div>
      <span className="w-7 shrink-0 text-right font-display text-sm font-bold tabular-nums text-white sm:w-8 sm:text-base">
        {value}
      </span>
    </div>
  );
}

/** Borda + sombras no mesmo espírito do box Memoráveis (Sala de Troféus). */
const GOLD_CARD_GLOW =
  'border-neon-yellow shadow-[0_0_28px_rgba(234,255,0,0.35),0_0_56px_rgba(250,204,21,0.18),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-amber-400/35 hover:shadow-[0_0_36px_rgba(234,255,0,0.45),0_0_72px_rgba(250,204,21,0.22)]';

/** Carta estreita para carris horizontais — poucos nós DOM vs. `PlayerCard` completo. */
function TransferMarketCompactCard({
  player,
  listHomonym,
}: {
  player: MockAuctionPlayer;
  listHomonym?: { index: number; total: number };
}) {
  const isGold = player.category === 'gold';
  const showHomonymStrip = listHomonym && listHomonym.total > 1;
  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 min-w-0 w-full cursor-pointer flex-col overflow-hidden rounded-lg border-2 bg-dark-gray transition-opacity duration-200 hover:opacity-95 active:opacity-90',
        isGold && `bg-gradient-to-b from-[#1a1508] via-dark-gray to-dark-gray ${GOLD_CARD_GLOW}`,
        !isGold && player.style === 'neon-yellow' && 'border-neon-yellow/80 shadow-[0_0_12px_rgba(228,255,0,0.12)]',
        !isGold && player.style === 'white' && 'border-white/25 hover:border-white/55',
        !isGold && player.style === 'gray-400' && 'border-gray-700 hover:border-gray-500',
      )}
    >
      {isGold && (
        <div
          className="pointer-events-none absolute inset-0 z-[1] opacity-[0.12]"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 90% 45% at 50% -15%, rgba(234,255,0,0.55), transparent 50%)',
          }}
        />
      )}
      <div className="relative flex flex-1 flex-col">
        <div
          className={cn(
            'absolute inset-0 z-0 opacity-15 transition-opacity group-hover:opacity-30',
            isGold
              ? 'bg-gradient-to-b from-neon-yellow/40 to-transparent'
              : player.style === 'neon-yellow'
                ? 'bg-gradient-to-b from-neon-yellow/45 to-transparent'
                : player.style === 'white'
                  ? 'bg-gradient-to-b from-white/40 to-transparent'
                  : 'bg-gradient-to-b from-gray-500/40 to-transparent',
          )}
        />
        <div className="absolute left-2 top-2 z-20 flex flex-col items-center drop-shadow-md">
          <div
            className={cn(
              'font-display text-xl font-black leading-none',
              player.style === 'neon-yellow' ? 'text-neon-yellow' : 'text-white',
            )}
          >
            {player.ovr}
          </div>
          <div className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-white">{player.pos}</div>
        </div>
        <div className="absolute right-2 top-2 z-20 flex flex-col items-end gap-0.5">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/10 text-base leading-none"
            title={player.nat?.trim() && player.nat !== '—' ? player.nat : undefined}
          >
            {natFlagDisplay(player.nat) || <span className="text-[8px] font-bold text-white/60">—</span>}
          </div>
          <span
            className={cn(
              'rounded border px-1 py-0.5 font-display text-[7px] font-bold uppercase tracking-wider',
              player.auctionCurrency === 'EXP'
                ? 'border-neon-yellow/50 bg-black/70 text-neon-yellow'
                : 'border-white/35 bg-black/70 text-white',
            )}
          >
            {player.auctionCurrency === 'EXP' ? 'EXP' : 'BRO'}
          </span>
        </div>
        <div className="relative flex aspect-[3/4] items-end justify-center">
          <img
            src={player.portraitSrc?.trim() || `https://picsum.photos/seed/transfer-${player.id}/200/260`}
            alt=""
            className="h-full w-full object-cover object-top grayscale transition-all duration-300 group-hover:grayscale-0"
            referrerPolicy="no-referrer"
            style={{
              maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
            }}
          />
        </div>
        <div className="relative z-20 flex flex-1 flex-col justify-end bg-gradient-to-t from-black via-black/90 to-transparent px-2 pb-2 pt-6">
          <div className="text-center">
            <div className="line-clamp-1 font-display text-xs font-black uppercase tracking-wide text-white">
              {player.name}
            </div>
            {showHomonymStrip && listHomonym ? (
              <p
                className="mt-0.5 line-clamp-2 text-[7px] font-bold leading-tight tracking-wide text-neon-yellow/90 [overflow-wrap:anywhere]"
                title={playerIdentityLine(player)}
              >
                {listHomonym.index}/{listHomonym.total} · {playerIdentityLine(player)}
              </p>
            ) : null}
          </div>
          <div
            className={cn(
              'mx-auto mb-1.5 mt-1.5 h-px w-3/5 opacity-45',
              player.style === 'neon-yellow' ? 'bg-neon-yellow' : 'bg-white',
            )}
          />
          <div className="grid grid-cols-3 gap-0.5 text-center">
            <div>
              <div className="text-[7px] font-bold uppercase text-gray-500">PAC</div>
              <div className="font-display text-[10px] font-bold text-white">{player.pac}</div>
            </div>
            <div className="border-x border-white/10">
              <div className="text-[7px] font-bold uppercase text-gray-500">SHO</div>
              <div className="font-display text-[10px] font-bold text-white">{player.sho}</div>
            </div>
            <div>
              <div className="text-[7px] font-bold uppercase text-gray-500">PAS</div>
              <div className="font-display text-[10px] font-bold text-white">{player.pas}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-30 border-t border-white/10 bg-black/85 px-2 py-1.5">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-1">
            <span className="flex shrink-0 items-center justify-center gap-0.5 text-[8px] font-bold uppercase tracking-wide text-gray-400 sm:justify-start">
              <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden />
              <span className="tabular-nums">{player.timeLeft}</span>
            </span>
            <span className="min-w-0 max-w-full truncate text-center font-display text-[8px] font-bold leading-tight text-neon-green sm:text-right sm:text-[9px]">
              {formatAuctionDisplay(player.auctionCurrency, player.currentBid, 'card')}
            </span>
          </div>
          <div className="flex min-h-9 w-full max-w-full items-center justify-center gap-1 rounded bg-neon-yellow/90 px-1 py-1.5 font-display text-[7px] font-black uppercase leading-tight tracking-wider text-black min-[340px]:text-[8px]">
            <Gavel className="h-3 w-3 shrink-0" aria-hidden />
            Abrir
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  isModal = false,
  listHomonym,
  /** Carril horizontal: hover mais leve para não ser cortado por `overflow-x-auto`. */
  carouselStrip = false,
}: {
  player: MockAuctionPlayer;
  isModal?: boolean;
  /** Só na grelha: quando há mais de um anúncio com o mesmo nome no resultado atual. */
  listHomonym?: { index: number; total: number };
  carouselStrip?: boolean;
}) {
  const currencyLabel =
    player.auctionCurrency === 'EXP' ? 'Lances em EXP' : 'Lances em BRO';
  const isGold = player.category === 'gold';
  const showHomonymStrip = !isModal && listHomonym && listHomonym.total > 1;
  return (
    <div className={cn(
      'relative group flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border-2 bg-dark-gray transition-all duration-300',
      carouselStrip && 'w-full max-w-full',
      !isModal && !carouselStrip && 'w-full',
      !isModal && !carouselStrip && 'hover:-translate-y-2 hover:scale-[1.02]',
      !isModal && carouselStrip && 'hover:scale-[1.01]',
      isGold && `bg-gradient-to-b from-[#1a1508] via-dark-gray to-dark-gray ${GOLD_CARD_GLOW}`,
      !isGold && player.style === 'neon-yellow' && 'border-neon-yellow shadow-[0_0_15px_rgba(228,255,0,0.15)] group-hover:shadow-[0_0_25px_rgba(228,255,0,0.4)]',
      !isGold && player.style === 'white' && 'border-white/30 hover:border-white/80 shadow-[0_0_15px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]',
      !isGold && player.style === 'gray-400' && 'border-gray-700 hover:border-gray-400 shadow-[0_0_15px_rgba(0,0,0,0.5)] group-hover:shadow-[0_0_25px_rgba(156,163,175,0.2)]',
    )}>
      {isGold && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-[1] opacity-[0.14]"
            style={{
              backgroundImage: 'radial-gradient(ellipse 90% 45% at 50% -15%, rgba(234,255,0,0.55), transparent 50%)',
            }}
          />
          {!isModal && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[25] -skew-x-6 bg-neon-yellow text-black px-2 py-0.5 font-display font-black text-[8px] sm:text-[9px] tracking-[0.2em] uppercase shadow-[0_0_14px_rgba(234,255,0,0.5)]">
              <span className="skew-x-6">Ouro</span>
            </div>
          )}
        </>
      )}
      {/* Card Content Wrapper */}
      <div className="relative flex-1">
        {/* Background Glow based on style */}
        <div className={cn(
          "absolute inset-0 opacity-20 transition-opacity group-hover:opacity-40 z-0",
          isGold ? 'bg-gradient-to-b from-neon-yellow/45 to-transparent' :
          player.style === 'neon-yellow' ? 'bg-gradient-to-b from-neon-yellow/50 to-transparent' :
          player.style === 'white' ? 'bg-gradient-to-b from-white/50 to-transparent' :
          'bg-gradient-to-b from-gray-500/50 to-transparent'
        )} />

        {/* Halftone texture */}
        <div className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '4px 4px' }} />

        {/* Top Left Info (OVR & POS) */}
        <div className="absolute top-3 left-3 z-20 flex flex-col items-center drop-shadow-md">
          <div className={cn(
            "font-display font-black text-3xl leading-none",
            player.style === 'neon-yellow' ? 'text-neon-yellow' : 'text-white'
          )}>
            {player.ovr}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white mt-1">{player.pos}</div>
        </div>

        {/* Top Right: nação + selo de moeda do leilão */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 items-end opacity-95">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg leading-none"
            title={player.nat?.trim() && player.nat !== '—' ? player.nat : undefined}
          >
            {natFlagDisplay(player.nat) || <span className="text-[9px] font-bold text-white/60">—</span>}
          </div>
          <span
            title={currencyLabel}
            className={cn(
              'max-w-[5.5rem] truncate text-[7px] font-display font-bold uppercase tracking-wider sm:max-w-none sm:text-[8px] px-1.5 py-0.5 rounded border',
              player.auctionCurrency === 'EXP'
                ? 'border-neon-yellow/60 text-neon-yellow bg-black/70'
                : 'border-white/40 text-white bg-black/70',
            )}
          >
            {currencyLabel}
          </span>
        </div>

        {/* Player Image */}
        <div className="aspect-[3/4] relative flex items-end justify-center">
          <img 
            src={player.portraitSrc?.trim() || `https://picsum.photos/seed/transfer-${player.id}/300/400`} 
            alt={player.name} 
            className="w-full h-full object-cover object-top grayscale group-hover:grayscale-0 transition-all duration-500 drop-shadow-2xl" 
            referrerPolicy="no-referrer" 
            style={{ maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)' }} 
          />
        </div>

        {/* Card Footer / Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-20 bg-gradient-to-t from-black via-black/90 to-transparent pt-12">
          <div className="mb-2 min-w-0 px-0.5 text-center">
            <div className="break-words font-display text-lg font-black uppercase leading-none tracking-wider text-white drop-shadow-md [overflow-wrap:anywhere] sm:text-xl md:text-2xl">
              {player.name}
            </div>
            {showHomonymStrip && listHomonym ? (
              <p
                className="mt-1.5 line-clamp-2 text-center text-[7px] font-display font-bold leading-tight tracking-wide text-neon-yellow/90 [overflow-wrap:anywhere] sm:text-[8px]"
                title={`Anúncio #${player.id} · ${playerIdentityLine(player)}`}
              >
                {listHomonym.index}/{listHomonym.total} · {playerIdentityLine(player)}
              </p>
            ) : null}
          </div>

          {!isModal && player.bio && (
            <p
              className="text-center text-[9px] text-white/65 line-clamp-2 px-0.5 mb-2 leading-snug"
              title={player.bio.slice(0, BIO_MAX_LEN)}
            >
              {truncateBio(player.bio, 140)}
            </p>
          )}

          {/* Divider */}
          <div className={cn(
            "h-px w-2/3 mx-auto mb-3 opacity-50",
            player.style === 'neon-yellow' ? 'bg-neon-yellow' : 'bg-white'
          )} />

          {/* Mini Stats */}
          <div className="grid grid-cols-3 gap-1">
            <div className="text-center">
              <div className="text-[9px] text-gray-400 font-bold uppercase">PAC</div>
              <div className="text-sm font-display font-bold text-white">{player.pac}</div>
            </div>
            <div className="text-center border-x border-white/10">
              <div className="text-[9px] text-gray-400 font-bold uppercase">SHO</div>
              <div className="text-sm font-display font-bold text-white">{player.sho}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-gray-400 font-bold uppercase">PAS</div>
              <div className="text-sm font-display font-bold text-white">{player.pas}</div>
            </div>
          </div>

          {/* Shine Effect on Hover */}
          {!isModal && (
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
          )}
        </div>
      </div>

      {/* Transfer Action Area */}
      {!isModal && (
        <div className="relative z-30 border-t border-white/10 bg-black/80 p-2.5 sm:p-3">
          <div className="flex flex-col gap-2">
            <div
              className={cn(
                'flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2',
                carouselStrip ? 'items-stretch' : 'sm:justify-between',
              )}
            >
              <span className="flex shrink-0 items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 sm:justify-start sm:text-[10px]">
                <Clock className="h-3 w-3 shrink-0" aria-hidden /> {player.timeLeft}
              </span>
              <span
                className={cn(
                  'min-w-0 max-w-full break-words text-center font-display text-xs font-bold leading-tight text-neon-green tabular-nums [overflow-wrap:anywhere] sm:text-right sm:text-base md:text-lg',
                  carouselStrip ? 'w-full truncate' : 'sm:max-w-[58%]',
                )}
                title={formatAuctionDisplay(player.auctionCurrency, player.currentBid, 'card')}
              >
                {formatAuctionDisplay(player.auctionCurrency, player.currentBid, 'card')}
              </span>
            </div>
            <button
              type="button"
              className="flex w-full min-h-11 max-w-full items-center justify-center gap-1.5 rounded-sm bg-neon-yellow px-1.5 py-2.5 font-display text-xs font-bold uppercase leading-tight tracking-wider text-black transition-colors [-webkit-tap-highlight-color:transparent] hover:bg-white sm:gap-2 sm:py-2 sm:text-sm sm:-skew-x-6 md:text-base"
            >
              <span className="flex min-w-0 max-w-full items-center justify-center gap-1.5 whitespace-normal text-center sm:skew-x-6 sm:whitespace-nowrap">
                <Gavel className="h-4 w-4 shrink-0" aria-hidden />
                Dar Lance
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
