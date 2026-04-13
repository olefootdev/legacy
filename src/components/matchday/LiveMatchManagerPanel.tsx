import { useMemo, useState } from 'react';
import { LayoutGrid, SlidersHorizontal, UserMinus, UserPlus, Users } from 'lucide-react';
import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { FORMATION_SCHEME_LIST, slotsForScheme } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import {
  STYLE_PRESETS,
  redistributeStylePoints,
  type PlayingStylePresetId,
  type StyleAxisKey,
} from '@/tactics/playingStyle';
import { cn } from '@/lib/utils';

const SLOT_LABEL_PT: Record<string, string> = {
  gol: 'GR',
  zag1: 'Zag E',
  zag2: 'Zag D',
  le: 'LE',
  ld: 'LD',
  vol: 'Vol',
  mc1: 'MC 1',
  mc2: 'MC 2',
  pe: 'PE',
  pd: 'PD',
  ata: 'ATA',
};

const QUICK_PRESETS: { id: PlayingStylePresetId; label: string }[] = [
  { id: 'balanced', label: 'Equilíbrio' },
  { id: 'vertical_transition', label: 'Transição' },
  { id: 'wide_crossing', label: 'Largura / cruz.' },
  { id: 'low_block_counter', label: 'Bloco + contra' },
  { id: 'direct_long_ball', label: 'Jogo direto' },
  { id: 'tiki_positional', label: 'Posicional' },
];

function slotLabel(slotId: string): string {
  return SLOT_LABEL_PT[slotId] ?? slotId.toUpperCase();
}

export function LiveMatchManagerPanel({
  homeShort,
  awayShort,
  homePlayers,
  awayRoster,
  playersById,
}: {
  homeShort: string;
  awayShort: string;
  homePlayers: PitchPlayerState[];
  awayRoster: { id: string; num: number; name: string; pos: string }[];
  playersById: Record<string, PlayerEntity>;
}) {
  const dispatch = useGameDispatch();
  const tacticalMentality = useGameStore((s) => s.manager.tacticalMentality);
  const defensiveLine = useGameStore((s) => s.manager.defensiveLine);
  const tempo = useGameStore((s) => s.manager.tempo);
  const tacticalStyle = useGameStore((s) => s.manager.tacticalStyle);
  const formationScheme = useGameStore((s) => s.manager.formationScheme);
  const liveMatch = useGameStore((s) => s.liveMatch);
  const presetActive = tacticalStyle?.presetId;

  const [subOutId, setSubOutId] = useState('');
  const [subInId, setSubInId] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const orderedHome = useMemo(() => {
    const order = slotsForScheme(formationScheme);
    const bySlot = new Map(homePlayers.map((p) => [p.slotId, p]));
    return order.map((sid) => bySlot.get(sid)).filter(Boolean) as PitchPlayerState[];
  }, [homePlayers, formationScheme]);

  const onPitchIds = useMemo(() => {
    if (liveMatch?.matchLineupBySlot && Object.keys(liveMatch.matchLineupBySlot).length > 0) {
      return new Set(Object.values(liveMatch.matchLineupBySlot));
    }
    return new Set(homePlayers.map((p) => p.playerId));
  }, [liveMatch, homePlayers]);

  const benchPlayers = useMemo(() => {
    return Object.values(playersById)
      .filter((p) => !onPitchIds.has(p.id) && p.outForMatches <= 0)
      .sort((a, b) => a.num - b.num);
  }, [playersById, onPitchIds]);

  const maxSubs = liveMatch?.mode === 'quick' ? 5 : 3;
  const subsUsed = liveMatch?.substitutionsUsed ?? 0;
  const subsLeft = Math.max(0, maxSubs - subsUsed);

  const setSlider = (partial: { tacticalMentality?: number; defensiveLine?: number; tempo?: number }) => {
    dispatch({ type: 'SET_MANAGER_SLIDERS', partial });
  };

  const applyPreset = (presetId: PlayingStylePresetId) => {
    dispatch({ type: 'SET_PLAYING_STYLE_PRESET', presetId });
    setFeedback(`Padrão aplicado: ${presetId.replaceAll('_', ' ')}`);
    window.setTimeout(() => setFeedback(null), 2400);
  };

  const bumpAxis = (key: StyleAxisKey, delta: number) => {
    const base = { ...(tacticalStyle ?? STYLE_PRESETS.balanced) };
    const cur = Math.max(0, Math.min(100, Math.round(Number(base[key]) || 0)));
    const next = redistributeStylePoints(base, key, cur + delta);
    dispatch({
      type: 'SET_MANAGER_SLIDERS',
      partial: { tacticalStyle: { ...next, presetId: undefined } },
    });
    setFeedback(`Estilo: ${key} ajustado`);
    window.setTimeout(() => setFeedback(null), 2000);
  };

  const applyFormation = (scheme: FormationSchemeId) => {
    if (scheme === formationScheme) return;
    dispatch({ type: 'LIVE_MATCH_SET_FORMATION', formationScheme: scheme });
    setFeedback(`Formação: ${scheme}`);
    window.setTimeout(() => setFeedback(null), 2600);
  };

  const doSubstitution = () => {
    if (!subOutId || !subInId) {
      setFeedback('Escolhe quem sai e quem entra.');
      window.setTimeout(() => setFeedback(null), 2200);
      return;
    }
    if (subOutId === subInId) {
      setFeedback('Jogadores têm de ser diferentes.');
      window.setTimeout(() => setFeedback(null), 2200);
      return;
    }
    const lm = getGameState().liveMatch;
    if (!lm || lm.phase !== 'playing') return;
    if (subsLeft <= 0) {
      setFeedback(`Limite de substituições (${maxSubs}).`);
      window.setTimeout(() => setFeedback(null), 2800);
      return;
    }
    const incoming = playersById[subInId];
    const outgoing = playersById[subOutId];
    if (!incoming || !outgoing) {
      setFeedback('Jogador não encontrado.');
      window.setTimeout(() => setFeedback(null), 2200);
      return;
    }
    if (incoming.outForMatches > 0) {
      setFeedback('Entrada indisponível (lesão / suspensão).');
      window.setTimeout(() => setFeedback(null), 2600);
      return;
    }
    if (!onPitchIds.has(subOutId)) {
      setFeedback('O titular tem de estar em campo.');
      window.setTimeout(() => setFeedback(null), 2200);
      return;
    }
    if (onPitchIds.has(subInId)) {
      setFeedback('Quem entra não pode já estar em campo.');
      window.setTimeout(() => setFeedback(null), 2200);
      return;
    }
    const before = lm.substitutionsUsed;
    dispatch({ type: 'MATCH_SUBSTITUTE', outPlayerId: subOutId, inPlayerId: subInId });
    const after = getGameState().liveMatch?.substitutionsUsed ?? before;
    if (after === before) {
      setFeedback('Não foi possível substituir (regras da partida).');
      window.setTimeout(() => setFeedback(null), 3200);
      return;
    }
    setFeedback(`Sub: ${outgoing.name} ↔ ${incoming.name}`);
    setSubOutId('');
    setSubInId('');
    window.setTimeout(() => setFeedback(null), 3400);
  };

  const awayOrdered = useMemo(() => {
    const order = slotsForScheme(formationScheme);
    return order
      .map((_, i) => awayRoster[i])
      .filter(Boolean) as typeof awayRoster;
  }, [awayRoster, formationScheme]);

  return (
    <div className="mt-5 space-y-5 border-t border-white/10 pt-5">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-neon-yellow" />
        <h3 className="font-display text-sm font-black uppercase tracking-widest text-white">
          Controlo ao vivo
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {homeShort}
        </span>
      </div>

      {feedback ? (
        <p className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 px-3 py-2 text-center text-xs text-cyan-100">
          {feedback}
        </p>
      ) : null}

      {/* 1. Padrão de jogo */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Padrão de jogo</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_PRESETS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors',
                presetActive === id
                  ? 'border-neon-yellow bg-neon-yellow/15 text-neon-yellow'
                  : 'border-white/15 bg-white/5 text-gray-300 hover:border-white/25 hover:bg-white/10',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Ajuste fino (estilo)</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-bold text-gray-200 hover:bg-white/10"
            onClick={() => bumpAxis('pressing', 6)}
          >
            + Pressão
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-bold text-gray-200 hover:bg-white/10"
            onClick={() => bumpAxis('width', 6)}
          >
            + Largura
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-bold text-gray-200 hover:bg-white/10"
            onClick={() => bumpAxis('verticality', 6)}
          >
            + Vertical
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-bold text-gray-200 hover:bg-white/10"
            onClick={() => bumpAxis('riskTaking', 5)}
          >
            + Risco
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-bold text-gray-200 hover:bg-white/10"
            onClick={() => bumpAxis('compactness', 6)}
          >
            + Compac.
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-bold text-gray-200 hover:bg-white/10"
            onClick={() => bumpAxis('defensiveBlock', 5)}
          >
            Bloco recua
          </button>
        </div>
      </div>

      {/* 2. Formação */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Formação</p>
        <div className="flex flex-wrap gap-2">
          {FORMATION_SCHEME_LIST.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => applyFormation(id)}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 font-display text-[11px] font-black tabular-nums transition-colors',
                formationScheme === id
                  ? 'border-neon-yellow bg-neon-yellow/12 text-neon-yellow'
                  : 'border-white/15 bg-white/5 text-gray-300 hover:border-white/25 hover:bg-white/10',
              )}
            >
              {id}
            </button>
          ))}
        </div>
        <p className="text-[9px] leading-relaxed text-gray-500">
          Mantém os 11 em campo; só altera o desenho tático e as coordenadas no relvado.
        </p>
      </div>

      {/* 3. Comportamento de equipa */}
      <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-4">
        <div className="flex items-center gap-2 text-gray-300">
          <LayoutGrid className="h-3.5 w-3.5 text-neon-yellow" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Comportamento de equipa
          </span>
        </div>
        <label className="block space-y-1">
          <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500">
            <span>Mentalidade</span>
            <span className="tabular-nums text-white">{Math.round(tacticalMentality)}</span>
          </div>
          <input
            type="range"
            min={25}
            max={95}
            value={tacticalMentality}
            onChange={(e) => setSlider({ tacticalMentality: Number(e.target.value) })}
            className="w-full accent-neon-yellow"
          />
        </label>
        <label className="block space-y-1">
          <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500">
            <span>Linha defensiva</span>
            <span className="tabular-nums text-white">{Math.round(defensiveLine)}</span>
          </div>
          <input
            type="range"
            min={20}
            max={85}
            value={defensiveLine}
            onChange={(e) => setSlider({ defensiveLine: Number(e.target.value) })}
            className="w-full accent-cyan-400"
          />
        </label>
        <label className="block space-y-1">
          <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500">
            <span>Ritmo / transições</span>
            <span className="tabular-nums text-white">{Math.round(tempo)}</span>
          </div>
          <input
            type="range"
            min={30}
            max={92}
            value={tempo}
            onChange={(e) => setSlider({ tempo: Number(e.target.value) })}
            className="w-full accent-amber-400"
          />
        </label>
      </div>

      {/* 4. Substituições */}
      <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-gray-300">
          <div className="flex items-center gap-2">
            <UserMinus className="h-3.5 w-3.5 text-neon-yellow" />
            <UserPlus className="h-3.5 w-3.5 text-neon-yellow" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Substituições
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold tabular-nums text-gray-500">
            {subsLeft}/{maxSubs} restantes
          </span>
        </div>
        <p className="text-[10px] leading-relaxed text-gray-500">
          Troca um titular por um jogador do banco. O relato da partida regista a alteração.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1">
            <span className="text-[9px] font-bold uppercase text-gray-500">Sai (titular)</span>
            <select
              value={subOutId}
              onChange={(e) => setSubOutId(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/60 px-2 py-2 text-xs text-white"
            >
              <option value="">—</option>
              {orderedHome.map((p) => {
                const ent = playersById[p.playerId];
                const label = ent?.name ?? p.name;
                return (
                  <option key={p.playerId} value={p.playerId}>
                    {p.num} {label} ({slotLabel(p.slotId)})
                  </option>
                );
              })}
            </select>
          </label>
          <label className="flex-1 space-y-1">
            <span className="text-[9px] font-bold uppercase text-gray-500">Entra (banco)</span>
            <select
              value={subInId}
              onChange={(e) => setSubInId(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/60 px-2 py-2 text-xs text-white"
            >
              <option value="">—</option>
              {benchPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.num} {p.name} · {p.pos}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={doSubstitution}
            disabled={subsLeft <= 0}
            className="rounded-lg bg-neon-yellow px-4 py-2 font-display text-xs font-black uppercase tracking-wide text-black hover:brightness-110 disabled:pointer-events-none disabled:opacity-35"
          >
            Aplicar
          </button>
        </div>
      </div>

      {/* 5. Escalações */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Escalações</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 flex items-center gap-2 text-neon-yellow">
              <Users className="h-3.5 w-3.5" />
              <span className="text-[10px] font-display font-black uppercase tracking-wider">{homeShort}</span>
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-[11px]">
              {orderedHome.map((p) => {
                const ent = playersById[p.playerId];
                const label = ent?.name ?? p.name;
                return (
                  <li
                    key={p.playerId}
                    className="flex justify-between gap-2 rounded border border-white/5 bg-white/[0.03] px-2 py-1"
                  >
                    <span className="font-mono tabular-nums text-gray-500">{p.num}</span>
                    <span className="min-w-0 flex-1 truncate font-bold text-white">{label}</span>
                    <span className="shrink-0 text-[10px] uppercase text-cyan-400/90">{slotLabel(p.slotId)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-rose-300">
              <Users className="h-3.5 w-3.5" />
              <span className="text-[10px] font-display font-black uppercase tracking-wider">{awayShort}</span>
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-[11px]">
              {awayOrdered.map((r) => (
                <li
                  key={r.id}
                  className="flex justify-between gap-2 rounded border border-white/5 bg-black/20 px-2 py-1"
                >
                  <span className="font-mono tabular-nums text-gray-500">{r.num}</span>
                  <span className="min-w-0 flex-1 truncate font-bold text-rose-100/90">{r.name}</span>
                  <span className="shrink-0 text-[10px] uppercase text-rose-400/80">{r.pos}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
