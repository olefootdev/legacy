/**
 * LigaOlePreviewModal — preview do time ANTES de cada partida da Liga OLE.
 *
 * Padrão "lista do pênalti": os 11 titulares em lista, cada um com nível de
 * fadiga e um alerta quando está cansado/indisponível. Clicar num titular abre
 * os reservas da mesma posição → troca na hora. Em cima, o seletor de formação
 * (troca = re-encaixa o elenco via suggestBestLineup).
 *
 * Ao confirmar, dispara SET_LINEUP { lineup, formationScheme } — que PERSISTE no
 * estado (e portanto na próxima partida e nas seguintes) — e segue pro jogo.
 */

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRightLeft, AlertTriangle, X } from 'lucide-react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { overallFromAttributes, samePersonKey } from '@/entities/player';
import { FATIGUE_EXHAUSTED_THRESHOLD } from '@/entities/lineup';
import { FORMATION_SCHEME_LIST, pitchUiSlots } from '@/match-engine/formations/catalog';
import { suggestBestLineup } from '@/team/suggestBestLineup';
import type { FormationSchemeId } from '@/match-engine/types';

interface Props {
  opponentName: string;
  opponentShort: string;
  opponentOverall?: number;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function fatigueTone(f: number): string {
  if (f >= FATIGUE_EXHAUSTED_THRESHOLD) return 'var(--color-danger, #ef4444)';
  if (f >= 65) return 'var(--color-warning, #f59e0b)';
  return 'var(--color-success, #22c55e)';
}

export function LigaOlePreviewModal({
  opponentName,
  opponentShort,
  opponentOverall,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const players = useGameStore((s) => s.players);
  const lineup = useGameStore((s) => s.lineup);
  const playerHealth = useGameStore((s) => s.playerHealth);
  const currentScheme = useGameStore((s) => s.manager.formationScheme);
  const dispatch = useGameDispatch();

  const [formation, setFormation] = useState<FormationSchemeId>(currentScheme);
  const [working, setWorking] = useState<Record<string, string>>(lineup);
  const [picking, setPicking] = useState<string | null>(null);

  const slots = useMemo(() => pitchUiSlots(formation), [formation]);

  const fatigueOf = (id: string | undefined): number => {
    if (!id) return 0;
    const h = playerHealth?.[id];
    if (h) return Math.round(h.fatigue);
    return Math.round(players[id]?.fatigue ?? 0);
  };
  const isAvailable = (id: string): boolean => {
    const h = playerHealth?.[id];
    if (h) return h.outForMatches <= 0 && h.suspendedMatches <= 0;
    return (players[id]?.outForMatches ?? 0) <= 0;
  };
  const unavailableLabel = (id: string): string | null => {
    const h = playerHealth?.[id];
    if (h && h.suspendedMatches > 0) return 'Suspenso';
    if (h ? h.outForMatches > 0 : (players[id]?.outForMatches ?? 0) > 0) return 'Lesionado';
    return null;
  };

  // Troca de formação → re-encaixa o elenco inteiro na nova formação.
  const changeFormation = (scheme: FormationSchemeId) => {
    setFormation(scheme);
    setPicking(null);
    const newSlots = pitchUiSlots(scheme);
    // suggestBestLineup deduplica por id, não por pessoa — então mantemos só 1
    // variação por pessoa (a de maior OVR) pra ele não escalar dois "iguais" e
    // o SET_LINEUP cortar um, deixando slot vazio.
    const bestPerPerson = new Map<string, (typeof players)[string]>();
    for (const p of Object.values(players)) {
      if (p.listedOnMarket || !isAvailable(p.id)) continue;
      const key = samePersonKey(p);
      const cur = bestPerPerson.get(key);
      if (!cur || overallFromAttributes(p.attrs) > overallFromAttributes(cur.attrs)) {
        bestPerPerson.set(key, p);
      }
    }
    const squad = [...bestPerPerson.values()].map((p) => ({
      id: p.id,
      pos: p.pos,
      ovr: overallFromAttributes(p.attrs),
      outForMatches: playerHealth?.[p.id]?.outForMatches ?? p.outForMatches ?? 0,
    }));
    const res = suggestBestLineup(newSlots, squad);
    if (!('error' in res)) setWorking(res.slotToPlayerId);
  };

  // Reservas elegíveis pra um slot: mesma posição, disponível, fora do XI e sem
  // conflito de "mesma pessoa" com outro titular.
  const benchFor = (slotLabel: string): typeof players[string][] => {
    const startersPersons = new Set(
      Object.entries(working)
        .filter(([sid]) => sid !== picking)
        .map(([, pid]) => (players[pid] ? samePersonKey(players[pid]) : `id:${pid}`)),
    );
    return Object.values(players)
      .filter((p) => p.pos === slotLabel)
      .filter((p) => !p.listedOnMarket && isAvailable(p.id))
      .filter((p) => !Object.values(working).includes(p.id))
      .filter((p) => !startersPersons.has(samePersonKey(p)))
      .sort((a, b) => overallFromAttributes(b.attrs) - overallFromAttributes(a.attrs));
  };

  const doSub = (slotId: string, playerId: string) => {
    setWorking((prev) => ({ ...prev, [slotId]: playerId }));
    setPicking(null);
  };

  const filled = slots.filter((s) => working[s.id] && players[working[s.id]]).length;
  const complete = filled === slots.length;
  const tiredCount = slots.filter((s) => fatigueOf(working[s.id]) >= FATIGUE_EXHAUSTED_THRESHOLD).length;

  const confirm = () => {
    if (!complete || busy) return;
    const ids: Record<string, string> = {};
    for (const s of slots) if (working[s.id]) ids[s.id] = working[s.id];
    dispatch({ type: 'SET_LINEUP', lineup: ids, formationScheme: formation });
    onConfirm();
  };

  const pickingSlot = picking ? slots.find((s) => s.id === picking) : null;

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
          <div className="min-w-0">
            <p className="font-display uppercase tracking-[0.28em] text-[10px] font-black text-neon-yellow">
              Antes da partida
            </p>
            <p className="text-[12px] text-white/60 truncate mt-0.5">
              vs {opponentName}
              {opponentOverall ? <span className="text-white/35"> · OVR {opponentOverall}</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/40 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[72vh] overflow-y-auto">
          {pickingSlot ? (
            /* Picker de reserva pra um slot */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-white/70">
                  {pickingSlot.label} · entra no lugar de{' '}
                  <span className="text-neon-yellow font-bold">
                    {players[working[pickingSlot.id]]?.name ?? '—'}
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
              {benchFor(pickingSlot.label).length === 0 && (
                <p className="text-[12px] text-white/50">Sem reservas pra essa posição.</p>
              )}
              {benchFor(pickingSlot.label).slice(0, 10).map((b) => {
                const f = fatigueOf(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => doSub(pickingSlot.id, b.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 border border-zinc-800 hover:border-neon-yellow/60 hover:bg-neon-yellow/5 transition-colors text-left"
                  >
                    <span
                      className="font-serif italic text-lg text-white/85 tabular-nums w-7 text-center"
                      style={{ fontFamily: 'var(--font-serif-hero)' }}
                    >
                      {overallFromAttributes(b.attrs)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-white truncate">{b.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: fatigueTone(f) }}>
                        fadiga {f}%
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {/* Formação */}
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 font-display font-black mb-1.5">
                  Formação
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {FORMATION_SCHEME_LIST.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => changeFormation(f)}
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

              {/* Lista de titulares */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 font-display font-black">
                    Titulares ({filled}/{slots.length})
                  </p>
                  {tiredCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: fatigueTone(99) }}>
                      <AlertTriangle className="w-3 h-3" strokeWidth={2.5} /> {tiredCount} cansado{tiredCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {slots.map((slot) => {
                    const pid = working[slot.id];
                    const p = pid ? players[pid] : undefined;
                    const f = fatigueOf(pid);
                    const tired = f >= FATIGUE_EXHAUSTED_THRESHOLD;
                    const outLabel = pid ? unavailableLabel(pid) : null;
                    return (
                      <div
                        key={slot.id}
                        className="flex items-center gap-3 px-3 py-2 border-l-[3px] bg-dark-gray"
                        style={{ borderLeftColor: outLabel ? 'var(--color-danger, #ef4444)' : fatigueTone(f) }}
                      >
                        <span className="text-[10px] font-display font-black uppercase tracking-[0.1em] text-white/40 w-9 text-center">
                          {slot.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-white truncate flex items-center gap-1.5">
                            {p?.name ?? '— vazio —'}
                            {(tired || outLabel) && (
                              <AlertTriangle className="w-3 h-3 shrink-0" strokeWidth={2.5} style={{ color: 'var(--color-danger, #ef4444)' }} />
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="h-1 flex-1 max-w-[120px] bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, f)}%`, backgroundColor: fatigueTone(f) }} />
                            </div>
                            <span className="text-[10px] tabular-nums" style={{ color: outLabel ? 'var(--color-danger, #ef4444)' : fatigueTone(f) }}>
                              {outLabel ?? `${f}%`}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPicking(slot.id)}
                          className="px-2.5 py-1 border border-neon-yellow/40 text-neon-yellow/80 text-[10px] font-display uppercase tracking-[0.12em] font-bold hover:bg-neon-yellow hover:text-black transition-colors inline-flex items-center gap-1"
                        >
                          <ArrowRightLeft className="w-3 h-3" strokeWidth={2.5} aria-hidden /> Trocar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Confirmar */}
        {!pickingSlot && (
          <div className="p-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={confirm}
              disabled={!complete || busy}
              className="w-full py-3 bg-neon-yellow hover:bg-white text-black font-display uppercase tracking-[0.18em] text-[12px] font-black transition-colors disabled:opacity-50"
            >
              {busy ? 'Preparando…' : `Entrar em campo vs ${opponentShort} →`}
            </button>
            {!complete && (
              <p className="text-[10px] text-center mt-2" style={{ color: 'var(--color-danger, #ef4444)' }}>
                Faltam titulares — preencha os {slots.length} para entrar.
              </p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
