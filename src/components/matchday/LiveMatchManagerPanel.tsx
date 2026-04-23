import { memo, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, SlidersHorizontal, UserMinus, UserPlus, Users,
  Shield, Zap, Clock, Flame, Crosshair, Swords, ChevronDown, ChevronUp,
} from 'lucide-react';
import { issueManagerCommand } from '@/voiceCommand/managerCommandBus';
import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { FORMATION_SCHEME_LIST, slotsForScheme } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import {
  STYLE_PRESETS,
  PRESET_LABEL_PT,
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
  { id: 'POSSE_CONTROLADA', label: 'Posse' },
  { id: 'PRESSAO_ALTA', label: 'Pressão' },
  { id: 'TRANSICAO_RAPIDA', label: 'Transição' },
  { id: 'BLOCO_BAIXO', label: 'Bloco' },
  { id: 'JOGO_PELAS_LATERAIS', label: 'Alas' },
  { id: 'JOGO_DIRETO', label: 'Direto' },
  { id: 'CRIATIVO_LIVRE', label: 'Criativo' },
];

function slotLabel(slotId: string): string {
  return SLOT_LABEL_PT[slotId] ?? slotId.toUpperCase();
}

export const LiveMatchManagerPanel = memo(function LiveMatchManagerPanel({
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
  const tacticalStyle = useGameStore((s) => s.manager.tacticalStyle);
  const formationScheme = useGameStore((s) => s.manager.formationScheme);
  const liveMatch = useGameStore((s) => s.liveMatch);
  const presetActive = tacticalStyle?.presetId;

  const [subOutId, setSubOutId] = useState('');
  const [subInId, setSubInId] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  /** Formação selecionada pelo treinador mas ainda NÃO aplicada — aguarda IMPLEMENTAR. */
  const [pendingScheme, setPendingScheme] = useState<FormationSchemeId | null>(null);

  // Se a formação em vigor mudar por fora (ex.: meio-tempo), descarta pendente resolvido.
  useEffect(() => {
    if (pendingScheme && pendingScheme === formationScheme) {
      setPendingScheme(null);
    }
  }, [formationScheme, pendingScheme]);

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

  const applyPreset = (presetId: PlayingStylePresetId) => {
    dispatch({ type: 'SET_PLAYING_STYLE_PRESET', presetId });
    setFeedback(`Padrão: ${PRESET_LABEL_PT[presetId]}`);
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

  const selectFormation = (scheme: FormationSchemeId) => {
    if (scheme === formationScheme) {
      // Clicar novamente na atual cancela o rascunho pendente.
      setPendingScheme(null);
      return;
    }
    setPendingScheme(scheme);
    setFeedback(`Rascunho: ${scheme} — clica IMPLEMENTAR`);
    window.setTimeout(() => setFeedback(null), 2600);
  };

  const implementFormation = () => {
    if (!pendingScheme) return;
    dispatch({ type: 'LIVE_MATCH_SET_FORMATION', formationScheme: pendingScheme });
    setFeedback(`Implementado: ${pendingScheme} — time atuando na nova formação`);
    setPendingScheme(null);
    window.setTimeout(() => setFeedback(null), 3000);
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

      {/* 1. Action Cards — mesmos verbos da voz. Clicar = emitir como se falasse. */}
      <LiveActionCards
        onFire={(label) => {
          setFeedback(`📨 "${label}"`);
          window.setTimeout(() => setFeedback(null), 2000);
        }}
      />

      {/* Ajuste fino legado — mantido escondido pra ajustes táticos detalhados. */}
      <LegacyFineTune
        presetActive={presetActive}
        onApplyPreset={applyPreset}
        onBumpAxis={bumpAxis}
      />

      {/* 2. Formação */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Formação</p>
          {pendingScheme ? (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
              Rascunho: {pendingScheme}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {FORMATION_SCHEME_LIST.map((id) => {
            const isActive = formationScheme === id && pendingScheme === null;
            const isPending = pendingScheme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectFormation(id)}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 font-display text-[11px] font-black tabular-nums transition-colors',
                  isActive
                    ? 'border-neon-yellow bg-neon-yellow/12 text-neon-yellow'
                    : isPending
                      ? 'border-amber-400 bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/50'
                      : 'border-white/15 bg-white/5 text-gray-300 hover:border-white/25 hover:bg-white/10',
                )}
              >
                {id}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={implementFormation}
          disabled={!pendingScheme}
          className={cn(
            'inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-display text-[11px] font-black uppercase tracking-[0.15em] transition-colors',
            pendingScheme
              ? 'border-neon-yellow bg-neon-yellow text-black hover:bg-white animate-pulse'
              : 'border-white/10 bg-white/5 text-gray-500 cursor-not-allowed',
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {pendingScheme ? `Implementar ${pendingScheme}` : 'Implementar'}
        </button>
        <p className="text-[9px] leading-relaxed text-gray-500">
          {pendingScheme
            ? 'Clica IMPLEMENTAR para o time começar a atuar na nova formação.'
            : 'Selecione uma formação; o time só muda depois de IMPLEMENTAR.'}
        </p>
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
              className="w-full rounded-lg border border-white/15 bg-black/60 px-2 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
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
              className="w-full rounded-lg border border-white/15 bg-black/60 px-2 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
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
});

// ─── Action Cards — espelho dos intents de voz ─────────────────────────────

interface ActionCardDef {
  id: string;
  icon: typeof Shield;
  label: string;
  /** Frase enviada pra pipeline de voz (mesmo parser usado em VoiceCommandPanel). */
  phrase: string;
  hint: string;
  tone: 'press' | 'retreat' | 'possess' | 'accel' | 'attack' | 'cross';
}

const ACTION_CARDS: ActionCardDef[] = [
  { id: 'press',   icon: Flame,     label: 'Pressiona alto', phrase: 'pressiona alto',    hint: 'Linha sobe, marca no campo adversário.', tone: 'press' },
  { id: 'retreat', icon: Shield,    label: 'Recua bloco',    phrase: 'recua',             hint: 'Bloco baixo, compacta atrás da bola.',   tone: 'retreat' },
  { id: 'possess', icon: Clock,     label: 'Mata o jogo',    phrase: 'mata o jogo',       hint: 'Posse segura, ritmo baixo.',             tone: 'possess' },
  { id: 'accel',   icon: Zap,       label: 'Acelera',        phrase: 'pisa no acelerador', hint: 'Transição rápida, sem pensar duas vezes.', tone: 'accel' },
  { id: 'invade',  icon: Crosshair, label: 'Invade área',    phrase: 'invade a area',     hint: 'Atacantes atacam a grande área.',        tone: 'attack' },
  { id: 'cross',   icon: Swords,    label: 'Cruza mais',     phrase: 'laterais cruza mais', hint: 'Laterais sobem e cruzam pra área.',    tone: 'cross' },
];

const TONE_STYLES: Record<ActionCardDef['tone'], string> = {
  press:   'border-rose-500/40    bg-rose-500/10    text-rose-100    hover:border-rose-400',
  retreat: 'border-sky-500/40     bg-sky-500/10     text-sky-100     hover:border-sky-400',
  possess: 'border-violet-500/40  bg-violet-500/10  text-violet-100  hover:border-violet-400',
  accel:   'border-orange-500/40  bg-orange-500/10  text-orange-100  hover:border-orange-400',
  attack:  'border-neon-yellow/40 bg-neon-yellow/10 text-neon-yellow hover:border-neon-yellow',
  cross:   'border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400',
};

function LiveActionCards({ onFire }: { onFire: (label: string) => void }) {
  const [firedId, setFiredId] = useState<string | null>(null);
  const fire = (c: ActionCardDef) => {
    issueManagerCommand(c.phrase, 'touch');
    setFiredId(c.id);
    onFire(c.label);
    window.setTimeout(() => setFiredId((cur) => (cur === c.id ? null : cur)), 600);
  };
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
        Comando rápido
        <span className="ml-1.5 text-gray-600 normal-case tracking-normal">(ou fala a frase no mic)</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ACTION_CARDS.map((c) => {
          const Icon = c.icon;
          const active = firedId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => fire(c)}
              className={cn(
                'group relative flex flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition-all',
                TONE_STYLES[c.tone],
                active && 'scale-[0.98] shadow-[0_0_18px_currentColor]',
              )}
              title={`Voz: "${c.phrase}"`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0 w-full">
                <p className="truncate font-display text-[11px] font-black uppercase leading-tight tracking-wider">
                  {c.label}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[9px] font-normal leading-snug opacity-70">
                  {c.hint}
                </p>
              </div>
              <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-sm bg-black/40 px-1 py-0.5 font-mono text-[7px] uppercase opacity-0 backdrop-blur transition-opacity group-hover:opacity-80">
                🎤 "{c.phrase}"
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Ajuste fino legado (collapsed por padrão) ─────────────────────────────

function LegacyFineTune({
  presetActive,
  onApplyPreset,
  onBumpAxis,
}: {
  presetActive: PlayingStylePresetId | undefined;
  onApplyPreset: (id: PlayingStylePresetId) => void;
  onBumpAxis: (key: StyleAxisKey, delta: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-white/5 bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:text-white"
        aria-expanded={open}
      >
        <span>Ajuste fino (presets + estilo)</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open ? (
        <div className="space-y-2 border-t border-white/5 px-3 pb-3 pt-2">
          <div className="flex flex-wrap gap-2">
            {QUICK_PRESETS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onApplyPreset(id)}
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([
              { key: 'pressing' as StyleAxisKey, label: '+ Pressão',  delta: 6 },
              { key: 'width' as StyleAxisKey,    label: '+ Largura',  delta: 6 },
              { key: 'verticality' as StyleAxisKey, label: '+ Vertical', delta: 6 },
              { key: 'riskTaking' as StyleAxisKey, label: '+ Risco',   delta: 5 },
              { key: 'compactness' as StyleAxisKey, label: '+ Compac.', delta: 6 },
              { key: 'defensiveBlock' as StyleAxisKey, label: 'Bloco recua', delta: 5 },
            ]).map((b) => (
              <button
                key={b.key}
                type="button"
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-bold text-gray-200 hover:bg-white/10"
                onClick={() => onBumpAxis(b.key, b.delta)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
