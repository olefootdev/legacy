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
import { fetchQuickPlan, applyLegacyBoostToLineup } from '@/match/quickPlanClient';
import { fetchQuickNarration, type QuickNarration } from '@/match/quickNarrateClient';
import { fetchOpponentRoster } from '@/match/opponentRosterClient';
import { LIGA_OLE_ROUNDS } from '@/match/ligaOle/ligaOleModel';
import type { ShootoutSetup } from '@/components/matchquick/PenaltyShootout';
import type { ShootoutKicker, ShootoutKeeper } from '@/match/quickEngaged/penaltyShootout';
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
  // Liga Ole: detecta no MOUNT se esta partida é da liga (pendingOpponentId),
  // pra mostrar a continuação ("avançou de fase" + Avançar) no pós-jogo.
  const ligaOle = useGameStore((s) => s.ligaOle);
  const ligaFlash = useGameStore((s) => s.ligaOleResultFlash);
  // Evolução do time pós-partida (delta de OVR) — preenchido pelo FINALIZE_QUICK_PLAN.
  const lastEvolution = useGameStore((s) => s.lastQuickEvolution);
  const isLigaOleMatchRef = useRef<boolean | null>(null);
  if (isLigaOleMatchRef.current === null) isLigaOleMatchRef.current = !!ligaOle?.pendingOpponentId;

  const [phase, setPhase] = useState<Phase>('loading');
  const [plan, setPlan] = useState<MatchPlan | null>(null);
  const [narration, setNarration] = useState<QuickNarration | null>(null);
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
        // Elenco REAL do adversário. NUNCA inventa jogadores: usa o stub só se
        // for real (ids sintéticos `gl-syn-*`/`away-*` não contam); senão resolve
        // no backend (profiles → manager_squad). Sintético só como último recurso.
        const stubAway = opponent!.genesisAwayPlayers;
        const isSynthetic = (id: string) => id.startsWith('gl-syn-') || id.startsWith('away-');
        const stubLooksReal = !!stubAway && stubAway.length >= 7 && !stubAway.some((p) => isSynthetic(String(p.id)));
        let awayPlayers = stubLooksReal ? stubAway : undefined;
        if (!awayPlayers) {
          const roster = await fetchOpponentRoster({ clubName: opponent!.name, clubShort: opponent!.shortName });
          if (roster) awayPlayers = roster.players;
          else if (stubAway && stubAway.length >= 7) awayPlayers = stubAway; // último recurso
        }
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
          awayPlayers,
        });
        homePlayersRef.current = homePlayers;
        awayLineupRef.current = input.awayLineup;
        baseStrengthRef.current = { home: input.homeStrength, away: input.awayStrength };
        // Boost PASSIVO das lendas titulares no lineup enviado ao Python — a
        // presença da lenda já pesa na simulação (sem depender do buff manual).
        input.homeLineup = applyLegacyBoostToLineup(input.homeLineup, legacyBoosters);
        const fetched = await fetchQuickPlan(input);
        if (!fetched) {
          setError('Não foi possível gerar a partida (motor offline). Tente novamente.');
          setPhase('error');
          return;
        }
        setPlan(fetched);
        setPhase('kickoff');
        // Pré-busca a narração IA (Sonnet) em paralelo ao kickoff — não bloqueia.
        // Chega antes do 1º beat na maioria das vezes; senão, cai no texto Python.
        fetchQuickNarration(fetched, { home: club.name, away: opponent!.name })
          .then((n) => { if (n) setNarration(n); })
          .catch(() => { /* degradação graciosa */ });
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

  // LEGACY: lendas (isLegacy) titulares dão um buff de time ativável na partida.
  // Deriva o destaque (label + %) do legacyTeamBooster de cada uma.
  const legacyBoosters = useMemo(() => {
    const BOOSTER_LABEL: Record<string, string> = {
      morale: 'MORAL', possession_pct: 'POSSE', attack: 'ATAQUE', defense: 'DEFESA',
      finalizacao: 'FINALIZAÇÃO', velocidade: 'VELOCIDADE', passe: 'PASSE',
    };
    const ids = Object.values(lineup).filter((v): v is string => typeof v === 'string');
    const out: { id: string; name: string; label: string; pct: number }[] = [];
    for (const id of ids) {
      const p = players[id];
      if (!p || !p.isLegacy) continue;
      const entries = Object.entries(p.legacyTeamBooster ?? {});
      let label = 'ATAQUE';
      let pct = 2;
      if (entries.length) {
        entries.sort((a, b) => Number(b[1]) - Number(a[1]));
        const [k, v] = entries[0]!;
        label = BOOSTER_LABEL[k] ?? k.toUpperCase();
        pct = Math.max(1, Math.min(6, Math.round(Number(v) || 2)));
      }
      out.push({ id, name: p.name, label, pct });
    }
    return out.slice(0, 3);
  }, [players, lineup]);

  // Mapa de TODAS as lendas do ELENCO (não só titulares) → buff. Permite que uma
  // lenda que ENTRA por substituição também ofereça o buff. Antes o buff só lia o
  // lineup do kickoff, então o legacy substituído "não carregava" (bug do JUCA).
  const legacyLookup = useMemo(() => {
    const BOOSTER_LABEL: Record<string, string> = {
      morale: 'MORAL', possession_pct: 'POSSE', attack: 'ATAQUE', defense: 'DEFESA',
      finalizacao: 'FINALIZAÇÃO', velocidade: 'VELOCIDADE', passe: 'PASSE',
    };
    const map: Record<string, { name: string; label: string; pct: number }> = {};
    for (const p of Object.values(players)) {
      if (!p.isLegacy) continue;
      const entries = Object.entries(p.legacyTeamBooster ?? {});
      let label = 'ATAQUE';
      let pct = 2;
      if (entries.length) {
        entries.sort((a, b) => Number(b[1]) - Number(a[1]));
        const [k, v] = entries[0]!;
        label = BOOSTER_LABEL[k] ?? k.toUpperCase();
        pct = Math.max(1, Math.min(6, Math.round(Number(v) || 2)));
      }
      map[p.id] = { name: p.name, label, pct };
    }
    return map;
  }, [players]);

  // QuickHomePlayerView → SquadCard (5 cards + banco).
  const toSquadCard = useCallback(
    (p: QuickHomePlayerView): SquadCard => ({
      id: p.id,
      name: p.name,
      pos: p.pos,
      ovr: p.ovr,
      fatigue: p.fatigue,
      portrait: players[p.id] ? playerPortraitSrc(players[p.id]!, 48, 48) : null,
      fairPlay: players[p.id]?.attrs.fairPlay ?? 70,
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
        const homeLineupRaw = applyFormationToPayloads(
          ht.homePlayers.map((p) => p.payload),
          ht.formation,
        );
        // Boost PASSIVO das lendas que ESTÃO em campo no 2º tempo (inclui quem
        // entrou por substituição) — derivado do elenco vivo, não do kickoff.
        const htBoosters = ht.homePlayers
          .map((p) => legacyLookup[p.id])
          .filter((b): b is { name: string; label: string; pct: number } => !!b);
        const homeLineup = applyLegacyBoostToLineup(homeLineupRaw, htBoosters);
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
        // Re-narra o 2º tempo (novos beats/gols 46-90) e mescla na narração viva.
        if (replan) {
          fetchQuickNarration(replan, { home: club.name, away: opponent!.name })
            .then((n) => {
              if (!n) return;
              setNarration((prev) => prev
                ? { beats: { ...prev.beats, ...n.beats }, goals: { ...prev.goals, ...n.goals }, reading: n.reading ?? prev.reading }
                : n);
            })
            .catch(() => { /* mantém narração do 1º tempo */ });
        }
      } catch {
        resolve(null);
      }
    },
    [halftimeCtx, club.shortName, opponent, legacyLookup],
  );

  // DISPUTA DE PÊNALTIS: monta os dados (elenco vivo + goleiros) a partir dos
  // refs com atributos. Desgaste de 90' na fadiga — quem entrou de fora chega
  // mais fresco (recompensa o sub tático na hora da disputa).
  const buildShootout = useCallback((): ShootoutSetup | null => {
    const MATCH_WEAR = 26;
    const wear = (f: number | undefined) => Math.min(100, (f ?? 0) + MATCH_WEAR);
    const home = homePlayersRef.current;
    const away = awayLineupRef.current;
    if (!home.length || !away.length) return null;

    const homeOutfield: ShootoutKicker[] = home
      .filter((p) => p.payload.role !== 'gk')
      .map((p) => ({
        id: p.id, name: p.name, pos: p.pos,
        finalizacao: p.payload.finalizacao, fisico: p.payload.fisico, confianca: p.payload.confianca,
        fatigue: wear(p.payload.fatigue), portrait: players[p.id] ? playerPortraitSrc(players[p.id]!, 40, 40) : null,
      }));
    const awayOutfield: ShootoutKicker[] = away
      .filter((p) => p.role !== 'gk')
      .map((p) => ({
        id: p.id, name: p.name, pos: p.pos,
        finalizacao: p.finalizacao, fisico: p.fisico, confianca: p.confianca, fatigue: wear(p.fatigue),
      }));
    if (homeOutfield.length < 5 || awayOutfield.length < 1) return null;

    const homeGk = home.find((p) => p.payload.role === 'gk');
    const awayGk = away.find((p) => p.role === 'gk');
    const homeKeeper: ShootoutKeeper = homeGk
      ? { id: homeGk.id, name: homeGk.name, marcacao: homeGk.payload.marcacao, confianca: homeGk.payload.confianca, fisico: homeGk.payload.fisico, fatigue: wear(homeGk.payload.fatigue) }
      : { id: 'h-gk', name: 'Goleiro', marcacao: 62, confianca: 60, fisico: 65, fatigue: MATCH_WEAR };
    const awayKeeper: ShootoutKeeper = awayGk
      ? { id: awayGk.id, name: awayGk.name, marcacao: awayGk.marcacao, confianca: awayGk.confianca, fisico: awayGk.fisico, fatigue: wear(awayGk.fatigue) }
      : { id: 'a-gk', name: 'Goleiro', marcacao: 62, confianca: 60, fisico: 65, fatigue: MATCH_WEAR };

    return { homeKickers: homeOutfield, awayKickers: awayOutfield, homeKeeper, awayKeeper };
  }, [players]);

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
      shootoutWin: r.shootout?.winner,
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
            narration={narration ?? undefined}
            buildShootout={buildShootout}
            speedMultiplier={speedMultiplier}
            onSecondHalf={onSecondHalf}
            onComplete={onComplete}
            portraitOf={portraitOf}
            homeCrestUrl={homeCrestUrl}
            awayCrestUrl={opponent!.supporterCrestUrl ?? null}
            homeName={club.name}
            awayName={opponent!.name}
            penaltyTakers={penaltyTakers}
            legacyBoosters={legacyBoosters}
            legacyLookup={legacyLookup}
            initialFormation={formationRef.current}
            fieldCards={homePlayersRef.current.map(toSquadCard)}
            awayCards={awayLineupRef.current.map((p) => ({
              id: p.id,
              name: p.name,
              pos: p.pos,
              ovr: Math.round((p.finalizacao + p.passe + p.marcacao + p.velocidade + p.fisico + p.confianca) / 6),
              fatigue: p.fatigue ?? 0,
              portrait: null,
              fairPlay: p.fair_play ?? 70,
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
            {/* EVOLUÇÃO DO TIME — o manager VÊ que não perdeu tempo: o time melhorou. */}
            {lastEvolution && (lastEvolution.risers.length > 0 || lastEvolution.teamOvrAfter > 0) && (() => {
              const M = 'var(--font-serif-hero)';
              const teamUp = lastEvolution.teamOvrAfter - lastEvolution.teamOvrBefore;
              const risers = lastEvolution.risers.slice(0, 4);
              return (
                <div className="relative overflow-hidden border px-5 py-4 mb-1" style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-dark-gray)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-display uppercase tracking-[0.28em] text-[10px] font-black text-neon-yellow">Seu time evoluiu</p>
                    <span className="font-display tabular-nums text-[12px] font-black" style={{ color: teamUp >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      Força {lastEvolution.teamOvrBefore.toFixed(1)} → {lastEvolution.teamOvrAfter.toFixed(1)}
                    </span>
                  </div>
                  {risers.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {risers.map((r) => (
                        <div key={r.id} className="flex items-center gap-2.5">
                          {players[r.id] && (
                            <img src={playerPortraitSrc(players[r.id]!, 32, 32)} alt="" className="w-7 h-7 rounded-full object-cover bg-deep-black shrink-0" />
                          )}
                          <span className="flex-1 truncate text-white" style={{ fontFamily: M, fontStyle: 'italic', fontWeight: 700, fontSize: '15px' }}>{r.name}</span>
                          <span className="font-display uppercase tracking-[0.1em] text-[9px] font-black text-white/35 shrink-0">{r.pos}</span>
                          <span className="font-display tabular-nums text-[12px] font-black text-success shrink-0">{r.ovrBefore}→{r.ovrAfter}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-white/50 text-[12px]">O elenco segurou o nível. Vença pra acelerar a evolução.</p>
                  )}
                </div>
              );
            })()}

            {/* LIGA OLE — continuação da campanha (avançou / campeão / eliminado) */}
            {isLigaOleMatchRef.current && (() => {
              const M = 'var(--font-serif-hero)';
              if (ligaFlash?.outcome === 'champion') {
                return (
                  <div className="relative overflow-hidden bg-neon-yellow px-5 py-5 text-black mb-1" style={{ borderRadius: 'var(--radius-md)', boxShadow: '0 10px 30px rgba(253,225,0,0.22)' }}>
                    <p className="font-display uppercase tracking-[0.3em] text-[10px] font-black text-black/70 mb-1">Liga Ole · Campeão</p>
                    <p style={{ fontFamily: M, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(30px, 9vw, 46px)', lineHeight: 0.95 }}>{club.name}</p>
                    <p className="font-display uppercase tracking-[0.2em] text-[11px] font-black text-black/80 mt-1">Levantou a taça!</p>
                    <button type="button" onClick={() => navigate('/liga-ole')} className="mt-3 w-full py-3 bg-black text-neon-yellow font-display uppercase tracking-[0.2em] text-[12px] font-black" style={{ borderRadius: 'var(--radius-sm)' }}>Ver Liga Ole</button>
                  </div>
                );
              }
              if (ligaFlash?.outcome === 'eliminated') {
                return (
                  <div className="border px-5 py-5 mb-1" style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--color-danger)', backgroundColor: 'var(--color-dark-gray)' }}>
                    <p className="font-display uppercase tracking-[0.3em] text-[10px] font-black text-danger mb-1">Liga Ole · Fim da linha</p>
                    <p className="text-white" style={{ fontFamily: M, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(24px, 7vw, 36px)' }}>Caiu nas {ligaFlash.reachedRound}</p>
                    <button type="button" onClick={() => navigate('/liga-ole')} className="mt-3 w-full py-3 border border-white/20 text-white/80 font-display uppercase tracking-[0.18em] text-[11px] font-black hover:border-white/50 transition-colors" style={{ borderRadius: 'var(--radius-sm)' }}>Ver Liga Ole</button>
                  </div>
                );
              }
              if (ligaOle?.status === 'active') {
                return (
                  <div className="relative overflow-hidden border px-5 py-5 mb-1" style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--color-neon-yellow)', backgroundColor: 'var(--color-dark-gray)', boxShadow: '0 10px 30px rgba(253,225,0,0.10)' }}>
                    <p className="font-display uppercase tracking-[0.3em] text-[10px] font-black text-neon-yellow mb-1">Liga Ole</p>
                    <p className="text-white" style={{ fontFamily: M, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(22px, 6.5vw, 32px)', lineHeight: 0.95 }}>{club.name} avançou de fase!</p>
                    <p className="font-display uppercase tracking-[0.2em] text-[10px] font-black text-white/50 mt-1">Próxima: {LIGA_OLE_ROUNDS[ligaOle.roundIndex]}</p>
                    <button type="button" onClick={() => navigate('/liga-ole')} className="mt-3 w-full py-3.5 bg-neon-yellow hover:bg-white text-black font-display uppercase tracking-[0.2em] text-[13px] font-black transition-colors" style={{ borderRadius: 'var(--radius-sm)' }}>Avançar ›</button>
                  </div>
                );
              }
              return null;
            })()}

            {!isLigaOleMatchRef.current && (
              <button
                type="button"
                onClick={() => navigate(0)}
                className="w-full py-3 bg-neon-yellow hover:bg-white text-black font-display uppercase tracking-[0.18em] text-[12px] font-black transition-colors"
              >
                Jogar de novo
              </button>
            )}
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
