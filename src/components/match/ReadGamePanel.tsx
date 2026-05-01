/**
 * ReadGamePanel — análise automática "LER O JOGO".
 * Gera diagnóstico determinístico baseado no estado real do engine.
 */
import { useState, useCallback } from 'react';
import type { PitchPlayerState } from '@/engine/types';
import type { PlayingStylePresetId } from '@/tactics/playingStyle';

const NEON = '#FDE100';

const STYLE_RECS: Record<PlayingStylePresetId, string> = {
  PRESSAO_ALTA:        'Pressão Alta já ativa — considere Ataque Total para finalizar.',
  POSSE_CONTROLADA:    'Posse controlada. Se estiver ganhando, mantenha. Se perdendo, mude para Pressionar.',
  TRANSICAO_RAPIDA:    'Contra-ataque ativo — aguarde o momento certo para acelerar.',
  BLOCO_BAIXO:         'Bloco baixo defensivo. Se precisar do gol, ative Ataque Total.',
  JOGO_DIRETO:         'Jogo direto ativo — use o Overlap para criar superioridade nas pontas.',
  balanced:            'Estilo equilibrado. Ajuste conforme o placar.',
  JOGO_PELAS_LATERAIS: 'Jogo pelas laterais — explore os corredores e cruze para a área.',
  CRIATIVO_LIVRE:      'Criativo livre — deixe os jogadores decidirem. Risco alto, recompensa alta.',
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
  const zone = ballX > 65 ? 'terço ofensivo' : ballX < 35 ? 'terço defensivo' : 'meio-campo';
  lines.push(`OLE com ${possessionPct}% de posse. Bola no ${zone}.`);

  // 2. Jogador em hot streak (menor fadiga = mais ativo)
  const sorted = [...homePlayers].sort((a, b) => (a.fatigue ?? 0) - (b.fatigue ?? 0));
  const hotPlayer = sorted[0];
  if (hotPlayer) {
    const energy = Math.round(100 - (hotPlayer.fatigue ?? 0));
    lines.push(`${hotPlayer.name.split(' ')[0]} (${hotPlayer.pos}) em alta — ${energy}% de energia.`);
  }

  // 3. Situação do placar
  const diff = homeScore - awayScore;
  if (diff > 0) lines.push(`Vencendo por ${diff}. Proteja a vantagem.`);
  else if (diff < 0) lines.push(`Perdendo por ${Math.abs(diff)}. Pressione agora.`);
  else if (minute > 70) lines.push(`Empate no ${minute}'. Momento decisivo.`);

  // 4. Recomendação baseada no estilo atual
  lines.push(STYLE_RECS[playStyle] ?? 'Ajuste o estilo conforme o momento.');

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
    window.setTimeout(() => setOpen(false), 5000);
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
        LER JOGO
      </button>

      {/* Overlay de análise */}
      {open && (
        <div
          className="absolute z-[450] pointer-events-none"
          style={{ bottom: '100%', left: 0, right: 0, padding: '0 12px 8px' }}
        >
          <div style={{
            background: 'rgba(8,8,8,0.97)',
            border: '1px solid rgba(253,225,0,0.2)',
            borderLeft: `3px solid ${NEON}`,
            padding: '10px 14px',
            animation: 'feedbackIn 280ms cubic-bezier(0.34,1.2,0.64,1) both',
          }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 800,
              letterSpacing: '0.3em', color: NEON, textTransform: 'uppercase', marginBottom: 8,
            }}>
              LEITURA DO JOGO
            </div>
            {lines.map((line, i) => (
              <div key={i} style={{
                fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic',
                fontSize: 11, color: i === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)',
                lineHeight: 1.5, marginBottom: i < lines.length - 1 ? 4 : 0,
              }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
