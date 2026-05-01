import { useState, useCallback, useEffect, useRef } from 'react';
import type { VoiceIntent } from '@/voiceCommand/types';
import { OBEDIENCE_TIER_BUBBLE } from '@/voiceCommand/types';
import { rollObedience } from '@/voiceCommand/obedienceRoll';
import type { PitchPlayerState } from '@/engine/types';

interface FeedbackEntry {
  id: string;
  playerName: string;
  pos: string;
  num: number;
  message: string;
  tier: 'critical_accept' | 'accept' | 'weak_accept' | 'refuse' | 'protest';
  createdAt: number;
}

// Respostas contextuais por tier + intent
const TIER_RESPONSES: Record<string, Record<string, string>> = {
  critical_accept: {
    team_press_high:     'Vou pressionar sem parar!',
    team_retreat:        'Recuando agora, Professor.',
    pedal_to_metal:      'VAMOS! Tô na velocidade máxima!',
    team_hold_possession:'Segurando a bola, pode deixar.',
    stretch_team:        'Abrindo espaço já!',
    left_back_overlap:   'Subindo pelo corredor!',
    default:             'DEIXA COMIGO!',
  },
  accept: {
    team_press_high:     'Entendido. Vou pressionar.',
    team_retreat:        'Recuando, Professor.',
    pedal_to_metal:      'Acelerando o ritmo.',
    team_hold_possession:'Vou segurar a posse.',
    stretch_team:        'Esticando o time.',
    left_back_overlap:   'Vou subir pelo lado.',
    default:             'Vou fazer.',
  },
  weak_accept: {
    team_press_high:     'Vou tentar pressionar... estou cansado.',
    team_retreat:        'Recuando, mas tô no limite.',
    pedal_to_metal:      'Vou tentar acelerar.',
    team_hold_possession:'Tentando segurar...',
    stretch_team:        'Vou tentar abrir.',
    left_back_overlap:   'Vou tentar subir.',
    default:             'Vou tentar.',
  },
  refuse: {
    default: 'Tá difícil agora...',
  },
  protest: {
    default: 'NÃO CONSIGO!',
  },
};

function getResponse(tier: FeedbackEntry['tier'], intent: VoiceIntent): string {
  return TIER_RESPONSES[tier]?.[intent] ?? TIER_RESPONSES[tier]?.default ?? OBEDIENCE_TIER_BUBBLE[tier];
}

const TIER_COLOR: Record<FeedbackEntry['tier'], string> = {
  critical_accept: '#FDE100',
  accept:          '#FDE100',
  weak_accept:     '#f97316',
  refuse:          '#ef4444',
  protest:         '#ef4444',
};

interface AgentFeedbackStreamProps {
  players: PitchPlayerState[];
  teamObedience?: number;
}

export interface AgentFeedbackStreamHandle {
  push: (intent: VoiceIntent, targetPlayerIds?: string[]) => void;
}

export function useAgentFeedbackStream(
  players: PitchPlayerState[],
  teamObedience = 30,
) {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);

  const push = useCallback((intent: VoiceIntent, targetPlayerIds?: string[]) => {
    const targets = targetPlayerIds?.length
      ? players.filter((p) => targetPlayerIds.includes(p.playerId))
      : players.slice(0, 3); // coletivo: mostra até 3

    const newEntries: FeedbackEntry[] = targets.map((p) => {
      const roll = rollObedience({
        intent,
        teamObedience,
        player: {
          role: p.role,
          slotId: p.slotId,
          fatigue: p.fatigue ?? 25,
          confianca: 70,
          tatico: 55,
        },
      });
      return {
        id: `${p.playerId}_${Date.now()}_${Math.random()}`,
        playerName: p.name,
        pos: p.pos,
        num: p.num,
        message: getResponse(roll.tier, intent),
        tier: roll.tier,
        createdAt: Date.now(),
      };
    });

    setEntries((prev) => [...newEntries, ...prev].slice(0, 4));
  }, [players, teamObedience]);

  // Fade-out após 6s
  useEffect(() => {
    if (entries.length === 0) return;
    const oldest = entries[entries.length - 1];
    const age = Date.now() - oldest.createdAt;
    const remaining = Math.max(0, 6000 - age);
    const t = window.setTimeout(() => {
      setEntries((prev) => prev.filter((e) => e.id !== oldest.id));
    }, remaining);
    return () => window.clearTimeout(t);
  }, [entries]);

  return { entries, push };
}

export function AgentFeedbackStream({ entries }: { entries: FeedbackEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div
      className="absolute z-[250] flex flex-col gap-1.5 pointer-events-none"
      style={{ top: 56, right: 14, width: 180 }}
    >
      {entries.map((e, i) => (
        <div
          key={e.id}
          style={{
            background: 'rgba(10,10,10,0.92)',
            border: '1px solid rgba(253,225,0,0.18)',
            borderLeft: `3px solid ${TIER_COLOR[e.tier]}`,
            padding: '7px 10px',
            animation: 'feedbackIn 280ms cubic-bezier(0.34,1.2,0.64,1) both',
            animationDelay: `${i * 40}ms`,
            opacity: i === entries.length - 1 ? 0.55 : 1,
            transition: 'opacity 400ms ease',
          }}
        >
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 8,
            letterSpacing: '0.28em',
            color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase',
            marginBottom: 3,
          }}>
            {e.pos} · {e.num}
          </div>
          <div style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontSize: 12,
            color: '#fff',
            lineHeight: 1.2,
            marginBottom: 4,
          }}>
            {e.playerName.split(' ')[0]}
          </div>
          <div style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontSize: 10,
            color: TIER_COLOR[e.tier],
            lineHeight: 1.3,
            opacity: 0.9,
          }}>
            "{e.message}"
          </div>
        </div>
      ))}
    </div>
  );
}
