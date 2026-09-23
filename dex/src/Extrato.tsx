/**
 * Extrato — o que passou por este endereço.
 *
 * Mostra assinatura, data e se falhou. NÃO mostra valor: pra isso seria um
 * `getTransaction` por linha e a conta de entrada/saída feita do zero aqui.
 * Número errado de dinheiro na tela destrói confiança mais rápido do que a
 * falta dele, e o explorador — que não é nosso — já faz essa conta certa. Cada
 * linha leva pra lá.
 */
import { useCallback, useEffect, useState } from 'react';
import { tradutor } from '@/i18n/idioma';
import { useIdioma } from '@/i18n/useIdioma';
import { buscarHistorico, type LinhaExtrato } from './api';
import { TEXTOS } from './textos';
import { BOTAO_LINHA, BOTAO_VOLT, Barra } from './ui';

const EXPLORADOR = (assinatura: string) => `https://solscan.io/tx/${assinatura}`;

function quando(iso: string | null, idioma: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(idioma === 'pt' ? 'pt-BR' : 'en-US', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function Extrato({ endereco, onVoltar }: { endereco: string; onVoltar: () => void }) {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  const [linhas, setLinhas] = useState<LinhaExtrato[] | null>(null);
  const [buscando, setBuscando] = useState(true);
  const [erro, setErro] = useState(false);

  const buscar = useCallback(async () => {
    setBuscando(true); setErro(false);
    const r = await buscarHistorico(endereco);
    if (r === null) setErro(true); else setLinhas(r);
    setBuscando(false);
  }, [endereco]);

  useEffect(() => { void buscar(); }, [buscar]);

  return (
    <div className="flex min-h-full flex-col bg-asfalto">
      <Barra titulo={t('tituloExtrato')} onVoltar={onVoltar} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3.5 px-4 pb-8 pt-5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] text-poeira">#onchain</p>
          <button type="button" className="border border-white/25 px-2.5 py-1 text-[12px]"
            onClick={() => void buscar()} disabled={buscando}>{t('atualizar')}</button>
        </div>

        {buscando && <p className="text-[13px] text-cimento">{t('carregandoLista')}</p>}
        {erro && !buscando && <p className="text-[13px] text-baixa">{t('naoDeuLista')}</p>}

        {!buscando && !erro && linhas?.length === 0 && (
          <div className="border border-white/10 bg-panel px-3.5 py-5">
            <p className="font-num text-[15px] font-extrabold uppercase">{t('semMovimento')}</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-cimento">{t('semMovimentoTxt')}</p>
          </div>
        )}

        {!buscando && !erro && linhas && linhas.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {linhas.map((l) => (
              <a key={l.assinatura} href={EXPLORADOR(l.assinatura)} target="_blank" rel="noreferrer noopener"
                className="flex items-center gap-3 border border-white/10 bg-panel px-3.5 py-3">
                <span className={`h-2 w-2 shrink-0 ${l.falhou ? 'bg-baixa' : 'bg-alta'}`} />
                <div className="min-w-0 flex-grow">
                  <p className="truncate font-mono text-[12px] text-white">
                    {l.assinatura.slice(0, 10)}…{l.assinatura.slice(-6)}
                  </p>
                  <p className="font-mono text-[11px] text-poeira">
                    {quando(l.quando, idioma)}{l.falhou ? ` · ${t('falhou')}` : ''}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-neon-yellow">{t('verNoExplorador')} ↗</span>
              </a>
            ))}
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-poeira">{t('tudoOnChain')}</p>

        <button type="button" className={`${BOTAO_VOLT} mt-auto`} onClick={onVoltar}>{t('voltar')}</button>
      </div>
    </div>
  );
}
