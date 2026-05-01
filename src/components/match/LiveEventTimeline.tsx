/**
 * LiveEventTimeline — barra de memória horizontal com pills de eventos.
 * Mostra os últimos 5 eventos como pills clicáveis: '12' falta | 72' GOL'
 */

const NEON = '#FDE100';

function classifyPill(kind?: string, text?: string): 'goal' | 'set_piece' | 'shot' | 'narrative' {
  // Usa kind real do engine quando disponível
  if (kind === 'goal_home' || kind === 'goal_away') return 'goal';
  if (kind === 'whistle') return 'set_piece';
  if (kind === 'shot_home' || kind === 'shot_away') return 'shot';
  // Fallback: inferir pelo texto
  const t = (text ?? '').toLowerCase();
  if (t.includes('gol') || t.includes('goal')) return 'goal';
  if (t.includes('escanteio') || t.includes('falta') || t.includes('corner')) return 'set_piece';
  if (t.includes('chut') || t.includes('finaliz') || t.includes('shot')) return 'shot';
  return 'narrative';
}

function pillLabel(kind: string | undefined, text: string, minute: number): string {
  if (kind === 'goal_home' || kind === 'goal_away') return `${minute}' GOL`;
  if (kind === 'whistle') return `${minute}' falta`;
  if (kind === 'shot_home' || kind === 'shot_away') return `${minute}' chute`;
  const t = text.toLowerCase();
  if (t.includes('gol') || t.includes('goal')) return `${minute}' GOL`;
  if (t.includes('escanteio') || t.includes('corner')) return `${minute}' escanteio`;
  if (t.includes('falta')) return `${minute}' falta`;
  if (t.includes('chut') || t.includes('finaliz')) return `${minute}' chute`;
  // Pega as primeiras 2 palavras do texto
  const words = text.split(' ').slice(0, 3).join(' ');
  return `${minute}' ${words}`;
}

interface LiveEventTimelineProps {
  events: Array<{ minute: number; text: string; kind?: string }>;
  currentMinute: number;
}

export function LiveEventTimeline({ events, currentMinute }: LiveEventTimelineProps) {
  if (events.length === 0) {
    return (
      <div style={{
        height: 26, display: 'flex', alignItems: 'center', padding: '0 12px',
        background: 'rgba(5,5,5,0.95)', borderTop: '1px solid rgba(255,255,255,0.04)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 7, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>
          aguardando eventos...
        </span>
      </div>
    );
  }

  return (
    <div style={{
      height: 26, display: 'flex', alignItems: 'center', gap: 4,
      padding: '0 10px', overflowX: 'auto', scrollbarWidth: 'none',
      background: 'rgba(5,5,5,0.95)', borderTop: '1px solid rgba(255,255,255,0.04)',
      flexShrink: 0,
    }}>
      {/* Label */}
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700,
        letterSpacing: '0.28em', color: 'rgba(255,255,255,0.2)',
        textTransform: 'uppercase', flexShrink: 0, marginRight: 4,
      }}>
        LINHA DO TEMPO
      </span>

      {/* Linha conectora */}
      <div style={{ width: 16, height: 1, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

      {/* Pills */}
      {[...events].reverse().map((ev, i) => {
        const kind = classifyPill(ev.kind, ev.text);
        const label = pillLabel(ev.kind, ev.text, ev.minute);
        const isGoal = kind === 'goal';
        const isSetPiece = kind === 'set_piece';
        const isShot = kind === 'shot';

        return (
          <div key={`${ev.minute}-${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: isGoal ? 8 : 7,
              fontWeight: isGoal ? 900 : 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: isGoal ? '#000' : isSetPiece ? NEON : isShot ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)',
              background: isGoal ? NEON : 'transparent',
              border: isSetPiece ? `1px solid rgba(253,225,0,0.4)` : isShot ? '1px solid rgba(255,255,255,0.15)' : 'none',
              padding: isGoal ? '1px 6px' : isSetPiece || isShot ? '1px 5px' : '0 2px',
              whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
            {i < events.length - 1 && (
              <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 8 }}>·</span>
            )}
          </div>
        );
      })}

      {/* Indicador de minuto atual */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, marginLeft: 4 }}>
        <div style={{ width: 1, height: 12, background: 'rgba(253,225,0,0.3)' }} />
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 800,
          letterSpacing: '0.1em', color: 'rgba(253,225,0,0.5)',
        }}>
          {currentMinute}'
        </span>
      </div>
    </div>
  );
}
