/**
 * ManagerScoreToast — feedback imediato da Pontuação do Manager.
 *
 * Observa o último evento em `managerScore.log` e mostra um toast breve
 * "+N pontos · {motivo}" no momento da ação (treino, evolução, compra, venda…).
 * Conecta cada ação de gestão ao core-engagement de forma VISÍVEL — antes o
 * ganho só aparecia depois na Home. Montado global no Layout.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { L } from '@/i18n/L';

export function ManagerScoreToast() {
  const latest = useGameStore((s) => s.managerScore?.log?.[0]);
  const [shown, setShown] = useState<{ points: number; label: string; atMs: number } | null>(null);
  const lastAtRef = useRef<number>(0);

  useEffect(() => {
    if (!latest) return;
    // Só dispara quando um evento NOVO entra no topo do log.
    if (latest.atMs === lastAtRef.current) return;
    // Ignora o estado inicial (montagem com log pré-existente): só reage a
    // eventos que aconteceram depois do mount.
    if (lastAtRef.current === 0) {
      lastAtRef.current = latest.atMs;
      return;
    }
    lastAtRef.current = latest.atMs;
    setShown({ points: latest.points, label: latest.label, atMs: latest.atMs });
    const t = setTimeout(() => setShown(null), 2600);
    return () => clearTimeout(t);
  }, [latest]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-[120] flex justify-center px-4 lg:bottom-6">
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.atMs}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            role="status"
            aria-live="polite"
            className="flex max-w-[92vw] -rotate-1 items-center gap-3 bg-cal px-4 py-2.5 text-asfalto-27 shadow-[4px_4px_0_var(--color-asfalto-27)]"
          >
            <span aria-hidden className="grid h-8 w-8 flex-none place-items-center bg-asfalto-27">
              <TrendingUp className="h-4 w-4 text-rua" strokeWidth={2.4} />
            </span>
            <span className="min-w-0">
              <span className="block font-spray font-black text-[24px] uppercase leading-none tabular-nums">
                +{shown.points} {L('pontos', 'points')}
              </span>
              <span className="mt-1 block truncate font-prova text-[11px] font-bold">
                {shown.label}
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
