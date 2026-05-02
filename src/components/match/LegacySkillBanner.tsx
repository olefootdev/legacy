/**
 * LegacySkillBanner — overlay editorial canto superior esquerdo do campo Legacy.
 * Aparece ao ativar Legacy Mode; mostra os jogadores com skills ativas, estilo
 * "MODO LEGACY · Movimento lembra Pelé 1970".
 */
import type { PitchPlayerState } from '@/engine/types';
import { Crown } from 'lucide-react';

const NEON = '#FDE100';

export interface LegacySkillBannerEntry {
  playerId: string;
  skillId: string;
}

interface Props {
  entries: LegacySkillBannerEntry[];
  players: PitchPlayerState[];
  /** Index do jogador atualmente em destaque no carrossel. */
  highlightIndex?: number;
}

const SKILL_TAGLINES: Record<string, { tag: string; legend: string }> = {
  skl_goleiro_padrao:        { tag: 'REFLEXO',     legend: 'Reação · Taffarel 1994' },
  skl_escola_taffarel:       { tag: 'PEGADA',      legend: 'Defesa · Taffarel 1994' },
  skl_ferrolho_italiano:     { tag: 'FERROLHO',    legend: 'Marcação · Maldini 2003' },
  skl_meia_padrao:           { tag: 'CONDUÇÃO',    legend: 'Visão · Zico 1982' },
  skl_lateral_overlap_cross: { tag: 'OVERLAP',     legend: 'Subida · Cafu 2002' },
  skl_atacante_padrao:       { tag: 'INFILTRA',    legend: 'Movimento · Romário 1994' },
  skl_artilheiro_clutch:     { tag: 'CLUTCH',      legend: 'Frieza · Pelé 1970' },
};

function taglineFor(skillId: string): { tag: string; legend: string } {
  return SKILL_TAGLINES[skillId] ?? { tag: 'LEGADO', legend: 'Inspiração histórica' };
}

export function LegacySkillBanner({ entries, players, highlightIndex = 0 }: Props) {
  if (entries.length === 0) return null;
  const idx = ((highlightIndex % entries.length) + entries.length) % entries.length;
  const current = entries[idx];
  const player = players.find((p) => p.playerId === current.playerId);
  if (!player) return null;
  const { tag, legend } = taglineFor(current.skillId);
  const initial = (player.name?.[0] ?? '?').toUpperCase();
  const lastName = (player.name ?? '').split(' ').pop() ?? player.name ?? '';

  return (
    <div
      style={{
        width: 280,
        background: '#0D0D0D',
        border: `1px solid rgba(253,225,0,0.35)`,
        borderLeft: `3px solid ${NEON}`,
        padding: '12px 14px 14px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.55), 0 0 18px rgba(253,225,0,0.18)',
        animation: 'legacyBannerIn 320ms cubic-bezier(0.2,0.8,0.2,1)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes legacyBannerIn {
          from { opacity: 0; transform: translateX(-10px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>

      {/* Eyebrow: badge + label + counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: NEON,
            color: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Crown size={12} strokeWidth={2.5} />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.32em',
            color: NEON,
            textTransform: 'uppercase',
            flex: 1,
          }}
        >
          Modo Legacy
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          {idx + 1}/{entries.length}
        </div>
      </div>

      {/* Linha principal: avatar + nome/legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            background: 'linear-gradient(160deg, #1a1a1a 0%, #0a0a0a 100%)',
            border: '1px solid rgba(253,225,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            filter: 'grayscale(0.6) contrast(1.1)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontSize: 28,
              color: '#fff',
              lineHeight: 1,
            }}
          >
            {initial}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.32em',
              color: NEON,
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            #{player.num} · {player.pos}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: 18,
              color: '#fff',
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {lastName}
          </div>
        </div>
      </div>

      {/* Tag + legend */}
      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.24em',
            color: '#fff',
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          {tag}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontSize: 11,
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.3,
          }}
        >
          {legend}
        </div>
      </div>
    </div>
  );
}
