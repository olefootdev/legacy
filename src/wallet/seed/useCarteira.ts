/**
 * O estado da carteira na tela (A VIRADA · V1).
 *
 * A regra que manda em tudo aqui: a CHAVE PRIVADA SÓ EXISTE EM MEMÓRIA. Ela
 * nasce quando o cofre é aberto, vive no `useState` deste hook, e some quando a
 * pessoa tranca ou fecha a aba. O que fica no aparelho é o cofre cifrado (ver
 * cofre.ts) e o endereço — que é público e não abre nada.
 *
 * Nada neste arquivo pode passar a: gravar `chave` ou `frase`, mandá-las por
 * rede, ou colocá-las em log. Se um dia precisar, não precisa.
 */
import { useCallback, useEffect, useState } from 'react';
import { abrir, esquecer as esquecerCofre, fechar, guardar, ler, type Cofre } from './cofre.js';
import { fraseParaChave, type ChaveSolana } from './derive.js';
import { gerarFrase } from './mnemonic.js';

/** O endereço é público: fica em claro pra tela trancada poder mostrá-lo. */
const CHAVE_ENDERECO = 'olefoot.carteira.endereco.v1';

function lerEndereco(): string | null {
  try { return localStorage.getItem(CHAVE_ENDERECO); } catch { return null; }
}
function guardarEndereco(e: string): void {
  try { localStorage.setItem(CHAVE_ENDERECO, e); } catch { /* segue sem */ }
}
function apagarEndereco(): void {
  try { localStorage.removeItem(CHAVE_ENDERECO); } catch { /* segue */ }
}

export type EstadoCarteira = 'carregando' | 'sem-cofre' | 'trancada' | 'aberta';

export interface Carteira {
  estado: EstadoCarteira;
  /** Conhecido mesmo trancada — é público. */
  endereco: string | null;
  /** Só quando aberta. Nunca sai daqui. */
  chave: ChaveSolana | null;
  erro: string | null;
  ocupado: boolean;

  novaFrase(): string[];
  criar(palavras: readonly string[], senha: string): Promise<void>;
  destrancar(senha: string): Promise<void>;
  trancar(): void;
  esquecer(): void;
}

export function useCarteira(): Carteira {
  const [estado, setEstado] = useState<EstadoCarteira>('carregando');
  const [endereco, setEndereco] = useState<string | null>(null);
  const [chave, setChave] = useState<ChaveSolana | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const cofre = ler();
    setEndereco(lerEndereco());
    setEstado(cofre ? 'trancada' : 'sem-cofre');
  }, []);

  const criar = useCallback(async (palavras: readonly string[], senha: string) => {
    setOcupado(true); setErro(null);
    try {
      // Deriva ANTES de guardar: se a frase não fecha o checksum, isto estoura
      // aqui e nada é gravado — melhor do que um cofre que abre numa carteira
      // que a pessoa nunca vai conseguir restaurar.
      const k = fraseParaChave(palavras);
      const cofre: Cofre = await fechar(palavras, senha);
      guardar(cofre);
      guardarEndereco(k.endereco);
      setChave(k); setEndereco(k.endereco); setEstado('aberta');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'não consegui criar a carteira');
      throw e;
    } finally { setOcupado(false); }
  }, []);

  const destrancar = useCallback(async (senha: string) => {
    setOcupado(true); setErro(null);
    try {
      const cofre = ler();
      if (!cofre) { setEstado('sem-cofre'); return; }
      const palavras = await abrir(cofre, senha);
      const k = fraseParaChave(palavras);
      guardarEndereco(k.endereco);
      setChave(k); setEndereco(k.endereco); setEstado('aberta');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'não consegui abrir');
      throw e;
    } finally { setOcupado(false); }
  }, []);

  const trancar = useCallback(() => {
    setChave(null);
    setEstado(ler() ? 'trancada' : 'sem-cofre');
  }, []);

  const esquecer = useCallback(() => {
    esquecerCofre(); apagarEndereco();
    setChave(null); setEndereco(null); setEstado('sem-cofre');
  }, []);

  return {
    estado, endereco, chave, erro, ocupado,
    novaFrase: gerarFrase,
    criar, destrancar, trancar, esquecer,
  };
}
