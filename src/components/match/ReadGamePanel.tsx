/**
 * ReadGamePanel — análise automática "LER O JOGO".
 * Gera diagnóstico determinístico baseado no estado real do engine.
 */
import { useState, useCallback } from 'react';
import type { PitchPlayerState } from '@/engine/types';
import type { PlayingStylePresetId } from '@/tactics/playingStyle';

import { L } from '@/i18n/L';
import { posLabel } from './posLabel';
const NEON = '#FDE100';

const STYLE_RECS: Record<PlayingStylePresetId, string> = {
  PRESSAO_ALTA:        L('Pressão Alta já ativa — considere Ataque Total para finalizar.', 'High press already on — consider All-out Attack to finish.'),
  POSSE_CONTROLADA:    L('Posse controlada. Se estiver ganhando, mantenha. Se perdendo, mude para Pressionar.', 'Controlled possession. Winning? Keep it. Losing? Switch to Press.'),
  TRANSICAO_RAPIDA:    L('Contra-ataque ativo — aguarde o momento certo para acelerar.', 'Counter on — wait for the right moment to speed up.'),
  BLOCO_BAIXO:         L('Bloco baixo defensivo. Se precisar do gol, ative Ataque Total.', 'Low defensive block. Need a goal? Go All-out Attack.'),
  JOGO_DIRETO:         L('Jogo direto ativo — use o Overlap para criar superioridade nas pontas.', 'Direct play on — use the Overlap to overload the flanks.'),
  balanced:            L('Estilo equilibrado. Ajuste conforme o placar.', 'Balanced style. Adjust to the score.'),
  JOGO_PELAS_LATERAIS: L('Jogo pelas laterais — explore os corredores e cruze para a área.', 'Wide play — use the flanks and cross into the box.'),
  CRIATIVO_LIVRE:      L('Criativo livre — deixe os jogadores decidirem. Risco alto, recompensa alta.', 'Free creative — let the players decide. High risk, high reward.'),
};

function generateAnalysis(
  possession: 'home' | 'away',
  ballX: number,
  homePlayers: PitchPlayerState[],
  events: Array<{ minute: number; text: string }>,
  playStyle: PlayingStylePresetId,
  homeScore: number,
  awayScore: number,
  minute: number,
): string[] {
  const lines: string[] = [];

  // 1. Diagnóstico de posse e zona
  const possessionPct = possession === 'home' ? 62 : 38;
  const zone = ballX > 65 ? L('terço ofensivo', 'final third') : ballX < 35 ? L('terço defensivo', 'defensive third') : L('meio-campo', 'midfield');
  lines.push(L(`OLE com ${possessionPct}% de posse. Bola no ${zone}.`, `OLE with ${possessionPct}% possession. Ball in the ${zone}.`));

  // 2. Jogador em hot streak (menor fadiga = mais ativo)
  const sorted = [...homePlayers].sort((a, b) => (a.fatigue ?? 0) - (b.fatigue ?? 0));
  const hotPlayer = sorted[0];
  if (hotPlayer) {
    const energy = Math.round(100 - (hotPlayer.fatigue ?? 0));
    lines.push(L(`${hotPlayer.name.split(' ')[0]} (${hotPlayer.pos}) em alta — ${energy}% de energia.`, `${hotPlayer.name.split(' ')[0]} (${posLabel(hotPlayer.pos)}) on form — ${energy}% energy.`));
  }

  // 3. Situação do placar
  const diff = homeScore - awayScore;
  if (diff > 0) lines.push(L(`Vencendo por ${diff}. Proteja a vantagem.`, `Up by ${diff}. Protect the lead.`));
  else if (diff < 0) lines.push(L(`Perdendo por ${Math.abs(diff)}. Pressione agora.`, `Down by ${Math.abs(diff)}. Press now.`));
  else if (minute > 70) lines.push(L(`Empate no ${minute}'. Momento decisivo.`, `Level at ${minute}'. Decisive moment.`));

  // 4. Recomendação baseada no estilo atual
  lines.push(STYLE_RECS[playStyle] ?? L('Ajuste o estilo conforme o momento.', 'Adjust the style to the moment.'));

  return lines;
}

interface ReadGamePanelProps {
  possession: 'home' | 'away';
  ballX: number;
  homePlayers: PitchPlayerState[];
  events: Array<{ minute: number; text: string }>;
  playStyle: PlayingStylePresetId;
  homeScore: number;
  awayScore: number;
  minute: number;
}

export function ReadGamePanel(props: ReadGamePanelProps) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([]);

  const handleOpen = useCallback(() => {
    const analysis = generateAnalysis(
      props.possession, props.ballX, props.homePlayers,
      props.events, props.playStyle, props.homeScore, props.awayScore, props.minute,
    );
    setLines(analysis);
    setOpen(true);
  }, [props]);

  return (
    <>
      {/* Botão */}
      <button
        type="button"
        onClick={handleOpen}
        style={{
          background: 'transparent',
          border: `1px solid rgba(253,225,0,0.2)`,
          color: 'rgba(253,225,0,0.6)',
          fontFamily: 'var(--font-display)',
          fontSize: 7, fontWeight: 800,
          letterSpacing: '0.2em', textTransform: 'uppercase',
          padding: '3px 8px', cursor: 'pointer',
          transition: 'all 150ms', flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(253,225,0,0.08)'; e.currentTarget.style.color = NEON; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(253,225,0,0.6)'; }}
      >
        {L('LER JOGO', 'READ GAME')}
      </button>

      {/* Banner horizontal — clique em qualquer parte para fechar */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          role="button"
          aria-label={L('Fechar leitura do jogo', 'Close game read')}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 450,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'flex-end',
            padding: '0 16px 120px',
          }}
        >
          <div
            style={{
              width: '100%',
              background: 'var(--color-panel)',
              border: '1px solid rgba(253,225,0,0.22)',
              borderLeft: `3px solid ${NEON}`,
              padding: '14px 18px 16px',
              animation: 'feedbackIn 280ms cubic-bezier(0.34,1.2,0.64,1) both',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800,
              letterSpacing: '0.32em', color: NEON, textTransform: 'uppercase', marginBottom: 10,
            }}>
              {L('Leitura do Jogo', 'Game Read')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {lines.map((line, i) => (
                <div key={i} style={{
                  fontFamily: 'var(--font-serif-hero)', 
                  fontSize: i === 0 ? 16 : 14,
                  color: i === 0 ? '#fff' : 'rgba(255,255,255,0.7)',
                  lineHeight: 1.35,
                  letterSpacing: '-0.01em',
                }}>
                  {line}
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 12,
              fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700,
              letterSpacing: '0.28em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
            }}>
              {L('Toque em qualquer lugar para fechar', 'Tap anywhere to close')}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
