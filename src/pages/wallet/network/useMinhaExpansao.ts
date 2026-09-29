import { useEffect, useState } from 'react';
import { aoMudarAPosicao } from '@/wallet/eventosDaCarteira';
import {
  lerAtivacao, lerPernas, lerMapa, lerMinhaEntrada, lerCarreira,
  lerMeuUsername, podeConvidar,
  type Ativacao, type Pernas, type NoDoMapa, type Carreira,
} from '@/supabase/expansaoPainel';

/**
 * Tudo que o NETWORK precisa saber da expansão, lido UMA vez.
 *
 * A leitura fica fora do painel pra quem mais precisar do mesmo número (o
 * resumo da aba DEX, a rotina de ciclo quando tiver tela) usar ESTA, e não uma
 * segunda. Dois lugares lendo o mesmo saldo podem discordar por um instante — e
 * num painel de dinheiro isso é o que faz a pessoa desconfiar dos dois.
 */
export interface MinhaExpansao {
  readonly carregando: boolean;
  readonly naArvore: boolean;
  readonly padrinho: string | null;
  readonly username: string | null;
  readonly convida: boolean;
  readonly ativacao: Ativacao | null;
  readonly pernas: Pernas | null;
  readonly carreira: Carreira | null;
  readonly mapa: readonly NoDoMapa[];
}

const INICIO: MinhaExpansao = {
  carregando: true, naArvore: false, padrinho: null, username: null, convida: false,
  ativacao: null, pernas: null, carreira: null, mapa: [],
};

export function useMinhaExpansao(): MinhaExpansao {
  const [estado, setEstado] = useState<MinhaExpansao>(INICIO);

  useEffect(() => {
    let vivo = true;
    const ler = async () => {
      const [entrada, username] = await Promise.all([lerMinhaEntrada(), lerMeuUsername()]);
      if (!vivo) return;
      if (!entrada.naArvore) {
        setEstado({ ...INICIO, carregando: false, username });
        return;
      }
      const [ativacao, pernas, carreira, mapa, convida] = await Promise.all([
        lerAtivacao(), lerPernas(), lerCarreira(), lerMapa(5), podeConvidar(),
      ]);
      if (!vivo) return;
      setEstado({
        carregando: false, naArvore: true, padrinho: entrada.padrinho, username,
        convida, ativacao, pernas, carreira, mapa,
      });
    };
    void ler();
    // Comprar o primeiro pack põe a pessoa na árvore e libera o convite: a tela
    // que dizia "você ainda não entrou" tem que mudar sem recarregar.
    const parar = aoMudarAPosicao(() => { void ler(); });
    return () => { vivo = false; parar(); };
  }, []);

  return estado;
}
