/**
 * OLEWALLET — a carteira, em dex.olefoot.ai.
 *
 * Note o que esta tela NÃO tem: botão de vincular. Vincular é assinar pra outro
 * site, e isso acontece em /conectar, com o pedido na tela e a pessoa dizendo
 * sim. Carteira que assina sozinha porque a página abriu não é carteira.
 */
import { useCallback, useEffect, useState } from 'react';
import { useCarteira } from '@/wallet/seed/useCarteira';
import { ORIGENS_QUE_PODEM_PEDIR } from '@/wallet/seed/conexao';
import { Abas, type Aba } from './Abas';
import { TelaDepositar, TelaEnviar } from './Telas';
import { tradutor } from '@/i18n/idioma';
import { useIdioma } from '@/i18n/useIdioma';
import CriarOuRestaurar, { passoAnterior, type Passo } from './CriarOuRestaurar';
import Receber from './Receber';
import Extrato from './Extrato';
import { buscarSaldo, type Saldo } from './api';
import { TEXTOS } from './textos';
import { Aviso, BOTAO_LINHA, BOTAO_VOLT, Barra, CAMPO } from './ui';

/**
 * Onde o jogo mora, tirado do MESMO allowlist que autoriza pedido de
 * assinatura — pra não existirem dois lugares dizendo onde o jogo está, que é
 * como um deles envelhece sem ninguém perceber.
 */
const ORIGEM_DO_JOGO = ORIGENS_QUE_PODEM_PEDIR.find((o) => o.startsWith('https://')) ?? 'https://game.olefoot.ai';

export default function Carteira() {
  const w = useCarteira();
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  const [passo, setPasso] = useState<Passo>('inicio');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  type Vista = 'carteira' | 'receber' | 'extrato' | 'enviar' | 'depositar';
  const [vista, setVista] = useState<Vista>('carteira');
  const [aba, setAba] = useState<Aba>('carteira');

  const atualizarSaldo = useCallback(async (e: string) => { setSaldo(await buscarSaldo(e)); }, []);

  useEffect(() => {
    if (w.estado === 'aberta' && w.endereco) void atualizarSaldo(w.endereco);
  }, [w.estado, w.endereco, atualizarSaldo]);

  const destrancar = async () => {
    setMsg(null);
    try { await w.destrancar(senha); setSenha(''); }
    catch (e) { setMsg(e instanceof Error ? e.message : t('naoDeu')); }
  };

  if (w.estado === 'carregando') return <div className="min-h-full bg-asfalto" />;

  if (w.estado === 'trancada') {
    return (
      <div className="flex min-h-full flex-col bg-asfalto">
        <Barra />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4">
          <div>
            <p className="font-mono text-[11px] text-poeira">{t('trancada')}</p>
            <h1 className="mt-1 font-display text-[30px] uppercase leading-[1.1]">{t('suaSenha')}</h1>
          </div>
          {w.trancouSozinha && (
            <p className="border-l-2 border-atencao bg-panel px-3 py-2.5 text-[12px] leading-relaxed text-giz">
              {t('trancouSozinha')}
            </p>
          )}
          <input type="password" className={CAMPO} placeholder={t('senha')} value={senha} autoFocus
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void destrancar(); }} />
          {(msg ?? w.erro) && <p className="text-[12px] text-baixa">{msg ?? w.erro}</p>}
          <button type="button" className={BOTAO_VOLT} disabled={w.ocupado || !senha} onClick={() => void destrancar()}>
            {w.ocupado ? t('abrindo') : t('abrirCarteira')}
          </button>
          <button type="button" className="text-[12px] text-poeira underline"
            onClick={() => { if (confirm(t('confirmaApagar'))) w.esquecer(); }}>
            {t('esqueciSenha')}
          </button>
        </div>
      </div>
    );
  }

  if (w.estado === 'aberta' && w.chave && vista === 'receber') {
    return <Receber endereco={w.chave.endereco} onVoltar={() => setVista('carteira')} />;
  }
  if (w.estado === 'aberta' && w.chave && vista === 'extrato') {
    return <Extrato endereco={w.chave.endereco} onVoltar={() => setVista('carteira')} />;
  }
  if (vista === 'enviar' || vista === 'depositar') {
    return (
      <div className="flex min-h-full flex-col bg-asfalto">
        <Barra titulo={vista === 'enviar' ? t('acaoEnviar') : t('acaoDepositar')}
               onVoltar={() => { setVista('carteira'); setAba('carteira'); }} />
        <div className="mx-auto w-full max-w-md flex-1 px-4 pb-8 pt-5">
          {vista === 'enviar' ? <TelaEnviar /> : <TelaDepositar />}
        </div>
        <Abas atual={aba} linkRede={`${ORIGEM_DO_JOGO}/wallet/network`}
              ir={(a) => { setAba(a); setVista('carteira'); }} />
      </div>
    );
  }

  if (w.estado === 'aberta' && w.chave) {
    const endereco = w.chave.endereco;
    return (
      <div className="flex min-h-full flex-col bg-asfalto">
        <Barra />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-8 pt-5">
          <div>
            <p className="font-mono text-[11px] text-poeira">#solana</p>
            <p className="ole-num mt-0.5 text-[40px] leading-[1.05]">{saldo ? saldo.sol.toFixed(4) : '—'}</p>
            <p className="text-[12px] text-cimento">{t('solNesteEnd')}</p>
          </div>

          {/* Grade de 4 ações, como o desenho pede. Enviar e Depositar abrem
              a tela que diz o que falta — melhor que botão que não existe.
              Comprar vai direto à gaveta do jogo: o preço mora lá, lido do
              servidor, e é assim que não existem dois lugares dizendo números. */}
          <div className="grid grid-cols-4 gap-2">
            {([
              ['enviar', t('acaoEnviar'), 'M12 19V5M5 12l7-7 7 7', true],
              ['receber', t('acaoReceber'), 'M12 5v14M19 12l-7 7-7-7', false],
              ['depositar', t('acaoDepositar'), 'M12 3v12M8 11l4 4 4-4M4 21h16', false],
              ['comprar', t('acaoComprar'), 'M6 6h15l-1.5 9h-12z', false],
            ] as const).map(([id, rotulo, d, destaque]) => {
              const classe = 'flex h-16 flex-col items-center justify-center gap-1 border';
              const estilo = destaque
                ? { background: '#FDE100', borderColor: '#FDE100', color: '#0D0D0D',
                    clipPath: 'polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)' }
                : { background: '#1B1D1F', borderColor: 'rgba(255,255,255,0.10)', color: '#FFF' };
              const conteudo = (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                       stroke={destaque ? '#0D0D0D' : '#FFF'} strokeWidth="2.4"><path d={d} /></svg>
                  <span className="font-num text-[10px] font-extrabold uppercase">{rotulo}</span>
                </>
              );
              return id === 'comprar' ? (
                <a key={id} href={`${ORIGEM_DO_JOGO}/wallet?adicionar=olefoot`} className={classe} style={estilo}>
                  {conteudo}
                </a>
              ) : (
                <button key={id} type="button" onClick={() => setVista(id)} className={classe} style={estilo}>
                  {conteudo}
                </button>
              );
            })}
          </div>

          {/* NA REDE — o que está on-chain de verdade */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="h-[2px] w-3.5 bg-neon-yellow" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">{t('naRede')}</span>
            </div>
            <Moeda sigla="SOL" sub="Solana" valor={saldo ? saldo.sol.toFixed(4) : '—'} />
            <Moeda sigla="OLEFOOT" sub="Token · Solana" valor="—" nota={t('tokenNaoLancado')} />
          </div>

          {/* EXPANSÃO — o lado de negócios, dentro da carteira.
              🔑 O painel é servido pela origem do JOGO de propósito: os dados
              da árvore estão no Supabase atrás de RLS, e esta origem guarda a
              frase de 12 palavras. Quanto menos código roda aqui, melhor. Pra
              quem usa, é um toque; a troca de origem não aparece. */}
          <a
            href={`${ORIGEM_DO_JOGO}/wallet/network`}
            className="block border border-neon-yellow/30 bg-panel px-3.5 py-3.5 transition-colors hover:border-neon-yellow/60"
          >
            <div className="flex items-center justify-between">
              <p className="font-num text-[13px] font-extrabold uppercase text-neon-yellow">{t('expansao')}</p>
              <span className="font-mono text-[14px] text-neon-yellow">→</span>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-cimento">{t('expansaoTexto')}</p>
          </a>

          <div className="border border-white/10 bg-panel px-3.5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">{t('seuEndereco')}</p>
            <p className="mt-1 font-mono text-[13px]" style={{ wordBreak: 'break-all' }}>{endereco}</p>
            <div className="mt-2.5 flex gap-2">
              <button type="button" className="border border-white/25 px-2.5 py-1.5 text-[12px]"
                onClick={() => void navigator.clipboard.writeText(endereco)}>{t('copiar')}</button>
              <button type="button" className="border border-white/25 px-2.5 py-1.5 text-[12px]"
                onClick={() => void atualizarSaldo(endereco)}>{t('saldo')}</button>
            </div>
          </div>

          <VerFrase verFrase={w.verFrase} />

          <div className="border border-white/10 bg-panel px-3.5 py-3.5">
            <p className="font-num text-[13px] font-extrabold uppercase">{t('ligarAoJogo')}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-cimento">{t('ligarTexto')}</p>
          </div>

          <div className="mt-auto flex gap-2">
            <button type="button" className={BOTAO_LINHA} onClick={w.trancar}>{t('trancar')}</button>
            <button type="button" className={`${BOTAO_LINHA} border-baixa/40 text-baixa`}
              onClick={() => { if (confirm(t('confirmaApagar'))) w.esquecer(); }}>
              {t('apagar')}
            </button>
          </div>
        </div>
        <Abas atual={aba} linkRede={`${ORIGEM_DO_JOGO}/wallet/network`}
              ir={(a) => { setAba(a); setVista('carteira'); }} />
      </div>
    );
  }

  const titulo = passo === 'frase' ? t('tituloFrase')
    : passo === 'conferir' ? t('tituloConferir')
    : passo === 'restaurar' ? t('tituloRestaurar')
    : passo === 'senha' ? t('tituloSenha') : undefined;

  return (
    <div className="flex min-h-full flex-col bg-asfalto">
      <Barra titulo={titulo} onVoltar={passo === 'inicio' ? undefined : () => setPasso(passoAnterior(passo))} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-5 pb-8 pt-4">
        <CriarOuRestaurar w={w} passo={passo} setPasso={setPasso} />
      </div>
    </div>
  );
}

/** Linha de token. `nota` aparece quando o ativo ainda não existe na rede. */
function Moeda({ sigla, sub, valor, nota }: {
  sigla: string; sub: string; valor: string; nota?: string;
}) {
  return (
    <div className="flex items-center gap-3 border border-white/10 bg-panel px-3.5 py-3">
      <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center bg-sheet
                      font-num text-[12px] font-extrabold text-ouro">
        {sigla.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-num text-[14px] font-extrabold leading-tight">{sigla}</div>
        <div className="text-[11px] text-poeira">{sub}</div>
      </div>
      <div className="text-right">
        <div className="ole-num text-[15px] font-bold" style={{ color: nota ? '#7E8185' : '#E8B331' }}>{valor}</div>
        {nota && <div className="font-mono text-[10px] text-poeira">{nota}</div>}
      </div>
    </div>
  );
}

/**
 * Ver a frase depois de criada. Pede a senha deste aparelho de novo — estar
 * com a carteira aberta não basta, porque a carteira aberta pode ser o celular
 * de outra pessoa esquecido na mesa. A frase fica em estado local, some em
 * 60 segundos e não tem botão de copiar.
 */
function VerFrase({ verFrase }: { verFrase: (senha: string) => Promise<string[]> }) {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState('');
  const [palavras, setPalavras] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!palavras) return;
    const id = setTimeout(() => setPalavras(null), 60_000);
    return () => clearTimeout(id);
  }, [palavras]);

  const fechar = () => { setAberto(false); setSenha(''); setPalavras(null); setErro(null); };
  const mostrar = async () => {
    setErro(null);
    try { setPalavras(await verFrase(senha)); setSenha(''); }
    catch (e) { setErro(e instanceof Error ? e.message : t('naoDeu')); }
  };

  if (!aberto) {
    return (
      <button type="button" className={BOTAO_LINHA} onClick={() => setAberto(true)}>{t('verFrase')}</button>
    );
  }
  return (
    <div className="flex flex-col gap-2.5 border border-white/10 bg-panel px-3.5 py-3.5">
      <p className="font-num text-[13px] font-extrabold uppercase">{t('verFrase')}</p>
      {palavras ? (
        <>
          <Aviso titulo={t('anoteNoPapel')}>{t('anoteTexto')}</Aviso>
          <div className="grid grid-cols-3 gap-2">
            {palavras.map((p, i) => (
              <div key={`${i}-${p}`} className="flex items-baseline gap-1.5 border border-white/10 bg-asfalto px-2 py-2.5">
                <span className="font-mono text-[10px] text-poeira">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-mono text-[13px]">{p}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-[12px] leading-relaxed text-cimento">{t('verFraseTexto')}</p>
          <input type="password" className={CAMPO} placeholder={t('senha')} value={senha} autoFocus
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && senha) void mostrar(); }} />
          {erro && <p className="text-[12px] text-baixa">{erro}</p>}
          <button type="button" className={BOTAO_VOLT} disabled={!senha} onClick={() => void mostrar()}>
            {t('mostrar')}
          </button>
        </>
      )}
      <button type="button" className="text-[12px] text-poeira underline" onClick={fechar}>{t('esconder')}</button>
    </div>
  );
}
