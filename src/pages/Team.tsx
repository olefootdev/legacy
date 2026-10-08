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
import { BarraSegmentos, DEGRAU_CLASSES, SecaoRua } from '@/components/ui';
import { DEGRAU_INFO, ModalTopoRua, OvrSelo, VazioRua, anelDegrau, degrauDe, ovrNumeroClasses } from '@/components/clube/escada';
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
import { L } from '@/i18n/L';
import { rotuloPosicao } from '@/transfer/marketFilters';

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
      setSaveBanner({ kind: 'error', text: L(`${player.name} já está escalado. Só pode 1 ${player.name} em campo por vez.`, `${player.name} is already in the lineup. Only 1 ${player.name} on the pitch at a time.`) });
      return;
    }
    setSaveBanner(null);
    setLineupDirty(true);
    setLineup((prev) => ({ ...prev, [slotId]: player }));
    setSelectedSlotId(null);
  };

  const handleEscalar = (player: CardPlayer) => {
    if (personAlreadyStarting(player)) {
      setSaveBanner({ kind: 'error', text: L(`${player.name} já está escalado. Só pode 1 ${player.name} em campo por vez.`, `${player.name} is already in the lineup. Only 1 ${player.name} on the pitch at a time.`) });
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
      alert(L('O time já está completo! Remova um jogador do campo primeiro.', 'The team is already full! Remove a player from the pitch first.'));
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
      setSaveBanner({ kind: 'error', text: L('VOCÊ PRECISA PREENCHER TODAS AS POSIÇÕES', 'YOU MUST FILL ALL POSITIONS') });
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
      setSaveBanner({ kind: 'success', text: L('Escalação salva com sucesso.', 'Lineup saved.') });
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
    setSaveBanner({ kind: 'success', text: L(`Market Maker comprou ${name} por ${formatExp(offerExp)} EXP`, `Market Maker bought ${name} for ${formatExp(offerExp)} EXP`) });
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

  const xiDegrau = startersStrength.count === 0 ? null : degrauDe(Math.round(startersStrength.avg));

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden pb-8">
      <div className="w-full max-w-6xl min-w-0 mx-auto px-3 sm:px-4 lg:px-8 space-y-6 md:space-y-8">
      <BackButton to="/clube" label={L('Clube', 'Club')} />
      <div data-tutorial-anchor="team-hero">
      <TeamMeuTimeHeader
        title={L('Plantel Principal', 'First Team')}
        customHero={
          <PlantelHero
            clubName={club.name}
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
      <div className="flex w-full min-w-0 max-w-full flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Esquerda: o campo de giz — várzea riscada no concreto */}
        <div className="h-fit w-full min-w-0 max-w-full shrink-0 lg:sticky lg:top-24 lg:w-[55%]">
          <div className="relative box-border w-full min-w-0 max-w-full overflow-x-hidden bg-asfalto-27 py-1">
            <div className="mx-auto w-full min-w-0 max-w-[min(100%,22rem)] sm:max-w-[28rem] md:max-w-[32rem] lg:max-w-[40rem]">
              <div className="mb-3 flex w-full min-w-0 items-center justify-between gap-2">
                <SecaoRua label={L('Titulares', 'Starters')} aside={`${startersStrength.count}/${pitchSlots.length}`} className="min-w-0 flex-1" />
                <button
                  type="button"
                  onClick={handleSuggestLineup}
                  title={L('Sugerir escalação (GameSpirit)', 'Suggest lineup (GameSpirit)')}
                  aria-label={L('Sugerir escalação', 'Suggest lineup')}
                  className="inline-flex min-h-[40px] shrink-0 touch-manipulation items-center justify-center gap-1.5 border-2 border-rua px-3 font-impact text-[15px] uppercase leading-none text-rua transition-colors [-webkit-tap-highlight-color:transparent] hover:bg-rua hover:text-asfalto-27"
                >
                  {L('Sugerir', 'Suggest')} <span aria-hidden>→</span>
                </button>
              </div>

              {/* Pitch: `min-w-0` + `max-w-full` garantem que a caixa de aspeto nunca força overflow horizontal.
                  DS 2027: só mudou a COR — concreto com linhas de giz. Posições intactas. */}
              <div className="rua-grao relative aspect-[68/105] w-full min-w-0 max-w-full overflow-hidden border-2 border-linha bg-concreto">
              {/* Força do XI: soma dos OVR dos titulares (canto superior esquerdo) — a cor sai do degrau da média */}
              <div
                className={cn(
                  'pointer-events-none absolute left-1 top-1 z-20 px-1.5 py-1 sm:left-1.5 sm:top-1.5 sm:px-2 sm:py-1.5 md:left-2 md:top-2 md:px-3 md:py-2',
                  xiDegrau ? DEGRAU_CLASSES[xiDegrau] : 'border-2 border-dashed border-fio bg-asfalto-27 text-mudo',
                )}
                style={{ maxWidth: 'calc(100% - 0.5rem)' }}
                title={
                  startersStrength.count === 0
                    ? L('Escala os titulares para ver a força combinada (soma dos OVR).', 'Pick your starters to see the combined strength (sum of OVR).')
                    : L(`Força do XI: soma dos OVR dos titulares = ${startersStrength.sum}. Média do XI = ${startersStrength.avg.toFixed(1)}. Escalados: ${startersStrength.count} de ${pitchSlots.length}.`, `XI strength: starters' OVR sum = ${startersStrength.sum}. XI average = ${startersStrength.avg.toFixed(1)}. Picked: ${startersStrength.count} of ${pitchSlots.length}.`)
                }
              >
                <p className="font-prova text-[clamp(7px,1.6vw,10px)] font-bold uppercase leading-none tracking-[0.18em] opacity-75">
                  Overall
                </p>
                <p
                  className={cn(
                    'mt-0.5 font-impact text-[clamp(20px,6vw,48px)] leading-none tabular-nums',
                    xiDegrau && ovrNumeroClasses(xiDegrau),
                  )}
                >
                  {startersStrength.count === 0 ? '—' : startersStrength.sum}
                </p>
                <p className="mt-0.5 font-prova text-[clamp(6px,1.3vw,9px)] font-bold uppercase leading-none tracking-[0.12em] tabular-nums opacity-75">
                  {startersStrength.count === 0
                    ? `${pitchSlots.length} pos`
                    : `${L('méd', 'avg')} ${Math.round(startersStrength.avg)} · ${startersStrength.count}/${pitchSlots.length}`}
                </p>
              </div>
              {/* Linhas de giz */}
              <div className="absolute inset-0 pointer-events-none opacity-50">
                {/* Center Line */}
                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-papel/70 -translate-y-1/2" />
                {/* Center Circle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[27.5%] aspect-square border-[2px] border-papel/70 rounded-full" />
                {/* Center Dot */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-papel/70 rounded-full" />

                {/* Top Penalty Box */}
                <div className="absolute top-0 left-[20.35%] right-[20.35%] h-[15.7%] border-[2px] border-t-0 border-papel/70" />
                {/* Top Goal Box */}
                <div className="absolute top-0 left-[36.5%] right-[36.5%] h-[5.2%] border-[2px] border-t-0 border-papel/70" />
                {/* Top Penalty Arc */}
                <div className="absolute top-[15.7%] left-1/2 -translate-x-1/2 w-[27.5%] aspect-square border-[2px] border-papel/70 rounded-full -translate-y-1/2" style={{ clipPath: 'inset(50% 0 0 0)' }} />
                {/* Top Penalty Dot */}
                <div className="absolute top-[10.47%] left-1/2 -translate-x-1/2 w-1 h-1 md:w-1.5 md:h-1.5 bg-papel/70 rounded-full" />

                {/* Bottom Penalty Box */}
                <div className="absolute bottom-0 left-[20.35%] right-[20.35%] h-[15.7%] border-[2px] border-b-0 border-papel/70" />
                {/* Bottom Goal Box */}
                <div className="absolute bottom-0 left-[36.5%] right-[36.5%] h-[5.2%] border-[2px] border-b-0 border-papel/70" />
                {/* Bottom Penalty Arc */}
                <div className="absolute bottom-[15.7%] left-1/2 -translate-x-1/2 w-[27.5%] aspect-square border-[2px] border-papel/70 rounded-full translate-y-1/2" style={{ clipPath: 'inset(0 0 50% 0)' }} />
                {/* Bottom Penalty Dot */}
                <div className="absolute bottom-[10.47%] left-1/2 -translate-x-1/2 w-1 h-1 md:w-1.5 md:h-1.5 bg-papel/70 rounded-full" />
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
                        'flex size-10 cursor-pointer items-center justify-center rounded-full border-2 border-dashed transition-all sm:size-12 md:size-16',
                        selectedSlotId === slot.id
                          ? 'border-rua bg-rua text-asfalto-27 sm:scale-110'
                          : 'border-fio bg-asfalto-27/70 text-mudo hover:border-papel hover:text-papel',
                      )}
                    >
                      <span className="font-impact text-[11px] sm:text-[12px] md:text-[15px]">{rotuloPosicao(slot.label)}</span>
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
                    'mt-4 flex items-start gap-3 px-3 py-2.5 md:px-4 md:py-3',
                    saveBanner.kind === 'error'
                      ? 'border-2 border-baixa bg-concreto text-papel'
                      : 'border-2 border-rua bg-concreto text-papel',
                  )}
                >
                  {saveBanner.kind === 'error' ? (
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-baixa" />
                  ) : (
                    <Check className="w-5 h-5 shrink-0 mt-0.5 text-rua" strokeWidth={2.5} />
                  )}
                  <p className="min-w-0 flex-1 break-words font-prova text-[12px] font-bold uppercase leading-snug tracking-[0.06em] md:text-[13px]">
                    {saveBanner.text}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSaveBanner(null)}
                    className="shrink-0 p-1 text-mudo hover:text-papel"
                    aria-label={L('Fechar aviso', 'Close notice')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Salvar — a ação da tela: rua + sombra dura de papel */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="mb-2 mr-2 mt-5 box-border inline-flex min-h-[56px] w-[calc(100%-0.5rem)] items-center justify-center gap-2 bg-rua font-impact text-[22px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)] disabled:cursor-not-allowed disabled:opacity-50 [-webkit-tap-highlight-color:transparent]"
            >
              <Save className="h-5 w-5 shrink-0" />
              {isSaving ? L('Salvando…', 'Saving…') : L('Salvar titulares', 'Save starters')}
              {!isSaving && <span aria-hidden>→</span>}
            </button>
          </div>
        </div>

        {/* Direita: reservas — cartas na escada por OVR */}
        <div className="flex min-w-0 w-full max-w-full flex-col gap-4 lg:w-1/2">
          <SecaoRua
            label={L('Jogadores disponíveis', 'Available players')}
            aside={`${availablePlayers.length} ${availablePlayers.length === 1 ? L('reserva', 'sub') : L('reservas', 'subs')}`}
          />

          <div className="space-y-4 lg:overflow-y-auto lg:pr-3 lg:max-h-[calc(100vh-16rem)] pb-[max(3rem,env(safe-area-inset-bottom,0px))]">
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
                const d = degrauDe(player.ovr);
                return (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group flex min-w-0 overflow-hidden bg-concreto"
                >
                  {/* A carta — degrau pelo OVR. Clicável pra abrir a ficha. */}
                  <button
                    type="button"
                    className={cn(
                      'relative flex w-28 flex-shrink-0 cursor-pointer flex-col gap-1.5 p-2 text-left sm:w-32 md:w-36 [-webkit-tap-highlight-color:transparent]',
                      DEGRAU_CLASSES[d],
                    )}
                    onClick={() => setSheetPlayerId(player.id)}
                    aria-label={L(`Ficha de ${player.name}, OVR ${player.ovr}, ${DEGRAU_INFO[d].nome}`, `${player.name} sheet, OVR ${player.ovr}, ${DEGRAU_INFO[d].nome}`)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className={cn('font-impact text-[clamp(36px,5.5vw,48px)] leading-[0.85] tabular-nums', ovrNumeroClasses(d))}>
                        {player.ovr}
                      </span>
                      <span className="font-impact text-[13px] uppercase leading-none">{rotuloPosicao(player.pos)}</span>
                    </div>
                    <div className={cn('relative aspect-[4/5] w-full overflow-hidden', d === 'respeito' ? 'bg-concreto' : 'bg-asfalto-27/10')}>
                      <img
                        src={playerPortraitSrc({ id: player.id, name: player.name, portraitUrl: player.portraitUrl }, 200, 300)}
                        alt={player.name}
                        className="absolute inset-0 object-cover object-top grayscale transition-all duration-300 group-hover:grayscale-0"
                        style={{ width: '100%', height: '100%', maxWidth: 'none' }}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="font-prova text-[9px] font-bold uppercase tracking-[0.14em] opacity-80">
                      {DEGRAU_INFO[d].n} · {DEGRAU_INFO[d].nome}
                    </span>
                  </button>

                  {/* Info completa: header + atributos + botões (tudo em 1 coluna) */}
                  <div className="relative flex min-w-0 flex-1 flex-col gap-3 px-3 py-3 md:px-4 md:py-3.5">
                    {/* Header: nome + posição + badges */}
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left cursor-pointer [-webkit-tap-highlight-color:transparent]"
                        onClick={() => setSheetPlayerId(player.id)}
                      >
                        <p className="block min-w-0 truncate font-voz text-[clamp(22px,2.6vw,27px)] leading-none text-papel">
                          {playerDisplayName(player)}
                        </p>
                        <p className="mt-1 font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-mudo">
                          {player.countryFlagEmoji ? (
                            <span className="mr-1.5 not-italic" title={player.country ?? undefined} aria-hidden>
                              {player.countryFlagEmoji}
                            </span>
                          ) : null}
                          {rotuloPosicao(player.pos)}
                        </p>
                      </button>
                      {entity ? <PlayerStatusBadge player={entity} health={health} size="sm" /> : null}
                    </div>

                    {/* OLEFOOT PYTHON MODE — consequências persistentes do jogador */}
                    <PlayerConsequencesBadge playerId={player.id} compact={false} />

                    {/* Atributos em segmentos */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 md:gap-x-6 md:gap-y-3">
                      {stats.map((s) => (
                        <div key={s.label} className="min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">{s.label}</span>
                            <span className="font-impact text-[20px] leading-none tabular-nums text-papel">{s.val}</span>
                          </div>
                          <BarraSegmentos valor={Math.max(0, Math.min(100, s.val))} max={100} className="mt-1.5 h-2 gap-[3px]" />
                        </div>
                      ))}
                    </div>

                    {/* Botões de ação — abaixo dos atributos, full width */}
                    <div className="mt-auto flex items-center gap-2 pt-1 pr-1 pb-1">
                      <button
                        type="button"
                        onClick={() => handleEscalar(player)}
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 bg-rua font-impact text-[16px] uppercase leading-none text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_var(--color-papel)] [-webkit-tap-highlight-color:transparent]"
                      >
                        {L('Escalar', 'Pick')} <span aria-hidden>→</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSaveBanner(null);
                          setAnnouncePlayer(player);
                        }}
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 border-2 border-linha font-impact text-[16px] uppercase leading-none text-papel transition-colors hover:border-papel [-webkit-tap-highlight-color:transparent]"
                      >
                        <Megaphone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>{L('Anunciar', 'List')}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </AnimatePresence>

            {availablePlayers.length === 0 && (
              <VazioRua
                frase={L('Banco vazio. Todo mundo em campo.', 'Empty bench. Everyone is on the pitch.')}
                detalhe={L('Contrate no mercado.', 'Sign players in the Market.')}
                acao={{ label: L('Ir pro mercado', 'Go to the market'), to: '/mercado/transfer' }}
              />
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
            className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4"
            onClick={() => setSelectedSlotId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="my-auto flex w-full max-w-2xl flex-col overflow-hidden border-2 border-linha bg-asfalto-27 max-h-[min(85dvh,calc(100dvh-6rem))] sm:max-h-[80vh]"
            >
              <ModalTopoRua
                rotulo={L('Escalar', 'Pick')}
                titulo={rotuloPosicao(selectedSlot.label)}
                onClose={() => setSelectedSlotId(null)}
              />

              <div className="space-y-2 overflow-y-auto p-4">
                {modalPlayers.length > 0 ? (
                  modalPlayers.map((player) => {
                    const d = degrauDe(player.ovr);
                    return (
                    <div
                      key={player.id}
                      className="group flex h-20 min-w-0 cursor-pointer overflow-hidden bg-concreto transition-colors hover:bg-linha md:h-24"
                      onClick={() => handleEscalarToSlot(player, selectedSlot.id)}
                    >
                      {/* Left: Image & OVR */}
                      <div className={cn('relative w-20 flex-shrink-0 overflow-hidden sm:w-24 md:w-28', DEGRAU_CLASSES[d])}>
                        <img
                          src={playerPortraitSrc({ id: player.id, name: player.name, portraitUrl: player.portraitUrl }, 200, 300)}
                          alt={player.name}
                          className="absolute inset-0 object-cover object-top grayscale transition-all duration-300 group-hover:grayscale-0"
                          style={{ width: '100%', height: '100%', maxWidth: 'none' }}
                          referrerPolicy="no-referrer"
                        />
                        <OvrSelo ovr={player.ovr} className="absolute left-1 top-1 h-7 min-w-7 px-1 text-[16px]" />
                      </div>

                      {/* Middle: Info */}
                      <div className="relative flex min-w-0 flex-1 flex-col justify-center p-2 md:p-3">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {player.countryFlagEmoji ? (
                            <span className="shrink-0 text-base leading-none" title={player.country ?? undefined} aria-hidden>
                              {player.countryFlagEmoji}
                            </span>
                          ) : null}
                          <div className="min-w-0 flex-1 truncate font-voz text-[22px] leading-none text-papel md:text-[26px]">
                            {playerDisplayName(player)}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="mt-1.5 flex gap-3 md:mt-2 md:gap-4">
                          {[
                            ['PAC', player.pac],
                            ['SHO', player.sho],
                            ['PAS', player.pas],
                            ['FAT', player.fatigue],
                          ].map(([lbl, v]) => (
                            <div key={lbl} className="flex flex-col">
                              <span className="font-prova text-[9px] font-bold uppercase text-mudo">{lbl}</span>
                              <span className="font-impact text-[14px] leading-none text-papel">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: CTA */}
                      <div className="flex w-16 items-center justify-center border-l-2 border-linha p-2 transition-colors group-hover:bg-rua md:w-28">
                        <span className="font-impact text-[14px] uppercase leading-none text-rua group-hover:text-asfalto-27 md:text-[17px]">
                          {L('Escalar', 'Pick')} <span aria-hidden>→</span>
                        </span>
                      </div>
                    </div>
                    );
                  })
                ) : (
                  <VazioRua
                    frase={L(`Ninguém pra ${rotuloPosicao(selectedSlot.label)} no banco.`, `Nobody for ${rotuloPosicao(selectedSlot.label)} on the bench.`)}
                    detalhe={L(`Nenhum jogador disponível para a posição ${rotuloPosicao(selectedSlot.label)}.`, `No players available for ${rotuloPosicao(selectedSlot.label)}.`)}
                    acao={{ label: L('Ir para Mercado', 'Go to Market'), onClick: () => navigate('/transfer') }}
                  />
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
            className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4"
            onClick={() => setFormationModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="my-auto flex w-full max-w-lg flex-col overflow-hidden border-2 border-linha bg-asfalto-27 max-h-[min(88dvh,calc(100dvh-6rem))] sm:max-h-[85vh]"
            >
              <ModalTopoRua
                rotulo={L('Prancheta', 'Clipboard')}
                titulo={
                  <span className="inline-flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 shrink-0 text-rua" aria-hidden />
                    {L('Formação e Tática', 'Formation & Tactics')}
                  </span>
                }
                onClose={() => setFormationModalOpen(false)}
              />
              <div className="space-y-6 overflow-y-auto p-4">
                <section className="flex flex-col gap-3">
                  <SecaoRua label={L('1. Formação', '1. Formation')} />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {FORMATION_SCHEME_LIST.map((id) => {
                      const groups = SCHEME_LINE_GROUPS[id];
                      const linesLabel = `${groups.def.length}-${groups.mid.length}-${groups.att.length}`;
                      const selected = pendingFormation === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setPendingFormation(id)}
                          aria-pressed={selected}
                          className={cn(
                            'relative px-3 py-3 text-left transition-colors',
                            selected
                              ? 'bg-rua text-asfalto-27'
                              : 'bg-concreto text-papel hover:bg-linha',
                          )}
                        >
                          {selected && (
                            <span className="absolute right-2 top-2">
                              <Check className="h-4 w-4" strokeWidth={3} />
                            </span>
                          )}
                          <span className="block pr-5 font-spray text-[26px] font-black leading-none">{id}</span>
                          <span className={cn('mt-1 block font-prova text-[10px] font-bold uppercase tracking-[0.12em]', selected ? 'text-asfalto-27/70' : 'text-mudo')}>
                            {L('Linhas', 'Lines')} {linesLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="flex flex-col gap-3">
                  <SecaoRua label={L('2. Tática', '2. Tactics')} />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PRESET_IDS.map((id) => {
                      const Icon = PRESET_ICONS[id];
                      const selected = pendingPreset === id;
                      return (
                        <div
                          key={id}
                          className={cn(
                            'relative transition-colors',
                            selected ? 'bg-rua text-asfalto-27' : 'bg-concreto text-papel hover:bg-linha',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setPendingPreset(id)}
                            aria-pressed={selected}
                            className="flex w-full items-start gap-2 px-3 py-3 text-left"
                          >
                            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', selected ? 'text-asfalto-27' : 'text-rua')} aria-hidden />
                            <span className="min-w-0 pr-6">
                              <span className="block font-impact text-[14px] uppercase leading-tight">
                                {PRESET_LABEL_PT[id]}
                              </span>
                            </span>
                            {selected ? (
                              <Check className="absolute right-7 top-2 h-3.5 w-3.5" strokeWidth={3} />
                            ) : null}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPresetInfoId((cur) => (cur === id ? null : id));
                            }}
                            aria-label={`Info ${PRESET_LABEL_PT[id]}`}
                            className={cn('absolute right-1 top-1 p-1 transition-colors', selected ? 'text-asfalto-27/70 hover:text-asfalto-27' : 'text-mudo hover:text-rua')}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {presetInfoId ? (
                    <div className="border-l-[3px] border-rua bg-concreto p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 font-impact text-[15px] uppercase text-papel">
                          <Info className="h-3.5 w-3.5 text-rua" />
                          {PRESET_LABEL_PT[presetInfoId]}
                        </div>
                        <button
                          type="button"
                          onClick={() => setPresetInfoId(null)}
                          className="text-mudo hover:text-papel"
                          aria-label={L('Fechar info', 'Close info')}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-2 text-[13px] leading-relaxed text-suave">
                        {PRESET_DESCRIPTION_PT[presetInfoId]}
                      </p>
                    </div>
                  ) : null}
                </section>
              </div>
              <div className="flex items-center gap-3 border-t-2 border-linha p-4 pr-5">
                <button
                  type="button"
                  onClick={() => setFormationModalOpen(false)}
                  className="inline-flex min-h-[48px] items-center border-2 border-linha px-4 font-impact text-[16px] uppercase leading-none text-mudo hover:border-papel hover:text-papel"
                >
                  {L('Cancelar', 'Cancel')}
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
                  className="inline-flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-2 bg-rua px-4 font-impact text-[16px] uppercase leading-none text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-papel)]"
                >
                  <span className="min-w-0 truncate">{L('Aplicar formação e tática', 'Apply formation & tactics')}</span>
                  <span aria-hidden>→</span>
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
            className="fixed inset-0 z-[55] flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4"
            onClick={() => setAnnouncePlayer(null)}
            role="presentation"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="my-auto w-full max-w-md overflow-hidden border-2 border-linha bg-asfalto-27"
              role="dialog"
              aria-modal="true"
              aria-labelledby="market-maker-title"
            >
              <ModalTopoRua
                rotulo={L('#marketmaker #proposta', '#marketmaker #offer')}
                titulo={announcePlayer.name}
                tituloId="market-maker-title"
                voz
                onClose={() => setAnnouncePlayer(null)}
              />

              {/* Oferta — valor que já existe: degrau RESPEITO (fio de ouro) */}
              <div className="space-y-5 p-5">
                <p className="font-prova text-[12px] font-bold uppercase tracking-[0.14em] text-mudo">
                  {rotuloPosicao(announcePlayer.pos)} · OVR {ent ? overallFromAttributes(ent.attrs, ent.pos) : '—'}
                </p>
                <div className="border-[3px] border-ouro-27 bg-asfalto-27 px-4 py-4">
                  <p className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">
                    — {L('Oferta do Market Maker', 'Market Maker offer')}
                  </p>
                  <p className="mt-1 font-spray text-[clamp(38px,11vw,52px)] font-black leading-none text-ouro-27 tabular-nums">
                    {formatExp(offerExp)} EXP
                  </p>
                  <p className="mt-1.5 font-prova text-[11px] text-mudo">{discountLabel}</p>
                </div>

                <div className="flex flex-col gap-3 pb-1 pr-1 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setAnnouncePlayer(null)}
                    className="inline-flex min-h-[48px] items-center justify-center border-2 border-linha px-4 font-impact text-[16px] uppercase leading-none text-mudo hover:border-papel hover:text-papel"
                  >
                    {L('Recusar', 'Decline')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMarketMakerAccept()}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 bg-rua px-4 font-impact text-[17px] uppercase leading-none text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-papel)]"
                  >
                    {L('Aceitar', 'Accept')} +{formatExp(offerExp)} EXP <span aria-hidden>→</span>
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
                text: L(`Slot ${slotId} liberado. Escolha um substituto na lista.`, `Slot ${slotId} freed. Pick a replacement from the list.`),
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
  const d = degrauDe(player.ovr);
  const acoes: Array<{ tag: string; titulo: string; sub: string; onClick: () => void }> = [
    { tag: L('#tatica', '#tactics'), titulo: L('Substituir', 'Substitute'), sub: L('Libera o slot', 'Frees the slot'), onClick: onSubstituir },
    { tag: L('#perfil', '#profile'), titulo: L('Ver skills & temporada', 'Skills & season'), sub: L('Atributos e histórico', 'Attributes & history'), onClick: onVerSkill },
    { tag: L('#mercado', '#market'), titulo: L('Anunciar no mercado', 'List on Market'), sub: L('Venda em EXP', 'Sell for EXP'), onClick: onAnunciar },
  ];
  return (
    <motion.div
      key="pitch-player-menu"
      role="presentation"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
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
        className="relative w-full max-w-md overflow-hidden border-2 border-linha bg-asfalto-27"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pitch-menu-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com retrato + nome + OVR */}
        <div className="flex min-w-0 items-center gap-4 border-b-2 border-linha p-5">
          <div className={cn('relative size-16 shrink-0 overflow-hidden rounded-full bg-concreto', anelDegrau(d))}>
            <img
              src={playerPortraitSrc({ id: player.id, name: player.name, portraitUrl: player.portraitUrl }, 100, 100)}
              alt=""
              className="h-full w-full object-cover object-top"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">
              {L('Posição', 'Position')} · {rotuloPosicao(player.pos)}
            </p>
            <h3 id="pitch-menu-title" className="mt-1 truncate font-voz text-[28px] leading-none text-papel">
              {playerDisplayName(player)}
            </h3>
          </div>
          <OvrSelo ovr={player.ovr} className="h-12 min-w-12 px-1.5 text-[26px]" />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 text-mudo transition hover:text-papel"
            aria-label={L('Fechar menu', 'Close menu')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Ações — texto-claro, dominantes */}
        <div className="flex flex-col p-2">
          {acoes.map((a) => (
            <button
              key={a.titulo}
              type="button"
              onClick={a.onClick}
              className="group/act flex min-w-0 items-center justify-between gap-3 border-b border-linha px-3 py-4 text-left transition-colors last:border-b-0 hover:bg-concreto"
            >
              <div className="min-w-0">
                <span className="font-prova text-[11px] font-bold text-mudo">{a.tag}</span>
                <p className="font-impact text-[22px] uppercase leading-tight text-papel transition-colors group-hover/act:text-rua">
                  {a.titulo}
                </p>
                <p className="mt-0.5 text-[12px] text-suave">{a.sub}</p>
              </div>
              <span aria-hidden className="shrink-0 font-impact text-[24px] text-rua transition-transform group-hover/act:translate-x-1">→</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Hero do Plantel — DS 2027.
 * Asfalto com o título no grito; a formação é um adesivo de cal colado torto
 * (o momento "rua" da tela); o placar do plantel em grade de concreto; a ação
 * principal (formação e tática) em rua com sombra dura de papel.
 */
function PlantelHero({
  clubName,
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
  const xiAvgLabel = startersCount === 0 ? '—' : Math.round(xiAvgOverall).toString();
  const xiD = startersCount === 0 ? null : degrauDe(Math.round(xiAvgOverall));
  return (
    <section aria-label={L('Plantel Principal', 'First Team')} className="relative w-full max-w-full min-w-0">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex min-w-0 flex-col gap-5"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="block min-w-0 truncate font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
              — {clubName}
            </span>
            <h1 className="font-impact text-[clamp(52px,15vw,104px)] uppercase leading-[0.84] text-papel">
              {L('Plantel', 'Squad')}
            </h1>
          </div>
          {/* A formação colada como adesivo de cal — dado, não enfeite. */}
          <span
            className="mt-2 inline-flex shrink-0 rotate-[3deg] flex-col items-center bg-cal px-3 py-2 text-asfalto-27 shadow-[4px_4px_0_rgba(0,0,0,0.55)]"
            aria-label={L(`Formação ${formation}`, `Formation ${formation}`)}
          >
            <span className="font-prova text-[9px] font-bold uppercase tracking-[0.2em]">{L('Formação', 'Formation')}</span>
            <span className="font-spray text-[clamp(28px,8vw,44px)] font-black leading-none">{formation}</span>
          </span>
        </div>

        {/* Placar do plantel */}
        <dl className="grid max-w-lg grid-cols-3 gap-px bg-linha">
          {[
            { v: String(squadSize), l: L('Plantel', 'Squad'), d: null },
            { v: `${startersCount}/${startersCap}`, l: L('Titulares', 'Starters'), d: null },
            { v: xiAvgLabel, l: 'OVR XI', d: xiD },
          ].map((m) => (
            <div
              key={m.l}
              className={cn('flex min-w-0 flex-col gap-1.5 px-3 py-3 sm:px-4 sm:py-4', m.d ? DEGRAU_CLASSES[m.d] : 'bg-concreto text-papel')}
            >
              <dd className={cn('font-impact text-[clamp(26px,7vw,40px)] leading-none tabular-nums', m.d && ovrNumeroClasses(m.d))}>{m.v}</dd>
              <dt className="font-prova text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">{m.l}</dt>
            </div>
          ))}
        </dl>

        {/* CTAs — principal em rua com sombra dura; secundários em contorno */}
        <div className="flex flex-col items-stretch gap-3 pr-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onChooseFormation}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 bg-rua px-6 font-impact text-[20px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)]"
          >
            {L('Escolher formação', 'Choose formation')} <span aria-hidden>→</span>
          </button>
          <button
            type="button"
            onClick={onCreatePlayer}
            disabled={academyFull}
            title={academyFull
              ? L(`Academia cheia (${academyUsed}/${academyCap}). Vende um jogador ao Market Maker pra liberar slot.`, `Academy full (${academyUsed}/${academyCap}). Sell a player to the Market Maker to free a slot.`)
              : L(`Academia: ${academyUsed}/${academyCap} slots usados`, `Academy: ${academyUsed}/${academyCap} slots used`)}
            className={cn(
              'inline-flex min-h-[52px] items-center justify-center gap-2 border-2 px-5 font-impact text-[18px] uppercase leading-none transition-colors',
              academyFull
                ? 'cursor-not-allowed border-dashed border-fio text-mudo'
                : 'border-papel text-papel hover:bg-papel hover:text-asfalto-27',
            )}
          >
            {L('Criar jogador', 'Create player')}
            <span className={cn('font-prova text-[12px] font-bold', academyFull ? 'text-baixa' : 'opacity-70')}>
              {academyUsed}/{academyCap}
            </span>
          </button>
          {favoriteRealTeamName ? (
            <Link
              to="/ranking?tab=nacional&heart=1"
              className="inline-flex min-h-[44px] min-w-0 items-center gap-2 font-impact text-[17px] uppercase leading-none text-rua hover:text-papel"
            >
              <span className="min-w-0 truncate">Ranking · {favoriteRealTeamName}</span> <span aria-hidden>→</span>
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
  const d = degrauDe(player.ovr);
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
        aria-label={L(`Abrir ações para ${player.name}`, `Open actions for ${player.name}`)}
      >
        {/* Token redondo (avatar pode ser rounded-full) com anel do degrau */}
        <div className={cn('relative size-12 overflow-hidden rounded-full bg-asfalto-27 sm:size-14 md:size-16', anelDegrau(d))}>
          {player.countryFlagEmoji ? (
            <span
              className="absolute bottom-0 left-0 z-[5] bg-asfalto-27/80 px-[2px] text-[9px] leading-none sm:text-[10px] md:text-[12px]"
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

        <div className="mt-1 max-w-[min(5.5rem,24vw)] truncate bg-asfalto-27 px-1 py-0.5 font-voz text-[11px] leading-none text-papel sm:mt-1.5 sm:max-w-[6.5rem] sm:px-1.5 sm:text-[13px] md:max-w-[7.5rem] md:px-2 md:text-[15px]">
          {playerDisplayName(player)}
        </div>

        <OvrSelo
          ovr={player.ovr}
          className="pointer-events-none absolute -right-1 -top-1 h-5 min-w-5 px-0.5 text-[11px] sm:-right-1.5 sm:-top-1.5 sm:h-6 sm:min-w-6 sm:text-[12px] md:-right-2 md:-top-2 md:h-7 md:min-w-7 md:text-[14px]"
        />
      </button>
    </motion.div>
  );
}
