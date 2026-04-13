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
  Sparkles,
  Gem,
  Zap,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { AuctionCurrency } from '@/economy/model';
import { formatExp } from '@/systems/economy';
import { MEMORABLE_TROPHY_SLOTS, type MemorableTrophyId } from '@/trophies/memorableCatalog';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { MANAGER_PROSPECT_CREATE_MAX_OVR, MANAGER_PROSPECT_EVOLVED_MAX_OVR } from '@/entities/managerProspect';
import type { PlayerEntity } from '@/entities/types';
import { countryCodeToFlagEmoji } from '@/lib/flagEmoji';

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

/** Leilão mock: `auctionCurrency` define a moeda de todos os lances (produto — não misturar no mesmo anúncio). */
interface MockAuctionPlayer {
  id: number;
  name: string;
  pos: string;
  nat: string;
  ovr: number;
  style: string;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  auctionCurrency: AuctionCurrency;
  /** EXP: pontos inteiros. BRO: centavos de BRO (como `broCents` na carteira). */
  currentBid: number;
  buyNow: number;
  timeLeft: string;
  history: { year: string; club: string; apps: number; goals: number }[];
  /** Cartas ouro: borda / glow estilo Sala de Troféus (Memoráveis). */
  category?: 'gold' | 'silver' | 'bronze';
  /** Texto curto para quem não conhece o jogador (máx. 250 caracteres no produto). */
  bio?: string;
  /** Títulos de carreira ligados a esta carta (catálogo Memoráveis). */
  memorableTrophyIds?: MemorableTrophyId[];
  /** Integração Academia OLE / listagens do plantel. */
  marketKind?: 'mock' | 'manager_own' | 'manager_npc';
  managerListingId?: string;
  managerPlayerId?: string;
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

const MOCK_PLAYERS: MockAuctionPlayer[] = [
  {
    id: 1,
    name: 'RODRIGUES',
    pos: 'ATA',
    nat: 'BR',
    ovr: 89,
    style: 'neon-yellow',
    category: 'gold',
    pac: 92,
    sho: 88,
    pas: 81,
    dri: 90,
    def: 35,
    phy: 78,
    auctionCurrency: 'EXP',
    currentBid: 2500000,
    buyNow: 3500000,
    timeLeft: '00:15:30',
    history: [
      { year: '2025', club: 'Titans FC', apps: 34, goals: 22 },
      { year: '2024', club: 'Titans FC', apps: 28, goals: 15 },
    ],
    bio: 'Atacante brasileiro, finalização forte e boa movimentação na área. Artilheiro da última temporada na liga OLE; referência no contra-ataque e pressão alta.',
    memorableTrophyIds: ['mem_liga_ole', 'mem_copa_ole'],
  },
  {
    id: 2,
    name: 'FERNANDES',
    pos: 'MEI',
    nat: 'PT',
    ovr: 86,
    style: 'white',
    category: 'silver',
    pac: 85,
    sho: 84,
    pas: 89,
    dri: 88,
    def: 55,
    phy: 70,
    auctionCurrency: 'EXP',
    currentBid: 1800000,
    buyNow: 2200000,
    timeLeft: '01:45:00',
    history: [{ year: '2025', club: 'Spartans', apps: 38, goals: 12 }],
    bio: 'Médio português criativo: visão de jogo e passes entre linhas. Costuma atuar como 8 ou meia interior; bom a remates de média distância.',
    memorableTrophyIds: ['mem_supercopa_ole'],
  },
  {
    id: 3,
    name: 'MARTINS',
    pos: 'ZAG',
    nat: 'BR',
    ovr: 83,
    style: 'white',
    category: 'silver',
    pac: 76,
    sho: 45,
    pas: 70,
    dri: 65,
    def: 85,
    phy: 88,
    auctionCurrency: 'EXP',
    currentBid: 1200000,
    buyNow: 1500000,
    timeLeft: '03:20:15',
    history: [{ year: '2025', club: 'Wolves', apps: 40, goals: 3 }],
    bio: 'Zagueiro físico, forte no jogo aéreo e no um contra um. Líder na defesa; pouco participativo no último terço mas seguro na saída de bola.',
    memorableTrophyIds: [],
  },
  {
    id: 4,
    name: 'GARCIA',
    pos: 'LE',
    nat: 'ES',
    ovr: 81,
    style: 'gray-400',
    category: 'bronze',
    pac: 87,
    sho: 62,
    pas: 77,
    dri: 80,
    def: 78,
    phy: 75,
    auctionCurrency: 'BRO',
    currentBid: 95000,
    buyNow: 110000,
    timeLeft: '00:05:10',
    history: [{ year: '2025', club: 'Dragons', apps: 25, goals: 1 }],
    bio: 'Lateral veloz que sobe bem pela esquerda; cruzamentos perigosos. Ainda em consolidação defensiva; ideal para sistemas com alas altos.',
    memorableTrophyIds: ['mem_copa_ole'],
  },
  {
    id: 5,
    name: 'ROCHA',
    pos: 'VOL',
    nat: 'BR',
    ovr: 84,
    style: 'white',
    category: 'silver',
    pac: 78,
    sho: 70,
    pas: 83,
    dri: 82,
    def: 84,
    phy: 86,
    auctionCurrency: 'BRO',
    currentBid: 150000,
    buyNow: 200000,
    timeLeft: '12:00:00',
    history: [{ year: '2025', club: 'Ole FC', apps: 30, goals: 4 }],
    bio: 'Volante que equilibra marcação e construção; boa leitura de segundo homem. Peça chave na transição defesa-ataque do Ole FC.',
    memorableTrophyIds: ['mem_liga_ole'],
  },
  {
    id: 6,
    name: 'MBAPPE',
    pos: 'ATA',
    nat: 'FR',
    ovr: 91,
    style: 'neon-yellow',
    category: 'gold',
    pac: 97,
    sho: 89,
    pas: 80,
    dri: 92,
    def: 36,
    phy: 78,
    auctionCurrency: 'BRO',
    currentBid: 550000,
    buyNow: 800000,
    timeLeft: '00:02:15',
    history: [{ year: '2025', club: 'Royals', apps: 42, goals: 35 }],
    bio: 'Extrema / ponta de lança de elite: explosão, conclusão e desmarques profundos. Carta de alto overall; raro no mercado.',
    memorableTrophyIds: ['mem_liga_ole', 'mem_copa_ole', 'mem_supercopa_ole'],
  },
  {
    id: 7,
    name: 'SILVA',
    pos: 'ZAG',
    nat: 'BR',
    ovr: 79,
    style: 'white',
    category: 'bronze',
    pac: 68,
    sho: 42,
    pas: 62,
    dri: 58,
    def: 80,
    phy: 82,
    auctionCurrency: 'EXP',
    currentBid: 680000,
    buyNow: 820000,
    timeLeft: '06:00:00',
    history: [{ year: '2025', club: 'Wolves', apps: 28, goals: 2 }],
    bio: 'Zagueiro canhoto, saída limpa. Um de vários SILVA no mercado; confira nação, posição e clube.',
    memorableTrophyIds: [],
  },
  {
    id: 8,
    name: 'SILVA',
    pos: 'ATA',
    nat: 'BR',
    ovr: 84,
    style: 'neon-yellow',
    category: 'silver',
    pac: 88,
    sho: 85,
    pas: 72,
    dri: 83,
    def: 38,
    phy: 76,
    auctionCurrency: 'BRO',
    currentBid: 120000,
    buyNow: 165000,
    timeLeft: '00:30:00',
    history: [{ year: '2025', club: 'Ole FC', apps: 32, goals: 14 }],
    bio: 'Atacante de área com bom posicionamento. Outro anúncio SILVA — use a linha abaixo do nome para não confundir.',
    memorableTrophyIds: ['mem_copa_ole'],
  },
  {
    id: 9,
    name: 'SILVA',
    pos: 'LE',
    nat: 'PT',
    ovr: 77,
    style: 'white',
    category: 'silver',
    pac: 84,
    sho: 58,
    pas: 74,
    dri: 78,
    def: 76,
    phy: 72,
    auctionCurrency: 'EXP',
    currentBid: 920000,
    buyNow: 1100000,
    timeLeft: '18:45:00',
    history: [{ year: '2025', club: 'Spartans', apps: 30, goals: 3 }],
    bio: 'Lateral português com cruzamento forte. Terceiro SILVA na lista; ordem por OVR dentro do mesmo nome.',
    memorableTrophyIds: [],
  },
  {
    id: 10,
    name: 'ALVAREZ',
    pos: 'ATA',
    nat: 'AR',
    ovr: 87,
    style: 'white',
    category: 'silver',
    pac: 86,
    sho: 86,
    pas: 78,
    dri: 84,
    def: 42,
    phy: 80,
    auctionCurrency: 'EXP',
    currentBid: 1400000,
    buyNow: 1900000,
    timeLeft: '04:10:00',
    history: [{ year: '2025', club: 'Ole FC', apps: 36, goals: 19 }],
    bio: 'Ponta de lança com movimento entre linhas e pressão no último terço.',
    memorableTrophyIds: ['mem_copa_ole'],
  },
  {
    id: 11,
    name: 'DIAS',
    pos: 'MC',
    nat: 'PT',
    ovr: 82,
    style: 'gray-400',
    category: 'bronze',
    pac: 72,
    sho: 68,
    pas: 84,
    dri: 76,
    def: 72,
    phy: 74,
    auctionCurrency: 'BRO',
    currentBid: 88000,
    buyNow: 105000,
    timeLeft: '09:30:00',
    history: [{ year: '2025', club: 'Dragons', apps: 33, goals: 6 }],
    bio: 'Meio-centro organizador; boa saída curta e leitura defensiva.',
    memorableTrophyIds: [],
  },
  {
    id: 12,
    name: 'VALVERDE',
    pos: 'MC',
    nat: 'UY',
    ovr: 88,
    style: 'neon-yellow',
    category: 'silver',
    pac: 88,
    sho: 82,
    pas: 85,
    dri: 84,
    def: 80,
    phy: 88,
    auctionCurrency: 'EXP',
    currentBid: 2100000,
    buyNow: 2600000,
    timeLeft: '00:45:00',
    history: [{ year: '2025', club: 'Royals', apps: 40, goals: 11 }],
    bio: 'Box-to-box com motor alto; chegada à área e remate de segunda linha.',
    memorableTrophyIds: ['mem_liga_ole'],
  },
  {
    id: 13,
    name: 'NUNEZ',
    pos: 'ATA',
    nat: 'UY',
    ovr: 85,
    style: 'white',
    category: 'silver',
    pac: 90,
    sho: 84,
    pas: 72,
    dri: 81,
    def: 40,
    phy: 86,
    auctionCurrency: 'BRO',
    currentBid: 132000,
    buyNow: 175000,
    timeLeft: '02:15:00',
    history: [{ year: '2025', club: 'Spartans', apps: 29, goals: 13 }],
    bio: 'Extremo / segundo atacante com profundidade e cruzamentos rasos.',
    memorableTrophyIds: [],
  },
  {
    id: 14,
    name: 'COSTA',
    pos: 'GOL',
    nat: 'BR',
    ovr: 80,
    style: 'white',
    category: 'bronze',
    pac: 58,
    sho: 55,
    pas: 68,
    dri: 62,
    def: 78,
    phy: 79,
    auctionCurrency: 'EXP',
    currentBid: 540000,
    buyNow: 690000,
    timeLeft: '14:00:00',
    history: [{ year: '2025', club: 'Titans FC', apps: 38, goals: 0 }],
    bio: 'Guarda-redes seguro no um-um; bom jogo com os pés na construção.',
    memorableTrophyIds: [],
  },
];

/** Cartas iniciais no carril “Sessão do mercado” (ordem por OVR); “Ver mais” acrescenta do mesmo ranking. */
const SESSION_SPOTLIGHT_MAX = 11;
const SESSION_CAROUSEL_STEP = 5;

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

export function Transfer() {
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [purchaseCompleteBanner, setPurchaseCompleteBanner] = useState(false);
  const purchaseBannerHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<MockAuctionPlayer | null>(null);
  const [sessionVisibleCount, setSessionVisibleCount] = useState(SESSION_SPOTLIGHT_MAX);
  const [discoveryVisibleCount, setDiscoveryVisibleCount] = useState(initialDiscoveryVisibleMap);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const highlightsScrollRef = useRef<HTMLDivElement>(null);

  const dispatch = useGameDispatch();
  const playersById = useGameStore((s) => s.players);
  const managerProspectMarket = useGameStore((s) => s.managerProspectMarket);
  const oleBal = useGameStore((s) => s.finance.ole);

  const [listPriceByPlayer, setListPriceByPlayer] = useState<Record<string, string>>({});

  const managerAuctionCards = useMemo(() => {
    const out: MockAuctionPlayer[] = [];
    let nid = 9_000_001;
    for (const o of managerProspectMarket.npcOffers) {
      out.push(
        playerEntityToManagerMockAuction(o.snapshot, nid++, o.priceExp, 'manager_npc', {
          managerListingId: o.listingId,
        }),
      );
    }
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
  }, [managerProspectMarket, playersById]);

  const auctionPool = useMemo(() => [...MOCK_PLAYERS, ...managerAuctionCards], [managerAuctionCards]);

  const prospectsToList = useMemo(
    () =>
      Object.values(playersById).filter(
        (p) =>
          !p.listedOnMarket &&
          !managerProspectMarket.ownListings.some((l) => l.playerId === p.id),
      ),
    [playersById, managerProspectMarket.ownListings],
  );

  // Filters State
  const [filters, setFilters] = useState<{
    pos: string;
    nat: string;
    name: string;
    /** Vazio = todas as moedas. */
    currency: '' | AuctionCurrency;
  }>({
    pos: '',
    nat: '',
    name: '',
    currency: '',
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

  /** Com busca por nome ativa: ordena por nome, depois OVR (maior primeiro), depois id — lista previsível para homônimos. */
  const gridPlayers = useMemo(() => {
    const list = [...filteredPlayers];
    if (nameQueryNorm) {
      list.sort((a, b) => {
        const byName = a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' });
        if (byName !== 0) return byName;
        if (b.ovr !== a.ovr) return b.ovr - a.ovr;
        return a.id - b.id;
      });
    }
    return list;
  }, [filteredPlayers, nameQueryNorm]);

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

  /** Sem filtros nem busca: vitrine horizontal (escala). Com filtros: grelha clássica. */
  const isFiltered = Boolean(filters.pos || filters.nat || filters.currency || nameQueryNorm);

  useEffect(() => {
    setSessionVisibleCount(SESSION_SPOTLIGHT_MAX);
    setDiscoveryVisibleCount(initialDiscoveryVisibleMap());
  }, [isFiltered]);

  const discoveryRails = useMemo(() => {
    const pool = [...auctionPool];
    const byOvr = [...pool].sort((a, b) => b.ovr - a.ovr);
    const byNew = [...pool].sort((a, b) => b.id - a.id);
    const byValue = [...pool].sort((a, b) => b.buyNow - a.buyNow);
    const byUrgency = [...pool].sort((a, b) => timeLeftToSeconds(a.timeLeft) - timeLeftToSeconds(b.timeLeft));
    return [
      {
        id: 'highlights' as const,
        title: 'Destaques da semana',
        hint: 'Cartas em destaque pelo overall e buzz do mercado.',
        icon: TrendingUp,
        ordered: byOvr,
      },
      {
        id: 'fresh' as const,
        title: 'Novos no mercado',
        hint: 'Ideal para encontrar novidade.',
        icon: Sparkles,
        ordered: byNew,
      },
      {
        id: 'valuable' as const,
        title: 'Mais valiosos',
        hint: 'Ordenado por preço de compra imediata.',
        icon: Gem,
        ordered: byValue,
      },
      {
        id: 'deals' as const,
        title: 'Oportunidades',
        hint: 'Leilões a terminar mais cedo - atenção ao relógio.',
        icon: Zap,
        ordered: byUrgency,
      },
    ];
  }, [auctionPool]);

  /** Sessão do mercado (mock): ordenação comercial por OVR; “Ver mais” revela mais cartas do mesmo ranking. */
  const sessionMarketOrder = useMemo(
    () => [...auctionPool].sort((a, b) => (b.ovr !== a.ovr ? b.ovr - a.ovr : a.id - b.id)),
    [auctionPool],
  );
  const sessionCarouselPlayers = useMemo(
    () => sessionMarketOrder.slice(0, sessionVisibleCount),
    [sessionMarketOrder, sessionVisibleCount],
  );
  const sessionHomonymRankById = useMemo(
    () => homonymRankMapForPlayers(sessionMarketOrder),
    [sessionMarketOrder],
  );
  const canShowMoreSession = sessionVisibleCount < sessionMarketOrder.length;

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

  const handleAcademiaMarketAction = () => {
    if (!selectedPlayer?.marketKind || selectedPlayer.marketKind === 'mock') return;
    if (selectedPlayer.marketKind === 'manager_npc' && selectedPlayer.managerListingId) {
      if (oleBal < selectedPlayer.buyNow) return;
      dispatch({ type: 'BUY_MANAGER_NPC_OFFER', listingId: selectedPlayer.managerListingId });
      showPurchaseCompleteBanner();
      setSelectedPlayer(null);
      return;
    }
    if (selectedPlayer.marketKind === 'manager_own' && selectedPlayer.managerListingId) {
      dispatch({ type: 'DELIST_MANAGER_PROSPECT', listingId: selectedPlayer.managerListingId });
      setSelectedPlayer(null);
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden pb-6 md:pb-8">
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
              Cada card tem uma moeda única de lance (EXP ou BRO). 
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
          {discoveryRails.map((rail) => {
            const Icon = rail.icon;
            const vis = discoveryVisibleCount[rail.id] ?? DISCOVERY_CAROUSEL_INITIAL;
            const shown = rail.ordered.slice(0, vis);
            const canMore = vis < rail.ordered.length;
            const nextChunk = Math.min(DISCOVERY_CAROUSEL_STEP, rail.ordered.length - vis);
            const isHighlightsRail = rail.id === 'highlights';
            const railHomonymById = homonymRankMapForPlayers(rail.ordered);
            return (
              <section key={rail.id} className="min-w-0 space-y-2">
                <div className="flex min-w-0 items-start gap-3 px-0.5">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-neon-yellow" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-display text-base font-black uppercase tracking-wide text-white sm:text-lg [overflow-wrap:anywhere]">
                      {rail.title}
                    </h3>
                    <p className="max-w-full break-words text-[10px] leading-relaxed text-gray-500 [overflow-wrap:anywhere] sm:max-w-2xl">
                      {rail.hint}
                    </p>
                  </div>
                </div>
                <div className="min-w-0 w-full">
                  <div
                    ref={isHighlightsRail ? highlightsScrollRef : undefined}
                    className="overflow-x-auto overscroll-x-contain py-2 touch-pan-x [-webkit-overflow-scrolling:touch]"
                  >
                    <div className="inline-flex flex-nowrap items-stretch gap-3 pe-10 ps-0 sm:pe-14">
                      {shown.map((player, i) => (
                        <motion.div
                          key={`${rail.id}-${player.id}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02, duration: 0.2 }}
                          className={cn(
                            'min-w-0 shrink-0 cursor-pointer',
                            isHighlightsRail
                              ? 'w-[var(--highlight-card-px,min(220px,calc(100dvw-2.5rem)))]'
                              : 'w-[min(148px,calc(100dvw-2.75rem))] sm:w-[148px]',
                          )}
                          onClick={() => setSelectedPlayer(player)}
                        >
                          {isHighlightsRail ? (
                            <PlayerCard
                              player={player}
                              listHomonym={railHomonymById.get(player.id)}
                              carouselStrip
                            />
                          ) : (
                            <TransferMarketCompactCard
                              player={player}
                              listHomonym={railHomonymById.get(player.id)}
                            />
                          )}
                        </motion.div>
                      ))}
                      <TransferCarouselVerMaisTile
                        variant="neon"
                        topLabel={rail.title}
                        bottomLabel={
                          canMore ? `+${nextChunk} neste carril` : `${shown.length}/${rail.ordered.length}`
                        }
                        disabled={!canMore}
                        onClick={() => {
                          if (!canMore) return;
                          setDiscoveryVisibleCount((prev) => ({
                            ...prev,
                            [rail.id]: Math.min(
                              rail.ordered.length,
                              (prev[rail.id] ?? DISCOVERY_CAROUSEL_INITIAL) + DISCOVERY_CAROUSEL_STEP,
                            ),
                          }));
                        }}
                      />
                    </div>
                  </div>
                </div>
              </section>
            );
          })}

          <section id="transfer-mercado-sessao" className="min-w-0 scroll-mt-4 space-y-4 border-t border-white/10 pt-8">
            <div className="flex min-w-0 flex-col gap-3 px-0.5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-neon-yellow" aria-hidden />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-display text-base font-black uppercase tracking-wide text-white [overflow-wrap:anywhere] sm:text-lg">
                    Sessão do mercado
                  </h3>
                  <p className="max-w-full break-words text-[10px] leading-relaxed text-gray-500 [overflow-wrap:anywhere] sm:max-w-2xl">
                     
              
                  </p>
                </div>
              </div>
              <div className="flex min-w-0 w-full max-w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:max-w-none sm:justify-end">
                <span className="max-w-full rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5 text-center font-display text-[9px] font-bold uppercase leading-tight tracking-wider text-gray-300 [overflow-wrap:anywhere] min-[380px]:px-3 min-[380px]:text-[10px]">
                  {sessionMarketOrder.length} anúncios
                </span>
                <span className="max-w-full rounded-full border border-neon-yellow/35 bg-neon-yellow/10 px-2.5 py-1.5 text-center font-display text-[9px] font-bold uppercase leading-tight tracking-wider text-neon-yellow [overflow-wrap:anywhere] min-[380px]:px-3 min-[380px]:text-[10px]">
                  {sessionVisibleCount} no carril
                </span>
              </div>
            </div>

            <div className="min-w-0 w-full md:px-0">
              <div className="overflow-x-auto overscroll-x-contain py-3 pb-6 touch-pan-x [-webkit-overflow-scrolling:touch]">
                <div className="inline-flex max-w-none flex-nowrap items-stretch gap-3 pe-10 ps-0 sm:pe-14">
                  {sessionCarouselPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="min-w-0 w-[min(148px,calc(100dvw-2.75rem))] shrink-0 cursor-pointer sm:w-[148px]"
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <TransferMarketCompactCard
                        player={player}
                        listHomonym={sessionHomonymRankById.get(player.id)}
                      />
                    </div>
                  ))}
                  {canShowMoreSession ? (
                    <TransferCarouselVerMaisTile
                      variant="neon"
                      topLabel="Sessão"
                      bottomLabel={`+${Math.min(SESSION_CAROUSEL_STEP, sessionMarketOrder.length - sessionVisibleCount)} neste carril`}
                      onClick={() =>
                        setSessionVisibleCount((c) =>
                          Math.min(sessionMarketOrder.length, c + SESSION_CAROUSEL_STEP),
                        )
                      }
                    />
                  ) : (
                    <TransferCarouselVerMaisTile
                      variant="muted"
                      topLabel="Grelha"
                      bottomLabel="Abrir filtros"
                      onClick={() => setShowFilters(true)}
                    />
                  )}
                </div>
              </div>
            </div>

            {sessionVisibleCount > SESSION_SPOTLIGHT_MAX ? (
              <div className="flex justify-center px-0.5 pb-1 pt-2">
                <button
                  type="button"
                  onClick={() => setSessionVisibleCount(SESSION_SPOTLIGHT_MAX)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 font-display text-[10px] font-black uppercase tracking-wider text-gray-300 transition-colors hover:border-white/35 hover:bg-white/10 hover:text-white"
                >
                  <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                  Mostrar menos (sessão)
                </button>
              </div>
            ) : null}
          </section>

          <section
            id="transfer-academia-ole"
            className="sports-panel mt-8 min-w-0 scroll-mt-4 space-y-4 border border-neon-yellow/20 bg-black/35 p-4 sm:p-5"
          >
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="font-display text-sm font-black uppercase tracking-wide text-neon-yellow sm:text-base">
                  Academia OLE · mercado EXP
                </h3>
                <p className="mt-1 max-w-full text-[10px] leading-relaxed text-gray-500 [overflow-wrap:anywhere] sm:text-[11px]">
                  Anuncia jogadores do plantel no mercado EXP (preço entre 50k e 5M). Prospects da Academia (OVR ≤{' '}
                  {MANAGER_PROSPECT_CREATE_MAX_OVR} na criação; evolução até {MANAGER_PROSPECT_EVOLVED_MAX_OVR}) ou
                  cartas do elenco: os anúncios aparecem nas carruagens acima — abre o cartão para retirar o anúncio.
                </p>
              </div>
              <Link
                to="/team"
                className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center font-display text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/10"
              >
                Plantel
              </Link>
            </div>
            {prospectsToList.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Anunciar jogador</p>
                <ul className="space-y-2">
                  {prospectsToList.map((p) => {
                    const ovr = overallFromAttributes(p.attrs);
                    const draft = listPriceByPlayer[p.id] ?? '180000';
                    return (
                      <li
                        key={p.id}
                        className="flex min-w-0 flex-col gap-2 rounded-lg border border-white/10 bg-black/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <span className="font-display text-xs font-black uppercase text-white">{p.name}</span>
                          <span className="ml-2 text-[10px] text-gray-500">
                            {p.pos} · OVR {ovr}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <label className="sr-only" htmlFor={`list-price-${p.id}`}>
                            Preço EXP {p.name}
                          </label>
                          <input
                            id={`list-price-${p.id}`}
                            type="number"
                            min={50_000}
                            max={5_000_000}
                            value={draft}
                            onChange={(e) =>
                              setListPriceByPlayer((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            className="min-w-0 flex-1 rounded border border-white/15 bg-black/60 px-2 py-1.5 font-display text-xs font-bold text-white sm:max-w-[10rem]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const n = Math.round(Number(draft) || 180_000);
                              dispatch({ type: 'LIST_MANAGER_PROSPECT', playerId: p.id, priceExp: n });
                            }}
                            className="rounded border border-neon-yellow/40 bg-neon-yellow/10 px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-wide text-neon-yellow hover:bg-neon-yellow/20"
                          >
                            Listar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">
                Nenhum jogador disponível para anunciar (todos já estão no mercado ou listados). Usa{' '}
                <span className="text-gray-400">Meu Time</span> para anunciar reservas ou cria um na Academia OLE.
              </p>
            )}
          </section>
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
                          
                          {selectedPlayer.marketKind === 'manager_npc' ||
                          selectedPlayer.marketKind === 'manager_own' ? (
                            <div className="space-y-3">
                              {selectedPlayer.marketKind === 'manager_npc' ? (
                                <p className="text-[10px] text-gray-400">
                                  Saldo EXP:{' '}
                                  <span className="font-display font-bold text-white">{formatExp(oleBal)}</span>
                                  {oleBal < selectedPlayer.buyNow ? (
                                    <span className="mt-1 block text-red-300">Saldo insuficiente para compra imediata.</span>
                                  ) : null}
                                </p>
                              ) : (
                                <p className="text-[10px] text-gray-400">
                                  Anúncio teu — retira o prospect do mercado quando quiseres (sem custo).
                                </p>
                              )}
                              <button
                                type="button"
                                onClick={handleAcademiaMarketAction}
                                disabled={
                                  selectedPlayer.marketKind === 'manager_npc' &&
                                  oleBal < selectedPlayer.buyNow
                                }
                                className={cn(
                                  'btn-primary min-h-12 w-full bg-neon-green px-3 py-3 text-black hover:bg-white sm:py-4',
                                  selectedPlayer.marketKind === 'manager_npc' &&
                                    oleBal < selectedPlayer.buyNow &&
                                    'pointer-events-none opacity-40',
                                )}
                              >
                                <span className="skew-x-6 block text-center text-sm font-black uppercase sm:text-base">
                                  {selectedPlayer.marketKind === 'manager_npc'
                                    ? `Comprar agora · ${formatAuctionDisplay(selectedPlayer.auctionCurrency, selectedPlayer.buyNow)}`
                                    : 'Retirar do mercado'}
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
        <div className="relative flex aspect-[3/4] max-h-[120px] items-end justify-center pt-5">
          <img
            src={`https://picsum.photos/seed/transfer-${player.id}/200/260`}
            alt=""
            className="h-[88%] w-[88%] object-cover object-top grayscale transition-all duration-300 group-hover:grayscale-0"
            referrerPolicy="no-referrer"
            style={{
              maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
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
        <div className="aspect-[3/4] relative flex items-end justify-center pt-8">
          <img 
            src={`https://picsum.photos/seed/transfer-${player.id}/300/400`} 
            alt={player.name} 
            className="w-[90%] h-[90%] object-cover object-top grayscale group-hover:grayscale-0 transition-all duration-500 drop-shadow-2xl" 
            referrerPolicy="no-referrer" 
            style={{ maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }} 
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
