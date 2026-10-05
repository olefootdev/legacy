/**
 * Cliente mínimo da Bot API do Telegram — fetch puro, sem dependência.
 *
 * Variáveis (Railway):
 *   TELEGRAM_BOT_TOKEN       — do @BotFather. Nunca no front, nunca no git.
 *   TELEGRAM_WEBHOOK_SECRET  — texto aleatório (≥ 32 chars). O Telegram manda
 *                              de volta no header X-Telegram-Bot-Api-Secret-Token;
 *                              sem ele qualquer um postaria "updates" falsos.
 *   TELEGRAM_CHAT_ID         — o grupo oficial (número negativo, ex.: -100…),
 *                              destino das postagens automáticas.
 *   OLEFOOT_TOKEN_CA         — endereço oficial do token. Vazio = "em breve".
 */

const BASE = 'https://api.telegram.org';

export const tokenDoBot = () => process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
export const segredoDoWebhook = () => process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
export const chatOficial = () => process.env.TELEGRAM_CHAT_ID?.trim() || null;
export const enderecoDoToken = () => process.env.OLEFOOT_TOKEN_CA?.trim() || null;

export interface RespostaTelegram<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
}

export async function chamarTelegram<T = unknown>(metodo: string, corpo: Record<string, unknown>): Promise<RespostaTelegram<T>> {
  const token = tokenDoBot();
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN ausente' };
  try {
    const r = await fetch(`${BASE}/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(10_000),
    });
    return (await r.json()) as RespostaTelegram<T>;
  } catch (e) {
    // A mensagem de erro do fetch pode trazer a URL — que tem o token. Nunca repassar.
    return { ok: false, description: e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'falha de rede' };
  }
}

export function enviarMensagem(chatId: string | number, html: string, extra: Record<string, unknown> = {}) {
  return chamarTelegram('sendMessage', {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...extra,
  });
}

/** O @ do bot, pra reconhecer "/comando@EsteBot" em grupo. Lido uma vez. */
let usuarioCache: string | null | undefined;
export async function usuarioDoBot(): Promise<string | null> {
  if (usuarioCache !== undefined) return usuarioCache;
  const r = await chamarTelegram<{ username?: string }>('getMe', {});
  usuarioCache = r.ok ? r.result?.username ?? null : null;
  return usuarioCache;
}
