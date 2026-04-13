import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, Gavel, Clock, X, TrendingUp, Trophy, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuctionCurrency } from '@/economy/model';
import { formatExp } from '@/systems/economy';
import { MEMORABLE_TROPHY_SLOTS, type MemorableTrophyId } from '@/trophies/memorableCatalog';

const BIO_MAX_LEN = 250;

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
}

/** Chave estável para agrupar homônimos (mesmo nome exibido). */
function auctionNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Uma linha que diferencia anúncios com o mesmo nome: nação, posição, OVR, clube atual. */
function playerIdentityLine(p: MockAuctionPlayer): string {
  const club = p.history[0]?.club ?? '—';
  return `${p.nat} · ${p.pos} · ${p.ovr} · ${club}`;
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
];

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

export function Transfer() {
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<MockAuctionPlayer | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filters State
  const [filters, setFilters] = useState({
    pos: '',
    nat: '',
    name: '',
  });

  useEffect(() => {
    if (!showSearch) return;
    const id = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [showSearch]);

  const nameQueryNorm = filters.name.trim().toLowerCase();

  const filteredPlayers = useMemo(
    () =>
      MOCK_PLAYERS.filter((p) => {
        if (filters.pos && p.pos !== filters.pos) return false;
        if (filters.nat && p.nat !== filters.nat) return false;
        if (nameQueryNorm && !p.name.toLowerCase().includes(nameQueryNorm)) return false;
        return true;
      }),
    [filters.pos, filters.nat, nameQueryNorm],
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-28 md:pb-12">
      <div className="mb-6 space-y-2">
        <div className="flex justify-between items-start gap-4">
          <h2 className="text-4xl font-display font-black italic uppercase tracking-wider">Mercado de Leilões</h2>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowSearch((s) => !s)}
              className={cn(
                'sports-panel p-3 rounded-lg transition-colors',
                showSearch ? 'bg-white/20 ring-1 ring-neon-yellow/40' : 'hover:bg-white/10',
              )}
              aria-expanded={showSearch}
              aria-label={showSearch ? 'Fechar busca' : 'Abrir busca por nome'}
            >
              <Search className="w-5 h-5 text-neon-yellow" />
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'sports-panel p-3 rounded-lg transition-colors',
                showFilters ? 'bg-white/20' : 'hover:bg-white/10',
              )}
            >
              <Filter className="w-5 h-5 text-neon-yellow" />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 max-w-2xl leading-relaxed">
          Cada card tem uma moeda única de lance (EXP ou BRO). Lances em EXP alteram seu saldo EXP e o ranking mundial; lances em BRO usam apenas o saldo BRO.
        </p>
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
                <p className="text-[10px] text-gray-500 sm:max-w-[200px] sm:shrink-0 sm:pt-2">
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
                            <span className="font-display text-xs font-bold tracking-wide text-white">
                              {p.name}
                              {hm ? (
                                <span className="ml-1.5 text-neon-yellow/90">
                                  ({hm.index}/{hm.total})
                                </span>
                              ) : null}
                            </span>
                            <span className="text-[10px] text-gray-400">{playerIdentityLine(p)}</span>
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
            <div className="sports-panel mb-6 grid grid-cols-1 gap-4 border-neon-yellow/30 bg-dark-gray p-6 md:grid-cols-3">
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

      {/* Players Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {gridPlayers.map((player, i) => (
          <motion.div 
            key={player.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            onClick={() => setSelectedPlayer(player)}
          >
            <PlayerCard player={player} listHomonym={homonymRankById.get(player.id)} />
          </motion.div>
        ))}
        {gridPlayers.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 font-display font-bold text-xl">
            Nenhum jogador encontrado com estes filtros.
          </div>
        )}
      </div>

      {/* Player Details Modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/90 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                'sports-panel max-w-5xl w-full h-[min(92dvh,920px)] max-h-[92dvh] flex flex-col relative p-0 overflow-hidden',
                selectedPlayer.category === 'gold'
                  ? `border-2 border-neon-yellow ${GOLD_CARD_GLOW}`
                  : 'border-neon-yellow/50 shadow-[0_0_50px_rgba(228,255,0,0.1)]',
              )}
            >
              <div className="shrink-0 flex justify-end px-3 pt-3 pb-1 z-[60]">
                <button
                  type="button"
                  onClick={() => setSelectedPlayer(null)}
                  className="text-gray-400 hover:text-white bg-black/50 p-2 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Corpo com scroll até ao fim (leilão, histórico, bio) */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
                <div className="flex flex-col md:flex-row pb-8">
                  {/* Left: Card */}
                  <div className="w-full md:w-2/5 shrink-0 p-6 md:pt-2 md:pb-8 md:px-8 bg-black/20 flex items-start justify-center border-b md:border-b-0 md:border-r border-white/10">
                    <div className="w-full max-w-[300px]">
                      <PlayerCard player={selectedPlayer} isModal />
                    </div>
                  </div>

                  {/* Right: Details & Bidding */}
                  <div className="flex-1 min-w-0 p-6 md:pt-2 md:pb-8 md:px-8">
                    <div className="flex flex-col gap-6">
                    {/* Header */}
                    <div className="border-b border-white/10 pb-4">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-4xl font-display font-black italic uppercase text-white tracking-wider">{selectedPlayer.name}</h2>
                        <span className="bg-white/10 px-2 py-1 rounded text-xs font-bold border border-white/20 text-white">{selectedPlayer.nat}</span>
                      </div>
                      <p className="text-neon-yellow font-bold uppercase tracking-widest text-sm">{selectedPlayer.pos} • Overall {selectedPlayer.ovr}</p>
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
                          <div key={idx} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                            <div className="flex gap-4">
                              <span className="text-gray-500 font-bold">{h.year}</span>
                              <span className="text-white font-medium">{h.club}</span>
                            </div>
                            <div className="flex gap-4 text-gray-400">
                              <span>{h.apps} Jogos</span>
                              <span className="text-white font-bold">{h.goals} Gols</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bidding Area */}
                    <div className="pt-2">
                      <div className="bg-gradient-to-br from-neon-green/20 to-transparent border border-neon-green/50 p-6 rounded-xl relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'radial-gradient(#00FF66 1px, transparent 1px)', backgroundSize: '8px 8px' }} />
                        
                        <div className="relative z-10">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                            <div>
                              <div className="text-xs text-neon-green font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                                <Gavel className="w-4 h-4" /> Lance Atual
                              </div>
                              <div className="text-4xl font-display font-black text-white drop-shadow-md">
                                {formatAuctionDisplay(selectedPlayer.auctionCurrency, selectedPlayer.currentBid)}
                              </div>
                            </div>
                            <div className="text-left md:text-right">
                              <div className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Tempo Restante</div>
                              <div className="text-2xl font-display font-bold text-white flex items-center gap-2">
                                <Clock className="w-6 h-6 text-neon-yellow"/> {selectedPlayer.timeLeft}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-display font-bold text-xs w-14 text-center">
                                {selectedPlayer.auctionCurrency === 'EXP' ? 'EXP' : '¢'}
                              </span>
                              <input 
                                type="number" 
                                placeholder={
                                  selectedPlayer.auctionCurrency === 'EXP'
                                    ? `${selectedPlayer.currentBid + 100000}`
                                    : `${selectedPlayer.currentBid + 1000}`
                                } 
                                className="w-full bg-black/60 border border-white/20 rounded-lg py-4 pl-16 pr-4 font-display font-bold text-xl text-white focus:outline-none focus:border-neon-green transition-colors" 
                              />
                            </div>
                            <button className="btn-primary bg-neon-green text-black hover:bg-white px-8 py-4 shrink-0">
                              <span className="skew-x-6 flex items-center justify-center gap-2 text-lg">
                                <Gavel className="w-5 h-5"/> Confirmar Lance
                              </span>
                            </button>
                          </div>
                          <div className="mt-4 text-center">
                            <button className="text-xs text-gray-400 hover:text-white underline underline-offset-4 transition-colors">
                              Ou comprar agora por{' '}
                              {formatAuctionDisplay(selectedPlayer.auctionCurrency, selectedPlayer.buyNow)}
                            </button>
                          </div>
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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <span
            className={cn(
              'inline-flex self-start -skew-x-6 px-4 py-1.5 font-display font-black text-xs md:text-sm tracking-[0.25em] uppercase',
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
              'text-[11px] md:text-xs font-medium max-w-md leading-relaxed',
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
                className="flex items-center gap-3 rounded-lg border border-neon-yellow/40 bg-neon-yellow/10 px-3 py-2.5 shadow-[0_0_18px_rgba(234,255,0,0.2)]"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-neon-yellow bg-gradient-to-br from-neon-yellow to-amber-500 text-black -skew-x-6 shadow-[0_0_22px_rgba(250,204,21,0.45)] shrink-0">
                  <Trophy className="w-5 h-5 skew-x-6" strokeWidth={2.2} />
                </div>
                <span className="font-display font-bold text-sm text-white uppercase tracking-wide">{label}</span>
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
    <div className="flex items-center gap-3">
      <span className="w-8 text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-2.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn("h-full rounded-full", color)} 
        />
      </div>
      <span className="w-8 text-right font-display font-bold text-white">{value}</span>
    </div>
  );
}

/** Borda + sombras no mesmo espírito do box Memoráveis (Sala de Troféus). */
const GOLD_CARD_GLOW =
  'border-neon-yellow shadow-[0_0_28px_rgba(234,255,0,0.35),0_0_56px_rgba(250,204,21,0.18),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-amber-400/35 hover:shadow-[0_0_36px_rgba(234,255,0,0.45),0_0_72px_rgba(250,204,21,0.22)]';

function PlayerCard({
  player,
  isModal = false,
  listHomonym,
}: {
  player: MockAuctionPlayer;
  isModal?: boolean;
  /** Só na grelha: quando há mais de um anúncio com o mesmo nome no resultado atual. */
  listHomonym?: { index: number; total: number };
}) {
  const currencyLabel =
    player.auctionCurrency === 'EXP' ? 'Lances em EXP' : 'Lances em BRO';
  const isGold = player.category === 'gold';
  const showHomonymStrip = !isModal && listHomonym && listHomonym.total > 1;
  return (
    <div className={cn(
      "relative group cursor-pointer overflow-hidden rounded-xl border-2 bg-dark-gray transition-all duration-300 flex flex-col h-full",
      !isModal && "hover:-translate-y-2 hover:scale-[1.02]",
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
          <div className="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center border border-white/20 text-[8px] font-bold">
            {player.nat}
          </div>
          <span
            className={cn(
              'text-[8px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border',
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
          <div className="text-center mb-2">
            <div className="text-white font-display font-black text-2xl uppercase tracking-wider leading-none drop-shadow-md">{player.name}</div>
            {showHomonymStrip && listHomonym ? (
              <p
                className="mt-1.5 text-center text-[8px] font-display font-bold leading-tight tracking-wide text-neon-yellow/90 px-0.5"
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
        <div className="bg-black/80 border-t border-white/10 p-3 z-30 relative">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> {player.timeLeft}
              </span>
              <span className="max-w-[58%] text-right text-base font-display font-bold leading-tight text-neon-green tabular-nums sm:text-lg">
                {formatAuctionDisplay(player.auctionCurrency, player.currentBid, 'card')}
              </span>
            </div>
            <button className="w-full py-2 bg-neon-yellow text-black font-display font-bold uppercase tracking-wider text-sm -skew-x-6 hover:bg-white transition-colors flex items-center justify-center gap-2">
              <span className="skew-x-6 flex items-center gap-2">
                <Gavel className="w-4 h-4" />
                Dar Lance
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
