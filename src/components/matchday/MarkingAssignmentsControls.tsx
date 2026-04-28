/**
 * Sprint L4 Fase 2 — Marcação individual.
 * Manager designa um defensor pra marcar um adversário específico.
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
        !!p && (p.position === 'DEF' || p.position === 'MID'),
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
        <div className="text-[10px] uppercase tracking-[0.35em] font-bold text-white/70">
          Marcação individual
        </div>
        {hasAny && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[9px] uppercase tracking-[0.2em] text-red-400 hover:text-red-300"
          >
            Limpar
          </button>
        )}
      </div>

      {defendersOnPitch.length === 0 || attackersToMark.length === 0 ? (
        <div className="text-[10px] text-white/40 italic">
          Sem dados suficientes pra marcação (defensores ou ataque adversário ausentes).
        </div>
      ) : (
        <div className="space-y-1.5">
          {defendersOnPitch.slice(0, 5).map((d) => {
            const currentlyMarking = assignments[d.id];
            return (
              <div
                key={d.id}
                className="flex items-center gap-2 text-[10px]"
              >
                <div className="flex-shrink-0 w-24 truncate font-display font-bold uppercase text-white/85 tracking-wider">
                  #{d.num} {d.name.split(' ')[0]}
                </div>
                <span className="text-white/40 text-[9px]">marca</span>
                <select
                  value={currentlyMarking ?? ''}
                  onChange={(e) => setAssignment(d.id, e.target.value || null)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-[10px] px-2 py-1 focus:outline-none focus:border-neon-yellow"
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
