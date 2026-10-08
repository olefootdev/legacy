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
import { Hashtag } from '@/components/ui';
import { FitaRua } from '@/components/ui/Rua';
import { L } from '@/i18n/L';

const REGULAR_KICKS = 5;

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
    Array(REGULAR_KICKS).fill('pending'),
  );
  const [awayShots, setAwayShots] = useState<ShotResult[]>(
    Array(REGULAR_KICKS).fill('pending'),
  );
  // Em morte súbita, cada round adiciona 1 slot. sdRound = quantos rounds SD já foram.
  const [sdRound, setSdRound] = useState(0);
  const [round, setRound] = useState(0);
  const [resetSeed, setResetSeed] = useState(0);
  const [winner, setWinner] = useState<Side | null>(null);
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);

  // Limite dinâmico: 5 na fase normal, +1 por round de morte súbita
  const TOTAL_KICKS = isSuddenDeath ? REGULAR_KICKS + sdRound + 1 : REGULAR_KICKS;

  // Goleiro adversário (qualidade derivada do strength do clube)
  const opponentKeeper: PenaltyKeeper = useMemo(
    () => ({
      id: 'opp-gk',
      displayName: L(`Goleiro ${opponentShort}`, `${opponentShort} Keeper`),
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
      displayName: best?.name ?? L('Nosso Goleiro', 'Our Keeper'),
      readingRating: best?.attrs?.defesa ?? 70,
      positioningRating: best?.attrs?.posicionamento ?? 70,
    };
  }, [players]);

  const homeGoals = homeShots.filter((s) => s === 'goal').length;
  const awayGoals = awayShots.filter((s) => s === 'goal').length;
  const homeKicksUsed = homeShots.filter((s) => s !== 'pending').length;
  const awayKicksUsed = awayShots.filter((s) => s !== 'pending').length;

  // Detectar fim da disputa (vitória matemática ou após TOTAL_KICKS cada)
  useEffect(() => {
    if (phase === 'setup' || phase === 'final') return;

    const homeRemaining = TOTAL_KICKS - homeKicksUsed;
    const awayRemaining = TOTAL_KICKS - awayKicksUsed;

    // Vitória matemática (só na fase normal)
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

    // Ambos bateram o round atual
    if (homeKicksUsed >= TOTAL_KICKS && awayKicksUsed >= TOTAL_KICKS) {
      if (homeGoals !== awayGoals) {
        setWinner(homeGoals > awayGoals ? 'home' : 'away');
        setPhase('final');
        return;
      }
      // Empate: entrar/continuar morte súbita — expande arrays em +1
      setIsSuddenDeath(true);
      setSdRound((r) => r + 1);
      setHomeShots((prev) => [...prev, 'pending']);
      setAwayShots((prev) => [...prev, 'pending']);
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
    TOTAL_KICKS,
  ]);

  function toggleTaker(playerId: string) {
    setTakerOrder((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
      if (prev.length >= REGULAR_KICKS) return prev;
      return [...prev, playerId];
    });
  }

  function startMatch() {
    if (takerOrder.length < REGULAR_KICKS) return;
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
        displayName: L(`Batedor ${opponentShort}`, `${opponentShort} Taker`),
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
    setHomeShots(Array(REGULAR_KICKS).fill('pending'));
    setAwayShots(Array(REGULAR_KICKS).fill('pending'));
    setRound(0);
    setSdRound(0);
    setWinner(null);
    setIsSuddenDeath(false);
    setTakerOrder([]);
    setResetSeed((s) => s + 1);
  }

  // ── SETUP PHASE ──
  if (phase === 'setup') {
    return (
      <div
        className="bg-asfalto-27 px-4 text-papel sm:px-6"
        style={{
          minHeight: '100dvh',
          paddingTop: 'max(env(safe-area-inset-top), 16px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
        }}
      >
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={L('Voltar', 'Back')}
              className="flex h-11 w-11 items-center justify-center text-suave hover:text-papel"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Hashtag className="w-auto font-prova text-mudo">{L('#penaltis', '#penalties')}</Hashtag>
            <div className="w-11" />
          </div>

          <p className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('Disputa de pênaltis', 'Penalty shootout')}</p>
          <h1
            className="mt-1 font-impact uppercase leading-[0.92] text-papel"
            style={{ fontSize: 'clamp(40px, 12vw, 72px)' }}
          >
            {L('Escolha 5 batedores', 'Choose 5 takers')}
          </h1>
          <p className="mb-5 mt-2 font-voz text-[24px] leading-none text-suave sm:mb-8">
            {L('Quem bate, bate com respeito.', 'Whoever steps up, steps up with respect.')}{' '}
            <span className="ml-1 font-prova text-[12px] font-bold tabular-nums text-rua">
              {takerOrder.length}/{REGULAR_KICKS}
            </span>
          </p>

          {availablePlayers.length === 0 ? (
            // Empty-state — sem plantel não dá pra escolher batedores.
            // Mostra CTA pra criar/recrutar jogadores no clube.
            <div className="mb-8 border-[3px] border-dashed border-fio bg-cal px-5 py-8 text-center text-asfalto-27">
              <p className="mb-2 font-prova text-[11px] font-bold uppercase tracking-[0.22em]">
                {L('Plantel vazio', 'Empty squad')}
              </p>
              <p className="mb-5 font-voz text-[22px] leading-[1.05]">
                {L(`Você precisa de pelo menos ${REGULAR_KICKS} jogadores no plantel pra montar a disputa.`, `You need at least ${REGULAR_KICKS} players in the squad to set up the shootout.`)}
              </p>
              <button
                type="button"
                onClick={() => navigate('/clube/elenco')}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 bg-asfalto-27 px-6 font-impact text-[18px] uppercase leading-none text-rua"
              >
                {L('Ir ao Elenco', 'Go to Squad')} <span aria-hidden>→</span>
              </button>
            </div>
          ) : null}

          <div className="mb-5 grid grid-cols-1 gap-2 sm:mb-8 sm:grid-cols-2">
            {availablePlayers.slice(0, 12).map((p: any) => {
              const idx = takerOrder.indexOf(p.id);
              const selected = idx >= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleTaker(p.id)}
                  aria-pressed={selected}
                  className={`flex min-h-[60px] min-w-0 items-center justify-between gap-3 px-4 py-2.5 transition-colors ${
                    selected
                      ? 'bg-rua text-asfalto-27'
                      : 'border-2 border-linha bg-concreto text-papel hover:border-fio'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center font-spray font-black text-[22px] leading-none ${
                        selected ? 'bg-asfalto-27 text-rua' : 'border-2 border-dashed border-fio text-fio'
                      }`}
                    >
                      {selected ? idx + 1 : ''}
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="truncate font-voz text-[20px] leading-none">
                        {p.name}
                      </div>
                      <div className={`mt-1 font-prova text-[10px] font-bold uppercase tracking-[0.14em] ${selected ? 'text-asfalto-27/70' : 'text-mudo'}`}>
                        {p.position} · #{p.shirtNumber ?? '?'}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 font-impact text-[26px] leading-none tabular-nums">
                    {p.attrs?.finalizacao ?? '-'}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={takerOrder.length < REGULAR_KICKS}
            onClick={startMatch}
            className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 bg-rua px-8 font-impact text-[21px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow,opacity] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)] disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
          >
            {L('Começar disputa', 'Start shootout')} <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    );
  }

  // ── FINAL PHASE ──
  if (phase === 'final' && winner) {
    const ganhamos = winner === 'home';
    return (
      <div
        className="rua-grao relative flex flex-col items-center justify-center overflow-hidden bg-asfalto-27 px-4 sm:px-6"
        style={{
          minHeight: '100dvh',
          paddingTop: 'max(env(safe-area-inset-top), 16px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
        }}
      >
        <div className="mb-3 font-prova text-[11px] font-bold uppercase tracking-[0.24em] text-mudo sm:mb-5">
          {L('Final da disputa', 'Shootout over')}
        </div>
        <div
          className="mb-2 font-spray font-black leading-[0.82] tabular-nums text-rua"
          style={{ fontSize: 'clamp(96px, min(22vh, 34vw), 220px)' }}
          aria-label={`${homeGoals} × ${awayGoals}`}
        >
          {homeGoals}<span className="mx-[0.06em] text-[0.6em]">×</span>{awayGoals}
        </div>
        <h1
          className="mb-8 text-center font-voz leading-[0.98] text-papel sm:mb-12"
          style={{ fontSize: 'clamp(44px, min(9vh, 12vw), 96px)' }}
        >
          {ganhamos ? L('Vitória na moral.', 'Won it with respect.') : L('Perdeu hoje. Volta amanhã.', 'Lost today. Back tomorrow.')}
        </h1>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={fullReset}
            className="inline-flex min-h-[54px] items-center gap-2 bg-rua px-7 font-impact text-[20px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)]"
          >
            {L('Nova disputa', 'New shootout')} <span aria-hidden>→</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-[54px] items-center border-2 border-papel px-7 font-impact text-[20px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
          >
            {L('Voltar', 'Back')}
          </button>
        </div>
        <FitaRua tags={['#penaltis', '#correloko']} inclinacao={-2} className="absolute inset-x-0 bottom-6" />
      </div>
    );
  }

  // ── KICKING / AWAITING-AWAY ──
  const currentTakerId = takerOrder[round % takerOrder.length];
  const currentTaker: any = availablePlayers.find((p: any) => p.id === currentTakerId);

  if (!currentTaker) {
    return (
      <div className="bg-deep-black text-white flex items-center justify-center" style={{ minHeight: '100dvh' }}>
        {L('Erro: batedor não encontrado.', 'Error: taker not found.')}
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
    homeLabel: L('NÓS', 'US'),
    awayLabel: opponentShort,
  };

  if (phase === 'awaiting-away') {
    return (
      <div
        className="flex flex-col items-center justify-center bg-asfalto-27 px-4 sm:px-6"
        style={{
          minHeight: '100dvh',
          paddingTop: 'max(env(safe-area-inset-top), 16px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
        }}
      >
        <div className="mb-2 font-prova text-[11px] font-bold uppercase tracking-[0.24em] text-mudo">
          {L(`${opponentShort} bate agora`, `${opponentShort} shooting now`)}
        </div>
        <h2
          className="animate-pulse font-voz leading-none text-papel"
          style={{ fontSize: 'clamp(40px, min(7vh, 11vw), 72px)' }}
        >
          {L('Aguarde…', 'Wait…')}
        </h2>
        <div
          className="mt-4 font-spray font-black leading-none tabular-nums text-rua sm:mt-8"
          style={{ fontSize: 'clamp(64px, min(12vh, 22vw), 120px)' }}
        >
          {homeGoals}<span className="mx-[0.06em] text-[0.6em]">×</span>{awayGoals}
        </div>
      </div>
    );
  }

  return (
    <PenaltyShoot
      key={resetSeed}
      headerLabel={`${isSuddenDeath ? L('Morte Súbita · ', 'Sudden Death · ') : ''}${L('Disputa de Pênaltis', 'Penalty Shootout')}`}
      shooter={shooter}
      keeper={opponentKeeper}
      keeperHint={
        opponentKeeper.tendency
          ? L(
              `Goleiro lê bem o lado ${
                opponentKeeper.tendency === 'left'
                  ? 'esquerdo'
                  : opponentKeeper.tendency === 'right'
                    ? 'direito'
                    : 'central'
              }`,
              `Keeper reads the ${
                opponentKeeper.tendency === 'left'
                  ? 'left'
                  : opponentKeeper.tendency === 'right'
                    ? 'right'
                    : 'centre'
              } side well`,
            )
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
