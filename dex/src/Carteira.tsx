/**
 * OLEWALLET — a carteira, em olefoot.com.
 *
 * Note o que esta tela NÃO tem: botão de vincular. Vincular é assinar pra outro
 * site, e isso acontece em /conectar, com o pedido na tela e a pessoa dizendo
 * sim. Carteira que assina sozinha porque a página abriu não é carteira.
 */
import { useCallback, useEffect, useState } from 'react';
import { useCarteira } from '@/wallet/seed/useCarteira';
import CriarOuRestaurar, { type Passo } from './CriarOuRestaurar';
import { buscarSaldo, type Saldo } from './api';
import { BOTAO_LINHA, BOTAO_VOLT, Barra, CAMPO, Logo } from './ui';

export default function Carteira() {
  const w = useCarteira();
  const [passo, setPasso] = useState<Passo>('inicio');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [saldo, setSaldo] = useState<Saldo | null>(null);

  const atualizarSaldo = useCallback(async (e: string) => { setSaldo(await buscarSaldo(e)); }, []);

  useEffect(() => {
    if (w.estado === 'aberta' && w.endereco) void atualizarSaldo(w.endereco);
  }, [w.estado, w.endereco, atualizarSaldo]);

  const destrancar = async () => {
    setMsg(null);
    try { await w.destrancar(senha); setSenha(''); }
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
    const endereco = w.chave.endereco;
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
            <p className="mt-1 font-mono text-[13px]" style={{ wordBreak: 'break-all' }}>{endereco}</p>
            <div className="mt-2.5 flex gap-2">
              <button type="button" className="border border-white/25 px-2.5 py-1.5 text-[12px]"
                onClick={() => void navigator.clipboard.writeText(endereco)}>Copiar</button>
              <button type="button" className="border border-white/25 px-2.5 py-1.5 text-[12px]"
                onClick={() => void atualizarSaldo(endereco)}>Saldo</button>
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

  // sem cofre: criar ou restaurar
  const tituloDaBarra = passo === 'frase' ? 'SUA FRASE' : passo === 'restaurar' ? 'RESTAURAR' : passo === 'senha' ? 'SENHA' : null;
  return (
    <div className="flex min-h-full flex-col bg-asfalto">
      {tituloDaBarra
        ? <Barra titulo={tituloDaBarra} onVoltar={() => setPasso(passo === 'senha' ? 'frase' : 'inicio')} />
        : null}
      <div className={`mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-5 pb-8 ${tituloDaBarra ? 'pt-4' : 'pt-8'}`}>
        {!tituloDaBarra && <Logo />}
        <CriarOuRestaurar w={w} passo={passo} setPasso={setPasso} />
      </div>
    </div>
  );
}
