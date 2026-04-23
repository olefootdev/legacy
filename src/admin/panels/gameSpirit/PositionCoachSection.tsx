/**
 * Fase 4 — Legado Perpétuo.
 * Painel de treino por posição: semear DNA de lenda, correr sessões de treino,
 * visualizar evolução do knowledge e promover jogadores a novas lendas.
 */

import { useState } from 'react';
import { Brain, ChevronDown, ChevronRight, Dna, Loader2, Sparkles, Trophy, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore, useGameDispatch } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import type { PlayerEntity } from '@/entities/types';
import type { PositionKnowledge, PositionTrainingError } from '@/gamespirit/legacy/positionKnowledgeTypes';
import { LEGEND_DNA_CATALOG } from '@/gamespirit/legacy/legendDNA';
import {
  seedPositionKnowledgeFromLegend,
  promotePlayerKnowledgeToLegend,
  availableLegendIds,
} from '@/gamespirit/legacy/positionKnowledgeInit';
import { requestPositionTrainingSession } from '@/gamespirit/legacy/positionAgentClient';
import { buildPositionContext, serializePositionContext } from '@/gamespirit/legacy/buildPositionContext';

// ─── Mapa posição → cor de badge ─────────────────────────────────────────────
const POS_COLOR: Record<string, string> = {
  GOL: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  ZAG: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  LD: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  LE: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  VOL: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  MC: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  PE: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  PD: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  ATA: 'bg-red-500/20 text-red-300 border-red-500/30',
};

// ─── Barra de peso (0.1–2.5 normalizado em 0–100%) ───────────────────────────
function WeightBar({ label, value }: { label: string; value: number; key?: string | number }) {
  const pct = Math.min(100, Math.max(0, ((value - 0.1) / (2.5 - 0.1)) * 100));
  const color = value >= 1.5 ? 'bg-neon-yellow' : value >= 1.0 ? 'bg-emerald-400' : 'bg-white/25';
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[9px] font-bold uppercase text-white/40">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-white/10">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-[9px] font-mono text-white/50">{value.toFixed(2)}</span>
    </div>
  );
}

// ─── Card de um jogador ───────────────────────────────────────────────────────
function PlayerKnowledgeCard({
  player,
  onSeed,
  onTrain,
  onPromote,
}: {
  player: PlayerEntity;
  onSeed: (player: PlayerEntity) => void;
  onTrain: (player: PlayerEntity) => void;
  onPromote: (player: PlayerEntity) => void;
  key?: string | number;
}) {
  const [open, setOpen] = useState(false);
  const pk = player.positionKnowledge;
  const ovr = overallFromAttributes(player.attrs);
  const posColor = POS_COLOR[player.pos.toUpperCase()] ?? 'bg-white/10 text-white/60 border-white/20';
  const canPromote = pk && pk.sessionsCompleted >= 3 && ovr >= 80;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white truncate">{player.name}</span>
            <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase', posColor)}>
              {player.pos}
            </span>
            <span className="text-[10px] text-white/40">OVR {ovr}</span>
            {pk ? (
              <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                <Brain className="h-3 w-3" />
                {pk.sessionsCompleted} sessão{pk.sessionsCompleted !== 1 ? 'ões' : ''}
                {pk.legendSource ? ` · DNA ${pk.legendSource}` : ''}
              </span>
            ) : (
              <span className="text-[9px] text-white/30">sem knowledge</span>
            )}
          </div>
        </div>
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-white/40" /> : <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />}
      </button>

      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-4">
          {/* Pesos por zona */}
          {pk && (
            <div className="grid gap-4 sm:grid-cols-3">
              {(['def', 'mid', 'att'] as const).map((zone) => (
                <div key={zone} className="space-y-1.5">
                  <p className="text-[9px] font-bold uppercase text-white/35">
                    {zone === 'def' ? 'Defesa' : zone === 'mid' ? 'Meio' : 'Ataque'}
                  </p>
                  {Object.entries(pk.actionWeights[zone]).map(([action, w]) => (
                    <WeightBar key={action} label={action} value={w ?? 1} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Traits */}
          {pk && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-[9px] font-bold uppercase text-white/35">Traits comportamentais</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <WeightBar label="press" value={pk.traits.pressIntensity * 2.5} />
                <WeightBar label="buildup" value={pk.traits.buildUpPreference * 2.5} />
                <WeightBar label="risco" value={pk.traits.riskTaking * 2.5} />
                <WeightBar label="ofensivo" value={pk.traits.offensiveRuns * 2.5} />
                <WeightBar label="compacto" value={pk.traits.defensiveCompactness * 2.5} />
              </div>
              {pk.coachNotes && (
                <p className="mt-2 text-[10px] text-white/45 italic">"{pk.coachNotes}"</p>
              )}
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-wrap gap-2">
            {!pk && (
              <button
                type="button"
                onClick={() => onSeed(player)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neon-yellow/40 bg-neon-yellow/10 px-3 py-2 text-[10px] font-bold uppercase text-neon-yellow hover:bg-neon-yellow/20"
              >
                <Dna className="h-3.5 w-3.5" />
                Inicializar DNA de Lenda
              </button>
            )}
            {pk && (
              <button
                type="button"
                onClick={() => onSeed(player)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase text-white/60 hover:bg-white/10"
              >
                <Dna className="h-3.5 w-3.5" />
                Re-inicializar DNA
              </button>
            )}
            <button
              type="button"
              onClick={() => onTrain(player)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold uppercase text-emerald-400 hover:bg-emerald-500/20"
            >
              <Zap className="h-3.5 w-3.5" />
              Sessão de treino
            </button>
            {canPromote && (
              <button
                type="button"
                onClick={() => onPromote(player)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[10px] font-bold uppercase text-amber-400 hover:bg-amber-400/20"
              >
                <Trophy className="h-3.5 w-3.5" />
                Promover a Lenda
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal de sessão de treino ────────────────────────────────────────────────
function TrainingModal({
  player,
  onClose,
  onComplete,
}: {
  player: PlayerEntity;
  onClose: () => void;
  onComplete: (pk: PositionKnowledge) => void;
}) {
  const legends = availableLegendIds().filter(
    (l) => l.posCode === player.pos.toUpperCase() || !l.posCode,
  );
  const defaultLegend = legends[0]?.id ?? 'cafu';
  const [legendId, setLegendId] = useState(defaultLegend);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existing = player.positionKnowledge;

  const knowledgeCtx = buildPositionContext(player.pos);
  const knowledgeSerialized = serializePositionContext(knowledgeCtx);

  const run = async () => {
    if (topic.trim().length < 4) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const resp = await requestPositionTrainingSession({
      posCode: player.pos.toUpperCase(),
      legendId,
      topic: topic.trim(),
      playerContext: {
        name: player.name,
        ovr: overallFromAttributes(player.attrs),
        behavior: player.behavior,
        sessionsCompleted: existing?.sessionsCompleted ?? 0,
        coachNotes: existing?.coachNotes,
      },
      knowledgeContext: knowledgeSerialized || undefined,
    });

    setLoading(false);

    if (!resp.ok) {
      setError((resp as PositionTrainingError).error);
      return;
    }

    const updated: PositionKnowledge = {
      posCode: player.pos.toUpperCase(),
      legendSource: resp.legendSource,
      actionWeights: resp.updatedWeights as PositionKnowledge['actionWeights'],
      traits: resp.updatedTraits as PositionKnowledge['traits'],
      sessionsCompleted: (existing?.sessionsCompleted ?? 0) + 1,
      lastTrainedAt: new Date().toISOString(),
      coachNotes: resp.coachNotes,
    };

    setResult(resp.narrative);
    onComplete(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-[#111] shadow-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="font-display text-base font-black text-white">
            Sessão de treino — {player.name}
          </p>
          <p className="text-[10px] text-white/45">{player.pos} · {existing?.legendSource ? `DNA: ${existing.legendSource}` : 'sem DNA'}</p>
        </div>

        <div className="space-y-4 p-5">
          <label className="block text-[10px] font-bold uppercase text-white/40">
            Agente (DNA de lenda)
            <select
              value={legendId}
              onChange={(e) => setLegendId(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {legends.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[10px] text-white/50">
            <span className="font-bold text-white/70">Contexto tático: </span>
            {knowledgeCtx.summary}
          </div>

          <label className="block text-[10px] font-bold uppercase text-white/40">
            Tópico desta sessão
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={loading}
              rows={3}
              placeholder="Ex.: Como o lateral deve agir em transição ofensiva quando a equipa recupera a bola no meio-campo..."
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 disabled:opacity-50"
            />
          </label>

          {result && (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              <Sparkles className="mb-1 h-3.5 w-3.5 inline mr-1" />
              {result}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-white/20 px-4 py-2 text-[10px] font-bold uppercase text-white/60 hover:bg-white/5 disabled:opacity-40"
          >
            {result ? 'Fechar' : 'Cancelar'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={() => void run()}
              disabled={loading || topic.trim().length < 4}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[10px] font-bold uppercase text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {loading ? 'Treinando...' : 'Iniciar sessão'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal de promoção a Lenda ────────────────────────────────────────────────
function PromoteModal({
  player,
  onClose,
}: {
  player: PlayerEntity;
  onClose: () => void;
}) {
  const legend = promotePlayerKnowledgeToLegend(player);
  const [copied, setCopied] = useState(false);

  if (!legend) return null;

  const json = JSON.stringify(legend, null, 2);

  const copy = () => {
    void navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-400/30 bg-[#111] shadow-2xl">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="font-display text-base font-black text-amber-400 flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            {player.name} é uma nova lenda
          </p>
          <p className="text-[10px] text-white/45">
            DNA gerado — adiciona ao catálogo legendDNA.ts para ensinar a próxima geração.
          </p>
        </div>

        <div className="p-5">
          <pre className="max-h-72 overflow-auto rounded-lg bg-black/40 p-3 text-[10px] text-white/70 leading-relaxed">
            {json}
          </pre>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-4 py-2 text-[10px] font-bold uppercase text-white/60 hover:bg-white/5"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded-lg bg-amber-500 px-4 py-2 text-[10px] font-bold uppercase text-black hover:bg-amber-400"
          >
            {copied ? 'Copiado!' : 'Copiar JSON'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Secção principal ─────────────────────────────────────────────────────────
export function PositionCoachSection() {
  const players = useGameStore((s) => s.players);
  const dispatch = useGameDispatch();
  const [trainTarget, setTrainTarget] = useState<PlayerEntity | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<PlayerEntity | null>(null);
  const [filter, setFilter] = useState<string>('ALL');

  const allPlayers = Object.values(players).sort((a, b) =>
    overallFromAttributes(b.attrs) - overallFromAttributes(a.attrs),
  );

  const POS_OPTIONS = ['ALL', 'GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'PE', 'PD', 'ATA'];
  const filtered = filter === 'ALL' ? allPlayers : allPlayers.filter((p) => p.pos.toUpperCase() === filter);

  const handleSeed = (player: PlayerEntity) => {
    const pk = seedPositionKnowledgeFromLegend(player);
    dispatch({ type: 'ADMIN_PATCH_PLAYER', playerId: player.id, partial: { positionKnowledge: pk } });
  };

  const handleTrainComplete = (player: PlayerEntity, pk: PositionKnowledge) => {
    dispatch({ type: 'ADMIN_PATCH_PLAYER', playerId: player.id, partial: { positionKnowledge: pk } });
  };

  const withKnowledge = allPlayers.filter((p) => p.positionKnowledge).length;
  const totalSessions = allPlayers.reduce((s, p) => s + (p.positionKnowledge?.sessionsCompleted ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3">
        <p className="font-display text-base font-black text-emerald-300 flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Agentes de Posição — Legado Perpétuo
        </p>
        <p className="mt-1 text-xs text-white/60">
          Semeia DNA de lendas nos jogadores, corre sessões de treino entre partidas (tokens só aqui)
          e promove talentos evoluídos a novas lendas que ensinam a próxima geração.
          Durante a partida: zero tokens — o motor lê o JSON local.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-white/40">
          <span>
            <span className="font-bold text-white/70">{withKnowledge}</span>/{allPlayers.length} jogadores com DNA
          </span>
          <span>
            <span className="font-bold text-white/70">{totalSessions}</span> sessões totais
          </span>
          <span>
            <span className="font-bold text-white/70">{LEGEND_DNA_CATALOG.length}</span> lendas no catálogo
          </span>
        </div>
      </div>

      {/* Filtro por posição */}
      <div className="flex flex-wrap gap-1">
        {POS_OPTIONS.map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => setFilter(pos)}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase',
              filter === pos
                ? 'bg-neon-yellow text-black'
                : 'text-white/40 hover:bg-white/10 hover:text-white',
            )}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* Lista de jogadores */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-white/35 text-center py-8">
            Nenhum jogador {filter !== 'ALL' ? `na posição ${filter}` : ''} encontrado.
          </p>
        )}
        {filtered.map((player) => (
          <PlayerKnowledgeCard
            key={player.id}
            player={player}
            onSeed={handleSeed}
            onTrain={setTrainTarget}
            onPromote={setPromoteTarget}
          />
        ))}
      </div>

      {/* Catálogo de lendas */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="mb-3 text-[10px] font-bold uppercase text-white/40 flex items-center gap-2">
          <Dna className="h-3.5 w-3.5" />
          Catálogo de Lendas ({LEGEND_DNA_CATALOG.length})
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LEGEND_DNA_CATALOG.map((legend) => (
            <div key={legend.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-white text-sm">{legend.name}</p>
                <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase', POS_COLOR[legend.posCode] ?? 'bg-white/10 text-white/60 border-white/20')}>
                  {legend.posCode}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-white/40">{legend.era} · {legend.nationality}</p>
              <p className="mt-1.5 text-[10px] text-white/55 leading-relaxed line-clamp-2">
                {legend.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Modais */}
      {trainTarget && (
        <TrainingModal
          player={trainTarget}
          onClose={() => setTrainTarget(null)}
          onComplete={(pk) => {
            handleTrainComplete(trainTarget, pk);
          }}
        />
      )}
      {promoteTarget && (
        <PromoteModal
          player={promoteTarget}
          onClose={() => setPromoteTarget(null)}
        />
      )}
    </div>
  );
}
