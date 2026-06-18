/**
 * QuickHalftimePanel — intervalo da Partida Rápida 2.0 (Fase C).
 *
 * Mostra 5 cards: os 3 de melhor rendimento no topo e os 2 piores embaixo
 * (candidatos naturais a sair). O manager pode:
 *   • substituir um dos 2 piores por um reserva do banco
 *   • mudar a intensidade tática (defensiva / equilibrada / ofensiva)
 *   • clicar VOLTAR PARA O JOGO (ou esperar o countdown de 15s)
 *
 * Ao confirmar, devolve a lineup ajustada + intensidade. O orquestrador chama
 * o replan do Python com isso — as decisões do intervalo recalculam o 2º tempo
 * de verdade (lineup nova → matchup matrix nova → plano novo).
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRightLeft } from 'lucide-react';
import {
  pickHalftimeFive,
  type QuickHomePlayerView,
} from '@/match/quickEngaged/buildQuickPlanInputs';

export interface HalftimeBenchPlayer extends QuickHomePlayerView {}

export interface HalftimeResult {
  homePlayers: QuickHomePlayerView[];
  intensity: 'defensive' | 'balanced' | 'offensive';
  formation: string;
  subsUsed: number;
}

interface Props {
  homeShort: string;
  awayShort: string;
  homeScore: number;
  awayScore: number;
  homePlayers: QuickHomePlayerView[];
  bench: HalftimeBenchPlayer[];
  intensity: 'defensive' | 'balanced' | 'offensive';
  formation?: string;
  windowMs?: number;
  onResume: (result: HalftimeResult) => void;
}

const INTENSITIES: { id: 'defensive' | 'balanced' | 'offensive'; label: string }[] = [
  { id: 'defensive', label: 'Defensiva' },
  { id: 'balanced', label: 'Equilibrada' },
  { id: 'offensive', label: 'Ofensiva' },
];

const FORMATIONS = ['4-4-2', '4-3-3', '3-5-2', '5-3-2', '3-4-3'];

function MiniCard({
  p,
  tone,
  action,
}: {
  p: QuickHomePlayerView;
  tone: 'top' | 'bottom';
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 border-l-[3px] bg-dark-gray"
      style={{ borderLeftColor: tone === 'top' ? 'var(--color-success)' : 'var(--color-warning)' }}
    >
      <span
        className="font-serif italic text-xl text-white/90 tabular-nums w-7 text-center"
        style={{ fontFamily: 'var(--font-serif-hero)' }}
      >
        {p.ovr}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-white truncate">{p.name}</p>
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">
          {p.pos} · fadiga {Math.round(p.fatigue)}%
        </p>
      </div>
      {action}
    </div>
  );
}

export function QuickHalftimePanel({
  homeShort,
  awayShort,
  homeScore,
  awayScore,
  homePlayers,
  bench,
  intensity: intensityProp,
  formation: formationProp = '4-4-2',
  windowMs = 15_000,
  onResume,
}: Props) {
  const [working, setWorking] = useState<QuickHomePlayerView[]>(homePlayers);
  const [intensity, setIntensity] = useState(intensityProp);
  const [formation, setFormation] = useState(formationProp);
  const [subsUsed, setSubsUsed] = useState(0);
  const [picking, setPicking] = useState<string | null>(null); // outId aguardando reserva
  const [remaining, setRemaining] = useState(Math.round(windowMs / 1000));
  const usedBenchRef = useRef<Set<string>>(new Set());
  const resolvedRef = useRef(false);

  const five = pickHalftimeFive(working);

  const resume = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onResume({ homePlayers: working, intensity, formation, subsUsed });
  };

  // Countdown limpo: o resume() roda num EFEITO (não dentro do updater de
  // setState) pra não atualizar o pai durante o render.
  useEffect(() => {
    if (remaining <= 0) {
      resume();
      return undefined;
    }
    const t = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const doSub = (outId: string, replacement: HalftimeBenchPlayer) => {
    usedBenchRef.current.add(replacement.id);
    setWorking((prev) => prev.map((p) => (p.id === outId ? replacement : p)));
    setSubsUsed((n) => n + 1);
    setPicking(null);
  };

  const availableBench = bench.filter((b) => !usedBenchRef.current.has(b.id) && !working.some((w) => w.id === b.id));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/92 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md bg-deep-black border border-neon-yellow/30 overflow-hidden"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        {/* Header */}
        <div className="px-5 py-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <p className="font-display uppercase tracking-[0.28em] text-[10px] font-black text-neon-yellow">
              Intervalo
            </p>
            <p className="text-[12px] text-white/60 tabular-nums mt-0.5">
              {homeShort} {homeScore} – {awayScore} {awayShort}
            </p>
          </div>
          <span className="font-display tabular-nums text-neon-yellow text-2xl font-black">
            {remaining}s
          </span>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 5 cards */}
          {picking === null ? (
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-[0.2em] font-display font-black" style={{ color: 'var(--color-success)' }}>
                Em alta
              </p>
              {five.top.map((p) => (
                <MiniCard
                  key={p.id}
                  p={p}
                  tone="top"
                  action={
                    availableBench.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setPicking(p.id)}
                        className="px-2.5 py-1 border border-neon-yellow/40 text-neon-yellow/80 text-[10px] font-display uppercase tracking-[0.12em] font-bold hover:bg-neon-yellow hover:text-black transition-colors inline-flex items-center gap-1"
                      >
                        <ArrowRightLeft className="w-3 h-3" strokeWidth={2.5} aria-hidden /> Trocar
                      </button>
                    ) : null
                  }
                />
              ))}
              <p className="text-[9px] uppercase tracking-[0.2em] font-display font-black pt-1" style={{ color: 'var(--color-warning)' }}>
                Apagados — trocar?
              </p>
              {five.bottom.map((p) => (
                <MiniCard
                  key={p.id}
                  p={p}
                  tone="bottom"
                  action={
                    availableBench.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setPicking(p.id)}
                        className="px-2.5 py-1 border border-neon-yellow/50 text-neon-yellow text-[10px] font-display uppercase tracking-[0.12em] font-bold hover:bg-neon-yellow hover:text-black transition-colors inline-flex items-center gap-1"
                      >
                        <ArrowRightLeft className="w-3 h-3" strokeWidth={2.5} aria-hidden /> Trocar
                      </button>
                    ) : null
                  }
                />
              ))}
            </div>
          ) : (
            /* Picker de reserva */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-white/70">
                  Entra no lugar de{' '}
                  <span className="text-neon-yellow font-bold">
                    {working.find((w) => w.id === picking)?.name}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => setPicking(null)}
                  className="text-[10px] text-white/40 hover:text-white uppercase tracking-[0.14em]"
                >
                  Cancelar
                </button>
              </div>
              {availableBench.length === 0 && (
                <p className="text-[12px] text-white/50">Sem reservas disponíveis.</p>
              )}
              {availableBench.slice(0, 8).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => doSub(picking, b)}
                  className="w-full flex items-center gap-3 px-3 py-2 border border-zinc-800 hover:border-neon-yellow/60 hover:bg-neon-yellow/5 transition-colors text-left"
                >
                  <span
                    className="font-serif italic text-lg text-white/85 tabular-nums w-7 text-center"
                    style={{ fontFamily: 'var(--font-serif-hero)' }}
                  >
                    {b.ovr}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{b.name}</p>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">
                      {b.pos} · fadiga {Math.round(b.fatigue)}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Intensidade tática */}
          {picking === null && (
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 font-display font-black mb-1.5">
                Estratégia
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {INTENSITIES.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setIntensity(it.id)}
                    className={`py-2 text-[10px] font-display uppercase tracking-[0.1em] font-bold border transition-colors ${
                      intensity === it.id
                        ? 'bg-neon-yellow text-black border-neon-yellow'
                        : 'border-zinc-700 text-white/60 hover:border-neon-yellow/50'
                    }`}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Formação */}
          {picking === null && (
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 font-display font-black mb-1.5">
                Formação
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {FORMATIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormation(f)}
                    className={`py-2 text-[10px] font-display tabular-nums font-bold border transition-colors ${
                      formation === f
                        ? 'bg-neon-yellow text-black border-neon-yellow'
                        : 'border-zinc-700 text-white/60 hover:border-neon-yellow/50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Voltar pro jogo */}
        {picking === null && (
          <div className="p-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={resume}
              className="w-full py-3 bg-neon-yellow hover:bg-white text-black font-display uppercase tracking-[0.18em] text-[12px] font-black transition-colors"
            >
              Voltar para o jogo →
            </button>
            {subsUsed > 0 && (
              <p className="text-[10px] text-white/40 text-center mt-2">
                {subsUsed} substituiç{subsUsed === 1 ? 'ão' : 'ões'} · o 2º tempo será recalculado
              </p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
