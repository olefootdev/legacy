/**
 * O aperto de mão entre o jogo e a OLEWALLET (A VIRADA · V1).
 *
 * A OLEWALLET mora em outra origem (olefoot.com), e é ESSE o ponto: um XSS em
 * qualquer canto do jogo não alcança o cofre dela. O preço dessa separação é
 * que não dá pra compartilhar sessão — então a ligação é uma ASSINATURA, não
 * um cookie. É o mesmo desenho que o jogo já usa com a Phantom, e por isso ele
 * cai no MESMO endpoint de vínculo, já em produção e testado.
 *
 * O fluxo, e por que ele tem uma volta a mais do que parece necessário:
 *   1. o jogo abre uma janela em `<carteira>/conectar?uid=…&issuedAt=…`
 *   2. a janela avisa "pronto" pra quem a abriu
 *   3. quem abriu responde "olá" — e é SÓ AQUI que a carteira descobre a origem
 *      de verdade, pelo `event.origin`, que o navegador preenche e ninguém
 *      forja. Confiar no `document.referrer` ou num parâmetro da URL seria
 *      deixar o site pedinte dizer quem ele é.
 *   4. a carteira mostra QUEM pediu e o endereço, e a pessoa decide
 *   5. no sim, ela assina e devolve por `postMessage` PRA AQUELA origem
 *   6. o jogo posta isso em /api/wallet/solana/link, igual faria com a Phantom
 *
 * Este arquivo é importado pelos DOIS lados justamente pra não existirem duas
 * versões do protocolo envelhecendo em paralelo.
 *
 * ⚠️ A chave privada e a frase NUNCA entram em nenhuma destas mensagens, e não
 * podem passar a entrar. O que atravessa é endereço, data e assinatura — tudo
 * público, tudo inútil pra quem interceptar.
 */

/** Origens que podem PEDIR uma assinatura à carteira. Lista fechada. */
export const ORIGENS_QUE_PODEM_PEDIR: readonly string[] = [
  'https://game.olefoot.com',
  'https://olefoot.com',
  'https://www.olefoot.com',
  'http://localhost:5173',
  'http://localhost:4173',
];

/** Onde a carteira mora. O jogo só aceita resposta vinda daqui. */
export const ORIGEM_DA_CARTEIRA: string =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_OLEWALLET_ORIGIN) ||
  'https://olefoot.com';

export function origemPermitida(origem: string | null | undefined): boolean {
  if (!origem) return false;
  return ORIGENS_QUE_PODEM_PEDIR.includes(origem);
}

export const CANAL = 'olewallet/v1';

export interface PedidoDeAssinatura {
  /** uuid da conta no jogo — é ele que entra na mensagem assinada. */
  readonly uid: string;
  /** ISO. A janela de validade é do servidor (LINK_WINDOW_MS = 5 min). */
  readonly issuedAt: string;
}

/** A carteira avisa que carregou. Não carrega dado nenhum de propósito. */
export interface Pronto { readonly canal: typeof CANAL; readonly tipo: 'pronto' }

/**
 * Quem abriu responde. O conteúdo não importa — o que importa é o
 * `event.origin` que vem junto, e esse o navegador garante.
 */
export interface Ola { readonly canal: typeof CANAL; readonly tipo: 'ola' }

export const PRONTO: Pronto = { canal: CANAL, tipo: 'pronto' };
export const OLA: Ola = { canal: CANAL, tipo: 'ola' };

export function ehOla(dado: unknown): boolean {
  const d = dado as Partial<Ola> | null;
  return Boolean(d && d.canal === CANAL && d.tipo === 'ola');
}

export function ehPronto(dado: unknown): boolean {
  const d = dado as Partial<Pronto> | null;
  return Boolean(d && d.canal === CANAL && d.tipo === 'pronto');
}

export type RespostaDaCarteira =
  | {
      readonly canal: typeof CANAL;
      readonly tipo: 'assinado';
      readonly address: string;
      readonly issuedAt: string;
      /** base64 */
      readonly signature: string;
      /** base64 */
      readonly signedMessage: string;
    }
  | {
      readonly canal: typeof CANAL;
      readonly tipo: 'recusado';
      readonly motivo: string;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lê o pedido da URL. Recusa o que não for uuid e data — sem isso a carteira
 * assinaria mensagem com conteúdo que o site pedinte escolheu.
 */
export function lerPedido(busca: string): PedidoDeAssinatura | null {
  const q = new URLSearchParams(busca);
  const uid = (q.get('uid') ?? '').trim();
  const issuedAt = (q.get('issuedAt') ?? '').trim();
  if (!UUID.test(uid)) return null;
  const t = Date.parse(issuedAt);
  if (!Number.isFinite(t)) return null;
  // Pedido velho não vale: o servidor recusaria depois, e é melhor dizer agora.
  if (Math.abs(Date.now() - t) > 5 * 60 * 1000) return null;
  return { uid, issuedAt };
}

export function urlDoPedido(base: string, pedido: PedidoDeAssinatura): string {
  const u = new URL('/conectar', base);
  u.searchParams.set('uid', pedido.uid);
  u.searchParams.set('issuedAt', pedido.issuedAt);
  return u.toString();
}

/** Uma resposta só é resposta se veio da carteira, no canal certo, com forma certa. */
export function respostaValida(origem: string, dado: unknown): RespostaDaCarteira | null {
  if (origem !== ORIGEM_DA_CARTEIRA) return null;
  const d = dado as Partial<RespostaDaCarteira> | null;
  if (!d || d.canal !== CANAL) return null;
  if (d.tipo === 'recusado') return { canal: CANAL, tipo: 'recusado', motivo: String(d.motivo ?? 'recusado') };
  if (d.tipo !== 'assinado') return null;
  const a = d as Extract<RespostaDaCarteira, { tipo: 'assinado' }>;
  if (!a.address || !a.issuedAt || !a.signature || !a.signedMessage) return null;
  return {
    canal: CANAL, tipo: 'assinado',
    address: String(a.address), issuedAt: String(a.issuedAt),
    signature: String(a.signature), signedMessage: String(a.signedMessage),
  };
}
