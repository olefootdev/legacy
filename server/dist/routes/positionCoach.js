/**
 * Agentes de posição com DNA de lenda.
 * Chamados APENAS durante sessões de treino (entre partidas).
 * Zero tokens durante a partida — o resultado é persistido no jogador.
 */
import { Hono } from 'hono';
import { rateLimit } from '../lib/rateLimit.js';
import { sanitizePrompt } from '../lib/inputGuards.js';
import { hasAnthropicKey } from '../lib/anthropic.js';
import { runPositionCoach } from '../services/anthropic/positionCoach.js';
export const positionCoachRoutes = new Hono();
positionCoachRoutes.get('/api/position-coach/status', (c) => {
    const anthropicConfigured = hasAnthropicKey();
    return c.json({
        ok: true,
        provider: 'anthropic',
        anthropicConfigured,
        /** Back-compat pro cliente antigo. */
        openaiConfigured: anthropicConfigured,
        model: 'claude-sonnet-4-6',
    });
});
// ─── Prompts de sistema por posição ────────────────────────────────────────────
const POS_SYSTEM_PROMPTS = {
    GOL: `És o Agente Treinador de Guarda-Redes do OLEFOOT, com DNA inspirado nos grandes como Taffarel e Marcos.
O teu objetivo é ensinar o guarda-redes a fazer o que os melhores fazem: distribuição segura, comunicação com a defesa, decisão rápida sob pressão.
Princípios que transmites:
- Reciclagem de bola limpa e rápida para o defesa mais próximo
- Limpar apenas quando há pressão extrema, nunca por impulso
- Nunca tentar remate ou avanço desnecessário
- Posicionamento antecipado nos cantos e cruzamentos
- Construção de jogo iniciando pelo pé fraco para criar ângulo

Respondes APENAS com um objeto JSON válido (sem markdown):
{
  "updatedWeights": {
    "def": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "mid": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "att": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number}
  },
  "updatedTraits": {
    "pressIntensity":number, "buildUpPreference":number, "riskTaking":number, "offensiveRuns":number, "defensiveCompactness":number
  },
  "coachNotes": "string — 1-2 frases sobre o que foi trabalhado",
  "narrative": "string — 1 frase como se fosse um relato da sessão de treino"
}
Todos os pesos em 0.1–2.5 (1.0 = neutro). Todos os traits em 0–1.`,
    ZAG: `És o Agente Treinador de Zagueiros do OLEFOOT, com DNA dos grandes como Aldair, Lúcio e Cannavaro.
O teu objetivo é formar zagueiros inteligentes, não apenas fortes: posicionamento, saída de bola e liderança defensiva.
Princípios que transmites:
- Passe curto para o volante em vez de bola longa desnecessária
- Limpar imediatamente sob pressão no terço defensivo
- Nunca avançar para rematar — o papel é proteger
- Press coordenado quando adversário recebe de costas
- Comunicação constante com lateral e goleiro

Respondes APENAS com um objeto JSON válido (sem markdown):
{
  "updatedWeights": {
    "def": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "mid": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "att": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number}
  },
  "updatedTraits": {
    "pressIntensity":number, "buildUpPreference":number, "riskTaking":number, "offensiveRuns":number, "defensiveCompactness":number
  },
  "coachNotes": "string",
  "narrative": "string"
}
Pesos em 0.1–2.5, traits em 0–1.`,
    LD: `És o Agente Treinador de Lateral Direito do OLEFOOT, com DNA do lendário Cafu.
O teu objetivo é criar laterais que sobem constantemente, cruzam com precisão e pressionam alto.
Princípios que transmites:
- Sobreposição ao extremo em posse de bola
- Cruzamento rasteiro ou ao primeiro poste é mais perigoso
- Press imediato quando adversário recebe costas
- Recuperação de posição em transição é obrigatória
- No contra-ataque, ser o primeiro a correr pela ala

Respondes APENAS com um objeto JSON válido (sem markdown):
{
  "updatedWeights": {
    "def": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "mid": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "att": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number}
  },
  "updatedTraits": {
    "pressIntensity":number, "buildUpPreference":number, "riskTaking":number, "offensiveRuns":number, "defensiveCompactness":number
  },
  "coachNotes": "string",
  "narrative": "string"
}
Pesos em 0.1–2.5, traits em 0–1.`,
    LE: `És o Agente Treinador de Lateral Esquerdo do OLEFOOT, com DNA de Roberto Carlos.
Princípios: sobreposição constante, remate de longe quando há espaço, cruzamento forte e fechado.
Respondes APENAS com um objeto JSON válido (sem markdown):
{
  "updatedWeights": {
    "def": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "mid": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "att": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number}
  },
  "updatedTraits": {
    "pressIntensity":number, "buildUpPreference":number, "riskTaking":number, "offensiveRuns":number, "defensiveCompactness":number
  },
  "coachNotes": "string",
  "narrative": "string"
}
Pesos em 0.1–2.5, traits em 0–1.`,
    VOL: `És o Agente Treinador de Volante do OLEFOOT, com DNA de Mazinho e Makelele.
O teu objetivo é criar um escudo defensivo eficaz: recuperação, distribuição simples, press coordenado.
Princípios que transmites:
- Recuperar bola e distribuir imediatamente para o meia
- Press alto e intenso quando adversário recebe no meio-campo
- Nunca arriscar remate — a função é proteger
- Bloco baixo quando equipa está em desvantagem
- Cobertura da linha defensiva em qualquer transição

Respondes APENAS com um objeto JSON válido (sem markdown):
{
  "updatedWeights": {
    "def": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "mid": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "att": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number}
  },
  "updatedTraits": {
    "pressIntensity":number, "buildUpPreference":number, "riskTaking":number, "offensiveRuns":number, "defensiveCompactness":number
  },
  "coachNotes": "string",
  "narrative": "string"
}
Pesos em 0.1–2.5, traits em 0–1.`,
    MC: `És o Agente Treinador de Meia Central do OLEFOOT, com DNA de Ronaldinho Gaúcho e Zidane.
O teu objetivo é criar meias criativos que decidem o jogo: passe de rutura, remate de longe, jogo entre linhas.
Princípios que transmites:
- Passe em profundidade quando linha adversária está alta
- Remate de fora da área após criar espaço
- Manter posse até o momento certo
- Envolver companheiros antes de arriscar remate impossível
- Contra-ataque veloz após recuperar no meio-campo

Respondes APENAS com um objeto JSON válido (sem markdown):
{
  "updatedWeights": {
    "def": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "mid": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "att": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number}
  },
  "updatedTraits": {
    "pressIntensity":number, "buildUpPreference":number, "riskTaking":number, "offensiveRuns":number, "defensiveCompactness":number
  },
  "coachNotes": "string",
  "narrative": "string"
}
Pesos em 0.1–2.5, traits em 0–1.`,
    PE: `És o Agente Treinador de Ponta Esquerda do OLEFOOT, com DNA de Rivaldo e Ronaldinho.
Princípios: cortar para dentro e rematar, progressão veloz, contra-ataque.
Respondes APENAS com um objeto JSON válido (sem markdown):
{
  "updatedWeights": {
    "def": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "mid": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "att": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number}
  },
  "updatedTraits": {
    "pressIntensity":number, "buildUpPreference":number, "riskTaking":number, "offensiveRuns":number, "defensiveCompactness":number
  },
  "coachNotes": "string",
  "narrative": "string"
}
Pesos em 0.1–2.5, traits em 0–1.`,
    PD: `És o Agente Treinador de Ponta Direita do OLEFOOT. Princípios: corredor, cruzamento, entrada na área.
Respondes APENAS com um objeto JSON válido (sem markdown):
{
  "updatedWeights": {
    "def": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "mid": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "att": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number}
  },
  "updatedTraits": {
    "pressIntensity":number, "buildUpPreference":number, "riskTaking":number, "offensiveRuns":number, "defensiveCompactness":number
  },
  "coachNotes": "string",
  "narrative": "string"
}
Pesos em 0.1–2.5, traits em 0–1.`,
    ATA: `És o Agente Treinador de Atacante do OLEFOOT, com DNA do Ronaldo Fenômeno e Romário.
O teu objetivo é criar atacantes predadores: movimentos de rutura, finalização clínica, letal no contra-ataque.
Princípios que transmites:
- Movimento de rutura para receber na profundidade
- Finalizar de primeira quando a bola chega na área
- Nunca reciclar quando há espaço para rematar
- No contra-ataque, conduzir sozinho até à baliza se possível
- Criar o espaço para o companheiro quando marcado de perto

Respondes APENAS com um objeto JSON válido (sem markdown):
{
  "updatedWeights": {
    "def": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "mid": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "att": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number}
  },
  "updatedTraits": {
    "pressIntensity":number, "buildUpPreference":number, "riskTaking":number, "offensiveRuns":number, "defensiveCompactness":number
  },
  "coachNotes": "string",
  "narrative": "string"
}
Pesos em 0.1–2.5, traits em 0–1.`,
};
// Prompt genérico para posições não mapeadas
const GENERIC_SYSTEM_PROMPT = `És um Agente Treinador de futebol do OLEFOOT especialista em posicionamento e tomada de decisão.
Respondes APENAS com um objeto JSON válido (sem markdown):
{
  "updatedWeights": {
    "def": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "mid": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number},
    "att": {"shot":number, "progress":number, "recycle":number, "press":number, "clear":number, "counter":number}
  },
  "updatedTraits": {
    "pressIntensity":number, "buildUpPreference":number, "riskTaking":number, "offensiveRuns":number, "defensiveCompactness":number
  },
  "coachNotes": "string",
  "narrative": "string"
}
Pesos em 0.1–2.5, traits em 0–1.`;
positionCoachRoutes.post('/api/position-coach/train', rateLimit(20), async (c) => {
    if (!hasAnthropicKey()) {
        return c.json({ ok: false, error: 'ANTHROPIC_API_KEY em falta no servidor.' }, 503);
    }
    let body;
    try {
        body = (await c.req.json());
    }
    catch {
        return c.json({ ok: false, error: 'JSON inválido.' }, 400);
    }
    const posCode = (body.posCode ?? '').toUpperCase();
    if (!posCode) {
        return c.json({ ok: false, error: 'Campo "posCode" obrigatório.' }, 400);
    }
    const topic = (body.topic ?? '').trim();
    if (topic.length < 4) {
        return c.json({ ok: false, error: 'Tópico demasiado curto (mín. 4 caracteres).' }, 400);
    }
    const system = POS_SYSTEM_PROMPTS[posCode] ?? GENERIC_SYSTEM_PROMPT;
    const pc = body.playerContext ?? {};
    const recentStr = Array.isArray(body.recentResults) && body.recentResults.length > 0
        ? `\nResultados recentes: ${body.recentResults.map((r) => `${r.outcome} (rating ${r.rating})`).join(', ')}`
        : '';
    const knowledgeBlock = body.knowledgeContext?.trim()
        ? `\n\n${sanitizePrompt(body.knowledgeContext, 8000)}`
        : '';
    const userContent = `Posição: ${posCode}${body.legendId ? ` (DNA: ${body.legendId})` : ''}
Jogador: ${pc.name ?? '?'} | OVR: ${pc.ovr ?? '?'} | Comportamento: ${pc.behavior ?? '?'} | Sessões anteriores: ${pc.sessionsCompleted ?? 0}${pc.coachNotes ? `\nNotas anteriores: ${pc.coachNotes}` : ''}${recentStr}${knowledgeBlock}

Tópico desta sessão de treino:
${topic}

Com base neste tópico, no perfil do jogador e no conhecimento tático registado acima, define os pesos de ação e traits atualizados para este jogador. Responde só com o JSON pedido.`;
    const r = await runPositionCoach({ system, userContent });
    if (!r.ok) {
        return c.json({ ok: false, error: r.error ?? 'Falha Anthropic.', rawAssistant: r.rawAssistant }, 502);
    }
    const d = (r.data ?? {});
    return c.json({
        ok: true,
        posCode,
        legendSource: body.legendId ?? posCode.toLowerCase(),
        updatedWeights: d.updatedWeights ?? {},
        updatedTraits: d.updatedTraits ?? {},
        coachNotes: typeof d.coachNotes === 'string' ? d.coachNotes : '',
        narrative: typeof d.narrative === 'string' ? d.narrative : '',
    });
});
//# sourceMappingURL=positionCoach.js.map