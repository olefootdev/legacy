import { useCallback, useEffect, useState } from 'react';
import { aoMudarAPosicao } from '@/wallet/eventosDaCarteira';
import {
  lerAtivacao, lerPernas, lerMapa, lerMinhaEntrada, lerCarreira,
  lerMeuUsername, podeConvidar, lerMeuBonus, lerCiclosPagos,
  type Ativacao, type Pernas, type NoDoMapa, type Carreira, type MeuBonus, type CicloFechado,
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
  readonly bonus: MeuBonus | null;
  /** Públicos: os ciclos que pagaram, de toda a rede. */
  readonly ciclos: readonly CicloFechado[];
  /** Relê tudo — depois de mudar o time padrão, por exemplo. */
  readonly reler: () => void;
}

const INICIO: MinhaExpansao = {
  carregando: true, naArvore: false, padrinho: null, username: null, convida: false,
  ativacao: null, pernas: null, carreira: null, mapa: [],
  bonus: null, ciclos: [], reler: () => {},
};

export function useMinhaExpansao(): MinhaExpansao {
  const [estado, setEstado] = useState<MinhaExpansao>(INICIO);
  const [versao, setVersao] = useState(0);
  const reler = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    const ler = async () => {
      const [entrada, username] = await Promise.all([lerMinhaEntrada(), lerMeuUsername()]);
      if (!vivo) return;
      if (!entrada.naArvore) {
        setEstado({ ...INICIO, carregando: false, username, reler });
        return;
      }
      const [ativacao, pernas, carreira, mapa, convida, bonus, ciclos] = await Promise.all([
        lerAtivacao(), lerPernas(), lerCarreira(), lerMapa(5), podeConvidar(),
        lerMeuBonus(), lerCiclosPagos(6),
      ]);
      if (!vivo) return;
      setEstado({
        carregando: false, naArvore: true, padrinho: entrada.padrinho, username,
        convida, ativacao, pernas, carreira, mapa, bonus, ciclos, reler,
      });
    };
    void ler();
    // Comprar o primeiro pack põe a pessoa na árvore e libera o convite: a tela
    // que dizia "você ainda não entrou" tem que mudar sem recarregar.
    const parar = aoMudarAPosicao(() => { void ler(); });
    return () => { vivo = false; parar(); };
  }, [versao, reler]);

  return estado;
}
