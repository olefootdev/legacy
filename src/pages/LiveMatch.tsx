import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  Settings,
  Activity,
  Shield,
  Crosshair,
  ArrowRightLeft,
  FastForward,
  Sliders,
  MessageSquare,
  Users,
  Zap,
  Brain,
  LayoutGrid,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MatchBabylonLayer } from '@/components/MatchBabylonLayer';
import { CoachTechnicalCommandsBlock } from '@/components/CoachTechnicalCommandsBlock';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { mergeLineupWithDefaults } from '@/entities/lineup';
import { overallFromAttributes, playerToCardView } from '@/entities/player';
import type { LiveMatchSnapshot, MatchEventEntry, PitchPlayerState } from '@/engine/types';
import type { LivePrematchBundle } from '@/gamespirit/storyContracts';
import type { Fixture } from '@/entities/types';
import { STYLE_PRESETS, normalizeStyle, styleAdherence, createStyleMetrics } from '@/tactics/playingStyle';
import type { PastResult } from '@/entities/types';
import { buildLivePrematchBundle } from '@/gamespirit/buildLivePrematch';
import { prematchCoachSuggestion } from '@/gamespirit/prematchCoachSuggestion';
import { hashStringSeed } from '@/match/seededRng';
import { MatchdayVersusInline, MatchdayLiveScoreRibbon } from '@/components/matchday/MatchdayVersusTitle';

type RetroMvpRow = { id: string; label: string; mvpLine: string };

function LiveMatchPreBriefingFullPage({
  live,
  manager,
  fixture,
  prematchBundle,
  coachSuggestion,
  awayFormationLabel,
  recentRetroMvps,
  onContinue,
}: {
  live: LiveMatchSnapshot;
  manager: { formationScheme: string; tacticalStyle?: { presetId?: string } };
  fixture: Fixture;
  prematchBundle: LivePrematchBundle | null;
  coachSuggestion: string;
  awayFormationLabel: string;
  recentRetroMvps: RetroMvpRow[];
  onContinue: () => void;
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-deep-black text-white font-sans">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-black/90 backdrop-blur-md px-4 py-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-[11px] font-display font-bold uppercase tracking-wider shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
          Voltar
        </Link>
        <div className="text-center min-w-0 flex-1">
          <span className="text-[9px] font-display font-bold uppercase tracking-[0.25em] text-neon-yellow block mb-0.5">
            Pré-match
          </span>
          <MatchdayVersusInline
            homeShort={live.homeShort}
            awayShort={live.awayShort}
            className="text-sm md:text-base truncate block max-w-full"
          />
        </div>
        <div className="w-16 shrink-0 text-right text-[9px] text-gray-500 font-medium hidden sm:block">
          ~{Math.round(live.travelKm)} km
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8 pb-24 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500">
          <span className="font-display font-bold uppercase tracking-widest text-gray-400">GameSpirit</span>
          <span>
            Viagem ~{Math.round(live.travelKm)} km • Subs {live.substitutionsUsed}/3
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-white/10 bg-[#0d0d0d] rounded-lg p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3 text-neon-yellow">
              <LayoutGrid className="w-4 h-4" />
              <span className="text-[10px] font-display font-bold uppercase tracking-widest">
                {live.homeShort} — Formação {manager.formationScheme}
              </span>
            </div>
            <ul className="space-y-1.5 max-h-64 md:max-h-80 overflow-y-auto pr-1">
              {[...live.homePlayers]
                .sort((a, b) => a.num - b.num)
                .map((p) => (
                  <li
                    key={p.playerId}
                    className="flex justify-between text-[11px] md:text-xs font-display font-bold text-white border-b border-white/5 pb-1.5"
                  >
                    <span className="text-gray-500 w-7">{p.num}</span>
                    <span className="flex-1 truncate px-2">{p.name}</span>
                    <span className="text-gray-400 shrink-0">{p.pos}</span>
                  </li>
                ))}
            </ul>
          </div>

          <div className="border border-white/10 bg-[#0d0d0d] rounded-lg p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3 text-gray-300">
              <LayoutGrid className="w-4 h-4" />
              <span className="text-[10px] font-display font-bold uppercase tracking-widest">
                {live.awayShort} — Formação {awayFormationLabel} (IA)
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
              Elenco modelado pela força {fixture.opponent.strength}. Destaque provável:{' '}
              <span className="text-white font-bold">
                {fixture.opponent.highlightPlayer?.name ?? '—'} (
                {fixture.opponent.highlightPlayer?.ovr ?? fixture.opponent.strength} OVR)
              </span>
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 text-[9px] text-center text-gray-500 font-bold uppercase">
              {Array.from({ length: 11 }, (_, i) => (
                <div key={i} className="border border-white/10 rounded py-2 bg-black/40">
                  V{i + 1}
                </div>
              ))}
            </div>
          </div>
        </div>

        {recentRetroMvps.length > 0 && (
          <div className="border border-white/10 bg-black/50 rounded-lg p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3 text-gray-300">
              <Trophy className="w-4 h-4 text-neon-yellow" />
              <span className="text-[10px] font-display font-bold uppercase tracking-widest">
                Últimos MVPs (retrospecto por partida)
              </span>
            </div>
            <ul className="space-y-2">
              {recentRetroMvps.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] border-b border-white/5 pb-2 last:border-0"
                >
                  <span className="text-white font-display font-bold tracking-wide">{row.label}</span>
                  <span className="text-fuchsia-300/90 font-medium">{row.mvpLine}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {prematchBundle && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="border border-neon-yellow/25 bg-neon-yellow/5 rounded-lg p-4 md:p-5 space-y-3">
              <p className="text-[10px] font-display font-bold uppercase tracking-widest text-neon-yellow">
                Forças setoriais
              </p>
              <SectorCompareRow
                label="Defensivo"
                home={prematchBundle.sectorHome.defensive}
                away={prematchBundle.sectorAway.defensive}
                homeTag={live.homeShort}
                awayTag={live.awayShort}
              />
              <SectorCompareRow
                label="Criativo"
                home={prematchBundle.sectorHome.creative}
                away={prematchBundle.sectorAway.creative}
                homeTag={live.homeShort}
                awayTag={live.awayShort}
              />
              <SectorCompareRow
                label="Ataque"
                home={prematchBundle.sectorHome.attack}
                away={prematchBundle.sectorAway.attack}
                homeTag={live.homeShort}
                awayTag={live.awayShort}
              />
              <p className="text-[9px] text-gray-500 leading-snug">
                Duelos: def×atk {prematchBundle.matrix.defVsAtk.toFixed(2)} · cri×cri{' '}
                {prematchBundle.matrix.criVsCri.toFixed(2)} · atk×def{' '}
                {prematchBundle.matrix.atkVsDef.toFixed(2)}
              </p>
            </div>
            <div className="border border-white/15 bg-[#111] rounded-lg p-4 md:p-5">
              <div className="flex items-center gap-2 mb-2 text-white">
                <Brain className="w-4 h-4 text-neon-yellow" />
                <span className="text-[10px] font-display font-bold uppercase tracking-widest">
                  Sugestão para o manager
                </span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{coachSuggestion}</p>
              <ul className="mt-3 space-y-1.5 text-[10px] text-gray-500">
                {prematchBundle.highlights.slice(0, 4).map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <Sparkles className="w-3 h-3 shrink-0 text-neon-yellow/70 mt-0.5" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-4 pt-4 border-t border-white/10">
          <p className="text-[11px] text-gray-500 text-center max-w-xl leading-relaxed">
            Depois do clocker de 5 segundos abre-se só o campo ao vivo — escalações e análise ficam nesta página.
          </p>
          <button type="button" className="btn-primary px-12 py-3.5" onClick={onContinue}>
            <span className="btn-primary-inner font-display font-black uppercase tracking-wider">
              Continuar para o apito
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}

function LiveMatchCountdownFullPage({
  live,
  countdownSec,
}: {
  live: LiveMatchSnapshot;
  countdownSec: number;
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-deep-black flex flex-col font-sans text-white">
      <header className="flex items-center px-4 py-3 border-b border-white/10 bg-black/80 shrink-0">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-[11px] font-display font-bold uppercase tracking-wider"
        >
          <ChevronLeft className="w-5 h-5" />
          Voltar
        </Link>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <p className="text-[11px] font-display font-bold uppercase tracking-[0.35em] text-neon-yellow mb-2">
          Partida iniciando
        </p>
        <MatchdayVersusInline
          homeShort={live.homeShort}
          awayShort={live.awayShort}
          className="text-xs text-gray-500 font-display mb-6"
        />
        <p className="font-display font-black text-7xl sm:text-8xl text-white tabular-nums mb-3">
          {Math.max(0, countdownSec)}
        </p>
        <p className="text-sm text-gray-400 font-medium">
          {countdownSec <= 0
            ? 'Bola rolando…'
            : countdownSec === 1
              ? '1 segundo'
              : `${countdownSec} segundos`}
        </p>
      </div>
    </div>
  );
}

function LiveMatchPostFullPage({
  live,
  matchOutcome,
  matchMvp,
  postMatchEvents,
  onContinue,
}: {
  live: LiveMatchSnapshot;
  matchOutcome: { kind: 'win' | 'draw' | 'loss'; label: string; sub: string };
  matchMvp: { name: string; num: number; pos: string; score: number } | null;
  postMatchEvents: MatchEventEntry[];
  onContinue: () => void;
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-deep-black text-white font-sans">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-black/90 backdrop-blur-md px-4 py-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-[11px] font-display font-bold uppercase tracking-wider shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
          Início
        </Link>
        <span className="text-[9px] font-display font-bold uppercase tracking-widest text-gray-500">Pós-match</span>
        <div className="w-16 shrink-0" />
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-10 pb-20">
        <span
          className={cn(
            'font-display font-black text-4xl md:text-5xl uppercase tracking-wider block text-center mb-2',
            matchOutcome.kind === 'win' && 'text-neon-green',
            matchOutcome.kind === 'draw' && 'text-gray-300',
            matchOutcome.kind === 'loss' && 'text-red-500',
          )}
        >
          {matchOutcome.label}
        </span>
        <p className="text-white font-display font-black text-5xl md:text-6xl text-center mb-1">
          {live.homeScore}–{live.awayScore}
        </p>
        <div className="flex justify-center mb-10">
          <MatchdayVersusInline
            homeShort={live.homeShort}
            awayShort={live.awayShort}
            className="text-sm text-gray-500 font-display font-bold tracking-wider"
          />
        </div>

        {matchMvp && (
          <div className="border border-neon-yellow/40 bg-neon-yellow/10 rounded-xl p-5 mb-8 text-center">
            <div className="flex items-center justify-center gap-2 text-neon-yellow mb-2">
              <Trophy className="w-5 h-5" />
              <span className="text-[10px] font-display font-bold uppercase tracking-widest">MVP da partida</span>
            </div>
            <p className="font-display font-black text-2xl md:text-3xl text-white uppercase tracking-wide">
              {matchMvp.name}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              #{matchMvp.num} · {matchMvp.pos} · GameSpirit score {matchMvp.score.toFixed(1)}
            </p>
          </div>
        )}

        <div className="mb-10">
          <p className="text-[10px] font-display font-bold uppercase tracking-widest text-gray-500 mb-2">
            Eventos do jogo
          </p>
          <div className="max-h-72 md:max-h-96 overflow-y-auto border border-white/10 rounded-lg bg-black/40 divide-y divide-white/5">
            {postMatchEvents.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">Sem eventos registados.</p>
            ) : (
              postMatchEvents.map((ev) => (
                <div key={ev.id} className="px-3 py-2.5 text-sm text-gray-300 leading-snug">
                  <span className="text-gray-500 font-mono mr-2">{ev.minute}&apos;</span>
                  {ev.text}
                </div>
              ))
            )}
          </div>
        </div>

        <button type="button" className="btn-primary px-10 py-3.5 w-full max-w-md mx-auto block" onClick={onContinue}>
          <span className="btn-primary-inner font-display font-black uppercase tracking-wider">Continuar</span>
        </button>
      </main>
    </div>
  );
}

export function LiveMatch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useGameDispatch();
  const live = useGameStore((s) => s.liveMatch);
  const club = useGameStore((s) => s.club);
  const fixture = useGameStore((s) => s.nextFixture);
  const playersById = useGameStore((s) => s.players);
  const lineupIds = useGameStore((s) => s.lineup);
  const manager = useGameStore((s) => s.manager);
  const results = useGameStore((s) => s.results);

  const [selectedPlayer, setSelectedPlayer] = useState<PitchPlayerState | null>(null);
  const [activeTab, setActiveTab] = useState('tatica');
  const [prematchUiPhase, setPrematchUiPhase] = useState<'briefing' | 'countdown'>('briefing');
  const [countdownSec, setCountdownSec] = useState(5);

  const tempo = manager.tempo;

  const legacyMode = searchParams.get('mode');
  if (legacyMode === 'auto') {
    return <Navigate to="/match/auto" replace />;
  }
  if (legacyMode === 'fast' || legacyMode === 'quick') {
    return <Navigate to="/match/quick" replace />;
  }

  useEffect(() => {
    if (!getGameState().liveMatch) {
      dispatch({ type: 'START_LIVE_MATCH', mode: 'live' });
    }
  }, [dispatch]);

  const maxOvr = useMemo(() => {
    const vals = Object.values(playersById);
    if (!vals.length) return 88;
    return Math.max(...vals.map((p) => overallFromAttributes(p.attrs)));
  }, [playersById]);

  const onPitchIds = useMemo(() => {
    if (live?.matchLineupBySlot && Object.keys(live.matchLineupBySlot).length > 0) {
      return new Set(Object.values(live.matchLineupBySlot));
    }
    return new Set(Object.values(mergeLineupWithDefaults(lineupIds, playersById)));
  }, [live, lineupIds, playersById]);

  const benchCards = useMemo(() => {
    return Object.values(playersById)
      .filter((p) => !onPitchIds.has(p.id) && p.outForMatches <= 0)
      .slice(0, 8)
      .map((p) => playerToCardView(p, maxOvr));
  }, [playersById, onPitchIds, maxOvr]);

  const time = live?.minute ?? 0;
  const players = live?.homePlayers ?? [];
  const homeStats = live?.homeStats ?? {};
  const phase = live?.phase;
  const mode = live?.mode ?? 'live';
  if (live && live.mode !== 'live') {
    return <Navigate to={live.mode === 'auto' ? '/match/auto' : '/match/quick'} replace />;
  }

  const mentality = manager.tacticalMentality;
  const defLine = manager.defensiveLine;

  const labelMentality = mentality > 66 ? 'Ofensiva' : mentality < 34 ? 'Defensiva' : 'Equilibrada';
  const labelDef = defLine > 66 ? 'Alta' : defLine < 34 ? 'Baixa' : 'Média';
  const labelTempo = tempo > 66 ? 'Acelerado' : tempo < 34 ? 'Cadenciado' : 'Médio';

  const pushManager = (partial: { tacticalMentality?: number; defensiveLine?: number; tempo?: number }) => {
    dispatch({ type: 'SET_MANAGER_SLIDERS', partial });
  };

  const selectedLive =
    selectedPlayer && players.length
      ? players.find((p) => p.playerId === selectedPlayer.playerId) ?? selectedPlayer
      : selectedPlayer;
  const selectedStats = selectedLive ? homeStats[selectedLive.playerId] : undefined;
  const styleMetrics = useMemo(() => {
    const m = createStyleMetrics();
    const evs = live?.events ?? [];
    for (const ev of evs) {
      const t = ev.text.toLowerCase();
      if (t.includes('cruz')) m.crossesAttempted++;
      if (t.includes('finaliza') || t.includes('chute')) {
        if (t.includes('fora') || t.includes('long')) m.shotsOutsideBox++;
        else m.shotsInsideBox++;
      }
      if (t.includes('recuperação') || t.includes('pressão')) m.highPressEvents++;
    }
    const statsRows = Object.values(homeStats);
    for (const s of statsRows) {
      m.shortPasses += s.passesOk;
    }
    m.longPasses = Math.round(m.shortPasses * (normalizeStyle(manager.tacticalStyle).buildUp ?? 0.5) * 0.25);
    return m;
  }, [live?.events, homeStats, manager.tacticalStyle]);
  const styleScore = styleAdherence(manager.tacticalStyle, styleMetrics);

  useEffect(() => {
    if (phase === 'pregame') setPrematchUiPhase('briefing');
  }, [phase, live?.simulationSeed]);

  const homeRosterEntities = useMemo(() => {
    const lu = mergeLineupWithDefaults(lineupIds, playersById);
    const ids = new Set(Object.values(lu));
    return Array.from(ids)
      .map((id) => playersById[id])
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [lineupIds, playersById]);

  const prematchBundle = useMemo(() => {
    if (live?.livePrematch) return live.livePrematch;
    if (!live || phase !== 'pregame') return null;
    const seed =
      live.simulationSeed ?? hashStringSeed(`${live.homeShort}|${live.awayShort}|fallback`);
    return buildLivePrematchBundle({
      homePlayers: live.homePlayers,
      homeRoster: homeRosterEntities,
      opponentStrength: fixture.opponent.strength,
      homeShort: live.homeShort,
      awayShort: live.awayShort,
      simulationSeed: seed,
    });
  }, [live, phase, fixture.opponent.strength, homeRosterEntities]);

  const coachSuggestion = useMemo(() => {
    if (!prematchBundle) return '';
    return prematchCoachSuggestion(prematchBundle, {
      tacticalMentality: manager.tacticalMentality,
      defensiveLine: manager.defensiveLine,
      tempo: manager.tempo,
      playingStyleLabel: String(manager.tacticalStyle?.presetId ?? 'balanced'),
    });
  }, [
    prematchBundle,
    manager.tacticalMentality,
    manager.defensiveLine,
    manager.tempo,
    manager.tacticalStyle?.presetId,
  ]);

  const awayFormationLabel = useMemo(() => {
    const options = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2'] as const;
    const h = hashStringSeed(fixture.opponent.id || 'away');
    return options[Math.abs(h) % options.length]!;
  }, [fixture.opponent.id]);

  const recentRetroMvps = useMemo(
    () => buildRecentRetroMvps(results.slice(-12), club.shortName),
    [results, club.shortName],
  );

  const matchMvp = useMemo(
    () => (live && phase === 'postgame' ? computeHomeMatchMvp(players, homeStats) : null),
    [live, phase, players, homeStats],
  );

  const matchOutcome = useMemo(() => {
    if (!live || phase !== 'postgame') return null;
    const gf = live.homeScore;
    const ga = live.awayScore;
    if (gf > ga) return { kind: 'win' as const, label: 'Vitória', sub: `${gf}–${ga}` };
    if (gf < ga) return { kind: 'loss' as const, label: 'Derrota', sub: `${gf}–${ga}` };
    return { kind: 'draw' as const, label: 'Empate', sub: `${gf}–${ga}` };
  }, [live, phase]);

  const postMatchEvents = useMemo(() => {
    if (!live?.events?.length) return [];
    return [...live.events].reverse();
  }, [live?.events]);

  useEffect(() => {
    if (prematchUiPhase !== 'countdown' || phase !== 'pregame') return;
    setCountdownSec(5);
    let n = 5;
    const id = window.setInterval(() => {
      n -= 1;
      setCountdownSec(n);
      if (n <= 0) {
        window.clearInterval(id);
        dispatch({ type: 'BEGIN_PLAY_FROM_PREGAME' });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [prematchUiPhase, phase, dispatch]);

  if (!live) {
    return (
      <div className="min-h-[calc(100vh-4rem)] w-full bg-deep-black flex items-center justify-center font-sans">
        <p className="text-gray-500 font-display text-sm uppercase tracking-wider">A preparar partida…</p>
      </div>
    );
  }

  if (phase === 'pregame' && prematchUiPhase === 'briefing') {
    return (
      <LiveMatchPreBriefingFullPage
        live={live}
        manager={manager}
        fixture={fixture}
        prematchBundle={prematchBundle}
        coachSuggestion={coachSuggestion}
        awayFormationLabel={awayFormationLabel}
        recentRetroMvps={recentRetroMvps}
        onContinue={() => setPrematchUiPhase('countdown')}
      />
    );
  }

  if (phase === 'pregame' && prematchUiPhase === 'countdown') {
    return <LiveMatchCountdownFullPage live={live} countdownSec={countdownSec} />;
  }

  if (phase === 'postgame' && matchOutcome) {
    return (
      <LiveMatchPostFullPage
        live={live}
        matchOutcome={matchOutcome}
        matchMvp={matchMvp}
        postMatchEvents={postMatchEvents}
        onContinue={() => {
          dispatch({ type: 'FINALIZE_MATCH' });
          navigate('/');
        }}
      />
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full bg-deep-black flex flex-col md:flex-row font-sans">
      <div className="w-full h-[60vh] md:h-[calc(100vh-4rem)] md:flex-1 relative bg-deep-black overflow-hidden flex flex-col items-center justify-center gap-0 p-4 md:p-8 pt-24 md:pt-8 shrink-0 sticky top-0 z-10">
        <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-start pointer-events-none">
          <Link to="/" className="pointer-events-auto bg-dark-gray border border-white/10 p-3 hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>

          <MatchdayLiveScoreRibbon
            minuteDisplay={time}
            homeShort={live.homeShort}
            awayShort={live.awayShort}
            awaySeed={fixture.opponent.id}
            homeScore={live.homeScore}
            awayScore={live.awayScore}
          />

          <button type="button" className="pointer-events-auto bg-dark-gray border border-white/10 p-3 hover:bg-white/10 transition-colors">
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <div
          className="relative w-full aspect-[105/68] bg-[#1a2e1f] border-2 border-white/40 shadow-2xl overflow-hidden shrink-0 mx-auto"
          style={{
            maxHeight: 'calc(100vh - 120px)',
            maxWidth: 'min(100%, calc((100vh - 120px) * 105 / 68))',
          }}
        >
          <MatchBabylonLayer live={live} manager={manager} />
        </div>

        {phase === 'playing' && live.clockPeriod === 'halftime' && (
          <div
            className="w-full shrink-0 py-2 px-3 text-center text-[10px] font-display font-bold uppercase tracking-wider bg-neon-yellow/15 border-y border-neon-yellow/40 text-neon-yellow mx-auto"
            style={{ maxWidth: 'min(100%, calc((100vh - 120px) * 105 / 68))' }}
          >
            Intervalo • Ajusta tática e banco
          </div>
        )}

        {phase === 'playing' && mode === 'live' && live.liveStory && (
          <div
            className="w-full mx-auto shrink-0"
            style={{ maxWidth: 'min(100%, calc((100vh - 120px) * 105 / 68))' }}
          >
            <CoachTechnicalCommandsBlock
              disabled={live.clockPeriod === 'halftime'}
              minuteApprox={time}
            />
          </div>
        )}

        {phase === 'playing' && players.length > 0 && (
          <div
            className="w-full shrink-0 flex gap-1.5 overflow-x-auto py-2 px-2 hide-scrollbar border-t border-white/10 bg-black/50 mx-auto"
            style={{
              maxWidth: 'min(100%, calc((100vh - 120px) * 105 / 68))',
            }}
          >
            {players.map((p) => (
              <button
                key={p.playerId}
                type="button"
                onClick={() => setSelectedPlayer(p)}
                className={cn(
                  'shrink-0 px-2.5 py-1.5 rounded border text-[10px] font-display font-bold uppercase tracking-wider transition-colors',
                  selectedPlayer?.playerId === p.playerId
                    ? 'bg-neon-yellow border-white text-black'
                    : 'bg-[#111] border-white/30 text-white hover:border-neon-yellow',
                )}
              >
                {p.num} · {p.pos}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedLive && phase === 'playing' && (
        <motion.div
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="fixed left-4 top-24 bottom-24 w-72 sports-panel flex flex-col z-50 hidden md:flex shadow-2xl"
        >
          <div className="p-4 border-b border-white/10 bg-dark-gray flex items-center gap-4 shrink-0">
            <div className="w-16 h-16 bg-[#111] border border-white/10 flex items-center justify-center font-display font-black text-3xl text-neon-yellow -skew-x-6">
              <span className="skew-x-6">{selectedLive.num}</span>
            </div>
            <div>
              <div className="text-neon-yellow font-display font-bold text-sm tracking-widest uppercase">{selectedLive.pos}</div>
              <div className="text-white font-display font-black text-2xl uppercase tracking-wider leading-none">{selectedLive.name}</div>
            </div>
          </div>

          <div className="p-4 space-y-6 flex-1 overflow-y-auto hide-scrollbar">
            <div>
              <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <span>Condição Física</span>
                <span className={selectedLive.fatigue > 50 ? 'text-neon-green' : 'text-red-500'}>{selectedLive.fatigue}%</span>
              </div>
              <div className="h-2 bg-dark-gray skew-x-[-10deg] overflow-hidden">
                <div
                  className={cn('h-full', selectedLive.fatigue > 50 ? 'bg-neon-green' : 'bg-red-500')}
                  style={{ width: `${selectedLive.fatigue}%` }}
                />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Estatísticas da Partida</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-dark-gray border border-white/5 p-3">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Passes</div>
                  <div className="font-display font-bold text-2xl text-white">
                    {selectedStats?.passesOk ?? 0}
                    <span className="text-sm text-gray-500">/{selectedStats?.passesAttempt ?? 0}</span>
                  </div>
                </div>
                <div className="bg-dark-gray border border-white/5 p-3">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Desarmes</div>
                  <div className="font-display font-bold text-2xl text-white">{selectedStats?.tackles ?? 0}</div>
                </div>
                <div className="bg-dark-gray border border-white/5 p-3">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Nota</div>
                  <div className="font-display font-bold text-2xl text-neon-yellow">
                    {(selectedStats?.rating ?? 6.4).toFixed(1)}
                  </div>
                </div>
                <div className="bg-dark-gray border border-white/5 p-3">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Distância</div>
                  <div className="font-display font-bold text-2xl text-white">
                    {(selectedStats?.km ?? 0).toFixed(1)}
                    <span className="text-sm text-gray-500">km</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-white/10 bg-dark-gray shrink-0">
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => setActiveTab('banco')}
            >
              <span className="btn-secondary-inner">
                <ArrowRightLeft className="w-4 h-4" />
                SUBSTITUIR
              </span>
            </button>
          </div>
        </motion.div>
      )}

      <div className="md:w-80 w-full sports-panel md:border-l border-t md:border-t-0 border-white/10 flex flex-col z-40 relative bg-dark-gray/95 backdrop-blur-md shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] md:shadow-none min-h-[50vh] md:min-h-[calc(100vh-4rem)]">
        <div className="p-4 border-b border-white/10 bg-black/40 flex justify-between items-center shrink-0 sticky top-0 z-20 backdrop-blur-md">
          <h3 className="font-display font-bold text-xl uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-5 h-5 text-neon-yellow" />
            Comandos
          </h3>
          <button
            type="button"
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-30"
            disabled={phase !== 'playing'}
            onClick={() => {
              if (mode === 'live') dispatch({ type: 'TICK_MATCH_BULK', steps: 8 });
            }}
            title="Avançar rápido"
          >
            <FastForward className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-white/5">
          Em jogo • Subs {live.substitutionsUsed}/3
        </div>

        <div className="px-4 pt-3 pb-2 border-b border-white/5 max-h-28 overflow-y-auto shrink-0">
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Últimos lances</div>
          <div className="space-y-1">
            {live.events.slice(0, 5).map((ev) => (
              <p key={ev.id} className="text-[10px] text-gray-300 leading-snug">
                {ev.text}
              </p>
            ))}
          </div>
        </div>

        <div className="flex border-b border-white/10 shrink-0 bg-black/20 sticky top-[68px] z-20 backdrop-blur-md">
          {[
            { id: 'tatica', label: 'Tática', icon: Sliders },
            { id: 'acoes', label: 'Ações', icon: MessageSquare },
            { id: 'banco', label: 'Banco', icon: Users },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 py-3 text-[10px] font-bold uppercase tracking-widest flex flex-col items-center gap-1 transition-colors border-b-2',
                activeTab === tab.id
                  ? 'border-neon-yellow text-neon-yellow bg-white/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5',
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 relative flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'tatica' && (
              <motion.div
                key="tatica"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    <span>Playing Style</span>
                    <span className="text-neon-yellow">{manager.tacticalStyle?.presetId ?? 'balanced'}</span>
                  </div>
                  <select
                    value={manager.tacticalStyle?.presetId ?? 'balanced'}
                    disabled={phase !== 'playing'}
                    onChange={(e) => dispatch({ type: 'SET_PLAYING_STYLE_PRESET', presetId: e.target.value as keyof typeof STYLE_PRESETS })}
                    className="w-full bg-black/70 border border-white/20 rounded px-2 py-2 text-xs text-white focus:border-neon-yellow outline-none"
                  >
                    {Object.keys(STYLE_PRESETS).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    <span>Mentalidade</span>
                    <span className="text-neon-yellow">{labelMentality}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={mentality}
                    disabled={phase !== 'playing'}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      pushManager({ tacticalMentality: v });
                    }}
                    className="w-full accent-neon-yellow h-1 bg-black appearance-none cursor-pointer rounded-full disabled:opacity-40"
                  />
                  <div className="flex justify-between text-[9px] text-gray-600 font-bold uppercase tracking-wider mt-2">
                    <span>Retranca</span>
                    <span>Tudo ou Nada</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    <span>Linha Defensiva</span>
                    <span className="text-white">{labelDef}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={defLine}
                    disabled={phase !== 'playing'}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      pushManager({ defensiveLine: v });
                    }}
                    className="w-full accent-white h-1 bg-black appearance-none cursor-pointer rounded-full disabled:opacity-40"
                  />
                  <div className="flex justify-between text-[9px] text-gray-600 font-bold uppercase tracking-wider mt-2">
                    <span>Recuada</span>
                    <span>Avançada</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                    <span>Ritmo de Jogo</span>
                    <span className="text-white">{labelTempo}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={tempo}
                    disabled={phase !== 'playing'}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      pushManager({ tempo: v });
                    }}
                    className="w-full accent-white h-1 bg-black appearance-none cursor-pointer rounded-full disabled:opacity-40"
                  />
                  <div className="flex justify-between text-[9px] text-gray-600 font-bold uppercase tracking-wider mt-2">
                    <span>Cadenciado</span>
                    <span>Veloz</span>
                  </div>
                </div>
                <div className="bg-black/40 border border-white/10 p-3 rounded">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <span>Aderência ao plano</span>
                    <span className="text-neon-green">{styleScore}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-gray-400">
                    <span>Passes curtos/longos: {styleMetrics.shortPasses}/{styleMetrics.longPasses}</span>
                    <span>Cruzamentos: {styleMetrics.crossesAttempted}</span>
                    <span>Finalizações dentro/fora: {styleMetrics.shotsInsideBox}/{styleMetrics.shotsOutsideBox}</span>
                    <span>Pressões altas: {styleMetrics.highPressEvents}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'acoes' && (
              <motion.div
                key="acoes"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 gap-3"
              >
                <button
                  type="button"
                  disabled={phase !== 'playing'}
                  className="bg-black/40 border border-white/10 hover:border-neon-yellow hover:text-neon-yellow hover:bg-neon-yellow/10 py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex flex-col items-center gap-3 disabled:opacity-40"
                  onClick={() => pushManager({ tacticalMentality: Math.min(100, mentality + 8) })}
                >
                  <Crosshair className="w-6 h-6" />
                  Pressionar
                </button>
                <button
                  type="button"
                  disabled={phase !== 'playing'}
                  className="bg-black/40 border border-white/10 hover:border-white hover:bg-white/10 py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex flex-col items-center gap-3 disabled:opacity-40"
                  onClick={() => pushManager({ tacticalMentality: Math.max(0, mentality - 8) })}
                >
                  <Shield className="w-6 h-6" />
                  Recuar
                </button>
                <button
                  type="button"
                  disabled={phase !== 'playing'}
                  className="bg-black/40 border border-white/10 hover:border-blue-400 hover:text-blue-400 hover:bg-blue-400/10 py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex flex-col items-center gap-3 disabled:opacity-40"
                  onClick={() => pushManager({ defensiveLine: Math.min(100, defLine + 10) })}
                >
                  <Brain className="w-6 h-6" />
                  Foco
                </button>
                <button
                  type="button"
                  disabled={phase !== 'playing'}
                  className="bg-black/40 border border-white/10 hover:border-orange-400 hover:text-orange-400 hover:bg-orange-400/10 py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex flex-col items-center gap-3 disabled:opacity-40"
                  onClick={() => pushManager({ tempo: Math.min(100, tempo + 12) })}
                >
                  <Zap className="w-6 h-6" />
                  Intensidade
                </button>
              </motion.div>
            )}

            {activeTab === 'banco' && (
              <motion.div
                key="banco"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {!selectedLive && phase === 'playing' && (
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider text-center py-2">
                    Selecione um titular no campo para trocar.
                  </p>
                )}
                {benchCards.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between bg-black/40 border border-white/10 p-3 rounded-xl hover:border-white/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-dark-gray border border-white/20 rounded-full flex items-center justify-center font-display font-bold text-xs">
                        {sub.num}
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">{sub.name}</div>
                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                          {sub.pos} • OVR {sub.ovr} • FAT {sub.fatigue}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={phase !== 'playing' || !selectedLive}
                      className="text-[10px] font-bold uppercase tracking-wider bg-white/10 hover:bg-white text-white hover:text-black px-3 py-1.5 rounded transition-colors disabled:opacity-30"
                      onClick={() => {
                        if (!selectedLive) return;
                        dispatch({
                          type: 'MATCH_SUBSTITUTE',
                          outPlayerId: selectedLive.playerId,
                          inPlayerId: sub.id,
                        });
                      }}
                    >
                      Sub
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function SectorCompareRow({
  label,
  home,
  away,
  homeTag,
  awayTag,
}: {
  label: string;
  home: number;
  away: number;
  homeTag: string;
  awayTag: string;
}) {
  const t = home + away || 1;
  const wHome = (home / t) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-gray-500">
        <span>{label}</span>
        <span>
          <span className="text-neon-yellow">{homeTag}</span>{' '}
          <span className="text-neon-yellow/90">{home}</span>
          <span className="text-gray-600 mx-1">·</span>
          <span className="text-gray-400">{awayTag}</span>{' '}
          <span className="text-gray-300">{away}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-black/60 overflow-hidden flex">
        <div className="bg-neon-yellow h-full transition-all" style={{ width: `${wHome}%` }} />
        <div className="bg-white/20 h-full flex-1" />
      </div>
    </div>
  );
}

function retroMvpLine(r: PastResult, clubShort: string): string {
  const c = clubShort.toUpperCase();
  const playedHome = r.home.toUpperCase().includes(c);
  const goalsFor = playedHome ? r.scoreHome : r.scoreAway;
  if (r.result === 'win') {
    return goalsFor >= 3 ? 'MVP (retro): frente de ataque em destaque' : 'MVP (retro): equilíbrio e eficiência';
  }
  if (r.result === 'draw') {
    return 'MVP (retro): meio-campo e transições';
  }
  return 'MVP (retro): última linha e transição defensiva';
}

function buildRecentRetroMvps(results: PastResult[], clubShort: string) {
  const c = clubShort.toUpperCase();
  const relevant = [...results].reverse().filter((r) => r.home.toUpperCase().includes(c) || r.away.toUpperCase().includes(c));
  return relevant.slice(0, 5).map((r, i) => ({
    id: `${r.home}-${r.away}-${r.scoreHome}-${r.scoreAway}-${i}`,
    label: `${r.home} ${r.scoreHome}–${r.scoreAway} ${r.away}`,
    mvpLine: retroMvpLine(r, clubShort),
  }));
}

function computeHomeMatchMvp(
  homePlayers: PitchPlayerState[],
  homeStats: Record<string, { passesOk: number; passesAttempt: number; tackles: number; km: number; rating: number }>,
): { name: string; num: number; pos: string; score: number } | null {
  let best: { name: string; num: number; pos: string; score: number } | null = null;
  for (const p of homePlayers) {
    const s = homeStats[p.playerId];
    if (!s) continue;
    const score = s.rating * 18 + s.tackles * 2.2 + s.km * 1.4 + s.passesOk * 0.06;
    if (!best || score > best.score) {
      best = { name: p.name, num: p.num, pos: p.pos, score };
    }
  }
  if (best) return best;
  const gk = homePlayers.find((p) => p.role === 'gk') ?? homePlayers[0];
  if (!gk) return null;
  return { name: gk.name, num: gk.num, pos: gk.pos, score: 0 };
}
