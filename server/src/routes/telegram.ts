import { Hono } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import { requireAdminToken } from '../lib/adminAuth.js';
import {
  chamarTelegram, chatOficial, enviarMensagem, segredoDoWebhook, tokenDoBot, usuarioDoBot,
} from '../lib/telegram/api.js';
import { lerComando } from '../lib/telegram/conteudo.js';
import { respostaPara } from '../lib/telegram/responder.js';
import { rodarAgenda } from '../lib/telegram/agenda.js';

/**
 * Bot do Telegram da OLEFOOT.
 *
 *   POST /api/telegram/webhook          — o Telegram chama (segredo no header)
 *   POST /api/admin/telegram/configurar — registra webhook + menu de comandos
 *   POST /api/admin/telegram/postar     — dispara a agenda agora (teste)
 *
 * O webhook é montado ANTES do csrfGuard (como o /api/csp-report): quem chama
 * é o servidor do Telegram, sem Origin. A autenticação é o segredo.
 */
export const telegramWebhookRoutes = new Hono();
export const telegramAdminRoutes = new Hono();

function segredoConfere(recebido: string | undefined): boolean {
  const esperado = segredoDoWebhook();
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface Update {
  message?: { text?: string; chat?: { id?: number; type?: string } };
}

telegramWebhookRoutes.post('/api/telegram/webhook', async (c) => {
  if (!tokenDoBot()) return c.json({ ok: false }, 503);
  // Segredo errado: 401 sem detalhe. Não loga o header — é a credencial.
  if (!segredoConfere(c.req.header('X-Telegram-Bot-Api-Secret-Token'))) return c.json({ ok: false }, 401);

  let u: Update;
  try { u = (await c.req.json()) as Update; } catch { return c.json({ ok: true }); }
  const chatId = u.message?.chat?.id;
  const cmd = lerComando(u.message?.text, await usuarioDoBot());
  // Sempre 200 pro Telegram: erro aqui faria ele reentregar o mesmo update em loop.
  if (chatId == null || !cmd) return c.json({ ok: true });

  try {
    const texto = await respostaPara(cmd.comando, cmd.arg, chatId);
    if (texto) await enviarMensagem(chatId, texto);
  } catch (e) {
    console.error('[telegram] webhook', e instanceof Error ? e.message : e);
  }
  return c.json({ ok: true });
});

telegramAdminRoutes.use('/telegram/*', async (c, next) => {
  const err = await requireAdminToken(c);
  if (err) return err;
  await next();
});

/** Menu "/" em inglês. Os apelidos em português (/jogar, /mercado, /ajuda) continuam respondendo. */
const COMANDOS = [
  { command: 'play', description: 'Jump into the game' },
  { command: 'ranking', description: 'Global League top 10' },
  { command: 'market', description: 'Biggest risers today' },
  { command: 'mvp', description: "Today's MVP" },
  { command: 'token', description: 'Official address and real links' },
  { command: 'help', description: 'List of commands' },
];

/** Registra o webhook (apontando pra `origem`) e o menu "/" do Telegram. */
export async function configurarWebhook(origem: string) {
  if (!tokenDoBot()) return { ok: false, erro: 'TELEGRAM_BOT_TOKEN ausente no Railway' };
  const segredo = segredoDoWebhook();
  if (!segredo || segredo.length < 32) return { ok: false, erro: 'TELEGRAM_WEBHOOK_SECRET ausente ou curto (mínimo 32)' };
  const url = `${origem.replace(/\/+$/, '')}/api/telegram/webhook`;
  const webhook = await chamarTelegram('setWebhook', {
    url, secret_token: segredo, allowed_updates: ['message'], drop_pending_updates: true,
  });
  const menu = await chamarTelegram('setMyCommands', { commands: COMANDOS });
  const info = await chamarTelegram<{ url?: string; last_error_message?: string }>('getWebhookInfo', {});
  return {
    ok: webhook.ok && menu.ok,
    webhook: webhook.ok ? 'registrado' : webhook.description,
    menu: menu.ok ? 'registrado' : menu.description,
    url: info.result?.url ?? null,
    erroRecente: info.result?.last_error_message ?? null,
    bot: await usuarioDoBot(),
    grupoOficial: chatOficial() ? 'configurado' : 'falta TELEGRAM_CHAT_ID (rode /id no grupo)',
  };
}

/**
 * No boot: com TELEGRAM_WEBHOOK_URL definida, o servidor se registra sozinho —
 * o fundador só põe as variáveis no Railway, sem chamar rota nenhuma.
 */
export async function configurarNoBoot(): Promise<void> {
  const origem = process.env.TELEGRAM_WEBHOOK_URL?.trim();
  if (!origem || !tokenDoBot()) return;
  const r = await configurarWebhook(origem);
  console.log('[telegram] boot:', r.ok ? `webhook ok (@${r.bot ?? '?'})` : r.erro ?? r.webhook ?? r.menu);
}

/** Mesmo registro, sob demanda. A URL sai do pedido (o domínio do Railway) se a env não existir. */
telegramAdminRoutes.post('/telegram/configurar', async (c) => {
  const origem = process.env.TELEGRAM_WEBHOOK_URL?.trim() || new URL(c.req.url).origin.replace(/^http:/, 'https:');
  const r = await configurarWebhook(origem);
  return c.json(r, r.ok || !('erro' in r) ? 200 : 400);
});

/** Roda a agenda agora — só posta o que estiver no horário e ainda não saiu hoje. */
telegramAdminRoutes.post('/telegram/postar', async (c) => {
  const feitas = await rodarAgenda();
  return c.json({ ok: true, postadas: feitas });
});
