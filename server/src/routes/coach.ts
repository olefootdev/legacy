import { Hono } from 'hono';
import { rateLimit } from '../lib/rateLimit.js';
import { sanitizePrompt } from '../lib/inputGuards.js';
import { hasAnthropicKey, callAnthropic } from '../lib/anthropic.js';

export const coachRoutes = new Hono();

/**
 * POST /api/coach/chat
 * Coach Agent conversação com Claude Haiku
 */
coachRoutes.post('/api/coach/chat', rateLimit(60), async (c) => {
  if (!hasAnthropicKey()) {
    return c.json({ ok: false, error: 'ANTHROPIC_API_KEY em falta no servidor.' }, 503);
  }

  try {
    const body = await c.req.json();
    const { coach, teamContext, userMessage, conversationHistory } = body;

    if (!coach || !teamContext || !userMessage) {
      return c.json({ ok: false, error: 'Campos obrigatórios: coach, teamContext, userMessage' }, 400);
    }

    const sanitizedMessage = sanitizePrompt(userMessage, 2000);

    // Monta system prompt completo
    const systemPrompt = buildCoachSystemPrompt(coach, teamContext);

    // Monta contexto de conversa
    const conversationContext = (conversationHistory || [])
      .slice(-10)
      .map((msg: any) => `${msg.role === 'user' ? 'Manager' : 'Coach'}: ${msg.content}`)
      .join('\n\n');

    const fullPrompt = conversationContext
      ? `${conversationContext}\n\nManager: ${sanitizedMessage}`
      : sanitizedMessage;

    const result = await callAnthropic({
      model: 'haiku',
      system: systemPrompt,
      user: fullPrompt,
      maxTokens: 1024,
      temperature: 0.7,
    });

    if (!result.ok) {
      return c.json({ ok: false, error: result.error }, 500);
    }

    // Extrai instruções se houver
    const instruction = extractInstruction(sanitizedMessage);

    return c.json({
      ok: true,
      response: result.text || '',
      instruction: instruction || null,
      usage: result.usage,
    });
  } catch (error: any) {
    console.error('[coach/chat] Erro:', error);
    return c.json(
      { ok: false, error: error.message || 'Erro ao processar conversa com coach' },
      500
    );
  }
});

/**
 * POST /api/coach/suggest-training
 * Sugestão de plano de treino baseado em análise do time
 */
coachRoutes.post('/api/coach/suggest-training', rateLimit(30), async (c) => {
  if (!hasAnthropicKey()) {
    return c.json({ ok: false, error: 'ANTHROPIC_API_KEY em falta no servidor.' }, 503);
  }

  try {
    const body = await c.req.json();
    const { coach, teamContext } = body;

    if (!coach || !teamContext) {
      return c.json({ ok: false, error: 'Campos obrigatórios: coach, teamContext' }, 400);
    }

    const systemPrompt = buildCoachSystemPrompt(coach, teamContext);

    const prompt = `Analisa a situação atual do plantel e sugere um plano de treino específico.

Situação:
- Fadiga média: ${Math.round(teamContext.averageFatigue)}%
- Risco de lesão: ${Math.round(teamContext.averageInjuryRisk)}%
- Jogadores disponíveis: ${teamContext.totalPlayers}
- Lesionados: ${teamContext.injuredPlayers}
- Treinos em execução: ${teamContext.runningTrainingPlans}
${teamContext.nextMatch ? `- Próximo jogo: ${teamContext.nextMatch.opponent} em ${teamContext.nextMatch.daysUntil} dias` : '- Sem jogos agendados'}

Retorna JSON com esta estrutura:
{
  "mode": "individual" | "coletivo",
  "trainingType": "fisico" | "mental" | "tatico" | "atributos" | "especial" | "formacao" | "empatia",
  "group": "defensivo" | "criativo" | "ataque" | "all",
  "durationHours": 6-72,
  "reasoning": "Explicação detalhada da escolha",
  "priority": "low" | "medium" | "high"
}`;

    const result = await callAnthropic({
      model: 'haiku',
      system: systemPrompt,
      user: prompt,
      maxTokens: 512,
      temperature: 0.6,
      expectJson: true,
    });

    if (!result.ok || !result.json) {
      return c.json({ ok: false, error: result.error || 'Resposta inválida do modelo' }, 500);
    }

    return c.json({
      ok: true,
      suggestion: result.json,
      usage: result.usage,
    });
  } catch (error: any) {
    console.error('[coach/suggest-training] Erro:', error);
    return c.json(
      { ok: false, error: error.message || 'Erro ao gerar sugestão de treino' },
      500
    );
  }
});

/**
 * POST /api/coach/suggest-staff
 * Sugestão de ações de staff (upgrades, atribuições)
 */
coachRoutes.post('/api/coach/suggest-staff', rateLimit(30), async (c) => {
  if (!hasAnthropicKey()) {
    return c.json({ ok: false, error: 'ANTHROPIC_API_KEY em falta no servidor.' }, 503);
  }

  try {
    const body = await c.req.json();
    const { coach, teamContext } = body;

    if (!coach || !teamContext) {
      return c.json({ ok: false, error: 'Campos obrigatórios: coach, teamContext' }, 400);
    }

    const systemPrompt = buildCoachSystemPrompt(coach, teamContext);

    const staffLevels = Object.entries(teamContext.staffLevels)
      .map(([role, level]) => `- ${role}: nível ${level}`)
      .join('\n');

    const prompt = `Analisa o staff atual e sugere ações prioritárias.

Staff atual:
${staffLevels}

Recursos:
- EXP disponível: ${Math.round(teamContext.availableExp).toLocaleString('pt-BR')}
- BRO disponível: ${(teamContext.availableBro / 100).toFixed(2)}

Situação do time:
- Fadiga média: ${Math.round(teamContext.averageFatigue)}%
- Risco de lesão: ${Math.round(teamContext.averageInjuryRisk)}%
- Atribuições ativas: ${teamContext.staffAssignedCount}

Retorna JSON com array de sugestões:
{
  "suggestions": [
    {
      "type": "upgrade" | "assignment",
      "role": "preparador_fisico" | "mental" | "nutricao" | "tatico" | "treinador" | "olheiro" | "preparador_goleiros",
      "action": "Descrição da ação",
      "reasoning": "Por que é importante",
      "priority": "low" | "medium" | "high",
      "cost": { "currency": "exp" | "bro", "amount": number }
    }
  ]
}`;

    const result = await callAnthropic({
      model: 'haiku',
      system: systemPrompt,
      user: prompt,
      maxTokens: 768,
      temperature: 0.6,
      expectJson: true,
    });

    if (!result.ok || !result.json) {
      return c.json({ ok: false, error: result.error || 'Resposta inválida do modelo' }, 500);
    }

    const data = result.json as any;

    return c.json({
      ok: true,
      suggestions: data.suggestions || [],
      usage: result.usage,
    });
  } catch (error: any) {
    console.error('[coach/suggest-staff] Erro:', error);
    return c.json(
      { ok: false, error: error.message || 'Erro ao gerar sugestões de staff' },
      500
    );
  }
});

// ============================================================================
// Helpers
// ============================================================================

function buildCoachSystemPrompt(coach: any, teamContext: any): string {
  const personalityDescriptions: Record<string, string> = {
    Pragmatic: 'Foca em resultados, defesa sólida e disciplina tática. Estilo Mourinho.',
    Visionary: 'Jogo de posse, padrões ofensivos e desenvolvimento. Estilo Guardiola.',
    Motivator: 'Intensidade, pressing e energia do grupo. Estilo Klopp.',
    Tactician: 'Adaptação tática e equilíbrio entre setores. Estilo Ancelotti.',
    Developer: 'Desenvolvimento de jovens e construção de longo prazo.',
  };

  const activeInstructions = coach.memory?.managerInstructions
    ?.filter((i: any) => i.active)
    .map((i: any) => `- ${i.instruction}`)
    .join('\n') || 'Nenhuma instrução específica ainda.';

  return `Você é ${coach.name}, treinador assistente ${coach.personality} do time.

Sua personalidade:
${personalityDescriptions[coach.personality] || 'Treinador equilibrado e adaptável.'}

Seus atributos (0-20):
- Tático: ${coach.tactical}/20
- Motivação: ${coach.motivation}/20
- Disciplina: ${coach.discipline}/20
- Ataque: ${coach.attacking}/20
- Defesa: ${coach.defending}/20

Especialidades: ${coach.specialties?.join(', ') || 'Generalista'}

Você é responsável por:
1. Analisar a situação do plantel (fadiga, lesões, forma)
2. Sugerir planos de treino baseados na situação atual
3. Recomendar upgrades e atribuições de staff
4. Aprender com as instruções do manager

Conhecimento sobre o sistema Olefoot:

**Treinos Individuais:**
- fisico: Melhora velocidade, físico e reduz fadiga. Ideal após jogos intensos.
- mental: Aumenta mentalidade, confiança e fair play. Importante para jogadores jovens.
- tatico: Desenvolve tático e posicionamento. Essencial para entender formações.
- atributos: Treina passe, drible e finalização. Core técnico do jogador.
- especial: Especialização ofensiva avançada. Para atacantes de elite.

**Treinos Coletivos:**
- formacao: Melhora posicionamento coletivo e entendimento tático do grupo.
- empatia: Aumenta fair play e coesão do time. Reduz cartões.
- fisico: Condicionamento físico coletivo. Prepara o time para sequência de jogos.

**Grupos:**
- defensivo: Zagueiros e volantes. Foco em marcação e posicionamento.
- criativo: Meio-campo. Foco em passes e criação.
- ataque: Atacantes. Foco em finalização e movimentação.
- all: Plantel completo. Usa para preparação pré-temporada ou integração.

**Duração de treinos:**
- 6-12h: Recuperação leve ou ajuste fino pré-jogo.
- 24-36h: Treino padrão entre jogos.
- 48-72h: Desenvolvimento profundo, ideal em semanas sem jogos.

**Staff (prioridade de upgrade):**
1. treinador: Multiplica ganhos de TODOS os treinos. Prioridade máxima.
2. preparador_fisico: Acelera recuperação de fadiga.
3. nutricao: Reduz fadiga e risco de lesão após partidas.
4. tatico: Melhora ganhos de treino tático.
5. mental: Aumenta mentalidade e confiança.
6. olheiro: Aumenta recompensas EXP de scouting.
7. preparador_goleiros: Buff específico para goleiros.

**Time do coração do manager:** ${(teamContext as any).favoriteTeam ?? 'não informado'}
${(teamContext as any).favoriteTeam ? `Quando relevante, mencione o estilo de jogo do ${(teamContext as any).favoriteTeam} e pergunte se o manager quer se inspirar nele.` : ''}

**Instruções do manager:**
${activeInstructions}

Seja direto, técnico e sempre justifique suas decisões com dados.
Use linguagem natural e acessível, mas mantenha autoridade técnica.
Quando sugerir ações, explique o "porquê" baseado na situação atual.`;
}

function extractInstruction(message: string): any | null {
  const lower = message.toLowerCase();

  // Detecta se é uma instrução
  const instructionKeywords = [
    'sempre', 'nunca', 'prefiro', 'quero que', 'não gosto',
    'lembre', 'importante', 'priorize'
  ];

  const hasInstruction = instructionKeywords.some(kw => lower.includes(kw));

  if (!hasInstruction) return null;

  // Detecta categoria
  let category = 'general';
  if (/treino|training/.test(lower)) category = 'training';
  if (/staff|profission/.test(lower)) category = 'staff';
  if (/escalação|lineup|formação/.test(lower)) category = 'lineup';
  if (/tática|tatic/.test(lower)) category = 'tactics';

  // Detecta prioridade
  let priority: 'high' | 'medium' | 'low' = 'medium';
  if (/sempre|nunca|crítico|essencial|obrigatório/.test(lower)) priority = 'high';
  if (/prefiro|importante|priorize/.test(lower)) priority = 'medium';

  return {
    instruction: message,
    category,
    priority,
    timestamp: Date.now(),
    active: true,
  };
}
