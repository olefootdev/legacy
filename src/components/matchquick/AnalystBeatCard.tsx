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
import { L } from '@/i18n/L';

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
  // DS 2027: a peça é concreto; a intenção vira só o rail + o rótulo.
  // Ataque = rua (é onde se age), perigo = baixa, leitura = papel.
  const theme = intent === 'attack'
    ? { rail: 'border-l-rua', text: 'text-rua', bar: 'bg-rua', Icon: Crosshair, label: L('Chance de gol', 'Goal chance') }
    : intent === 'defend'
    ? { rail: 'border-l-baixa', text: 'text-baixa', bar: 'bg-baixa', Icon: ShieldAlert, label: L('Perigo — segura', 'Danger — hold on') }
    : { rail: 'border-l-papel', text: 'text-papel', bar: 'bg-papel', Icon: Eye, label: L('Leitura do Analista', 'Analyst read') };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className={`w-full border-l-[4px] bg-concreto ${theme.rail}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-3 px-4 pb-2 pt-3">
        <span className={`flex min-w-0 items-center gap-2 font-prova text-[11px] font-bold uppercase tracking-[0.2em] ${theme.text}`}>
          <theme.Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
          <span className="truncate">{theme.label}</span>
        </span>
        <span className={`shrink-0 font-spray font-black text-[26px] leading-none tabular-nums ${theme.text}`}>
          {beat.minute}&prime;
        </span>
      </div>

      {reading ? (
        <div className="flex items-center gap-2 px-4 pb-6 pt-3 text-suave">
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="font-voz text-[22px] leading-none"
          >
            {L('O Analista está lendo o jogo…', 'The Analyst is reading the game…')}
          </motion.span>
        </div>
      ) : (
        <>
          <p className="px-4 pb-3 text-[14px] leading-snug text-papel">
            {beat.insight.text}
          </p>

          <div className="flex flex-col gap-2.5 px-4 pb-4">
            {beat.choices.map((c) => {
              const isPicked = chosen === c.id;
              const isDimmed = chosen !== null && !isPicked;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={chosen !== null}
                  onClick={() => resolve(c)}
                  className={`flex min-h-[50px] items-center justify-between gap-3 px-4 text-left font-impact text-[17px] uppercase leading-[1.05] transition-[transform,box-shadow,background-color,color] ${
                    isPicked
                      ? 'translate-x-0.5 translate-y-0.5 bg-rua text-asfalto-27 shadow-[2px_2px_0_var(--color-papel)]'
                      : isDimmed
                      ? 'border-2 border-linha text-fio'
                      : 'border-2 border-papel text-papel hover:bg-rua hover:border-rua hover:text-asfalto-27 hover:shadow-[4px_4px_0_var(--color-papel)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
                  }`}
                >
                  <span className="min-w-0">{c.label}</span>
                  {!isDimmed && <span aria-hidden className="shrink-0">→</span>}
                </button>
              );
            })}
          </div>

          {/* Janela de decisão — barra esvaziando no tom da intenção */}
          <div className="h-1 bg-linha">
            <motion.div
              className={`h-full ${theme.bar}`}
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
