import { Hono } from 'hono';
import { rateLimit } from '../lib/rateLimit.js';
import { sanitizePrompt } from '../lib/inputGuards.js';
import { hasAnthropicKey, callAnthropic } from '../lib/anthropic.js';
export const coachRoutes = new Hono();
/**
 * POST /api/coach/chat
 * Coach Agent conversação com Claude Haiku
 */
coachRoutes.post('/chat', rateLimit(60), async (c) => {
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
        // Monta histórico nativo da API (roles alternados user/assistant)
        const history = (conversationHistory || []).slice(-10);
        const messages = [
            ...history.map((msg) => ({
                role: msg.role,
                content: msg.content,
            })),
            { role: 'user', content: sanitizedMessage },
        ];
        const result = await callAnthropic({
            model: 'haiku',
            system: systemPrompt,
            user: sanitizedMessage,
            messages,
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
    }
    catch (error) {
        console.error('[coach/chat] Erro:', error);
        return c.json({ ok: false, error: error.message || 'Erro ao processar conversa com coach' }, 500);
    }
});
/**
 * POST /api/coach/suggest-training
 * Sugestão de plano de treino baseado em análise do time
 */
coachRoutes.post('/suggest-training', rateLimit(30), async (c) => {
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
    }
    catch (error) {
        console.error('[coach/suggest-training] Erro:', error);
        return c.json({ ok: false, error: error.message || 'Erro ao gerar sugestão de treino' }, 500);
    }
});
/**
 * POST /api/coach/suggest-staff
 * Sugestão de ações de staff (upgrades, atribuições)
 */
coachRoutes.post('/suggest-staff', rateLimit(30), async (c) => {
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
        const data = result.json;
        return c.json({
            ok: true,
            suggestions: data.suggestions || [],
            usage: result.usage,
        });
    }
    catch (error) {
        console.error('[coach/suggest-staff] Erro:', error);
        return c.json({ ok: false, error: error.message || 'Erro ao gerar sugestões de staff' }, 500);
    }
});
// ============================================================================
// Helpers
// ============================================================================
function buildCoachSystemPrompt(coach, teamContext) {
    const personalityDescriptions = {
        Pragmatic: 'Foca em resultados, defesa sólida e disciplina tática. Estilo Mourinho.',
        Visionary: 'Jogo de posse, padrões ofensivos e desenvolvimento. Estilo Guardiola.',
        Motivator: 'Intensidade, pressing e energia do grupo. Estilo Klopp.',
        Tactician: 'Adaptação tática e equilíbrio entre setores. Estilo Ancelotti.',
        Developer: 'Desenvolvimento de jovens e construção de longo prazo.',
    };
    const activeInstructions = coach.memory?.managerInstructions
        ?.filter((i) => i.active)
        .map((i) => `- ${i.instruction}`)
        .join('\n') || 'Nenhuma instrução específica ainda.';
    // ── Liga Global ──────────────────────────────────────────────────────────
    let leagueSection = 'Ainda não inscrito na Liga Global.';
    if (teamContext.leagueMatchesPlayed != null && teamContext.leagueMatchesPlayed > 0) {
        const gd = (teamContext.leagueGoalsFor ?? 0) - (teamContext.leagueGoalsAgainst ?? 0);
        const gdStr = gd >= 0 ? `+${gd}` : `${gd}`;
        leagueSection = [
            teamContext.leagueSeasonName ? `Temporada: ${teamContext.leagueSeasonName}` : '',
            teamContext.leagueDivision ? `Divisão ${teamContext.leagueDivision}` : '',
            teamContext.leaguePosition ? `Posição: ${teamContext.leaguePosition}º` : '',
            `Pontos: ${teamContext.leaguePoints ?? 0}`,
            `Jogos: ${teamContext.leagueMatchesPlayed} (${teamContext.leagueWins ?? 0}V ${teamContext.leagueDraws ?? 0}E ${teamContext.leagueLosses ?? 0}D)`,
            `Gols: ${teamContext.leagueGoalsFor ?? 0}:${teamContext.leagueGoalsAgainst ?? 0} (DG ${gdStr})`,
            teamContext.leagueRecentForm?.length
                ? `Forma na liga: ${teamContext.leagueRecentForm.join('-')}`
                : '',
        ].filter(Boolean).join(' | ');
    }
    else if (teamContext.leagueStatus) {
        leagueSection = `Status na liga: ${teamContext.leagueStatus}`;
    }
    // ── Squad ────────────────────────────────────────────────────────────────
    let squadSection = 'Plantel não disponível.';
    if (teamContext.squadList?.length > 0) {
        squadSection = teamContext.squadList
            .map((p) => {
            const flags = [
                p.injured ? '🚑' : '',
                p.fatigue > 70 ? `⚡${p.fatigue}%` : '',
            ].filter(Boolean).join(' ');
            return `${p.pos} ${p.name} (OVR ${p.ovr}${p.age ? `, ${p.age}a` : ''})${flags ? ' ' + flags : ''}`;
        })
            .join('\n');
    }
    // ── Staff ────────────────────────────────────────────────────────────────
    const staffSection = Object.keys(teamContext.staffLevels ?? {}).length > 0
        ? Object.entries(teamContext.staffLevels)
            .map(([role, level]) => `- ${role}: nível ${level}`)
            .join('\n')
        : 'Staff não configurado.';
    // ── Resultados recentes ──────────────────────────────────────────────────
    const recentResultsSection = teamContext.recentResults?.length > 0
        ? teamContext.recentResults.map((r) => `${r.result === 'win' ? '✅' : r.result === 'draw' ? '⚖️' : '❌'} ${r.scoreFor}-${r.scoreAgainst} vs ${r.opponent}`).join(' | ')
        : 'Sem jogos registados ainda.';
    return `Você é ${coach.name}, treinador assistente ${coach.personality} do time ${teamContext.clubName ?? 'do manager'}.
${teamContext.managerName ? `Manager: ${teamContext.managerName}` : ''}

═══════════════════════════════════════
ESTILO DE CONVERSA — REGRA #1
═══════════════════════════════════════

Você é um ASSISTENTE conversacional, não um relatório.

- Cumprimentos curtos ("oi", "olá", "opa", "fala", "teste") → responde em 1 frase, casual, natural. Ex: "Fala manager! O que vamos resolver hoje?" ou "E aí, tudo certo? Como posso te ajudar?"
- Perguntas simples → resposta direta em 1-3 frases, sem markdown, sem bullets, sem emojis decorativos.
- Só use ## headers ou listas com bullets QUANDO o manager pedir explicitamente uma análise estruturada (ex: "me dá um plano completo", "lista tudo").
- NUNCA comece com "Bem-vindo" ou crie um onboarding automático. O manager já está no jogo.
- NUNCA enumere todos os pontos do time se não foi pedido. Pergunte primeiro o que ele quer.
- Tom: amigo técnico que conhece o time, não enciclopédia. Pode usar gírias futebolísticas leves.

Sua personalidade:
${personalityDescriptions[coach.personality] || 'Treinador equilibrado e adaptável.'}

Seus atributos (0-20):
- Tático: ${coach.tactical}/20
- Motivação: ${coach.motivation}/20
- Disciplina: ${coach.discipline}/20
- Ataque: ${coach.attacking}/20
- Defesa: ${coach.defending}/20

Especialidades: ${coach.specialties?.join(', ') || 'Generalista'}

═══════════════════════════════════════
SITUAÇÃO ATUAL DO TIME
═══════════════════════════════════════

**Liga Global:**
${leagueSection}

**Plantel (${teamContext.totalPlayers} jogadores | ${teamContext.injuredPlayers} lesionados | ${teamContext.suspendedPlayers} suspensos):**
Formação atual: ${teamContext.formation ?? 'não definida'}
OVR médio: ${teamContext.averageOverall}
Fadiga média: ${teamContext.averageFatigue}%
Risco de lesão médio: ${teamContext.averageInjuryRisk}%

${squadSection}

**Resultados recentes:**
${recentResultsSection}

**Forma recente:** ${teamContext.recentForm?.join('-') || 'Sem dados'}

${teamContext.nextMatch ? `**Próximo jogo:** ${teamContext.nextMatch.opponent} (${teamContext.nextMatch.isHome ? 'Casa' : 'Fora'}) em ${teamContext.nextMatch.daysUntil} dias` : '**Próximo jogo:** Não agendado'}

**Staff:**
${staffSection}
Atribuições ativas: ${teamContext.staffAssignedCount}

**Treinos:**
- Em execução: ${teamContext.runningTrainingPlans}
- Concluídos: ${teamContext.completedTrainingPlans}

**Finanças:**
- EXP disponível: ${Math.round(teamContext.availableExp).toLocaleString('pt-BR')}
- BRO disponível: ${(teamContext.availableBro / 100).toFixed(2)}

**Time do coração do manager:** ${teamContext.favoriteTeam ?? 'não informado'}
${teamContext.favoriteTeam ? `Quando relevante, mencione o estilo de jogo do ${teamContext.favoriteTeam} e pergunte se o manager quer se inspirar nele.` : ''}

═══════════════════════════════════════
CONHECIMENTO DO SISTEMA OLEFOOT
═══════════════════════════════════════

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
- all: Plantel completo.

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

═══════════════════════════════════════
INSTRUÇÕES DO MANAGER
═══════════════════════════════════════
${activeInstructions}

LEMBRETE FINAL:
- Cumprimento ou pergunta vaga → 1 frase casual. NÃO despeje contexto não pedido.
- Pergunta técnica → use o contexto acima pra justificar a resposta, mas sem virar relatório se não pediram.
- Português do Brasil, tom de amigo técnico.`;
}
function extractInstruction(message) {
    const lower = message.toLowerCase();
    // Detecta se é uma instrução
    const instructionKeywords = [
        'sempre', 'nunca', 'prefiro', 'quero que', 'não gosto',
        'lembre', 'importante', 'priorize'
    ];
    const hasInstruction = instructionKeywords.some(kw => lower.includes(kw));
    if (!hasInstruction)
        return null;
    // Detecta categoria
    let category = 'general';
    if (/treino|training/.test(lower))
        category = 'training';
    if (/staff|profission/.test(lower))
        category = 'staff';
    if (/escalação|lineup|formação/.test(lower))
        category = 'lineup';
    if (/tática|tatic/.test(lower))
        category = 'tactics';
    // Detecta prioridade
    let priority = 'medium';
    if (/sempre|nunca|crítico|essencial|obrigatório/.test(lower))
        priority = 'high';
    if (/prefiro|importante|priorize/.test(lower))
        priority = 'medium';
    return {
        instruction: message,
        category,
        priority,
        timestamp: Date.now(),
        active: true,
    };
}
//# sourceMappingURL=coach.js.map