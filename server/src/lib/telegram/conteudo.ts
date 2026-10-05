/**
 * O que o bot do Telegram diz — funções PURAS (dado entra, HTML sai).
 *
 * Separado de quem busca o dado (`dados.ts`) e de quem fala com o Telegram
 * (`api.ts`) pra ser testável sem rede: `runTelegramSelfTest.mts`.
 *
 * Formato: parse_mode HTML do Telegram. Só <b>, <i>, <a>, <code>. Todo texto
 * que vem do banco (nome de clube, de jogador) passa por `esc` — um clube
 * chamado "<b>" não pode quebrar a mensagem nem injetar link.
 */

export const LINKS = {
  jogo: 'https://game.olefoot.ai',
  cadastro: 'https://game.olefoot.ai/cadastro',
  site: 'https://olefoot.ai',
  carteira: 'https://dex.olefoot.ai',
  mercado: 'https://game.olefoot.ai/mercado/vivo',
  x: 'https://x.com/olefootgame',
  instagram: 'https://instagram.com/olefootgame',
} as const;

/** Espelha GLOBAL_DIVISION_NAME em src/match/globalLeagueMVP.ts (o server não importa do app). */
const DIVISAO: Record<number, string> = { 1: 'Elite', 2: 'Intermediária', 3: 'Acesso', 4: 'Várzea' };
export const nomeDaDivisao = (d: number | null | undefined) =>
  d == null ? 'Sem divisão' : DIVISAO[d] ?? `Divisão ${d}`;

export function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Centavos de BRO (1 BRO = US$ 1) → "$1.234,56". */
export function dolar(centavos: number): string {
  const v = (Number.isFinite(centavos) ? centavos : 0) / 100;
  return `$${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "olefoot" inteiro com separador de milhar. */
export function inteiro(n: number | string | bigint): string {
  try { return BigInt(String(n).split('.')[0] || '0').toLocaleString('pt-BR'); } catch { return '0'; }
}

/**
 * "/ranking@OlefootBot arg" → { comando: 'ranking', arg: 'arg' }.
 * Em grupo o Telegram anexa o @ do bot; em privado, não. Comando de OUTRO bot
 * (`/start@OutroBot`) é ignorado — responder a ele seria sequestrar a conversa.
 */
export function lerComando(texto: string | undefined, usuarioDoBot: string | null):
  { comando: string; arg: string } | null {
  if (!texto || !texto.startsWith('/')) return null;
  const [cabeca = '', ...resto] = texto.trim().split(/\s+/);
  const [cmd = '', alvo] = cabeca.slice(1).split('@');
  if (alvo && usuarioDoBot && alvo.toLowerCase() !== usuarioDoBot.toLowerCase()) return null;
  if (!/^[a-z0-9_]{1,32}$/i.test(cmd)) return null;
  return { comando: cmd.toLowerCase(), arg: resto.join(' ') };
}

// ─────────────────────────────────────────────────────────── textos fixos ──

export function textoBoasVindas(): string {
  return [
    '⚽ <b>Bem-vindo à OLEFOOT</b>',
    'O football manager onde o seu elenco é um ativo vivo.',
    '',
    textoComandos(),
  ].join('\n');
}

export function textoComandos(): string {
  return [
    '<b>Comandos</b>',
    '/jogar — entrar no jogo',
    '/ranking — top da Liga Global',
    '/mercado — maiores altas do dia',
    '/mvp — o MVP de hoje',
    '/token — endereço oficial e links verdadeiros',
    '/ajuda — esta lista',
  ].join('\n');
}

export function textoJogar(): string {
  return [
    '🎮 <b>Monte seu time agora</b>',
    'Elenco, tática e partida ao vivo. Começa de graça.',
    '',
    `👉 <a href="${LINKS.cadastro}">Criar meu time</a>`,
    `Já tem conta? <a href="${LINKS.jogo}">Entrar</a>`,
  ].join('\n');
}

/**
 * O endereço oficial. Sem endereço configurado, diz "em breve" — e mesmo
 * assim orienta: qualquer endereço que alguém mandar no grupo antes do
 * oficial é golpe. É a mensagem que mais protege a comunidade.
 */
export function textoToken(enderecoOficial: string | null): string {
  const linhas = ['🪙 <b>$OLEFOOT · Solana</b>'];
  if (enderecoOficial) {
    linhas.push('Endereço oficial (CA):', `<code>${esc(enderecoOficial)}</code>`);
  } else {
    linhas.push('O endereço oficial sai <b>em breve</b>, aqui, no site e no @olefootgame.');
  }
  linhas.push(
    '',
    '⚠️ Só confie no endereço publicado por este bot e no site. A equipe <b>nunca</b> chama ninguém no privado.',
    '',
    `🌐 <a href="${LINKS.site}">olefoot.ai</a> · 🎮 <a href="${LINKS.jogo}">Jogo</a> · 👛 <a href="${LINKS.carteira}">OLEWALLET</a>`,
    `𝕏 <a href="${LINKS.x}">@olefootgame</a> · 📸 <a href="${LINKS.instagram}">Instagram</a>`,
  );
  return linhas.join('\n');
}

// ─────────────────────────────────────────────────────── textos com dado ──

export interface LinhaRanking {
  readonly club_name: string | null;
  readonly division: number | null;
  readonly points: number | null;
  readonly wins: number | null;
  readonly goal_difference: number | null;
}

const MEDALHA = ['🥇', '🥈', '🥉'];

export function textoRanking(linhas: readonly LinhaRanking[], divisao: number): string {
  if (linhas.length === 0) return `🏆 <b>Liga Global · ${esc(nomeDaDivisao(divisao))}</b>\nAinda sem times nesta divisão.`;
  const corpo = linhas.map((t, i) => {
    const pos = MEDALHA[i] ?? `${i + 1}.`;
    const sg = Number(t.goal_difference ?? 0);
    return `${pos} <b>${esc(t.club_name ?? 'Clube')}</b> — ${t.points ?? 0} pts · ${t.wins ?? 0} V · SG ${sg > 0 ? '+' : ''}${sg}`;
  });
  return [
    `🏆 <b>Liga Global · ${esc(nomeDaDivisao(divisao))}</b>`,
    ...corpo,
    '',
    `Seu clube aqui? 👉 <a href="${LINKS.cadastro}">Criar meu time</a>`,
  ].join('\n');
}

export interface LinhaMercado {
  readonly name: string | null;
  readonly pos: string | null;
  readonly ovr: number | null;
  readonly market_bro_cents: number | null;
  readonly delta24h_cents: number | null;
  readonly dono: string | null;
}

/** Só quem SUBIU entra. Sem alta no dia, a mensagem diz isso em vez de inventar. */
export function textoMercado(linhas: readonly LinhaMercado[]): string {
  const altas = linhas
    .filter((l) => (l.delta24h_cents ?? 0) > 0 && (l.market_bro_cents ?? 0) > 0)
    .sort((a, b) => (b.delta24h_cents ?? 0) - (a.delta24h_cents ?? 0))
    .slice(0, 5);
  if (altas.length === 0) {
    return `📈 <b>Mercado de elenco</b>\nNenhuma valorização nas últimas 24h ainda.\n\n👉 <a href="${LINKS.mercado}">Ver o mercado ao vivo</a>`;
  }
  const corpo = altas.map((l, i) => {
    const agora = l.market_bro_cents ?? 0;
    const delta = l.delta24h_cents ?? 0;
    const antes = agora - delta;
    const pct = antes > 0 ? ` (+${((delta / antes) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)` : '';
    const quem = l.dono ? ` · ${esc(l.dono)}` : '';
    return `${i + 1}. <b>${esc(l.name ?? 'Jogador')}</b> ${esc(l.pos ?? '')} ${l.ovr ?? ''} — ${dolar(agora)}${pct}${quem}`;
  });
  return ['📈 <b>Maiores altas do dia</b>', ...corpo, '', `👉 <a href="${LINKS.mercado}">Mercado ao vivo</a>`].join('\n');
}

export interface LinhaMvp {
  readonly dia: string;
  readonly player_name: string | null;
  readonly status: string | null;
  readonly min_bid_olefoot: number | string | null;
  readonly bid_olefoot: number | string | null;
  readonly ends_at: string | null;
  readonly clube: string | null;
}

export function textoMvp(m: LinhaMvp | null, agora = new Date()): string {
  if (!m) return `⭐ <b>MVP do dia</b>\nO MVP sai às 20h (Brasília), com o artilheiro das últimas 24h.\n\n👉 <a href="${LINKS.mercado}">Mercado ao vivo</a>`;
  const aberto = m.status === 'open' && m.ends_at != null && new Date(m.ends_at) > agora;
  const lance = m.bid_olefoot != null && String(m.bid_olefoot) !== '0'
    ? `Lance atual: <b>${inteiro(m.bid_olefoot)} OLEFOOT</b>`
    : `Lance mínimo: <b>${inteiro(m.min_bid_olefoot ?? 0)} OLEFOOT</b>`;
  return [
    `⭐ <b>MVP do dia — ${esc(m.player_name ?? 'Jogador')}</b>`,
    m.clube ? `Clube: ${esc(m.clube)}` : null,
    lance,
    aberto ? '🔨 Leilão <b>aberto</b> agora.' : 'Leilão encerrado.',
    '',
    `👉 <a href="${LINKS.mercado}">Dar lance no mercado ao vivo</a>`,
  ].filter((l) => l !== null).join('\n');
}
