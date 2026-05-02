/**
 * SubstitutePickerModal — modal Legacy Tech para escolher reserva.
 * Lista jogadores do banco, com role match destacado, ordenado por overall.
 */
import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import { roleFromPos } from '@/engine/pitchFromLineup';

const NEON = '#FDE100';

interface Props {
  outgoing: PitchPlayerState;
  bench: PlayerEntity[];
  onPick: (incomingPlayerId: string) => void;
  onClose: () => void;
}

function ovrOf(p: PlayerEntity): number {
  // Best-effort overall — picks first numeric attribute, falls back to 70.
  type WithOvr = PlayerEntity & { ovr?: number; overall?: number; rating?: number };
  const cast = p as WithOvr;
  return cast.ovr ?? cast.overall ?? cast.rating ?? 70;
}

export function SubstitutePickerModal({ outgoing, bench, onPick, onClose }: Props) {
  const outRole = outgoing.role;
  const sorted = [...bench].sort((a, b) => {
    const aMatch = roleFromPos(a.pos) === outRole ? 1 : 0;
    const bMatch = roleFromPos(b.pos) === outRole ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    return ovrOf(b) - ovrOf(a);
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 320,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0D0D0D',
          border: '1px solid rgba(253,225,0,0.25)',
          borderLeft: `3px solid ${NEON}`,
          padding: '20px 22px 16px',
          maxWidth: 420,
          width: '100%',
          maxHeight: '76vh',
          overflowY: 'auto',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.32em',
            color: NEON,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Substituir · {outgoing.pos}
        </div>

        {/* Saindo */}
        <div
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontSize: 22,
            color: '#fff',
            lineHeight: 1.1,
            marginBottom: 4,
            letterSpacing: '-0.01em',
          }}
        >
          Sai {outgoing.name?.split(' ').pop() ?? outgoing.name}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
            marginBottom: 16,
          }}
        >
          Escolha o jogador que entra
        </div>

        {/* Lista */}
        {sorted.length === 0 ? (
          <div
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontSize: 14,
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center',
              padding: '20px 0',
            }}
          >
            Nenhum reserva disponível.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sorted.map((p) => {
              const matched = roleFromPos(p.pos) === outRole;
              const lastName = p.name.split(' ').pop() ?? p.name;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPick(p.id)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${matched ? 'rgba(253,225,0,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    color: '#fff',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'all 120ms',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = NEON;
                    e.currentTarget.style.background = 'rgba(253,225,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = matched ? 'rgba(253,225,0,0.4)' : 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 14,
                      fontWeight: 800,
                      color: matched ? NEON : 'rgba(255,255,255,0.6)',
                      width: 28,
                      textAlign: 'center',
                    }}
                  >
                    {p.num}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.24em',
                      color: matched ? NEON : 'rgba(255,255,255,0.45)',
                      textTransform: 'uppercase',
                      width: 42,
                    }}
                  >
                    {p.pos}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontStyle: 'italic',
                      fontSize: 16,
                      color: '#fff',
                      flex: 1,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {lastName}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 11,
                      fontWeight: 800,
                      color: 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {ovrOf(p)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Cancel */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'var(--font-display)',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
