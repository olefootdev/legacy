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
import { useCallback, useEffect, useRef, useState } from 'react';
import { abrir, esquecer as esquecerCofre, fechar, guardar, ler, type Cofre } from './cofre.js';
import { fraseParaChave, type ChaveSolana } from './derive.js';
import { gerarFrase } from './mnemonic.js';

export type EstadoCarteira = 'carregando' | 'sem-cofre' | 'trancada' | 'aberta';

/**
 * Tranca sozinha. Carteira aberta num celular esquecido na mesa é chave
 * privada na mão de quem pegar.
 *   · 5 minutos sem toque nem tecla
 *   · 60 segundos fora da tela (outra aba, app em segundo plano)
 * Trancar só apaga a chave da memória; a senha abre de novo.
 */
export const TRANCA_PARADA_MS = 5 * 60_000;
export const TRANCA_FORA_DA_TELA_MS = 60_000;

export interface Carteira {
  estado: EstadoCarteira;
  /**
   * SÓ EXISTE COM A CARTEIRA ABERTA. Nasce da chave e some quando tranca.
   *
   * A versão anterior guardava o endereço em claro pra mostrar na tela
   * trancada. O raciocínio era "endereço é público" — e é, na blockchain. O que
   * não é público é a LIGAÇÃO entre este aparelho e aquele endereço: quem
   * abrisse o navegador de outra pessoa descobria de quem é a carteira sem
   * senha, e daí via saldo e histórico. Ou a carteira está aberta, ou não
   * mostra nada.
   */
  endereco: string | null;
  /** Só quando aberta. Nunca sai daqui. */
  chave: ChaveSolana | null;
  erro: string | null;
  ocupado: boolean;
  /** Verdadeiro quando a última tranca foi automática — a tela avisa o porquê. */
  trancouSozinha: boolean;

  novaFrase(): string[];
  criar(palavras: readonly string[], senha: string): Promise<void>;
  destrancar(senha: string): Promise<void>;
  trancar(): void;
  esquecer(): void;
  /**
   * Devolve as 12 palavras pra MOSTRAR, abrindo o cofre de novo com a senha.
   * Não guarda nada: quem chama segura as palavras em estado local e apaga.
   */
  verFrase(senha: string): Promise<string[]>;
}

export function useCarteira(): Carteira {
  const [estado, setEstado] = useState<EstadoCarteira>('carregando');
  const [endereco, setEndereco] = useState<string | null>(null);
  const [chave, setChave] = useState<ChaveSolana | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [trancouSozinha, setTrancouSozinha] = useState(false);

  useEffect(() => {
    // `ler()` também apaga a chave legada do endereço em claro, se existir.
    const cofre = ler();
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
      setChave(k); setEndereco(k.endereco); setEstado('aberta'); setTrancouSozinha(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'não consegui abrir');
      throw e;
    } finally { setOcupado(false); }
  }, []);

  const trancar = useCallback(() => {
    // O endereço some junto com a chave: trancar tem que apagar a tela toda.
    setChave(null); setEndereco(null);
    setEstado(ler() ? 'trancada' : 'sem-cofre');
  }, []);

  // ── a tranca automática ──
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (estado !== 'aberta') return;
    const trancarSozinha = () => {
      setChave(null); setEndereco(null); setTrancouSozinha(true);
      setEstado(ler() ? 'trancada' : 'sem-cofre');
    };
    const armar = (ms: number) => {
      if (relogio.current) clearTimeout(relogio.current);
      relogio.current = setTimeout(trancarSozinha, ms);
    };
    const mexeu = () => { if (document.visibilityState === 'visible') armar(TRANCA_PARADA_MS); };
    const visibilidade = () =>
      armar(document.visibilityState === 'hidden' ? TRANCA_FORA_DA_TELA_MS : TRANCA_PARADA_MS);

    armar(TRANCA_PARADA_MS);
    const eventos = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of eventos) window.addEventListener(e, mexeu, { passive: true });
    document.addEventListener('visibilitychange', visibilidade);
    return () => {
      if (relogio.current) clearTimeout(relogio.current);
      for (const e of eventos) window.removeEventListener(e, mexeu);
      document.removeEventListener('visibilitychange', visibilidade);
    };
  }, [estado]);

  const verFrase = useCallback(async (senha: string) => {
    const cofre = ler();
    if (!cofre) throw new Error('não há carteira neste aparelho');
    return abrir(cofre, senha);
  }, []);

  const esquecer = useCallback(() => {
    esquecerCofre();
    setChave(null); setEndereco(null); setEstado('sem-cofre');
  }, []);

  return {
    estado, endereco, chave, erro, ocupado, trancouSozinha,
    novaFrase: gerarFrase,
    criar, destrancar, trancar, esquecer, verFrase,
  };
}
