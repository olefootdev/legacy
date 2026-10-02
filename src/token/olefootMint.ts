/**
 * FRONTEIRA DO TOKEN ON-CHAIN — o $OLEFOOT na Solana (Token-2022).
 *
 * Um lugar só pro endereço do mint e pra leitura de saldo on-chain. Antes do
 * TGE o mint é vazio e TUDO que depende dele se desliga sozinho (a tela diz
 * "em criação"). Depois do TGE, é UMA env no deploy:
 *   VITE_OLEFOOT_MINT=<endereço>  →  o jogo passa a ler a chain.
 *
 * 🔑 Decisão do fundador (2026-10-01): as wallets recebem o token DESDE O DIA
 * ZERO, mesmo sem valor — quando a liquidez entrar (gatilho: $10k de
 * pré-venda), o que já estiver nas carteiras ganha preço sozinho. Por isso a
 * leitura é da CHAIN, não de um saldo interno: o que a tela mostra é o que o
 * explorer mostra.
 *
 * Sem @solana/web3.js no bundle de propósito: é UMA chamada JSON-RPC
 * (getTokenAccountsByOwner no programa Token-2022), fetch puro resolve.
 */

export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

/** Endereço do mint. Vazio = pré-TGE (token ainda não criado na mainnet). */
export function olefootMintAddress(): string | null {
  const v = import.meta.env.VITE_OLEFOOT_MINT;
  return typeof v === 'string' && v.trim().length >= 32 ? v.trim() : null;
}

export function solanaRpcUrl(): string {
  const v = import.meta.env.VITE_SOLANA_RPC;
  return typeof v === 'string' && v.trim() ? v.trim() : 'https://api.mainnet-beta.solana.com';
}

export interface SaldoOnChain {
  /** OLEFOOT inteiro (uiAmount truncado). */
  olefoot: number;
  /** A string exata da chain (com decimais), pra quem quiser precisão. */
  uiAmountString: string;
}

/**
 * Saldo on-chain de OLEFOOT de um endereço (soma das token accounts do mint).
 * null = mint não configurado (pré-TGE) ou RPC indisponível — a tela trata os
 * dois como "ainda sem leitura", nunca como saldo 0.
 */
export async function fetchSaldoOnChain(enderecoDono: string): Promise<SaldoOnChain | null> {
  const mint = olefootMintAddress();
  if (!mint || !enderecoDono) return null;
  try {
    const r = await fetch(solanaRpcUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [enderecoDono, { mint }, { encoding: 'jsonParsed' }],
      }),
    });
    const data = (await r.json()) as {
      result?: { value?: Array<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmountString?: string } } } } } }> };
    };
    const contas = data.result?.value ?? [];
    let total = 0;
    let exata = '0';
    for (const c of contas) {
      const s = c.account?.data?.parsed?.info?.tokenAmount?.uiAmountString ?? '0';
      total += Math.floor(Number(s) || 0);
      exata = s; // uma conta por mint é o caso normal (ATA)
    }
    return { olefoot: total, uiAmountString: contas.length === 1 ? exata : String(total) };
  } catch {
    return null;
  }
}
