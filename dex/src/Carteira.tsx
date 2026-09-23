/**
 * OLEWALLET — a carteira, em olefoot.com.
 *
 * É a mesma máquina que rodava em game.olefoot.com/carteira, agora na origem
 * dela. Só isso já muda o que um XSS no jogo alcança: nada aqui.
 *
 * Note o que esta tela NÃO tem: botão de vincular. Vincular é assinar pra outro
 * site, e isso acontece em /conectar, com o pedido na tela e a pessoa dizendo
 * sim. Carteira que assina sozinha porque a página abriu não é carteira.
 */
import { useCallback, useEffect, useState } from 'react';
import { useCarteira } from '@/wallet/seed/useCarteira';
import { PALAVRAS_NA_FRASE, fraseValida, normalizarFrase } from '@/wallet/seed/mnemonic';
import { buscarSaldo, type Saldo } from './api';
import { Aviso, BOTAO_LINHA, BOTAO_VOLT, Barra, CAMPO, Logo } from './ui';

type Passo = 'inicio' | 'frase' | 'senha' | 'restaurar';

export default function Carteira() {
  const w = useCarteira();
  const [passo, setPasso] = useState<Passo>('inicio');
  const [frase, setFrase] = useState<string[]>([]);
  const [copiado, setCopiado] = useState(false);
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [digitada, setDigitada] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [saldo, setSaldo] = useState<Saldo | null>(null);

  const limpar = () => { setSenha(''); setSenha2(''); setDigitada(''); setMsg(null); };

  const atualizarSaldo = useCallback(async (e: string) => { setSaldo(await buscarSaldo(e)); }, []);

  useEffect(() => {
    if (w.estado === 'aberta' && w.endereco) void atualizarSaldo(w.endereco);
  }, [w.estado, w.endereco, atualizarSaldo]);

  const confirmar = async () => {
    setMsg(null);
    if (senha !== senha2) { setMsg('As duas senhas não são iguais.'); return; }
    const palavras = passo === 'restaurar' ? normalizarFrase(digitada) : frase;
    if (passo === 'restaurar' && !fraseValida(palavras)) {
      setMsg(`A frase não fecha. Confira as ${PALAVRAS_NA_FRASE} palavras e a ordem.`);
      return;
    }
    try { await w.criar(palavras, senha); limpar(); setFrase([]); setPasso('inicio'); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'não deu'); }
  };

  const destrancar = async () => {
    setMsg(null);
    try { await w.destrancar(senha); limpar(); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'não deu'); }
  };

  if (w.estado === 'carregando') return <div className="min-h-full bg-asfalto" />;

  if (w.estado === 'trancada') {
    return (
      <div className="flex min-h-full flex-col bg-asfalto">
        <Barra titulo="OLEWALLET" />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4">
          <div>
            <p className="font-mono text-[11px] text-poeira">#trancada</p>
            <h1 className="mt-1 font-display text-[30px] uppercase leading-[1.1]">Sua senha</h1>
            {w.endereco && <p className="mt-1 truncate font-mono text-[12px] text-cimento">{w.endereco}</p>}
          </div>
          <input type="password" className={CAMPO} placeholder="senha" value={senha} autoFocus
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void destrancar(); }} />
          {(msg ?? w.erro) && <p className="text-[12px] text-baixa">{msg ?? w.erro}</p>}
          <button type="button" className={BOTAO_VOLT} disabled={w.ocupado || !senha} onClick={() => void destrancar()}>
            {w.ocupado ? 'Abrindo…' : 'Abrir carteira'}
          </button>
          <button type="button" className="text-[12px] text-poeira underline"
            onClick={() => { if (confirm('Isto apaga a carteira DESTE aparelho. Sem as 12 palavras, ela não volta. Continuar?')) w.esquecer(); }}>
            Esqueci a senha — apagar deste aparelho
          </button>
        </div>
      </div>
    );
  }

  if (w.estado === 'aberta' && w.chave) {
    return (
      <div className="flex min-h-full flex-col bg-asfalto">
        <Barra titulo="OLEWALLET" />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-8 pt-5">
          <div>
            <p className="font-mono text-[11px] text-poeira">#solana</p>
            <p className="ole-num mt-0.5 text-[40px] leading-[1.05]">{saldo ? saldo.sol.toFixed(4) : '—'}</p>
            <p className="text-[12px] text-cimento">SOL neste endereço</p>
          </div>

          <div className="border border-white/10 bg-panel px-3.5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">Seu endereço</p>
            <p className="mt-1 font-mono text-[13px]" style={{ wordBreak: 'break-all' }}>{w.chave.endereco}</p>
            <div className="mt-2.5 flex gap-2">
              <button type="button" className="border border-white/25 px-2.5 py-1.5 text-[12px]"
                onClick={() => void navigator.clipboard.writeText(w.chave?.endereco ?? '')}>Copiar</button>
              <button type="button" className="border border-white/25 px-2.5 py-1.5 text-[12px]"
                onClick={() => void atualizarSaldo(w.chave?.endereco ?? '')}>Saldo</button>
            </div>
          </div>

          <div className="border border-white/10 bg-panel px-3.5 py-3.5">
            <p className="font-num text-[13px] font-extrabold uppercase">Ligar ao jogo</p>
            <p className="mt-1 text-[12px] leading-relaxed text-cimento">
              No jogo, abra a Carteira e escolha OLEWALLET. O pedido de assinatura aparece aqui,
              e você decide.
            </p>
          </div>

          <div className="mt-auto flex gap-2">
            <button type="button" className={BOTAO_LINHA} onClick={w.trancar}>Trancar</button>
            <button type="button" className={`${BOTAO_LINHA} border-baixa/40 text-baixa`}
              onClick={() => { if (confirm('Apagar a carteira DESTE aparelho? Sem as 12 palavras, ela não volta.')) w.esquecer(); }}>
              Apagar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (passo === 'frase') {
    return (
      <div className="flex min-h-full flex-col bg-asfalto">
        <Barra titulo="SUA FRASE" onVoltar={() => setPasso('inicio')} />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-4 pb-8 pt-4">
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
        </div>
      </div>
    );
  }

  if (passo === 'senha' || passo === 'restaurar') {
    const restaurando = passo === 'restaurar';
    return (
      <div className="flex min-h-full flex-col bg-asfalto">
        <Barra titulo={restaurando ? 'RESTAURAR' : 'SENHA'} onVoltar={() => { limpar(); setPasso(restaurando ? 'inicio' : 'frase'); }} />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-4 pb-8 pt-4">
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
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col bg-asfalto px-5 pb-6 pt-8">
      <Logo />
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        <p className="font-mono text-[11px] text-poeira">#olewallet</p>
        <h1 className="font-display text-[44px] uppercase leading-[1.08]">Sua chave.<br />Seu time.</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-cimento">
          {PALAVRAS_NA_FRASE} palavras de futebol são a carteira inteira. A gente nunca vê
          e não consegue trazer de volta.
        </p>
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
    </div>
  );
}
