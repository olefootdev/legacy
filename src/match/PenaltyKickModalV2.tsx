/**
 * Adapter do novo <PenaltyShoot> para o contrato antigo do PenaltyKickModal.
 *
 * Mapeia o resultado do PenaltyShoot (goal/save/post/wide/over-bar/weak-save)
 * para o "rng" (0-1) que o engine espera (rng < 0.5 = gol, > 0.5 = defesa).
 *
 * Mantém o pick_taker do antigo modal porque o engine precisa do takerId/name
 * antes de avançar.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { PitchPlayerState } from '@/engine/types';
import type { PenaltyState } from '@/gamespirit/spiritSnapshotTypes';
import {
  PenaltyShoot,
  type PenaltyKeeper,
  type PenaltyShootResult,
  type PenaltyShooter,
} from '@/components/penalty';

const TAKER_TIMEOUT = 10;

interface Props {
  penalty: PenaltyState;
  homePlayers: PitchPlayerState[];
  opponentStrength: number;
  onResolve: (rng: number, takerName: string) => void;
  onPickTaker: (playerId: string, name: string) => void;
  takerReady: boolean;
  homeScore: number;
  awayScore: number;
  homeShort: string;
  awayShort: string;
  minute: number;
  takerPortraitUrl?: string;
}

export function PenaltyKickModalV2(props: Props) {
  const {
    penalty,
    homePlayers,
    opponentStrength,
    onResolve,
    onPickTaker,
    takerReady,
  } = props;

  const isHome = penalty.side === 'home';
  const [phase, setPhase] = useState<'pick_taker' | 'shoot'>(
    !isHome || takerReady ? 'shoot' : 'pick_taker',
  );
  const [countdown, setCountdown] = useState(TAKER_TIMEOUT);

  // Se taker passou a estar ready, avança automaticamente
  useEffect(() => {
    if (takerReady && phase === 'pick_taker') {
      setPhase('shoot');
    }
  }, [takerReady, phase]);

  // Countdown da escolha do batedor
  useEffect(() => {
    if (phase !== 'pick_taker') return;
    const start = Date.now();
    setCountdown(TAKER_TIMEOUT);
    const id = window.setInterval(() => {
      const remaining = Math.ceil(Math.max(0, TAKER_TIMEOUT - (Date.now() - start) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        window.clearInterval(id);
        // Auto-pick: melhor finalizador disponível
        const top = [...homePlayers]
          .filter((p) => (p as any).attributes?.finalizacao != null)
          .sort(
            (a, b) =>
              ((b as any).attributes?.finalizacao ?? 0) -
              ((a as any).attributes?.finalizacao ?? 0),
          )[0] ?? homePlayers[0];
        if (top) onPickTaker(top.id, (top as any).name ?? top.id);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [phase, homePlayers, onPickTaker]);

  // ── Pick Taker ──
  if (phase === 'pick_taker') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-deep-black/95 flex items-center justify-center px-6"
        >
          <div className="max-w-xl w-full">
            <div className="text-center mb-6">
              <div className="text-[10px] uppercase tracking-[0.35em] text-neon-yellow/80 mb-2">
                Pênalti pra nós · {countdown}s
              </div>
              <h2
                className="ole-headline-italic text-white"
                style={{ fontSize: 'clamp(36px, 6vw, 64px)' }}
              >
                Quem bate?
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
              {homePlayers
                .slice()
                .sort(
                  (a, b) =>
                    ((b as any).attributes?.finalizacao ?? 0) -
                    ((a as any).attributes?.finalizacao ?? 0),
                )
                .map((p) => {
                  const finalizacao = (p as any).attributes?.finalizacao ?? 60;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onPickTaker(p.id, (p as any).name ?? p.id)}
                      className="flex items-center justify-between bg-zinc-900 border-2 border-zinc-700 hover:border-neon-yellow px-4 py-3 transition-all"
                    >
                      <div className="text-left">
                        <div className="font-display font-bold uppercase tracking-wider text-sm text-white">
                          {(p as any).name ?? p.id}
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                          {(p as any).role ?? '?'}
                        </div>
                      </div>
                      <div className="font-display font-black text-2xl text-neon-yellow">
                        {finalizacao}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Shoot ──
  if (!penalty.takerName || !penalty.takerId) {
    return null; // ainda esperando taker do parent state
  }

  // Buscar atributos do batedor
  const takerEntity = homePlayers.find((p) => p.id === penalty.takerId);
  const finishingRating =
    (takerEntity as any)?.attributes?.finalizacao ??
    (takerEntity as any)?.attrs?.finalizacao ??
    70;

  const shooter: PenaltyShooter = {
    id: penalty.takerId,
    displayName: penalty.takerName,
    shirtNumber: (takerEntity as any)?.shirtNumber ?? 9,
    finishingRating,
    forcaMental: (takerEntity as any)?.attributes?.forca_mental ?? 70,
  };

  // Goleiro adversário derivado do strength do clube
  const keeper: PenaltyKeeper = {
    id: 'opp-gk',
    displayName: 'Goleiro Adversário',
    readingRating: Math.max(40, Math.min(95, opponentStrength)),
    positioningRating: Math.max(40, Math.min(95, opponentStrength - 5)),
  };

  function handleResolved(result: PenaltyShootResult) {
    // Mapeia outcome do novo sistema → rng (engine espera 0-1)
    // rng < 0.5 = gol | rng > 0.5 = qualquer não-gol
    const rng = result.outcome === 'goal' ? 0.13 : 0.7;
    // 1.5s pra apreciar o resultado antes de avançar o engine
    window.setTimeout(() => {
      onResolve(rng, penalty.takerName ?? 'Batedor');
    }, 1500);
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col">
      <PenaltyShoot
        key={`shoot-${penalty.takerId}`}
        headerLabel="Pênalti em jogo"
        shooter={shooter}
        keeper={keeper}
        onResolved={handleResolved}
      />
    </div>
  );
}
