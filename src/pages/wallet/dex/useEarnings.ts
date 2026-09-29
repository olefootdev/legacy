import { useEffect, useState } from 'react';
import {
  lerFundo, lerMeuVault, lerRegras,
  type FundoDoVault, type MeuVault, type RegrasDeEarnings,
} from '@/wallet/earningsClient';
import { aoMudarAPosicao } from '@/wallet/eventosDaCarteira';

/**
 * Regras + fundo + o que é da pessoa, lidos uma vez pros três blocos.
 *
 * `fundo: null` NÃO é erro — é o fundo ainda não criado, que é o estado de
 * lançamento. Erro é a regra não carregar; aí os blocos não desenham número
 * nenhum, em vez de cair numa cópia local.
 */
export type Earnings =
  | { readonly status: 'carregando' }
  | { readonly status: 'erro' }
  | {
      readonly status: 'ok';
      readonly regras: RegrasDeEarnings;
      readonly fundo: FundoDoVault | null;
      readonly meu: MeuVault | null;
    };

export function useEarnings(): Earnings {
  const [estado, setEstado] = useState<Earnings>({ status: 'carregando' });

  useEffect(() => {
    let vivo = true;
    const ler = async () => {
      try {
        const regras = await lerRegras();
        const fundo = await lerFundo(regras.vault.slug).catch(() => null);
        const meu = fundo ? await lerMeuVault(regras.vault.slug).catch(() => null) : null;
        if (vivo) setEstado({ status: 'ok', regras, fundo, meu });
      } catch {
        if (vivo) setEstado({ status: 'erro' });
      }
    };
    void ler();
    const parar = aoMudarAPosicao(() => { void ler(); });
    return () => { vivo = false; parar(); };
  }, []);

  return estado;
}
