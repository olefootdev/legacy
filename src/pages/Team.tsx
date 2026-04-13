import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Brain,
  Dumbbell,
  UserPlus,
  X,
  Save,
  Shield,
  LayoutGrid,
  Check,
  AlertCircle,
  Sparkles,
  FlaskConical,
  Megaphone,
} from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes, playerToCardView } from '@/entities/player';
import { FORMATION_SCHEME_LIST, SCHEME_LINE_GROUPS, pitchUiSlots } from '@/match-engine/formations/catalog';
import { suggestBestLineup } from '@/team/suggestBestLineup';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';
import { ManagerCreatePlayerModal } from '@/components/ManagerCreatePlayerModal';

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
  const [createProspectOpen, setCreateProspectOpen] = useState(false);
  /** Feedback visível no painel (substitui alert nativo). */
  const [saveBanner, setSaveBanner] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [announcePlayer, setAnnouncePlayer] = useState<CardPlayer | null>(null);
  const [announcePrice, setAnnouncePrice] = useState('180000');

  useEffect(() => {
    if (lineupDirty) {
      setLineup((prev) => {
        const next: Record<string, CardPlayer> = {};
        for (const [slot, card] of Object.entries(prev) as [string, CardPlayer][]) {
          const pl = playersById[card.id];
          if (pl && !pl.listedOnMarket) next[slot] = { ...playerToCardView(pl, maxOvr), id: pl.id };
        }
        return next;
      });
      return;
    }
    const next: Record<string, CardPlayer> = {};
    for (const [slot, pid] of Object.entries(lineupSaved)) {
      const pl = playersById[pid];
      if (pl && !pl.listedOnMarket) next[slot] = { ...playerToCardView(pl, maxOvr), id: pl.id };
    }
    setLineup(next);
  }, [lineupSaved, playersById, maxOvr, lineupDirty]);

  const lineupPlayerIds = Object.values(lineup)
    .filter((p): p is CardPlayer => Boolean(p))
    .map((p) => p.id);
  const availablePlayers = rosterCards.filter((p) => {
    const ent = playersById[p.id];
    return (
      !lineupPlayerIds.includes(p.id) &&
      ent &&
      ent.outForMatches <= 0 &&
      !ent.listedOnMarket
    );
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

  const handleSuggestLineup = () => {
    setSaveBanner(null);
    const squad = Object.values(playersById).map((p) => ({
      id: p.id,
      pos: p.pos,
      ovr: overallFromAttributes(p.attrs),
      outForMatches: p.outForMatches,
    }));
    const res = suggestBestLineup(pitchSlots, squad);
    if ('error' in res) {
      setSaveBanner({ kind: 'error', text: res.error });
      return;
    }
    const next: Record<string, CardPlayer> = {};
    for (const slot of pitchSlots) {
      const pid = res.slotToPlayerId[slot.id];
      const pl = playersById[pid];
      if (pl) next[slot.id] = { ...playerToCardView(pl, maxOvr), id: pl.id };
    }
    setLineupDirty(true);
    setLineup(next);
    setSelectedSlotId(null);
    setSaveBanner({ kind: 'success', text: res.note });
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

  const handleConfirmAnnounce = () => {
    if (!announcePlayer) return;
    const raw = Number(String(announcePrice).replace(',', '.'));
    const n = Number.isFinite(raw) ? Math.round(raw) : 180_000;
    if (n < 50_000 || n > 5_000_000) {
      setSaveBanner({
        kind: 'error',
        text: 'Preço EXP inválido. Usa entre 50 000 e 5 000 000.',
      });
      return;
    }
    const ent = playersById[announcePlayer.id];
    if (!ent || ent.listedOnMarket) {
      setAnnouncePlayer(null);
      return;
    }
    const name = announcePlayer.name;
    dispatch({ type: 'LIST_MANAGER_PROSPECT', playerId: announcePlayer.id, priceExp: n });
    setAnnouncePlayer(null);
    setAnnouncePrice('180000');
    setSaveBanner({
      kind: 'success',
      text: `${name} anunciado no Mercado EXP. Retira o anúncio em Mercado → cartão do jogador.`,
    });
  };

  const tabs = [
    { id: 'elenco', label: 'ELENCO', icon: Users },
    { id: 'tatica', label: 'TÁTICA', icon: Brain },
    { id: 'treino', label: 'TREINO', icon: Dumbbell },
    { id: 'staff', label: 'STAFF', icon: UserPlus },
    { id: 'ailabs', label: 'AI LABS', icon: FlaskConical },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4 overflow-x-hidden pb-8 md:space-y-8">
      {/* Header & Tabs */}
      <div className="relative rounded-xl">
        <GameBannerBackdrop slot="team_header" imageOpacity={0.35} />
        <div className="relative z-10 flex min-w-0 flex-col items-start justify-between gap-3 px-1 pb-1 md:flex-row md:items-end md:gap-4 md:px-2 md:pb-2">
          <div className="min-w-0">
            <h2 className="text-2xl md:text-4xl font-display font-black italic uppercase tracking-wider">Plantel Principal</h2>
            <p className="text-[10px] md:text-sm text-gray-400 font-medium mt-0.5 md:mt-1">
              Temporada 2026 •{' '}
              <span className="text-white/90 font-semibold">{formationScheme}</span>
              <span className="text-gray-500"> tático</span>
            </p>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFormationModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-[9px] md:text-[10px] font-display font-bold uppercase tracking-widest text-neon-yellow/90 hover:text-neon-yellow border border-neon-yellow/25 bg-neon-yellow/5 hover:bg-neon-yellow/10 px-2 py-1 rounded-sm -skew-x-6 transition-colors"
              >
                <span className="skew-x-6 inline-flex items-center gap-1">
                  <LayoutGrid className="w-3 h-3 shrink-0 opacity-90" />
                  Escolher formação
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCreateProspectOpen(true)}
                className="inline-flex items-center gap-1.5 text-[9px] md:text-[10px] font-display font-bold uppercase tracking-widest text-white/90 hover:text-white border border-white/20 bg-white/5 hover:bg-white/10 px-2 py-1 rounded-sm -skew-x-6 transition-colors"
              >
                <span className="skew-x-6 inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 shrink-0 text-neon-yellow opacity-90" />
                  Criar jogador
                </span>
              </button>
            </div>
          </div>

          <div className="hide-scrollbar flex min-w-0 w-full gap-2 overflow-x-auto pb-2 md:w-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'elenco') navigate('/team');
                  if (tab.id === 'tatica') navigate('/team/tatica');
                  if (tab.id === 'treino') navigate('/team/treino');
                  if (tab.id === 'staff') navigate('/team/staff');
                  if (tab.id === 'ailabs') navigate('/team/ailabs');
                }}
                className={cn(
                  'shrink-0 whitespace-nowrap border px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider transition-all [-webkit-tap-highlight-color:transparent] -skew-x-6 sm:px-4 sm:text-xs md:px-6 md:py-2 md:text-sm',
                  (tab.id === 'elenco' && location.pathname === '/team')
                    || (tab.id === 'tatica' && location.pathname === '/team/tatica')
                    || (tab.id === 'treino' && location.pathname === '/team/treino')
                    || (tab.id === 'staff' && location.pathname === '/team/staff')
                    || (tab.id === 'ailabs' && location.pathname === '/team/ailabs')
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

      {/*
        `items-stretch` (não `items-start`): em coluna, filhos ocupam 100% da largura útil — evita largura
        “auto” por conteúdo maior que o viewport e overflow cortado à direita no mobile.
      */}
      <div className="flex w-full min-w-0 max-w-full flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Left: Football Pitch */}
        <div className="h-fit w-full min-w-0 max-w-full shrink-0 lg:sticky lg:top-24 lg:w-1/2">
          <div className="sports-panel relative box-border w-full min-w-0 max-w-full overflow-x-hidden border-white/10 bg-black/40 px-1.5 py-2 sm:px-2 sm:py-2 md:p-4">
            {/* Largura do relvado: sempre ≤ largura do painel; `mx-auto` centra o bloco no ecrã estreito. */}
            <div className="mx-auto w-full min-w-0 max-w-[min(100%,17.5rem)] md:max-w-md">
              <div className="mb-2 flex w-full min-w-0 items-center justify-between gap-2 px-0.5 sm:mb-3 md:mb-4 md:px-0">
                <h3 className="flex min-w-0 flex-1 items-center gap-1 font-display text-xs font-black uppercase tracking-wider sm:gap-1.5 sm:text-sm md:gap-2 md:text-base lg:text-lg">
                  <Shield className="h-3.5 w-3.5 shrink-0 text-neon-yellow sm:h-4 sm:w-4 md:h-[1.1rem] md:w-[1.1rem] lg:h-5 lg:w-5" aria-hidden />
                  <span className="min-w-0 truncate">Titulares</span>
                </h3>
                <button
                  type="button"
                  onClick={handleSuggestLineup}
                  title="Sugerir escalação (GameSpirit)"
                  aria-label="Sugerir escalação (GameSpirit)"
                  className="inline-flex h-8 shrink-0 touch-manipulation items-center justify-center gap-1 rounded border border-neon-yellow/40 bg-neon-yellow/10 px-2 font-display text-[8px] font-black uppercase leading-none tracking-wider text-neon-yellow transition-colors [-webkit-tap-highlight-color:transparent] hover:bg-neon-yellow/20 sm:h-8 sm:px-2.5 sm:text-[9px] md:h-9 md:px-3 md:text-[10px]"
                >
                  <Sparkles className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" aria-hidden />
                  <span className="whitespace-nowrap">Sugerir</span>
                </button>
              </div>

              {/* Pitch: `min-w-0` + `max-w-full` garantem que a caixa de aspeto nunca força overflow horizontal. */}
              <div className="relative aspect-[68/105] w-full min-w-0 max-w-full overflow-hidden rounded-md border border-white/25 bg-[#0a2e15] shadow-lg shadow-black/40 sm:rounded-lg sm:border-2 sm:shadow-2xl md:rounded-lg md:border-4 md:border-white/20 md:shadow-2xl">
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
                        'flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed backdrop-blur-sm transition-all sm:size-8 md:size-12 md:border-2',
                        selectedSlotId === slot.id 
                          ? 'border-neon-yellow bg-neon-yellow/20 text-neon-yellow shadow-[0_0_15px_rgba(228,255,0,0.3)] sm:scale-110' 
                          : "border-white/30 bg-black/20 text-white/40 hover:border-white/60 hover:text-white/80"
                      )}
                    >
                      <span className="font-black text-[7px] sm:text-[8px] md:text-xs">{slot.label}</span>
                    </div>
                  )}
                </div>
              ))}
              </div>
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
                  <p className="min-w-0 flex-1 break-words text-xs font-display font-bold uppercase leading-snug tracking-wide md:text-sm">
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

            {/* Save: sem skew no xs — skew + overflow-x-hidden do painel cortava a direita em mobile. */}
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="mt-2 box-border w-full min-w-0 max-w-full bg-neon-yellow py-2 font-display text-xs font-black uppercase tracking-wider text-black transition-all [-webkit-tap-highlight-color:transparent] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:mt-3 sm:-skew-x-6 sm:py-2.5 sm:text-sm md:mt-4 md:py-4 md:text-lg"
            >
              <span className="flex items-center justify-center gap-1.5 sm:skew-x-6 sm:gap-2">
                <Save className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                {isSaving ? 'Salvando...' : 'Salvar Titulares'}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Available Players (Horizontal Cards) */}
        <div className="flex min-w-0 w-full max-w-full flex-col gap-4 lg:w-1/2">
          <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h3 className="min-w-0 truncate font-display text-base font-black uppercase tracking-wider text-gray-400 sm:text-lg">
              Jogadores Disponíveis
            </h3>
            <span className="shrink-0 text-xs font-bold text-gray-500">{availablePlayers.length} Reservas</span>
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
                    <div className="absolute top-2 right-2 md:right-3 flex max-w-[calc(100%-3rem)] items-center gap-1 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-black/40 px-1.5 md:px-2 py-0.5 md:py-1 rounded">
                      {player.countryFlagEmoji ? (
                        <span className="text-sm leading-none" title={player.country ?? undefined} aria-hidden>
                          {player.countryFlagEmoji}
                        </span>
                      ) : null}
                      <span>{player.pos}</span>
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

                  {/* Right: ESCALAR + ANUNCIAR (mercado EXP — mesmo fluxo que /transfer) */}
                  <div className="flex w-[6.75rem] shrink-0 flex-col items-stretch justify-center gap-1.5 border-l border-white/5 bg-black/20 p-1.5 sm:w-[7.5rem] md:w-[8.25rem] md:p-2">
                    <button
                      type="button"
                      onClick={() => handleEscalar(player)}
                      className="w-full rounded-sm bg-white/10 py-2 font-display text-[9px] font-bold uppercase tracking-wider text-white transition-colors [-webkit-tap-highlight-color:transparent] hover:bg-neon-yellow hover:text-black sm:py-2.5 sm:text-[10px] sm:max-md:-skew-x-6 md:text-[11px]"
                    >
                      <span className="block sm:max-md:skew-x-6">Escalar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSaveBanner(null);
                        setAnnouncePrice('180000');
                        setAnnouncePlayer(player);
                      }}
                      className="flex w-full items-center justify-center gap-1 rounded-sm border border-neon-yellow/35 bg-neon-yellow/10 py-2 font-display text-[9px] font-bold uppercase tracking-wider text-neon-yellow transition-colors [-webkit-tap-highlight-color:transparent] hover:bg-neon-yellow/20 sm:py-2.5 sm:text-[10px] md:text-[11px]"
                    >
                      <Megaphone className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                      <span>Anunciar</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {availablePlayers.length === 0 && (
              <div className="text-center py-12 text-gray-500 font-display font-bold text-xl">
                Sem reservas aqui — titulares completos ou jogadores no mercado EXP.
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
            className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setSelectedSlotId(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-dark-gray shadow-2xl max-h-[min(85dvh,calc(100dvh-6rem))] sm:max-h-[80vh]"
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
                        <div className="flex items-center gap-1.5 pr-2">
                          {player.countryFlagEmoji ? (
                            <span className="shrink-0 text-base leading-none" title={player.country ?? undefined} aria-hidden>
                              {player.countryFlagEmoji}
                            </span>
                          ) : null}
                          <div className="min-w-0 flex-1 font-display font-black text-base md:text-lg italic uppercase tracking-wider text-white leading-none truncate">
                            {player.name}
                          </div>
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
            className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setFormationModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-dark-gray shadow-2xl max-h-[min(88dvh,calc(100dvh-6rem))] sm:max-h-[85vh]"
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

      <AnimatePresence>
        {announcePlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setAnnouncePlayer(null)}
            role="presentation"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="my-auto w-full max-w-md overflow-hidden rounded-2xl border border-neon-yellow/25 bg-dark-gray shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="announce-market-title"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-3">
                <div className="min-w-0">
                  <h3
                    id="announce-market-title"
                    className="font-display text-lg font-black uppercase tracking-wide text-white"
                  >
                    Anunciar no mercado
                  </h3>
                  <p className="mt-1 truncate text-sm font-bold text-neon-yellow">{announcePlayer.name}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
                    Preço em EXP (50k–5M). O jogador sai da escalação e aparece nas vitrines do{' '}
                    <Link to="/transfer" className="text-neon-yellow/90 underline-offset-2 hover:underline">
                      Mercado
                    </Link>
                    .
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAnnouncePlayer(null)}
                  className="shrink-0 rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4 p-4">
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Preço EXP</span>
                  <input
                    type="number"
                    min={50_000}
                    max={5_000_000}
                    value={announcePrice}
                    onChange={(e) => setAnnouncePrice(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2.5 font-display text-sm font-bold text-white outline-none focus:border-neon-yellow"
                  />
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setAnnouncePlayer(null)}
                    className="rounded-lg border border-white/20 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-gray-300 hover:bg-white/5 sm:px-4"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAnnounce}
                    className="rounded-lg border border-neon-yellow/50 bg-neon-yellow/15 py-2.5 font-display text-xs font-black uppercase tracking-wider text-neon-yellow hover:bg-neon-yellow/25 sm:px-4"
                  >
                    Confirmar anúncio
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ManagerCreatePlayerModal open={createProspectOpen} onClose={() => setCreateProspectOpen(false)} />
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
        'relative size-7 overflow-hidden rounded-full border bg-dark-gray shadow-lg sm:size-8 md:size-12 md:border-2',
        player.style === 'neon-yellow' ? 'border-neon-yellow' : 'border-white'
      )}>
        {player.countryFlagEmoji ? (
          <span
            className="absolute bottom-0 left-0 z-[5] rounded-sm bg-black/70 px-[1px] text-[7px] leading-none sm:text-[8px] md:text-[11px]"
            title={player.country ?? undefined}
            aria-hidden
          >
            {player.countryFlagEmoji}
          </span>
        ) : null}
        <img src={playerPortraitSrc({ name: player.name, portraitUrl: player.portraitUrl }, 100, 100)} alt={player.name} className="h-full w-full object-cover object-top" referrerPolicy="no-referrer" />
      </div>
      
      <div className="mt-0.5 max-w-[min(4.5rem,22vw)] truncate rounded border border-white/20 bg-black/90 px-0.5 py-0.5 text-[7px] font-bold text-white drop-shadow-md sm:mt-1 sm:max-w-[5.5rem] sm:px-1 sm:text-[8px] md:max-w-[6.5rem] md:px-1.5 md:text-[10px]">
        {player.name}
      </div>
      
      <div className={cn(
        'absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full text-[6px] font-black shadow-md sm:-right-1 sm:-top-1 sm:size-4 sm:text-[7px] md:-right-2 md:-top-2 md:size-5 md:text-[9px]',
        player.style === 'neon-yellow' ? 'bg-neon-yellow text-black' : 'bg-white text-black'
      )}>
        {player.ovr}
      </div>
      
      {/* Hover overlay to remove */}
      <div className="absolute left-0 top-0 flex size-7 items-center justify-center rounded-full bg-red-500/80 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 sm:size-8 md:size-12">
        <X className="h-3 w-3 text-white sm:h-3.5 sm:w-3.5 md:h-5 md:w-5" />
      </div>
    </motion.div>
  );
}
