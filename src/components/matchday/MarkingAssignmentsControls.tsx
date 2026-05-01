/**
 * Sprint L4 Fase 2 — Marcação individual.
 * Manager designa um defensor pra marcar um adversário específico.
 *
 * Design system Legacy Tech:
 * — Eyebrow `tracking-[0.35em]` no header
 * — Linhas com hover sutil + número/nome em font-display
 * — Select com border que ganha neon-yellow no focus + estado ativo
 */
import { useGameDispatch, useGameStore } from '@/game/store';
import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';

interface Props {
  homePlayers: PitchPlayerState[];
  awayRoster: { id: string; num: number; name: string; pos: string }[];
  playersById: Record<string, PlayerEntity>;
}

export function MarkingAssignmentsControls({ homePlayers, awayRoster, playersById }: Props) {
  const dispatch = useGameDispatch();
  const assignments = useGameStore((s) => s.manager.markingAssignments) ?? {};

  // Defensores em campo (DEF + MID)
  const defendersOnPitch = homePlayers
    .map((p) => playersById[p.playerId])
    .filter(
      (p): p is NonNullable<typeof p> =>
        !!p && (p.pos === 'DEF' || p.pos === 'MID'),
    )
    .sort((a, b) => (a.num ?? 0) - (b.num ?? 0));

  // Adversários ofensivos (ST/MID/AM/WG)
  const attackersToMark = awayRoster
    .filter((p) => p.pos === 'ST' || p.pos === 'AM' || p.pos === 'WG' || p.pos === 'MID')
    .slice(0, 6);

  function setAssignment(homeId: string, oppId: string | null) {
    dispatch({ type: 'SET_MARKING_ASSIGNMENT', homePlayerId: homeId, opponentId: oppId });
  }

  function clearAll() {
    dispatch({ type: 'CLEAR_MARKING_ASSIGNMENTS' });
  }

  const hasAny = Object.keys(assignments).length > 0;

  return (
    <div className="space-y-3 border-t border-white/10 pt-4">
      <div className="flex items-center justify-between">
        <div
          className="text-[10px] uppercase tracking-[0.35em] font-bold text-white/55"
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          Marcação individual
        </div>
        {hasAny && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[9px] uppercase tracking-[0.22em] font-bold transition-colors"
            style={{ color: 'var(--color-danger)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#FF6B6B')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-danger)')}
          >
            Limpar
          </button>
        )}
      </div>

      {defendersOnPitch.length === 0 || attackersToMark.length === 0 ? (
        <div className="text-[10px] text-white/35 italic">
          Sem dados suficientes pra marcação (defensores ou ataque adversário ausentes).
        </div>
      ) : (
        <div className="space-y-1">
          {defendersOnPitch.slice(0, 5).map((d) => {
            const currentlyMarking = assignments[d.id];
            const isActive = !!currentlyMarking;
            return (
              <div
                key={d.id}
                className="flex items-center gap-2 px-2 py-1.5 transition-colors"
                style={{
                  background: isActive ? 'rgba(253, 225, 0, 0.06)' : 'transparent',
                  borderLeft: isActive
                    ? '2px solid var(--color-neon-yellow)'
                    : '2px solid transparent',
                }}
              >
                <div
                  className="flex-shrink-0 w-24 truncate font-display font-bold uppercase tracking-[0.05em]"
                  style={{
                    color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.78)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <span style={{ color: 'var(--color-neon-yellow)' }}>#{d.num}</span>{' '}
                  {d.name.split(' ')[0]}
                </div>
                <span
                  className="text-[9px] uppercase tracking-[0.2em]"
                  style={{ color: 'rgba(255,255,255,0.32)' }}
                >
                  marca
                </span>
                <select
                  value={currentlyMarking ?? ''}
                  onChange={(e) => setAssignment(d.id, e.target.value || null)}
                  className="flex-1 px-2 py-1 text-[10px] focus:outline-none transition-colors cursor-pointer"
                  style={{
                    background: 'var(--color-card)',
                    border: isActive
                      ? '1px solid var(--color-neon-yellow)'
                      : '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.9)',
                    fontFamily: 'var(--font-ui)',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-neon-yellow)')}
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = isActive
                      ? 'var(--color-neon-yellow)'
                      : 'rgba(255,255,255,0.08)')
                  }
                >
                  <option value="">— ninguém —</option>
                  {attackersToMark.map((a) => (
                    <option key={a.id} value={a.id}>
                      #{a.num} {a.name} ({a.pos})
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
