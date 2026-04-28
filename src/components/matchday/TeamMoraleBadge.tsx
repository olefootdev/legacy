/**
 * Sprint L5 — Badge visual de moral coletiva.
 * Computa do score+minute usando deriveTeamMorale (mesma fórmula do engine).
 *
 * Design system Legacy Tech:
 * — Eyebrow `tracking-[0.35em]` em var(--color-neon-yellow)
 * — Cores semânticas: success / warning / danger conforme escala de confiança
 * — Barra com transition + sombra interna pra densidade visual
 */
import { useGameStore } from '@/game/store';
import { deriveTeamMorale } from '@/playerDecision/teamMorale';

interface MoraleTone {
  /** Cor sólida (texto + barra). */
  color: string;
  /** Cor leve de fundo da barra. */
  trackBg: string;
  /** Tag textual curto. */
  pulse: 'elite' | 'good' | 'avg' | 'weak';
}

function moraleTone(confidence: number): MoraleTone {
  if (confidence >= 70) {
    return {
      color: 'var(--color-neon-yellow)',
      trackBg: 'rgba(253, 225, 0, 0.10)',
      pulse: 'elite',
    };
  }
  if (confidence >= 40) {
    return {
      color: 'var(--color-warning)',
      trackBg: 'rgba(255, 179, 0, 0.10)',
      pulse: 'good',
    };
  }
  if (confidence >= 25) {
    return {
      color: '#F97316',
      trackBg: 'rgba(249, 115, 22, 0.10)',
      pulse: 'avg',
    };
  }
  return {
    color: 'var(--color-danger)',
    trackBg: 'rgba(255, 61, 61, 0.10)',
    pulse: 'weak',
  };
}

function momentumGlyph(momentum: number): { arrow: string; label: string } {
  if (momentum > 0.2) return { arrow: '↑', label: 'embalado' };
  if (momentum < -0.2) return { arrow: '↓', label: 'tenso' };
  return { arrow: '→', label: 'estável' };
}

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

  const tone = moraleTone(morale.confidence);
  const mom = momentumGlyph(morale.momentum);

  return (
    <div className="space-y-2.5 border-t border-white/10 pt-4">
      <div className="flex items-center justify-between">
        <div
          className="text-[10px] uppercase tracking-[0.35em] font-bold text-white/55"
          style={{ fontFamily: 'var(--font-ui)' }}
        >
          Moral coletiva
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className="font-display font-black tabular-nums leading-none"
            style={{ color: tone.color, fontSize: 'var(--text-lg)' }}
          >
            {morale.confidence}
          </span>
          <span
            className="text-[9px] uppercase tracking-[0.28em] font-bold"
            style={{ color: tone.color }}
          >
            {morale.label}
          </span>
        </div>
      </div>

      <div
        className="relative h-1.5 overflow-hidden"
        style={{ background: tone.trackBg }}
      >
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${morale.confidence}%`,
            background: tone.color,
            boxShadow: `0 0 8px ${tone.color}66`,
          }}
        />
      </div>

      <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.22em] text-white/45">
        <span className="flex items-center gap-1">
          <span className="text-white/30">Pressão</span>
          <span
            className="tabular-nums font-display font-bold"
            style={{ color: morale.pressure > 65 ? 'var(--color-danger)' : 'var(--color-text-soft, rgba(255,255,255,0.7))' }}
          >
            {morale.pressure}
          </span>
        </span>
        <span className="flex items-center gap-1.5" style={{ color: tone.color }}>
          <span aria-hidden>{mom.arrow}</span>
          <span>{mom.label}</span>
        </span>
      </div>
    </div>
  );
}
