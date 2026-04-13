import { useState } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GameSpiritKnowledgeRoot, PitchZoneTag } from '@/gamespirit/admin/gameSpiritKnowledgeStore';
import { emptyBlockNotes, newId, nowIso } from '@/gamespirit/admin/gameSpiritKnowledgeStore';
import type { TeachKind } from '@/gamespirit/admin/gameSpiritTeachClient';
import { requestGameSpiritTeach } from '@/gamespirit/admin/gameSpiritTeachClient';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function parseNarrative(data: unknown): { title: string; bucket: string; lines: string[]; notes: string } | null {
  if (!isRecord(data)) return null;
  const title = data.title;
  const bucket = data.bucket;
  const lines = data.lines;
  const notes = data.notes;
  if (typeof title !== 'string') return null;
  const bucketStr = typeof bucket === 'string' ? bucket.trim() : 'custom';
  let ls: string[] = [];
  if (Array.isArray(lines)) {
    ls = lines.filter((l): l is string => typeof l === 'string' && l.trim().length > 0).map((l) => l.trim());
  } else if (typeof lines === 'string') {
    ls = lines
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }
  if (ls.length === 0) return null;
  return {
    title: title.trim(),
    bucket: bucketStr || 'custom',
    lines: ls,
    notes: typeof notes === 'string' ? notes.trim() : '',
  };
}

function parseTactical(data: unknown): { name: string; intentTag: string; notes: string } | null {
  if (!isRecord(data)) return null;
  const name = data.name;
  if (typeof name !== 'string' || !name.trim()) return null;
  const intentTag = typeof data.intentTag === 'string' ? data.intentTag.trim() : 'livre';
  const notes = typeof data.notes === 'string' ? data.notes.trim() : '';
  return { name: name.trim(), intentTag, notes };
}

const ZONES: PitchZoneTag[] = ['gk', 'def', 'mid', 'att', 'wide'];

function parsePosition(data: unknown): {
  code: string;
  label: string;
  zone: PitchZoneTag;
  x01: number;
  y01: number;
  mainActivities: string[];
  coachingNotes: string;
} | null {
  if (!isRecord(data)) return null;
  const code = data.code;
  const label = data.label;
  if (typeof code !== 'string' || typeof label !== 'string') return null;
  const zoneRaw = data.zone;
  const zone = typeof zoneRaw === 'string' && ZONES.includes(zoneRaw as PitchZoneTag) ? (zoneRaw as PitchZoneTag) : 'mid';
  const x01 = typeof data.x01 === 'number' && Number.isFinite(data.x01) ? Math.min(1, Math.max(0, data.x01)) : 0.5;
  const y01 = typeof data.y01 === 'number' && Number.isFinite(data.y01) ? Math.min(1, Math.max(0, data.y01)) : 0.5;
  const act = data.mainActivities;
  const mainActivities = Array.isArray(act)
    ? act.filter((a): a is string => typeof a === 'string' && a.trim().length > 0).map((a) => a.trim())
    : [];
  const coachingNotes = typeof data.coachingNotes === 'string' ? data.coachingNotes.trim() : '';
  return { code: code.trim().toUpperCase(), label: label.trim(), zone, x01, y01, mainActivities, coachingNotes };
}

export function TeachSection({
  kb,
  onChange,
}: {
  kb: GameSpiritKnowledgeRoot;
  onChange: (next: GameSpiritKnowledgeRoot) => void;
}) {
  const [kind, setKind] = useState<TeachKind>('narrative');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastData, setLastData] = useState<unknown>(null);

  const run = async () => {
    setErr(null);
    setLastData(null);
    setLoading(true);
    try {
      const ctx = JSON.stringify(
        {
          narrativeCount: kb.narrativePacks.length,
          patternCount: kb.tacticalPatterns.length,
          positionCount: kb.positionTeachings.length,
        },
        null,
        0,
      );
      const r = await requestGameSpiritTeach({ kind, userMessage: message, contextJson: ctx });
      if (r.ok === false) {
        setErr(r.error);
        return;
      }
      setLastData(r.data);
    } finally {
      setLoading(false);
    }
  };

  const applyNarrative = () => {
    const p = parseNarrative(lastData);
    if (!p) {
      setErr('Resposta não é um pacote de narração válido.');
      return;
    }
    onChange({
      ...kb,
      narrativePacks: [
        ...kb.narrativePacks,
        {
          id: newId('nar'),
          title: p.title,
          bucket: p.bucket,
          lines: p.lines,
          notes: p.notes,
          updatedAt: nowIso(),
        },
      ],
    });
    setLastData(null);
    setMessage('');
  };

  const applyTactical = () => {
    const p = parseTactical(lastData);
    if (!p) {
      setErr('Resposta não é um padrão tático válido.');
      return;
    }
    onChange({
      ...kb,
      tacticalPatterns: [
        ...kb.tacticalPatterns,
        { id: newId('pat'), name: p.name, intentTag: p.intentTag, notes: p.notes, updatedAt: nowIso() },
      ],
    });
    setLastData(null);
    setMessage('');
  };

  const applyPosition = () => {
    const p = parsePosition(lastData);
    if (!p) {
      setErr('Resposta não é uma posição válida.');
      return;
    }
    onChange({
      ...kb,
      positionTeachings: [
        ...kb.positionTeachings,
        {
          id: newId('pos'),
          code: p.code,
          label: p.label,
          zone: p.zone,
          x01: p.x01,
          y01: p.y01,
          blockNotes: emptyBlockNotes(),
          mainActivities: p.mainActivities,
          coachingNotes: p.coachingNotes,
          updatedAt: nowIso(),
        },
      ],
    });
    setLastData(null);
    setMessage('');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
        <p className="font-bold text-white">OpenAI via servidor</p>
        <p className="mt-1 text-white/80">
          Coloca <code className="rounded bg-black/30 px-1 text-neon-yellow/90">OPENAI_API_KEY</code> no{' '}
          <code className="rounded bg-black/30 px-1">server/.env</code> e corre{' '}
          <code className="rounded bg-black/30 px-1">npm run dev:server</code>. O browser fala com{' '}
          <code className="text-cyan-300/90">/api/game-spirit/teach</code> — não há chamada direta à OpenAI (CORS).
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-neon-yellow/90">
          <Bot className="h-4 w-4" />
          Ensinar com agente (estruturado)
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ['narrative', 'Narrativa'],
              ['tactical', 'Padrão tático'],
              ['position', 'Posição'],
            ] as const
          ).map(([k, lab]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase',
                kind === k ? 'bg-neon-yellow text-black' : 'bg-white/10 text-white/60 hover:bg-white/15',
              )}
            >
              {lab}
            </button>
          ))}
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          placeholder={
            kind === 'narrative'
              ? 'Ex.: Quero frases de pressing alto estilo RTP, tom sério, com {name} e {away}.'
              : kind === 'tactical'
                ? 'Ex.: Quando recuperamos no meio, projectamos 3 homens na frente em 2 toques.'
                : 'Ex.: O MC interior deve apoiar o pivot, fechar meias-canal e saltar para o último terço.'
          }
          className="mt-3 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25"
        />
        <button
          type="button"
          disabled={loading || message.trim().length < 8}
          onClick={() => void run()}
          className={cn(
            'mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black uppercase',
            loading || message.trim().length < 8
              ? 'cursor-not-allowed bg-white/10 text-white/35'
              : 'bg-violet-600 text-white hover:bg-violet-500',
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Pedir JSON ao modelo
        </button>
        {err ? <p className="mt-3 text-sm text-rose-300">{err}</p> : null}
      </div>

      {lastData != null ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-[10px] font-bold uppercase text-emerald-200/90">Resposta (revisa antes de aplicar)</p>
          <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] text-white/70">
            {JSON.stringify(lastData, null, 2)}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            {kind === 'narrative' ? (
              <button
                type="button"
                onClick={applyNarrative}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold uppercase text-white hover:bg-emerald-500"
              >
                Aplicar → narrativas
              </button>
            ) : null}
            {kind === 'tactical' ? (
              <button
                type="button"
                onClick={applyTactical}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold uppercase text-white hover:bg-emerald-500"
              >
                Aplicar → padrões
              </button>
            ) : null}
            {kind === 'position' ? (
              <button
                type="button"
                onClick={applyPosition}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold uppercase text-white hover:bg-emerald-500"
              >
                Aplicar → posições
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setLastData(null)}
              className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-bold uppercase text-white/60"
            >
              Descartar
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-white/50">
        <p className="font-bold text-white/70">Docling</p>
        <p className="mt-1">
          Não está instalado neste repo. Fluxo realista: corre Docling à parte → exporta texto → cola aqui ou importa
          .txt na aba Narrativas.
        </p>
      </div>
    </div>
  );
}
