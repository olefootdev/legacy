/**
 * O que o bot do Telegram diz — funções PURAS (dado entra, HTML sai).
 * Tudo em INGLÊS: a comunidade do grupo é internacional (decisão do fundador, 05/10).
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
  telegram: 'https://t.me/olefootgame',
} as const;

/** Espelha GLOBAL_DIVISION_NAME em src/match/globalLeagueMVP.ts (o server não importa do app). */
const DIVISAO: Record<number, string> = { 1: 'Elite', 2: 'Intermediate', 3: 'Access', 4: 'Grassroots' };
export const nomeDaDivisao = (d: number | null | undefined) =>
  d == null ? 'No division' : DIVISAO[d] ?? `Division ${d}`;

export function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Centavos de BRO (1 BRO = US$ 1) → "$1,234.56". */
export function dolar(centavos: number): string {
  const v = (Number.isFinite(centavos) ? centavos : 0) / 100;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "olefoot" inteiro com separador de milhar. */
export function inteiro(n: number | string | bigint): string {
  try { return BigInt(String(n).split('.')[0] || '0').toLocaleString('en-US'); } catch { return '0'; }
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
    '⚽ <b>Welcome to OLEFOOT</b>',
    'The football manager where your squad is a living asset.',
    '',
    textoComandos(),
  ].join('\n');
}

export function textoComandos(): string {
  return [
    '<b>Commands</b>',
    '/play — jump into the game',
    '/ranking — Global League top 10',
    '/market — biggest risers today',
    '/mvp — today\'s MVP',
    '/token — official address and real links',
    '/help — this list',
  ].join('\n');
}

export function textoJogar(): string {
  return [
    '🎮 <b>Build your team now</b>',
    'Squad, tactics and live matches. Free to start.',
    '',
    `👉 <a href="${LINKS.cadastro}">Create my team</a>`,
    `Already have an account? <a href="${LINKS.jogo}">Log in</a>`,
  ].join('\n');
}

/**
 * O endereço oficial. Sem endereço configurado, diz "soon" — e mesmo
 * assim orienta: qualquer endereço que alguém mandar no grupo antes do
 * oficial é golpe. É a mensagem que mais protege a comunidade.
 */
export function textoToken(enderecoOficial: string | null): string {
  const linhas = ['🪙 <b>OLEFOOT · $OLEGAME · Solana</b>'];
  if (enderecoOficial) {
    linhas.push(
      'Official contract address (CA):', `<code>${esc(enderecoOficial)}</code>`,
      `🛒 <a href="https://pump.fun/coin/${encodeURIComponent(enderecoOficial)}">Buy on pump.fun</a>`,
    );
  } else {
    linhas.push('The official address is coming <b>soon</b> — here, on the website and on @olefootgame.');
  }
  linhas.push(
    '',
    '⚠️ Only trust the address posted by this bot and on the website. The team will <b>never</b> DM you first.',
    '',
    `🌐 <a href="${LINKS.site}">olefoot.ai</a> · 🎮 <a href="${LINKS.jogo}">Game</a> · 👛 <a href="${LINKS.carteira}">OLEWALLET</a>`,
    `𝕏 <a href="${LINKS.x}">@olefootgame</a> · 📸 <a href="${LINKS.instagram}">Instagram</a> · 💬 <a href="${LINKS.telegram}">Official group</a>`,
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
  if (linhas.length === 0) return `🏆 <b>Global League · ${esc(nomeDaDivisao(divisao))}</b>\nNo teams in this division yet.`;
  const corpo = linhas.map((t, i) => {
    const pos = MEDALHA[i] ?? `${i + 1}.`;
    const sg = Number(t.goal_difference ?? 0);
    return `${pos} <b>${esc(t.club_name ?? 'Club')}</b> — ${t.points ?? 0} pts · ${t.wins ?? 0} W · GD ${sg > 0 ? '+' : ''}${sg}`;
  });
  return [
    `🏆 <b>Global League · ${esc(nomeDaDivisao(divisao))}</b>`,
    ...corpo,
    '',
    `Want your club here? 👉 <a href="${LINKS.cadastro}">Create my team</a>`,
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
    return `📈 <b>Squad market</b>\nNo player has gained value in the last 24h yet.\n\n👉 <a href="${LINKS.mercado}">Live market</a>`;
  }
  const corpo = altas.map((l, i) => {
    const agora = l.market_bro_cents ?? 0;
    const delta = l.delta24h_cents ?? 0;
    const antes = agora - delta;
    const pct = antes > 0 ? ` (+${((delta / antes) * 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}%)` : '';
    const quem = l.dono ? ` · ${esc(l.dono)}` : '';
    return `${i + 1}. <b>${esc(l.name ?? 'Player')}</b> ${esc(l.pos ?? '')} ${l.ovr ?? ''} — ${dolar(agora)}${pct}${quem}`;
  });
  return ['📈 <b>Biggest risers today</b>', ...corpo, '', `👉 <a href="${LINKS.mercado}">Live market</a>`].join('\n');
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
  if (!m) return `⭐ <b>MVP of the day</b>\nThe MVP is announced at 8 PM Brasília time (UTC-3): the top scorer of the last 24h.\n\n👉 <a href="${LINKS.mercado}">Live market</a>`;
  const aberto = m.status === 'open' && m.ends_at != null && new Date(m.ends_at) > agora;
  const lance = m.bid_olefoot != null && String(m.bid_olefoot) !== '0'
    ? `Current bid: <b>${inteiro(m.bid_olefoot)} OLEFOOT</b>`
    : `Minimum bid: <b>${inteiro(m.min_bid_olefoot ?? 0)} OLEFOOT</b>`;
  return [
    `⭐ <b>MVP of the day — ${esc(m.player_name ?? 'Player')}</b>`,
    m.clube ? `Club: ${esc(m.clube)}` : null,
    lance,
    aberto ? '🔨 Auction <b>open</b> now.' : 'Auction closed.',
    '',
    `👉 <a href="${LINKS.mercado}">Bid on the live market</a>`,
  ].filter((l) => l !== null).join('\n');
}
