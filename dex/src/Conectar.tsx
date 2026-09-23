/**
 * /conectar — outro site pede uma assinatura.
 *
 * É a tela mais perigosa da carteira, porque é a única em que alguém de fora
 * fala com ela. Três coisas a defendem, e nenhuma é opcional:
 *
 *   1. A ORIGEM VEM DO NAVEGADOR. Não do `document.referrer`, não de um
 *      parâmetro. Ela chega no `event.origin` de um postMessage, que o browser
 *      preenche e nenhum site consegue falsificar. Sem esse aperto de mão, a
 *      tela não mostra botão nenhum.
 *   2. O QUE SE ASSINA É MONTADO AQUI. A mensagem sai de
 *      `buildSolanaLinkMessage(uid, endereço, data)` com o endereço que ESTA
 *      carteira tem — quem pede não escolhe o texto. Se pudesse, "assine este
 *      texto" viraria "assine esta transferência".
 *   3. A PESSOA VÊ E DECIDE. Quem pediu, qual endereço, e dois botões. Carteira
 *      que assina porque a página abriu não é carteira.
 *
 * E a resposta volta pra AQUELA origem, nunca pra '*'.
 */
import { useEffect, useRef, useState } from 'react';
import {
  CANAL,
  OLA,
  PRONTO,
  ehOla,
  lerPedido,
  origemPermitida,
  type PedidoDeAssinatura,
} from '@/wallet/seed/conexao';
import { buildSolanaLinkMessage } from '@/wallet/solanaLinkMessage';
import { assinar } from '@/wallet/seed/derive';
import { useCarteira } from '@/wallet/seed/useCarteira';
import { BOTAO_LINHA, BOTAO_VOLT, Barra, CAMPO } from './ui';

const paraB64 = (b: Uint8Array): string => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};

type Fim = 'assinado' | 'recusado' | null;

export default function Conectar() {
  const w = useCarteira();
  const [pedido] = useState<PedidoDeAssinatura | null>(() => lerPedido(window.location.search));
  const [quemPediu, setQuemPediu] = useState<string | null>(null);
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [fim, setFim] = useState<Fim>(null);
  const janela = useRef<Window | null>(null);

  // O aperto de mão: avisa que carregou e espera o "olá" pra saber QUEM é.
  useEffect(() => {
    const abriu = window.opener as Window | null;
    if (!abriu) return;

    const aoReceber = (e: MessageEvent) => {
      if (!ehOla(e.data)) return;
      if (!origemPermitida(e.origin)) {
        setMsg(`${e.origin} não está na lista de sites que podem pedir assinatura.`);
        return;
      }
      janela.current = (e.source as Window | null) ?? abriu;
      setQuemPediu(e.origin);
    };

    window.addEventListener('message', aoReceber);
    // '*' aqui é seguro: PRONTO não carrega dado nenhum. O que importa é a
    // resposta, e ela vai pra origem confirmada.
    abriu.postMessage(PRONTO, '*');
    return () => window.removeEventListener('message', aoReceber);
  }, []);

  const responder = (corpo: Record<string, unknown>) => {
    if (!janela.current || !quemPediu) return;
    janela.current.postMessage({ canal: CANAL, ...corpo }, quemPediu);
  };

  const recusar = () => {
    responder({ tipo: 'recusado', motivo: 'você recusou' });
    setFim('recusado');
    setTimeout(() => window.close(), 800);
  };

  const assinarEDevolver = () => {
    if (!w.chave || !pedido || !quemPediu) return;
    const mensagem = buildSolanaLinkMessage(pedido.uid, w.chave.endereco, pedido.issuedAt);
    const bytes = new TextEncoder().encode(mensagem);
    responder({
      tipo: 'assinado',
      address: w.chave.endereco,
      issuedAt: pedido.issuedAt,
      signature: paraB64(assinar(bytes, w.chave)),
      signedMessage: paraB64(bytes),
    });
    setFim('assinado');
    setTimeout(() => window.close(), 900);
  };

  const destrancar = async () => {
    setMsg(null);
    try { await w.destrancar(senha); setSenha(''); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'não deu'); }
  };

  const Moldura = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-full flex-col bg-asfalto">
      <Barra titulo="CONECTAR" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-8 pt-5">{children}</div>
    </div>
  );

  if (fim) {
    return (
      <Moldura>
        <p className="font-display text-[26px] uppercase">{fim === 'assinado' ? 'Assinado' : 'Recusado'}</p>
        <p className="text-[13px] text-cimento">Pode fechar esta janela.</p>
      </Moldura>
    );
  }

  if (!pedido) {
    return (
      <Moldura>
        <p className="font-display text-[26px] uppercase">Pedido inválido</p>
        <p className="text-[13px] leading-relaxed text-cimento">
          Este endereço só funciona quando o pedido parte do jogo — e vale por 5 minutos.
          Abra a Carteira no jogo e escolha OLEWALLET.
        </p>
        <a href="/" className={`${BOTAO_LINHA} mt-2`}>Ir para a carteira</a>
      </Moldura>
    );
  }

  if (!quemPediu) {
    return (
      <Moldura>
        <p className="font-mono text-[11px] text-poeira">#conectar</p>
        <p className="font-display text-[26px] uppercase leading-[1.1]">Confirmando quem pediu…</p>
        <p className="text-[13px] leading-relaxed text-cimento">
          A carteira não mostra nada pra assinar antes de o navegador confirmar de onde veio o pedido.
        </p>
        {msg && <p className="text-[12px] text-baixa">{msg}</p>}
      </Moldura>
    );
  }

  if (w.estado === 'sem-cofre') {
    return (
      <Moldura>
        <p className="font-display text-[26px] uppercase leading-[1.1]">Sem carteira aqui</p>
        <p className="text-[13px] leading-relaxed text-cimento">
          Crie ou restaure uma OLEWALLET neste aparelho e volte a pedir a conexão pelo jogo.
        </p>
        <a href="/" className={`${BOTAO_VOLT} mt-2`}>Criar carteira</a>
        <button type="button" className={BOTAO_LINHA} onClick={recusar}>Cancelar</button>
      </Moldura>
    );
  }

  if (w.estado === 'trancada') {
    return (
      <Moldura>
        <p className="font-mono text-[11px] text-poeira">#trancada</p>
        <p className="font-display text-[26px] uppercase leading-[1.1]">Sua senha</p>
        <p className="text-[13px] text-cimento">
          <span className="font-mono text-white">{quemPediu.replace(/^https?:\/\//, '')}</span> quer vincular sua carteira.
        </p>
        <input type="password" className={CAMPO} placeholder="senha" value={senha} autoFocus
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void destrancar(); }} />
        {(msg ?? w.erro) && <p className="text-[12px] text-baixa">{msg ?? w.erro}</p>}
        <button type="button" className={BOTAO_VOLT} disabled={w.ocupado || !senha} onClick={() => void destrancar()}>
          {w.ocupado ? 'Abrindo…' : 'Abrir carteira'}
        </button>
        <button type="button" className={BOTAO_LINHA} onClick={recusar}>Cancelar</button>
      </Moldura>
    );
  }

  if (w.estado === 'aberta' && w.chave) {
    return (
      <Moldura>
        <p className="font-mono text-[11px] text-poeira">#conectar</p>
        <h1 className="font-display text-[28px] uppercase leading-[1.1]">Vincular sua carteira</h1>

        <div className="border border-white/10 bg-panel px-3.5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">Quem está pedindo</p>
          <p className="mt-1 font-mono text-[14px] text-white">{quemPediu.replace(/^https?:\/\//, '')}</p>
        </div>

        <div className="border border-white/10 bg-panel px-3.5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">Sua carteira</p>
          <p className="mt-1 font-mono text-[13px]" style={{ wordBreak: 'break-all' }}>{w.chave.endereco}</p>
        </div>

        <div className="border-l-[3px] border-alta bg-sheet px-3.5 py-3">
          <p className="text-[12px] leading-relaxed text-giz">
            Isto é uma <strong className="text-white">assinatura</strong>, não uma transação.
            Não move fundos, não custa taxa, e o texto assinado é montado aqui — não por quem pediu.
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-2.5">
          <button type="button" className={BOTAO_VOLT} onClick={assinarEDevolver}>Assinar e vincular</button>
          <button type="button" className={BOTAO_LINHA} onClick={recusar}>Recusar</button>
        </div>
      </Moldura>
    );
  }

  return <Moldura><p className="text-[13px] text-cimento">Carregando…</p></Moldura>;
}
