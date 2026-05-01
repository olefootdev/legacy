import type { VoiceIntent } from '@/voiceCommand/types';

interface Tag {
  label: string;
  intent: VoiceIntent;
  transcript: string;
  sector: 'def' | 'mid' | 'att' | 'all';
}

const TAGS: Tag[] = [
  { label: '#PRESSÃO',  intent: 'team_press_high',      transcript: 'pressiona alto',    sector: 'def' },
  { label: '#RECUAR',   intent: 'team_retreat',          transcript: 'recua todo mundo',  sector: 'def' },
  { label: '#OVERLAP',  intent: 'left_back_overlap',     transcript: 'sobe o lateral',    sector: 'mid' },
  { label: '#ABRIR',    intent: 'stretch_team',          transcript: 'estica o time',     sector: 'mid' },
  { label: '#ACELERAR', intent: 'pedal_to_metal',        transcript: 'pisa no acelerador',sector: 'att' },
  { label: '#SEGURAR',  intent: 'team_hold_possession',  transcript: 'segura a bola',     sector: 'all' },
];

interface TacticalTagCloudProps {
  onDispatch: (transcript: string, intent: VoiceIntent) => void;
}

export function TacticalTagCloud({ onDispatch }: TacticalTagCloudProps) {
  return (
    <div
      className="flex items-center gap-1.5 flex-wrap"
      style={{ padding: '6px 12px' }}
    >
      {TAGS.map((tag) => (
        <button
          key={tag.intent}
          type="button"
          onClick={() => onDispatch(tag.transcript, tag.intent)}
          className="font-display uppercase transition-all active:scale-95"
          style={{
            background: 'transparent',
            borderLeft: '3px solid #FDE100',
            borderTop: 'none',
            borderRight: 'none',
            borderBottom: 'none',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 9,
            letterSpacing: '0.2em',
            fontWeight: 800,
            padding: '3px 8px 3px 7px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#FDE100'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'; }}
        >
          {tag.label}
        </button>
      ))}
    </div>
  );
}

export { TAGS };
export type { Tag };
