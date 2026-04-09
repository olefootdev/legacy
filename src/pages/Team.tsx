import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Brain, Dumbbell, UserPlus, X, Save, Shield, LayoutGrid, Check, AlertCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes, playerToCardView } from '@/entities/player';
import { FORMATION_SCHEME_LIST, SCHEME_LINE_GROUPS, pitchUiSlots } from '@/match-engine/formations/catalog';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';

type CardPlayer = ReturnType<typeof playerToCardView> & { id: string };

export function Team() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useGameDispatch();
  const playersById = useGameStore((s) => s.players);
  const lineupSaved = useGameStore((s) => s.lineup);
  const formationScheme = useGameStore((s) => s.manager.formationScheme);

  const maxOvr = useMemo(() => {
    const vals = Object.values(playersById);
    if (!vals.length) return 88;
    return Math.max(...vals.map((p) => overallFromAttributes(p.attrs)));
  }, [playersById]);

  const rosterCards: CardPlayer[] = useMemo(
    () => Object.values(playersById).map((p) => ({ ...playerToCardView(p, maxOvr), id: p.id })),
    [playersById, maxOvr],
  );

  /** Posições dos círculos no mini-campo seguem nx/nz da formação ativa. */
  const pitchSlots = useMemo(() => pitchUiSlots(formationScheme), [formationScheme]);

  const [lineup, setLineup] = useState<Record<string, CardPlayer>>({});
  /** Evita que re-sync com o store (players/maxOvr) apague edições locais (ex.: tirar 1 titular). */
  const [lineupDirty, setLineupDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [formationModalOpen, setFormationModalOpen] = useState(false);
  /** Feedback visível no painel (substitui alert nativo). */
  const [saveBanner, setSaveBanner] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (lineupDirty) {
      setLineup((prev) => {
        const next: Record<string, CardPlayer> = {};
        for (const [slot, card] of Object.entries(prev) as [string, CardPlayer][]) {
          const pl = playersById[card.id];
          if (pl) next[slot] = { ...playerToCardView(pl, maxOvr), id: pl.id };
        }
        return next;
      });
      return;
    }
    const next: Record<string, CardPlayer> = {};
    for (const [slot, pid] of Object.entries(lineupSaved)) {
      const pl = playersById[pid];
      if (pl) next[slot] = { ...playerToCardView(pl, maxOvr), id: pl.id };
    }
    setLineup(next);
  }, [lineupSaved, playersById, maxOvr, lineupDirty]);

  const lineupPlayerIds = Object.values(lineup)
    .filter((p): p is CardPlayer => Boolean(p))
    .map((p) => p.id);
  const availablePlayers = rosterCards.filter((p) => {
    const ent = playersById[p.id];
    return !lineupPlayerIds.includes(p.id) && ent && ent.outForMatches <= 0;
  });
  
  const selectedSlot = pitchSlots.find((s) => s.id === selectedSlotId);
  const modalPlayers = selectedSlot 
    ? availablePlayers.filter(p => p.pos === selectedSlot.label)
    : [];

  const handleEscalarToSlot = (player: CardPlayer, slotId: string) => {
    setSaveBanner(null);
    setLineupDirty(true);
    setLineup((prev) => ({ ...prev, [slotId]: player }));
    setSelectedSlotId(null);
  };

  const handleEscalar = (player: CardPlayer) => {
    // Try to find an empty slot that matches the player's position
    let targetSlot = pitchSlots.find((s) => s.label === player.pos && !lineup[s.id]);

    // If no exact match, find ANY empty slot
    if (!targetSlot) {
      targetSlot = pitchSlots.find((s) => !lineup[s.id]);
    }

    if (targetSlot) {
      setSaveBanner(null);
      setLineupDirty(true);
      setLineup((prev) => ({ ...prev, [targetSlot!.id]: player }));
    } else {
      alert("O time já está completo! Remova um jogador do campo primeiro.");
    }
  };

  const handleRemove = (slotId: string) => {
    setSaveBanner(null);
    setLineupDirty(true);
    setLineup((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  };

  const handleSave = () => {
    const filledSlots = pitchSlots.filter((s) => lineup[s.id]).length;
    if (filledSlots !== pitchSlots.length) {
      setSaveBanner({ kind: 'error', text: 'VOCÊ PRECISA PREENCHER TODAS AS POSIÇÕES' });
      return;
    }
    setSaveBanner(null);
    setIsSaving(true);
    const ids = Object.fromEntries(
      Object.entries(lineup)
        .filter((entry): entry is [string, CardPlayer] => Boolean(entry[1]))
        .map(([slot, pl]) => [slot, pl.id]),
    ) as Record<string, string>;
    dispatch({ type: 'SET_LINEUP', lineup: ids, formationScheme });
    setLineupDirty(false);
    setTimeout(() => {
      setIsSaving(false);
      setSaveBanner({ kind: 'success', text: 'Escalação salva com sucesso.' });
    }, 400);
  };

  const tabs = [
    { id: 'elenco', label: 'ELENCO', icon: Users },
    { id: 'tatica', label: 'TÁTICA', icon: Brain },
    { id: 'treino', label: 'TREINO', icon: Dumbbell },
    { id: 'staff', label: 'STAFF', icon: UserPlus },
  ];

  return (
    <div className="space-y-4 md:space-y-8 max-w-6xl mx-auto pb-8">
      {/* Header & Tabs */}
      <div className="relative overflow-hidden rounded-xl">
        <GameBannerBackdrop slot="team_header" imageOpacity={0.35} />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-3 md:gap-4 px-1 pb-1 md:px-2 md:pb-2">
          <div className="min-w-0">
            <h2 className="text-2xl md:text-4xl font-display font-black italic uppercase tracking-wider">Plantel Principal</h2>
            <p className="text-[10px] md:text-sm text-gray-400 font-medium mt-0.5 md:mt-1">
              Temporada 2026 •{' '}
              <span className="text-white/90 font-semibold">{formationScheme}</span>
              <span className="text-gray-500"> tático</span>
            </p>
            <button
              type="button"
              onClick={() => setFormationModalOpen(true)}
              className="mt-1.5 inline-flex items-center gap-1.5 text-[9px] md:text-[10px] font-display font-bold uppercase tracking-widest text-neon-yellow/90 hover:text-neon-yellow border border-neon-yellow/25 bg-neon-yellow/5 hover:bg-neon-yellow/10 px-2 py-1 rounded-sm -skew-x-6 transition-colors"
            >
              <span className="skew-x-6 inline-flex items-center gap-1">
                <LayoutGrid className="w-3 h-3 shrink-0 opacity-90" />
                Escolher formação
              </span>
            </button>
          </div>

          <div className="flex overflow-x-auto gap-2 pb-2 w-full md:w-auto hide-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'elenco') navigate('/team');
                  if (tab.id === 'tatica') navigate('/team/tatica');
                  if (tab.id === 'treino') navigate('/team/treino');
                  if (tab.id === 'staff') navigate('/team/staff');
                }}
                className={cn(
                  "px-4 py-1.5 md:px-6 md:py-2 font-display font-bold uppercase tracking-wider text-xs md:text-sm transition-all -skew-x-6 border whitespace-nowrap",
                  (tab.id === 'elenco' && location.pathname === '/team')
                    || (tab.id === 'tatica' && location.pathname === '/team/tatica')
                    || (tab.id === 'treino' && location.pathname === '/team/treino')
                    || (tab.id === 'staff' && location.pathname === '/team/staff')
                    ? "bg-neon-yellow text-black border-neon-yellow"
                    : "bg-dark-gray text-gray-400 border-white/10 hover:bg-white/10 hover:text-white"
                )}
              >
                <span className="skew-x-6 block flex items-center gap-2">
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left: Football Pitch */}
        <div className="w-full lg:w-1/2 shrink-0 lg:sticky lg:top-24 h-fit">
          <div className="sports-panel p-2 md:p-4 bg-black/40 border-white/10 relative">
            <div className="flex justify-between items-center mb-3 md:mb-4 px-2 md:px-0">
              <h3 className="font-display font-black uppercase tracking-wider text-base md:text-lg flex items-center gap-2">
                <Shield className="w-4 h-4 md:w-5 md:h-5 text-neon-yellow" /> Titulares
              </h3>
              <span className="text-[10px] md:text-xs font-bold text-gray-400 bg-black/50 px-2 py-1 rounded">
                {pitchSlots.filter((s) => lineup[s.id]).length} / {pitchSlots.length}
              </span>
            </div>

            {/* Pitch Graphic */}
            <div className="relative w-full max-w-[280px] md:max-w-md mx-auto aspect-[68/105] bg-[#0a2e15] border-2 md:border-4 border-white/20 rounded-lg overflow-hidden shadow-2xl">
              {/* Pitch Lines */}
              <div className="absolute inset-0 pointer-events-none opacity-40">
                {/* Grass pattern */}
                <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 10%, rgba(0,0,0,0.15) 10%, rgba(0,0,0,0.15) 20%)' }} />
                
                {/* Center Line */}
                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/60 -translate-y-1/2" />
                {/* Center Circle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[27.5%] aspect-square border-[2px] border-white/60 rounded-full" />
                {/* Center Dot */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/60 rounded-full" />
                
                {/* Top Penalty Box */}
                <div className="absolute top-0 left-[20.35%] right-[20.35%] h-[15.7%] border-[2px] border-t-0 border-white/60" />
                {/* Top Goal Box */}
                <div className="absolute top-0 left-[36.5%] right-[36.5%] h-[5.2%] border-[2px] border-t-0 border-white/60" />
                {/* Top Penalty Arc */}
                <div className="absolute top-[15.7%] left-1/2 -translate-x-1/2 w-[27.5%] aspect-square border-[2px] border-white/60 rounded-full -translate-y-1/2" style={{ clipPath: 'inset(50% 0 0 0)' }} />
                {/* Top Penalty Dot */}
                <div className="absolute top-[10.47%] left-1/2 -translate-x-1/2 w-1 h-1 md:w-1.5 md:h-1.5 bg-white/60 rounded-full" />

                {/* Bottom Penalty Box */}
                <div className="absolute bottom-0 left-[20.35%] right-[20.35%] h-[15.7%] border-[2px] border-b-0 border-white/60" />
                {/* Bottom Goal Box */}
                <div className="absolute bottom-0 left-[36.5%] right-[36.5%] h-[5.2%] border-[2px] border-b-0 border-white/60" />
                {/* Bottom Penalty Arc */}
                <div className="absolute bottom-[15.7%] left-1/2 -translate-x-1/2 w-[27.5%] aspect-square border-[2px] border-white/60 rounded-full translate-y-1/2" style={{ clipPath: 'inset(0 0 50% 0)' }} />
                {/* Bottom Penalty Dot */}
                <div className="absolute bottom-[10.47%] left-1/2 -translate-x-1/2 w-1 h-1 md:w-1.5 md:h-1.5 bg-white/60 rounded-full" />
              </div>

              {/* Player Slots */}
              {pitchSlots.map((slot) => (
                <div key={slot.id} className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={{ top: slot.top, left: slot.left }}>
                  {lineup[slot.id] ? (
                    <PitchPlayer player={lineup[slot.id]} onRemove={() => handleRemove(slot.id)} />
                  ) : (
                    <div 
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={cn(
                        "w-9 h-9 md:w-12 md:h-12 rounded-full border-2 border-dashed flex items-center justify-center backdrop-blur-sm cursor-pointer transition-all",
                        selectedSlotId === slot.id 
                          ? "border-neon-yellow bg-neon-yellow/20 text-neon-yellow scale-110 shadow-[0_0_15px_rgba(228,255,0,0.3)]" 
                          : "border-white/30 bg-black/20 text-white/40 hover:border-white/60 hover:text-white/80"
                      )}
                    >
                      <span className="font-black text-[9px] md:text-xs">{slot.label}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {saveBanner && (
                <motion.div
                  key={`${saveBanner.kind}-${saveBanner.text}`}
                  role="alert"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={cn(
                    'mt-3 md:mt-4 flex items-start gap-3 rounded-lg border px-3 py-2.5 md:px-4 md:py-3',
                    saveBanner.kind === 'error'
                      ? 'border-red-500/70 bg-red-950/80 text-red-100'
                      : 'border-neon-yellow/50 bg-neon-yellow/10 text-neon-yellow',
                  )}
                >
                  {saveBanner.kind === 'error' ? (
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                  ) : (
                    <Check className="w-5 h-5 shrink-0 mt-0.5 text-neon-yellow" strokeWidth={2.5} />
                  )}
                  <p className="flex-1 text-xs md:text-sm font-display font-bold uppercase tracking-wide leading-snug">
                    {saveBanner.text}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSaveBanner(null)}
                    className="shrink-0 p-1 rounded hover:bg-white/10 text-current opacity-80 hover:opacity-100"
                    aria-label="Fechar aviso"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Save Button */}
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full mt-3 md:mt-4 py-2.5 md:py-4 bg-neon-yellow text-black font-display font-black uppercase tracking-wider text-sm md:text-lg -skew-x-6 hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="skew-x-6 flex items-center justify-center gap-2">
                <Save className="w-4 h-4 md:w-5 md:h-5" />
                {isSaving ? 'Salvando...' : 'Salvar Titulares'}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Available Players (Horizontal Cards) */}
        <div className="w-full lg:w-1/2 flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-display font-black uppercase tracking-wider text-lg text-gray-400">
              Jogadores Disponíveis
            </h3>
            <span className="text-xs font-bold text-gray-500">{availablePlayers.length} Reservas</span>
          </div>
          
          <div className="space-y-3 lg:overflow-y-auto lg:pr-2 lg:max-h-[calc(100vh-16rem)]">
            <AnimatePresence>
              {availablePlayers.map((player) => (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    "flex bg-dark-gray border rounded-xl overflow-hidden h-24 md:h-28 transition-all hover:border-white/40 group",
                    player.style === 'neon-yellow' ? 'border-neon-yellow/50' : 'border-white/10'
                  )}
                >
                  {/* Left: Image & OVR */}
                  <div className="w-20 md:w-24 relative bg-black/60 flex-shrink-0 flex items-end justify-center pt-2 md:pt-4 border-r border-white/5">
                    <div className={cn(
                      "absolute inset-0 opacity-20",
                      player.style === 'neon-yellow' ? 'bg-neon-yellow' : 'bg-white'
                    )} />
                    <img 
                      src={playerPortraitSrc({ name: player.name, portraitUrl: player.portraitUrl }, 200, 300)} 
                      alt={player.name} 
                      className="w-[80%] h-[90%] object-cover object-top grayscale group-hover:grayscale-0 transition-all duration-300" 
                      referrerPolicy="no-referrer"
                      style={{ maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)' }}
                    />
                    <div className={cn(
                      "absolute top-1 left-1 md:top-2 md:left-2 px-1.5 py-0.5 rounded text-[10px] md:text-xs font-black drop-shadow-md",
                      player.style === 'neon-yellow' ? 'bg-neon-yellow text-black' : 'bg-black/80 text-white border border-white/20'
                    )}>
                      {player.ovr}
                    </div>
                  </div>

                  {/* Middle: Info */}
                  <div className="flex-1 p-2 md:p-3 flex flex-col justify-center relative min-w-0">
                    <div className="absolute top-2 right-2 md:right-3 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-black/40 px-1.5 md:px-2 py-0.5 md:py-1 rounded">
                      {player.pos}
                    </div>
                    <div className="font-display font-black text-lg md:text-xl italic uppercase tracking-wider text-white leading-none mb-1 truncate pr-8">
                      {player.name}
                    </div>
                    
                    {/* Stats */}
                    <div className="flex gap-2 md:gap-4 mt-1 md:mt-3">
                      <div className="flex flex-col">
                        <span className="text-[8px] md:text-[9px] text-gray-500 font-bold uppercase">PAC</span>
                        <span className="text-xs md:text-sm font-display font-bold text-white leading-none">{player.pac}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] md:text-[9px] text-gray-500 font-bold uppercase">SHO</span>
                        <span className="text-xs md:text-sm font-display font-bold text-white leading-none">{player.sho}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] md:text-[9px] text-gray-500 font-bold uppercase">PAS</span>
                        <span className="text-xs md:text-sm font-display font-bold text-white leading-none">{player.pas}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] md:text-[9px] text-gray-500 font-bold uppercase">FAT</span>
                        <span className="text-xs md:text-sm font-display font-bold text-white leading-none">{player.fatigue}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: CTA */}
                  <div className="w-16 md:w-32 flex items-center justify-center p-2 md:p-3 border-l border-white/5 bg-black/20">
                    <button 
                      onClick={() => handleEscalar(player)} 
                      className="w-full py-2 md:py-3 bg-white/10 hover:bg-neon-yellow hover:text-black text-white font-display font-bold uppercase tracking-wider text-[10px] md:text-sm -skew-x-6 transition-colors"
                    >
                      <span className="skew-x-6 block">Escalar</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {availablePlayers.length === 0 && (
              <div className="text-center py-12 text-gray-500 font-display font-bold text-xl">
                Todos os jogadores foram escalados.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Modal for Position Selection */}
      <AnimatePresence>
        {selectedSlotId && selectedSlot && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedSlotId(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-dark-gray border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] shadow-2xl"
            >
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                <h3 className="font-display font-black uppercase tracking-wider text-xl text-white flex items-center gap-2">
                  Escalar <span className="text-neon-yellow bg-neon-yellow/10 px-2 py-1 rounded border border-neon-yellow/20">{selectedSlot.label}</span>
                </h3>
                <button onClick={() => setSelectedSlotId(null)} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto space-y-3 bg-black/20">
                {modalPlayers.length > 0 ? (
                  modalPlayers.map((player) => (
                    <div
                      key={player.id}
                      className={cn(
                        "flex bg-dark-gray border rounded-xl overflow-hidden h-20 md:h-24 transition-all hover:border-white/40 group cursor-pointer",
                        player.style === 'neon-yellow' ? 'border-neon-yellow/50' : 'border-white/10'
                      )}
                      onClick={() => handleEscalarToSlot(player, selectedSlot.id)}
                    >
                      {/* Left: Image & OVR */}
                      <div className="w-16 md:w-20 relative bg-black/60 flex-shrink-0 flex items-end justify-center pt-2 border-r border-white/5">
                        <div className={cn(
                          "absolute inset-0 opacity-20",
                          player.style === 'neon-yellow' ? 'bg-neon-yellow' : 'bg-white'
                        )} />
                        <img 
                          src={playerPortraitSrc({ name: player.name, portraitUrl: player.portraitUrl }, 200, 300)} 
                          alt={player.name} 
                          className="w-[80%] h-[90%] object-cover object-top grayscale group-hover:grayscale-0 transition-all duration-300" 
                          referrerPolicy="no-referrer"
                          style={{ maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)' }}
                        />
                        <div className={cn(
                          "absolute top-1 left-1 px-1 md:px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-black drop-shadow-md",
                          player.style === 'neon-yellow' ? 'bg-neon-yellow text-black' : 'bg-black/80 text-white border border-white/20'
                        )}>
                          {player.ovr}
                        </div>
                      </div>

                      {/* Middle: Info */}
                      <div className="flex-1 p-2 md:p-3 flex flex-col justify-center relative min-w-0">
                        <div className="font-display font-black text-base md:text-lg italic uppercase tracking-wider text-white leading-none mb-1 truncate">
                          {player.name}
                        </div>
                        
                        {/* Stats */}
                        <div className="flex gap-2 md:gap-4 mt-1 md:mt-2">
                          <div className="flex flex-col">
                            <span className="text-[7px] md:text-[8px] text-gray-500 font-bold uppercase">PAC</span>
                            <span className="text-[10px] md:text-xs font-display font-bold text-white leading-none">{player.pac}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[7px] md:text-[8px] text-gray-500 font-bold uppercase">SHO</span>
                            <span className="text-[10px] md:text-xs font-display font-bold text-white leading-none">{player.sho}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[7px] md:text-[8px] text-gray-500 font-bold uppercase">PAS</span>
                            <span className="text-[10px] md:text-xs font-display font-bold text-white leading-none">{player.pas}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[7px] md:text-[8px] text-gray-500 font-bold uppercase">FAT</span>
                            <span className="text-[10px] md:text-xs font-display font-bold text-white leading-none">{player.fatigue}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: CTA */}
                      <div className="w-16 md:w-28 flex items-center justify-center p-2 border-l border-white/5 bg-black/20 group-hover:bg-neon-yellow transition-colors">
                        <span className="font-display font-bold uppercase tracking-wider text-[9px] md:text-xs text-white group-hover:text-black -skew-x-6">
                          <span className="skew-x-6 block">Escalar</span>
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 flex flex-col items-center justify-center">
                    <p className="text-gray-400 font-display font-bold text-lg mb-6">
                      Nenhum jogador disponível para a posição {selectedSlot.label}.
                    </p>
                    <button 
                      onClick={() => navigate('/transfer')}
                      className="px-8 py-3 bg-neon-yellow text-black font-display font-bold uppercase tracking-wider text-sm -skew-x-6 hover:bg-white transition-colors"
                    >
                      <span className="skew-x-6 block">Ir para Mercado</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: formações disponíveis no jogo */}
      <AnimatePresence>
        {formationModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setFormationModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-gray border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                <h3 className="font-display font-black uppercase tracking-wider text-sm md:text-base text-white flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-neon-yellow shrink-0" />
                  Formações disponíveis
                </h3>
                <button
                  type="button"
                  onClick={() => setFormationModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-3 md:p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FORMATION_SCHEME_LIST.map((id) => {
                  const groups = SCHEME_LINE_GROUPS[id];
                  const linesLabel = `${groups.def.length}-${groups.mid.length}-${groups.att.length}`;
                  const selected = formationScheme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        dispatch({ type: 'SET_MANAGER_SLIDERS', partial: { formationScheme: id } });
                        setFormationModalOpen(false);
                      }}
                      className={cn(
                        'relative text-left rounded-lg border px-3 py-2.5 transition-colors',
                        selected
                          ? 'border-neon-yellow bg-neon-yellow/15 text-white'
                          : 'border-white/10 bg-black/30 hover:border-white/25 hover:bg-white/5 text-white',
                      )}
                    >
                      {selected && (
                        <span className="absolute top-1.5 right-1.5 text-neon-yellow">
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                        </span>
                      )}
                      <span className="font-display font-black text-sm tracking-tight block pr-5">{id}</span>
                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-0.5 block">
                        Linhas {linesLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PitchPlayer({ player, onRemove }: { player: any, onRemove: () => void }) {
  return (
    <motion.div 
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      onClick={onRemove} 
      className="relative group cursor-pointer flex flex-col items-center"
    >
      <div className={cn(
        "w-9 h-9 md:w-12 md:h-12 rounded-full bg-dark-gray border-2 overflow-hidden relative shadow-lg",
        player.style === 'neon-yellow' ? 'border-neon-yellow' : 'border-white'
      )}>
        <img src={playerPortraitSrc({ name: player.name, portraitUrl: player.portraitUrl }, 100, 100)} alt={player.name} className="w-full h-full object-cover object-top" referrerPolicy="no-referrer" />
      </div>
      
      <div className="bg-black/90 px-1 md:px-1.5 py-0.5 rounded text-[8px] md:text-[10px] font-bold text-white mt-1 border border-white/20 whitespace-nowrap drop-shadow-md">
        {player.name}
      </div>
      
      <div className={cn(
        "absolute -top-1 -right-1 md:-top-2 md:-right-2 text-[7px] md:text-[9px] font-black w-4 h-4 md:w-5 md:h-5 flex items-center justify-center rounded-full shadow-md",
        player.style === 'neon-yellow' ? 'bg-neon-yellow text-black' : 'bg-white text-black'
      )}>
        {player.ovr}
      </div>
      
      {/* Hover overlay to remove */}
      <div className="absolute top-0 left-0 w-9 h-9 md:w-12 md:h-12 bg-red-500/80 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
        <X className="w-4 h-4 md:w-5 md:h-5 text-white" />
      </div>
    </motion.div>
  );
}
