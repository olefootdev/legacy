import { tradutor } from '@/i18n/idioma';
import { useIdioma } from '@/i18n/useIdioma';
import { TEXTOS } from './textos';
import { AindaNao } from './Abas';
import { BOTAO_VOLT } from './ui';

/**
 * As telas que o desenho pede e cujo motor ainda não existe.
 *
 * 🔑 Elas EXISTEM em vez de não existir, e dizem o que falta em vez de fingir.
 * Uma aba que não abre é bug; uma aba que abre e explica é produto. E prometer
 * rendimento sobre um token que não está na rede seria mentira — então a tela
 * diz isso com todas as letras.
 */

export function TelaComprar({ linkPreVenda }: { linkPreVenda: string }) {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  return (
    <div className="flex flex-col gap-3">
      <AindaNao titulo={t('acaoComprar')} oQueFalta={t('comprarFalta')}>
        <a href={linkPreVenda} className={`${BOTAO_VOLT} mt-4 block text-center`}>
          {t('comprarIr')}
        </a>
      </AindaNao>
    </div>
  );
}

export function TelaRender({ split }: { split: ReadonlyArray<{ readonly rotulo: string; readonly pct: number; readonly nota?: string }> }) {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  const total = split.reduce((s, p) => s + p.pct, 0);
  return (
    <div className="flex flex-col gap-3">
      <AindaNao titulo={t('abaRender')} oQueFalta={t('renderFalta')} />

      {/* O split é DADO REAL: sai de harvestSplit.ts, o mesmo que o servidor usa.
          Mostrar a régua antes de existir rendimento é o que deixa a conta
          conferível quando ele existir. */}
      <div className="border border-white/10 bg-panel px-4 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">{t('splitTitulo')}</p>

        <div className="mt-3 flex h-3 gap-[2px]">
          {split.map((p) => (
            <div key={p.rotulo} style={{ width: `${p.pct}%`, background: p.nota === 'casa' ? '#25282B' : p.nota === 'voce' ? '#FDE100' : '#22C55E' }} />
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          {split.map((p) => (
            <div key={p.rotulo} className="flex items-center justify-between border border-white/10 bg-card px-3 py-2">
              <span className="font-num text-[13px] font-extrabold uppercase text-giz">{p.rotulo}</span>
              <span className="ole-num text-[15px] font-bold"
                    style={{ color: p.nota === 'casa' ? '#9A9C9F' : p.nota === 'voce' ? '#FDE100' : '#22C55E' }}>
                {p.pct}%
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-baseline justify-between px-0.5">
          <span className="font-mono text-[11px] text-poeira">{t('splitTotal')}</span>
          <span className="ole-num text-[15px] font-bold text-giz">{total}%</span>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-poeira">{t('splitNota')}</p>
      </div>
    </div>
  );
}

export function TelaDepositar() {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  return <AindaNao titulo={t('acaoDepositar')} oQueFalta={t('depositarFalta')} />;
}

export function TelaEnviar() {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  return <AindaNao titulo={t('acaoEnviar')} oQueFalta={t('enviarFalta')} />;
}
