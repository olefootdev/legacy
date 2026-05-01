import type { VoiceIntent } from '@/voiceCommand/types';

interface QuickCommand {
  label: string;
  intent: VoiceIntent;
  transcript: string;
  priority: number; // usado pra ordernar por relevância
}

interface ContextualQuickCommandsProps {
  homeScore: number;
  awayScore: number;
  possession: 'home' | 'away';
  teamFatigue: number; // 0-100, média de fadiga
  onDispatch: (transcript: string, intent: VoiceIntent) => void;
}

const ALL_COMMANDS: QuickCommand[] = [
  // Pressão/Agressividade
  { label: '#PRESSÃO', intent: 'team_press_high', transcript: 'pressiona alto', priority: 0 },
  { label: '#ACELERAR', intent: 'pedal_to_metal', transcript: 'pisa no acelerador', priority: 0 },
  { label: '#ATAQUE', intent: 'forwards_press_defenders', transcript: 'atacantes, pressionem', priority: 0 },

  // Defesa/Contenção
  { label: '#RECUAR', intent: 'team_retreat', transcript: 'recua todo mundo', priority: 0 },
  { label: '#SEGURAR', intent: 'team_hold_possession', transcript: 'segura a bola', priority: 0 },
  { label: '#DEFESA', intent: 'team_high_line', transcript: 'sobe o time', priority: 0 },

  // Criatividade
  { label: '#ABRIR', intent: 'stretch_team', transcript: 'estica o time', priority: 0 },
  { label: '#CRIATIVIDADE', intent: 'break_line', transcript: 'quebra a linha', priority: 0 },
  { label: '#OVERLAP', intent: 'left_back_overlap', transcript: 'sobe o lateral', priority: 0 },

  // Mental
  { label: '#CALMA', intent: 'calm_team', transcript: 'acalma o time', priority: 0 },
  { label: '#POSSE', intent: 'team_hold_possession', transcript: 'segura o jogo', priority: 0 },
];

function selectContextualCommands(
  homeScore: number,
  awayScore: number,
  possession: 'home' | 'away',
  teamFatigue: number,
): QuickCommand[] {
  const commands: QuickCommand[] = [];
  const scoreDiff = homeScore - awayScore;
  const weHavePossession = possession === 'home';
  const isTired = teamFatigue > 60;
  const isWinning = scoreDiff > 0;
  const isLosing = scoreDiff < 0;

  if (isLosing) {
    // Perdendo: agressividade
    commands.push(
      ALL_COMMANDS.find((c) => c.intent === 'team_press_high')!,
      ALL_COMMANDS.find((c) => c.intent === 'pedal_to_metal')!,
      ALL_COMMANDS.find((c) => c.intent === 'forwards_press_defenders')!,
      ALL_COMMANDS.find((c) => c.intent === 'left_back_overlap')!,
    );
  } else if (isWinning) {
    // Ganhando: defesa + controle
    commands.push(
      ALL_COMMANDS.find((c) => c.intent === 'team_retreat')!,
      ALL_COMMANDS.find((c) => c.intent === 'team_hold_possession')!,
      ALL_COMMANDS.find((c) => c.intent === 'team_high_line')!,
      ALL_COMMANDS.find((c) => c.intent === 'calm_team')!,
    );
  } else if (weHavePossession) {
    // Empatado + posse: criatividade
    commands.push(
      ALL_COMMANDS.find((c) => c.intent === 'stretch_team')!,
      ALL_COMMANDS.find((c) => c.intent === 'break_line')!,
      ALL_COMMANDS.find((c) => c.intent === 'left_back_overlap')!,
      ALL_COMMANDS.find((c) => c.intent === 'team_hold_possession')!,
    );
  } else {
    // Empatado + sem posse: transição
    commands.push(
      ALL_COMMANDS.find((c) => c.intent === 'team_press_high')!,
      ALL_COMMANDS.find((c) => c.intent === 'pedal_to_metal')!,
      ALL_COMMANDS.find((c) => c.intent === 'team_retreat')!,
      ALL_COMMANDS.find((c) => c.intent === 'calm_team')!,
    );
  }

  // Se cansado, substitui um comando por CALM
  if (isTired && commands.length > 0) {
    const calmIdx = commands.length - 1;
    commands[calmIdx] = ALL_COMMANDS.find((c) => c.intent === 'calm_team')!;
  }

  return commands.slice(0, 4); // máx 4 botões visíveis
}

export function ContextualQuickCommands({
  homeScore,
  awayScore,
  possession,
  teamFatigue,
  onDispatch,
}: ContextualQuickCommandsProps) {
  const commands = selectContextualCommands(homeScore, awayScore, possession, teamFatigue);

  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      style={{
        padding: '8px 12px',
        background: 'rgba(0,0,0,0.3)',
        borderTop: '1px solid rgba(253,225,0,0.1)',
      }}
    >
      <span
        style={{
          fontSize: 8,
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginRight: 4,
        }}
      >
        Contexto
      </span>
      {commands.map((cmd) => (
        <button
          key={cmd.intent}
          type="button"
          onClick={() => onDispatch(cmd.transcript, cmd.intent)}
          className="font-display uppercase transition-all active:scale-95"
          style={{
            background: 'transparent',
            borderLeft: '3px solid #FDE100',
            borderTop: 'none',
            borderRight: 'none',
            borderBottom: 'none',
            color: 'rgba(255,255,255,0.55)',
            fontSize: 10,
            letterSpacing: '0.18em',
            fontWeight: 800,
            padding: '5px 10px 5px 8px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#FDE100';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)';
          }}
        >
          {cmd.label}
        </button>
      ))}
    </div>
  );
}
