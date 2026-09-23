/**
 * Criar ou restaurar a carteira — um lugar só.
 *
 * Isto vive fora das duas telas que usam (`/` e `/conectar`) porque é a tela
 * que MOSTRA A FRASE. Duplicar o aviso de "anote no papel", a grade das 12
 * palavras e a regra da senha em dois arquivos é garantir que um dia os dois
 * digam coisas diferentes — e o que diverge, numa carteira, é o que a pessoa
 * acredita sobre como recuperar o dinheiro.
 *
 * Quem chama decide o que acontece depois: na carteira, volta pro início; no
 * pedido de conexão, a própria mudança de estado já leva pra tela de assinar.
 */
import { useState } from 'react';
import { useCarteira } from '@/wallet/seed/useCarteira';
import { PALAVRAS_NA_FRASE, fraseValida, normalizarFrase } from '@/wallet/seed/mnemonic';
import { Aviso, BOTAO_LINHA, BOTAO_VOLT, CAMPO } from './ui';

export type Passo = 'inicio' | 'frase' | 'senha' | 'restaurar';

interface Props {
  w: ReturnType<typeof useCarteira>;
  passo: Passo;
  setPasso: (p: Passo) => void;
  /** Chamado depois que a carteira nasce e já está aberta. */
  onPronto?: () => void;
  /** O que a tela de início diz. O pedido de conexão fala outra coisa. */
  chamada?: { titulo: React.ReactNode; texto: string };
}

export default function CriarOuRestaurar({ w, passo, setPasso, onPronto, chamada }: Props) {
  const [frase, setFrase] = useState<string[]>([]);
  const [copiado, setCopiado] = useState(false);
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [digitada, setDigitada] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const limpar = () => { setSenha(''); setSenha2(''); setDigitada(''); setMsg(null); };

  const confirmar = async () => {
    setMsg(null);
    if (senha !== senha2) { setMsg('As duas senhas não são iguais.'); return; }
    const palavras = passo === 'restaurar' ? normalizarFrase(digitada) : frase;
    if (passo === 'restaurar' && !fraseValida(palavras)) {
      setMsg(`A frase não fecha. Confira as ${PALAVRAS_NA_FRASE} palavras e a ordem.`);
      return;
    }
    try {
      await w.criar(palavras, senha);
      limpar(); setFrase([]); setPasso('inicio');
      onPronto?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'não deu');
    }
  };

  if (passo === 'frase') {
    return (
      <>
        <Aviso titulo="Anote no papel">
          Em ordem. Quem tiver estas {PALAVRAS_NA_FRASE} palavras é dono desta carteira. Print é roubado.
        </Aviso>
        <div className="grid grid-cols-3 gap-2">
          {frase.map((p, i) => (
            <div key={`${i}-${p}`} className="flex items-baseline gap-1.5 border border-white/10 bg-panel px-2 py-2.5">
              <span className="font-mono text-[10px] text-poeira">{String(i + 1).padStart(2, '0')}</span>
              <span className="font-mono text-[13px]">{p}</span>
            </div>
          ))}
        </div>
        <div className="border border-white/10 bg-panel px-3.5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">Leia uma vez</p>
          <p className="mt-1.5 text-[12px] leading-[1.55] text-giz">
            Estas palavras vêm da lista da OLEFOOT, não da lista padrão.{' '}
            <strong className="text-white">Elas não abrem sua carteira na Phantom nem na Solflare.</strong>{' '}
            A lista é pública, então qualquer desenvolvedor reconstrói esta carteira — com ou sem a gente.
          </p>
        </div>
        <button type="button" className={BOTAO_LINHA}
          onClick={() => { void navigator.clipboard.writeText(frase.join(' ')).then(() => setCopiado(true)); }}>
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
        <button type="button" className={`${BOTAO_VOLT} mt-auto`} onClick={() => { limpar(); setPasso('senha'); }}>
          Anotei as {PALAVRAS_NA_FRASE} palavras
        </button>
      </>
    );
  }

  if (passo === 'senha' || passo === 'restaurar') {
    const restaurando = passo === 'restaurar';
    return (
      <>
        {restaurando && (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">Sua frase</p>
            <textarea rows={4} className={`${CAMPO} h-auto py-2.5 leading-relaxed`} autoFocus
              placeholder={`as ${PALAVRAS_NA_FRASE} palavras, separadas por espaço`}
              value={digitada} onChange={(e) => setDigitada(e.target.value)} />
          </>
        )}
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">Senha deste aparelho</p>
        <input type="password" className={CAMPO} placeholder="senha" value={senha}
          autoFocus={!restaurando} onChange={(e) => setSenha(e.target.value)} />
        <input type="password" className={CAMPO} placeholder="repita a senha" value={senha2}
          onChange={(e) => setSenha2(e.target.value)} />
        <p className="text-[11px] leading-relaxed text-poeira">
          A senha cifra a frase neste aparelho. Ela não recupera nada: se esquecer a senha,
          quem traz a carteira de volta são as {PALAVRAS_NA_FRASE} palavras.
        </p>
        {(msg ?? w.erro) && <p className="text-[12px] text-baixa">{msg ?? w.erro}</p>}
        <button type="button" className={`${BOTAO_VOLT} mt-auto`}
          disabled={w.ocupado || !senha || !senha2 || (restaurando && !digitada.trim())}
          onClick={() => void confirmar()}>
          {w.ocupado ? 'Cifrando…' : restaurando ? 'Restaurar carteira' : 'Criar carteira'}
        </button>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        {chamada ? (
          <>
            <h1 className="font-display text-[30px] uppercase leading-[1.1]">{chamada.titulo}</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-cimento">{chamada.texto}</p>
          </>
        ) : (
          <>
            <p className="font-mono text-[11px] text-poeira">#olewallet</p>
            <h1 className="font-display text-[44px] uppercase leading-[1.08]">Sua chave.<br />Seu time.</h1>
            <p className="mt-1 text-[14px] leading-relaxed text-cimento">
              {PALAVRAS_NA_FRASE} palavras de futebol são a carteira inteira. A gente nunca vê
              e não consegue trazer de volta.
            </p>
          </>
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        <button type="button" className={BOTAO_VOLT}
          onClick={() => { setFrase(w.novaFrase()); setCopiado(false); setPasso('frase'); }}>
          Criar carteira
        </button>
        <button type="button" className={BOTAO_LINHA} onClick={() => { limpar(); setPasso('restaurar'); }}>
          Já tenho uma frase
        </button>
        <p className="mt-1 text-[11px] leading-relaxed text-poeira">
          A OLEFOOT não guarda seus fundos e não recupera frase perdida.
        </p>
      </div>
    </>
  );
}
