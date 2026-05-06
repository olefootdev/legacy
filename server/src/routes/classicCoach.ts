/**
 * POST /api/classic/coach-reading
 *
 * Análise tática inteligente para o modo CLASSIC. NÃO é chat — é uma
 * leitura proativa que aparece quando o Coach AI tem algo relevante a
 * dizer (manager toca no botão pra ver, ou ignora).
 *
 * Recebe snapshot da partida (placar, posse, fadigas críticas, último
 * evento, mentalidade ativa) e retorna 3 partes:
 *   - headline   (Moret italic — manchete editorial)
 *   - reading    (Inter — 1 frase descrevendo o estado atual)
 *   - suggestion (Agency uppercase — comando de ação curto)
 *
 * Usa Claude Haiku 4.5 — rápido (~700ms) e barato (~$0.0003 / leitura).
 */

import { Hono } from 'hono';
import { rateLimit } from '../lib/rateLimit.js';
import { hasAnthropicKey, callAnthropic } from '../lib/anthropic.js';

export const classicCoachRoutes = new Hono();

interface ClassicSnapshot {
  homeTeam: string;
  awayTeam: string;
  score: { home: number; away: number };
  minute: number;
  period: string;            // "1º TEMPO" / "2º TEMPO"
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  passStyle: 'TIKTAK' | 'LONGO' | 'LATERAL' | 'COUNTER';
  mentalidade: 'DEFENSIVO' | 'EQUILIBRADO' | 'OFENSIVO';
  activeSkills: string[];     // ['counter', 'press', ...]
  /** Top 3 jogadores do HOME por relevância (onFire, fadiga crítica, MVP, FSM engaged). */
  keyPlayers: Array<{
    name: string; role: string; archetype: string; ovr: number;
    fatigue: number; confidence: number;
    onFire?: boolean; isStar?: boolean;
    mental?: 'idle' | 'aware' | 'engaged' | 'anxious' | 'on_fire' | 'recovering';
  }>;
  /** Última ação relevante. */
  lastEvent?: { type: string; playerName?: string; minute: number };
  /** Eventos cumulativos: gols, viradas, momentos críticos. */
  storyBeats?: string[];
}

interface CoachReading {
  headline: string;
  reading: string;
  suggestion: string;
  tone: 'positive' | 'neutral' | 'urgent' | 'alert';
}

classicCoachRoutes.post('/coach-reading', rateLimit(60), async (c) => {
  if (!hasAnthropicKey()) {
    return c.json({ ok: false, error: 'ANTHROPIC_API_KEY em falta no servidor.' }, 503);
  }

  try {
    const snapshot = (await c.req.json()) as ClassicSnapshot;

    if (!snapshot.homeTeam || !snapshot.awayTeam || typeof snapshot.minute !== 'number') {
      return c.json({ ok: false, error: 'Snapshot inválido: campos obrigatórios em falta.' }, 400);
    }

    const systemPrompt = `Você é o COACH AI do OLEFOOT CLASSIC — um analista tático brasileiro com voz editorial: direto, técnico, com peso jornalístico (estilo The Athletic / FourFourTwo). Está observando uma partida em tempo real e tem ~3 segundos pra entregar uma LEITURA inteligente que ajude o manager a entender o jogo.

REGRAS:
- Você NUNCA conversa. Você OBSERVA, LÊ e SUGERE.
- Tom: 2ª pessoa do singular ("vês", "tens", "trocas"), brasileiro coloquial mas técnico.
- Use os arquétipos quando relevante (FINISHER, MAESTRO, HUNTER, etc).
- Use os tipos de passe quando relevante (TIKTAK = circulação curta; COUNTER = transição rápida; LATERAL = amplitude; LONGO = direto).
- Headline: 2-5 palavras, com peso emocional. Sem ponto final. Sem aspas.
- Reading: 1 frase de 8-15 palavras descrevendo o que vês AGORA.
- Suggestion: 2-4 palavras em UPPERCASE (comando de ação). Ex: "ATIVAR PRESSÃO ALTA", "TROCAR PRO COUNTER", "SEGURA O JOGO".
- Tone: "positive" (vencendo bem), "neutral" (estado normal), "urgent" (precisa agir), "alert" (perigo).

MEMÓRIA DA PARTIDA:
Quando o snapshot incluir "Momentos da partida", REFERENCIE pelo menos um deles na sua reading se for relevante. Exemplos esperados:
  - "Como falaste antes, a ala esquerda continua exposta"
  - "GOMES já marcou aos 23' — agora pode dobrar"
  - "Eles voltaram a pressionar como tinham feito no 1º tempo"
Trate o histórico como um técnico que LEMBRA o jogo, não como um robô que lê stats. Não cite TODOS os momentos — pega o mais relevante pra sustentar sua leitura.

ESTADO MENTAL DOS JOGADORES (FSM):
Tags como [ENGAGED], [ANXIOUS], [ON FIRE], [RECOVERING] indicam o momento mental do jogador. Use isso pra dar profundidade: jogador ANXIOUS está sob pressão (sugere passe rápido, troca, ou apoio). ENGAGED está dominando o jogo (deixa ele com a bola). ON FIRE é decisão de ataque. RECOVERING precisa de tempo. Cite na reading quando for relevante: "P. MORAES está engaged — bola passa por ele" ou "GOMES anxious depois de errar — precisa de apoio".

NÃO ESCREVA: chat, saudações, "Olá manager", explicações longas, markdown.
Responda APENAS o JSON.`;

    const userPrompt = `Estado da partida:
${snapshot.homeTeam} ${snapshot.score.home} - ${snapshot.score.away} ${snapshot.awayTeam} · ${snapshot.minute}' ${snapshot.period}

Posse: ${snapshot.possession.home}% · Chutes: ${snapshot.shots.home}/${snapshot.shots.away} (${snapshot.shotsOnTarget.home}/${snapshot.shotsOnTarget.away} no alvo)
Mentalidade ativa: ${snapshot.mentalidade} · Tipo de passe: ${snapshot.passStyle}
${snapshot.activeSkills.length > 0 ? `Skills ativas: ${snapshot.activeSkills.join(', ')}` : 'Nenhuma skill ativa'}

Jogadores-chave (HOME):
${snapshot.keyPlayers.map(p => {
  const mentalTag = p.mental && p.mental !== 'idle' && p.mental !== 'aware'
    ? ` [${p.mental.toUpperCase().replace('_', ' ')}]`
    : '';
  return `- ${p.name} (${p.role}, ${p.archetype}, OVR ${p.ovr}): fadiga ${p.fatigue}%, confiança ${p.confidence}%${p.onFire ? ' [ON FIRE]' : ''}${p.isStar ? ' [STAR]' : ''}${mentalTag}`;
}).join('\n')}

${snapshot.lastEvent ? `Última ação: ${snapshot.lastEvent.type}${snapshot.lastEvent.playerName ? ` por ${snapshot.lastEvent.playerName}` : ''} aos ${snapshot.lastEvent.minute}'` : ''}
${snapshot.storyBeats && snapshot.storyBeats.length > 0 ? `Momentos da partida (memória cumulativa, mais antigo → mais recente):\n${snapshot.storyBeats.map(b => `  • ${b}`).join('\n')}` : ''}

Lê a partida e devolve JSON:
{
  "headline": "...",
  "reading": "...",
  "suggestion": "...",
  "tone": "positive" | "neutral" | "urgent" | "alert"
}`;

    const result = await callAnthropic({
      model: 'haiku',
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 200,
      temperature: 0.55,
      expectJson: true,
    });

    if (!result.ok || !result.json) {
      return c.json({ ok: false, error: result.error || 'Resposta inválida do modelo' }, 500);
    }

    const reading = result.json as CoachReading;

    // Sanitização leve — garante shape válido
    if (!reading.headline || !reading.reading || !reading.suggestion) {
      return c.json({ ok: false, error: 'Reading incompleta do modelo' }, 502);
    }

    return c.json({
      ok: true,
      reading: {
        headline: String(reading.headline).slice(0, 60),
        reading: String(reading.reading).slice(0, 200),
        suggestion: String(reading.suggestion).slice(0, 40).toUpperCase(),
        tone: ['positive', 'neutral', 'urgent', 'alert'].includes(reading.tone) ? reading.tone : 'neutral',
      },
      usage: result.usage,
    });
  } catch (error: any) {
    console.error('[classic/coach-reading] Erro:', error);
    return c.json({ ok: false, error: error?.message || 'Erro ao gerar leitura tática' }, 500);
  }
});
