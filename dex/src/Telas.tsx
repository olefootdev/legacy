import { useState } from 'react';
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

/** Os prazos e multiplicadores publicados. Regra, não promessa. */
const PRAZOS = [
  { dias: '30d', mult: '1,0×' },
  { dias: '90d', mult: '1,5×' },
  { dias: '180d', mult: '2,0×' },
  { dias: '360d', mult: '3,0×' },
] as const;

export function TelaRender({ split, linkProducao }: {
  split: ReadonlyArray<{ readonly rotulo: string; readonly pct: number; readonly nota?: string }>;
  linkProducao: () => void;
}) {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  const [sub, setSub] = useState<'stake' | 'vault'>('stake');

  return (
    <div className="flex flex-col gap-3">
      {/* sub-abas, como no desenho */}
      <div className="grid grid-cols-2 border-b border-white/10">
        {([['stake', t('subStake')], ['vault', t('subVault')]] as const).map(([id, rotulo]) => (
          <button key={id} type="button" onClick={() => setSub(id)}
            className="flex h-11 items-center justify-center font-num text-[11px] font-extrabold uppercase"
            style={sub === id
              ? { color: '#FDE100', borderBottom: '2px solid #FDE100' }
              : { color: '#7E8185' }}>
            {rotulo}
          </button>
        ))}
      </div>

      {sub === 'stake' ? (
        <>
          <AindaNao titulo={t('subStake')} oQueFalta={t('stakeFalta')} />
          <div className="border border-white/10 bg-panel px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">{t('stakePrazo')}</p>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {PRAZOS.map((p) => (
                <div key={p.dias}
                  className="flex h-[52px] flex-col items-center justify-center gap-0.5 border border-white/10 bg-card">
                  <span className="font-mono text-[12px] text-giz">{p.dias}</span>
                  <span className="text-[9px] text-poeira">{p.mult}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-l-2 border-atencao bg-sheet px-3.5 py-3">
              <p className="text-[12px] leading-relaxed text-giz">{t('stakeRegra')}</p>
            </div>
          </div>
        </>
      ) : (
        <TelaVault split={split} linkProducao={linkProducao} />
      )}
    </div>
  );
}

function TelaVault({ split, linkProducao }: {
  split: ReadonlyArray<{ readonly rotulo: string; readonly pct: number; readonly nota?: string }>;
  linkProducao: () => void;
}) {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  void split;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-mono text-[11px] text-poeira">#vault #wsol-usdc</p>
        <h1 className="mt-1 font-num text-[24px] font-extrabold uppercase leading-tight">{t('vaultTitulo')}</h1>
        <p className="mt-1 text-[12px] text-cimento">{t('vaultSub')}</p>
      </div>

      <AindaNao titulo="" oQueFalta={t('vaultFalta')} />

      <div className="flex items-center gap-2">
        <span className="h-[2px] w-3.5 bg-neon-yellow" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">{t('vaultPosicao')}</span>
      </div>

      <div className="flex flex-col gap-2.5 border border-white/10 bg-panel px-3.5 py-3.5">
        <div className="flex items-baseline justify-between">
          <span className="font-num text-[15px] font-extrabold uppercase">WSOL / USDC</span>
          <span className="font-mono text-[11px] text-cimento">{t('vaultFaixaCheia')}</span>
        </div>
        {/* O canário e o piso de 25% são a política real do motor da casa. */}
        <div className="flex h-2 bg-sheet">
          <div className="w-[25%] bg-[#22C55E]" />
        </div>
        <div className="flex justify-between font-mono text-[10px] text-poeira">
          <span>{t('vaultCanario')}</span>
        </div>
        <div className="h-px bg-white/10" />
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-cimento">{t('vaultKill')}</span>
          <span className="font-num text-[12px] font-extrabold uppercase text-giz">—</span>
        </div>
        <p className="text-[11px] leading-relaxed text-poeira">{t('vaultKillNota')}</p>
      </div>

      {/* Backtest: número medido, e a queda aparece do mesmo tamanho do ganho. */}
      <div className="border border-white/10 bg-panel px-3.5 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">{t('vaultBacktest')}</p>
        <div className="mt-2 flex gap-5">
          <div>
            <div className="ole-num text-[18px] font-bold leading-tight text-alta">+60–77%</div>
            <div className="font-mono text-[10px] text-poeira">{t('vaultAoAno')}</div>
          </div>
          <div>
            <div className="ole-num text-[18px] font-bold leading-tight text-baixa">−32%</div>
            <div className="font-mono text-[10px] text-poeira">{t('vaultPiorQueda')}</div>
          </div>
          <div>
            <div className="ole-num text-[18px] font-bold leading-tight text-cimento">+22 / −76</div>
            <div className="font-mono text-[10px] text-poeira">{t('vaultSegurarSol')}</div>
          </div>
        </div>
      </div>

      <div className="border-l-2 border-atencao bg-sheet px-3.5 py-3">
        <p className="font-num text-[11px] font-extrabold uppercase tracking-wide text-atencao">{t('vaultAvisoTitulo')}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-giz">{t('vaultAviso')}</p>
      </div>

      <button type="button" onClick={linkProducao}
        className="self-start text-[11px] text-neon-yellow underline underline-offset-2">
        {t('vaultComoSplit')}
      </button>
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

/** O split da colheita — tela própria, alcançada pelo Vault. */
export function TelaProducao({ split }: {
  split: ReadonlyArray<{ readonly rotulo: string; readonly pct: number; readonly nota?: string }>;
}) {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);
  const total = split.reduce((s, p) => s + p.pct, 0);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-mono text-[11px] text-poeira">#split</p>
        <h1 className="mt-1 font-num text-[22px] font-extrabold uppercase leading-tight">{t('splitTitulo')}</h1>
      </div>

      <div className="flex h-3 gap-[2px]">
        {split.map((p) => (
          <div key={p.rotulo} style={{
            width: `${p.pct}%`,
            background: p.nota === 'casa' ? '#25282B' : p.nota === 'voce' ? '#FDE100' : '#22C55E',
          }} />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {split.map((p) => (
          <div key={p.rotulo}
            className="flex items-center justify-between border border-white/10 bg-panel px-3.5 py-2.5"
            style={p.nota === 'voce' ? { borderLeft: '3px solid #FDE100' } : undefined}>
            <div className="min-w-0">
              <div className="font-num text-[13px] font-extrabold uppercase text-giz">{p.rotulo}</div>
              {p.nota === 'voce' && <div className="text-[11px] text-poeira">{t('splitQuemDepositou')}</div>}
              {p.nota === 'casa' && <div className="text-[11px] text-poeira">{t('splitCasa')}</div>}
            </div>
            <span className="ole-num text-[17px] font-bold"
              style={{ color: p.nota === 'casa' ? '#9A9C9F' : p.nota === 'voce' ? '#FDE100' : '#22C55E' }}>
              {p.pct}%
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between px-0.5">
        <span className="font-mono text-[11px] text-poeira">{t('splitTotal')}</span>
        <span className="ole-num text-[16px] font-bold text-giz">{total}%</span>
      </div>

      <p className="text-[11px] leading-relaxed text-poeira">{t('splitNota')}</p>
    </div>
  );
}
