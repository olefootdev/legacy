import { useState, useCallback, useEffect, useRef } from 'react';
import type { VoiceIntent } from '@/voiceCommand/types';
import { rollObedience } from '@/voiceCommand/obedienceRoll';
import type { PitchPlayerState } from '@/engine/types';

interface TeamSentimentGaugeProps {
  players: PitchPlayerState[];
  teamObedience?: number;
}

export function useTeamSentimentGauge(
  players: PitchPlayerState[],
  teamObedience = 30,
) {
  const [sentiment, setSentiment] = useState({
    complianceScore: 75, // % de aceitação (0-100)
    fatigueAvg: 25,      // fadiga média (0-100)
    morale: 70,          // moral do time (0-100)
    lastCommandIntent: null as VoiceIntent | null,
    pulseActive: false,  // animação de pulse ao comando
  });

  const push = useCallback((intent: VoiceIntent, targetPlayerIds?: string[]) => {
    const targets = targetPlayerIds?.length
      ? players.filter((p) => targetPlayerIds.includes(p.playerId))
      : players.slice(0, 5); // amostra de 5 pra cálculo

    // Rola obediência pra cada alvo
    const rolls = targets.map((p) =>
      rollObedience({
        intent,
        teamObedience,
        player: {
          role: p.role,
          slotId: p.slotId,
          fatigue: p.fatigue ?? 25,
          confianca: 70,
          tatico: 55,
        },
      }),
    );

    // Calcula compliance score (% que aceitou)
    const acceptCount = rolls.filter((r) => r.tier !== 'refuse' && r.tier !== 'protest').length;
    const complianceScore = Math.round((acceptCount / rolls.length) * 100);

    // Fadiga média da amostra
    const fatigueAvg = Math.round(targets.reduce((sum, p) => sum + (p.fatigue ?? 25), 0) / targets.length);

    // Morale: influenciado pelo compliance (se time não aceita, moral cai)
    const moraleDelta = complianceScore >= 70 ? 5 : complianceScore < 40 ? -10 : 0;

    setSentiment((prev) => ({
      complianceScore,
      fatigueAvg,
      morale: Math.max(20, Math.min(100, prev.morale + moraleDelta)),
      lastCommandIntent: intent,
      pulseActive: true,
    }));

    // Pulse animation por 400ms
    const t = setTimeout(() => {
      setSentiment((prev) => ({ ...prev, pulseActive: false }));
    }, 400);

    return () => clearTimeout(t);
  }, [players, teamObedience]);

  return { sentiment, push };
}

export function TeamSentimentGauge({ sentiment }: { sentiment: ReturnType<typeof useTeamSentimentGauge>['sentiment'] }) {
  const getComplianceColor = (score: number) => {
    if (score >= 70) return '#10b981'; // verde
    if (score >= 50) return '#f59e0b'; // amarelo
    return '#ef4444'; // vermelho
  };

  const getFatigueColor = (avg: number) => {
    if (avg < 40) return '#10b981'; // verde
    if (avg < 70) return '#f59e0b'; // amarelo
    return '#ef4444'; // vermelho
  };

  return (
    <div
      className="absolute bottom-2 left-2 z-[200]"
      style={{
        background: 'rgba(10,10,10,0.85)',
        border: '1px solid rgba(253,225,0,0.12)',
        borderRadius: 4,
        padding: '10px 12px',
        minWidth: 160,
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 8,
          letterSpacing: '0.25em',
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Time
      </div>

      {/* Compliance Score */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>Compliance</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: getComplianceColor(sentiment.complianceScore),
              animation: sentiment.pulseActive ? 'pulse 400ms ease-out' : 'none',
            }}
          >
            {sentiment.complianceScore}%
          </span>
        </div>
        {/* Barra visual */}
        <div
          style={{
            height: 4,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${sentiment.complianceScore}%`,
              background: getComplianceColor(sentiment.complianceScore),
              transition: 'width 400ms ease-out',
            }}
          />
        </div>
      </div>

      {/* Fatigue */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>Fadiga</span>
          <span style={{ fontSize: 10, color: getFatigueColor(sentiment.fatigueAvg) }}>
            {sentiment.fatigueAvg}
          </span>
        </div>
        <div
          style={{
            height: 3,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${sentiment.fatigueAvg}%`,
              background: getFatigueColor(sentiment.fatigueAvg),
              transition: 'width 600ms ease-out',
            }}
          />
        </div>
      </div>

      {/* Morale */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 9,
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Moral</span>
        <span style={{ color: '#FDE100', fontWeight: 700 }}>{sentiment.morale}</span>
      </div>
    </div>
  );
}
