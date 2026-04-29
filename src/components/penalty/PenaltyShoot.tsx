import { useEffect, useRef, useState } from 'react';
import { PICK_TIME_SECONDS, POWER_RAMP_MS } from './constants';
import { PenaltyPowerBar } from './PenaltyPowerBar';
import { PenaltyShootSVG } from './PenaltyShootSVG';
import { PenaltyShootoutScore } from './PenaltyShootoutScore';
import { resolvePenalty } from './usePenaltyResolution';
import {
  playGoalNet,
  playPost,
  playSave,
  playSwoosh,
  playThock,
} from './penaltySounds';
import type {
  PenaltyKeeper,
  PenaltyOutcome,
  PenaltyPOV,
  PenaltyPhase,
  PenaltyShootResult,
  PenaltyShooter,
  ShootoutContext,
  SlotIndex,
} from './types';

export interface PenaltyShootProps {
  pov?: PenaltyPOV; // 'manager' (default) | 'player'
  shooter: PenaltyShooter;
  keeper: PenaltyKeeper;
  pickTimeSeconds?: number;
  shootoutContext?: ShootoutContext;
  /** Texto da dica narrativa do goleiro (ex: "Goleiro lê bem o lado direito"). */
  keeperHint?: string;
  /** Disparado uma vez quando o pênalti é resolvido (após o reveal). */
  onResolved?: (result: PenaltyShootResult) => void;
  /** Botão "Próximo" só aparece se passado. */
  onNextShooter?: () => void;
  /** Botão "Reiniciar" só aparece se passado. */
  onReset?: () => void;
  /**
   * Auto-advance após o resultado. Em ms. Se omitido, espera o manager clicar.
   * Usado em multiplayer pra não travar o outro lado se manager AFK.
   * Recomendado: 5000 (5s).
   */
  autoAdvanceMs?: number;
  /**
   * Cabeçalho opcional acima do timer (ex: "Olefoot · Pênalti em jogo").
   * Default: "Olefoot · Pênalti".
   */
  headerLabel?: string;
}

/**
 * Componente top-level reutilizável de cobrança de pênalti.
 * Orquestra estado, RAF da barra de força e timer; SVG/UI são presentationals.
 */
export function PenaltyShoot({
  pov = 'manager',
  shooter,
  keeper,
  pickTimeSeconds = PICK_TIME_SECONDS,
  shootoutContext,
  keeperHint,
  onResolved,
  onNextShooter,
  onReset,
  autoAdvanceMs,
  headerLabel = 'Olefoot · Pênalti',
}: PenaltyShootProps) {
  const [phase, setPhase] = useState<PenaltyPhase>('pick');
  const [hoveredSlot, setHoveredSlot] = useState<SlotIndex | null>(null);
  const [pickedSlot, setPickedSlot] = useState<SlotIndex | null>(null);
  const [keeperSlot, setKeeperSlot] = useState<SlotIndex | null>(null);
  const [outcome, setOutcome] = useState<PenaltyOutcome | null>(null);
  const [landing, setLanding] = useState<{ x: number; y: number } | null>(null);
  const [finalRotation, setFinalRotation] = useState(0);

  const [timeLeft, setTimeLeft] = useState(pickTimeSeconds);
  const [power, setPower] = useState(0);
  const [shotPower, setShotPower] = useState(0);

  // Auto-advance pós-result (multiplayer-safe)
  const [autoAdvanceLeft, setAutoAdvanceLeft] = useState<number | null>(null);

  const tickRef = useRef<number | null>(null);
  const powerRafRef = useRef<number | null>(null);
  const powerStartRef = useRef<number | null>(null);
  const autoAdvanceRef = useRef<number | null>(null);

  // Timer countdown durante pick
  useEffect(() => {
    if (phase !== 'pick') {
      if (tickRef.current) window.clearInterval(tickRef.current);
      return;
    }
    setTimeLeft(pickTimeSeconds);
    tickRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (pickedSlot == null) {
            const auto: SlotIndex = 4;
            setPickedSlot(auto);
            window.setTimeout(() => fireShotWith(auto, 0.4), 120);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Auto-advance no result phase (multiplayer-safe)
  useEffect(() => {
    if (phase !== 'result' || !autoAdvanceMs || !onNextShooter) {
      setAutoAdvanceLeft(null);
      if (autoAdvanceRef.current) window.clearInterval(autoAdvanceRef.current);
      return;
    }
    const totalSec = Math.ceil(autoAdvanceMs / 1000);
    setAutoAdvanceLeft(totalSec);
    const start = Date.now();
    autoAdvanceRef.current = window.setInterval(() => {
      const elapsedMs = Date.now() - start;
      const remaining = Math.max(0, Math.ceil((autoAdvanceMs - elapsedMs) / 1000));
      setAutoAdvanceLeft(remaining);
      if (elapsedMs >= autoAdvanceMs) {
        window.clearInterval(autoAdvanceRef.current!);
        autoAdvanceRef.current = null;
        handleNextShooter();
      }
    }, 200);
    return () => {
      if (autoAdvanceRef.current) {
        window.clearInterval(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoAdvanceMs, onNextShooter]);

  // Pointer up global pra disparar o chute
  useEffect(() => {
    function handleUp() {
      if (phase === 'charging' && pickedSlot != null) {
        fireShotWith(pickedSlot, power);
      }
    }
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pickedSlot, power]);

  function startCharge(idx: SlotIndex) {
    if (phase !== 'pick') return;
    playThock();
    setPickedSlot(idx);
    setPhase('charging');
    setPower(0);
    powerStartRef.current = performance.now();

    function tick(now: number) {
      if (powerStartRef.current == null) return;
      const elapsed = now - powerStartRef.current;
      const p = Math.min(1, elapsed / POWER_RAMP_MS);
      setPower(p);
      if (p < 1) {
        powerRafRef.current = requestAnimationFrame(tick);
      } else {
        fireShotWith(idx, 1);
      }
    }
    powerRafRef.current = requestAnimationFrame(tick);
  }

  function fireShotWith(slot: SlotIndex, finalPower: number) {
    if (powerRafRef.current) cancelAnimationFrame(powerRafRef.current);
    powerStartRef.current = null;
    setShotPower(finalPower);
    setPickedSlot(slot);
    setPhase('reveal');

    const result = resolvePenalty({
      slot,
      power: finalPower,
      shooter,
      keeper,
    });

    setKeeperSlot(result.keeperSlot);
    setOutcome(result.outcome);
    setLanding(result.landing);
    setFinalRotation(result.finalRotation);

    // Som da batida (intensidade pela força)
    playSwoosh(0.6 + finalPower * 0.6);

    // Som do impacto, sincronizado com o landing
    const flightDur = finalPower > 0.88 ? 320 : finalPower > 0.32 ? 380 : 520;
    window.setTimeout(() => {
      switch (result.outcome) {
        case 'goal':
          playGoalNet();
          break;
        case 'save':
        case 'weak-save':
          playSave();
          break;
        case 'post':
          playPost();
          break;
        // 'wide' e 'over-bar' não tocam som de impacto (saiu da câmera)
      }
    }, flightDur - 30);

    window.setTimeout(() => {
      setPhase('result');
      onResolved?.(result);
    }, 950);
  }

  function softReset() {
    setPhase('pick');
    setPickedSlot(null);
    setKeeperSlot(null);
    setHoveredSlot(null);
    setPower(0);
    setShotPower(0);
    setOutcome(null);
    setLanding(null);
    setFinalRotation(0);
  }

  function handleNextShooter() {
    onNextShooter?.();
    softReset();
  }

  function handleReset() {
    onReset?.();
    softReset();
  }

  // Headline contextual
  const headline = (() => {
    if (phase === 'pick') return pickedSlot == null ? 'Onde mandamos ele bater?' : 'Confirma a mira?';
    if (phase === 'charging') return 'SEGURA… CARREGA…';
    if (phase === 'reveal') return 'CHUTA!';
    if (outcome === 'goal') return 'GOOOOOL!';
    if (outcome === 'over-bar') return 'POR CIMA!';
    if (outcome === 'post') return 'NA TRAVE!';
    if (outcome === 'wide') return 'PRA FORA!';
    if (outcome === 'weak-save') return 'CHUTE FRACO!';
    return 'DEFENDEU!';
  })();

  return (
    <div
      className="bg-neon-yellow flex flex-col items-center px-4 sm:px-6 select-none"
      style={{
        touchAction: 'none',
        minHeight: '100dvh',
        paddingTop: 'max(env(safe-area-inset-top), 12px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
      }}
    >
      {/* Header */}
      <div className="w-full max-w-[920px] flex items-baseline justify-between mb-1 sm:mb-3">
        <div className="text-[10px] uppercase tracking-[0.35em] font-medium text-black/70">
          {headerLabel}
        </div>
        {shootoutContext && (
          <div className="text-[10px] uppercase tracking-[0.35em] font-medium text-black/70">
            Batedor {shootoutContext.currentShooter + 1} de {shootoutContext.rounds}
          </div>
        )}
      </div>

      {/* Timer + Headline */}
      <div className="w-full max-w-[920px] flex flex-col items-center">
        <div
          className={`font-display italic font-black leading-none tabular-nums transition-colors duration-200 ${
            timeLeft <= 3 && phase === 'pick' ? 'text-black animate-pulse' : 'text-black/85'
          }`}
          style={{ fontSize: 'clamp(40px, min(7vh, 9vw), 96px)' }}
        >
          {phase === 'pick' ? timeLeft.toString().padStart(2, '0') : '00'}
        </div>

        <h1
          className="ole-headline-italic text-black text-center mt-1 sm:mt-2"
          style={{
            fontSize:
              phase === 'result'
                ? 'clamp(44px, min(9vh, 10vw), 120px)'
                : 'clamp(22px, min(4vh, 4vw), 44px)',
            lineHeight: 1.0,
          }}
        >
          {headline}
        </h1>
      </div>

      {/* Sub-info do batedor + goleiro */}
      <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-4 mb-2 sm:mb-3 text-black/80 text-[10px] sm:text-[11px] uppercase tracking-[0.18em] flex-wrap justify-center">
        <span className="border border-black/40 px-2 py-1 bg-black text-neon-yellow">
          {shooter.displayName} · #{shooter.shirtNumber}
        </span>
        <span>Finalização {shooter.finishingRating}</span>
        {keeperHint && (
          <>
            <span className="text-black/50">|</span>
            <span>{keeperHint}</span>
          </>
        )}
      </div>

      {/* SVG do gol */}
      <PenaltyShootSVG
        phase={phase}
        pickedSlot={pickedSlot}
        hoveredSlot={hoveredSlot}
        keeperSlot={keeperSlot}
        outcome={outcome}
        landing={landing}
        shotPower={shotPower}
        finalRotation={finalRotation}
        finishingRating={shooter.finishingRating}
        onSlotHoverChange={setHoveredSlot}
        onSlotPointerDown={startCharge}
      />

      {/* Power bar (durante charging) */}
      {phase === 'charging' && <PenaltyPowerBar power={power} />}

      {/* Placar da disputa (opcional) */}
      {shootoutContext && (
        <PenaltyShootoutScore ctx={shootoutContext} highlightActive={phase !== 'result'} />
      )}

      {/* Botões pós-result */}
      {phase === 'result' && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-3">
            {onNextShooter && (
              <button
                onClick={handleNextShooter}
                className="relative bg-black text-neon-yellow px-8 py-3 font-display font-black uppercase tracking-wider -skew-x-6 hover:bg-white hover:text-black transition-all overflow-hidden"
              >
                <span className="relative z-10">
                  Próximo
                  {autoAdvanceLeft != null && (
                    <span className="ml-3 tabular-nums text-neon-yellow/70">
                      {autoAdvanceLeft}s
                    </span>
                  )}
                </span>
                {/* Barra de progresso decrescente embaixo do botão */}
                {autoAdvanceLeft != null && autoAdvanceMs && (
                  <span
                    className="absolute bottom-0 left-0 h-[3px] bg-neon-yellow/50 transition-[width] duration-200 ease-linear"
                    style={{
                      width: `${Math.max(0, (autoAdvanceLeft * 1000) / autoAdvanceMs) * 100}%`,
                    }}
                  />
                )}
              </button>
            )}
            {onReset && (
              <button
                onClick={handleReset}
                className="bg-transparent border-2 border-black text-black px-8 py-3 font-display font-black italic uppercase tracking-wider -skew-x-6 hover:bg-black hover:text-neon-yellow transition-all"
              >
                Reiniciar
              </button>
            )}
          </div>
          {autoAdvanceLeft != null && (
            <div className="text-[10px] uppercase tracking-[0.3em] text-black/50">
              Auto-avança em {autoAdvanceLeft}s · clique pra adiantar
            </div>
          )}
        </div>
      )}

      {/* Hint */}
      {phase === 'pick' && (
        <div className="mt-3 sm:mt-6 text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-black/50 max-w-[920px] text-center leading-relaxed px-2">
          Pressione e segure um slot pra carregar a força · Solte pra chutar · {pickTimeSeconds}s pra
          decidir
        </div>
      )}
      {pov === 'player' && (
        <div className="mt-2 text-[10px] uppercase tracking-[0.3em] text-black/40">
          [POV: Player · placeholder]
        </div>
      )}
    </div>
  );
}

// Re-export pra ergonomia
export type {
  PenaltyShooter,
  PenaltyKeeper,
  PenaltyShootResult,
  PenaltyOutcome,
  ShootoutContext,
  SlotIndex,
} from './types';
