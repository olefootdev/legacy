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
import { TelaComprar, TelaDepositar, TelaEnviar, TelaRender, TelaProducao } from './Telas';

/**
 * O split da colheita, com os MESMOS números de server/src/lib/harvestSplit.ts.
 * Mostrar a régua antes de existir rendimento é o que deixa a conta conferível
 * quando ele existir — e a casa fica travada em 25%, como no servidor.
 */
const SPLIT_DA_COLHEITA = [
  { rotulo: 'VOCÊ', pct: 50, nota: 'voce' },
  { rotulo: 'MEU CLUBE', pct: 10 },
  { rotulo: 'MANAGER', pct: 5 },
  { rotulo: 'CAPITÃO', pct: 5 },
  { rotulo: 'PRO', pct: 5 },
  { rotulo: 'OLEFOOT', pct: 25, nota: 'casa' },
] as const;
import { tradutor } from '@/i18n/idioma';
import { useIdioma } from '@/i18n/useIdioma';
import CriarOuRestaurar, { type Passo } from './CriarOuRestaurar';
import Receber from './Receber';
import Extrato from './Extrato';
import { buscarSaldo, type Saldo } from './api';
import { TEXTOS } from './textos';
import { BOTAO_LINHA, BOTAO_VOLT, Barra, CAMPO } from './ui';

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
  type Vista = 'carteira' | 'receber' | 'extrato' | 'enviar' | 'depositar' | 'comprar' | 'render' | 'producao';
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
  if (vista === 'enviar' || vista === 'depositar' || vista === 'comprar' || vista === 'render' || vista === 'producao') {
    const titulo = vista === 'enviar' ? t('acaoEnviar')
      : vista === 'depositar' ? t('acaoDepositar')
      : vista === 'comprar' ? t('acaoComprar')
      : vista === 'producao' ? t('splitTitulo') : t('abaRender');
    return (
      <div className="flex min-h-full flex-col bg-asfalto">
        <Barra titulo={titulo}
               onVoltar={() => { if (vista === 'producao') { setVista('render'); return; } setVista('carteira'); setAba('carteira'); }} />
        <div className="mx-auto w-full max-w-md flex-1 px-4 pb-8 pt-5">
          {vista === 'enviar' && <TelaEnviar />}
          {vista === 'depositar' && <TelaDepositar />}
          {vista === 'comprar' && <TelaComprar linkPreVenda={`${ORIGEM_DO_JOGO}/expansao`} />}
          {vista === 'render' && <TelaRender split={SPLIT_DA_COLHEITA} linkProducao={() => setVista('producao')} />}
          {vista === 'producao' && <TelaProducao split={SPLIT_DA_COLHEITA} />}
        </div>
        <Abas atual={aba} linkRede={`${ORIGEM_DO_JOGO}/expansao`}
              ir={(a) => { setAba(a); setVista(a === 'carteira' ? 'carteira' : a === 'comprar' ? 'comprar' : 'render'); }} />
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
              a tela que diz o que falta — melhor que botão que não existe. */}
          <div className="grid grid-cols-4 gap-2">
            {([
              ['enviar', t('acaoEnviar'), 'M12 19V5M5 12l7-7 7 7', true],
              ['receber', t('acaoReceber'), 'M12 5v14M19 12l-7 7-7-7', false],
              ['depositar', t('acaoDepositar'), 'M12 3v12M8 11l4 4 4-4M4 21h16', false],
              ['comprar', t('acaoComprar'), 'M6 6h15l-1.5 9h-12z', false],
            ] as const).map(([id, rotulo, d, destaque]) => (
              <button key={id} type="button" onClick={() => setVista(id)}
                className="flex h-16 flex-col items-center justify-center gap-1 border"
                style={destaque
                  ? { background: '#FDE100', borderColor: '#FDE100', color: '#0D0D0D',
                      clipPath: 'polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)' }
                  : { background: '#1B1D1F', borderColor: 'rgba(255,255,255,0.10)', color: '#FFF' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke={destaque ? '#0D0D0D' : '#FFF'} strokeWidth="2.4"><path d={d} /></svg>
                <span className="font-num text-[10px] font-extrabold uppercase">{rotulo}</span>
              </button>
            ))}
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
            href={`${ORIGEM_DO_JOGO}/expansao`}
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
        <Abas atual={aba} linkRede={`${ORIGEM_DO_JOGO}/expansao`}
              ir={(a) => { setAba(a); setVista(a === 'carteira' ? 'carteira' : a === 'comprar' ? 'comprar' : 'render'); }} />
      </div>
    );
  }

  const titulo = passo === 'frase' ? t('tituloFrase')
    : passo === 'restaurar' ? t('tituloRestaurar')
    : passo === 'senha' ? t('tituloSenha') : undefined;

  return (
    <div className="flex min-h-full flex-col bg-asfalto">
      <Barra titulo={titulo} onVoltar={passo === 'inicio' ? undefined : () => setPasso(passo === 'senha' ? 'frase' : 'inicio')} />
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
