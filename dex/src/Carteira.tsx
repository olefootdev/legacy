/**
 * OLEWALLET — a carteira, em dex.olefoot.com.
 *
 * Note o que esta tela NÃO tem: botão de vincular. Vincular é assinar pra outro
 * site, e isso acontece em /conectar, com o pedido na tela e a pessoa dizendo
 * sim. Carteira que assina sozinha porque a página abriu não é carteira.
 */
import { useCallback, useEffect, useState } from 'react';
import { useCarteira } from '@/wallet/seed/useCarteira';
import { tradutor } from '@/i18n/idioma';
import { useIdioma } from '@/i18n/useIdioma';
import CriarOuRestaurar, { type Passo } from './CriarOuRestaurar';
import Receber from './Receber';
import Extrato from './Extrato';
import { buscarSaldo, type Saldo } from './api';
import { TEXTOS } from './textos';
import { BOTAO_LINHA, BOTAO_VOLT, Barra, CAMPO } from './ui';

export default function Carteira() {
  const w = useCarteira();
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  const [passo, setPasso] = useState<Passo>('inicio');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [vista, setVista] = useState<'carteira' | 'receber' | 'extrato'>('carteira');

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

          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={BOTAO_VOLT} onClick={() => setVista('receber')}>{t('receber')}</button>
            <button type="button" className={BOTAO_LINHA} onClick={() => setVista('extrato')}>{t('extrato')}</button>
          </div>

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
