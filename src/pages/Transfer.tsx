import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, Gavel, Clock, X, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuctionCurrency } from '@/economy/model';
import { formatExp } from '@/systems/economy';

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
}

const MOCK_PLAYERS: MockAuctionPlayer[] = [
  { id: 1, name: 'RODRIGUES', pos: 'ATA', nat: 'BR', ovr: 89, style: 'neon-yellow', category: 'gold', pac: 92, sho: 88, pas: 81, dri: 90, def: 35, phy: 78, auctionCurrency: 'EXP', currentBid: 2500000, buyNow: 3500000, timeLeft: '00:15:30', history: [{ year: '2025', club: 'Titans FC', apps: 34, goals: 22 }, { year: '2024', club: 'Titans FC', apps: 28, goals: 15 }] },
  { id: 2, name: 'FERNANDES', pos: 'MEI', nat: 'PT', ovr: 86, style: 'white', category: 'silver', pac: 85, sho: 84, pas: 89, dri: 88, def: 55, phy: 70, auctionCurrency: 'EXP', currentBid: 1800000, buyNow: 2200000, timeLeft: '01:45:00', history: [{ year: '2025', club: 'Spartans', apps: 38, goals: 12 }] },
  { id: 3, name: 'MARTINS', pos: 'ZAG', nat: 'BR', ovr: 83, style: 'white', category: 'silver', pac: 76, sho: 45, pas: 70, dri: 65, def: 85, phy: 88, auctionCurrency: 'EXP', currentBid: 1200000, buyNow: 1500000, timeLeft: '03:20:15', history: [{ year: '2025', club: 'Wolves', apps: 40, goals: 3 }] },
  { id: 4, name: 'GARCIA', pos: 'LE', nat: 'ES', ovr: 81, style: 'gray-400', category: 'bronze', pac: 87, sho: 62, pas: 77, dri: 80, def: 78, phy: 75, auctionCurrency: 'BRO', currentBid: 95000, buyNow: 110000, timeLeft: '00:05:10', history: [{ year: '2025', club: 'Dragons', apps: 25, goals: 1 }] },
  { id: 5, name: 'ROCHA', pos: 'VOL', nat: 'BR', ovr: 84, style: 'white', category: 'silver', pac: 78, sho: 70, pas: 83, dri: 82, def: 84, phy: 86, auctionCurrency: 'BRO', currentBid: 150000, buyNow: 200000, timeLeft: '12:00:00', history: [{ year: '2025', club: 'Ole FC', apps: 30, goals: 4 }] },
  { id: 6, name: 'MBAPPE', pos: 'ATA', nat: 'FR', ovr: 91, style: 'neon-yellow', category: 'gold', pac: 97, sho: 89, pas: 80, dri: 92, def: 36, phy: 78, auctionCurrency: 'BRO', currentBid: 550000, buyNow: 800000, timeLeft: '00:02:15', history: [{ year: '2025', club: 'Royals', apps: 42, goals: 35 }] },
];

const POSITIONS = ['ATA', 'PD', 'PE', 'MEI', 'MC', 'VOL', 'LE', 'LD', 'ZAG', 'GOL'];
const NATIONS = ['BR', 'PT', 'ES', 'FR', 'AR', 'UY'];

function formatAuctionDisplay(currency: AuctionCurrency, amount: number): string {
  if (currency === 'EXP') {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M EXP`;
    if (amount >= 10_000) return `${(amount / 1000).toFixed(0)}k EXP`;
    return `${formatExp(amount)} EXP`;
  }
  const bro = amount / 100;
  return `${bro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BRO`;
}

export function Transfer() {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<MockAuctionPlayer | null>(null);
  
  // Filters State
  const [filters, setFilters] = useState({
    pos: '',
    nat: '',
    name: '',
  });

  const filteredPlayers = MOCK_PLAYERS.filter((p) => {
    if (filters.pos && p.pos !== filters.pos) return false;
    if (filters.nat && p.nat !== filters.nat) return false;
    const q = filters.name.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="mb-6 space-y-2">
        <div className="flex justify-between items-start gap-4">
          <h2 className="text-4xl font-display font-black italic uppercase tracking-wider">Mercado de Leilões</h2>
          <div className="flex gap-2 shrink-0">
            <button type="button" className="sports-panel p-3 rounded-lg hover:bg-white/10 transition-colors">
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
          Cada anúncio tem uma moeda única de lance (EXP ou BRO). Lances em EXP alteram seu saldo EXP e o ranking mundial; lances em BRO usam apenas o saldo BRO.
        </p>
      </div>

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
        {filteredPlayers.map((player, i) => (
          <motion.div 
            key={player.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            onClick={() => setSelectedPlayer(player)}
          >
            <PlayerCard player={player} />
          </motion.div>
        ))}
        {filteredPlayers.length === 0 && (
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
                'sports-panel max-w-5xl w-full max-h-[90vh] flex flex-col relative p-0 overflow-hidden',
                selectedPlayer.category === 'gold'
                  ? `border-2 border-neon-yellow ${GOLD_CARD_GLOW}`
                  : 'border-neon-yellow/50 shadow-[0_0_50px_rgba(228,255,0,0.1)]',
              )}
            >
              <button 
                onClick={() => setSelectedPlayer(null)} 
                className="absolute top-4 right-4 text-gray-400 hover:text-white z-50 bg-black/50 p-2 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
              
              {/* Scrollable container for the entire modal content */}
              <div className="flex flex-col md:flex-row w-full overflow-y-auto">
                
                {/* Left: Card */}
                <div className="w-full md:w-2/5 shrink-0 p-6 md:p-8 bg-black/20 flex items-start justify-center border-b md:border-b-0 md:border-r border-white/10">
                  <div className="w-full max-w-[300px]">
                    <PlayerCard player={selectedPlayer} isModal />
                  </div>
                </div>

                {/* Right: Details & Bidding */}
                <div className="flex-1 p-6 md:p-8">
                  <div className="flex flex-col gap-6">
                    {/* Header */}
                    <div className="border-b border-white/10 pb-4">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-4xl font-display font-black italic uppercase text-white tracking-wider">{selectedPlayer.name}</h2>
                        <span className="bg-white/10 px-2 py-1 rounded text-xs font-bold border border-white/20 text-white">{selectedPlayer.nat}</span>
                      </div>
                      <p className="text-neon-yellow font-bold uppercase tracking-widest text-sm">{selectedPlayer.pos} • Overall {selectedPlayer.ovr}</p>
                    </div>

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
                    <div className="mt-auto pt-4">
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

function PlayerCard({ player, isModal = false }: { player: MockAuctionPlayer; isModal?: boolean }) {
  const currencyLabel =
    player.auctionCurrency === 'EXP' ? 'Lances em EXP' : 'Lances em BRO';
  const isGold = player.category === 'gold';
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
            src={`https://picsum.photos/seed/${player.name}/300/400`} 
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
          </div>

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
              <span className="text-neon-green font-display font-bold text-lg leading-none">
                {formatAuctionDisplay(player.auctionCurrency, player.currentBid)}
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
