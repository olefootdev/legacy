/**
 * AnalystBeatCard — leitura do Analista + decisão do manager (Legacy Tech).
 *
 * Padrão de card-âncora: rail 3px à esquerda no token da intenção, bg dark-gray,
 * label Agency uppercase + ícone Lucide (sem emoji). Cue de antecipação ("o
 * Analista está lendo o jogo…") cria tensão antes das opções aparecerem.
 * Os pesos NUNCA são exibidos — a resposta certa é inferível do texto.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Eye, Crosshair, ShieldAlert } from 'lucide-react';
import type { AnalystBeat, AnalystBeatChoice } from '@/match/quickPlanTypes';

interface Props {
  beat: AnalystBeat;
  onChoose: (choice: AnalystBeatChoice | null) => void;
}

const INTRO_MS = 850;

export function AnalystBeatCard({ beat, onChoose }: Props) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [reading, setReading] = useState(true); // cue de antecipação
  const resolvedRef = useRef(false);

  const resolve = (choice: AnalystBeatChoice | null) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setChosen(choice?.id ?? null);
    window.setTimeout(() => onChoose(choice), choice ? 450 : 0);
  };

  useEffect(() => {
    const intro = window.setTimeout(() => setReading(false), INTRO_MS);
    // Janela de decisão só começa a contar depois do cue.
    const t = window.setTimeout(() => resolve(null), INTRO_MS + beat.window_ms);
    return () => { window.clearTimeout(intro); window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat.id]);

  const intent = beat.intent ?? 'neutral';
  const theme = intent === 'attack'
    ? { token: 'var(--color-success)', Icon: Crosshair, label: 'Chance de gol' }
    : intent === 'defend'
    ? { token: 'var(--color-danger)', Icon: ShieldAlert, label: 'Perigo — segura' }
    : { token: 'var(--color-neon-yellow)', Icon: Eye, label: 'Leitura do Analista' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className="w-full border border-l-[3px] bg-dark-gray"
      style={{ borderColor: 'var(--color-border)', borderLeftColor: theme.token, borderRadius: 'var(--radius-md)' }}
    >
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 font-display uppercase tracking-[0.28em] text-[10px] font-black" style={{ color: theme.token }}>
          <theme.Icon className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
          {theme.label}
        </span>
        <span className="font-display tabular-nums text-[11px] font-bold" style={{ color: theme.token }}>
          {beat.minute}&prime;
        </span>
      </div>

      {reading ? (
        <div className="px-4 py-6 flex items-center gap-2 text-white/55">
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="font-sans text-[13px] italic"
          >
            O Analista está lendo o jogo…
          </motion.span>
        </div>
      ) : (
        <>
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
                  className={`text-left px-3 py-2.5 border font-display uppercase tracking-[0.16em] text-[11px] font-black transition-all active:scale-[0.98] ${
                    isPicked ? 'text-black' : isDimmed ? 'border-white/8 text-white/25' : 'text-white/90 hover:text-black'
                  }`}
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isPicked ? theme.token : undefined,
                    borderColor: isPicked ? theme.token : isDimmed ? undefined : 'color-mix(in srgb, ' + theme.token + ' 40%, transparent)',
                    ...(isPicked ? {} : isDimmed ? {} : { ['--hover-bg' as string]: theme.token }),
                  }}
                  onMouseEnter={(e) => { if (!isPicked && !isDimmed) e.currentTarget.style.backgroundColor = theme.token; }}
                  onMouseLeave={(e) => { if (!isPicked && !isDimmed) e.currentTarget.style.backgroundColor = ''; }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Janela de decisão — barra esvaziando no token da intenção */}
          <div className="h-0.5 bg-deep-black/60">
            <motion.div
              className="h-full"
              style={{ backgroundColor: theme.token }}
              initial={{ width: '100%' }}
              animate={{ width: chosen !== null ? undefined : '0%' }}
              transition={{ ease: 'linear', duration: beat.window_ms / 1000 }}
            />
          </div>
        </>
      )}
    </motion.div>
  );
}
