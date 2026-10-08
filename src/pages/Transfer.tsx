import type { RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Gavel,
  Clock,
  X,
  TrendingUp,
  Trophy,
  UserCircle,
  CheckCircle2,
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
import { MARKET_POSITIONS, MARKET_SORTS, rotuloPosicao, type SortKey } from '@/transfer/marketFilters';
import { L, LOCALE } from '@/i18n/L';
import { moedaDoJogo } from '@/wallet/constants';
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
import { DEGRAU_CLASSES, FitaRua, MarcaRua, SecaoRua, type Degrau } from '@/components/ui/Rua';
import {
  ACAO_CONTORNO,
  ACAO_RUA,
  AtributoRua,
  CAMPO_RUA,
  DEGRAU_INFO,
  FECHAR_RUA,
  TORTO,
  VazioRua,
  ctaCartaClasses,
  degrauDe,
  faixaClasses,
  fotoFundo,
  ovrClasses,
} from '@/components/market/rua/escada';
import { recordMarketActivity } from '@/supabase/marketActivities';

const BIO_MAX_LEN = 250;

/** Cartões: bandeira a partir do código ISO; sem mapeamento → vazio (call sites caem no '—'). */
function natFlagDisplay(nat: string): string {
  const f = countryCodeToFlagEmoji(nat);
  if (f) return f;
  return '';
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
    marketKind === 'manager_own' ? 'OLE FC' : marketKind === 'manager_other' ? L('Academia OLE', 'OLE Academy') : L('Rede OLE', 'OLE Network');
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
          ? L('Prospect da sua Academia OLE.', 'Prospect from your OLE Academy.')
          : L('Jogador do seu plantel no mercado EXP.', 'Player from your squad on the EXP market.')
        : marketKind === 'manager_other'
        ? L('Prospect de outro manager — Academia OLE.', "Another manager's prospect — OLE Academy.")
        : L('Prospect da rede de managers OLE.', 'Prospect from the OLE manager network.')),
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
  return `${nation} · ${rotuloPosicao(p.pos)} · ${p.ovr} · ${club}`;
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

// Ordem do campo (gol → ataque): é assim que o manager lê uma escalação.
const POSITIONS = MARKET_POSITIONS;

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
  return `${bro.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BRO`;
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

/** Célula final dos carrosseis: degrau CHÃO (tracejado), ação "Ver mais →". */
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
      aria-label={bottomLabel ? L(`Ver mais — ${bottomLabel}`, `See more — ${bottomLabel}`) : L('Ver mais', 'See more')}
      className={cn(
        'flex w-[6.5rem] max-w-none shrink-0 flex-col items-center justify-center gap-2 border-2 border-dashed px-2 py-6 text-center transition-colors disabled:pointer-events-none disabled:opacity-40',
        variant === 'neon' ? 'border-fio text-rua hover:border-rua' : 'border-linha text-mudo hover:border-fio',
      )}
    >
      {topLabel ? (
        <span className="font-prova text-[9px] font-bold uppercase leading-tight tracking-[0.14em] text-mudo">{topLabel}</span>
      ) : null}
      <span className="font-impact text-[18px] uppercase leading-none">
        {L('Ver mais', 'See more')} <span aria-hidden>→</span>
      </span>
      {bottomLabel ? (
        <span className="font-prova text-[10px] leading-tight text-mudo">{bottomLabel}</span>
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
        { imageUrl: '/transfer-heroes/genesis-01.webp', title: L('Drops Genesis', 'Genesis Drops'), subtitle: L('Cartas fundadoras limitadas. A primeira geração do universo OLEFOOT.', 'Limited founder cards. The first generation of the OLEFOOT universe.'), tag: L('Coleção original', 'Original collection'), ctaLabel: L('Ver drops', 'See drops') },
        { imageUrl: '/transfer-heroes/genesis-02.webp', title: L('Hall dos 90+', '90+ Hall'), subtitle: L('Os overalls mais altos da temporada em disputa por lance.', 'The highest overalls of the season, up for bids.'), tag: 'Elite', ctaLabel: L('Lance agora', 'Bid now') },
        { imageUrl: '/transfer-heroes/genesis-03.webp', title: L('Craques em moeda BRO', 'Stars in BRO'), subtitle: L('Pague em BRO e leva pra plantel imediatamente.', 'Pay in BRO and add them to your squad instantly.'), tag: 'BRO only', ctaLabel: L('Explorar', 'Explore') },
      ];
    case 'legacies':
      return [
        { imageUrl: '/transfer-heroes/legacies-01.webp', title: L('Lendas com DNA', 'Legends with DNA'), subtitle: L('Cartas Legacy carregam linhagem — cada geração herda parte da história.', 'Legacy cards carry a lineage — each generation inherits part of the story.'), tag: L('DNA evolutivo', 'Evolving DNA'), ctaLabel: L('Ver linhagens', 'See lineages') },
        { imageUrl: '/transfer-heroes/legacies-02.webp', title: L('Descendentes em alta', 'Rising descendants'), subtitle: L('Filhos de lendas começando a brilhar — aposta pra valorização.', 'Sons of legends starting to shine — a bet on growth.'), tag: L('Promessa', 'Prospect'), ctaLabel: L('Descobrir', 'Discover') },
      ];
    case 'newbies':
      return [
        { imageUrl: '/transfer-heroes/newbies-01.webp', title: L('Novos no mercado', 'New on the market'), subtitle: L('Cartas recém-listadas — aproveite antes da concorrência chegar.', 'Freshly listed cards — grab them before the competition does.'), tag: L('Fresco', 'Fresh'), ctaLabel: L('Ver tudo', 'See all') },
        { imageUrl: '/transfer-heroes/newbies-02.webp', title: L('Prospectos da Academia', 'Academy prospects'), subtitle: L('Talentos formados por outros managers — aprenda a fazer olho clínico.', 'Talent developed by other managers — train your scouting eye.'), tag: L('Academia', 'Academy'), ctaLabel: L('Garimpar', 'Scout') },
      ];
    case 'highlights':
      return [
        { imageUrl: '/transfer-heroes/highlights-01.webp', title: L('Destaques da semana', 'Weekly highlights'), subtitle: L('Curadoria do time — cartas com buzz no mercado e overall de topo.', 'Team picks — cards with market buzz and top overall.'), tag: L('Curadoria', 'Curated'), ctaLabel: L('Ver destaques', 'See highlights') },
        { imageUrl: '/transfer-heroes/highlights-02.webp', title: L('Leilões quentes', 'Hot auctions'), subtitle: L('Terminam em horas. Último lance define dono.', 'Ending in hours. Last bid wins.'), tag: L('Encerra hoje', 'Ends today'), ctaLabel: L('Entrar no leilão', 'Join auction') },
        { imageUrl: '/transfer-heroes/highlights-03.webp', title: L('Títulos memoráveis', 'Memorable titles'), subtitle: L('Cartas com troféus raros equipados — valor narrativo + desempenho.', 'Cards with rare trophies equipped — story value + performance.'), tag: L('Memorável', 'Memorable'), ctaLabel: L('Explorar', 'Explore') },
      ];
  }
}

function featuredBoxesConfigForTab(tab: HeroTab): { title: string; subtitle: string; variant: 'premium' | 'rising' | 'drop' } {
  switch (tab) {
    case 'genesis':   return { title: L('Genesis em foco', 'Genesis spotlight'), subtitle: L('Seleção curada das cartas fundadoras em destaque.', 'Curated selection of featured founder cards.'), variant: 'premium' };
    case 'legacies':  return { title: L('Legacies em foco', 'Legacies spotlight'), subtitle: L('Linhagens com DNA forte e histórico valioso.', 'Lineages with strong DNA and a valuable history.'), variant: 'premium' };
    case 'newbies':   return { title: L('Chegaram ao mercado', 'Just listed'), subtitle: L('Cartas recém-listadas — movimento ainda a formar.', 'Freshly listed cards — activity still building.'), variant: 'rising' };
    case 'highlights':return { title: L('Drops em alta', 'Trending drops'), subtitle: L('Valor de compra imediata no topo da temporada.', "The season's highest buy-now prices."), variant: 'drop' };
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
  /** Nome + posição + ordem. Nacionalidade e moeda saíram junto com o painel
      sanfonado: eram dois selects que ninguém abria (o painel vinha fechado) e
      a base não tem nacionalidade variada o bastante pra justificar o filtro. */
  const [filters, setFilters] = useState<{ pos: string; name: string; sort: SortKey }>({
    pos: '',
    name: '',
    sort: 'relevance',
  });
  const filtroAtivo = Boolean(filters.pos || filters.name.trim() || filters.sort !== 'relevance');
  const limparFiltros = () => setFilters({ pos: '', name: '', sort: 'relevance' });

  const nameQueryNorm = filters.name.trim().toLowerCase();

  const filteredPlayers = useMemo(
    () =>
      auctionPool.filter((p) => {
        if (filters.pos && p.pos !== filters.pos) return false;
        if (nameQueryNorm && !p.name.toLowerCase().includes(nameQueryNorm)) return false;
        return true;
      }),
    [auctionPool, filters.pos, nameQueryNorm],
  );

  /** Ordenação escolhida pelo manager. A busca por nome FILTRA, não reordena:
      antes ela forçava A–Z por baixo do pano e o botão "mais baratos" parava de
      valer assim que se digitava uma letra. Quem quer A–Z clica em A–Z. */
  const gridPlayers = useMemo(() => {
    const list = [...filteredPlayers];
    switch (filters.sort) {
      case 'name_asc':
        list.sort((a, b) => {
          const byName = a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' });
          if (byName !== 0) return byName;
          if (b.ovr !== a.ovr) return b.ovr - a.ovr;
          return a.id - b.id;
        });
        break;
      case 'value_desc':
        list.sort((a, b) => b.buyNow - a.buyNow);
        break;
      case 'price_asc':
        list.sort((a, b) => a.buyNow - b.buyNow);
        break;
      case 'new':
        list.sort((a, b) => b.id - a.id);
        break;
      case 'relevance':
      default:
        list.sort((a, b) => b.ovr - a.ovr);
        break;
    }
    return list;
  }, [filteredPlayers, filters.sort]);

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
  const isFiltered = filtroAtivo;

  useEffect(() => {
    setDiscoveryVisibleCount(initialDiscoveryVisibleMap());
  }, [isFiltered]);

  const discoveryRails = useMemo(() => {
    const byOvr = [...auctionPool].sort((a, b) => b.ovr - a.ovr);
    return [
      {
        id: 'highlights' as const,
        title: L('Destaques da semana', 'Weekly highlights'),
        hint: L('Cartas em destaque pelo overall e buzz do mercado.', 'Cards featured for overall and market buzz.'),
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
    const oleTxt = `${Math.max(1, Math.round(row.price_bro_cents)).toLocaleString(LOCALE)} ${moedaDoJogo()}`;
    const price = brl != null
      ? `R$ ${(brl / 100).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : oleTxt;
    const isOwned = !!playersById[legacyRowToPlayerEntity(row).id];
    return { price, cta: isOwned ? L('Adquirido', 'Owned') : L('Comprar', 'Buy'), badge: brl != null ? 'PIX' : moedaDoJogo() };
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
        setPurchaseError(L('Saldo EXP insuficiente para esta compra.', 'Not enough EXP for this purchase.'));
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
            setPurchaseError(L('Falha de rede. Verifique sua conexão e tente novamente.', 'Network error. Check your connection and try again.'));
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
              setPurchaseError(L('Este jogador já está no seu plantel.', 'This player is already in your squad.'));
              setIsPurchasing(false);
              return;
            }

            const msg = serverRes?.error === 'Jogador não está à venda.'
              ? L('Este jogador já não está disponível.', 'This player is no longer available.')
              : serverRes?.error === 'Unauthorized'
              ? L('Sessão expirada. Faz login novamente.', 'Session expired. Please log in again.')
              : (serverRes?.error ?? L('Não foi possível concluir a compra. Tenta novamente.', "Couldn't complete the purchase. Try again."));
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
        setPurchaseError(L('Listagem não encontrada — recarregue a página.', 'Listing not found — reload the page.'));
        return;
      }
      if (oleBal < listing.priceExp) {
        setPurchaseError(L('Saldo EXP insuficiente para esta compra.', 'Not enough EXP for this purchase.'));
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
          setPurchaseError(L('Compra de Academia exige sessão autenticada — faça login.', 'Academy purchases require you to be logged in — please log in.'));
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
          setPurchaseError(L('Falha de rede. Verifique sua conexão e tente novamente.', 'Network error. Check your connection and try again.'));
          return;
        }
        if (!serverRes?.ok) {
          setPurchaseError(serverRes?.error ?? L('Não foi possível concluir a compra. Tenta novamente.', "Couldn't complete the purchase. Try again."));
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
  const TAB_META: Record<TransferTabKey, { subtitle: string; eyebrow: string }> = {
    genesis: { subtitle: L('fundadores', 'founders'), eyebrow: L('Cartas Genesis', 'Genesis cards') },
    legacies: { subtitle: L('lendas', 'legends'), eyebrow: 'Hall of Fame' },
    newbies: { subtitle: L('novidades', 'new'), eyebrow: L('Recém-listadas', 'Just listed') },
    highlights: { subtitle: L('destaques', 'highlights'), eyebrow: L('Curadoria', 'Curated') },
  };
  const tabMeta = TAB_META[marketTab as TransferTabKey] ?? TAB_META.genesis;
  const tabsList: { id: HeroTab; label: string }[] = [
    { id: 'genesis', label: 'Genesis' },
    ...(legacyMarketEnabled ? [{ id: 'legacies' as const, label: 'Legacies' }] : []),
    { id: 'newbies' as const, label: 'Newbies' },
    { id: 'highlights' as const, label: 'Highlights' },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-7 overflow-x-hidden px-3 pb-20 sm:px-4 md:pb-24">
      <BackButton to="/mercado" label={L('Mercado', 'Market')} />
      {/* ── PROPOSTAS P2P (negociação entre managers) ── */}
      <MarketOffersPanel />

      {/* ── HERO · O MURO DO MERCADO (DS 2027) ───────────────────────────────
          Concreto com grão e retícula no canto; título na VOZ + GRITO; a aba
          corrente vira um lambe de cal colado torto; estoque e saldo como
          prova (o saldo é valor que já existe → fio de ouro). A busca é o
          balcão: nome, posição e ordem à mão. A fita fecha o muro. */}
      <section
        aria-label={L('Mercado de transferências', 'Transfer market')}
        className="rua-grao relative isolate w-full min-w-0 overflow-hidden bg-concreto"
      >
        <span
          aria-hidden
          className="rua-reticula pointer-events-none absolute -right-6 -top-6 h-52 w-60 [--reticula:rgba(242,230,30,0.20)] sm:h-72 sm:w-96"
          style={{
            WebkitMaskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 70%)',
            maskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 70%)',
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative z-10 flex min-w-0 flex-col gap-5 px-5 pb-5 pt-6 sm:px-8 sm:pt-8"
        >
          <SecaoRua label={`${L('Transfer', 'Transfer')} · ${tabMeta.eyebrow}`} />

          <div className="flex min-w-0 flex-col items-start gap-2">
            <h1 className="flex min-w-0 flex-col">
              <span className="font-voz leading-[0.82] text-papel" style={{ fontSize: 'clamp(60px, 16vw, 120px)' }}>
                {L('Mercado', 'Market')}
              </span>
              <span className="font-impact uppercase leading-[0.9] text-rua" style={{ fontSize: 'clamp(34px, 9.6vw, 72px)' }}>
                {L('de cartas.', 'of cards.')}
              </span>
            </h1>
            {/* A aba corrente vira um lambe de cal colado torto. */}
            <span className="mt-1 inline-flex -rotate-[3deg] items-center bg-cal px-3 py-1 font-voz text-[26px] leading-none text-asfalto-27 shadow-[4px_4px_0_rgba(0,0,0,0.55)]">
              {tabMeta.subtitle}
            </span>
          </div>

          {/* Estoque e saldo — o número manda, o rótulo acompanha. */}
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:max-w-xl">
            <div className="flex min-w-0 flex-col gap-1 border-2 border-linha bg-asfalto-27 p-3">
              <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.2em] text-mudo">
                — {L('Na vitrine', 'Listed')}
              </span>
              {/* O estoque da aba aberta (nas Legacies, as lendas listadas). */}
              <span className="font-spray text-[40px] font-black leading-none tabular-nums text-papel">
                {marketTab === 'legacies' ? legacyRows.length : auctionPool.length}
              </span>
              <span className="font-prova text-[10.5px] uppercase tracking-[0.14em] text-mudo">{L('cartas', 'cards')}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-1 border-[3px] border-ouro-27 bg-asfalto-27 p-3">
              <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.2em] text-mudo">
                — {L('No bolso', 'In pocket')}
              </span>
              <span className="min-w-0 font-spray text-[clamp(24px,7vw,40px)] font-black leading-none tabular-nums text-ouro-27 [overflow-wrap:anywhere]">
                {formatExp(oleBal)}
              </span>
              <span className="font-prova text-[10.5px] uppercase tracking-[0.14em] text-mudo">EXP</span>
            </div>
          </div>

          {/* ── BUSCA — o balcão do mercado ──────────────────────────────── */}
          <div className="flex min-w-0 flex-col gap-4 border-2 border-linha bg-asfalto-27 p-3 sm:p-4">
            <div className="flex min-w-0 items-center gap-2">
              <label className="sr-only" htmlFor="mercado-busca">
                {L('Buscar jogador pelo nome', 'Search player by name')}
              </label>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rua" aria-hidden />
                <input
                  id="mercado-busca"
                  ref={searchInputRef}
                  type="search"
                  inputMode="search"
                  placeholder={L('Quem você procura?', 'Who are you looking for?')}
                  value={filters.name}
                  onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setFilters({ ...filters, name: '' });
                  }}
                  autoComplete="off"
                  className={cn(CAMPO_RUA, 'h-12 py-0 pl-10 pr-10')}
                />
                {filters.name.trim() !== '' && (
                  <button
                    type="button"
                    onClick={() => setFilters({ ...filters, name: '' })}
                    aria-label={L('Limpar busca', 'Clear search')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-mudo hover:text-papel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {filtroAtivo && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="h-12 shrink-0 whitespace-nowrap border-2 border-linha px-3 font-impact text-[16px] uppercase leading-none text-suave transition-colors hover:border-papel hover:text-papel"
                >
                  {L('Limpar', 'Clear')}
                </button>
              )}
            </div>

            {/* Posição — rolagem horizontal no celular, tudo à vista no desktop. */}
            <div className="min-w-0">
              <p className="mb-2 font-prova text-[10.5px] font-bold uppercase tracking-[0.2em] text-mudo">
                — {L('Posição', 'Position')}
              </p>
              <div className="hide-scrollbar -mx-1 flex max-w-none gap-1.5 overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                {['', ...POSITIONS].map((p) => (
                  <button
                    key={p || 'todas'}
                    type="button"
                    onClick={() => setFilters({ ...filters, pos: p })}
                    aria-pressed={filters.pos === p}
                    className={cn(
                      'h-9 shrink-0 whitespace-nowrap px-3 font-impact text-[15px] uppercase leading-none transition-colors',
                      filters.pos === p
                        ? 'bg-rua text-asfalto-27'
                        : 'border-2 border-linha text-suave hover:border-papel hover:text-papel',
                    )}
                  >
                    {p ? rotuloPosicao(p) : L('Todas', 'All')}
                  </button>
                ))}
              </div>
            </div>

            {/* Ordenar — mesmo vocabulário nas duas abas. */}
            <div className="min-w-0">
              <p className="mb-2 font-prova text-[10.5px] font-bold uppercase tracking-[0.2em] text-mudo">
                — {L('Ordenar', 'Sort')}
              </p>
              <div className="hide-scrollbar -mx-1 flex max-w-none gap-1.5 overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                {MARKET_SORTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setFilters({ ...filters, sort: s.id })}
                    aria-pressed={filters.sort === s.id}
                    className={cn(
                      'h-9 shrink-0 whitespace-nowrap px-3 font-impact text-[15px] uppercase leading-none transition-colors',
                      filters.sort === s.id
                        ? 'bg-rua text-asfalto-27'
                        : 'border-2 border-linha text-suave hover:border-papel hover:text-papel',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* A fita fecha o muro — marca, não informação. */}
        <FitaRua tags={[L('#respeitoéouro', '#respectisgold'), '#correloko']} inclinacao={-1.5} className="pb-3 pt-1" />
      </section>

      {/* ── DESTAQUES DA SEMANA ─────────────────────────────────────────────
          Some enquanto há busca/filtro: é curadoria, não obedece ao filtro.
          As cartas entram coladas tortas como lambe; o hover endireita. */}
      {!isFiltered && highlightsOrdered.length > 0 ? (
        <section className="min-w-0 space-y-1">
          <SecaoRua label={L('Destaques da semana', 'Weekly highlights')} aside={String(highlightsOrdered.length)} />
          <h2 className="flex flex-col font-impact uppercase leading-[0.92]" style={{ fontSize: 'clamp(30px, 8.4vw, 50px)' }}>
            <span className="font-voz text-[1.2em] normal-case leading-[0.9] text-papel">{L('Carta boa', 'A good card')}</span>
            <span className="text-transparent [-webkit-text-stroke:1.5px_var(--color-papel)]">{L('não fica parada.', "doesn't sit still.")}</span>
          </h2>
          <div className="relative -mx-3 max-w-none sm:-mx-4 lg:-mx-8">
            <div
              ref={highlightsScrollRef}
              className="hide-scrollbar overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]"
            >
              <div className="inline-flex flex-nowrap items-stretch gap-4 px-5 py-7 sm:gap-5 sm:px-6 lg:px-10">
                {highlightsOrdered.slice(0, highlightsShownLen).map((player, i) => {
                  const legacyRow = legacyHighlightMap.get(player.id);
                  return (
                  <motion.div
                    key={`hl-${player.id}`}
                    initial={{ opacity: 0, scale: 0.96, rotate: 0 }}
                    animate={{ opacity: 1, scale: 1, rotate: TORTO[i % TORTO.length] }}
                    whileHover={{ rotate: 0, y: -4 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
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
                    topLabel={L('Destaques da semana', 'Weekly highlights')}
                    bottomLabel={
                      highlightsShownLen < highlightsOrdered.length
                        ? L(
                            `+${Math.min(DISCOVERY_CAROUSEL_STEP, highlightsOrdered.length - highlightsShownLen)} cartas`,
                            `+${Math.min(DISCOVERY_CAROUSEL_STEP, highlightsOrdered.length - highlightsShownLen)} cards`,
                          )
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

      {/* ── ABAS — placa de rua: a corrente é amarela (é onde se age) ─────── */}
      <div className="hide-scrollbar flex max-w-none items-stretch gap-2 overflow-x-auto border-b-2 border-linha pb-3">
        {tabsList.map((t) => {
          const active = marketTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setMarketTab(t.id)}
              aria-pressed={active}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-4 font-impact text-[18px] uppercase leading-none transition-colors sm:px-5',
                active
                  ? 'bg-rua text-asfalto-27'
                  : 'border-2 border-linha text-mudo hover:border-papel hover:text-papel',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {legacyMarketEnabled && marketTab === 'legacies' ? (
        <TransferLegaciesTab
          openDetailId={pendingLegacyDetailId}
          onDetailConsumed={() => setPendingLegacyDetailId(null)}
          busca={filters.name}
          pos={filters.pos}
          sort={filters.sort}
        />
      ) : null}
      <div className={marketTab !== 'legacies' ? 'contents' : 'hidden'}>
      <AnimatePresence>
        {purchaseCompleteBanner && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -8, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: -1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-between gap-3 bg-cal px-4 py-3 text-asfalto-27 shadow-[5px_5px_0_rgba(0,0,0,0.55)] sm:px-5"
          >
            {/* Recibo de papel colado torto: a compra fechou. */}
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center bg-asfalto-27 text-rua">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-voz text-[26px] leading-none">{L('Fechou negócio.', 'Deal closed.')}</p>
                <p className="mt-1 font-prova text-[10.5px] font-bold uppercase tracking-[0.18em]">
                  {L('Compra concluída', 'Purchase complete')}
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
              className="grid h-9 w-9 shrink-0 place-items-center border-2 border-asfalto-27 transition-colors hover:bg-asfalto-27 hover:text-cal"
              aria-label={L('Fechar aviso de compra', 'Close purchase notice')}
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GENESIS EM FOCO ─ headline + grade/lista ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <SecaoRua
            label={L('Genesis em foco', 'Genesis spotlight')}
            aside={`${gridPlayers.length} ${gridPlayers.length === 1 ? L('carta', 'card') : L('cartas', 'cards')}`}
          />
          <h2 className="font-voz leading-[0.9] text-papel" style={{ fontSize: 'clamp(34px, 9vw, 54px)' }}>
            {L('Cartas fundadoras', 'Founder cards')}
          </h2>
          {isFiltered ? (
            <p className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">
              {L('Com filtro aplicado', 'Filter applied')}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1 border-2 border-linha p-1">
          {(['grid', 'list'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setGenesisViewMode(m)}
              className={cn(
                'inline-flex min-h-9 items-center px-4 font-impact text-[15px] uppercase leading-none transition-colors',
                genesisViewMode === m ? 'bg-rua text-asfalto-27' : 'text-mudo hover:text-papel',
              )}
              aria-pressed={genesisViewMode === m}
              aria-label={
                m === 'grid'
                  ? L('Visualização em grade', 'Grid view')
                  : L('Visualização em lista horizontal', 'List view')
              }
            >
              {m === 'grid' ? L('Grade', 'Grid') : L('Lista', 'List')}
            </button>
          ))}
        </div>
      </div>

      {/* Body do catálogo — switch por viewMode (filtros sempre aplicam) */}
      {genesisViewMode === 'grid' ? (
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {gridPlayers.map((player, i) => (
            <motion.div
              key={player.id}
              className="min-w-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.04, duration: 0.3 }}
              onClick={() => setSelectedPlayer(player)}
            >
              <PlayerCard player={player} listHomonym={homonymRankById.get(player.id)} />
            </motion.div>
          ))}
          {gridPlayers.length === 0 && (
            <VazioRua
              className="col-span-full"
              titulo={L('Nada com esse filtro.', 'Nothing with that filter.')}
              linha={L('Afrouxa a busca ali em cima', 'Loosen the search above')}
            />
          )}
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {/* List view: cards horizontais um abaixo do outro */}
          {gridPlayers.length === 0 && (
            <VazioRua
              titulo={L('Nada com esse filtro.', 'Nothing with that filter.')}
              linha={L('Afrouxa a busca ali em cima', 'Loosen the search above')}
            />
          )}
          {gridPlayers.map((player, i) => (
            <TransferRowCard
              key={player.id}
              player={player}
              listHomonym={homonymRankById.get(player.id)}
              onSelect={() => setSelectedPlayer(player)}
              delay={Math.min(i, 12) * 0.04}
            />
          ))}

          {managerAuctionCards.length > 0 ? (
            <section className="min-w-0 space-y-2 pt-4">
              <SecaoRua label={L('Jogadores anunciados', 'Listed players')} aside={String(managerAuctionCards.length)} />
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="font-voz text-[28px] leading-none text-papel">
                  {L('Toque pra mudar ou retirar.', 'Tap to change or delist.')}
                </p>
                <Link
                  to="/team"
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 font-impact text-[17px] uppercase leading-none text-rua transition-colors hover:text-papel"
                >
                  {L('Anunciar mais', 'List more')} <span aria-hidden>→</span>
                </Link>
              </div>
              <div className="relative -mx-3 max-w-none sm:-mx-4 lg:-mx-8">
                <div className="hide-scrollbar overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
                  <div className="inline-flex flex-nowrap items-stretch gap-3 px-3 py-3 sm:gap-4 sm:px-4 lg:px-8">
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

      {/* Ficha da carta — overlay com scroll; painel limitado à viewport menos safe areas e barra inferior */}
      <AnimatePresence>
        {selectedPlayer && (() => {
          const dSel = degrauDe(selectedPlayer.ovr);
          const infoSel = DEGRAU_INFO[dSel];
          return (
          <div className="fixed inset-0 z-50 flex min-h-0 flex-col overflow-y-auto overscroll-y-contain bg-asfalto-27/95 px-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(1.25rem,calc(env(safe-area-inset-bottom,0px)+5.5rem))] sm:items-center sm:justify-center sm:px-4 sm:pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+2rem))] sm:pt-[max(1rem,env(safe-area-inset-top,0px))] md:px-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 20 }}
              className={cn(
                'my-2 flex w-full min-h-0 max-w-[min(100%,64rem)] flex-col overflow-hidden bg-asfalto-27 p-0 sm:my-4',
                // Não usar h=100dvh no painel: soma com padding do overlay cortava o fundo; max-h deixa o scroll interior funcionar.
                'max-h-[min(920px,calc(100dvh-7.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] sm:max-h-[min(920px,calc(100dvh-4.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))]',
                dSel === 'respeito' || dSel === 'lenda' ? 'border-[3px] border-ouro-27' : 'border-2 border-linha',
              )}
            >
              <div className="z-[60] flex shrink-0 items-center justify-between gap-3 border-b-2 border-linha px-4 py-3">
                <span className="min-w-0 truncate font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
                  — {L('Ficha da carta', 'Card file')} · {infoSel.n} {infoSel.nome}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPlayer(null)}
                  className={FECHAR_RUA}
                  aria-label={L('Fechar', 'Close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Corpo com scroll até ao fim (leilão, histórico, bio) */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-pb-4 [-webkit-overflow-scrolling:touch]">
                <div className="flex flex-col pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] md:flex-row md:pb-10">
                  {/* Esquerda: a carta, colada no muro */}
                  <div className="rua-grao flex w-full shrink-0 items-start justify-center border-b-2 border-linha bg-concreto px-6 py-8 md:w-2/5 md:border-b-0 md:border-r-2 md:px-8">
                    <div className="w-full max-w-[280px] -rotate-[1.5deg]">
                      <PlayerCard player={selectedPlayer} isModal />
                    </div>
                  </div>

                  {/* Direita: ficha + compra */}
                  <div className="min-w-0 flex-1 p-4 sm:p-6 md:px-8 md:pb-8 md:pt-6">
                    <div className="flex flex-col gap-7">
                    {/* Cabeçalho */}
                    <div className="flex flex-col gap-2 border-b-2 border-linha pb-5">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <h2
                          className="min-w-0 max-w-full break-words font-voz leading-[0.9] text-papel [overflow-wrap:anywhere]"
                          style={{ fontSize: 'clamp(40px, 10vw, 64px)' }}
                        >
                          {selectedPlayer.name}
                        </h2>
                        <span
                          className="grid h-11 w-11 shrink-0 place-items-center border-2 border-linha text-xl leading-none"
                          title={
                            selectedPlayer.nat?.trim() && selectedPlayer.nat !== '—'
                              ? L(`País (código): ${selectedPlayer.nat}`, `Country (code): ${selectedPlayer.nat}`)
                              : undefined
                          }
                        >
                          {natFlagDisplay(selectedPlayer.nat) || '—'}
                        </span>
                      </div>
                      <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 font-impact uppercase leading-none">
                        <span className="text-[22px] text-suave">{rotuloPosicao(selectedPlayer.pos)}</span>
                        <span className={cn('text-[22px]', dSel === 'respeito' || dSel === 'lenda' ? 'text-ouro-27' : 'text-papel')}>
                          OVR {selectedPlayer.ovr}
                        </span>
                      </p>
                      <p className="min-w-0 break-words font-prova text-[10.5px] uppercase tracking-[0.12em] text-mudo [overflow-wrap:anywhere]">
                        {L('Anúncio', 'Listing')} #{selectedPlayer.id} · {playerIdentityLine(selectedPlayer)}
                      </p>
                    </div>

                    {/* Bio (até 250 caracteres) */}
                    <div className="flex flex-col gap-2">
                      <h3 className="flex items-center gap-2 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
                        <UserCircle className="h-3.5 w-3.5" aria-hidden /> — Bio
                      </h3>
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-suave">
                        {(selectedPlayer.bio ?? '').trim() || L('Sem bio neste anúncio.', 'No bio on this listing.')}
                      </p>
                      {selectedPlayer.bio && (
                        <p className="font-prova text-[10px] uppercase tracking-[0.14em] text-fio">
                          {Math.min(selectedPlayer.bio.length, BIO_MAX_LEN)} / {BIO_MAX_LEN} {L('caracteres', 'characters')}
                        </p>
                      )}
                    </div>

                    <TransferMemorablesInfoBox ids={selectedPlayer.memorableTrophyIds} />

                    {/* Atributos */}
                    <div className="flex flex-col gap-3">
                      <h3 className="flex items-center gap-2 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
                        <TrendingUp className="h-3.5 w-3.5" aria-hidden /> — {L('Atributos', 'Attributes')}
                      </h3>
                      <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                        <StatBar label="PAC" value={selectedPlayer.pac} />
                        <StatBar label="DRI" value={selectedPlayer.dri} />
                        <StatBar label="SHO" value={selectedPlayer.sho} />
                        <StatBar label="DEF" value={selectedPlayer.def} />
                        <StatBar label="PAS" value={selectedPlayer.pas} />
                        <StatBar label="PHY" value={selectedPlayer.phy} />
                      </div>
                    </div>

                    {/* Histórico */}
                    <div className="flex flex-col gap-2">
                      <h3 className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
                        — {L('Histórico', 'History')}
                      </h3>
                      <div className="border-2 border-linha">
                        {selectedPlayer.history.map((h: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex flex-col gap-1 border-b-2 border-linha px-3 py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                              <span className="font-spray text-[20px] font-black leading-none text-mudo">{h.year}</span>
                              <span className="font-impact text-[17px] uppercase leading-none text-papel">{h.club}</span>
                            </div>
                            <div className="flex shrink-0 gap-4 font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">
                              <span>{h.apps} {L('Jogos', 'Apps')}</span>
                              <span className="text-papel">{h.goals} {L('Gols', 'Goals')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Balcão de compra ── */}
                    <div className="rua-grao relative overflow-hidden border-2 border-linha bg-concreto p-4 sm:p-6">
                          <div className="mb-5 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:mb-6">
                            <div className="min-w-0">
                              <div className="mb-1 flex items-center gap-2 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
                                <Gavel className="h-3.5 w-3.5 shrink-0" aria-hidden /> — {L('Lance atual', 'Current bid')}
                              </div>
                              <div className="max-w-full break-words font-spray font-black leading-none tabular-nums text-papel [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(30px, 8vw, 46px)' }}>
                                {formatAuctionDisplay(selectedPlayer.auctionCurrency, selectedPlayer.currentBid)}
                              </div>
                            </div>
                            <div className="min-w-0 sm:text-right">
                              <div className="mb-1 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('Encerra em', 'Ends in')}</div>
                              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 font-spray font-black leading-none tabular-nums text-papel sm:justify-end" style={{ fontSize: 'clamp(24px, 6vw, 34px)' }}>
                                <Clock className="h-5 w-5 shrink-0 text-rua" aria-hidden />
                                <span className="min-w-0 break-all">{selectedPlayer.timeLeft}</span>
                              </div>
                            </div>
                          </div>

                          {selectedPlayer.marketKind === 'manager_other' &&
                          selectedPlayer.managerListingId ? (
                            <div className="space-y-3">
                              <p className="font-prova text-[11px] uppercase tracking-[0.14em] text-mudo">
                                {L('Saldo EXP:', 'EXP balance:')}{' '}
                                <span className="font-impact text-[15px] text-ouro-27">{formatExp(oleBal)}</span>
                              </p>
                              {(() => {
                                const pending = marketOffers.pendingForListing(selectedPlayer.managerListingId!);
                                return pending ? (
                                  <p className="border-l-[3px] border-rua pl-3 text-[13px] text-papel">
                                    {pending.status === 'countered' && pending.counterExp != null
                                      ? L(
                                          `Contraproposta do vendedor: ${formatExp(pending.counterExp)}.`,
                                          `Seller's counteroffer: ${formatExp(pending.counterExp)}.`,
                                        )
                                      : L(
                                          `Proposta enviada: ${formatExp(pending.offerExp)} (pendente).`,
                                          `Offer sent: ${formatExp(pending.offerExp)} (pending).`,
                                        )}
                                  </p>
                                ) : null;
                              })()}
                              {purchaseError && (
                                <p className="text-[13px] font-medium text-baixa">{purchaseError}</p>
                              )}
                              <button
                                type="button"
                                onClick={handleAcademiaMarketAction}
                                disabled={isPurchasing || oleBal < selectedPlayer.buyNow}
                                className={ACAO_RUA}
                              >
                                {isPurchasing
                                  ? L('Processando…', 'Processing…')
                                  : <>{`${L('Comprar agora', 'Buy now')} · ${formatAuctionDisplay(
                                      selectedPlayer.auctionCurrency,
                                      selectedPlayer.buyNow,
                                    )}`} <span aria-hidden>→</span></>}
                              </button>
                              <button
                                type="button"
                                onClick={() => setOfferModalListingId(selectedPlayer.managerListingId!)}
                                className={cn(ACAO_CONTORNO, 'mt-2')}
                              >
                                {marketOffers.pendingForListing(selectedPlayer.managerListingId)
                                  ? L('Atualizar proposta', 'Update offer')
                                  : L('Fazer proposta', 'Make offer')}
                              </button>
                            </div>
                          ) : selectedPlayer.marketKind === 'manager_own' ||
                          selectedPlayer.marketKind === 'genesis' ? (
                            <div className="space-y-3">
                              {selectedPlayer.marketKind === 'manager_own' ? (
                                <p className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Seu anúncio', 'Your listing')}</p>
                              ) : (
                                <>
                                  <p className="font-prova text-[11px] uppercase tracking-[0.14em] text-mudo">
                                    {L('Saldo EXP:', 'EXP balance:')}{' '}
                                    <span className="font-impact text-[15px] text-ouro-27">{formatExp(oleBal)}</span>
                                    {selectedPlayer.marketKind === 'genesis' &&
                                    oleBal < selectedPlayer.buyNow ? (
                                      <span className="mt-1 block normal-case tracking-normal text-baixa">
                                        {L('Saldo não fecha a compra agora.', 'Balance falls short right now.')}
                                      </span>
                                    ) : null}
                                  </p>
                                  {selectedPlayer.marketKind === 'genesis' && selectedPlayer.genesisCatalogId ? (
                                    <p className="font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">
                                      {genesisListedEntities[selectedPlayer.genesisCatalogId] == null
                                        ? L('Sincronizando catálogo Genesis… recarregue se o botão travar.', 'Syncing Genesis catalog… reload if the button gets stuck.')
                                        : genesisListedEntities[selectedPlayer.genesisCatalogId]!.contractIsLifetime
                                          ? L('Contrato vitalício (admin) — não expira com jogos.', "Lifetime contract (admin) — doesn't expire with matches.")
                                          : L(
                                              `Contrato: ${
                                                genesisListedEntities[selectedPlayer.genesisCatalogId]!
                                                  .contractMatchesIncluded ?? 70
                                              } jogos (amistoso ou oficial).`,
                                              `Contract: ${
                                                genesisListedEntities[selectedPlayer.genesisCatalogId]!
                                                  .contractMatchesIncluded ?? 70
                                              } matches (friendly or official).`,
                                            )}
                                    </p>
                                  ) : null}
                                </>
                              )}
                              {purchaseError && (
                                <p className="text-[13px] font-medium text-baixa">{purchaseError}</p>
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
                                className={selectedPlayer.marketKind === 'manager_own' ? ACAO_CONTORNO : ACAO_RUA}
                              >
                                {isPurchasing
                                  ? L('Processando…', 'Processing…')
                                  : selectedPlayer.marketKind === 'manager_own'
                                  ? L('Retirar do mercado · grátis', 'Remove from market · free')
                                  : <>{`${L('Comprar agora', 'Buy now')} · ${formatAuctionDisplay(
                                      selectedPlayer.auctionCurrency,
                                      selectedPlayer.buyNow,
                                    )}`} <span aria-hidden>→</span></>}
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                                <div className="relative min-w-0 flex-1">
                                  <span className="pointer-events-none absolute left-3 top-1/2 w-12 -translate-y-1/2 text-center font-prova text-[11px] font-bold text-mudo">
                                    {selectedPlayer.auctionCurrency === 'EXP' ? 'EXP' : '¢'}
                                  </span>
                                  <input
                                    type="number"
                                    placeholder={
                                      selectedPlayer.auctionCurrency === 'EXP'
                                        ? `${selectedPlayer.currentBid + 100000}`
                                        : `${selectedPlayer.currentBid + 1000}`
                                    }
                                    className={cn(CAMPO_RUA, 'min-h-[52px] pl-16 font-spray text-[22px] font-black')}
                                  />
                                </div>
                                <button
                                  type="button"
                                  className={cn(ACAO_RUA, 'sm:w-auto sm:px-8')}
                                >
                                  <Gavel className="h-5 w-5 shrink-0" aria-hidden />
                                  {L('Confirmar lance', 'Confirm bid')} <span aria-hidden>→</span>
                                </button>
                              </div>
                              <div className="mt-5 text-center">
                                <button
                                  type="button"
                                  onClick={handleMockBuyNow}
                                  className="mx-auto block max-w-full break-words px-2 font-prova text-[11px] uppercase tracking-[0.12em] text-mudo underline underline-offset-4 transition-colors [overflow-wrap:anywhere] hover:text-papel"
                                >
                                  {L('Ou comprar agora por', 'Or buy now for')}{' '}
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
            </motion.div>
          </div>
          );
        })()}
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

/** Memoráveis da carta: com título é LENDA (ouro); sem título é CHÃO (tracejado). */
function TransferMemorablesInfoBox({ ids }: { ids?: MemorableTrophyId[] }) {
  const labels = memorableLabels(ids);
  const has = labels.length > 0;
  if (!has) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-2 border-dashed border-fio px-4 py-3">
        <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
          — {L('Memoráveis', 'Memorables')}
        </span>
        <span className="font-prova text-[11px] uppercase tracking-[0.1em] text-fio">
          {L('Sem títulos memoráveis neste anúncio.', 'No memorable titles on this listing.')}
        </span>
      </div>
    );
  }
  return (
    <div className="border-[3px] border-ouro-27 bg-asfalto-27 p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 bg-ouro-27 px-2.5 py-1 font-impact text-[16px] uppercase leading-none text-asfalto-27">
          <Trophy className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
          {L('Memoráveis', 'Memorables')}
        </span>
        <span className="font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">
          {L('#liga #copa #supercopa', '#league #cup #supercup')}
        </span>
      </div>
      <ul className="space-y-2">
        {labels.map((label) => (
          <li key={label} className="flex min-w-0 items-center gap-3 border-2 border-linha px-3 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ouro-27 text-asfalto-27">
              <Trophy className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            </span>
            <span className="min-w-0 flex-1 break-words font-impact text-[17px] uppercase leading-tight text-papel [overflow-wrap:anywhere]">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  // Barra em 10 segmentos de rua (DS 2027) — mesma régua em Genesis e Legacy.
  return <AtributoRua label={label} value={value} />;
}

/** Selo de moeda/venda dentro da carta: não some em nenhum degrau. */
function seloCarta(d: Degrau): string {
  return cn(
    'inline-flex max-w-[6.5rem] shrink-0 items-center truncate whitespace-nowrap px-1.5 py-0.5 font-prova text-[9.5px] font-bold uppercase tracking-[0.08em]',
    d === 'respeito' ? 'border-2 border-ouro-27 text-ouro-27' : 'bg-asfalto-27 text-papel',
  );
}

/** Carta estreita para carris horizontais — poucos nós DOM vs. `PlayerCard` completo. */
function TransferMarketCompactCard({
  player,
  listHomonym,
}: {
  player: MockAuctionPlayer;
  listHomonym?: { index: number; total: number };
}) {
  const d = degrauDe(player.ovr);
  const showHomonymStrip = listHomonym && listHomonym.total > 1;
  return (
    <div
      className={cn(
        'group relative flex h-full min-h-0 w-full min-w-0 cursor-pointer flex-col gap-2 p-2.5 shadow-[4px_5px_0_rgba(0,0,0,0.55)] transition-transform duration-200 hover:-translate-y-0.5',
        DEGRAU_CLASSES[d],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className={cn('font-impact text-[34px] leading-[0.85] tabular-nums', ovrClasses(d))}>{player.ovr}</span>
          <span className={cn('mt-0.5 font-impact text-[12px] uppercase leading-none', d === 'respeito' && 'text-ouro-27')}>
            {rotuloPosicao(player.pos)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-base leading-none" title={player.nat?.trim() && player.nat !== '—' ? player.nat : undefined}>
            {natFlagDisplay(player.nat) || '—'}
          </span>
          <span className={seloCarta(d)}>{player.auctionCurrency === 'EXP' ? 'EXP' : 'BRO'}</span>
        </div>
      </div>
      <div className={cn('relative aspect-[4/5] w-full overflow-hidden', fotoFundo(d))}>
        <img
          src={player.portraitSrc?.trim() || `https://picsum.photos/seed/transfer-${player.id}/200/260`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top grayscale transition-[filter] duration-300 group-hover:grayscale-0"
          style={{ maxWidth: 'none' }}
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="min-w-0">
        <div className="truncate font-voz text-[21px] leading-none">{player.name}</div>
        {showHomonymStrip && listHomonym ? (
          <p className="mt-1 line-clamp-2 font-prova text-[9px] leading-tight [overflow-wrap:anywhere]" title={playerIdentityLine(player)}>
            {listHomonym.index}/{listHomonym.total} · {playerIdentityLine(player)}
          </p>
        ) : null}
      </div>
      <div className="flex justify-between gap-1 font-prova text-[10px] font-bold uppercase">
        <span>PAC {player.pac}</span>
        <span>SHO {player.sho}</span>
        <span>PAS {player.pas}</span>
      </div>
      <div className="mt-auto flex min-w-0 flex-col gap-1.5">
        <div className="flex min-w-0 items-baseline justify-between gap-1 font-prova text-[9.5px] uppercase tracking-[0.08em]">
          <span className="flex shrink-0 items-center gap-1 tabular-nums">
            <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden />
            {player.timeLeft}
          </span>
        </div>
        <span className="min-w-0 truncate font-spray text-[19px] font-black leading-none tabular-nums">
          {formatAuctionDisplay(player.auctionCurrency, player.currentBid, 'card')}
        </span>
        <span className={cn(ctaCartaClasses(d), 'min-h-9 text-[14px]')}>
          {L('Abrir', 'Open')} <span aria-hidden>→</span>
        </span>
      </div>
    </div>
  );
}

/**
 * A ESCADA DA CARTA — fonte única (DS 2027 · docs/DS-2027.md §1).
 *
 * O OVR decide o degrau e o degrau decide a pele inteira da carta:
 *   <70 CHÃO (cal tracejado, OVR vazado) · 70–79 CORRE (rua chapada)
 *   80–89 RESPEITO (asfalto + fio de ouro) · 90+ LENDA (ouro chapado).
 * Antes eram duas escalas (style/category) discordando sobre a mesma carta;
 * agora é uma régua só, a mesma da Home (`DropLenda`).
 */
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
      ? L('Lance EXP', 'EXP bid')
      : L('Lance BRO', 'BRO bid');
  const d = degrauDe(player.ovr);
  const info = DEGRAU_INFO[d];
  const showHomonymStrip = !isModal && listHomonym && listHomonym.total > 1;
  const preco = fixedSale ? fixedSale.price : formatAuctionDisplay(player.auctionCurrency, player.currentBid, 'card');
  return (
    <div
      className={cn(
        'group relative flex h-full min-w-0 cursor-pointer flex-col gap-2.5 p-2.5 sm:p-3',
        DEGRAU_CLASSES[d],
        !isModal && 'shadow-[5px_6px_0_rgba(0,0,0,0.55)]',
        isModal && 'shadow-[8px_10px_0_rgba(0,0,0,0.6)]',
        carouselStrip && 'w-full max-w-full',
        !isModal && !carouselStrip && 'w-full',
      )}
    >
      {/* ── Topo: OVR + posição | escudo + bandeira ── */}
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex flex-col">
          <span
            className={cn('font-impact leading-[0.85] tabular-nums', ovrClasses(d))}
            style={{ fontSize: isModal ? '64px' : 'clamp(40px, 11vw, 54px)' }}
          >
            {player.ovr}
          </span>
          <span className={cn('mt-1 font-impact text-[14px] uppercase leading-none', d === 'respeito' && 'text-ouro-27')}>
            {rotuloPosicao(player.pos)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <MarcaRua tipo="escudo" className={cn('h-7', d === 'respeito' ? 'bg-ouro-27' : 'bg-asfalto-27')} />
          <span
            className="text-lg leading-none"
            title={player.nat?.trim() && player.nat !== '—' ? player.nat : undefined}
          >
            {natFlagDisplay(player.nat) || '—'}
          </span>
        </div>
      </div>

      {/* ── Janela da foto ── */}
      <div className={cn('relative aspect-[4/5] w-full overflow-hidden', fotoFundo(d))}>
        <img
          src={player.portraitSrc?.trim() || `https://picsum.photos/seed/transfer-${player.id}/300/400`}
          alt={player.name}
          className={cn(
            'absolute inset-0 h-full w-full object-cover object-top transition-[filter] duration-500',
            portraitClassName ?? 'grayscale group-hover:grayscale-0',
          )}
          referrerPolicy="no-referrer"
          style={portraitStyle ?? { maxWidth: 'none' }}
        />
        <span className={cn(seloCarta(d === 'respeito' ? 'corre' : d), 'absolute left-0 top-2')} title={currencyLabel}>
          {currencyLabel}
        </span>
      </div>

      {/* ── Nome na VOZ ── */}
      <div className="min-w-0">
        <div
          className={cn(
            'min-w-0 font-voz leading-[0.95]',
            isModal ? 'break-words text-[32px] [overflow-wrap:anywhere]' : 'truncate text-[24px] sm:text-[26px]',
          )}
        >
          {player.name}
        </div>
        {showHomonymStrip && listHomonym ? (
          <p
            className="mt-1 line-clamp-2 font-prova text-[9.5px] leading-tight [overflow-wrap:anywhere]"
            title={`${L('Anúncio', 'Listing')} #${player.id} · ${playerIdentityLine(player)}`}
          >
            {listHomonym.index}/{listHomonym.total} · {playerIdentityLine(player)}
          </p>
        ) : null}
        {!isModal && player.bio && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug opacity-75" title={player.bio.slice(0, BIO_MAX_LEN)}>
            {truncateBio(player.bio, 140)}
          </p>
        )}
      </div>

      {/* ── Três números da carta, em prova ── */}
      <div className="flex min-w-0 justify-between gap-1">
        {([['PAC', player.pac], ['SHO', player.sho], ['PAS', player.pas]] as const).map(([k, v]) => (
          <div key={k} className="flex flex-col items-start">
            <span className="font-prova text-[9.5px] font-bold uppercase tracking-[0.14em] opacity-70">{k}</span>
            <span className={cn('font-impact text-[19px] leading-none tabular-nums', d === 'respeito' && 'text-ouro-27')}>{v}</span>
          </div>
        ))}
      </div>

      {/* ── Faixa do degrau ── */}
      <div className={faixaClasses(d)}>
        <span className="truncate">
          {info.n} · {info.nome}
        </span>
        {!fixedSale && !isModal && player.timeLeft ? (
          <span className="flex shrink-0 items-center gap-1 tabular-nums normal-case tracking-normal">
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            {player.timeLeft}
          </span>
        ) : null}
      </div>

      {/* ── Preço + ação ── */}
      {!isModal && (
        <div className="mt-auto flex min-w-0 flex-col gap-2">
          <span
            className={cn('min-w-0 truncate font-spray font-black leading-none tabular-nums', d === 'respeito' && 'text-ouro-27')}
            style={{ fontSize: carouselStrip ? '26px' : 'clamp(20px, 5.6vw, 28px)' }}
            title={preco}
          >
            {preco}
          </span>
          <button type="button" className={ctaCartaClasses(d)}>
            {fixedSale ? fixedSale.cta : L('Dar lance', 'Place bid')} <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * TransferRowCard — carta deitada pra visualização "Lista".
 * Foto à esquerda com a etiqueta de OVR no degrau da carta; ficha no concreto
 * à direita; preço em spray e ação dominante.
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
  const d = degrauDe(player.ovr);
  const info = DEGRAU_INFO[d];
  const topo = d === 'respeito' || d === 'lenda';
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
        'group flex w-full min-w-0 overflow-hidden bg-concreto transition-colors duration-200',
        topo ? 'border-[3px] border-ouro-27' : 'border-2 border-linha hover:border-fio',
      )}
    >
      {/* Foto + etiqueta de OVR no degrau */}
      <button
        type="button"
        onClick={onSelect}
        className="relative w-28 flex-shrink-0 cursor-pointer overflow-hidden bg-asfalto-27 [-webkit-tap-highlight-color:transparent] sm:w-36 md:w-44"
        aria-label={L(`Ver ${player.name}`, `View ${player.name}`)}
      >
        <img
          src={player.portraitSrc?.trim() || `https://picsum.photos/seed/transfer-${player.id}/300/400`}
          alt={player.name}
          className={cn(
            'absolute inset-0 h-full w-full object-cover object-top transition-[filter] duration-300',
            portraitClassName ?? 'grayscale group-hover:grayscale-0',
          )}
          style={portraitStyle ?? { maxWidth: 'none' }}
          referrerPolicy="no-referrer"
        />
        <div className={cn('absolute left-0 top-0 z-10 flex flex-col items-start px-2 pb-1.5 pt-1.5', DEGRAU_CLASSES[d])}>
          <span className={cn('font-impact leading-[0.85] tabular-nums', ovrClasses(d))} style={{ fontSize: 'clamp(32px, 5vw, 44px)' }}>
            {player.ovr}
          </span>
          <span className={cn('mt-0.5 font-impact text-[12px] uppercase leading-none', d === 'respeito' && 'text-ouro-27')}>
            {rotuloPosicao(player.pos)}
          </span>
        </div>
      </button>

      {/* Ficha */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-3 py-3 md:px-4 md:py-3.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <button
            type="button"
            onClick={onSelect}
            className="min-w-0 flex-1 cursor-pointer text-left [-webkit-tap-highlight-color:transparent]"
          >
            <p className="truncate font-voz leading-[0.95] text-papel" style={{ fontSize: 'clamp(24px, 3vw, 30px)' }}>
              {player.name}
            </p>
            <p className="mt-1 truncate font-prova text-[10.5px] uppercase tracking-[0.14em] text-mudo">
              {flag ? <span className="mr-1.5" aria-hidden>{flag}</span> : null}
              {player.nat?.trim() && player.nat !== '—' ? player.nat : L('Sem nação', 'No nation')}
              {' · '}
              <span className={topo ? 'text-ouro-27' : 'text-suave'}>
                {info.n} {info.nome}
              </span>
              {listHomonym && listHomonym.total > 1 ? (
                <span className="ml-1 text-papel">
                  · {listHomonym.index}/{listHomonym.total}
                </span>
              ) : null}
            </p>
          </button>
          <span className="inline-flex shrink-0 items-center border-2 border-linha px-1.5 py-0.5 font-prova text-[10px] font-bold uppercase tracking-[0.08em] text-suave">
            {fixedSale ? fixedSale.badge : player.auctionCurrency}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-5">
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 items-baseline justify-between gap-1 border-b-2 border-linha pb-1">
              <span className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{s.label}</span>
              <span className="font-impact text-[20px] leading-none tabular-nums text-papel">{s.val}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {!fixedSale && (
              <span className="font-prova text-[10px] uppercase tracking-[0.14em] text-mudo">
                {L('Encerra em', 'Ends in')} <span className="text-papel">{player.timeLeft}</span>
              </span>
            )}
            <span
              className={cn('min-w-0 truncate font-spray font-black leading-none tabular-nums', topo ? 'text-ouro-27' : 'text-papel')}
              style={{ fontSize: 'clamp(22px, 2.6vw, 28px)' }}
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
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 px-4 font-impact text-[16px] uppercase leading-none text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_var(--color-papel)] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_var(--color-papel)]',
              topo ? 'bg-ouro-27' : 'bg-rua',
            )}
          >
            {fixedSale ? fixedSale.cta : L('Dar lance', 'Place bid')} <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
