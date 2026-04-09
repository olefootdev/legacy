import { useState } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GameSpiritKnowledgeRoot, PitchZoneTag, PositionTeaching } from '@/gamespirit/admin/gameSpiritKnowledgeStore';
import { newId, nowIso } from '@/gamespirit/admin/gameSpiritKnowledgeStore';

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

function MiniPitch({
  x01,
  y01,
  onPick,
}: {
  x01: number;
  y01: number;
  onPick: (x: number, y: number) => void;
}) {
  return (
    <div
      className="mx-auto w-full max-w-3xl overflow-hidden rounded-lg border border-white/20 bg-emerald-950/40 shadow-inner"
      style={{ aspectRatio: `${PITCH_LEN_M} / ${PITCH_WID_M}` }}
    >
      <svg
        viewBox={`0 0 ${PITCH_LEN_M} ${PITCH_WID_M}`}
        className="block h-full w-full cursor-crosshair"
        preserveAspectRatio="xMidYMid meet"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          onPick(Math.min(1, Math.max(0, px)), Math.min(1, Math.max(0, py)));
        }}
      >
        <PitchMarkings />
        <circle cx={x01 * PITCH_LEN_M} cy={y01 * PITCH_WID_M} r="3.2" fill="#f5e942" stroke="#000" strokeWidth="0.55" />
      </svg>
    </div>
  );
}

function PitchThumb({ x01, y01 }: { x01: number; y01: number }) {
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
        <circle cx={x01 * PITCH_LEN_M} cy={y01 * PITCH_WID_M} r="2.8" fill="#f5e942" stroke="#000" strokeWidth="0.45" />
      </svg>
    </div>
  );
}

export function PositionsSection({
  kb,
  onChange,
}: {
  kb: GameSpiritKnowledgeRoot;
  onChange: (next: GameSpiritKnowledgeRoot) => void;
}) {
  const [code, setCode] = useState('MC');
  const [label, setLabel] = useState('');
  const [zone, setZone] = useState<PitchZoneTag>('mid');
  const [x01, setX01] = useState(0.5);
  const [y01, setY01] = useState(0.5);
  const [activitiesText, setActivitiesText] = useState('');
  const [coachingNotes, setCoachingNotes] = useState('');

  const add = () => {
    if (!label.trim()) return;
    const mainActivities = activitiesText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const pt: PositionTeaching = {
      id: newId('pos'),
      code: code.trim().toUpperCase() || '—',
      label: label.trim(),
      zone,
      x01,
      y01,
      mainActivities,
      coachingNotes: coachingNotes.trim(),
      updatedAt: nowIso(),
    };
    onChange({ ...kb, positionTeachings: [...kb.positionTeachings, pt] });
    setLabel('');
    setActivitiesText('');
    setCoachingNotes('');
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-white/60">
        Campo em escala real <strong className="text-white/85">105×68 m</strong> (comprimento horizontal = sentido de ataque no jogo). Clica para
        marcar (0–1 em cada eixo → convertido para a mesma grelha % que o motor usa).
      </p>
      <p className="text-sm text-white/60">
        O <strong className="text-neon-yellow/90">código</strong> deve coincidir com a posição do jogador no plantel (
        <code className="text-white/50">GOL</code>, <code className="text-white/50">ZAG</code>, <code className="text-white/50">MC</code>,{' '}
        <code className="text-white/50">PE</code>, <code className="text-white/50">ATA</code>…). Ao guardar, fica em{' '}
        <code className="text-white/45">localStorage</code>; ao <strong className="text-white/85">iniciar uma partida</strong>, o jogo posiciona
        cada titular com override se o <code className="text-white/50">pos</code> bater com o código. Vários com o mesmo código usam o mesmo ponto
        (o micro-ajuste de dispersão do motor mantém-se).
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase text-white/40">Atuação no campo (clique para marcar)</p>
          <MiniPitch x01={x01} y01={y01} onPick={(x, y) => { setX01(x); setY01(y); }} />
          <p className="mt-1 font-mono text-[10px] text-white/35">
            x01={x01.toFixed(3)} y01={y01.toFixed(3)} · {PITCH_LEN_M}×{PITCH_WID_M} m · ~{(x01 * PITCH_LEN_M).toFixed(1)} m, ~{(y01 * PITCH_WID_M).toFixed(1)} m
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-neon-yellow/90">
            <Plus className="h-4 w-4" />
            Nova posição
          </h3>
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
            onClick={add}
            className={cn(
              'mt-3 rounded-lg px-4 py-2 text-xs font-black uppercase',
              label.trim()
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'cursor-not-allowed bg-white/10 text-white/35',
            )}
          >
            Guardar posição
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
                    {p.zone} · ({p.x01.toFixed(2)}, {p.y01.toFixed(2)})
                  </p>
                </div>
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
              <div className="mt-2">
                <PitchThumb x01={p.x01} y01={p.y01} />
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
