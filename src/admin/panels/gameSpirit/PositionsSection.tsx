import { useCallback, useRef, useState, type PointerEvent, type ReactElement } from 'react';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GameSpiritKnowledgeRoot, PitchZoneTag, PositionTeaching } from '@/gamespirit/admin/gameSpiritKnowledgeStore';
import { emptyBlockNotes, newId, normalizeBlockNotes, nowIso } from '@/gamespirit/admin/gameSpiritKnowledgeStore';

const ZONES: { id: PitchZoneTag; label: string }[] = [
  { id: 'gk', label: 'Guarda-redes' },
  { id: 'def', label: 'Defesa' },
  { id: 'mid', label: 'Meio' },
  { id: 'att', label: 'Ataque' },
  { id: 'wide', label: 'Largura / corredor' },
];

/** Dimensões IFAB (comprimento × largura em metros) — mesma escala que o clique 0–1 → motor % campo. */
const PITCH_LEN_M = 105;
const PITCH_WID_M = 68;
const HALF_L = PITCH_LEN_M / 2;
const HALF_W = PITCH_WID_M / 2;
const PC_RADIUS = 9.15;
const PA_DEPTH = 16.5;
const PA_WIDTH = 40.32;
const GA_DEPTH = 5.5;
const GA_WIDTH = 18.32;
const PA_Y = (PITCH_WID_M - PA_WIDTH) / 2;
const GA_Y = (PITCH_WID_M - GA_WIDTH) / 2;

const GRID_COLS = 4;
const GRID_ROWS = 4;
const CELL_W = PITCH_LEN_M / GRID_COLS;
const CELL_H = PITCH_WID_M / GRID_ROWS;
const MARKER_HIT_01 = 0.09;
const DRAG_THRESHOLD_PX = 8;

function blockIndexFrom01(x01: number, y01: number): number {
  const col = Math.min(GRID_COLS - 1, Math.max(0, Math.floor(x01 * GRID_COLS)));
  const row = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(y01 * GRID_ROWS)));
  return row * GRID_COLS + col;
}

function PitchMarkings() {
  return (
    <>
      <rect
        x="0.5"
        y="0.5"
        width={PITCH_LEN_M - 1}
        height={PITCH_WID_M - 1}
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.7"
      />
      <line
        x1={HALF_L}
        y1="0.5"
        x2={HALF_L}
        y2={PITCH_WID_M - 0.5}
        stroke="rgba(255,255,255,0.24)"
        strokeWidth="0.65"
      />
      <circle
        cx={HALF_L}
        cy={HALF_W}
        r={PC_RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.6"
      />
      <circle cx={HALF_L} cy={HALF_W} r="0.4" fill="rgba(255,255,255,0.35)" />
      <rect
        x="0.5"
        y={PA_Y}
        width={PA_DEPTH}
        height={PA_WIDTH}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.55"
      />
      <rect
        x={PITCH_LEN_M - PA_DEPTH - 0.5}
        y={PA_Y}
        width={PA_DEPTH}
        height={PA_WIDTH}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.55"
      />
      <rect
        x="0.5"
        y={GA_Y}
        width={GA_DEPTH}
        height={GA_WIDTH}
        fill="none"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="0.45"
      />
      <rect
        x={PITCH_LEN_M - GA_DEPTH - 0.5}
        y={GA_Y}
        width={GA_DEPTH}
        height={GA_WIDTH}
        fill="none"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="0.45"
      />
    </>
  );
}

function PitchGridOverlay({
  selectedBlock,
  blockNotes,
}: {
  selectedBlock: number | null;
  blockNotes: string[];
}) {
  const cells: ReactElement[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const i = row * GRID_COLS + col;
      const hasNote = Boolean(blockNotes[i]?.trim());
      const sel = selectedBlock === i;
      cells.push(
        <g key={i}>
          <rect
            x={col * CELL_W + 0.2}
            y={row * CELL_H + 0.2}
            width={CELL_W - 0.4}
            height={CELL_H - 0.4}
            fill={hasNote ? 'rgba(251,191,36,0.07)' : 'rgba(255,255,255,0.02)'}
            stroke={sel ? 'rgba(251,191,36,0.85)' : 'rgba(255,255,255,0.14)'}
            strokeWidth={sel ? 0.75 : 0.35}
            pointerEvents="none"
          />
          <text
            x={col * CELL_W + CELL_W * 0.5}
            y={row * CELL_H + CELL_H * 0.52}
            textAnchor="middle"
            fill="rgba(255,255,255,0.22)"
            fontSize="2.6"
            fontWeight="700"
            pointerEvents="none"
          >
            {i + 1}
          </text>
        </g>,
      );
    }
  }
  return <>{cells}</>;
}

function InteractivePitch({
  x01,
  y01,
  onXYChange,
  selectedBlock,
  onSelectBlock,
  blockNotes,
}: {
  x01: number;
  y01: number;
  onXYChange: (x: number, y: number) => void;
  selectedBlock: number | null;
  onSelectBlock: (index: number) => void;
  blockNotes: string[];
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gesture = useRef<{
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    field0: { x01: number; y01: number };
    hitMarker: boolean;
    dragging: boolean;
  }>({
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    field0: { x01: 0, y01: 0 },
    hitMarker: false,
    dragging: false,
  });

  const fieldFromClient = useCallback((clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return { x01: 0.5, y01: 0.5 };
    const pt = el.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = el.getScreenCTM();
    if (!ctm) return { x01: 0.5, y01: 0.5 };
    const p = pt.matrixTransform(ctm.inverse());
    return {
      x01: Math.min(1, Math.max(0, p.x / PITCH_LEN_M)),
      y01: Math.min(1, Math.max(0, p.y / PITCH_WID_M)),
    };
  }, []);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const f = fieldFromClient(e.clientX, e.clientY);
    const hitMarker = Math.hypot(f.x01 - x01, f.y01 - y01) < MARKER_HIT_01;
    gesture.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      field0: f,
      hitMarker,
      dragging: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.startClientX;
    const dy = e.clientY - g.startClientY;
    if (!g.dragging && dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      g.dragging = true;
    }
    if (g.dragging) {
      const f = fieldFromClient(e.clientX, e.clientY);
      onXYChange(f.x01, f.y01);
    }
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (g.pointerId !== e.pointerId) return;
    try {
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (!g.dragging && !g.hitMarker) {
      onSelectBlock(blockIndexFrom01(g.field0.x01, g.field0.y01));
    }
    g.pointerId = null;
    g.dragging = false;
  };

  const onPointerCancel = (e: PointerEvent<SVGSVGElement>) => {
    gesture.current.pointerId = null;
    gesture.current.dragging = false;
    try {
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
  };

  return (
    <div
      className="mx-auto w-full max-w-3xl overflow-hidden rounded-lg border border-white/20 bg-emerald-950/40 shadow-inner"
      style={{ aspectRatio: `${PITCH_LEN_M} / ${PITCH_WID_M}` }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${PITCH_LEN_M} ${PITCH_WID_M}`}
        className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <PitchMarkings />
        <PitchGridOverlay selectedBlock={selectedBlock} blockNotes={blockNotes} />
        <circle
          cx={x01 * PITCH_LEN_M}
          cy={y01 * PITCH_WID_M}
          r="4.2"
          fill="rgba(245,233,66,0.12)"
          stroke="none"
          pointerEvents="none"
        />
        <circle
          cx={x01 * PITCH_LEN_M}
          cy={y01 * PITCH_WID_M}
          r="3.2"
          fill="#f5e942"
          stroke="#000"
          strokeWidth="0.55"
          pointerEvents="none"
        />
      </svg>
    </div>
  );
}

function PitchThumb({ x01, y01, blockNotes }: { x01: number; y01: number; blockNotes?: string[] }) {
  const bn = normalizeBlockNotes(blockNotes);
  return (
    <div
      className="w-full overflow-hidden rounded border border-white/10 bg-emerald-950/30"
      style={{ aspectRatio: `${PITCH_LEN_M} / ${PITCH_WID_M}` }}
    >
      <svg
        viewBox={`0 0 ${PITCH_LEN_M} ${PITCH_WID_M}`}
        className="block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <PitchMarkings />
        <PitchGridOverlay selectedBlock={null} blockNotes={bn} />
        <circle cx={x01 * PITCH_LEN_M} cy={y01 * PITCH_WID_M} r="2.8" fill="#f5e942" stroke="#000" strokeWidth="0.45" />
      </svg>
    </div>
  );
}

function countBlockNotesFilled(notes: string[]): number {
  return notes.reduce((n, s) => n + (s.trim() ? 1 : 0), 0);
}

export function PositionsSection({
  kb,
  onChange,
}: {
  kb: GameSpiritKnowledgeRoot;
  onChange: (next: GameSpiritKnowledgeRoot) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState('MC');
  const [label, setLabel] = useState('');
  const [zone, setZone] = useState<PitchZoneTag>('mid');
  const [x01, setX01] = useState(0.5);
  const [y01, setY01] = useState(0.5);
  const [blockNotes, setBlockNotes] = useState<string[]>(() => emptyBlockNotes());
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [activitiesText, setActivitiesText] = useState('');
  const [coachingNotes, setCoachingNotes] = useState('');

  const loadIntoForm = (p: PositionTeaching) => {
    setEditingId(p.id);
    setCode(p.code);
    setLabel(p.label);
    setZone(p.zone);
    setX01(p.x01);
    setY01(p.y01);
    setBlockNotes(normalizeBlockNotes(p.blockNotes));
    setSelectedBlock(null);
    setActivitiesText(p.mainActivities.join('\n'));
    setCoachingNotes(p.coachingNotes);
  };

  const clearForm = () => {
    setEditingId(null);
    setCode('MC');
    setLabel('');
    setZone('mid');
    setActivitiesText('');
    setCoachingNotes('');
    setBlockNotes(emptyBlockNotes());
    setSelectedBlock(null);
    setX01(0.5);
    setY01(0.5);
  };

  const saveOrUpdate = () => {
    if (!label.trim()) return;
    const mainActivities = activitiesText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const pt: PositionTeaching = {
      id: editingId ?? newId('pos'),
      code: code.trim().toUpperCase() || '—',
      label: label.trim(),
      zone,
      x01,
      y01,
      blockNotes: normalizeBlockNotes(blockNotes),
      mainActivities,
      coachingNotes: coachingNotes.trim(),
      updatedAt: nowIso(),
    };
    if (editingId) {
      onChange({
        ...kb,
        positionTeachings: kb.positionTeachings.map((x) => (x.id === editingId ? pt : x)),
      });
    } else {
      onChange({ ...kb, positionTeachings: [...kb.positionTeachings, pt] });
    }
    clearForm();
  };

  const selectedBlockNote = selectedBlock !== null ? blockNotes[selectedBlock] ?? '' : '';

  return (
    <div className="space-y-6">
      <p className="text-sm text-white/60">
        Campo em escala real <strong className="text-white/85">105×68 m</strong> (comprimento horizontal = sentido de ataque).{' '}
        <strong className="text-neon-yellow/90">Arrasta</strong> o marcador para gravar a posição;{' '}
        <strong className="text-white/85">clique</strong> (sem arrastar) num bloco numerado para definir o que esta posição faz nessa zona.
      </p>
      <p className="text-sm text-white/60">
        Grelha <strong className="text-white/85">4×4 = 16 blocos</strong> (1 = canto superior-esquerdo, 16 = inferior-direito, linha = largura do
        campo). O <strong className="text-neon-yellow/90">código</strong> deve coincidir com a posição do jogador no plantel (
        <code className="text-white/50">GOL</code>, <code className="text-white/50">ZAG</code>, <code className="text-white/50">MC</code>…). Dados
        em <code className="text-white/45">localStorage</code>; ao iniciar partida, <code className="text-white/50">x01/y01</code> posicionam o
        titular. As notas por bloco ficam guardadas para futura ligação ao motor / GameSpirit.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase text-white/40">Campo — arrastar + blocos</p>
          <InteractivePitch
            x01={x01}
            y01={y01}
            onXYChange={(x, y) => {
              setX01(x);
              setY01(y);
            }}
            selectedBlock={selectedBlock}
            onSelectBlock={(i) => setSelectedBlock(i)}
            blockNotes={blockNotes}
          />
          <p className="mt-1 font-mono text-[10px] text-white/35">
            x01={x01.toFixed(3)} y01={y01.toFixed(3)} · {PITCH_LEN_M}×{PITCH_WID_M} m · ~{(x01 * PITCH_LEN_M).toFixed(1)} m, ~{(y01 * PITCH_WID_M).toFixed(1)} m
          </p>
          <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
            <p className="text-[10px] font-bold uppercase text-white/40">
              {selectedBlock === null ? 'Nenhum bloco selecionado' : `Bloco ${selectedBlock + 1} — comportamento nesta zona`}
            </p>
            <textarea
              value={selectedBlock === null ? '' : selectedBlockNote}
              onChange={(e) => {
                if (selectedBlock === null) return;
                const v = e.target.value;
                setBlockNotes((prev) => {
                  const next = [...prev];
                  next[selectedBlock] = v;
                  return next;
                });
              }}
              disabled={selectedBlock === null}
              rows={4}
              placeholder={
                selectedBlock === null
                  ? 'Clica num bloco no campo (1–16) para escrever o que esta posição faz quando o jogo “passa” por essa zona…'
                  : 'Ex.: fecha corredor, pede bola ao pé, prolonga na profundidade, cobre o segundo poste…'
              }
              className="mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white placeholder:text-white/25 disabled:opacity-40"
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-neon-yellow/90">
              <Plus className="h-4 w-4" />
              {editingId ? 'Editar posição' : 'Nova posição'}
            </h3>
            {editingId ? (
              <button
                type="button"
                onClick={clearForm}
                className="rounded-lg border border-white/15 px-2 py-1 text-[10px] font-bold uppercase text-white/50 hover:bg-white/5 hover:text-white/80"
              >
                Cancelar edição
              </button>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-[10px] font-bold uppercase text-white/40">
              Código (= POS do jogador)
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="MC, GOL, PE…"
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white placeholder:text-white/25"
              />
            </label>
            <label className="text-[10px] font-bold uppercase text-white/40">
              Zona
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value as PitchZoneTag)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
              >
                {ZONES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 block text-[10px] font-bold uppercase text-white/40">
            Nome / rótulo
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
            />
          </label>
          <label className="mt-3 block text-[10px] font-bold uppercase text-white/40">
            Principais atividades (uma por linha)
            <textarea
              value={activitiesText}
              onChange={(e) => setActivitiesText(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
            />
          </label>
          <label className="mt-3 block text-[10px] font-bold uppercase text-white/40">
            Notas de ensino
            <textarea
              value={coachingNotes}
              onChange={(e) => setCoachingNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
            />
          </label>
          <button
            type="button"
            onClick={saveOrUpdate}
            className={cn(
              'mt-3 rounded-lg px-4 py-2 text-xs font-black uppercase',
              label.trim()
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'cursor-not-allowed bg-white/10 text-white/35',
            )}
          >
            {editingId ? 'Atualizar posição' : 'Guardar posição'}
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-white/40">
          <MapPin className="h-3.5 w-3.5" />
          Guardadas ({kb.positionTeachings.length})
        </h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {kb.positionTeachings.map((p) => (
            <li key={p.id} className="rounded-lg border border-white/10 bg-black/25 p-3">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-bold text-white">
                    {p.code} — {p.label}
                  </p>
                  <p className="text-[10px] text-white/40">
                    {p.zone} · ({p.x01.toFixed(2)}, {p.y01.toFixed(2)}) · {countBlockNotesFilled(normalizeBlockNotes(p.blockNotes))}/16 blocos com
                    nota
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => loadIntoForm(p)}
                    className="rounded-lg p-1.5 text-cyan-300 hover:bg-cyan-500/15"
                    aria-label="Editar"
                    title="Carregar para editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ ...kb, positionTeachings: kb.positionTeachings.filter((x) => x.id !== p.id) })
                    }
                    className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/15"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2">
                <PitchThumb x01={p.x01} y01={p.y01} blockNotes={p.blockNotes} />
              </div>
              {p.mainActivities.length ? (
                <ul className="mt-2 list-inside list-disc text-xs text-white/55">
                  {p.mainActivities.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              ) : null}
              {p.coachingNotes ? <p className="mt-2 text-xs text-white/45">{p.coachingNotes}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
