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
  ChevronRight,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { AuctionCurrency } from '@/economy/model';
import { formatExp } from '@/systems/economy';
import { MEMORABLE_TROPHY_SLOTS, type MemorableTrophyId } from '@/trophies/memorableCatalog';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { fetchListedGenesisEntitiesByCatalogId, fetchGenesisMarketAuctionCards } from '@/supabase/genesisMarket';
import { fetchOtherManagerListings, type OtherManagerListing } from '@/supabase/academyManagers';
import { TransferLegaciesTab } from './TransferLegaciesTab';
import {
  fetchListedLegacyPlayerRows,
  legacyRowToPlayerEntity,
  legacyPortraitImageUrl,
  type LegacyPlayerRow,
} from '@/supabase/legacyPlayers';
import { useOlefootUsdBrlQuote } from '@/wallet/useOlefootUsdBrlQuote';
import { usePlatformConfig } from '@/admin/platformConfigStore';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import type { MockAuctionPlayer } from '@/transfer/mockAuctionPlayer';
import { type HeroTab } from '@/transfer/TransferHeroSlider';
import { TransferFeaturedBoxes } from '@/transfer/TransferFeaturedBoxes';
import { isSupabaseConfigured } from '@/supabase/client';
import type { PlayerEntity } from '@/entities/types';
import { countryCodeToFlagEmoji } from '@/lib/flagEmoji';
import { trackGrowthCommerce } from '@/admin/platformStore';
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { getSupabase } from '@/supabase/client';
import { useTrackScreen } from '@/progression/trackEvent';
import { BackButton } from '@/components/BackButton';
import { useMarketOffers } from '@/hooks/useMarketOffers';
import { MakeOfferModal } from '@/components/market/MakeOfferModal';
import { MarketOffersPanel } from '@/components/market/MarketOffersPanel';
import { recordMarketActivity } from '@/supabase/marketActivities';

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

/** Calcula tempo restante de 90 dias a partir da data de listagem. */
function calcTimeLeft(listedAtIso: string): string {
  const DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias
  const elapsed = Date.now() - new Date(listedAtIso).getTime();
  const remaining = Math.max(0, DURATION_MS - elapsed);
  const totalSecs = Math.floor(remaining / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function playerEntityToManagerMockAuction(
  p: PlayerEntity,
  cardId: number,
  priceExp: number,
  marketKind: 'manager_own' | 'manager_npc' | 'manager_other',
  opts: { managerListingId?: string; managerPlayerId?: string; listedAtIso?: string },
): MockAuctionPlayer {
  const ovr = overallFromAttributes(p.attrs, p.pos);
  const style = ovr >= 68 ? 'white' : 'gray-400';
  const category: MockAuctionPlayer['category'] = ovr >= 70 ? 'gold' : ovr >= 65 ? 'silver' : 'bronze';
  const ageLabel = p.age != null ? String(p.age) : '—';
  const clubLabel =
    marketKind === 'manager_own' ? 'OLE FC' : marketKind === 'manager_other' ? 'Academia OLE' : 'Rede OLE';
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
    timeLeft: calcTimeLeft(opts.listedAtIso ?? new Date().toISOString()),
    history: [
      {
        year: ageLabel,
        club: clubLabel,
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
        : marketKind === 'manager_other'
        ? 'Prospect de outro manager — Academia OLE.'
        : 'Prospect da rede de managers OLE.'),
    memorableTrophyIds: [],
    marketKind,
    managerListingId: opts.managerListingId,
    managerPlayerId: opts.managerPlayerId ?? p.id,
    portraitSrc: playerPortraitSrc({ id: p.id, name: p.name, portraitUrl: p.portraitUrl }, 400, 520),
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
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  /** Sprint B-4: visualização do catálogo "Genesis em foco" — grade ou lista horizontal. */
  const [genesisViewMode, setGenesisViewMode] = useState<'grid' | 'list'>('list');
  const purchaseBannerHideTimerRef = useRef<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<MockAuctionPlayer | null>(null);
  const [discoveryVisibleCount, setDiscoveryVisibleCount] = useState(initialDiscoveryVisibleMap);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const highlightsScrollRef = useRef<HTMLDivElement>(null);

  const dispatch = useGameDispatch();
  const playersById = useGameStore((s) => s.players);
  const managerProspectMarket = useGameStore((s) => s.managerProspectMarket);
  const oleBal = useGameStore((s) => s.finance.ole);
  const clubName = useGameStore((s) => s.club?.name ?? 'Manager');

  // NPC offers removidos — mercado é exclusivamente Genesis.

  const [genesisAuctionCards, setGenesisAuctionCards] = useState<MockAuctionPlayer[]>([]);
  const [genesisListedEntities, setGenesisListedEntities] = useState<Record<string, PlayerEntity>>({});
  const [otherManagerListings, setOtherManagerListings] = useState<OtherManagerListing[]>([]);
  // Negociação P2P — proposta de compra por listagem de outro manager.
  const marketOffers = useMarketOffers();
  const [offerModalListingId, setOfferModalListingId] = useState<string | null>(null);
  const { flags } = usePlatformConfig();
  const legacyMarketEnabled = flags.LEGACY_MARKET && flags.LEGACY_DNA;
  // Abre direto em LEGACIES (área premium) quando habilitada, pra não ficar escondida.
  const [marketTab, setMarketTab] = useState<HeroTab>(legacyMarketEnabled ? 'legacies' : 'genesis');
  const localClubId = useGameStore((s) => s.club?.id ?? null);

  // Legacies em destaque no carrossel global (curadoria: pinados na frente).
  const legacyQuote = useOlefootUsdBrlQuote(true);
  const [legacyRows, setLegacyRows] = useState<LegacyPlayerRow[]>([]);
  // `?legacy=<id>` abre o card direto — é como o CTA do pós-jogo do Legends Cup
  // manda o manager pra lenda que ele acabou de enfrentar. `?from=` fica na URL
  // só como atribuição (de onde veio a visita), não muda comportamento.
  const [searchParams] = useSearchParams();
  const [pendingLegacyDetailId, setPendingLegacyDetailId] = useState<string | null>(
    () => searchParams.get('legacy'),
  );
  // Deep-link `?legacy=` só resolve dentro da aba Legacies — força a aba
  // enquanto o pedido estiver pendente (senão o param morre em outra aba).
  useEffect(() => {
    if (pendingLegacyDetailId && legacyMarketEnabled) setMarketTab('legacies');
  }, [pendingLegacyDetailId, legacyMarketEnabled]);
  useEffect(() => {
    if (!legacyMarketEnabled) return;
    let cancelled = false;
    void fetchListedLegacyPlayerRows().then((d) => { if (!cancelled) setLegacyRows(d); });
    return () => { cancelled = true; };
  }, [legacyMarketEnabled]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setGenesisAuctionCards([]);
      setGenesisListedEntities({});
      setOtherManagerListings([]);
      return;
    }
    let cancelled = false;
    void Promise.all([
      fetchGenesisMarketAuctionCards(),
      fetchListedGenesisEntitiesByCatalogId(),
      fetchOtherManagerListings(localClubId),
    ]).then(([cards, byCatalog, others]) => {
      if (cancelled) return;
      setGenesisAuctionCards(cards);
      setGenesisListedEntities(byCatalog);
      setOtherManagerListings(others);
    });
    return () => {
      cancelled = true;
    };
  }, [localClubId]);

  const managerAuctionCards = useMemo(() => {
    const out: MockAuctionPlayer[] = [];
    let nid = 9_000_001;
    // (a) Listagens do próprio utilizador (botão DELIST_MANAGER_PROSPECT no clique)
    for (const l of managerProspectMarket.ownListings) {
      const pl = playersById[l.playerId];
      if (!pl) continue;
      out.push(
        playerEntityToManagerMockAuction(pl, nid++, l.priceExp, 'manager_own', {
          managerListingId: l.listingId,
          managerPlayerId: l.playerId,
          listedAtIso: l.listedAtIso,
        }),
      );
    }
    // (b) Listagens de OUTROS managers (compra via /api/market/buy-prospect)
    for (const l of otherManagerListings) {
      out.push(
        playerEntityToManagerMockAuction(l.player, nid++, l.priceExp, 'manager_other', {
          managerListingId: l.listingId,
          managerPlayerId: l.gamePlayerId,
          listedAtIso: l.listedAtIso,
        }),
      );
    }
    return out;
  }, [managerProspectMarket.ownListings, playersById, otherManagerListings]);

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

  const baseHighlights = discoveryRails.find((r) => r.id === 'highlights')?.ordered ?? [];
  // Curadoria do "Destaque da semana": fixa Goncalves98 + Juca (legacies) + Gui
  // Nunez (genesis) na frente do carrossel. legacyHighlightMap mapeia o id
  // sintético do card → row do legacy (pra abrir o modal certo no clique).
  const { highlightsOrdered, legacyHighlightMap } = useMemo(() => {
    const FEATURED_LEGACY_IDS = [
      'legacy-marcelo-goncalves-costa-lopes-expansao', // Goncalves98
      'legacy-juca-consolidacao', // Juca
    ];
    const FEATURED_GENESIS = 'gui nunez';
    const map = new Map<number, LegacyPlayerRow>();
    const pinned: MockAuctionPlayer[] = [];
    let synth = 9_000_001;
    for (const lid of FEATURED_LEGACY_IDS) {
      const row = legacyRows.find((r) => r.id === lid);
      if (!row) continue;
      const e = legacyRowToPlayerEntity(row);
      const ovr = overallFromAttributes(e.attrs, e.pos);
      pinned.push({
        id: synth, name: e.name, pos: e.pos, nat: row.country ?? '—', ovr,
        style: ovr >= 80 ? 'neon-yellow' : ovr >= 70 ? 'white' : 'gray-400',
        pac: e.attrs.velocidade, sho: e.attrs.finalizacao, pas: e.attrs.passe,
        dri: e.attrs.drible, def: e.attrs.marcacao, phy: e.attrs.fisico,
        auctionCurrency: 'EXP', currentBid: 0, buyNow: 0, timeLeft: '', history: [],
        category: ovr >= 80 ? 'gold' : undefined, bio: row.bio ?? undefined,
        portraitSrc: legacyPortraitImageUrl(row), marketKind: 'mock',
      });
      map.set(synth, row);
      synth += 1;
    }
    const gui = baseHighlights.find((p) => p.name.toLowerCase().includes(FEATURED_GENESIS));
    const rest = baseHighlights.filter((p) => p !== gui);
    return { highlightsOrdered: [...pinned, ...(gui ? [gui] : []), ...rest], legacyHighlightMap: map };
  }, [baseHighlights, legacyRows]);
  const highlightsVisibleCap = discoveryVisibleCount.highlights ?? DISCOVERY_CAROUSEL_INITIAL;
  const highlightsShownLen = Math.min(highlightsVisibleCap, highlightsOrdered.length);

  // Preço fixo (PIX/OLE) no card de destaque do legacy.
  const legacyHighlightFixedSale = (row: LegacyPlayerRow) => {
    const brl = legacyQuote.status === 'ok' && row.currency === 'USDT' && row.price_unit_cents
      ? Math.round(row.price_unit_cents * legacyQuote.olefootVenda) : null;
    const oleTxt = `${Math.max(1, Math.round(row.price_bro_cents)).toLocaleString('pt-BR')} OLE`;
    const price = brl != null ? `R$ ${(brl / 100).toFixed(2).replace('.', ',')}` : oleTxt;
    const isOwned = !!playersById[legacyRowToPlayerEntity(row).id];
    return { price, cta: isOwned ? 'Adquirido' : 'Comprar', badge: brl != null ? 'PIX' : 'OLE' };
  };

  useHighlightRailSizing(highlightsScrollRef, !isFiltered, highlightsShownLen);

  // Limpa erro de compra quando manager muda de jogador ou fecha o modal
  useEffect(() => {
    setPurchaseError(null);
  }, [selectedPlayer]);

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

      const priceExp = Math.round(selectedPlayer.listingPriceExp ?? selectedPlayer.buyNow);
      const mintOverall = Math.round(
        selectedPlayer.mintOverall ?? entity.mintOverall ?? overallFromAttributes(entity.attrs, entity.pos),
      );

      // Verifica saldo antes de qualquer chamada
      if (oleBal < priceExp) {
        setPurchaseError('Saldo EXP insuficiente para esta compra.');
        return;
      }

      setIsPurchasing(true);
      setPurchaseError(null);

      try {
        // Validação server-side: preço e unicidade confirmados pelo servidor
        const sb = getSupabase();
        const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
        const base = olefootApiBase();
        const serverUrl = base && base !== 'http://localhost:4000' ? base : null;

        if (serverUrl && token) {
          let serverRes: { ok: boolean; price_exp?: number; mint_overall?: number; error?: string } | null = null;
          try {
            const r = await fetch(`${serverUrl}/api/market/buy`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ genesis_catalog_id: cid }),
            });
            serverRes = await r.json() as typeof serverRes;
          } catch {
            setPurchaseError('Falha de rede. Verifica a tua ligação e tenta novamente.');
            setIsPurchasing(false);
            return;
          }
          if (!serverRes?.ok) {
            // SELF-HEAL pra "Jogador já adquirido": o servidor confirma que
            // a compra já foi registada (market_purchases unique violation),
            // mas o jogador pode ter sumido do plantel local (filtro genesis
            // antigo, cache stale, persistManagerSquad que falhou). Em vez
            // de bloquear o usuário, traz o jogador de volta SEM cobrar
            // EXP de novo.
            const isAlreadyPurchased =
              (serverRes as unknown as { already_purchased?: boolean })?.already_purchased === true ||
              serverRes?.error === 'Jogador já adquirido.';
            if (isAlreadyPurchased) {
              const pid = entity.id; // genesis-${cid}
              const fresh = getGameState();
              if (!fresh.players[pid]) {
                dispatch({
                  type: 'MERGE_PLAYERS',
                  players: { [pid]: { ...entity, listedOnMarket: false } },
                });
                console.log('[market/buy] self-heal: jogador recuperado do servidor:', entity.name);
                showPurchaseCompleteBanner();
                setSelectedPlayer(null);
                setIsPurchasing(false);
                return;
              }
              setPurchaseError('Este jogador já está no teu plantel.');
              setIsPurchasing(false);
              return;
            }

            const msg = serverRes?.error === 'Jogador não está à venda.'
              ? 'Este jogador já não está disponível.'
              : serverRes?.error === 'Unauthorized'
              ? 'Sessão expirada. Faz login novamente.'
              : (serverRes?.error ?? 'Não foi possível concluir a compra. Tenta novamente.');
            setPurchaseError(msg);
            setIsPurchasing(false);
            return;
          }
        }
        // Se não há servidor configurado (dev local sem token), prossegue com validação client-side

        dispatch({
          type: 'BUY_GENESIS_MARKET_PLAYER',
          player: entity,
          priceExp,
          genesisCatalogId: cid,
          mintOverall,
        });

        // Registra atividade pública no feed do mercado
        void (async () => {
          const sbInner = getSupabase();
          const userId = sbInner ? (await sbInner.auth.getSession()).data.session?.user.id : undefined;
          void recordMarketActivity({
            type: 'purchase',
            managerId: userId ?? null,
            managerName: clubName,
            clubName,
            playerName: entity.name,
            playerOvr: mintOverall,
            playerPos: entity.pos,
            priceExp,
          });
        })();

        trackGrowthCommerce('transfer_player', 0, { grossBroCents: priceExp, label: entity.name });
        showPurchaseCompleteBanner();
        setSelectedPlayer(null);
      } finally {
        setIsPurchasing(false);
      }
      return;
    }

    if (selectedPlayer.marketKind === 'manager_own' && selectedPlayer.managerListingId) {
      dispatch({ type: 'DELIST_MANAGER_PROSPECT', listingId: selectedPlayer.managerListingId });
      setSelectedPlayer(null);
      return;
    }

    if (selectedPlayer.marketKind === 'manager_other' && selectedPlayer.managerListingId) {
      // Compra de Academia OLE de outro manager — exige server endpoint
      // pra fazer a transferência cross-user atomicamente (player_snapshot
      // vai pro plantel do comprador, credita EXP no vendedor via wallet_credits).
      const listingId = selectedPlayer.managerListingId;
      const listing = otherManagerListings.find((l) => l.listingId === listingId);
      if (!listing) {
        setPurchaseError('Listagem não encontrada — recarregue a página.');
        return;
      }
      if (oleBal < listing.priceExp) {
        setPurchaseError('Saldo EXP insuficiente para esta compra.');
        return;
      }
      setIsPurchasing(true);
      setPurchaseError(null);
      try {
        const sb = getSupabase();
        const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
        const base = olefootApiBase();
        const serverUrl = base && base !== 'http://localhost:4000' ? base : null;
        if (!serverUrl || !token) {
          setPurchaseError('Compra de Academia exige sessão autenticada — faz login.');
          return;
        }
        let serverRes: {
          ok: boolean;
          player_snapshot?: PlayerEntity;
          price_exp?: number;
          already_owned?: boolean;
          error?: string;
        } | null = null;
        try {
          const r = await fetch(`${serverUrl}/api/market/buy-prospect`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ listing_id: listingId }),
          });
          serverRes = (await r.json()) as typeof serverRes;
        } catch {
          setPurchaseError('Falha de rede. Verifica a tua ligação e tenta novamente.');
          return;
        }
        if (!serverRes?.ok) {
          setPurchaseError(serverRes?.error ?? 'Não foi possível concluir a compra. Tenta novamente.');
          return;
        }

        // Self-heal: se already_owned no remoto, ainda dispatcha localmente
        // (não cobra de novo — já tem) para garantir presença no plantel.
        const snap = (serverRes.player_snapshot ?? listing.player) as PlayerEntity;
        const priceCharged = serverRes.already_owned ? 0 : Number(serverRes.price_exp ?? listing.priceExp);
        dispatch({
          type: 'BUY_MANAGER_PROSPECT',
          player: snap,
          priceExp: priceCharged,
          listingId,
        });

        // Atualiza o pool local removendo a listagem comprada
        setOtherManagerListings((prev) => prev.filter((l) => l.listingId !== listingId));

        void (async () => {
          const userId = sb ? (await sb.auth.getSession()).data.session?.user.id : undefined;
          void recordMarketActivity({
            type: 'purchase',
            managerId: userId ?? null,
            managerName: clubName,
            clubName,
            playerName: snap.name,
            playerOvr: overallFromAttributes(snap.attrs, snap.pos),
            playerPos: snap.pos,
            priceExp: priceCharged,
          });
        })();

        trackGrowthCommerce('transfer_player', 0, { grossBroCents: priceCharged, label: snap.name });
        showPurchaseCompleteBanner();
        setSelectedPlayer(null);
      } finally {
        setIsPurchasing(false);
      }
      return;
    }
  }, [selectedPlayer, genesisListedEntities, otherManagerListings, oleBal, dispatch, showPurchaseCompleteBanner, clubName]);

  type TransferTabKey = 'genesis' | 'legacies' | 'newbies' | 'highlights';
  const TAB_META: Record<TransferTabKey, { num: string; subtitle: string; eyebrow: string }> = {
    genesis: { num: '01', subtitle: 'fundadores', eyebrow: 'Cartas Genesis' },
    legacies: { num: '02', subtitle: 'lendas', eyebrow: 'Hall of Fame' },
    newbies: { num: '03', subtitle: 'novidades', eyebrow: 'Recém-listadas' },
    highlights: { num: '04', subtitle: 'destaques', eyebrow: 'Curadoria' },
  };
  const tabMeta = TAB_META[marketTab as TransferTabKey] ?? TAB_META.genesis;
  const tabsList: { id: HeroTab; label: string }[] = [
    { id: 'genesis', label: 'Genesis' },
    ...(legacyMarketEnabled ? [{ id: 'legacies' as const, label: 'Legacies' }] : []),
    { id: 'newbies' as const, label: 'Newbies' },
    { id: 'highlights' as const, label: 'Highlights' },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden pb-20 md:pb-24">
      <BackButton to="/mercado" label="Mercado" />
      {/* ── PROPOSTAS P2P (negociação entre managers) ── */}
      <MarketOffersPanel />
      {/* ── HERO EDITORIAL — diagonal split + watermark cinematográfico ── */}
      <section
        aria-label="Mercado de transferências"
        className="relative w-full overflow-hidden bg-neon-yellow"
      >
        {/* Watermark gigante do número da aba — preto sobre amarelo, opacity baixa
            (assinatura /legend: tipografia como ornamento, não bloco visual). */}
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
          aria-hidden
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={tabMeta.num}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.4 }}
              className="font-display font-black tabular-nums whitespace-nowrap text-black/[0.05]"
              style={{
                fontSize: 'clamp(180px, 32vw, 460px)',
                lineHeight: '0.85',
                letterSpacing: '-0.05em',
              }}
            >
              {tabMeta.num}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Composição editorial centrada vertical — leveza /legend */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-14 text-center"
        >
          {/* Eyebrow */}
          <div
            className="ole-eyebrow !text-black mb-5 sm:mb-6"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            <span className="!text-black">{tabMeta.eyebrow}</span>
          </div>

          {/* Headline duo: MERCADO + italic dinâmico */}
          <h1 className="leading-[0.9]">
            <span
              className="block font-bold uppercase text-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.75rem, 8vw, 6rem)',
                letterSpacing: '0.005em',
              }}
            >
              Mercado
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={tabMeta.subtitle}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                className="block italic text-black"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(2.25rem, 7vw, 5rem)',
                  marginTop: '0.04em',
                  letterSpacing: '-0.01em',
                }}
              >
                {tabMeta.subtitle}
              </motion.span>
            </AnimatePresence>
          </h1>

          {/* Régua decorativa (assinatura /legend) */}
          <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />

          {/* Quote italic — CENTERPIECE editorial (antes ficava escondido no lado dark) */}
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={`q-${marketTab}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="ole-headline-italic mt-7 sm:mt-9 text-black/85 mx-auto max-w-xl leading-snug"
              style={{ fontSize: 'clamp(15px, 2vw, 19px)' }}
            >
              {marketTab === 'genesis' && '“coleção fundadora — supply finito.”'}
              {marketTab === 'legacies' && '“DNA de quem entrou pra história.”'}
              {marketTab === 'newbies' && '“acabaram de chegar à arena.”'}
              {marketTab === 'highlights' && '“o time elegeu — só os tops.”'}
            </motion.blockquote>
          </AnimatePresence>

          {/* Subtítulo — dados vivos */}
          <p
            className="mt-3 text-black/60 mx-auto max-w-md"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(0.85rem, 1vw, 0.95rem)',
              lineHeight: 1.55,
            }}
          >
            {auctionPool.length} cartas disponíveis · saldo {formatExp(oleBal)} EXP
          </p>

          {/* CTAs — centrados, primário preto sobre amarelo (consistente com /legend) */}
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowSearch((v) => !v)}
              className="inline-flex items-center gap-2 bg-black px-7 py-3 text-neon-yellow font-bold uppercase tracking-[0.2em] text-[12px] hover:bg-deep-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
              style={{
                fontFamily: 'var(--font-display)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Search className="w-4 h-4" />
              Buscar carta
            </button>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-2 border border-black/70 bg-transparent px-7 py-3 text-black font-bold uppercase tracking-[0.2em] text-[12px] hover:bg-black/10 transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Filter className="w-4 h-4" />
              Filtrar
            </button>
          </div>
        </motion.div>
      </section>

      {/* Painéis Buscar/Filtros — abrem logo abaixo do hero pra dar feedback ao clique */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className="flex flex-col gap-3 border border-[var(--color-border)] bg-dark-gray p-4"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
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
                    placeholder="Nome no cartão (ex.: Silva)…"
                    value={filters.name}
                    onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setShowSearch(false);
                    }}
                    className="w-full border border-[var(--color-border)] bg-black/55 py-2.5 pl-10 pr-10 text-white placeholder:text-white/35 outline-none focus:border-neon-yellow transition-colors"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '14px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    autoComplete="off"
                  />
                  {filters.name.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => setFilters({ ...filters, name: '' })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
                      aria-label="Limpar busca"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p
                  className="min-w-0 max-w-full text-white/45 [overflow-wrap:anywhere] break-words sm:max-w-[220px] sm:shrink-0 sm:pt-2"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    lineHeight: 1.5,
                  }}
                >
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

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className="grid grid-cols-1 gap-4 border border-[var(--color-border)] bg-dark-gray p-4 sm:p-6 sm:grid-cols-2 lg:grid-cols-4"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              {([
                { key: 'pos', label: 'Posição', value: filters.pos, options: ['', ...POSITIONS], render: (v: string) => (v === '' ? 'Todas' : v) },
                { key: 'nat', label: 'Nacionalidade', value: filters.nat, options: ['', ...NATIONS], render: (v: string) => (v === '' ? 'Todas' : v) },
                { key: 'currency', label: 'Compra em', value: filters.currency, options: ['', 'BRO', 'EXP'], render: (v: string) => (v === '' ? 'Todas' : v) },
              ] as const).map((f) => (
                <div key={f.key}>
                  <label
                    className="mb-2 block text-[var(--color-neon-yellow)] uppercase"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '10px',
                      letterSpacing: '0.22em',
                      fontWeight: 600,
                    }}
                  >
                    {f.label}
                  </label>
                  <select
                    className="w-full border border-[var(--color-border)] bg-black/55 px-3 py-2 text-white outline-none focus:border-neon-yellow transition-colors"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '13px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    value={f.value}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (f.key === 'currency') {
                        setFilters({ ...filters, currency: v === 'BRO' || v === 'EXP' ? v : '' });
                      } else {
                        setFilters({ ...filters, [f.key]: v });
                      }
                    }}
                  >
                    {f.options.map((o) => (
                      <option key={o || 'all'} value={o}>{f.render(o)}</option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="sm:col-span-2 lg:col-span-1">
                <label
                  className="mb-2 block text-[var(--color-neon-yellow)] uppercase"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    fontWeight: 600,
                  }}
                >
                  Nome
                </label>
                <input
                  type="search"
                  placeholder="Buscar por nome…"
                  value={filters.name}
                  onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                  className="w-full border border-[var(--color-border)] bg-black/55 px-3 py-2 text-white placeholder:text-white/35 outline-none focus:border-neon-yellow transition-colors"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  autoComplete="off"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label
                  className="mb-2 block text-[var(--color-neon-yellow)] uppercase"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    fontWeight: 600,
                  }}
                >
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
                          'border px-3 py-1.5 transition-colors',
                          active
                            ? 'border-neon-yellow bg-neon-yellow text-black'
                            : 'border-[var(--color-border)] bg-deep-black text-white/65 hover:border-neon-yellow/50 hover:text-white',
                        )}
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          borderRadius: 'var(--radius-sm)',
                        }}
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

      {/* Sprint B-4: ordem padronizada com /loja — DESTAQUES vem antes do SLIDER */}
      {/* ── DESTAQUES DA SEMANA ─────────────────────────────────────── */}
      {highlightsOrdered.length > 0 ? (
        <section className="min-w-0 space-y-3">
          <div className="flex min-w-0 items-center gap-3 px-0.5">
            <span
              aria-hidden
              className="shrink-0 w-[3px] h-7 bg-neon-yellow shadow-[0_0_10px_rgba(253,225,0,0.55)]"
            />
            <div className="min-w-0 flex-1">
              <h3
                className="text-neon-yellow font-bold uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  letterSpacing: '0.18em',
                }}
              >
                Destaques da semana
              </h3>
              <p
                className="text-white/45"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.04em',
                }}
              >
                Cartas em destaque pelo overall e buzz do mercado.
              </p>
            </div>
          </div>
          <div className="relative -mx-3 sm:-mx-4 lg:-mx-8">
            <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-3 bg-gradient-to-r from-deep-black/90 to-transparent sm:w-4 lg:w-8" />
            <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-16 bg-gradient-to-l from-deep-black/95 via-deep-black/60 to-transparent sm:w-20 lg:w-24" />
            <div
              ref={highlightsScrollRef}
              className="hide-scrollbar overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] "
            >
              <div className="inline-flex flex-nowrap items-stretch gap-2.5 px-3 py-3 sm:gap-3 sm:px-4 lg:px-8">
                {highlightsOrdered.slice(0, highlightsShownLen).map((player, i) => {
                  const legacyRow = legacyHighlightMap.get(player.id);
                  return (
                  <motion.div
                    key={`hl-${player.id}`}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.02, duration: 0.18 }}
                    className="min-w-0 shrink-0 cursor-pointer w-[var(--highlight-card-px,min(200px,calc(100dvw-3rem)))]"
                    onClick={() => {
                      if (legacyRow) {
                        setPendingLegacyDetailId(legacyRow.id);
                        setMarketTab('legacies');
                      } else {
                        setSelectedPlayer(player);
                      }
                    }}
                  >
                    <PlayerCard
                      player={player}
                      listHomonym={homonymRankMapForPlayers(highlightsOrdered).get(player.id)}
                      carouselStrip
                      {...(legacyRow ? { fixedSale: legacyHighlightFixedSale(legacyRow), portraitClassName: '' } : {})}
                    />
                  </motion.div>
                  );
                })}
                <div className="flex items-stretch">
                  <TransferCarouselVerMaisTile
                    variant="neon"
                    topLabel="Destaques da semana"
                    bottomLabel={
                      highlightsShownLen < highlightsOrdered.length
                        ? `+${Math.min(DISCOVERY_CAROUSEL_STEP, highlightsOrdered.length - highlightsShownLen)} neste carril`
                        : `${highlightsShownLen}/${highlightsOrdered.length}`
                    }
                    disabled={highlightsShownLen >= highlightsOrdered.length}
                    onClick={() => {
                      if (highlightsShownLen >= highlightsOrdered.length) return;
                      setDiscoveryVisibleCount((prev) => ({
                        ...prev,
                        highlights: Math.min(
                          highlightsOrdered.length,
                          (prev.highlights ?? DISCOVERY_CAROUSEL_INITIAL) + DISCOVERY_CAROUSEL_STEP,
                        ),
                      }));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Slider promocional removido (poluía a tela). */}

      {/* ── TAB BAR scoreboard-tape ───────────────── */}
      <div className="flex items-stretch gap-0 border-b border-white/10 overflow-x-auto hide-scrollbar">
        {tabsList.map((t) => {
          const active = marketTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setMarketTab(t.id)}
              className={cn(
                'relative inline-flex items-center gap-2 px-4 sm:px-6 py-3 font-bold uppercase whitespace-nowrap transition-colors',
                active
                  ? 'text-neon-yellow'
                  : 'text-white/45 hover:text-white/85',
              )}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                letterSpacing: '0.18em',
              }}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-neon-yellow"
                />
              )}
              <span className={active ? 'pl-2' : ''}>{t.label}</span>
              {active && (
                <motion.span
                  layoutId="tab-underline"
                  aria-hidden
                  className="absolute left-0 right-0 -bottom-px h-[2px] bg-neon-yellow"
                />
              )}
            </button>
          );
        })}
      </div>

      {legacyMarketEnabled && marketTab === 'legacies' ? (
        <TransferLegaciesTab
          openDetailId={pendingLegacyDetailId}
          onDetailConsumed={() => setPendingLegacyDetailId(null)}
        />
      ) : null}
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
            className="flex items-center justify-between gap-3 border border-l-[3px] border-[var(--color-border)] border-l-[var(--color-success)] bg-dark-gray px-4 py-3.5 sm:px-5"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <CheckCircle2 className="h-7 w-7 shrink-0 text-[var(--color-success)]" aria-hidden />
              <div className="min-w-0">
                <p
                  className="text-[var(--color-success)] uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                  }}
                >
                  Compra concluída
                </p>
                <p
                  className="mt-0.5 text-white/55"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    lineHeight: 1.5,
                  }}
                >
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
              className="shrink-0 grid h-8 w-8 place-items-center text-white/45 transition-colors hover:bg-white/10 hover:text-white"
              style={{ borderRadius: 'var(--radius-sm)' }}
              aria-label="Fechar aviso de compra"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GENESIS EM FOCO ─ headline + view toggle (padrão /loja) ── */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-0.5 pb-3 sm:pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span aria-hidden className="shrink-0 w-[3px] h-7 bg-neon-yellow shadow-[0_0_10px_rgba(253,225,0,0.55)]" />
            <h3
              className="text-neon-yellow font-bold uppercase"
              style={{ fontFamily: 'var(--font-display)', fontSize: '14px', letterSpacing: '0.18em' }}
            >
              Genesis em foco
            </h3>
          </div>
          <p
            className="mt-1 ml-[14px] text-white/45"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', lineHeight: 1.5 }}
          >
            {gridPlayers.length} {gridPlayers.length === 1 ? 'carta disponível' : 'cartas disponíveis'}
            {isFiltered ? ' (filtros aplicados)' : ''}
          </p>
        </div>
        {/* View toggle Grid / List — Sprint B-4 */}
        <div className="flex items-center gap-1 rounded-[var(--radius-pill)] border border-white/10 bg-white/[0.03] p-1">
          {(['grid', 'list'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setGenesisViewMode(m)}
              className={cn(
                'inline-flex items-center rounded-[var(--radius-pill)] px-4 py-1.5 font-display text-[10px] font-black uppercase tracking-[0.22em] transition-all',
                genesisViewMode === m
                  ? 'bg-neon-yellow text-black shadow-[0_2px_10px_rgba(253,225,0,0.25)]'
                  : 'text-white/55 hover:text-white',
              )}
              aria-pressed={genesisViewMode === m}
              aria-label={`Visualização em ${m === 'grid' ? 'grade' : 'lista horizontal'}`}
            >
              {m === 'grid' ? 'Grid' : 'List'}
            </button>
          ))}
        </div>
      </div>

      {/* Body do catálogo — switch por viewMode (filtros sempre aplicam) */}
      {genesisViewMode === 'grid' ? (
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
            <div className="col-span-full py-16 text-center">
              <p
                className="italic text-white/55 mx-auto max-w-md"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(18px, 2.4vw, 24px)',
                  lineHeight: 1.4,
                }}
              >
                “nenhuma carta atende esses filtros.”
              </p>
              <p
                className="mt-3 text-white/35 uppercase"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                }}
              >
                Tenta ajustar a busca acima
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {/* List view: cards horizontais um abaixo do outro (Sprint B-4) */}
          {gridPlayers.length === 0 && (
            <div className="py-16 text-center">
              <p
                className="italic text-white/55 mx-auto max-w-md"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(18px, 2.4vw, 24px)',
                  lineHeight: 1.4,
                }}
              >
                “nenhuma carta atende esses filtros.”
              </p>
            </div>
          )}
          {gridPlayers.map((player, i) => (
            <TransferRowCard
              key={player.id}
              player={player}
              listHomonym={homonymRankById.get(player.id)}
              onSelect={() => setSelectedPlayer(player)}
              delay={i * 0.04}
            />
          ))}

          {/* Sessão do mercado removida — era apenas um ranking por OVR, sem
              valor informativo novo depois do hero + featured boxes + rails.
              Mantemos o CTA do Exchange, que é decisão real do manager. */}
          <section id="transfer-exchange-cta" className="min-w-0 scroll-mt-4 border-t border-[var(--color-border)] pt-10">
            <div className="flex flex-col items-center gap-3 px-0.5 text-center">
              <span
                className="text-white/45 uppercase"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                }}
              >
                Câmbio do mercado
              </span>
              <h3
                className="italic text-white"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(22px, 3vw, 32px)',
                  lineHeight: 1.15,
                }}
              >
                troque <span className="text-neon-yellow">EXP</span> por <span className="text-neon-yellow">BRO</span> a qualquer hora.
              </h3>
              <Link
                to="/transfer/exchange"
                className="mt-2 inline-flex items-center gap-2 bg-neon-yellow px-7 py-3 text-black hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                }}
              >
                Abrir Exchange
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          {managerAuctionCards.length > 0 ? (
            <section className="min-w-0 space-y-3">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden className="w-[3px] h-7 bg-neon-yellow shrink-0" />
                  <div className="min-w-0">
                    <h3
                      className="text-neon-yellow font-bold uppercase"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '14px',
                        letterSpacing: '0.18em',
                      }}
                    >
                      Jogadores anunciados
                    </h3>
                    <p
                      className="text-white/45"
                      style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}
                    >
                      Os teus cards à venda. Clica pra gerir preço ou retirar do mercado.
                    </p>
                  </div>
                </div>
                <Link
                  to="/team"
                  className="shrink-0 inline-flex items-center gap-1.5 border border-[var(--color-border)] bg-deep-black px-3.5 py-1.5 text-white/80 transition-colors hover:border-neon-yellow/60 hover:text-neon-yellow"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Anunciar mais
                  <ChevronRight className="h-3 w-3" />
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
                          
                          {selectedPlayer.marketKind === 'manager_other' &&
                          selectedPlayer.managerListingId ? (
                            <div className="space-y-3">
                              <p className="text-[10px] text-gray-400">
                                Saldo EXP:{' '}
                                <span className="font-display font-bold text-white">{formatExp(oleBal)}</span>
                              </p>
                              {(() => {
                                const pending = marketOffers.pendingForListing(selectedPlayer.managerListingId!);
                                return pending ? (
                                  <p className="text-[11px] text-neon-yellow/80">
                                    {pending.status === 'countered' && pending.counterExp != null
                                      ? `Contraproposta do vendedor: ${formatExp(pending.counterExp)}.`
                                      : `Proposta enviada: ${formatExp(pending.offerExp)} (pendente).`}
                                  </p>
                                ) : null;
                              })()}
                              {purchaseError && (
                                <p className="text-xs text-red-400 font-medium">{purchaseError}</p>
                              )}
                              <button
                                type="button"
                                onClick={handleAcademiaMarketAction}
                                disabled={isPurchasing || oleBal < selectedPlayer.buyNow}
                                className={cn(
                                  'btn-primary min-h-12 w-full bg-neon-green px-3 py-3 text-black hover:bg-white sm:py-4',
                                  (isPurchasing || oleBal < selectedPlayer.buyNow) && 'pointer-events-none opacity-40',
                                )}
                              >
                                <span className="skew-x-6 block text-center text-sm font-black uppercase sm:text-base">
                                  {isPurchasing
                                    ? 'A processar…'
                                    : `Comprar agora · ${formatAuctionDisplay(
                                        selectedPlayer.auctionCurrency,
                                        selectedPlayer.buyNow,
                                      )}`}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setOfferModalListingId(selectedPlayer.managerListingId!)}
                                className="min-h-12 w-full rounded-lg border-2 border-neon-yellow/60 bg-neon-yellow/10 px-3 py-3 font-display text-sm font-black uppercase tracking-wide text-neon-yellow transition-colors hover:bg-neon-yellow/20 sm:py-4"
                              >
                                {marketOffers.pendingForListing(selectedPlayer.managerListingId)
                                  ? 'Atualizar proposta'
                                  : 'Fazer proposta'}
                              </button>
                            </div>
                          ) : selectedPlayer.marketKind === 'manager_own' ||
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
                              {purchaseError && (
                                <p className="text-xs text-red-400 font-medium">{purchaseError}</p>
                              )}
                              <button
                                type="button"
                                onClick={handleAcademiaMarketAction}
                                disabled={
                                  isPurchasing ||
                                  (selectedPlayer.marketKind === 'genesis' &&
                                    (oleBal < selectedPlayer.buyNow ||
                                      (!!selectedPlayer.genesisCatalogId &&
                                        genesisListedEntities[selectedPlayer.genesisCatalogId] == null)))
                                }
                                className={cn(
                                  'btn-primary min-h-12 w-full bg-neon-green px-3 py-3 text-black hover:bg-white sm:py-4',
                                  (isPurchasing ||
                                    (selectedPlayer.marketKind === 'genesis' &&
                                      (oleBal < selectedPlayer.buyNow ||
                                        (!!selectedPlayer.genesisCatalogId &&
                                          genesisListedEntities[selectedPlayer.genesisCatalogId] == null)))) &&
                                    'pointer-events-none opacity-40',
                                )}
                              >
                                <span className="skew-x-6 block text-center text-sm font-black uppercase sm:text-base">
                                  {isPurchasing
                                    ? 'A processar…'
                                    : selectedPlayer.marketKind === 'manager_own'
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

      {/* Modal de PROPOSTA (negociação P2P) por listagem de outro manager */}
      {(() => {
        if (!offerModalListingId) return null;
        const listing = otherManagerListings.find((l) => l.listingId === offerModalListingId);
        if (!listing) return null;
        return (
          <MakeOfferModal
            open
            onClose={() => setOfferModalListingId(null)}
            playerName={listing.player.name}
            playerOverall={overallFromAttributes(listing.player.attrs, listing.player.pos)}
            listPriceExp={listing.priceExp}
            balanceExp={oleBal}
            existingOffer={marketOffers.pendingForListing(offerModalListingId)}
            onSubmit={(offerExp) => marketOffers.propose(offerModalListingId, offerExp)}
          />
        );
      })()}
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
  // Atributos sempre em amarelo (Genesis e Legacy unificados — sem cor por faixa).
  const color = 'bg-neon-yellow';
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

export function PlayerCard({
  player,
  isModal = false,
  listHomonym,
  /** Carril horizontal: hover mais leve para não ser cortado por `overflow-x-auto`. */
  carouselStrip = false,
  /** Venda de preço fixo (ex.: Legacy PIX/OLE): troca o rodapé de leilão por
   *  preço + CTA, esconde "Encerra em" e troca o selo de moeda. */
  fixedSale,
  /** Override do estilo/classe da foto (ex.: enquadramento do Legacy, em cor). */
  portraitStyle,
  portraitClassName,
}: {
  player: MockAuctionPlayer;
  isModal?: boolean;
  /** Só na grelha: quando há mais de um anúncio com o mesmo nome no resultado atual. */
  listHomonym?: { index: number; total: number };
  carouselStrip?: boolean;
  fixedSale?: { price: string; cta: string; badge: string };
  portraitStyle?: import('react').CSSProperties;
  portraitClassName?: string;
}) {
  const currencyLabel = fixedSale
    ? fixedSale.badge
    : player.auctionCurrency === 'EXP'
      ? 'Lances em EXP'
      : 'Lances em BRO';
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
            "italic text-3xl leading-none",
            player.style === 'neon-yellow' ? 'text-neon-yellow' : 'text-white'
          )}
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontWeight: 700,
          }}>
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
            className={cn('w-full h-full object-cover object-top transition-all duration-500 drop-shadow-2xl', portraitClassName ?? 'grayscale group-hover:grayscale-0')}
            referrerPolicy="no-referrer"
            style={portraitStyle ?? { maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)' }}
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

          {/* Mini Stats — Sprint B-3: MORET serif italic, peso editorial */}
          <div className="grid grid-cols-3 gap-1">
            <div className="text-center">
              <div className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">PAC</div>
              <div
                className="mt-0.5 italic tabular-nums leading-none text-neon-yellow"
                style={{ fontFamily: 'var(--font-serif-hero)', fontSize: '17px', fontWeight: 700 }}
              >
                {player.pac}
              </div>
            </div>
            <div className="text-center border-x border-white/10">
              <div className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">SHO</div>
              <div
                className="mt-0.5 italic tabular-nums leading-none text-neon-yellow"
                style={{ fontFamily: 'var(--font-serif-hero)', fontSize: '17px', fontWeight: 700 }}
              >
                {player.sho}
              </div>
            </div>
            <div className="text-center">
              <div className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">PAS</div>
              <div
                className="mt-0.5 italic tabular-nums leading-none text-neon-yellow"
                style={{ fontFamily: 'var(--font-serif-hero)', fontSize: '17px', fontWeight: 700 }}
              >
                {player.pas}
              </div>
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
              {/* Tempo restante — só leilão (venda fixa esconde) */}
              {!fixedSale && (
                <span className="flex shrink-0 items-center justify-center gap-1 font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/55 sm:justify-start sm:text-[10px]">
                  Encerra em <span className="text-white/85">{player.timeLeft}</span>
                </span>
              )}
              {/* Preço — MORET serif italic, peso editorial */}
              <span
                className={cn(
                  'min-w-0 max-w-full break-words text-center italic tabular-nums leading-tight text-neon-green [overflow-wrap:anywhere] sm:text-right',
                  carouselStrip ? 'w-full truncate' : fixedSale ? 'w-full text-center' : 'sm:max-w-[58%]',
                )}
                style={{ fontFamily: 'var(--font-serif-hero)', fontSize: 'clamp(16px, 3vw, 22px)', fontWeight: 700 }}
                title={fixedSale ? fixedSale.price : formatAuctionDisplay(player.auctionCurrency, player.currentBid, 'card')}
              >
                {fixedSale ? fixedSale.price : formatAuctionDisplay(player.auctionCurrency, player.currentBid, 'card')}
              </span>
            </div>
            <button
              type="button"
              className="flex w-full min-h-11 max-w-full items-center justify-center bg-neon-yellow px-3 py-2.5 font-display text-[12px] font-black uppercase leading-tight tracking-[0.22em] text-black shadow-[0_4px_14px_rgba(253,225,0,0.18)] transition-all hover:bg-white hover:scale-[1.02] active:scale-[0.98] [-webkit-tap-highlight-color:transparent] sm:py-3 sm:text-[13px]"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              {fixedSale ? fixedSale.cta : 'Dar Lance'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * TransferRowCard — Sprint B-4: card horizontal pra visualização "List".
 * Foto à esquerda + info-claro à direita + ação dominante.
 * Pattern espelha o JOGADORES DISPONÍVEIS de Team.tsx.
 */
export function TransferRowCard({
  player,
  listHomonym,
  onSelect,
  delay = 0,
  fixedSale,
  portraitStyle,
  portraitClassName,
}: {
  key?: import("react").Key;
  player: MockAuctionPlayer;
  listHomonym?: { index: number; total: number };
  onSelect: () => void;
  delay?: number;
  fixedSale?: { price: string; cta: string; badge: string };
  portraitStyle?: import('react').CSSProperties;
  portraitClassName?: string;
}) {
  const isGold = player.category === 'gold';
  const isNeon = player.style === 'neon-yellow';
  const railColor = isGold || isNeon ? 'border-l-neon-yellow' : 'border-l-white/15';
  const stats = [
    { label: 'PAC', val: player.pac },
    { label: 'SHO', val: player.sho },
    { label: 'PAS', val: player.pas },
  ];
  const flag = natFlagDisplay(player.nat);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay, duration: 0.22 }}
      className={cn(
        'group flex w-full overflow-hidden border border-l-[3px] border-[var(--color-border)] bg-dark-gray transition-all duration-200 hover:border-neon-yellow/40 hover:-translate-y-0.5',
        railColor,
      )}
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      {/* Foto + OVR overlay */}
      <button
        type="button"
        onClick={onSelect}
        className="relative w-28 sm:w-36 md:w-44 flex-shrink-0 overflow-hidden bg-black border-r border-white/8 cursor-pointer [-webkit-tap-highlight-color:transparent]"
        aria-label={`Ver ${player.name}`}
      >
        <div
          className={cn(
            'absolute inset-0',
            isNeon ? 'bg-neon-yellow/10' : 'bg-white/5',
          )}
          aria-hidden
        />
        <img
          src={player.portraitSrc?.trim() || `https://picsum.photos/seed/transfer-${player.id}/300/400`}
          alt={player.name}
          className={cn('absolute inset-0 h-full w-full object-cover object-top transition-all duration-300', portraitClassName ?? 'grayscale group-hover:grayscale-0')}
          style={portraitStyle}
          referrerPolicy="no-referrer"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/65 via-black/15 to-transparent"
        />
        {/* OVR — Moret italic gigante editorial */}
        <div className="absolute top-2 left-2 md:top-3 md:left-3 z-10">
          <p
            className="italic text-neon-yellow tabular-nums leading-none drop-shadow-[0_3px_10px_rgba(0,0,0,0.95)]"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 700,
              fontSize: 'clamp(36px, 5.5vw, 56px)',
              letterSpacing: '-0.04em',
            }}
          >
            {player.ovr}
          </p>
          <p className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-[0.18em] text-white/85 drop-shadow-md">
            {player.pos}
          </p>
        </div>
        {isGold ? (
          <span
            className="absolute bottom-2 left-2 z-10 inline-flex items-center bg-neon-yellow text-black px-2 py-0.5 font-display text-[9px] font-black uppercase tracking-[0.2em] shadow-[0_0_14px_rgba(234,255,0,0.5)]"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            Ouro
          </span>
        ) : null}
      </button>

      {/* Info — header + stats + footer */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-3 py-3 md:px-4 md:py-3.5">
        {/* Header: nome + nação + raridade */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <button
            type="button"
            onClick={onSelect}
            className="min-w-0 flex-1 text-left cursor-pointer [-webkit-tap-highlight-color:transparent]"
          >
            <p
              className="text-white uppercase truncate"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(16px, 2.2vw, 22px)',
                letterSpacing: '0.03em',
                lineHeight: 1.05,
              }}
            >
              {player.name}
            </p>
            <p
              className="text-white/50 uppercase mt-0.5 truncate"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                fontWeight: 600,
              }}
            >
              {flag ? <span className="mr-1.5 not-italic" aria-hidden>{flag}</span> : null}
              {player.nat?.trim() && player.nat !== '—' ? player.nat : 'Sem nação'}
              {listHomonym && listHomonym.total > 1 ? (
                <span className="ml-2 text-neon-yellow/85">
                  · {listHomonym.index}/{listHomonym.total}
                </span>
              ) : null}
            </p>
          </button>
          <span
            className={cn(
              'shrink-0 inline-flex items-center border px-2 py-0.5 font-display text-[9px] font-black uppercase tracking-[0.18em]',
              fixedSale || player.auctionCurrency === 'EXP'
                ? 'border-neon-yellow/60 bg-black/70 text-neon-yellow'
                : 'border-white/40 bg-black/70 text-white',
            )}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            {fixedSale ? fixedSale.badge : player.auctionCurrency}
          </span>
        </div>

        {/* Mini-stats — MORET serif italic editorial */}
        <div className="grid grid-cols-3 gap-3 md:gap-5">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="text-white/55 uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.22em',
                  }}
                >
                  {s.label}
                </span>
                <span
                  className="italic text-neon-yellow tabular-nums leading-none"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontWeight: 700,
                    fontSize: 'clamp(16px, 1.8vw, 20px)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {s.val}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer: (encerra em) + preço + CTA */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-divider-yellow)] pt-3">
          <div className="flex min-w-0 flex-col">
            {!fixedSale && (
              <span className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/50">
                Encerra em <span className="text-white/85">{player.timeLeft}</span>
              </span>
            )}
            <span
              className="italic tabular-nums leading-tight text-neon-green"
              style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: 'clamp(18px, 2.4vw, 24px)' }}
            >
              {fixedSale ? fixedSale.price : formatAuctionDisplay(player.auctionCurrency, player.currentBid, 'card')}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="inline-flex items-center bg-neon-yellow px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-black shadow-[0_4px_14px_rgba(253,225,0,0.18)] transition-all hover:bg-white hover:scale-[1.02] active:scale-[0.98]"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            {fixedSale ? fixedSale.cta : 'Dar Lance'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
