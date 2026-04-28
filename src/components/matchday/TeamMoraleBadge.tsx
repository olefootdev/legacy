/**
 * Sprint L5 — Badge visual de moral coletiva.
 * Computa do score+minute usando deriveTeamMorale (mesma fórmula do engine).
 */
import { useGameStore } from '@/game/store';
import { deriveTeamMorale } from '@/playerDecision/teamMorale';

export function TeamMoraleBadge() {
  const live = useGameStore((s) => s.liveMatch);
  if (!live || live.phase !== 'playing') return null;

  const homeScore = live.homeScore ?? 0;
  const awayScore = live.awayScore ?? 0;
  const minute = live.minute ?? 0;
  const spiritMomentum = live.spiritMomentum?.home ?? 0;

  const morale = deriveTeamMorale({
    scoreDelta: homeScore - awayScore,
    minute,
    spiritMomentum,
    hasPossession: live.possession === 'home',
  });

  // Tom da barra
  const tone =
    morale.confidence >= 70
      ? '#FDE100'
      : morale.confidence >= 40
        ? '#facc15'
        : morale.confidence >= 25
          ? '#f97316'
          : '#ef4444';

  return (
    <div className="space-y-2 border-t border-white/10 pt-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.35em] font-bold text-white/70">
          Moral coletiva
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display font-black tabular-nums text-base" style={{ color: tone }}>
            {morale.confidence}
          </span>
          <span
            className="text-[9px] uppercase tracking-[0.25em] font-bold"
            style={{ color: tone }}
          >
            {morale.label}
          </span>
        </div>
      </div>
      <div className="relative h-2 bg-zinc-800 overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${morale.confidence}%`, background: tone }}
        />
      </div>
      <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-white/40">
        <span>Pressão {morale.pressure}</span>
        <span>
          {morale.momentum > 0.2 ? '↑ embalado' : morale.momentum < -0.2 ? '↓ tenso' : '→ estável'}
        </span>
      </div>
    </div>
  );
}
