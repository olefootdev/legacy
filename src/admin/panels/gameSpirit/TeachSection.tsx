import { useState } from 'react';
import { Bot, CheckCircle, Loader2, Zap } from 'lucide-react';
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

type ApplyStatus = { ok: true; label: string } | { ok: false; error: string } | null;

function KbStatusBar({ kb }: { kb: GameSpiritKnowledgeRoot }) {
  const narCount = kb.narrativePacks.reduce((s, p) => s + p.lines.length, 0);
  const posCount = kb.positionTeachings.length;
  const patCount = kb.tacticalPatterns.length;

  const items = [
    { label: 'Narrativas', count: narCount, sub: `${kb.narrativePacks.length} pacotes`, active: narCount > 0, desc: 'Ativas no feed da partida' },
    { label: 'Posições', count: posCount, active: posCount > 0, desc: 'Sobrescrevem coordenadas no pitch' },
    { label: 'Padrões', count: patCount, active: patCount > 0, desc: 'Contexto tático (Anthropic decisions)' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <div
          key={it.label}
          className={cn(
            'rounded-xl border p-3 text-center',
            it.active
              ? 'border-emerald-500/30 bg-emerald-500/[0.07]'
              : 'border-white/10 bg-white/[0.02]',
          )}
        >
          <p className={cn('text-xl font-black', it.active ? 'text-emerald-300' : 'text-white/30')}>
            {it.count}
          </p>
          <p className={cn('text-[10px] font-bold uppercase tracking-wider', it.active ? 'text-emerald-200' : 'text-gray-500')}>
            {it.label}
          </p>
          {it.sub && <p className="text-[9px] text-gray-500">{it.sub}</p>}
          <p className="mt-0.5 text-[9px] text-gray-600">{it.desc}</p>
        </div>
      ))}
    </div>
  );
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
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>(null);

  const run = async () => {
    setErr(null);
    setLastData(null);
    setApplyStatus(null);
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

  const applyAndConfirm = (applyFn: () => boolean, successLabel: string) => {
    const ok = applyFn();
    if (ok) {
      setApplyStatus({ ok: true, label: successLabel });
      setLastData(null);
      setMessage('');
      window.setTimeout(() => setApplyStatus(null), 4000);
    }
  };

  const applyNarrative = () => {
    applyAndConfirm(() => {
      const p = parseNarrative(lastData);
      if (!p) { setApplyStatus({ ok: false, error: 'Resposta não é um pacote de narração válido.' }); return false; }
      onChange({
        ...kb,
        narrativePacks: [
          ...kb.narrativePacks,
          { id: newId('nar'), title: p.title, bucket: p.bucket, lines: p.lines, notes: p.notes, updatedAt: nowIso() },
        ],
      });
      return true;
    }, `Narrativa "${parseNarrative(lastData)?.title ?? ''}" aplicada — ativa no feed da partida`);
  };

  const applyTactical = () => {
    applyAndConfirm(() => {
      const p = parseTactical(lastData);
      if (!p) { setApplyStatus({ ok: false, error: 'Resposta não é um padrão tático válido.' }); return false; }
      onChange({
        ...kb,
        tacticalPatterns: [
          ...kb.tacticalPatterns,
          { id: newId('pat'), name: p.name, intentTag: p.intentTag, notes: p.notes, updatedAt: nowIso() },
        ],
      });
      return true;
    }, `Padrão "${parseTactical(lastData)?.name ?? ''}" aplicado — disponível no contexto tático`);
  };

  const applyPosition = () => {
    applyAndConfirm(() => {
      const p = parsePosition(lastData);
      if (!p) { setApplyStatus({ ok: false, error: 'Resposta não é uma posição válida.' }); return false; }
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
      return true;
    }, `Posição "${parsePosition(lastData)?.code ?? ''}" aplicada — sobrescreve coordenadas no pitch`);
  };

  return (
    <div className="space-y-6">
      {/* Engine status */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Ensinos ativos no motor</p>
        <KbStatusBar kb={kb} />
      </div>

      <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-100/95">
        <p className="font-bold text-white">Anthropic via servidor</p>
        <p className="mt-1 text-white/80">
          Coloca <code className="rounded bg-black/30 px-1 text-neon-yellow/90">ANTHROPIC_API_KEY</code> no{' '}
          <code className="rounded bg-black/30 px-1">server/.env</code> e corre{' '}
          <code className="rounded bg-black/30 px-1">npm run dev:server</code>. O browser fala com{' '}
          <code className="text-cyan-300/90">/api/game-spirit/teach</code> — não há chamada direta ao Anthropic (CORS).
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-neon-yellow/90">
          <Bot className="h-4 w-4" />
          Ensinar com agente (estruturado)
        </h3>

        {/* Kind selector */}
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ['narrative', 'Narrativa', 'Frases do locutor/feed'],
              ['tactical', 'Padrão tático', 'Contexto de decisão IA'],
              ['position', 'Posição', 'Coordenadas no pitch'],
            ] as const
          ).map(([k, lab, hint]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setKind(k); setLastData(null); setApplyStatus(null); }}
              className={cn(
                'flex flex-col rounded-lg px-3 py-2 text-left transition-all',
                kind === k ? 'bg-neon-yellow text-black' : 'bg-white/10 text-white/60 hover:bg-white/15',
              )}
            >
              <span className="text-[10px] font-bold uppercase">{lab}</span>
              <span className={cn('text-[9px]', kind === k ? 'text-black/60' : 'text-white/30')}>{hint}</span>
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
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          {loading ? 'Aguardando Anthropic…' : 'Gerar com Claude'}
        </button>

        {err ? <p className="mt-3 text-sm text-rose-300">{err}</p> : null}
      </div>

      {/* Response + APPLY */}
      {lastData != null ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-[10px] font-bold uppercase text-emerald-200/90">Resposta do modelo — revisa e aplica</p>
          <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] text-white/70">
            {JSON.stringify(lastData, null, 2)}
          </pre>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {kind === 'narrative' ? (
              <button
                type="button"
                onClick={applyNarrative}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase text-white shadow hover:bg-emerald-500"
              >
                <Zap className="h-4 w-4" />
                APLICAR → narrativa
              </button>
            ) : null}
            {kind === 'tactical' ? (
              <button
                type="button"
                onClick={applyTactical}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase text-white shadow hover:bg-emerald-500"
              >
                <Zap className="h-4 w-4" />
                APLICAR → padrão tático
              </button>
            ) : null}
            {kind === 'position' ? (
              <button
                type="button"
                onClick={applyPosition}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase text-white shadow hover:bg-emerald-500"
              >
                <Zap className="h-4 w-4" />
                APLICAR → posição no pitch
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setLastData(null)}
              className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-bold uppercase text-white/60 hover:bg-white/5"
            >
              Descartar
            </button>
          </div>
        </div>
      ) : null}

      {/* Apply feedback */}
      {applyStatus != null ? (
        <div
          className={cn(
            'flex items-start gap-3 rounded-xl border p-4',
            applyStatus.ok
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-rose-500/40 bg-rose-500/10',
          )}
        >
          {applyStatus.ok ? (
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          ) : null}
          <div>
            {applyStatus.ok ? (
              <>
                <p className="text-sm font-bold text-emerald-300">Ensino aplicado com sucesso</p>
                <p className="mt-1 text-xs text-emerald-200/70">{applyStatus.label}</p>
                <p className="mt-1 text-[10px] text-emerald-200/50">
                  Guardado em localStorage · ativo na próxima partida · visível nos contadores acima.
                </p>
              </>
            ) : 'error' in applyStatus ? (
              <p className="text-sm text-rose-300">{applyStatus.error}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-white/50">
        <p className="font-bold text-white/70">Como o ensino afeta os jogadores</p>
        <ul className="mt-2 space-y-1 text-[11px] leading-relaxed">
          <li><span className="text-neon-yellow font-bold">Narrativas</span> — injetadas no feed da partida ao vivo com peso 15 (prioridade sobre os padrões padrão).</li>
          <li><span className="text-neon-yellow font-bold">Posições</span> — sobrescrevem as coordenadas x/y de cada posição no pitch (formação + slot). Afeta todos os jogadores nessa posição.</li>
          <li><span className="text-neon-yellow font-bold">Padrões táticos</span> — enviados como contexto nas decisões OpenAI do GameSpirit (matchday e spirit decisions).</li>
        </ul>
      </div>
    </div>
  );
}
