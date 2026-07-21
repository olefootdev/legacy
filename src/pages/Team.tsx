import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Save,
  Shield,
  LayoutGrid,
  Check,
  AlertCircle,
  Sparkles,
  Megaphone,
  Heart,
  Info,
  Scale,
  Orbit,
  Flame,
  Zap,
  StretchHorizontal,
  ArrowUpRight,
  Target,
  Crosshair,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { playerPortraitSrc, playerDisplayName } from '@/lib/playerPortrait';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes, playerToCardView, samePersonKey } from '@/entities/player';
import { FORMATION_SCHEME_LIST, SCHEME_LINE_GROUPS, pitchUiSlots } from '@/match-engine/formations/catalog';
import {
  PRESET_LABEL_PT,
  PRESET_DESCRIPTION_PT,
  type PlayingStylePresetId,
} from '@/tactics/playingStyle';

const PRESET_IDS: readonly PlayingStylePresetId[] = [
  'balanced',
  'POSSE_CONTROLADA',
  'PRESSAO_ALTA',
  'TRANSICAO_RAPIDA',
  'BLOCO_BAIXO',
  'JOGO_PELAS_LATERAIS',
  'JOGO_DIRETO',
  'CRIATIVO_LIVRE',
];

const PRESET_ICONS: Record<PlayingStylePresetId, LucideIcon> = {
  balanced: Scale,
  POSSE_CONTROLADA: Orbit,
  PRESSAO_ALTA: Flame,
  TRANSICAO_RAPIDA: Zap,
  BLOCO_BAIXO: Shield,
  JOGO_PELAS_LATERAIS: StretchHorizontal,
  JOGO_DIRETO: ArrowUpRight,
  CRIATIVO_LIVRE: Sparkles,
};
import { suggestBestLineup } from '@/team/suggestBestLineup';
import { GachaCreatePlayerModal } from '@/components/GachaCreatePlayerModal';
import { AcademyCardDeliveryModal } from '@/components/AcademyCardDeliveryModal';
import { TeamPlayerSeasonSheet } from '@/team/TeamPlayerSeasonSheet';
import { TeamMeuTimeHeader } from '@/pages/TeamMeuTimeHeader';
import { useTrackScreen, trackMissionEvent } from '@/progression/trackEvent';
import { BackButton } from '@/components/BackButton';
import { PlayerConsequencesBadge } from '@/components/olefoot-python-mode/PlayerConsequencesBadge';
import { PlayerStatusBadge } from '@/components/player/PlayerStatusBadge';
import { calcMarketMakerOffer, marketMakerDiscountLabel } from '@/market/marketMaker';
import {
  countActiveAcademyProspects,
  MAX_ACTIVE_ACADEMY_PROSPECTS,
} from '@/entities/managerProspect';
import { formatExp } from '@/systems/economy';
import { recordMarketActivity } from '@/supabase/marketActivities';
import { getSupabase } from '@/supabase/client';

type CardPlayer = ReturnType<typeof playerToCardView> & { id: string };

export function Team() {
  useTrackScreen('screen_team');
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const playersById = useGameStore((s) => s.players);
  const playerHealth = useGameStore((s) => s.playerHealth);
  const lineupSaved = useGameStore((s) => s.lineup);
  const formationScheme = useGameStore((s) => s.manager.formationScheme);
  const tacticalStyle = useGameStore((s) => s.manager.tacticalStyle);
  const club = useGameStore((s) => s.club);
  const currentPresetId: PlayingStylePresetId = tacticalStyle?.presetId ?? 'balanced';
  const favoriteRealTeam = useGameStore((s) => s.userSettings.favoriteRealTeam);
  const inbox = useGameStore((s) => s.inbox);

  // ?academyDelivery=<requestId> abre o modal de entrega da carta da Academia.
  // Vem do deepLink da inbox notification ACADEMY_CARD_DELIVERED.
  const deliveryRequestId = searchParams.get('academyDelivery');
  const deliveryItem = useMemo(() => {
    if (!deliveryRequestId) return null;
    const expectedId = `academy-delivery-${deliveryRequestId}`;
    return inbox.find((i) => i.id === expectedId && i.academy) ?? null;
  }, [deliveryRequestId, inbox]);
  const closeDeliveryModal = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('academyDelivery');
    setSearchParams(next, { replace: true });
  };

  const maxOvr = useMemo(() => {
    const vals = Object.values(playersById);
    if (!vals.length) return 88;
    return Math.max(...vals.map((p) => overallFromAttributes(p.attrs, p.pos)));
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
  const [pendingFormation, setPendingFormation] = useState(formationScheme);
  const [pendingPreset, setPendingPreset] = useState<PlayingStylePresetId>(currentPresetId);
  const [presetInfoId, setPresetInfoId] = useState<PlayingStylePresetId | null>(null);
  const [createProspectOpen, setCreateProspectOpen] = useState(false);
  /** Feedback visível no painel (substitui alert nativo). */
  const [saveBanner, setSaveBanner] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [announcePlayer, setAnnouncePlayer] = useState<CardPlayer | null>(null);
  /** Ficha temporada / evolução (clique no token ou no cartão). */
  const [sheetPlayerId, setSheetPlayerId] = useState<string | null>(null);
  /** Sprint B-3: menu de ações ao clicar num token do campo (Substituir/Skill/Anunciar). */
  const [pitchMenu, setPitchMenu] = useState<{ slotId: string; player: CardPlayer } | null>(null);

  // ?player=<id> abre a ficha do jogador (deep-link das notificações de contrato).
  useEffect(() => {
    const pid = searchParams.get('player');
    if (!pid || !playersById[pid]) return;
    setSheetPlayerId(pid);
    const next = new URLSearchParams(searchParams);
    next.delete('player');
    setSearchParams(next, { replace: true });
  }, [searchParams, playersById, setSearchParams]);

  useEffect(() => {
    // GUARDA (fix mobile "slots vazios após salvar"): se o ELENCO ainda não
    // hidratou (playersById vazio — comum em celular no cold load, quando a tela
    // renderiza antes do Supabase/localStorage popular os players), NÃO zera a
    // escalação. Sem isso, cada `playersById[pid]` vira undefined e todos os
    // slots são descartados → campo vazio mesmo com lineup salvo. O effect
    // re-roda sozinho quando `players` carrega (é dependência).
    if (Object.keys(playersById).length === 0) return;
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

  /** Soma dos OVR dos titulares (força combinada do XI) + média para leitura rápida. */
  const startersStrength = useMemo(() => {
    const starters = pitchSlots
      .map((s) => lineup[s.id])
      .filter((p): p is CardPlayer => Boolean(p));
    if (!starters.length) return { sum: 0, avg: 0, count: 0, full: false };
    const sum = starters.reduce((acc, p) => acc + p.ovr, 0);
    const avg = sum / starters.length;
    return {
      sum,
      avg,
      count: starters.length,
      full: starters.length === pitchSlots.length,
    };
  }, [lineup, pitchSlots]);
  const availablePlayers = rosterCards.filter((p) => {
    const ent = playersById[p.id];
    if (!ent || lineupPlayerIds.includes(p.id) || ent.listedOnMarket) return false;
    const h = playerHealth?.[p.id];
    if (h) return h.outForMatches <= 0 && h.suspendedMatches <= 0;
    return ent.outForMatches <= 0;
  });
  
  const selectedSlot = pitchSlots.find((s) => s.id === selectedSlotId);
  const modalPlayers = selectedSlot 
    ? availablePlayers.filter(p => p.pos === selectedSlot.label)
    : [];

  // Regra: não escalar duas variações da MESMA pessoa ao mesmo tempo.
  // Retorna o slot onde a pessoa já está (ignorando `exceptSlot`), ou null.
  const personAlreadyStarting = (player: CardPlayer, exceptSlot?: string): string | null => {
    const key = samePersonKey(player);
    for (const [sid, pl] of Object.entries(lineup)) {
      if (sid === exceptSlot) continue;
      if (pl && samePersonKey(pl) === key) return sid;
    }
    return null;
  };

  const handleEscalarToSlot = (player: CardPlayer, slotId: string) => {
    if (personAlreadyStarting(player, slotId)) {
      setSaveBanner({ kind: 'error', text: `${player.name} já está escalado. Só pode 1 ${player.name} em campo por vez.` });
      return;
    }
    setSaveBanner(null);
    setLineupDirty(true);
    setLineup((prev) => ({ ...prev, [slotId]: player }));
    setSelectedSlotId(null);
  };

  const handleEscalar = (player: CardPlayer) => {
    if (personAlreadyStarting(player)) {
      setSaveBanner({ kind: 'error', text: `${player.name} já está escalado. Só pode 1 ${player.name} em campo por vez.` });
      return;
    }
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
      ovr: overallFromAttributes(p.attrs, p.pos),
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
    setLineup(next);
    setLineupDirty(true);
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
    trackMissionEvent('lineup_saved');
    setLineupDirty(false);
    setTimeout(() => {
      setIsSaving(false);
      setSaveBanner({ kind: 'success', text: 'Escalação salva com sucesso.' });
    }, 400);
  };

  const handleMarketMakerAccept = async () => {
    if (!announcePlayer) return;
    const ent = playersById[announcePlayer.id];
    if (!ent) { setAnnouncePlayer(null); return; }
    const offerExp = calcMarketMakerOffer(ent);
    const name = announcePlayer.name;
    dispatch({ type: 'MARKET_MAKER_ACCEPT', playerId: announcePlayer.id, offerExp });
    setAnnouncePlayer(null);
    setSaveBanner({ kind: 'success', text: `Market Maker comprou ${name} por ${formatExp(offerExp)} EXP` });
    // Salvar no Supabase (fire-and-forget)
    const sb = getSupabase();
    if (sb) {
      const { data: { session } } = await sb.auth.getSession();
      void sb.from('market_maker_inventory').insert({
        player_snapshot: ent as unknown as Record<string, unknown>,
        player_name: ent.name,
        player_pos: ent.pos,
        player_ovr: overallFromAttributes(ent.attrs, ent.pos),
        purchase_price_exp: offerExp,
        seller_manager_id: session?.user?.id ?? null,
        seller_club_name: club.name,
      });
    }
    void recordMarketActivity({
      type: 'sale',
      managerId: null,
      managerName: club.name,
      clubName: club.name,
      playerName: name,
      playerOvr: overallFromAttributes(ent.attrs, ent.pos),
      playerPos: ent.pos,
      priceExp: offerExp,
    });
  };

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden pb-8">
      <div className="w-full max-w-6xl min-w-0 mx-auto px-3 sm:px-4 lg:px-8 space-y-4 md:space-y-8">
      <BackButton to="/clube" label="Clube" />
      <div data-tutorial-anchor="team-hero">
      <TeamMeuTimeHeader
        title="Plantel Principal"
        customHero={
          <PlantelHero
            clubName={club.name}
            clubShort={club.shortName}
            formation={formationScheme}
            squadSize={Object.keys(playersById).length}
            startersCount={startersStrength.count}
            startersCap={pitchSlots.length}
            xiAvgOverall={startersStrength.avg}
            favoriteRealTeamName={favoriteRealTeam?.name}
            onChooseFormation={() => {
              setPendingFormation(formationScheme);
              setPendingPreset(currentPresetId);
              setPresetInfoId(null);
              setFormationModalOpen(true);
            }}
            onCreatePlayer={() => setCreateProspectOpen(true)}
            academyUsed={countActiveAcademyProspects(playersById)}
            academyCap={MAX_ACTIVE_ACADEMY_PROSPECTS}
          />
        }
      />
      </div>

      {/*
        `items-stretch` (não `items-start`): em coluna, filhos ocupam 100% da largura útil — evita largura
        “auto” por conteúdo maior que o viewport e overflow cortado à direita no mobile.
      */}
      <div className="flex w-full min-w-0 max-w-full flex-col gap-4 sm:gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Left: Football Pitch — Sprint B-3: campo maior, tokens mais visíveis */}
        <div className="h-fit w-full min-w-0 max-w-full shrink-0 lg:sticky lg:top-24 lg:w-[55%]">
          <div className="sports-panel relative box-border w-full min-w-0 max-w-full overflow-x-hidden border-white/10 bg-black/40 px-2 py-3 sm:px-3 sm:py-4 md:p-5">
            {/* Largura do relvado bumped (Sprint B-3): mobile 22rem, md 32rem, lg 40rem */}
            <div className="mx-auto w-full min-w-0 max-w-[min(100%,22rem)] sm:max-w-[28rem] md:max-w-[32rem] lg:max-w-[40rem]">
              <div className="mb-2 flex w-full min-w-0 items-center justify-between gap-2 px-0.5 sm:mb-3 md:mb-4 md:px-0">
                <h3 className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span aria-hidden className="shrink-0 w-[3px] h-5 sm:h-6 bg-neon-yellow" />
                  <span
                    className="min-w-0 truncate text-neon-yellow uppercase"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                    }}
                  >
                    Titulares
                  </span>
                </h3>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={handleSuggestLineup}
                    title="Sugerir escalação (GameSpirit)"
                    aria-label="Sugerir escalação"
                    className="inline-flex h-9 shrink-0 touch-manipulation items-center justify-center rounded border border-neon-yellow/40 bg-neon-yellow/10 px-3 font-display text-[10px] font-black uppercase leading-none tracking-[0.2em] text-neon-yellow transition-colors [-webkit-tap-highlight-color:transparent] hover:bg-neon-yellow/20 sm:px-4 sm:text-[11px]"
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  >
                    Sugerir
                  </button>
                </div>
              </div>

              {/* Pitch: `min-w-0` + `max-w-full` garantem que a caixa de aspeto nunca força overflow horizontal. */}
              <div className="relative aspect-[68/105] w-full min-w-0 max-w-full overflow-hidden rounded-md border border-white/25 bg-[#0a2e15] shadow-lg shadow-black/40 sm:rounded-lg sm:border-2 sm:shadow-2xl md:rounded-lg md:border-4 md:border-white/20 md:shadow-2xl">
              {/* Força do XI: soma dos OVR dos titulares (canto superior esquerdo do gramado) */}
              <div
                className="pointer-events-none absolute left-1 top-1 z-20 border border-neon-yellow/30 bg-black/85 px-1.5 py-1 shadow-lg shadow-black/40 backdrop-blur-sm sm:left-1.5 sm:top-1.5 sm:px-2 sm:py-1.5 md:left-2 md:top-2 md:px-3 md:py-2"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  maxWidth: 'calc(100% - 0.5rem)',
                }}
                title={
                  startersStrength.count === 0
                    ? 'Escala os titulares para ver a força combinada (soma dos OVR).'
                    : `Força do XI: soma dos OVR dos titulares = ${startersStrength.sum}. Média do XI = ${startersStrength.avg.toFixed(1)}. Escalados: ${startersStrength.count} de ${pitchSlots.length}.`
                }
              >
                <p
                  className="text-neon-yellow uppercase leading-none"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 'clamp(6px, 1.5vw, 9px)',
                    fontWeight: 600,
                    letterSpacing: '0.18em',
                  }}
                >
                  Overall
                </p>
                <p
                  className="italic text-neon-yellow tabular-nums leading-none mt-0.5"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontSize: 'clamp(20px, 6vw, 48px)',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {startersStrength.count === 0 ? '—' : startersStrength.sum}
                </p>
                <p
                  className="mt-0.5 text-white/50 uppercase tabular-nums leading-none"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 'clamp(5px, 1.2vw, 8px)',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                  }}
                >
                  {startersStrength.count === 0
                    ? `${pitchSlots.length} pos`
                    : `méd ${Math.round(startersStrength.avg)} · ${startersStrength.count}/${pitchSlots.length}`}
                </p>
              </div>
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
                    <PitchPlayer
                      player={lineup[slot.id]}
                      onOpenMenu={() => setPitchMenu({ slotId: slot.id, player: lineup[slot.id]! })}
                    />
                  ) : (
                    <div
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={cn(
                        'flex size-10 cursor-pointer items-center justify-center rounded-full border border-dashed backdrop-blur-sm transition-all sm:size-12 md:size-16 md:border-2',
                        selectedSlotId === slot.id
                          ? 'border-neon-yellow bg-neon-yellow/20 text-neon-yellow shadow-[0_0_18px_rgba(228,255,0,0.35)] sm:scale-110'
                          : 'border-white/35 bg-black/30 text-white/55 hover:border-white/70 hover:text-white/90',
                      )}
                    >
                      <span className="font-black text-[10px] sm:text-[11px] md:text-sm">{slot.label}</span>
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

            {/* Save — primário sistema (sharp 4px, sem skew, sombra base) */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="mt-3 box-border inline-flex w-full items-center justify-center gap-2 bg-neon-yellow py-3 text-black hover:bg-white hover:scale-[1.005] active:scale-[0.995] transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-neon-yellow disabled:hover:scale-100 [-webkit-tap-highlight-color:transparent]"
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
              <Save className="h-4 w-4 shrink-0" />
              {isSaving ? 'Salvando…' : 'Salvar titulares'}
            </button>
          </div>
        </div>

        {/* Right: Available Players (Horizontal Cards) */}
        <div className="flex min-w-0 w-full max-w-full flex-col gap-4 lg:w-1/2">
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden className="shrink-0 w-[3px] h-7 bg-neon-yellow" />
              <h3
                className="min-w-0 truncate text-neon-yellow uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                }}
              >
                Jogadores disponíveis
              </h3>
            </div>
            <span
              className="shrink-0 text-white/55 uppercase"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                fontWeight: 600,
              }}
            >
              {availablePlayers.length} {availablePlayers.length === 1 ? 'reserva' : 'reservas'}
            </span>
          </div>
          
          <div className="space-y-3 lg:overflow-y-auto lg:pr-2 lg:max-h-[calc(100vh-16rem)] pb-[max(3rem,env(safe-area-inset-bottom,0px))]">
            <AnimatePresence>
              {availablePlayers.map((player) => {
                const stats = [
                  { label: 'PAC', val: player.pac },
                  { label: 'SHO', val: player.sho },
                  { label: 'PAS', val: player.pas },
                  { label: 'FAT', val: player.fatigue },
                ];
                const entity = playersById[player.id];
                const health = entity ? playerHealth[entity.id] : undefined;
                return (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    'flex bg-dark-gray border border-l-[3px] overflow-hidden transition-all duration-200 hover:border-neon-yellow/40 hover:-translate-y-0.5 group',
                    player.style === 'neon-yellow'
                      ? 'border-[var(--color-border)] border-l-neon-yellow'
                      : 'border-[var(--color-border)] border-l-white/15',
                  )}
                  style={{ borderRadius: 'var(--radius-md)' }}
                >
                  {/* Foto — clicável para abrir ficha */}
                  <button
                    type="button"
                    className="relative w-32 sm:w-36 md:w-40 flex-shrink-0 overflow-hidden bg-black border-r border-white/8 cursor-pointer [-webkit-tap-highlight-color:transparent]"
                    onClick={() => setSheetPlayerId(player.id)}
                  >
                    {/* Tonal background (sutil, atrás da foto) */}
                    <div
                      className={cn(
                        'absolute inset-0',
                        player.style === 'neon-yellow' ? 'bg-neon-yellow/10' : 'bg-white/5',
                      )}
                      aria-hidden
                    />
                    <img
                      src={playerPortraitSrc({ id: player.id, name: player.name, portraitUrl: player.portraitUrl }, 200, 300)}
                      alt={player.name}
                      className="absolute inset-0 h-full w-full object-cover object-top grayscale group-hover:grayscale-0 transition-all duration-300"
                      referrerPolicy="no-referrer"
                    />
                    {/* Gradient pra leitura do OVR sobre a foto */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/65 via-black/15 to-transparent"
                    />
                    {/* OVR — Moret italic editorial gigante */}
                    <div className="absolute top-2 left-2 md:top-3 md:left-3 z-10">
                      <p
                        className="italic text-neon-yellow tabular-nums leading-none drop-shadow-[0_3px_10px_rgba(0,0,0,0.95)]"
                        style={{
                          fontFamily: 'var(--font-serif-hero)',
                          fontWeight: 700,
                          fontSize: 'clamp(38px, 5.5vw, 56px)',
                          letterSpacing: '-0.04em',
                        }}
                      >
                        {player.ovr}
                      </p>
                    </div>
                  </button>

                  {/* Info completa: header + atributos + botões (tudo em 1 coluna) */}
                  <div className="flex-1 px-3 py-3 md:px-4 md:py-3.5 flex flex-col gap-3 relative min-w-0">
                    {/* Header: nome + posição + badges */}
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left cursor-pointer [-webkit-tap-highlight-color:transparent]"
                        onClick={() => setSheetPlayerId(player.id)}
                      >
                        <p
                          className="text-white uppercase truncate"
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 'clamp(17px, 2.2vw, 22px)',
                            letterSpacing: '0.03em',
                            lineHeight: 1.05,
                          }}
                        >
                          {playerDisplayName(player)}
                        </p>
                        <p
                          className="text-white/50 uppercase mt-0.5"
                          style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: '10px',
                            letterSpacing: '0.22em',
                            fontWeight: 600,
                          }}
                        >
                          {player.countryFlagEmoji ? (
                            <span className="mr-1.5 not-italic" title={player.country ?? undefined} aria-hidden>
                              {player.countryFlagEmoji}
                            </span>
                          ) : null}
                          {player.pos}
                        </p>
                      </button>
                      {entity ? <PlayerStatusBadge player={entity} health={health} size="sm" /> : null}
                    </div>

                    {/* OLEFOOT PYTHON MODE — consequências persistentes do jogador */}
                    <PlayerConsequencesBadge playerId={player.id} compact={false} />

                    {/* DNA do Campeão — grid 2x2 com mais espaço horizontal */}
                    <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 md:gap-x-8 md:gap-y-3">
                      {stats.map((s) => {
                        const v = Math.max(0, Math.min(100, s.val));
                        return (
                          <div key={s.label} className="min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span
                                className="text-white/55 uppercase"
                                style={{
                                  fontFamily: 'var(--font-display)',
                                  fontSize: '11px',
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
                                  fontSize: 'clamp(18px, 2vw, 22px)',
                                  letterSpacing: '-0.02em',
                                }}
                              >
                                {s.val}
                              </span>
                            </div>
                            <div className="mt-1.5 h-[3px] bg-white/8 overflow-hidden">
                              <div
                                className="h-full bg-neon-yellow transition-all duration-500"
                                style={{ width: `${v}%` }}
                                aria-hidden
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Botões de ação — abaixo dos atributos, full width */}
                    <div className="flex items-center gap-2 mt-auto pt-1">
                      <button
                        type="button"
                        onClick={() => handleEscalar(player)}
                        className="flex-1 bg-neon-yellow py-2.5 text-black hover:bg-white transition-colors [-webkit-tap-highlight-color:transparent]"
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.2em',
                          textTransform: 'uppercase',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        Escalar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSaveBanner(null);
                          setAnnouncePlayer(player);
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 border border-[var(--color-border)] bg-deep-black py-2.5 text-white/85 hover:border-neon-yellow/60 hover:text-neon-yellow transition-colors [-webkit-tap-highlight-color:transparent]"
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.2em',
                          textTransform: 'uppercase',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <Megaphone className="h-3 w-3 shrink-0" aria-hidden />
                        <span>Anunciar</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </AnimatePresence>
            
            {availablePlayers.length === 0 && (
              <div
                className="text-center py-12 border border-[var(--color-border)] bg-dark-gray"
                style={{ borderRadius: 'var(--radius-md)' }}
              >
                <p
                  className="italic text-white/55 mx-auto max-w-md px-6"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontSize: 'clamp(16px, 2.2vw, 20px)',
                    lineHeight: 1.4,
                  }}
                >
                  “sem reservas — titulares completos ou jogadores no mercado.”
                </p>
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
              className="my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-md border border-white/10 bg-dark-gray shadow-2xl max-h-[min(85dvh,calc(100dvh-6rem))] sm:max-h-[80vh]"
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
                      <div className="w-20 sm:w-24 md:w-28 relative bg-black/60 flex-shrink-0 flex items-end justify-center pt-2 border-r border-white/5">
                        <div className={cn(
                          "absolute inset-0 opacity-20",
                          player.style === 'neon-yellow' ? 'bg-neon-yellow' : 'bg-white'
                        )} />
                        <img 
                          src={playerPortraitSrc({ id: player.id, name: player.name, portraitUrl: player.portraitUrl }, 200, 300)}
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
                      <div className="relative flex-1 p-2 md:p-3 flex flex-col justify-center min-w-0">
                        <div className="flex items-center gap-1.5">
                          {player.countryFlagEmoji ? (
                            <span className="shrink-0 text-base leading-none" title={player.country ?? undefined} aria-hidden>
                              {player.countryFlagEmoji}
                            </span>
                          ) : null}
                          <div className="min-w-0 flex-1 font-display font-black text-lg sm:text-xl md:text-2xl uppercase tracking-wide text-white leading-none truncate">
                            {playerDisplayName(player)}
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
              className="my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-md border border-white/10 bg-dark-gray shadow-2xl max-h-[min(88dvh,calc(100dvh-6rem))] sm:max-h-[85vh]"
            >
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                <h3 className="font-display font-black uppercase tracking-wider text-sm md:text-base text-white flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-neon-yellow shrink-0" />
                  Formação e Tática
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
              <div className="p-3 md:p-4 overflow-y-auto space-y-5">
                <section>
                  <h4 className="font-display font-black text-[10px] tracking-widest text-white/60 uppercase mb-2">
                    1. Formação
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FORMATION_SCHEME_LIST.map((id) => {
                      const groups = SCHEME_LINE_GROUPS[id];
                      const linesLabel = `${groups.def.length}-${groups.mid.length}-${groups.att.length}`;
                      const selected = pendingFormation === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setPendingFormation(id)}
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
                </section>

                <section>
                  <h4 className="font-display font-black text-[10px] tracking-widest text-white/60 uppercase mb-2">
                    2. Tática
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PRESET_IDS.map((id) => {
                      const Icon = PRESET_ICONS[id];
                      const selected = pendingPreset === id;
                      return (
                        <div
                          key={id}
                          className={cn(
                            'relative rounded-lg border transition-colors',
                            selected
                              ? 'border-neon-yellow bg-neon-yellow/15'
                              : 'border-white/10 bg-black/30 hover:border-white/25 hover:bg-white/5',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setPendingPreset(id)}
                            className="w-full flex items-start gap-2 px-3 py-2.5 text-left"
                          >
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neon-yellow/90" aria-hidden />
                            <span className="min-w-0 pr-6">
                              <span className="block font-display font-black text-[11px] uppercase tracking-wider text-white leading-tight">
                                {PRESET_LABEL_PT[id]}
                              </span>
                            </span>
                            {selected ? (
                              <Check className="absolute top-1.5 right-7 w-3.5 h-3.5 text-neon-yellow" strokeWidth={3} />
                            ) : null}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPresetInfoId((cur) => (cur === id ? null : id));
                            }}
                            aria-label={`Info ${PRESET_LABEL_PT[id]}`}
                            className="absolute top-1 right-1 p-1 text-white/40 hover:text-neon-yellow transition-colors"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {presetInfoId ? (
                    <div className="mt-3 rounded-lg border border-neon-yellow/25 bg-neon-yellow/5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 font-display font-black text-[11px] uppercase tracking-wider text-neon-yellow">
                          <Info className="w-3.5 h-3.5" />
                          {PRESET_LABEL_PT[presetInfoId]}
                        </div>
                        <button
                          type="button"
                          onClick={() => setPresetInfoId(null)}
                          className="text-white/40 hover:text-white"
                          aria-label="Fechar info"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-white/80 leading-relaxed">
                        {PRESET_DESCRIPTION_PT[presetInfoId]}
                      </p>
                    </div>
                  ) : null}
                </section>
              </div>
              <div className="border-t border-white/10 bg-black/40 p-3 md:p-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormationModalOpen(false)}
                  className="rounded border border-white/15 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-300 hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pendingFormation !== formationScheme) {
                      dispatch({
                        type: 'SET_MANAGER_SLIDERS',
                        partial: { formationScheme: pendingFormation },
                      });
                    }
                    if (pendingPreset !== currentPresetId) {
                      dispatch({ type: 'SET_PLAYING_STYLE_PRESET', presetId: pendingPreset });
                    }
                    setFormationModalOpen(false);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded bg-neon-yellow px-4 py-2 font-display text-xs font-black uppercase tracking-wider text-black hover:bg-white"
                >
                  <Check className="w-4 h-4" /> Aplicar formação e tática
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {announcePlayer && (() => {
          const ent = playersById[announcePlayer.id];
          const offerExp = ent ? calcMarketMakerOffer(ent) : 0;
          const discountLabel = ent ? marketMakerDiscountLabel(ent.pos, overallFromAttributes(ent.attrs, ent.pos)) : '';
          return (
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
              className="my-auto w-full max-w-md overflow-hidden rounded-md border border-neon-yellow/25 bg-dark-gray shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="market-maker-title"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-black/40 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-white/45 font-display font-bold">
                    Market Maker · Proposta
                  </p>
                  <h3
                    id="market-maker-title"
                    className="mt-0.5 font-display text-lg font-black uppercase tracking-wide text-white"
                  >
                    {announcePlayer.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-white/50">
                    {announcePlayer.pos} · OVR {ent ? overallFromAttributes(ent.attrs, ent.pos) : '—'}
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

              {/* Oferta */}
              <div className="p-4 space-y-4">
                <div className="rounded-lg border border-neon-yellow/30 bg-neon-yellow/[0.06] px-4 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/50 font-display font-bold">
                    Oferta do Market Maker
                  </p>
                  <p
                    className="mt-1 text-3xl font-black text-neon-yellow tabular-nums"
                    style={{ fontFamily: 'var(--font-serif-hero)', letterSpacing: '-0.02em' }}
                  >
                    {formatExp(offerExp)} EXP
                  </p>
                  <p className="mt-1 text-[11px] text-white/40">{discountLabel}</p>
                </div>

                <p className="text-xs text-white/50 leading-relaxed">
                  O Market Maker compra na hora. O valor é creditado imediatamente na tua wallet em EXP.
                </p>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setAnnouncePlayer(null)}
                    className="rounded-lg border border-white/20 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-gray-300 hover:bg-white/5 sm:px-4"
                  >
                    Recusar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMarketMakerAccept()}
                    className="rounded-lg bg-neon-yellow py-2.5 font-display text-xs font-black uppercase tracking-wider text-black hover:bg-neon-yellow/85 active:scale-[0.98] sm:px-4"
                  >
                    Aceitar oferta
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>

      <GachaCreatePlayerModal open={createProspectOpen} onClose={() => setCreateProspectOpen(false)} />
      <AcademyCardDeliveryModal
        open={!!deliveryItem?.academy}
        onClose={closeDeliveryModal}
        playerName={deliveryItem?.academy?.playerName ?? ''}
        portraitUrl={deliveryItem?.academy?.portraitUrl}
        promotionalUrl={deliveryItem?.academy?.promotionalUrl}
        shareText={deliveryItem?.academy?.shareText ?? ''}
      />

      <AnimatePresence>
        {sheetPlayerId ? (
          <TeamPlayerSeasonSheet
            playerId={sheetPlayerId}
            onClose={() => setSheetPlayerId(null)}
            onAnnounceSale={(pid) => {
              const pl = playersById[pid];
              if (!pl) return;
              const card: CardPlayer = { ...playerToCardView(pl, maxOvr), id: pl.id };
              setSheetPlayerId(null);
              setSaveBanner(null);
              setAnnouncePlayer(card);
            }}
          />
        ) : null}
      </AnimatePresence>

      {/* Sprint B-3: Menu de ações ao clicar num token do campo */}
      <AnimatePresence>
        {pitchMenu ? (
          <PitchPlayerMenu
            player={pitchMenu.player}
            onClose={() => setPitchMenu(null)}
            onSubstituir={() => {
              const slotId = pitchMenu.slotId;
              setPitchMenu(null);
              handleRemove(slotId);
              setSelectedSlotId(slotId);
              setSaveBanner({
                kind: 'success',
                text: `Slot ${slotId} liberado. Escolhe um substituto na lista.`,
              });
            }}
            onVerSkill={() => {
              const pid = pitchMenu.player.id;
              setPitchMenu(null);
              setSheetPlayerId(pid);
            }}
            onAnunciar={() => {
              const card = pitchMenu.player;
              setPitchMenu(null);
              setAnnouncePlayer(card);
            }}
          />
        ) : null}
      </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Menu de ações ao clicar num jogador escalado no campo (Sprint B-3).
 * Centro-bottom no mobile, modal no desktop. Sem ícones soltos — texto-claro.
 */
function PitchPlayerMenu({
  player,
  onClose,
  onSubstituir,
  onVerSkill,
  onAnunciar,
}: {
  player: CardPlayer;
  onClose: () => void;
  onSubstituir: () => void;
  onVerSkill: () => void;
  onAnunciar: () => void;
}) {
  return (
    <motion.div
      key="pitch-player-menu"
      role="presentation"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="relative w-full max-w-md overflow-hidden border border-white/[0.05]"
        style={{
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-panel-elevated)',
          boxShadow: 'var(--shadow-card-hover)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pitch-menu-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com retrato + nome + OVR */}
        <div className="flex items-center gap-4 border-b border-[var(--color-divider-yellow)] p-5">
          <div
            className={cn(
              'relative size-16 shrink-0 overflow-hidden rounded-full border bg-dark-gray shadow-lg',
              player.style === 'neon-yellow' ? 'border-neon-yellow' : 'border-white/40',
            )}
          >
            <img
              src={playerPortraitSrc({ id: player.id, name: player.name, portraitUrl: player.portraitUrl }, 100, 100)}
              alt=""
              className="h-full w-full object-cover object-top"
              referrerPolicy="no-referrer"
            />
            <span
              className={cn(
                'absolute -right-1 -top-1 flex size-7 items-center justify-center shadow-md',
                player.style === 'neon-yellow' ? 'bg-neon-yellow text-black' : 'bg-white text-black',
              )}
              style={{ borderRadius: '9999px' }}
            >
              <span
                className="italic tabular-nums leading-none"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {player.ovr}
              </span>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-neon-yellow/80">
              Posição · {player.pos}
            </p>
            <h3
              id="pitch-menu-title"
              className="mt-1 truncate font-display text-[20px] font-black uppercase leading-tight tracking-tight text-white"
            >
              {playerDisplayName(player)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Ações — texto-claro, dominantes */}
        <div className="flex flex-col gap-2 p-4">
          <button
            type="button"
            onClick={onSubstituir}
            className="group/act relative w-full overflow-hidden border border-white/[0.05] text-left transition-all hover:border-white/15 hover:-translate-y-0.5"
            style={{
              borderRadius: 'var(--radius-card)',
              background: 'var(--color-panel-soft)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-rose-400" />
            <div className="flex items-center justify-between gap-3 px-5 py-4 pl-6">
              <div>
                <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-neon-yellow/80">
                  Tática
                </p>
                <p className="font-display text-[16px] font-black uppercase leading-tight tracking-tight text-white transition-colors group-hover/act:text-neon-yellow">
                  Substituir
                </p>
                <p className="mt-0.5 text-[11px] text-white/50">Liberar slot e escolher outro jogador</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onVerSkill}
            className="group/act relative w-full overflow-hidden border border-white/[0.05] text-left transition-all hover:border-white/15 hover:-translate-y-0.5"
            style={{
              borderRadius: 'var(--radius-card)',
              background: 'var(--color-panel-soft)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-cyan-300" />
            <div className="flex items-center justify-between gap-3 px-5 py-4 pl-6">
              <div>
                <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-neon-yellow/80">
                  Perfil
                </p>
                <p className="font-display text-[16px] font-black uppercase leading-tight tracking-tight text-white transition-colors group-hover/act:text-neon-yellow">
                  Ver skills & temporada
                </p>
                <p className="mt-0.5 text-[11px] text-white/50">Atributos, evolução e histórico recente</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onAnunciar}
            className="group/act relative w-full overflow-hidden border border-white/[0.05] text-left transition-all hover:border-white/15 hover:-translate-y-0.5"
            style={{
              borderRadius: 'var(--radius-card)',
              background: 'var(--color-panel-soft)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-neon-yellow" />
            <div className="flex items-center justify-between gap-3 px-5 py-4 pl-6">
              <div>
                <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-neon-yellow/80">
                  Mercado
                </p>
                <p className="font-display text-[16px] font-black uppercase leading-tight tracking-tight text-white transition-colors group-hover/act:text-neon-yellow">
                  Anunciar no mercado
                </p>
                <p className="mt-0.5 text-[11px] text-white/50">Listar para venda em EXP</p>
              </div>
            </div>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Hero do Plantel — Sprint B-3 Legacy Tech.
 * Espelha o padrão do Manager: amarelo + watermark + headline + stats + CTAs.
 */
function PlantelHero({
  clubName,
  clubShort,
  formation,
  squadSize,
  startersCount,
  startersCap,
  xiAvgOverall,
  favoriteRealTeamName,
  onChooseFormation,
  onCreatePlayer,
  academyUsed,
  academyCap,
}: {
  clubName: string;
  clubShort: string;
  formation: string;
  squadSize: number;
  startersCount: number;
  startersCap: number;
  xiAvgOverall: number;
  favoriteRealTeamName?: string;
  onChooseFormation: () => void;
  onCreatePlayer: () => void;
  academyUsed: number;
  academyCap: number;
}) {
  const academyFull = academyUsed >= academyCap;
  const watermark = (clubShort?.trim() || clubName.slice(0, 3)).toUpperCase();
  const xiAvgLabel = startersCount === 0 ? '—' : Math.round(xiAvgOverall).toString();
  return (
    <section
      aria-label="Plantel Principal"
      className="relative w-full max-w-full min-w-0 overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-8"
    >
      {/* Watermark gigante: sigla do clube */}
      <div
        className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
        aria-hidden
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={watermark}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.4 }}
            className="font-display font-black uppercase whitespace-nowrap text-black/[0.04]"
            style={{
              fontSize: 'clamp(140px, 26vw, 460px)',
              lineHeight: '0.85',
              letterSpacing: '-0.02em',
            }}
          >
            {watermark}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Composição editorial centrada vertical */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 text-center"
      >
        {/* Eyebrow */}
        <div
          className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-black mb-4 sm:mb-6 truncate"
        >
          OLE Football · Meu Time · {clubName}
        </div>

        {/* Headline duo: Plantel + formação italic */}
        <h1 className="leading-[0.9]">
          <span
            className="block font-bold uppercase text-black"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.75rem, 8vw, 6rem)',
              letterSpacing: '0.005em',
            }}
          >
            Plantel
          </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={formation}
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
              {formation}
            </motion.span>
          </AnimatePresence>
        </h1>

        {/* Régua decorativa */}
        <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />

        {/* Quote italic — tom Legacy Tech */}
        <motion.blockquote
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="ole-headline-italic mt-7 sm:mt-9 text-black/85 mx-auto max-w-xl leading-snug"
          style={{ fontSize: 'clamp(15px, 2vw, 19px)' }}
        >
          {startersCount === startersCap && startersCap > 0
            ? '"escalação completa — pronta para a próxima partida."'
            : startersCount === 0
              ? '"comece pelo XI titular — cada nome carrega uma história."'
              : '"escalação em construção — tática e jogadores em harmonia."'}
        </motion.blockquote>

        {/* Stats strip — 3 métricas principais */}
        <div className="mt-8 sm:mt-10 grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto px-2">
          <div
            className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <p
              className="text-neon-yellow tabular-nums leading-none truncate"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontStyle: 'italic',
                fontSize: 'clamp(20px, 4vw, 36px)',
              }}
            >
              {squadSize}
            </p>
            <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
              Plantel
            </p>
          </div>
          <div
            className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <p
              className="text-neon-yellow tabular-nums leading-none truncate"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontStyle: 'italic',
                fontSize: 'clamp(20px, 4vw, 36px)',
              }}
            >
              {startersCount}
              <span className="text-white/30 text-[60%]">/{startersCap}</span>
            </p>
            <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
              Titulares
            </p>
          </div>
          <div
            className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <p
              className="text-neon-yellow tabular-nums leading-none truncate"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontStyle: 'italic',
                fontSize: 'clamp(20px, 4vw, 36px)',
              }}
            >
              {xiAvgLabel}
            </p>
            <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
              OVR XI
            </p>
          </div>
        </div>

        {/* CTAs — primário preto sobre amarelo, secundários outline */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 px-4">
          <button
            type="button"
            onClick={onChooseFormation}
            className="inline-flex items-center justify-center bg-black px-5 sm:px-7 py-3 text-neon-yellow font-bold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[11px] sm:text-[12px] hover:bg-deep-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
            style={{ fontFamily: 'var(--font-display)', borderRadius: 'var(--radius-sm)' }}
          >
            Escolher formação
          </button>
          <button
            type="button"
            onClick={onCreatePlayer}
            disabled={academyFull}
            title={academyFull
              ? `Academia cheia (${academyUsed}/${academyCap}). Vende um jogador ao Market Maker pra liberar slot.`
              : `Academia: ${academyUsed}/${academyCap} slots usados`}
            className={`inline-flex items-center justify-center border border-black/70 bg-transparent px-5 sm:px-7 py-3 text-black font-bold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[11px] sm:text-[12px] transition-colors ${
              academyFull
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-black/10'
            }`}
            style={{ fontFamily: 'var(--font-display)', borderRadius: 'var(--radius-sm)' }}
          >
            Criar jogador
            <span
              className={`ml-2 inline-flex items-center justify-center px-2 py-[2px] text-[10px] font-mono rounded ${
                academyFull ? 'bg-red-900/80 text-red-100' : 'bg-black/15 text-black/75'
              }`}
            >
              {academyUsed}/{academyCap}
            </span>
          </button>
          {favoriteRealTeamName ? (
            <Link
              to="/ranking?tab=nacional&heart=1"
              className="inline-flex items-center justify-center border border-black/70 bg-transparent px-5 sm:px-7 py-3 text-black font-bold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[11px] sm:text-[12px] hover:bg-black/10 transition-colors"
              style={{ fontFamily: 'var(--font-display)', borderRadius: 'var(--radius-sm)' }}
            >
              Ranking · {favoriteRealTeamName}
            </Link>
          ) : null}
        </div>
      </motion.div>
    </section>
  );
}

function PitchPlayer({
  player,
  onOpenMenu,
}: {
  player: CardPlayer;
  /** Sprint B-3: substitui onOpenSheet/onRemove. Abre menu (Substituir/Skill/Anunciar). */
  onOpenMenu: () => void;
}) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="relative flex flex-col items-center"
    >
      <button
        type="button"
        onClick={onOpenMenu}
        className="group/token relative flex cursor-pointer flex-col items-center [-webkit-tap-highlight-color:transparent]"
        aria-label={`Abrir ações para ${player.name}`}
      >
        {/* Sprint B-3: token ~40% maior */}
        <div
          className={cn(
            'relative size-12 overflow-hidden rounded-full border bg-dark-gray shadow-lg sm:size-14 md:size-16 md:border-2',
            player.style === 'neon-yellow' ? 'border-neon-yellow' : 'border-white',
          )}
        >
          {player.countryFlagEmoji ? (
            <span
              className="absolute bottom-0 left-0 z-[5] rounded-sm bg-black/70 px-[2px] text-[9px] leading-none sm:text-[10px] md:text-[12px]"
              title={player.country ?? undefined}
              aria-hidden
            >
              {player.countryFlagEmoji}
            </span>
          ) : null}
          <img
            src={playerPortraitSrc({ id: player.id, name: player.name, portraitUrl: player.portraitUrl }, 100, 100)}
            alt=""
            className="h-full w-full object-cover object-top"
            referrerPolicy="no-referrer"
          />
        </div>

        <div
          className="mt-1 max-w-[min(5.5rem,24vw)] truncate border border-white/25 bg-black/90 px-1 py-0.5 text-[9px] font-bold text-white drop-shadow-md sm:mt-1.5 sm:max-w-[6.5rem] sm:px-1.5 sm:text-[10px] md:max-w-[7.5rem] md:px-2 md:text-[11px]"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          {playerDisplayName(player)}
        </div>

        <div
          className={cn(
            'pointer-events-none absolute -right-1 -top-1 flex size-5 items-center justify-center shadow-md sm:-right-1.5 sm:-top-1.5 sm:size-6 md:-right-2 md:-top-2 md:size-7',
            player.style === 'neon-yellow' ? 'bg-neon-yellow text-black' : 'bg-white text-black',
          )}
          style={{ borderRadius: '9999px' }}
        >
          <span
            className="italic tabular-nums leading-none"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontSize: 'clamp(10px, 1.5vw, 13px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            {player.ovr}
          </span>
        </div>
      </button>
    </motion.div>
  );
}
