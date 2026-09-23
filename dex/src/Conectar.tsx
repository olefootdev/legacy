/**
 * /conectar — outro site pede uma assinatura.
 *
 * É a tela mais perigosa da carteira, porque é a única em que alguém de fora
 * fala com ela. Três coisas a defendem:
 *
 *   1. A ORIGEM VEM DO NAVEGADOR. Não do `document.referrer`, não de um
 *      parâmetro. Ela chega no `event.origin` de um postMessage, que o browser
 *      preenche e nenhum site consegue falsificar.
 *   2. O QUE SE ASSINA É MONTADO AQUI, com o endereço que ESTA carteira tem.
 *      Se quem pede escolhesse o texto, "assine este texto" viraria "assine
 *      esta transferência".
 *   3. A PESSOA VÊ QUEM PEDIU E DECIDE.
 *
 * ⚠️ A ORDEM DAS TELAS É PARTE DA CORREÇÃO. A primeira versão prendia TUDO
 * atrás da confirmação da origem — quem abria caía num "Confirmando quem
 * pediu…" sem botão nenhum, nem pra entrar na própria carteira. Mas a trava só
 * precisa valer pra ASSINAR: entrar e criar são ações da pessoa na carteira
 * dela, e quem pediu não tem nada a ver com isso. Agora ela entra ou cria na
 * hora, e o aperto de mão corre em paralelo; a confirmação da origem gateia
 * apenas o botão de assinar.
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
import { tradutor } from '@/i18n/idioma';
import { useIdioma } from '@/i18n/useIdioma';
import CriarOuRestaurar, { type Passo } from './CriarOuRestaurar';
import { TEXTOS } from './textos';
import { BOTAO_LINHA, BOTAO_VOLT, Barra, CAMPO } from './ui';

const paraB64 = (b: Uint8Array): string => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};

type Fim = 'assinado' | 'recusado' | null;

export default function Conectar() {
  const w = useCarteira();
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  const [pedido] = useState<PedidoDeAssinatura | null>(() => lerPedido(window.location.search));
  const [quemPediu, setQuemPediu] = useState<string | null>(null);
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [fim, setFim] = useState<Fim>(null);
  const [passo, setPasso] = useState<Passo>('inicio');
  const janela = useRef<Window | null>(null);

  // O aperto de mão roda desde o começo, em paralelo com o que a pessoa faz.
  useEffect(() => {
    const abriu = window.opener as Window | null;
    if (!abriu) return;

    const aoReceber = (e: MessageEvent) => {
      if (!ehOla(e.data)) return;
      if (!origemPermitida(e.origin)) {
        setMsg(`${e.origin} → ✕`);
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
    responder({ tipo: 'recusado', motivo: t('vocêRecusou') });
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
    catch (e) { setMsg(e instanceof Error ? e.message : t('naoDeu')); }
  };

  const Moldura = ({ titulo, onVoltar, children }: { titulo?: string; onVoltar?: () => void; children: React.ReactNode }) => (
    <div className="flex min-h-full flex-col bg-asfalto">
      <Barra titulo={titulo ?? t('tituloConectar')} onVoltar={onVoltar} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-4 pb-8 pt-5">{children}</div>
    </div>
  );

  /** Quem pediu, quando já se sabe. Enquanto não, diz que está conferindo. */
  const Pedinte = () => (
    <div className="border border-white/10 bg-panel px-3.5 py-2.5">
      {quemPediu ? (
        <p className="text-[12px] text-cimento">
          <span className="font-mono text-white">{quemPediu.replace(/^https?:\/\//, '')}</span>{' '}
          {t('pediuConexao')}
        </p>
      ) : (
        <p className="font-mono text-[11px] text-poeira">{t('conferindo')}</p>
      )}
    </div>
  );

  if (fim) {
    return (
      <Moldura>
        <p className="font-display text-[26px] uppercase">{fim === 'assinado' ? t('assinado') : t('recusado')}</p>
        <p className="text-[13px] text-cimento">{t('podeFechar')}</p>
      </Moldura>
    );
  }

  if (w.estado === 'carregando') return <div className="min-h-full bg-asfalto" />;

  // --- SEM CARTEIRA: cria aqui dentro, sem esperar o aperto de mão ---------
  if (w.estado === 'sem-cofre') {
    const naEtapa = passo !== 'inicio';
    return (
      <Moldura
        titulo={passo === 'frase' ? t('tituloFrase') : passo === 'restaurar' ? t('tituloRestaurar') : passo === 'senha' ? t('tituloSenha') : undefined}
        onVoltar={naEtapa ? () => setPasso(passo === 'senha' ? 'frase' : 'inicio') : undefined}
      >
        {!naEtapa && <Pedinte />}
        <CriarOuRestaurar
          w={w} passo={passo} setPasso={setPasso}
          chamada={{ titulo: t('criarAquiTitulo'), texto: t('criarAquiTexto') }}
        />
        {!naEtapa && quemPediu && (
          <button type="button" className={BOTAO_LINHA} onClick={recusar}>{t('agoraNao')}</button>
        )}
      </Moldura>
    );
  }

  // --- TRANCADA: entrar, sem esperar o aperto de mão -----------------------
  if (w.estado === 'trancada') {
    return (
      <Moldura>
        <Pedinte />
        <h1 className="mt-1 whitespace-pre-line font-display text-[30px] uppercase leading-[1.1]">{t('entrarTitulo')}</h1>
        <p className="text-[13px] leading-relaxed text-cimento">{t('entrarTexto')}</p>
        <input type="password" className={CAMPO} placeholder={t('senha')} value={senha} autoFocus
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void destrancar(); }} />
        {(msg ?? w.erro) && <p className="text-[12px] text-baixa">{msg ?? w.erro}</p>}
        <button type="button" className={BOTAO_VOLT} disabled={w.ocupado || !senha} onClick={() => void destrancar()}>
          {w.ocupado ? t('abrindo') : t('entrar')}
        </button>
        <button type="button" className="text-[12px] text-poeira underline"
          onClick={() => { if (confirm(t('confirmaApagar'))) w.esquecer(); }}>
          {t('esqueciSenha')}
        </button>
        {quemPediu && (
          <button type="button" className={`${BOTAO_LINHA} mt-auto`} onClick={recusar}>{t('agoraNao')}</button>
        )}
      </Moldura>
    );
  }

  // --- ABERTA, mas o pedido não vale: diz o que fazer ----------------------
  if (!pedido) {
    return (
      <Moldura>
        <p className="font-display text-[26px] uppercase">{t('pedidoInvalido')}</p>
        <p className="text-[13px] leading-relaxed text-cimento">{t('pedidoInvTexto')}</p>
        <a href="/" className={`${BOTAO_VOLT} mt-2`}>{t('irParaCarteira')}</a>
      </Moldura>
    );
  }

  // --- ABERTA, mas ninguém confirmou quem pediu ----------------------------
  if (!quemPediu) {
    return (
      <Moldura>
        <p className="font-display text-[26px] uppercase leading-[1.1]">{t('quaseLa')}</p>
        <p className="text-[13px] leading-relaxed text-cimento">{t('abraPeloJogo')}</p>
        {msg && <p className="font-mono text-[12px] text-baixa">{msg}</p>}
        <a href="/" className={`${BOTAO_VOLT} mt-2`}>{t('irParaCarteira')}</a>
      </Moldura>
    );
  }

  // --- ABERTA e origem confirmada: a única tela com botão de assinar -------
  if (w.chave) {
    return (
      <Moldura>
        <h1 className="font-display text-[28px] uppercase leading-[1.1]">{t('vincularTitulo')}</h1>

        <div className="border border-white/10 bg-panel px-3.5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">{t('quemPediu')}</p>
          <p className="mt-1 font-mono text-[14px] text-white">{quemPediu.replace(/^https?:\/\//, '')}</p>
        </div>

        <div className="border border-white/10 bg-panel px-3.5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">{t('suaCarteira')}</p>
          <p className="mt-1 font-mono text-[13px]" style={{ wordBreak: 'break-all' }}>{w.chave.endereco}</p>
        </div>

        <div className="border-l-[3px] border-alta bg-sheet px-3.5 py-3">
          <p className="text-[12px] leading-relaxed text-giz">
            {t('ehAssinaturaA')}<strong className="text-white">{t('ehAssinaturaB')}</strong>{t('ehAssinaturaC')}
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-2.5">
          <button type="button" className={BOTAO_VOLT} onClick={assinarEDevolver}>{t('assinarEVincular')}</button>
          <button type="button" className={BOTAO_LINHA} onClick={recusar}>{t('recusar')}</button>
        </div>
      </Moldura>
    );
  }

  return <Moldura><p className="text-[13px] text-cimento">{t('carregando')}</p></Moldura>;
}
