import { useState, useCallback, useEffect, useRef } from 'react';
import type { VoiceIntent } from '@/voiceCommand/types';
import { OBEDIENCE_TIER_BUBBLE } from '@/voiceCommand/types';
import { rollObedience } from '@/voiceCommand/obedienceRoll';
import type { PitchPlayerState } from '@/engine/types';

import { L } from '@/i18n/L';
import { posLabel } from './posLabel';
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
    team_press_high:     L('Vou pressionar sem parar!', 'Pressing non-stop!'),
    team_retreat:        L('Recuando agora, Professor.', 'Dropping back now, Boss.'),
    pedal_to_metal:      L('VAMOS! Tô na velocidade máxima!', "LET'S GO! Full speed!"),
    team_hold_possession:L('Segurando a bola, pode deixar.', 'Keeping the ball, leave it to me.'),
    stretch_team:        L('Abrindo espaço já!', 'Opening space now!'),
    left_back_overlap:   L('Subindo pelo corredor!', 'Bombing up the flank!'),
    default:             L('DEIXA COMIGO!', 'LEAVE IT TO ME!'),
  },
  accept: {
    team_press_high:     L('Entendido. Vou pressionar.', 'Got it. Pressing.'),
    team_retreat:        L('Recuando, Professor.', 'Dropping back, Boss.'),
    pedal_to_metal:      L('Acelerando o ritmo.', 'Upping the tempo.'),
    team_hold_possession:L('Vou segurar a posse.', 'Keeping possession.'),
    stretch_team:        L('Esticando o time.', 'Stretching the team.'),
    left_back_overlap:   L('Vou subir pelo lado.', 'Going up the flank.'),
    default:             L('Vou fazer.', 'On it.'),
  },
  weak_accept: {
    team_press_high:     L('Vou tentar pressionar... estou cansado.', "I'll try to press... I'm tired."),
    team_retreat:        L('Recuando, mas tô no limite.', "Dropping back, but I'm at my limit."),
    pedal_to_metal:      L('Vou tentar acelerar.', "I'll try to speed up."),
    team_hold_possession:L('Tentando segurar...', 'Trying to hold on...'),
    stretch_team:        L('Vou tentar abrir.', "I'll try to stretch it."),
    left_back_overlap:   L('Vou tentar subir.', "I'll try to push up."),
    default:             L('Vou tentar.', "I'll try."),
  },
  refuse: {
    default: L('Tá difícil agora...', "It's tough right now..."),
  },
  protest: {
    default: L('NÃO CONSIGO!', "I CAN'T!"),
  },
};

function getResponse(tier: FeedbackEntry['tier'], intent: VoiceIntent): string {
  return TIER_RESPONSES[tier]?.[intent] ?? TIER_RESPONSES[tier]?.default ?? OBEDIENCE_TIER_BUBBLE[tier];
}

const TIER_COLOR: Record<FeedbackEntry['tier'], string> = {
  critical_accept: '#FDE100',
  accept:          '#FDE100',
  weak_accept:     '#FF9F1C',
  refuse:          '#FF4D4D',
  protest:         '#FF4D4D',
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
            {posLabel(e.pos)} · {e.num}
          </div>
          <div style={{
            fontFamily: 'var(--font-serif-hero)',
            fontSize: 12,
            color: '#fff',
            lineHeight: 1.2,
            marginBottom: 4,
          }}>
            {e.playerName.split(' ')[0]}
          </div>
          <div style={{
            fontFamily: 'var(--font-serif-hero)',
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
