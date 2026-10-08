/**
 * MatchPreviewModal — preview/gestão do time ANTES de qualquer partida.
 *
 * Genérico (Liga Ole, Partida Rápida, etc.). Padrão "lista do pênalti": os 11
 * titulares em lista, cada um com nível de fadiga, previsão de fadiga pós-jogo
 * e alerta quando cansado/indisponível. Clicar num titular abre os reservas da
 * mesma posição → troca na hora. Em cima, o seletor de formação (troca =
 * re-encaixa via suggestBestLineup) e os presets salvos.
 *
 * Ao confirmar/salvar, dispara SET_LINEUP { lineup, formationScheme } — que
 * PERSISTE no estado (próximas partidas) — e (no confirmar) segue pro jogo.
 *
 * Origem: LigaOlePreviewModal (mantido como alias retrocompatível).
 */

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRightLeft, AlertTriangle, X, Wand2, Check, ShoppingBag, Star, Plus } from 'lucide-react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { overallFromAttributes, samePersonKey } from '@/entities/player';
import { FATIGUE_EXHAUSTED_THRESHOLD } from '@/entities/lineup';
import { FORMATION_SCHEME_LIST, pitchUiSlots } from '@/match-engine/formations/catalog';
import { suggestBestLineup } from '@/team/suggestBestLineup';
import type { FormationSchemeId } from '@/match-engine/types';
import {
  TACTICAL_INTENSITY_PRESETS,
  type TacticalIntensityLevel,
} from '@/match/quickTacticalIntensity';
import { track } from '@/analytics/track';

import { L } from '@/i18n/L';
import { posLabel } from './posLabel';
interface Props {
  opponentName: string;
  opponentShort: string;
  opponentOverall?: number;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Leva ao mercado pra buscar reforço (escalação é salva antes de sair). */
  onGoToMarket?: () => void;
}

// Fadiga é delta de jogo: baixa = cansado, atenção = no limite, papel = inteiro.
function fatigueTone(f: number): string {
  if (f >= FATIGUE_EXHAUSTED_THRESHOLD) return 'var(--color-baixa)';
  if (f >= 65) return 'var(--color-atencao)';
  return 'var(--color-suave)';
}

// Ganho ESTIMADO de fadiga por partida (titular joga ~90'). Heurística pra
// previsão — não é o número exato do motor, por isso mostramos com "~".
const FORECAST_MATCH_GAIN = 18;
function forecastFatigue(current: number): number {
  return Math.min(100, Math.round(current + FORECAST_MATCH_GAIN));
}

// ── Presets de escalação (Fase 4) — persistidos em localStorage ──────────────
interface LineupPreset {
  name: string;
  formation: FormationSchemeId;
  lineup: Record<string, string>;
}
/**
 * FOCO da partida — os 5 estilos humanos do jogo, do mais cauteloso ao mais
 * agressivo. É a decisão de UMA linha que o manager toma antes de entrar em
 * campo: por dentro cada um vira dezenas de parâmetros (linha, prensa, fadiga,
 * chance de contra-ataque) via TACTICAL_INTENSITY_PRESETS, e o log de estilos
 * alimenta o DNA do clube (eixo Romântico ↔ Pragmático).
 *
 * Nada de motor novo aqui: a ação SET_TACTICAL_INTENSITY já existia e já era
 * lida ao vivo pelo dock da partida. O que faltava era poder decidir ANTES.
 */
const FOCUS_ORDER: readonly TacticalIntensityLevel[] = [
  'defend', 'possession', 'counter', 'press', 'attack',
] as const;

const PRESETS_KEY = 'olefoot.lineup-presets-v1';
const MAX_PRESETS = 3;
function readPresets(): LineupPreset[] {
  try {
    const v = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]');
    return Array.isArray(v) ? (v as LineupPreset[]).slice(0, MAX_PRESETS) : [];
  } catch {
    return [];
  }
}
function writePresets(v: LineupPreset[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(v.slice(0, MAX_PRESETS)));
  } catch {
    /* ignore */
  }
}

export function MatchPreviewModal({
  opponentName,
  opponentShort,
  opponentOverall,
  busy,
  onConfirm,
  onCancel,
  onGoToMarket,
}: Props) {
  const players = useGameStore((s) => s.players);
  const clubName = useGameStore((s) => s.club.name);
  const lineup = useGameStore((s) => s.lineup);
  const playerHealth = useGameStore((s) => s.playerHealth);
  const currentScheme = useGameStore((s) => s.manager.formationScheme);
  const dispatch = useGameDispatch();
  // FOCO da partida — seletor estável (lê o objeto que já está no estado).
  const intensity = useGameStore((st) => st.quickMatchIntensity);
  const focus: TacticalIntensityLevel = intensity?.current ?? 'possession';

  const [formation, setFormation] = useState<FormationSchemeId>(currentScheme);
  const [working, setWorking] = useState<Record<string, string>>(lineup);
  const [picking, setPicking] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [presets, setPresets] = useState<LineupPreset[]>(() => readPresets());

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
    if (h && h.suspendedMatches > 0) return L('Suspenso', 'Suspended');
    if (h ? h.outForMatches > 0 : (players[id]?.outForMatches ?? 0) > 0) return L('Lesionado', 'Injured');
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
      if (!cur || overallFromAttributes(p.attrs, p.pos) > overallFromAttributes(cur.attrs, cur.pos)) {
        bestPerPerson.set(key, p);
      }
    }
    const squad = [...bestPerPerson.values()].map((p) => ({
      id: p.id,
      pos: p.pos,
      ovr: overallFromAttributes(p.attrs, p.pos),
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
      .sort((a, b) => overallFromAttributes(b.attrs, b.pos) - overallFromAttributes(a.attrs, a.pos));
  };

  const doSub = (slotId: string, playerId: string) => {
    setWorking((prev) => ({ ...prev, [slotId]: playerId }));
    setPicking(null);
  };

  const filled = slots.filter((s) => working[s.id] && players[working[s.id]]).length;
  const complete = filled === slots.length;
  const tiredCount = slots.filter((s) => fatigueOf(working[s.id]) >= FATIGUE_EXHAUSTED_THRESHOLD).length;
  // Titular que precisa de atenção: cansado OU indisponível (lesão/suspensão).
  const needsManaging = slots.some((s) => {
    const pid = working[s.id];
    if (!pid) return true;
    return fatigueOf(pid) >= FATIGUE_EXHAUSTED_THRESHOLD || !isAvailable(pid);
  });

  // Persiste a escalação atual no estado (não inicia a partida).
  const persistWorking = () => {
    if (!complete) return false;
    const ids: Record<string, string> = {};
    for (const s of slots) if (working[s.id]) ids[s.id] = working[s.id];
    dispatch({ type: 'SET_LINEUP', lineup: ids, formationScheme: formation });
    return true;
  };

  const confirm = () => {
    if (!complete || busy) return;
    persistWorking();
    onConfirm();
  };

  // SALVAR ELENCO — grava as mudanças e dá feedback, sem sair pra partida.
  const save = () => {
    if (!persistWorking()) return;
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };

  // ── Presets ────────────────────────────────────────────────────────────────
  const saveAsPreset = () => {
    if (!complete) return;
    const ids: Record<string, string> = {};
    for (const s of slots) if (working[s.id]) ids[s.id] = working[s.id];
    const preset: LineupPreset = { name: `${formation} · ${filled} tit`, formation, lineup: ids };
    // Evita duplicar idêntico; cap em MAX_PRESETS (descarta o mais antigo).
    const next = [preset, ...presets.filter((p) => p.formation !== formation)].slice(0, MAX_PRESETS);
    setPresets(next);
    writePresets(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };
  const loadPreset = (p: LineupPreset) => {
    setPicking(null);
    setFormation(p.formation);
    // Só carrega ids que ainda existem no elenco (jogador vendido vira vazio).
    const valid: Record<string, string> = {};
    for (const [slot, pid] of Object.entries(p.lineup)) if (players[pid]) valid[slot] = pid;
    setWorking(valid);
  };
  const deletePreset = (name: string) => {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    writePresets(next);
  };

  // GERIR ELENCO — a IA troca os cansados/indisponíveis pelos melhores reservas
  // frescos da mesma posição, de uma vez só.
  const autoManageSquad = () => {
    setPicking(null);
    setWorking((prev) => {
      const next = { ...prev };
      const usedPersons = new Set(
        Object.values(next).map((pid) => (players[pid] ? samePersonKey(players[pid]) : `id:${pid}`)),
      );
      let changed = false;
      for (const slot of slots) {
        const pid = next[slot.id];
        const ok = pid && fatigueOf(pid) < FATIGUE_EXHAUSTED_THRESHOLD && isAvailable(pid);
        if (ok) continue;
        const candidate = Object.values(players)
          .filter((p) => p.pos === slot.label)
          .filter((p) => !p.listedOnMarket && isAvailable(p.id))
          .filter((p) => fatigueOf(p.id) < FATIGUE_EXHAUSTED_THRESHOLD)
          .filter((p) => !Object.values(next).includes(p.id))
          .filter((p) => !usedPersons.has(samePersonKey(p)))
          .sort((a, b) => {
            const fa = fatigueOf(a.id);
            const fb = fatigueOf(b.id);
            // Prioriza o mais descansado; com fadiga parecida, o de maior OVR.
            if (Math.abs(fa - fb) > 8) return fa - fb;
            return overallFromAttributes(b.attrs, b.pos) - overallFromAttributes(a.attrs, a.pos);
          })[0];
        if (candidate) {
          if (pid && players[pid]) usedPersons.delete(samePersonKey(players[pid]));
          next[slot.id] = candidate.id;
          usedPersons.add(samePersonKey(candidate));
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  // VOLTAR — do picker, volta pra lista; da lista, salva e fecha (não perde nada).
  const handleClose = () => {
    if (picking) {
      setPicking(null);
      return;
    }
    persistWorking();
    onCancel();
  };

  const goToMarket = () => {
    persistWorking();
    if (onGoToMarket) onGoToMarket();
    else onCancel();
  };

  const pickingSlot = picking ? slots.find((s) => s.id === picking) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[105] flex items-end justify-center bg-asfalto-27/95 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex max-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-asfalto-27 sm:border-[3px] sm:border-rua"
      >
        {/* Header — a CONVOCAÇÃO (DS 2027, PDF pág. 5): X vs Y, o "x" na voz, alambrado. */}
        <div className="relative shrink-0 overflow-hidden bg-rua px-5 pb-4 pt-3 text-asfalto-27">
          <span aria-hidden className="rua-alambrado pointer-events-none absolute inset-x-0 top-0 h-24 [--alambrado:rgba(13,13,12,0.24)]" />
          <div className="relative flex min-w-0 items-center justify-between gap-3">
            <p className="truncate font-prova text-[11px] font-bold uppercase tracking-[0.22em]">
              {L('Antes da partida', 'Before the match')}
              {opponentOverall ? <span className="opacity-70"> · OVR {opponentOverall}</span> : null}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center hover:bg-asfalto-27 hover:text-rua"
              aria-label={picking ? L('Voltar', 'Back') : L('Fechar', 'Close')}
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
          <p className="relative mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 font-impact uppercase leading-[0.9]" style={{ fontSize: 'clamp(26px, 8vw, 36px)' }}>
            <span className="min-w-0 [overflow-wrap:anywhere]">{clubName}</span>
            <span aria-hidden className="font-voz normal-case" style={{ fontSize: '1.15em' }}>x</span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{opponentName}</span>
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {pickingSlot ? (
            /* Picker de reserva pra um slot */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="min-w-0 text-[13px] text-suave">
                  <span className="font-prova text-[11px] font-bold uppercase text-mudo">{posLabel(pickingSlot.label)}</span> · {L('entra no lugar de', 'replaces')}{' '}
                  <span className="font-voz text-[19px] leading-none text-papel">
                    {players[working[pickingSlot.id]]?.name ?? '—'}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => setPicking(null)}
                  className="min-h-[40px] shrink-0 font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo hover:text-papel"
                >
                  {L('Cancelar', 'Cancel')}
                </button>
              </div>
              {benchFor(pickingSlot.label).length === 0 && (
                <div className="space-y-2.5">
                  <p className="text-[13px] text-mudo">{L('Sem reservas pra essa posição.', 'No subs for this position.')}</p>
                  <button
                    type="button"
                    onClick={goToMarket}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 border-2 border-papel px-3 font-impact text-[16px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> {L('Buscar reforço no mercado', 'Find a signing in the Market')}
                  </button>
                  <p className="text-center font-prova text-[10px] text-mudo">{L('Sua escalação é salva antes de ir ao mercado.', 'Your lineup is saved before going to the Market.')}</p>
                </div>
              )}
              {benchFor(pickingSlot.label).slice(0, 10).map((b) => {
                const f = fatigueOf(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => doSub(pickingSlot.id, b.id)}
                    className="flex min-h-[54px] w-full min-w-0 items-center gap-3 border-2 border-linha bg-concreto px-3 py-2 text-left transition-colors hover:border-rua"
                  >
                    <span className="w-8 shrink-0 text-center font-impact text-[19px] leading-none tabular-nums text-papel">
                      {overallFromAttributes(b.attrs, b.pos)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-voz text-[19px] leading-none text-papel">{b.name}</p>
                      <p className="mt-1 font-prova text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: fatigueTone(f) }}>
                        {L('fadiga', 'fatigue')} {f}% → ~{forecastFatigue(f)}% {L('pós-jogo', 'post-match')}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {/* FOCO — a decisão da partida. Vem antes de escalação e formação
                  de propósito: é a única escolha aqui que muda o jogo por si só. */}
              <div>
                <p className="mb-2 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
                  — {L('Foco', 'Focus')}
                </p>
                <div className="grid grid-cols-5 gap-1">
                  {FOCUS_ORDER.map((level) => {
                    const preset = TACTICAL_INTENSITY_PRESETS[level];
                    const active = focus === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          // A pergunta: o manager MEXE nisso, ou aceita o
                          // default? `from` mostra de onde ele saiu.
                          track('focus_chosen', { level, from: focus, changed: level !== focus });
                          dispatch({ type: 'SET_TACTICAL_INTENSITY', level });
                        }}
                        className={
                          'min-h-[46px] px-0.5 py-2 font-impact text-[12px] uppercase leading-[1.05] transition-colors [overflow-wrap:anywhere] ' +
                          (active
                            ? 'bg-rua text-asfalto-27'
                            : 'border-2 border-linha text-suave hover:border-papel hover:text-papel')
                        }
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[12.5px] leading-snug text-suave">
                  {TACTICAL_INTENSITY_PRESETS[focus].description}
                </p>
              </div>

              {/* Presets salvos (Fase 4) */}
              <div>
                <p className="mb-2 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
                  — Presets
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <span
                      key={p.name}
                      className="inline-flex items-center gap-1 border-2 border-linha font-prova text-[11px] font-bold uppercase tracking-[0.06em] text-suave"
                    >
                      <button
                        type="button"
                        onClick={() => loadPreset(p)}
                        className="min-h-[36px] px-2 transition-colors hover:text-rua"
                      >
                        {p.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePreset(p.name)}
                        className="min-h-[36px] pr-1.5 text-fio hover:text-baixa"
                        aria-label={L(`Apagar preset ${p.name}`, `Delete preset ${p.name}`)}
                      >
                        <X className="w-3 h-3" strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                  {presets.length < MAX_PRESETS && (
                    <button
                      type="button"
                      onClick={saveAsPreset}
                      disabled={!complete}
                      className="inline-flex min-h-[36px] items-center gap-1 border-2 border-dashed border-fio px-2 font-prova text-[11px] font-bold uppercase tracking-[0.06em] text-mudo transition-colors hover:border-papel hover:text-papel disabled:opacity-40"
                    >
                      <Plus className="w-3 h-3" strokeWidth={3} aria-hidden /> {L('Salvar atual', 'Save current')}
                    </button>
                  )}
                </div>
              </div>

              {/* Formação */}
              <div>
                <p className="mb-2 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
                  — {L('Formação', 'Formation')}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {FORMATION_SCHEME_LIST.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => changeFormation(f)}
                      aria-pressed={formation === f}
                      className={`min-h-[42px] font-impact text-[14px] tabular-nums leading-none transition-colors ${
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

              {/* Lista de titulares */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
                    — {L('Titulares', 'Starters')} ({filled}/{slots.length})
                  </p>
                  {tiredCount > 0 && (
                    <span className="inline-flex items-center gap-1 font-prova text-[11px] font-bold" style={{ color: fatigueTone(99) }}>
                      <AlertTriangle className="w-3 h-3" strokeWidth={2.5} /> {tiredCount} {L(`cansado${tiredCount > 1 ? 's' : ''}`, 'tired')}
                    </span>
                  )}
                </div>
                {needsManaging && (
                  <button
                    type="button"
                    onClick={autoManageSquad}
                    className="mb-3 flex min-h-[48px] w-full items-center justify-center gap-2 border-2 border-rua px-3 font-impact text-[16px] uppercase leading-none text-rua transition-colors hover:bg-rua hover:text-asfalto-27"
                  >
                    <Wand2 className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> {L('Gerir elenco · IA troca os cansados', 'Manage squad · AI swaps the tired')}
                  </button>
                )}
                <div className="space-y-1.5">
                  {slots.map((slot) => {
                    const pid = working[slot.id];
                    const p = pid ? players[pid] : undefined;
                    const f = fatigueOf(pid);
                    const tired = f >= FATIGUE_EXHAUSTED_THRESHOLD;
                    const outLabel = pid ? unavailableLabel(pid) : null;
                    const after = forecastFatigue(f);
                    const willCross = pid && !tired && after >= FATIGUE_EXHAUSTED_THRESHOLD;
                    return (
                      <div
                        key={slot.id}
                        className="flex min-h-[56px] min-w-0 items-center gap-3 border-l-[3px] bg-concreto px-3 py-2"
                        style={{ borderLeftColor: outLabel ? 'var(--color-baixa)' : fatigueTone(f) }}
                      >
                        <span className="w-9 shrink-0 text-center font-prova text-[10.5px] font-bold uppercase tracking-[0.06em] text-mudo">
                          {posLabel(slot.label)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="flex min-w-0 items-center gap-1.5 truncate font-voz text-[19px] leading-none text-papel">
                            {p?.name ?? L('— vazio —', '— empty —')}
                            {(tired || outLabel) && (
                              <AlertTriangle className="h-3 w-3 shrink-0 text-baixa" strokeWidth={2.5} />
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="h-1.5 max-w-[120px] flex-1 overflow-hidden bg-linha">
                              <div className="h-full" style={{ width: `${Math.min(100, f)}%`, backgroundColor: fatigueTone(f) }} />
                            </div>
                            <span className="font-prova text-[10.5px] font-bold tabular-nums" style={{ color: outLabel ? 'var(--color-baixa)' : fatigueTone(f) }}>
                              {outLabel ?? `${f}%`}
                            </span>
                            {!outLabel && pid && (
                              <span
                                className="font-prova text-[10px] tabular-nums"
                                style={{ color: willCross ? 'var(--color-atencao)' : 'var(--color-fio)' }}
                                title={L('Previsão de fadiga após este jogo (estimativa)', 'Fatigue forecast after this match (estimate)')}
                              >
                                → ~{after}%
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPicking(slot.id)}
                          className="inline-flex min-h-[38px] shrink-0 items-center gap-1 border-2 border-papel px-2.5 font-impact text-[14px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
                        >
                          <ArrowRightLeft className="w-3 h-3" strokeWidth={2.5} aria-hidden /> {L('Trocar', 'Swap')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Confirmar / Salvar */}
        {!pickingSlot && (
          <div className="shrink-0 space-y-3 border-t border-linha p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={confirm}
              disabled={!complete || busy}
              className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 bg-rua px-4 font-impact text-[20px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow,opacity] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)] disabled:opacity-50 disabled:shadow-none"
            >
              {busy ? L('Preparando…', 'Preparing…') : L(`Entrar em campo vs ${opponentShort} →`, `Take the field vs ${opponentShort} →`)}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!complete || busy}
              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 border-2 border-linha font-impact text-[16px] uppercase leading-none text-suave transition-colors hover:border-papel hover:text-papel disabled:opacity-40"
            >
              {savedFlash ? (
                <><Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden /> {L('Elenco salvo', 'Squad saved')}</>
              ) : (
                <><Star className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> {L('Salvar elenco', 'Save squad')}</>
              )}
            </button>
            {!complete && (
              <p className="text-center font-prova text-[11px] font-bold text-baixa">
                {L(`Faltam titulares — preencha os ${slots.length} para entrar.`, `Starters missing — fill all ${slots.length} to play.`)}
              </p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
