import { Hono } from 'hono';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export const gameSpiritRoutes = new Hono();

gameSpiritRoutes.get('/api/game-spirit/status', (c) => {
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  return c.json({
    ok: true,
    openaiConfigured,
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  });
});

type TeachKind = 'narrative' | 'tactical' | 'position';

type TeachBody = {
  kind?: TeachKind;
  userMessage?: string;
  contextJson?: string;
};

gameSpiritRoutes.post('/api/game-spirit/teach', async (c) => {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return c.json({ ok: false, error: 'OPENAI_API_KEY em falta no servidor (.env do olefoot-server).' }, 503);
  }

  let body: TeachBody;
  try {
    body = (await c.req.json()) as TeachBody;
  } catch {
    return c.json({ ok: false, error: 'JSON inválido.' }, 400);
  }

  const rawKind = body.kind ?? 'narrative';
  const kind: TeachKind =
    rawKind === 'tactical' || rawKind === 'position' || rawKind === 'narrative' ? rawKind : 'narrative';
  const userMessage = (body.userMessage ?? '').trim();
  if (userMessage.length < 8) {
    return c.json({ ok: false, error: 'Mensagem demasiado curta (mín. 8 caracteres).' }, 400);
  }

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  const systemByKind: Record<TeachKind, string> = {
    narrative: `És um editor técnico do OLEFOOT GameSpirit. O utilizador ensina estilo de narração ou exemplos de frases.
Responde APENAS com um único objeto JSON válido (sem markdown), formato:
{"title": string, "bucket": string, "lines": string[], "notes": string}
- lines: 3 a 12 frases, uma por entrada, estilo transmissão PT, placeholders {name} e {away} quando fizer sentido.
- bucket: etiqueta curta ex: dribble, cross, press, custom.`,
    tactical: `És um analista tático do OLEFOOT. O utilizador descreve um padrão ou ideia.
Responde APENAS JSON válido:
{"name": string, "intentTag": string, "notes": string}
intentTag: uma etiqueta curta (ex: press_high, build_up, counter) ou texto livre.`,
    position: `És um treinador do OLEFOOT. O utilizador descreve uma posição e responsabilidades.
Responde APENAS JSON válido:
{"code": string, "label": string, "zone": "gk"|"def"|"mid"|"att"|"wide", "x01": number, "y01": number, "mainActivities": string[], "coachingNotes": string}
x01,y01 entre 0 e 1 (posição aproximada no campo 105x68, origem canto superior esquerdo).`,
  };

  const system = systemByKind[kind];
  const ctx = body.contextJson?.trim()
    ? `\nContexto já existente (JSON, não alteres salvo pedido):\n${body.contextJson.slice(0, 12000)}`
    : '';

  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `${userMessage}${ctx}` },
        ],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return c.json(
        { ok: false, error: `OpenAI HTTP ${r.status}: ${errText.slice(0, 400)}` },
        502,
      );
    }

    const raw = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = raw.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) {
      return c.json({ ok: false, error: 'Resposta vazia da OpenAI.' }, 502);
    }

    let data: unknown;
    try {
      data = JSON.parse(content) as unknown;
    } catch {
      return c.json(
        { ok: false, error: 'Modelo não devolveu JSON parseável.', rawAssistant: content },
        502,
      );
    }

    return c.json({ ok: true, data, rawAssistant: content });
  } catch (e) {
    return c.json(
      { ok: false, error: e instanceof Error ? e.message : 'Falha de rede para OpenAI.' },
      502,
    );
  }
});
