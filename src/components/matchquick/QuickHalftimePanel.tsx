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
import type { LeituraDoIntervalo } from '@/match/auxiliarDoIntervalo';
import { motion } from 'motion/react';
import { ArrowRightLeft } from 'lucide-react';
import {
  pickHalftimeFive,
  type QuickHomePlayerView,
} from '@/match/quickEngaged/buildQuickPlanInputs';
import { L, emIngles } from '@/i18n/L';
import { posLabel } from './posLabel';

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
  /** Substituições ainda disponíveis no teto de 5 (já desconta as do 1º tempo). */
  maxSubs?: number;
  /** Partida Viva, Fase 9: o auxiliar aponta um problema e sugere a estratégia. */
  auxiliar?: LeituraDoIntervalo;
  onResume: (result: HalftimeResult) => void;
}

const INTENSITIES: { id: 'defensive' | 'balanced' | 'offensive'; label: string }[] = [
  { id: 'defensive', label: L('Defensiva', 'Defensive') },
  { id: 'balanced', label: L('Equilibrada', 'Balanced') },
  { id: 'offensive', label: L('Ofensiva', 'Attacking') },
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
      className={`flex min-h-[54px] min-w-0 items-center gap-3 border-l-[3px] bg-concreto px-3 py-2 ${
        tone === 'top' ? 'border-alta' : 'border-dashed border-fio'
      }`}
    >
      <span className="w-8 shrink-0 text-center font-impact text-[20px] leading-none text-papel tabular-nums">{p.ovr}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-voz text-[20px] leading-none text-papel">{p.name}</p>
        <p className="mt-1 font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-mudo">
          {posLabel(p.pos)} · {L('fadiga', 'fatigue')} {Math.round(p.fatigue)}%
        </p>
      </div>
      {action}
    </div>
  );
}

const TROCAR =
  'inline-flex min-h-[38px] shrink-0 items-center gap-1 bg-rua px-2.5 font-impact text-[14px] uppercase leading-none text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)] transition-[transform,box-shadow] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--color-papel)]';

const ROTULO = 'font-prova text-[11px] font-bold uppercase tracking-[0.2em]';

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
  maxSubs = 5,
  auxiliar,
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
    if (subsUsed >= maxSubs) { setPicking(null); return; } // respeita o teto de 5
    usedBenchRef.current.add(replacement.id);
    setWorking((prev) => prev.map((p) => (p.id === outId ? replacement : p)));
    setSubsUsed((n) => n + 1);
    setPicking(null);
  };
  const subsLeft = Math.max(0, maxSubs - subsUsed);

  const availableBench = bench.filter((b) => !usedBenchRef.current.has(b.id) && !working.some((w) => w.id === b.id));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex items-end justify-center bg-asfalto-27/95 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={L('Intervalo', 'Half-time')}
    >
      <motion.div
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex max-h-[100dvh] w-full max-w-md flex-col overflow-hidden border-t-[3px] border-rua bg-asfalto-27 sm:border-[3px]"
      >
        {/* Header — o placar do intervalo em spray, o relógio contando */}
        <div className="rua-grao flex min-w-0 items-end justify-between gap-3 bg-concreto px-5 pb-4 pt-4">
          <div className="min-w-0">
            <p className={`${ROTULO} text-rua`}>— {L('Intervalo', 'Half-time')}</p>
            <p className="mt-1 flex min-w-0 items-baseline gap-2 font-impact uppercase leading-none text-papel">
              <span className="truncate text-[17px]">{homeShort}</span>
              <span className="shrink-0 font-spray font-black text-[44px] tabular-nums text-rua">
                {homeScore}×{awayScore}
              </span>
              <span className="truncate text-[17px] text-mudo">{awayShort}</span>
            </p>
            <p className={`${ROTULO} mt-1.5 ${subsLeft === 0 ? 'text-baixa' : 'text-mudo'}`}>
              {emIngles() ? `${subsLeft} sub${subsLeft === 1 ? '' : 's'} left` : `${subsLeft} troca${subsLeft === 1 ? '' : 's'} restante${subsLeft === 1 ? '' : 's'}`}
            </p>
          </div>
          <span className="shrink-0 font-spray font-black text-[48px] leading-none tabular-nums text-papel" aria-label={L(`${remaining} segundos`, `${remaining} seconds`)}>
            {remaining}
            <span className="font-prova text-[14px] text-mudo">s</span>
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {/* O auxiliar: UM problema do 1º tempo + a estratégia sugerida (o manager decide). */}
          {picking === null && auxiliar && (
            <div className="border-l-[3px] border-rua bg-concreto px-3 py-2.5">
              <p className={`${ROTULO} text-rua`}>— {L('Auxiliar', 'Assistant')}</p>
              <p className="mt-1 font-sans text-[15px] font-bold leading-snug text-papel">{auxiliar.texto}</p>
              <p className="mt-0.5 font-sans text-[13px] leading-snug text-suave">{auxiliar.porque}</p>
              {auxiliar.sugestao && auxiliar.sugestao !== intensity && (
                <button
                  type="button"
                  onClick={() => setIntensity(auxiliar.sugestao!)}
                  className="mt-2 min-h-[40px] bg-rua px-3 font-impact text-[14px] uppercase leading-none text-asfalto-27"
                >
                  {L('Seguir', 'Follow')}: {INTENSITIES.find((i) => i.id === auxiliar.sugestao)?.label}
                </button>
              )}
            </div>
          )}

          {/* 5 cards */}
          {picking === null ? (
            <div className="space-y-2">
              <p className={`${ROTULO} text-alta`}>{L('Em alta', 'On fire')}</p>
              {five.top.map((p) => (
                <MiniCard
                  key={p.id}
                  p={p}
                  tone="top"
                  action={
                    availableBench.length > 0 && subsLeft > 0 ? (
                      <button type="button" onClick={() => setPicking(p.id)} className={TROCAR}>
                        <ArrowRightLeft className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> {L('Trocar', 'Swap')}
                      </button>
                    ) : null
                  }
                />
              ))}
              <p className={`${ROTULO} pt-2 text-mudo`}>{L('Apagados — trocar?', 'Off the pace — swap?')}</p>
              {five.bottom.map((p) => (
                <MiniCard
                  key={p.id}
                  p={p}
                  tone="bottom"
                  action={
                    availableBench.length > 0 && subsLeft > 0 ? (
                      <button type="button" onClick={() => setPicking(p.id)} className={TROCAR}>
                        <ArrowRightLeft className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> {L('Trocar', 'Swap')}
                      </button>
                    ) : null
                  }
                />
              ))}
            </div>
          ) : (
            /* Picker de reserva */
            <div className="space-y-2">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <p className="min-w-0 text-[13px] text-suave">
                  {L('Entra no lugar de', 'Coming on for')}{' '}
                  <span className="font-voz text-[20px] leading-none text-papel">
                    {working.find((w) => w.id === picking)?.name}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => setPicking(null)}
                  className={`${ROTULO} min-h-[40px] shrink-0 text-mudo hover:text-papel`}
                >
                  {L('Cancelar', 'Cancel')}
                </button>
              </div>
              {availableBench.length === 0 && (
                <p className="text-[13px] text-mudo">{L('Sem reservas disponíveis.', 'No subs available.')}</p>
              )}
              {availableBench.slice(0, 8).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => doSub(picking, b)}
                  className="flex min-h-[54px] w-full min-w-0 items-center gap-3 border-2 border-linha bg-concreto px-3 py-2 text-left transition-colors hover:border-rua"
                >
                  <span className="w-8 shrink-0 text-center font-impact text-[20px] leading-none text-papel tabular-nums">{b.ovr}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-voz text-[20px] leading-none text-papel">{b.name}</p>
                    <p className="mt-1 font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-mudo">
                      {posLabel(b.pos)} · {L('fadiga', 'fatigue')} {Math.round(b.fatigue)}%
                    </p>
                  </div>
                  <span aria-hidden className="shrink-0 font-impact text-[18px] text-rua">→</span>
                </button>
              ))}
            </div>
          )}

          {/* Intensidade tática */}
          {picking === null && (
            <div>
              <p className={`${ROTULO} mb-2 text-mudo`}>— {L('Estratégia', 'Strategy')}</p>
              <div className="grid grid-cols-3 gap-2">
                {INTENSITIES.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setIntensity(it.id)}
                    aria-pressed={intensity === it.id}
                    className={`min-h-[46px] px-1 font-impact text-[15px] uppercase leading-none transition-colors ${
                      intensity === it.id
                        ? 'bg-rua text-asfalto-27'
                        : 'border-2 border-linha text-suave hover:border-papel hover:text-papel'
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
              <p className={`${ROTULO} mb-2 text-mudo`}>— {L('Formação', 'Formation')}</p>
              <div className="grid grid-cols-5 gap-1.5">
                {FORMATIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormation(f)}
                    aria-pressed={formation === f}
                    className={`min-h-[44px] font-impact text-[14px] tabular-nums leading-none transition-colors ${
                      formation === f
                        ? 'bg-rua text-asfalto-27'
                        : 'border-2 border-linha text-suave hover:border-papel hover:text-papel'
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
          <div className="border-t border-linha p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={resume}
              className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 bg-rua font-impact text-[20px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)]"
            >
              {L('Voltar pro jogo', 'Back to the match')} <span aria-hidden>→</span>
            </button>
            {subsUsed > 0 && (
              <p className="mt-3 text-center font-prova text-[11px] text-mudo">
                {emIngles() ? `${subsUsed} substitution${subsUsed === 1 ? '' : 's'} · 2nd half will be recalculated` : `${subsUsed} substituiç${subsUsed === 1 ? 'ão' : 'ões'} · o 2º tempo será recalculado`}
              </p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
