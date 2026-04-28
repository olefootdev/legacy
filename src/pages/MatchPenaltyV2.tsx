import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGameStore } from '@/game/store';
import {
  PenaltyShoot,
  resolvePenalty,
  type PenaltyKeeper,
  type PenaltyShootResult,
  type PenaltyShooter,
  type ShootoutContext,
  type ShotResult,
  type SlotIndex,
} from '@/components/penalty';

const TOTAL_KICKS = 5;

type Side = 'home' | 'away';
type Phase = 'setup' | 'kicking-home' | 'awaiting-away' | 'final';

/**
 * Disputa de Pênaltis V2 — usa o novo <PenaltyShoot>.
 *
 * Fluxo:
 *  1. setup → escolha 5 batedores da casa (top finalização)
 *  2. kicking-home → manager bate com cada um (uses <PenaltyShoot>)
 *  3. awaiting-away → adversário bate (resolução headless via resolvePenalty)
 *  4. alterna até definir vencedor; vai pra morte súbita se empata
 */
export function MatchPenaltyV2() {
  const navigate = useNavigate();
  const players = useGameStore((s) => s.players ?? {});
  const fixture = useGameStore((s) => (s as any).currentFixture ?? s.liveMatch);

  const opponentName: string = fixture?.opponent?.name ?? 'Rival FC';
  const opponentShort: string =
    fixture?.opponent?.shortName ?? opponentName.slice(0, 3).toUpperCase();
  const opponentStrength: number = fixture?.opponent?.strength ?? 70;

  const availablePlayers = useMemo(
    () =>
      Object.values(players)
        .filter((p: any) => p.outForMatches <= 0)
        .sort((a: any, b: any) => b.attrs.finalizacao - a.attrs.finalizacao),
    [players],
  );

  const [phase, setPhase] = useState<Phase>('setup');
  const [takerOrder, setTakerOrder] = useState<string[]>([]);
  const [homeShots, setHomeShots] = useState<ShotResult[]>(
    Array(TOTAL_KICKS).fill('pending'),
  );
  const [awayShots, setAwayShots] = useState<ShotResult[]>(
    Array(TOTAL_KICKS).fill('pending'),
  );
  const [round, setRound] = useState(0);
  const [resetSeed, setResetSeed] = useState(0);
  const [winner, setWinner] = useState<Side | null>(null);
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);

  // Goleiro adversário (qualidade derivada do strength do clube)
  const opponentKeeper: PenaltyKeeper = useMemo(
    () => ({
      id: 'opp-gk',
      displayName: `Goleiro ${opponentShort}`,
      readingRating: Math.max(40, Math.min(95, opponentStrength)),
      positioningRating: Math.max(40, Math.min(95, opponentStrength - 5)),
      tendency: ['left', 'right', 'center'][Math.floor(Math.random() * 3)] as
        | 'left'
        | 'right'
        | 'center',
    }),
    [opponentStrength, opponentShort],
  );

  // Goleiro do nosso time (pega o melhor com posição GK; fallback médio)
  const homeKeeper: PenaltyKeeper = useMemo(() => {
    const gks = Object.values(players).filter(
      (p: any) => p.position === 'GK' && p.outForMatches <= 0,
    );
    const best = gks.sort(
      (a: any, b: any) =>
        (b.attrs?.defesa ?? 50) + (b.attrs?.posicionamento ?? 50) -
        ((a.attrs?.defesa ?? 50) + (a.attrs?.posicionamento ?? 50)),
    )[0] as any;
    return {
      id: best?.id ?? 'home-gk',
      displayName: best?.name ?? 'Nosso Goleiro',
      readingRating: best?.attrs?.defesa ?? 70,
      positioningRating: best?.attrs?.posicionamento ?? 70,
    };
  }, [players]);

  const homeGoals = homeShots.filter((s) => s === 'goal').length;
  const awayGoals = awayShots.filter((s) => s === 'goal').length;
  const homeKicksUsed = homeShots.filter((s) => s !== 'pending').length;
  const awayKicksUsed = awayShots.filter((s) => s !== 'pending').length;

  // Detectar fim da disputa (vitória matemática ou após 5 cada)
  useEffect(() => {
    if (phase === 'setup' || phase === 'final') return;

    // Vitória matemática
    const homeRemaining = TOTAL_KICKS - homeKicksUsed;
    const awayRemaining = TOTAL_KICKS - awayKicksUsed;
    if (!isSuddenDeath) {
      if (homeGoals > awayGoals + awayRemaining) {
        setWinner('home');
        setPhase('final');
        return;
      }
      if (awayGoals > homeGoals + homeRemaining) {
        setWinner('away');
        setPhase('final');
        return;
      }
    }

    // Após 5 cada
    if (homeKicksUsed >= TOTAL_KICKS && awayKicksUsed >= TOTAL_KICKS) {
      if (homeGoals === awayGoals) {
        setIsSuddenDeath(true);
      } else {
        setWinner(homeGoals > awayGoals ? 'home' : 'away');
        setPhase('final');
      }
    }
  }, [
    homeShots,
    awayShots,
    phase,
    homeGoals,
    awayGoals,
    homeKicksUsed,
    awayKicksUsed,
    isSuddenDeath,
  ]);

  function toggleTaker(playerId: string) {
    setTakerOrder((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
      if (prev.length >= TOTAL_KICKS) return prev;
      return [...prev, playerId];
    });
  }

  function startMatch() {
    if (takerOrder.length < TOTAL_KICKS) return;
    setPhase('kicking-home');
  }

  function handleHomeShot(result: PenaltyShootResult) {
    const isGoal = result.outcome === 'goal';
    const newHome = [...homeShots];
    newHome[homeKicksUsed] = isGoal ? 'goal' : 'save';
    setHomeShots(newHome);
  }

  function handleNextShooter() {
    // Transição: bola passa pra adversário bater (ou termina)
    setPhase('awaiting-away');
    setTimeout(() => {
      // Adversário bate (resolução headless usando resolvePenalty)
      const aiSlot = Math.floor(Math.random() * 9) as SlotIndex;
      // Distribuição mais humana de força:
      //   ~15% chutes fracos (< 32%, sempre saved)
      //   ~70% chutes na sweet zone (32-88%)
      //   ~15% chutes pancada (> 88%, drift pra fora)
      const aiPower = 0.18 + Math.random() * 0.78;
      const aiShooter: PenaltyShooter = {
        id: 'opp-shooter',
        displayName: `Batedor ${opponentShort}`,
        shirtNumber: 10,
        finishingRating: Math.max(50, Math.min(90, opponentStrength)),
      };
      const aiResult = resolvePenalty({
        slot: aiSlot,
        power: aiPower,
        shooter: aiShooter,
        keeper: homeKeeper,
      });
      const isGoal = aiResult.outcome === 'goal';
      const newAway = [...awayShots];
      newAway[awayKicksUsed] = isGoal ? 'goal' : 'save';
      setAwayShots(newAway);

      setRound((r) => r + 1);
      setPhase('kicking-home');
      setResetSeed((s) => s + 1); // força re-mount do <PenaltyShoot>
    }, 1400);
  }

  function fullReset() {
    setPhase('setup');
    setHomeShots(Array(TOTAL_KICKS).fill('pending'));
    setAwayShots(Array(TOTAL_KICKS).fill('pending'));
    setRound(0);
    setWinner(null);
    setIsSuddenDeath(false);
    setTakerOrder([]);
    setResetSeed((s) => s + 1);
  }

  // ── SETUP PHASE ──
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-deep-black text-white px-6 pt-6 pb-12">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-zinc-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">
              Disputa de Pênaltis · v2
            </div>
            <div className="w-9" />
          </div>

          <h1
            className="ole-headline-italic text-center mb-2"
            style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}
          >
            Escolha 5 batedores
          </h1>
          <p className="text-center text-white/60 text-sm mb-8">
            Ordenados por finalização. {takerOrder.length}/{TOTAL_KICKS} selecionados.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-8">
            {availablePlayers.slice(0, 12).map((p: any) => {
              const idx = takerOrder.indexOf(p.id);
              const selected = idx >= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleTaker(p.id)}
                  className={`flex items-center justify-between px-4 py-3 border-2 transition-all ${
                    selected
                      ? 'bg-neon-yellow text-black border-neon-yellow'
                      : 'bg-zinc-900 border-zinc-700 hover:border-white/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {selected && (
                      <div className="font-display font-black text-lg w-6 text-center">
                        {idx + 1}
                      </div>
                    )}
                    <div className="text-left">
                      <div className="font-display font-bold uppercase tracking-wider text-sm">
                        {p.name}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">
                        {p.position} · #{p.shirtNumber ?? '?'}
                      </div>
                    </div>
                  </div>
                  <div className="font-display font-black text-2xl">
                    {p.attrs?.finalizacao ?? '-'}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={takerOrder.length < TOTAL_KICKS}
            onClick={startMatch}
            className="w-full bg-neon-yellow text-black px-8 py-4 font-display font-black uppercase tracking-wider -skew-x-6 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white"
          >
            Começar Disputa
          </button>
        </div>
      </div>
    );
  }

  // ── FINAL PHASE ──
  if (phase === 'final' && winner) {
    return (
      <div className="min-h-screen bg-neon-yellow flex flex-col items-center justify-center px-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-black/70 mb-6">
          Final da Disputa
        </div>
        <h1
          className="ole-headline-italic text-black text-center mb-4"
          style={{ fontSize: 'clamp(72px, 14vw, 160px)', lineHeight: 1 }}
        >
          {winner === 'home' ? 'GANHAMOS!' : 'PERDEMOS'}
        </h1>
        <div className="font-display italic font-black tabular-nums text-black/85 mb-12"
          style={{ fontSize: 'clamp(56px, 10vw, 120px)' }}
        >
          {homeGoals} — {awayGoals}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={fullReset}
            className="bg-black text-neon-yellow px-8 py-3 font-display font-black uppercase tracking-wider -skew-x-6"
          >
            Nova Disputa
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-transparent border-2 border-black text-black px-8 py-3 font-display font-black italic uppercase tracking-wider -skew-x-6"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // ── KICKING / AWAITING-AWAY ──
  const currentTakerId = takerOrder[round % takerOrder.length];
  const currentTaker: any = availablePlayers.find((p: any) => p.id === currentTakerId);

  if (!currentTaker) {
    return (
      <div className="min-h-screen bg-deep-black text-white flex items-center justify-center">
        Erro: batedor não encontrado.
      </div>
    );
  }

  const shooter: PenaltyShooter = {
    id: currentTaker.id,
    displayName: currentTaker.name,
    shirtNumber: currentTaker.shirtNumber ?? 9,
    finishingRating: currentTaker.attrs?.finalizacao ?? 70,
    forcaMental: currentTaker.attrs?.forca_mental ?? 70,
  };

  const ctx: ShootoutContext = {
    homeShots,
    awayShots,
    currentShooter: homeKicksUsed,
    rounds: TOTAL_KICKS,
    homeLabel: 'NÓS',
    awayLabel: opponentShort,
  };

  if (phase === 'awaiting-away') {
    return (
      <div className="min-h-screen bg-neon-yellow flex flex-col items-center justify-center px-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-black/70 mb-2">
          {opponentShort} bate agora
        </div>
        <h2
          className="ole-headline-italic text-black animate-pulse"
          style={{ fontSize: 'clamp(36px, 6vw, 64px)' }}
        >
          Aguarde…
        </h2>
        <div className="font-display italic font-black tabular-nums mt-8"
          style={{ fontSize: 'clamp(40px, 6vw, 64px)' }}
        >
          {homeGoals} — {awayGoals}
        </div>
      </div>
    );
  }

  return (
    <PenaltyShoot
      key={resetSeed}
      headerLabel={`${isSuddenDeath ? 'Morte Súbita · ' : ''}Disputa de Pênaltis`}
      shooter={shooter}
      keeper={opponentKeeper}
      keeperHint={
        opponentKeeper.tendency
          ? `Goleiro lê bem o lado ${
              opponentKeeper.tendency === 'left'
                ? 'esquerdo'
                : opponentKeeper.tendency === 'right'
                  ? 'direito'
                  : 'central'
            }`
          : undefined
      }
      shootoutContext={ctx}
      onResolved={handleHomeShot}
      onNextShooter={handleNextShooter}
      autoAdvanceMs={5000}
    />
  );
}

export default MatchPenaltyV2;
