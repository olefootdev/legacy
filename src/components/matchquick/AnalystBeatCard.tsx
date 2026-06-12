/**
 * AnalystBeatCard — leitura do Analista + decisão do manager (Fase B Quick 2.0).
 *
 * Card amarelo no padrão dos decision moments: insight do cenário (gerado
 * pelo Python a partir da matchup matrix) + 3 escolhas. Os pesos NUNCA são
 * exibidos — a resposta certa é inferível do texto. Janela com countdown;
 * expirou sem escolha = jogo segue sem decisão (onChoose(null)).
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { AnalystBeat, AnalystBeatChoice } from '@/match/quickPlanTypes';

interface Props {
  beat: AnalystBeat;
  onChoose: (choice: AnalystBeatChoice | null) => void;
}

export function AnalystBeatCard({ beat, onChoose }: Props) {
  const [chosen, setChosen] = useState<string | null>(null);
  const resolvedRef = useRef(false);

  const resolve = (choice: AnalystBeatChoice | null) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setChosen(choice?.id ?? null);
    // Pequeno respiro visual antes de devolver o controle ao player
    window.setTimeout(() => onChoose(choice), choice ? 450 : 0);
  };

  useEffect(() => {
    const t = window.setTimeout(() => resolve(null), beat.window_ms);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className="w-full border border-amber-400/50 border-l-[3px] border-l-amber-400 bg-amber-400/10"
    >
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="font-display uppercase tracking-[0.3em] text-[9px] font-black text-amber-300">
          📋 Leitura do Analista
        </p>
        <span className="font-display tabular-nums text-amber-300 text-[11px] font-bold">
          {beat.minute}&prime;
        </span>
      </div>

      <p className="px-4 pb-3 text-[13px] sm:text-sm text-white/90 leading-snug">
        {beat.insight.text}
      </p>

      <div className="px-3 pb-3 flex flex-col gap-1.5">
        {beat.choices.map((c) => {
          const isPicked = chosen === c.id;
          const isDimmed = chosen !== null && !isPicked;
          return (
            <button
              key={c.id}
              type="button"
              disabled={chosen !== null}
              onClick={() => resolve(c)}
              className={`text-left px-3 py-2 border font-display uppercase tracking-[0.14em] text-[11px] font-bold transition-colors ${
                isPicked
                  ? 'bg-amber-400 text-black border-amber-400'
                  : isDimmed
                  ? 'border-zinc-800 text-white/25'
                  : 'border-amber-400/40 text-amber-100 hover:bg-amber-400 hover:text-black'
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Janela de decisão — barra esvaziando */}
      <div className="h-0.5 bg-zinc-900">
        <motion.div
          className="h-full bg-amber-400"
          initial={{ width: '100%' }}
          animate={{ width: chosen !== null ? undefined : '0%' }}
          transition={{ ease: 'linear', duration: beat.window_ms / 1000 }}
        />
      </div>
    </motion.div>
  );
}
