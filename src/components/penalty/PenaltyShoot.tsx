import { L } from '@/i18n/L';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  key?: import("react").Key;
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
  /**
   * Quando true (default), o componente ocupa 100dvh (página inteira).
   * Quando false, ocupa só a altura natural do conteúdo — usar quando
   * embutido em um modal que JÁ controla o viewport (ex: PenaltyKickModalV2).
   *
   * Sintoma corrigido (2026-05-30): no iPhone vertical, o pênalti embutido
   * herdava 100dvh do filho aninhado dentro de 100dvh do pai, e o flex
   * `items-center` jogava o conteúdo pra fora da viewport. Só voltava
   * quando rotacionava (forçando reflow do viewport).
   */
  fullViewport?: boolean;
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
  headerLabel = L('Olefoot · Pênalti', 'Olefoot · Penalty'),
  fullViewport = true,
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

  // Force re-layout on viewport resize (fixes mobile portrait/landscape flicker)
  const [, forceUpdate] = useState(0);
  useLayoutEffect(() => {
    function onResize() { forceUpdate((n) => n + 1); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    if (phase === 'pick') return pickedSlot == null ? L('Onde mandamos ele bater?', 'Where should he shoot?') : L('Confirma a mira?', 'Confirm the aim?');
    if (phase === 'charging') return L('SEGURA… CARREGA…', 'HOLD… CHARGE…');
    if (phase === 'reveal') return L('CHUTA!', 'SHOOT!');
    if (outcome === 'goal') return L('GOOOOOL!', 'GOOOAL!');
    if (outcome === 'over-bar') return L('POR CIMA!', 'OVER THE BAR!');
    if (outcome === 'post') return L('NA TRAVE!', 'OFF THE POST!');
    if (outcome === 'wide') return L('PRA FORA!', 'WIDE!');
    if (outcome === 'weak-save') return L('CHUTE FRACO!', 'WEAK SHOT!');
    return L('DEFENDEU!', 'SAVED!');
  })();

  return (
    <div
      className="relative bg-rua text-asfalto-27 flex flex-col items-center px-4 sm:px-6 select-none w-full flex-1"
      style={{
        touchAction: 'none',
        // Standalone (página inteira): 100dvh. Embedded em modal: altura
        // natural — o modal pai cuida do viewport e do safe-area.
        ...(fullViewport
          ? {
              minHeight: '100dvh',
              paddingTop: 'max(env(safe-area-inset-top), 12px)',
              paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
            }
          : {
              paddingTop: '12px',
              paddingBottom: '16px',
            }),
      }}
    >
      {/* Alambrado no topo da peça amarela (DS 2027) — textura, não enfeite. */}
      <span aria-hidden className="rua-alambrado pointer-events-none absolute inset-x-0 top-0 h-40 [--alambrado:rgba(13,13,12,0.22)]" />

      {/* Header */}
      <div className="relative w-full max-w-[920px] flex items-baseline justify-between gap-3 mb-1">
        <div className="min-w-0 truncate font-prova text-[11px] font-bold uppercase tracking-[0.2em]">
          {headerLabel}
        </div>
        {shootoutContext && (
          <div className="shrink-0 font-prova text-[11px] font-bold uppercase tracking-[0.2em]">
            {L('Batedor', 'Taker')} {shootoutContext.currentShooter + 1} {L('de', 'of')} {shootoutContext.rounds}
          </div>
        )}
      </div>

      {/* Timer + Headline */}
      <div className="relative w-full max-w-[920px] flex flex-col items-center">
        <div
          className={`font-spray font-black leading-none tabular-nums transition-colors duration-200 ${
            timeLeft <= 3 && phase === 'pick' ? 'text-asfalto-27 animate-pulse' : 'text-asfalto-27/85'
          }`}
          style={{ fontSize: 'clamp(44px, min(7vh, 14vw), 96px)' }}
        >
          {phase === 'pick' ? timeLeft.toString().padStart(2, '0') : '00'}
        </div>

        <h1
          className={`text-center mt-1 uppercase text-asfalto-27 ${phase === 'result' ? 'font-spray font-black' : 'font-impact'}`}
          style={{
            fontSize:
              phase === 'result'
                ? 'clamp(48px, min(9vh, 14vw), 112px)'
                : 'clamp(22px, min(4vh, 6.5vw), 44px)',
            lineHeight: phase === 'result' ? 0.9 : 1.05,
          }}
        >
          {headline}
        </h1>
      </div>

      {/* Sub-info do batedor + goleiro */}
      <div className="relative flex items-center gap-2 mt-1 mb-1 sm:mt-3 sm:mb-2 font-prova font-bold text-asfalto-27/80 text-[10.5px] uppercase tracking-[0.14em] flex-wrap justify-center">
        <span className="-rotate-1 bg-asfalto-27 px-2.5 py-1 text-rua">
          <span className="font-voz text-[17px] normal-case leading-none tracking-normal">{shooter.displayName}</span> · #{shooter.shirtNumber}
        </span>
        <span>{L('Finalização', 'Finishing')} {shooter.finishingRating}</span>
        {keeperHint && (
          <>
            <span className="text-asfalto-27/50">|</span>
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
                className="relative inline-flex min-h-[52px] items-center bg-asfalto-27 text-rua px-7 font-impact text-[20px] uppercase leading-none hover:bg-concreto transition-colors overflow-hidden"
              >
                <span className="relative z-10">
                  {L('Próximo', 'Next')}
                  {autoAdvanceLeft != null && (
                    <span className="ml-3 font-prova text-[13px] tabular-nums text-rua/70">
                      {autoAdvanceLeft}s
                    </span>
                  )}
                </span>
                {/* Barra de progresso decrescente embaixo do botão */}
                {autoAdvanceLeft != null && autoAdvanceMs && (
                  <span
                    className="absolute bottom-0 left-0 h-[3px] bg-rua/60 transition-[width] duration-200 ease-linear"
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
                className="inline-flex min-h-[52px] items-center border-2 border-asfalto-27 text-asfalto-27 px-7 font-impact text-[20px] uppercase leading-none hover:bg-asfalto-27 hover:text-rua transition-colors"
              >
                {L('Reiniciar', 'Restart')}
              </button>
            )}
          </div>
          {autoAdvanceLeft != null && (
            <div className="font-prova text-[10px] font-bold uppercase tracking-[0.18em] text-asfalto-27/60">
              {L(`Auto-avança em ${autoAdvanceLeft}s · clique pra adiantar`, `Auto-advance in ${autoAdvanceLeft}s · click to skip`)}
            </div>
          )}
        </div>
      )}

      {/* Hint */}
      {phase === 'pick' && (
        <div className="mt-3 sm:mt-6 font-prova font-bold text-[10px] uppercase tracking-[0.14em] text-asfalto-27/60 max-w-[920px] text-center leading-relaxed px-2">
          {L(`Pressione e segure um slot pra carregar a força · Solte pra chutar · ${pickTimeSeconds}s pra decidir`, `Press and hold a slot to charge power · Release to shoot · ${pickTimeSeconds}s to decide`)}
        </div>
      )}
      {pov === 'player' && (
        <div className="mt-2 font-prova text-[10px] uppercase tracking-[0.2em] text-asfalto-27/40">
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
