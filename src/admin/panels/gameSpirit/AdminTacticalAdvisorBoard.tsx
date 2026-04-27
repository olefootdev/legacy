/**
 * Campo visual alinhado à Partida Ao Vivo (field2d + perspetiva), com marcadores persistentes
 * para conselhos ao motor — coordenadas 0–1 e etiquetas `logicTag` no JSON do Game Spirit.
 */
import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'motion/react';
import { Crosshair, Map, MousePointer2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TacticalPitchDevLayer } from '@/components/matchday/TacticalPitchDevLayer';
import { uiPercentToWorld } from '@/simulation/field';
import { worldPositionToTactical18ShortLabel } from '@/match/tacticalField18';
import type { MatchHalf, TeamSide } from '@/match/fieldZones';
import {
  newId,
  nowIso,
  PITCH_ADVISOR_LOGIC_TAGS,
  type GameSpiritKnowledgeRoot,
  type PitchAdvisorLogicTag,
  type PitchAdvisorMarker,
} from '@/gamespirit/admin/gameSpiritKnowledgeStore';
import '@/styles/field2d.css';

function tactical18ForPoint(
  x01: number,
  y01: number,
  team: TeamSide,
  half: MatchHalf,
): string {
  const { x, z } = uiPercentToWorld(x01 * 100, y01 * 100);
  return worldPositionToTactical18ShortLabel(x, z, team, half);
}

function tagAccent(tag: PitchAdvisorLogicTag): string {
  switch (tag) {
    case 'press_trigger':
      return 'bg-rose-500 border-rose-200 text-white';
    case 'support_lane':
      return 'bg-cyan-600 border-cyan-200 text-white';
    case 'danger_zone':
      return 'bg-amber-600 border-amber-100 text-black';
    case 'build_up':
      return 'bg-emerald-700 border-emerald-200 text-white';
    case 'transition':
      return 'bg-violet-600 border-violet-200 text-white';
    case 'counter':
      return 'bg-orange-600 border-orange-100 text-white';
    case 'final_third':
      return 'bg-lime-600 border-lime-100 text-black';
    default:
      return 'bg-zinc-700 border-white/50 text-white';
  }
}

type Tool = 'select' | 'add';

const DRAG_THRESHOLD_PX = 5;

export function AdminTacticalAdvisorBoard({
  kb,
  onChange,
}: {
  kb: GameSpiritKnowledgeRoot;
  onChange: (next: GameSpiritKnowledgeRoot) => void;
}) {
  const markers = kb.pitchAdvisorMarkers ?? [];
  const kbRef = useRef(kb);
  kbRef.current = kb;
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const markerDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const [tacticalDevLayer, setTacticalDevLayer] = useState(true);
  const [zoneView18, setZoneView18] = useState(false);
  const [zoneTeam, setZoneTeam] = useState<TeamSide>('home');
  const [zoneHalf, setZoneHalf] = useState<MatchHalf>(1);
  const [tool, setTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = markers.find((m) => m.id === selectedId) ?? null;

  const clientTo01 = useCallback((clientX: number, clientY: number) => {
    const el = fieldRef.current;
    if (!el) return { x01: 0.5, y01: 0.5 };
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return { x01: 0.5, y01: 0.5 };
    const x01 = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const y01 = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    return { x01, y01 };
  }, []);

  const upsertMarkers = useCallback(
    (nextMarkers: PitchAdvisorMarker[]) => {
      onChange({ ...kbRef.current, pitchAdvisorMarkers: nextMarkers });
    },
    [onChange],
  );

  const onFieldPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const { x01, y01 } = clientTo01(e.clientX, e.clientY);
    const cur = kbRef.current.pitchAdvisorMarkers ?? [];
    if (tool === 'add') {
      const m: PitchAdvisorMarker = {
        id: newId('adv'),
        x01,
        y01,
        title: 'Nova marcação',
        notes: '',
        logicTag: 'hint_generic',
        updatedAt: nowIso(),
      };
      upsertMarkers([...cur, m]);
      setSelectedId(m.id);
      setTool('select');
      return;
    }
    setSelectedId(null);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const cur = kbRef.current.pitchAdvisorMarkers ?? [];
    upsertMarkers(cur.filter((m) => m.id !== selectedId));
    setSelectedId(null);
  };

  const updateSelected = (patch: Partial<PitchAdvisorMarker>) => {
    if (!selectedId) return;
    const cur = kbRef.current.pitchAdvisorMarkers ?? [];
    upsertMarkers(
      cur.map((m) =>
        m.id === selectedId ? { ...m, ...patch, updatedAt: nowIso() } : m,
      ),
    );
  };

  const zLabelHome1 = useMemo(
    () => (selected ? tactical18ForPoint(selected.x01, selected.y01, 'home', 1) : ''),
    [selected],
  );
  const zLabelPerspective = useMemo(
    () => (selected ? tactical18ForPoint(selected.x01, selected.y01, zoneTeam, zoneHalf) : ''),
    [selected, zoneTeam, zoneHalf],
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-white/60">
        Mesmo desenho e escala que a <strong className="text-white/85">Partida Ao Vivo</strong> (105×68 m, casa ataca para a
        direita). Activa o mapa tático para ver terços e a grelha de 18 zonas alinhada ao motor. Coloca{' '}
        <strong className="text-neon-yellow/90">marcadores</strong> com tipo lógico e notas — ficam no{' '}
        <code className="text-white/45">export JSON</code> em <code className="text-white/45">pitchAdvisorMarkers</code> para
        integrares depois no cérebro do jogo.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={tool === 'select'}
          onClick={() => setTool('select')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider',
            tool === 'select'
              ? 'border-neon-yellow/60 bg-neon-yellow/15 text-neon-yellow'
              : 'border-white/15 text-white/45 hover:border-white/25 hover:text-white/75',
          )}
        >
          <MousePointer2 className="h-3.5 w-3.5" />
          Selecionar
        </button>
        <button
          type="button"
          aria-pressed={tool === 'add'}
          onClick={() => setTool('add')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider',
            tool === 'add'
              ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
              : 'border-white/15 text-white/45 hover:border-white/25 hover:text-white/75',
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar ponto
        </button>
        {tool === 'add' ? (
          <span className="text-[10px] text-emerald-300/90">
            <Crosshair className="mr-1 inline h-3 w-3" />
            Clica no gramado para largar o marcador
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={tacticalDevLayer}
          onClick={() => {
            setTacticalDevLayer((v) => !v);
            if (tacticalDevLayer) setZoneView18(false);
          }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider',
            tacticalDevLayer
              ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100'
              : 'border-white/15 text-white/45 hover:border-white/25 hover:text-white/75',
          )}
        >
          <Map className="h-3.5 w-3.5" />
          Campo tático
        </button>
        {tacticalDevLayer ? (
          <button
            type="button"
            aria-pressed={zoneView18}
            onClick={() => setZoneView18((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider',
              zoneView18
                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                : 'border-white/15 text-white/45 hover:border-white/25 hover:text-white/75',
            )}
          >
            Zone View (18)
          </button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(320px,100%)]">
        <div>
          <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-widest text-white/40">Campo (referência ao vivo)</p>
          <div className="mx-auto w-full max-w-3xl py-1 [perspective:min(1400px,110vw)]">
            <motion.div
              className="origin-[50%_100%] transform-gpu will-change-transform"
              style={{ transformStyle: 'preserve-3d' }}
              initial={{ rotateX: 0 }}
              animate={{ rotateX: 5.5 }}
              transition={{ type: 'spring', stiffness: 70, damping: 18 }}
            >
              <div
                className={cn(
                  'relative rounded-xl overflow-visible',
                  'shadow-[0_28px_90px_-16px_rgba(0,0,0,0.92),0_0_72px_-20px_rgba(89,133,37,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]',
                  'ring-1 ring-white/15',
                )}
              >
                <div className="field-container w-full overflow-visible rounded-lg p-2 sm:p-3">
                  <div
                    ref={fieldRef}
                    role="application"
                    aria-label="Campo tático para anotações"
                    className={cn('field relative', tacticalDevLayer && 'show-zones')}
                    onPointerDown={onFieldPointerDown}
                  >
                    <div className="pitch-overlay">
                      <div className="half-line" />
                      <div className="center-circle" />
                      <div className="center-dot" />
                      <div className="penalty-area left" />
                      <div className="penalty-area right" />
                      <div className="goal-area left" />
                      <div className="goal-area right" />
                      <div className="penalty-arc left" />
                      <div className="penalty-arc right" />
                      <div className="penalty-spot left" />
                      <div className="penalty-spot right" />
                      <div className="corner top-left" />
                      <div className="corner top-right" />
                      <div className="corner bottom-left" />
                      <div className="corner bottom-right" />
                      <div className="goal left">
                        <div className="goal-net" />
                      </div>
                      <div className="goal right">
                        <div className="goal-net" />
                      </div>
                      <div
                        className="pointer-events-none absolute left-[1.2%] top-1/2 z-[9] -translate-y-1/2 select-none"
                        aria-hidden
                      >
                        <span className="block max-w-[4.5rem] font-display text-[clamp(6px,1.1vw,8px)] font-black uppercase leading-tight tracking-wider text-neon-yellow/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                          Gol casa
                        </span>
                      </div>
                      <div
                        className="pointer-events-none absolute right-[1.2%] top-1/2 z-[9] -translate-y-1/2 select-none text-right"
                        aria-hidden
                      >
                        <span className="block max-w-[4.5rem] font-display text-[clamp(6px,1.1vw,8px)] font-black uppercase leading-tight tracking-wider text-rose-300/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                          Gol visitante
                        </span>
                      </div>
                      <div className="zone-attack-left" aria-hidden />
                      <div className="zone-attack-right" aria-hidden />
                      <div className="zone-defense-left" aria-hidden />
                      <div className="zone-defense-right" aria-hidden />
                      <div className="zone-midfield" aria-hidden />
                      <div className="zone-box-left" aria-hidden />
                      <div className="zone-box-right" aria-hidden />
                    </div>
                    {tacticalDevLayer ? (
                      <TacticalPitchDevLayer
                        homeShort="Casa"
                        awayShort="Visit"
                        homePlayers={[]}
                        awayPlayers={[]}
                        clockPeriod={zoneHalf === 2 ? 'second_half' : 'first_half'}
                        possession={zoneTeam}
                        showZoneView={zoneView18}
                        zonePerspectiveTeam={zoneTeam}
                      />
                    ) : null}

                    <div className="pointer-events-none absolute inset-0 z-[12]">
                      {markers.map((m) => {
                        const leftPct = m.x01 * 100;
                        const topPct = m.y01 * 100;
                        const sel = m.id === selectedId;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                            className={cn(
                              'pointer-events-auto absolute z-[13] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-md transition-transform',
                              tagAccent(m.logicTag),
                              sel ? 'ring-2 ring-white scale-125' : 'hover:scale-110',
                            )}
                            title={m.title}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setSelectedId(m.id);
                              markerDragRef.current = {
                                id: m.id,
                                startX: e.clientX,
                                startY: e.clientY,
                                dragging: false,
                              };
                              (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                            }}
                            onPointerMove={(e) => {
                              const d = markerDragRef.current;
                              if (!d || d.id !== m.id) return;
                              if (!(e.currentTarget as HTMLButtonElement).hasPointerCapture(e.pointerId)) return;
                              const dx = e.clientX - d.startX;
                              const dy = e.clientY - d.startY;
                              if (!d.dragging && dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
                                d.dragging = true;
                              }
                              if (!d.dragging) return;
                              e.stopPropagation();
                              const { x01, y01 } = clientTo01(e.clientX, e.clientY);
                              upsertMarkers(
                                (kbRef.current.pitchAdvisorMarkers ?? []).map((mm) =>
                                  mm.id === m.id ? { ...mm, x01, y01, updatedAt: nowIso() } : mm,
                                ),
                              );
                            }}
                            onPointerUp={(e) => {
                              markerDragRef.current = null;
                              try {
                                (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
                              } catch {
                                /* */
                              }
                            }}
                            onPointerCancel={(e) => {
                              markerDragRef.current = null;
                              try {
                                (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
                              } catch {
                                /* */
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
          <p className="mt-2 text-center font-mono text-[10px] text-white/35">
            {markers.length} marcação(ões) · coords 0–1 (x comprimento, y largura)
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-bold uppercase text-white/40">Zona 18 (motor)</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-bold uppercase text-white/40">
              Perspectiva
              <select
                value={zoneTeam}
                onChange={(e) => setZoneTeam(e.target.value as TeamSide)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
              >
                <option value="home">Casa</option>
                <option value="away">Visitante</option>
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-white/40">
              Tempo
              <select
                value={zoneHalf}
                onChange={(e) => setZoneHalf(Number(e.target.value) as MatchHalf)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
              >
                <option value={1}>1.º tempo</option>
                <option value={2}>2.º tempo</option>
              </select>
            </label>
          </div>
          {selected ? (
            <>
              <p className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 font-mono text-xs text-neon-yellow/90">
                Casa 1.º: <span className="text-white">{zLabelHome1}</span>
                <span className="mx-1 text-white/25">·</span>
                Vista {zoneTeam === 'home' ? 'Casa' : 'Visit'} / {zoneHalf === 1 ? '1.º' : '2.º'}:{' '}
                <span className="text-cyan-200">{zLabelPerspective}</span>
              </p>
              <label className="block text-[10px] font-bold uppercase text-white/40">
                Título
                <input
                  value={selected.title}
                  onChange={(e) => updateSelected({ title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-[10px] font-bold uppercase text-white/40">
                Tipo (lógica futura)
                <select
                  value={selected.logicTag}
                  onChange={(e) => updateSelected({ logicTag: e.target.value as PitchAdvisorLogicTag })}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                >
                  {PITCH_ADVISOR_LOGIC_TAGS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] font-bold uppercase text-white/40">
                Notas / conselho ao motor
                <textarea
                  value={selected.notes}
                  onChange={(e) => updateSelected({ notes: e.target.value })}
                  rows={6}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white placeholder:text-white/25"
                  placeholder="Ex.: quando a posse recupera aqui, empurrar linha para o corredor interior…"
                />
              </label>
              <p className="font-mono text-[10px] text-white/35">
                x01={selected.x01.toFixed(3)} y01={selected.y01.toFixed(3)}
              </p>
              <button
                type="button"
                onClick={deleteSelected}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 py-2 text-[10px] font-bold uppercase text-rose-300 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover marcador
              </button>
            </>
          ) : (
            <p className="text-sm text-white/40">Selecciona um ponto no campo ou adiciona um novo.</p>
          )}
        </div>
      </div>
    </div>
  );
}
