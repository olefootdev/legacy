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
import { L } from '@/i18n/L';
import { posLabel } from '@/components/match/posLabel';
import { PressingControls } from './PressingControls';
import { MarkingAssignmentsControls } from './MarkingAssignmentsControls';
import { TeamMoraleBadge } from './TeamMoraleBadge';
import { CoachCommandInput } from './CoachCommandInput';
import type { CommandResult } from '@/match/coachCommands';

const SLOT_LABEL_PT: Record<string, string> = {
  gol: L('GR', 'GK'),
  zag1: L('Zag E', 'LCB'),
  zag2: L('Zag D', 'RCB'),
  le: L('LE', 'LB'),
  ld: L('LD', 'RB'),
  vol: L('Vol', 'DM'),
  mc1: L('MC 1', 'CM 1'),
  mc2: L('MC 2', 'CM 2'),
  pe: L('PE', 'LW'),
  pd: L('PD', 'RW'),
  ata: L('ATA', 'ST'),
};

const QUICK_PRESETS: { id: PlayingStylePresetId; label: string }[] = [
  { id: 'balanced', label: L('Equilíbrio', 'Balanced') },
  { id: 'POSSE_CONTROLADA', label: L('Posse', 'Possession') },
  { id: 'PRESSAO_ALTA', label: L('Pressão', 'Pressing') },
  { id: 'TRANSICAO_RAPIDA', label: L('Transição', 'Transition') },
  { id: 'BLOCO_BAIXO', label: L('Bloco', 'Low block') },
  { id: 'JOGO_PELAS_LATERAIS', label: L('Alas', 'Wings') },
  { id: 'JOGO_DIRETO', label: L('Direto', 'Direct') },
  { id: 'CRIATIVO_LIVRE', label: L('Criativo', 'Creative') },
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
  const playerHealth = useGameStore((s) => s.playerHealth);
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
      .filter((p) => {
        if (onPitchIds.has(p.id)) return false;
        const h = playerHealth?.[p.id];
        if (h) return (h.outForMatches ?? 0) <= 0 && (h.suspendedMatches ?? 0) <= 0;
        return p.outForMatches <= 0;
      })
      .sort((a, b) => a.num - b.num);
  }, [playersById, onPitchIds, playerHealth]);

  const maxSubs = liveMatch?.mode === 'quick' ? 5 : 3;
  const subsUsed = liveMatch?.substitutionsUsed ?? 0;
  const subsLeft = Math.max(0, maxSubs - subsUsed);

  const applyPreset = (presetId: PlayingStylePresetId) => {
    dispatch({ type: 'SET_PLAYING_STYLE_PRESET', presetId });
    setFeedback(L(`Padrão: ${PRESET_LABEL_PT[presetId]}`, `Style: ${PRESET_LABEL_PT[presetId]}`));
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
    setFeedback(L(`Estilo: ${key} ajustado`, `Style: ${key} adjusted`));
    window.setTimeout(() => setFeedback(null), 2000);
  };

  const selectFormation = (scheme: FormationSchemeId) => {
    if (scheme === formationScheme) {
      // Clicar novamente na atual cancela o rascunho pendente.
      setPendingScheme(null);
      return;
    }
    setPendingScheme(scheme);
    setFeedback(L(`Rascunho: ${scheme} — clica IMPLEMENTAR`, `Draft: ${scheme} — tap APPLY`));
    window.setTimeout(() => setFeedback(null), 2600);
  };

  const implementFormation = () => {
    if (!pendingScheme) return;
    dispatch({ type: 'LIVE_MATCH_SET_FORMATION', formationScheme: pendingScheme });
    setFeedback(L(`Implementado: ${pendingScheme} — time atuando na nova formação`, `Applied: ${pendingScheme} — team now in the new formation`));
    setPendingScheme(null);
    window.setTimeout(() => setFeedback(null), 3000);
  };

  const doSubstitution = () => {
    if (!subOutId || !subInId) {
      setFeedback(L('Escolha quem sai e quem entra.', 'Pick who comes off and who comes on.'));
      window.setTimeout(() => setFeedback(null), 2200);
      return;
    }
    if (subOutId === subInId) {
      setFeedback(L('Os jogadores precisam ser diferentes.', 'Players must be different.'));
      window.setTimeout(() => setFeedback(null), 2200);
      return;
    }
    const lm = getGameState().liveMatch;
    if (!lm || lm.phase !== 'playing') return;
    if (subsLeft <= 0) {
      setFeedback(L(`Limite de substituições (${maxSubs}).`, `Substitution limit (${maxSubs}).`));
      window.setTimeout(() => setFeedback(null), 2800);
      return;
    }
    const incoming = playersById[subInId];
    const outgoing = playersById[subOutId];
    if (!incoming || !outgoing) {
      setFeedback(L('Jogador não encontrado.', 'Player not found.'));
      window.setTimeout(() => setFeedback(null), 2200);
      return;
    }
    const incomingHealth = playerHealth?.[incoming.id];
    const incomingUnavailable = incomingHealth
      ? (incomingHealth.outForMatches ?? 0) > 0 || (incomingHealth.suspendedMatches ?? 0) > 0
      : incoming.outForMatches > 0;
    if (incomingUnavailable) {
      setFeedback(L('Entrada indisponível (lesão / suspensão).', 'Player unavailable (injury / suspension).'));
      window.setTimeout(() => setFeedback(null), 2600);
      return;
    }
    if (!onPitchIds.has(subOutId)) {
      setFeedback(L('O titular tem de estar em campo.', 'The starter must be on the pitch.'));
      window.setTimeout(() => setFeedback(null), 2200);
      return;
    }
    if (onPitchIds.has(subInId)) {
      setFeedback(L('Quem entra não pode já estar em campo.', 'The incoming player is already on the pitch.'));
      window.setTimeout(() => setFeedback(null), 2200);
      return;
    }
    const before = lm.substitutionsUsed;
    dispatch({ type: 'MATCH_SUBSTITUTE', outPlayerId: subOutId, inPlayerId: subInId });
    const after = getGameState().liveMatch?.substitutionsUsed ?? before;
    if (after === before) {
      setFeedback(L('Não foi possível substituir (regras da partida).', 'Substitution not allowed (match rules).'));
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
    <div className="mt-5 space-y-5 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
      {/* Feedback com design system */}
      {feedback ? (
        <div
          className="border px-4 py-3 text-center"
          style={{
            background: 'rgba(34, 211, 238, 0.1)',
            borderColor: 'rgba(34, 211, 238, 0.3)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <p
            className="text-cyan-100"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-ui-sm)',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            {feedback}
          </p>
        </div>
      ) : null}

      {/* 1. Action Cards — mesmos verbos da voz. Clicar = emitir como se falasse. */}
      <LiveActionCards
        onFire={(label) => {
          setFeedback(`📨 "${label}"`);
          window.setTimeout(() => setFeedback(null), 2000);
        }}
      />

      {/* 2. Formação - Card com design system */}
      <div
        className="border p-4 space-y-3"
        style={{
          background: 'var(--surface-dark)',
          borderColor: 'var(--border)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <h4
            className="text-white"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-ui-md)',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {L('Formação', 'Formation')}
          </h4>
          {pendingScheme ? (
            <span
              className="border px-2 py-1"
              style={{
                background: 'rgba(255, 159, 28, 0.15)',
                borderColor: 'rgba(255, 159, 28, 0.4)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-atencao)',
                fontFamily: 'var(--font-display)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {L('Rascunho', 'Draft')}: {pendingScheme}
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
                className="border px-3 py-2 ole-headline tabular-nums transition-[filter] hover:brightness-125 active:scale-95"
                style={{
                  background: isActive
                    ? 'rgba(253, 225, 0, 0.15)'
                    : isPending
                      ? 'rgba(255, 159, 28, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                  borderColor: isActive
                    ? 'var(--yellow)'
                    : isPending
                      ? 'rgba(255, 159, 28, 0.5)'
                      : 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 'var(--radius-sm)',
                  color: isActive
                    ? 'var(--yellow)'
                    : isPending
                      ? 'var(--color-atencao)'
                      : 'var(--color-giz)',
                  fontSize: 'var(--text-ui-xs)',
                  outline: isPending ? '1px solid rgba(255, 159, 28, 0.5)' : undefined,
                }}
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
          className="inline-flex w-full items-center justify-center gap-2 border px-4 py-3 transition-[filter] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: pendingScheme ? 'var(--yellow)' : 'rgba(255, 255, 255, 0.05)',
            borderColor: pendingScheme ? 'rgba(0, 0, 0, 0.1)' : 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: pendingScheme ? '#000' : 'rgba(255, 255, 255, 0.4)',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-ui-sm)',
            fontWeight: 900,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            animation: pendingScheme ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : undefined,
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
          {pendingScheme ? L(`Implementar ${pendingScheme}`, `Apply ${pendingScheme}`) : L('Implementar', 'Apply')}
        </button>
        <p
          className="leading-relaxed"
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          {L('O time só muda depois de implementar.', 'The team only changes once you apply.')}
        </p>
      </div>

      {/* 4. Substituições - Card com design system */}
      <div
        className="border p-4 space-y-3"
        style={{
          background: 'var(--surface-dark)',
          borderColor: 'var(--border)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <UserMinus className="h-4 w-4" style={{ color: 'var(--yellow)' }} />
              <UserPlus className="h-4 w-4" style={{ color: 'var(--yellow)' }} />
            </div>
            <h4
              className="text-white"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-ui-md)',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {L('Substituições', 'Substitutions')}
            </h4>
          </div>
          <span
            className="tabular-nums"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 700,
              color: subsLeft > 0 ? 'var(--yellow)' : 'rgba(255, 255, 255, 0.3)',
            }}
          >
            {subsLeft}/{maxSubs} {L('restantes', 'left')}
          </span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-2">
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.5)',
              }}
            >
              {L('Sai (titular)', 'Off (starter)')}
            </span>
            <select
              value={subOutId}
              onChange={(e) => setSubOutId(e.target.value)}
              className="w-full border px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderColor: 'var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-ui-sm)',
              }}
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
          <label className="flex-1 space-y-2">
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.5)',
              }}
            >
              {L('Entra (banco)', 'On (bench)')}
            </span>
            <select
              value={subInId}
              onChange={(e) => setSubInId(e.target.value)}
              className="w-full border px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderColor: 'var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--text-ui-sm)',
              }}
            >
              <option value="">—</option>
              {benchPlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.num} {p.name} · {posLabel(p.pos)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={doSubstitution}
            disabled={subsLeft <= 0}
            className="border px-4 py-2 transition-[filter] hover:brightness-110 active:scale-95 disabled:pointer-events-none disabled:opacity-35"
            style={{
              background: 'var(--yellow)',
              borderColor: 'rgba(0, 0, 0, 0.1)',
              borderRadius: 'var(--radius-sm)',
              color: '#000',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-ui-sm)',
              fontWeight: 900,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {L('Aplicar', 'Apply')}
          </button>
        </div>
      </div>

      {/* Sprint L4 Fase 2 — Marcação individual */}
      <MarkingAssignmentsControls
        homePlayers={homePlayers}
        awayRoster={awayRoster}
        playersById={playersById}
      />
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
  { id: 'press',   icon: Flame,     label: L('Pressiona alto', 'High press'), phrase: 'pressiona alto',    hint: L('Linha sobe, marca no campo adversário.', 'Line pushes up, press in their half.'), tone: 'press' },
  { id: 'retreat', icon: Shield,    label: L('Recua bloco', 'Drop deep'),    phrase: 'recua',             hint: L('Bloco baixo, compacta atrás da bola.', 'Low block, compact behind the ball.'),   tone: 'retreat' },
  { id: 'possess', icon: Clock,     label: L('Mata o jogo', 'Kill the game'),    phrase: 'mata o jogo',       hint: L('Posse segura, ritmo baixo.', 'Safe possession, slow tempo.'),             tone: 'possess' },
  { id: 'accel',   icon: Zap,       label: L('Acelera', 'Speed up'),        phrase: 'pisa no acelerador', hint: L('Transição rápida, sem pensar duas vezes.', 'Fast transitions, no second thoughts.'), tone: 'accel' },
  { id: 'invade',  icon: Crosshair, label: L('Invade área', 'Attack the box'),    phrase: 'invade a area',     hint: L('Atacantes atacam a grande área.', 'Forwards attack the box.'),        tone: 'attack' },
  { id: 'cross',   icon: Swords,    label: L('Cruza mais', 'More crosses'),     phrase: 'laterais cruza mais', hint: L('Laterais sobem e cruzam pra área.', 'Full-backs push up and cross.'),    tone: 'cross' },
];

const TONE_STYLES: Record<ActionCardDef['tone'], { bg: string; border: string; text: string; hover: string }> = {
  press:   { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.4)', text: '#fecaca', hover: 'rgba(239, 68, 68, 0.6)' },
  retreat: { bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.4)', text: '#bae6fd', hover: 'rgba(14, 165, 233, 0.6)' },
  possess: { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.4)', text: '#ddd6fe', hover: 'rgba(139, 92, 246, 0.6)' },
  accel:   { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.4)', text: '#fed7aa', hover: 'rgba(249, 115, 22, 0.6)' },
  attack:  { bg: 'rgba(253, 225, 0, 0.12)', border: 'rgba(253, 225, 0, 0.4)', text: 'var(--yellow)', hover: 'rgba(253, 225, 0, 0.6)' },
  cross:   { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.4)', text: '#a7f3d0', hover: 'rgba(16, 185, 129, 0.6)' },
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
    <div className="space-y-3">
      {/* Grid de action cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACTION_CARDS.map((c) => {
          const Icon = c.icon;
          const active = firedId === c.id;
          const style = TONE_STYLES[c.tone];
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => fire(c)}
              className="group relative flex flex-col items-start gap-2 border p-3 text-left transition-colors active:scale-[0.98]"
              style={{
                background: style.bg,
                borderColor: active ? style.hover : style.border,
                borderRadius: 'var(--radius-sm)',
                color: style.text,
              }}
              title={L(`Voz: "${c.phrase}"`, `Voice: "${c.phrase}"`)}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <div className="min-w-0 w-full">
                <p
                  className="truncate leading-tight"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-ui-xs)',
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {c.label}
                </p>
                <p
                  className="mt-1 truncate leading-snug opacity-80"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '9px',
                    fontWeight: 500,
                  }}
                >
                  {c.hint}
                </p>
              </div>
              {/* Tooltip de voz no hover */}
              <span
                className="pointer-events-none absolute right-2 top-2 rounded-sm bg-nav px-1.5 py-0.5 font-mono text-[7px] uppercase opacity-0 transition-opacity group-hover:opacity-90"
                style={{ color: 'rgba(255, 255, 255, 0.9)' }}
              >
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
    <div
      className="border"
      style={{
        background: 'rgba(0, 0, 0, 0.2)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-gray-400 transition-colors hover:text-white"
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
        aria-expanded={open}
      >
        <span>{L('Ajuste fino (presets + estilo)', 'Fine-tune (presets + style)')}</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open ? (
        <div className="space-y-3 border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap gap-2">
            {QUICK_PRESETS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onApplyPreset(id)}
                className="border px-3 py-2 transition-[filter] hover:brightness-125 active:scale-95"
                style={{
                  background: presetActive === id ? 'rgba(253, 225, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  borderColor: presetActive === id ? 'var(--yellow)' : 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 'var(--radius-sm)',
                  color: presetActive === id ? 'var(--yellow)' : 'var(--color-giz)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([
              { key: 'pressing' as StyleAxisKey, label: L('+ Pressão', '+ Pressing'),  delta: 6 },
              { key: 'width' as StyleAxisKey,    label: L('+ Largura', '+ Width'),  delta: 6 },
              { key: 'verticality' as StyleAxisKey, label: L('+ Vertical', '+ Direct'), delta: 6 },
              { key: 'riskTaking' as StyleAxisKey, label: L('+ Risco', '+ Risk'),   delta: 5 },
              { key: 'compactness' as StyleAxisKey, label: L('+ Compac.', '+ Compact'), delta: 6 },
              { key: 'defensiveBlock' as StyleAxisKey, label: L('Bloco recua', 'Drop block'), delta: 5 },
            ]).map((b) => (
              <button
                key={b.key}
                type="button"
                className="border px-2 py-2 transition-all hover:bg-white/10 active:scale-95"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-giz)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '10px',
                  fontWeight: 600,
                }}
                onClick={() => onBumpAxis(b.key, b.delta)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Sprint L5 — Moral coletiva (visualização) */}
      <TeamMoraleBadge />

      {/* Sprint L4 — Prensa contextual */}
      <PressingControls />
    </div>
  );
}
