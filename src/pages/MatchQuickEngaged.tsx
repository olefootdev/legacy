/**
 * MatchQuickEngaged — Partida Rápida 2.0 (Fase C do Quick Match redesign).
 *
 * Experiência baseada no motor Python (plano pré-computado) + Analyst Beats,
 * isolada do fluxo tick-by-tick legado. O MatchQuick gateia por
 * VITE_QUICK_PLAN_ENABLED: flag ON → esta página; OFF → o motor antigo intacto.
 *
 * Fluxo: kickoff → 1º tempo (QuickPlanPlayer com 2 beats) → INTERVALO (5 cards
 * top3+bottom2, sub, tática, 15s) → replan do 2º tempo no Python com a lineup
 * ajustada → 2º tempo → apito final com Leitura de Jogo.
 *
 * Tempo-alvo: ~25s por tempo (speedMultiplier derivado do plano).
 *
 * NOTA (Fase D): a progressão real (XP/fadiga/economia) ainda NÃO é creditada
 * aqui — o reducer FINALIZE_MATCH depende do loop tick. A flag fica OFF em
 * produção até a Fase D plugar a progressão consolidada.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { getEffectiveFatigue } from '@/systems/fatigue';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';
import { fetchQuickPlan } from '@/match/quickPlanClient';
import type { MatchPlan } from '@/match/quickPlanTypes';
import {
  QuickPlanPlayer,
  type QuickPlanHalftimeContext,
  type QuickPlanPlayResult,
  matchRating,
  type PenaltyTaker,
  type SquadCard,
} from '@/match/QuickPlanPlayer';
import {
  buildQuickPlanInputs,
  playerToHomeView,
  applyFormationToPayloads,
  type QuickHomePlayerView,
} from '@/match/quickEngaged/buildQuickPlanInputs';
import {
  QuickHalftimePanel,
  type HalftimeResult,
} from '@/components/matchquick/QuickHalftimePanel';

type Phase = 'loading' | 'kickoff' | 'playing' | 'finished' | 'error';

export default function MatchQuickEngaged() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const players = useGameStore((s) => s.players);
  const playerHealth = useGameStore((s) => s.playerHealth);
  const lineup = useGameStore((s) => s.lineup);
  const club = useGameStore((s) => s.club);
  const nextFixture = useGameStore((s) => s.nextFixture);
  const homeCrestUrl = useGameStore((s) => matchdayHomeCrestUrl(s.userSettings));

  const [phase, setPhase] = useState<Phase>('loading');
  const [plan, setPlan] = useState<MatchPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickPlanPlayResult | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [halftimeCtx, setHalftimeCtx] = useState<QuickPlanHalftimeContext | null>(null);

  // Estado vivo da lineup home (subs do intervalo persistem aqui)
  const homePlayersRef = useRef<QuickHomePlayerView[]>([]);
  // Quick plan usa taxonomia própria (defensive/balanced/offensive), distinta
  // da quickMatchIntensity legada (counter/press/...). Começa equilibrado.
  const intensityRef = useRef<'defensive' | 'balanced' | 'offensive'>('balanced');
  const formationRef = useRef<string>((lineup as { formation?: string })?.formation ?? '4-4-2');
  const awayLineupRef = useRef<import('@/match/quickPlanClient').QuickPlanPlayerPayload[]>([]);
  const seedRef = useRef<string>('');
  const baseStrengthRef = useRef<{ home: number; away: number }>({ home: 70, away: 70 });
  const htResolverRef = useRef<((p: MatchPlan | null) => void) | null>(null);
  const startedRef = useRef(false);

  const opponent = nextFixture?.opponent;
  const hasOpponent = !!opponent && opponent.id !== 'placeholder-opponent' && opponent.id !== 'no-opponent-available';

  // Banco: titulares de fora, saudáveis
  const bench = useMemo<QuickHomePlayerView[]>(() => {
    const starterIds = new Set(homePlayersRef.current.map((p) => p.id));
    return Object.values(players)
      .filter((p) => {
        if (starterIds.has(p.id)) return false;
        const h = playerHealth?.[p.id];
        if (h) return (h.outForMatches ?? 0) <= 0 && (h.suspendedMatches ?? 0) <= 0;
        return (p.outForMatches ?? 0) <= 0;
      })
      .map((p) => playerToHomeView(p, getEffectiveFatigue(p.id, p, playerHealth)))
      .sort((a, b) => b.effective - a.effective)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, playerHealth, halftimeCtx]); // recomputa ao abrir o intervalo

  // Monta + busca o plano uma vez
  useEffect(() => {
    if (startedRef.current || !hasOpponent) return;
    startedRef.current = true;
    (async () => {
      try {
        const seed = `${club.shortName}-${opponent!.shortName}-${opponent!.id}-${Date.now()}`;
        seedRef.current = seed;
        const { input, homePlayers } = buildQuickPlanInputs({
          players,
          playerHealth,
          lineup: lineup as Record<string, string>,
          homeShort: club.shortName,
          awayShort: opponent!.shortName,
          awayStrength: opponent!.strength ?? 72,
          intensity: intensityRef.current,
          seed,
          awaySeedKey: `${opponent!.id}|away`,
        });
        homePlayersRef.current = homePlayers;
        awayLineupRef.current = input.awayLineup;
        baseStrengthRef.current = { home: input.homeStrength, away: input.awayStrength };
        const fetched = await fetchQuickPlan(input);
        if (!fetched) {
          setError('Não foi possível gerar a partida (motor offline). Tente novamente.');
          setPhase('error');
          return;
        }
        setPlan(fetched);
        setPhase('kickoff');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOpponent]);

  // Kickoff 3-2-1
  useEffect(() => {
    if (phase !== 'kickoff') return undefined;
    if (countdown <= 0) {
      setPhase('playing');
      return undefined;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => window.clearTimeout(t);
  }, [phase, countdown]);

  // Ritmo fixo 1x: as durações por tier (quickPlanTypes) já miram ~30s de jogo.
  // Sem compressão dinâmica — previsível e calibrável num lugar só.
  const speedMultiplier = 1.0;

  // Batedores de pênalti: top finalizadores em campo (recalcula após subs/replan).
  const penaltyTakers = useMemo<PenaltyTaker[]>(() => {
    return [...homePlayersRef.current]
      .sort((a, b) => b.payload.finalizacao - a.payload.finalizacao)
      .slice(0, 4)
      .map((p) => ({
        id: p.id,
        name: p.name,
        finalizacao: p.payload.finalizacao,
        portrait: players[p.id] ? playerPortraitSrc(players[p.id]!, 48, 48) : null,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, players]);

  // QuickHomePlayerView → SquadCard (5 cards + banco).
  const toSquadCard = useCallback(
    (p: QuickHomePlayerView): SquadCard => ({
      id: p.id,
      name: p.name,
      pos: p.pos,
      ovr: p.ovr,
      fatigue: p.fatigue,
      portrait: players[p.id] ? playerPortraitSrc(players[p.id]!, 48, 48) : null,
    }),
    [players],
  );

  // Resolver de foto pro feed (item 8): home tem retrato; away é sintético.
  const portraitOf = useCallback(
    (actorId: string | undefined, side: 'home' | 'away' | undefined): string | null => {
      if (!actorId || side === 'away') return null;
      const p = players[actorId];
      return p ? playerPortraitSrc(p, 48, 48) : null;
    },
    [players],
  );

  // Seam do intervalo: abre o painel, espera a decisão, replaneja o 2º tempo
  const onSecondHalf = useCallback(async (ctx: QuickPlanHalftimeContext): Promise<MatchPlan | null> => {
    setHalftimeCtx(ctx);
    return new Promise<MatchPlan | null>((resolve) => {
      htResolverRef.current = resolve;
    });
  }, []);

  const resumeFromHalftime = useCallback(
    async (ht: HalftimeResult) => {
      const ctx = halftimeCtx;
      setHalftimeCtx(null);
      homePlayersRef.current = ht.homePlayers;
      intensityRef.current = ht.intensity;
      formationRef.current = ht.formation;
      const resolve = htResolverRef.current;
      htResolverRef.current = null;
      if (!ctx || !resolve) return;
      try {
        // Formação remapeia os roles → muda a matchup matrix de verdade.
        const homeLineup = applyFormationToPayloads(
          ht.homePlayers.map((p) => p.payload),
          ht.formation,
        );
        const replan = await fetchQuickPlan({
          seed: seedRef.current,
          homeShort: club.shortName,
          awayShort: opponent!.shortName,
          homeStrength: baseStrengthRef.current.home,
          awayStrength: baseStrengthRef.current.away,
          intensity: ht.intensity,
          homeLineup,
          awayLineup: awayLineupRef.current, // mesmo adversário do 1º tempo
          mode: 'second_half',
          firstHalf: {
            home_score: ctx.homeScore,
            away_score: ctx.awayScore,
            momentum_end: ctx.momentumEnd,
            cards_home: ctx.cardsHome,
            cards_away: ctx.cardsAway,
            sent_off_home: ctx.sentOffHome,
            sent_off_away: ctx.sentOffAway,
          },
          decisions: ctx.ledger.map((d) => ({
            beat_id: d.beat_id,
            choice_id: d.choice_id,
            channel: d.channel,
            target_side: d.target_side,
            weight: d.weight,
          })),
        });
        resolve(replan);
      } catch {
        resolve(null);
      }
    },
    [halftimeCtx, club.shortName, opponent],
  );

  const creditedRef = useRef(false);
  const onComplete = useCallback((_p: MatchPlan, r: QuickPlanPlayResult) => {
    setResult(r);
    setPhase('finished');
    // CRÉDITO DE PROGRESSÃO (Fase D): credita XP/economia/evolução/fadiga +
    // Manager IQ uma única vez por partida.
    if (creditedRef.current) return;
    creditedRef.current = true;
    const homeStats: Record<string, { passesOk: number; passesAttempt: number; tackles: number; km: number; rating: number; shotsOn?: number }> = {};
    for (const p of homePlayersRef.current) {
      const t = r.playerStats[p.id];
      homeStats[p.id] = { passesOk: 0, passesAttempt: 0, tackles: 0, km: 0, rating: matchRating(p.ovr, t), shotsOn: t?.shots ?? 0 };
    }
    dispatch({
      type: 'FINALIZE_QUICK_PLAN',
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      reading: r.reading,
      homeStats,
      homeOnPitch: r.homeOnPitch,
      agg: { shots: r.stats.homeShots, possessionHome: r.stats.possessionHome, wasLosing: false },
      mvpName: _p.mvp_projection?.name,
    });
  }, [dispatch]);

  // ── Render ────────────────────────────────────────────────────────────
  if (!hasOpponent) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-white/70 mb-4">Nenhum adversário disponível para a partida rápida.</p>
          <Link to="/" className="text-neon-yellow font-display uppercase tracking-[0.2em] text-[12px]">
            ← Voltar
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="font-display uppercase tracking-[0.28em] text-[10px] font-black text-neon-yellow/80">
            Partida Rápida
          </span>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-[11px] font-display uppercase tracking-[0.2em] text-white/40 hover:text-white"
          >
            Sair
          </button>
        </div>

        {phase === 'loading' && (
          <p className="text-center text-white/50 py-20 animate-pulse">Preparando o time…</p>
        )}

        {phase === 'error' && (
          <div className="border border-rose-500/40 border-l-[3px] border-l-rose-400 bg-rose-500/10 px-4 py-3">
            <p className="text-[12px] text-white/80">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-3 text-neon-yellow font-display uppercase tracking-[0.2em] text-[11px]"
            >
              ← Home
            </button>
          </div>
        )}

        {phase === 'kickoff' && (
          <div className="flex items-center justify-center py-24">
            <motion.span
              key={countdown}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-serif italic text-white"
              style={{ fontFamily: 'var(--font-serif-hero)', fontSize: '8rem' }}
            >
              {countdown > 0 ? countdown : 'BOLA!'}
            </motion.span>
          </div>
        )}

        {(phase === 'playing' || phase === 'finished') && plan && (
          <QuickPlanPlayer
            key={plan.seed}
            plan={plan}
            speedMultiplier={speedMultiplier}
            onSecondHalf={onSecondHalf}
            onComplete={onComplete}
            portraitOf={portraitOf}
            homeCrestUrl={homeCrestUrl}
            awayCrestUrl={opponent!.supporterCrestUrl ?? null}
            homeName={club.name}
            awayName={opponent!.name}
            penaltyTakers={penaltyTakers}
            fieldCards={homePlayersRef.current.map(toSquadCard)}
            awayCards={awayLineupRef.current.map((p) => ({
              id: p.id,
              name: p.name,
              pos: p.pos,
              ovr: Math.round((p.finalizacao + p.passe + p.marcacao + p.velocidade + p.fisico + p.confianca) / 6),
              fatigue: p.fatigue ?? 0,
              portrait: null,
            }))}
            benchCards={bench.map(toSquadCard)}
            onSubstitution={(outId, inId) => {
              // Mantém o elenco vivo do pai em sincronia (replan do intervalo + pênalti).
              const inView = bench.find((b) => b.id === inId);
              if (!inView) return;
              homePlayersRef.current = homePlayersRef.current.map((p) =>
                p.id === outId ? { ...inView, payload: { ...inView.payload, role: p.payload.role } } : p,
              );
            }}
          />
        )}

        {phase === 'finished' && result && (
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => navigate(0)}
              className="w-full py-3 bg-neon-yellow hover:bg-white text-black font-display uppercase tracking-[0.18em] text-[12px] font-black transition-colors"
            >
              Jogar de novo
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full py-2.5 border border-zinc-700 text-white/70 font-display uppercase tracking-[0.18em] text-[11px] hover:border-white/50 transition-colors"
            >
              Voltar para a Home
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {halftimeCtx && (
          <QuickHalftimePanel
            homeShort={club.shortName}
            awayShort={opponent!.shortName}
            homeScore={halftimeCtx.homeScore}
            awayScore={halftimeCtx.awayScore}
            homePlayers={homePlayersRef.current}
            bench={bench}
            intensity={intensityRef.current}
            formation={formationRef.current}
            onResume={resumeFromHalftime}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
