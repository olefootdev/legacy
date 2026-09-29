import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SecaoVolt, Hashtag } from '@/components/ui';
import { useEarnings } from './useEarnings';
import { BlocoVault } from './BlocoVault';
import { BlocoProducao } from './BlocoProducao';
import { BlocoStake } from './BlocoStake';

/**
 * EARNINGS — Vault, Produção e Stake dentro da conta DEX.
 *
 * Eram três telas na OLEWALLET, com os números escritos na própria tela. Vieram
 * pra cá porque a posição de cada um depende da SESSÃO da conta, e a OLEWALLET
 * não tem sessão — ela guarda a frase, e é por isso que é outra origem.
 *
 * Um bloco por vez: os três empilhados dobravam a rolagem da aba.
 *
 * 🔑 Nenhum número de regra mora aqui. Tudo vem de GET /api/earnings, e se a
 * regra não carregar os blocos não desenham número nenhum.
 */
type Qual = 'vault' | 'producao' | 'stake';

const ABAS: ReadonlyArray<{ readonly id: Qual; readonly rotulo: string }> = [
  { id: 'vault', rotulo: 'Vault' },
  { id: 'producao', rotulo: 'Produção' },
  { id: 'stake', rotulo: 'Stake' },
];

export function Earnings() {
  const [qual, setQual] = useState<Qual>('vault');
  const e = useEarnings();

  return (
    <section className="min-w-0 space-y-3">
      <SecaoVolt label="Earnings">
        <Hashtag>#vault #producao #stake</Hashtag>
      </SecaoVolt>

      <div className="grid grid-cols-3 gap-1 border border-white/16 bg-panel p-1" role="tablist" aria-label="Earnings">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={qual === a.id}
            onClick={() => setQual(a.id)}
            className={cn(
              'min-w-0 truncate py-2 text-center font-mono text-[11px] font-medium uppercase tracking-[0.16em] transition-colors',
              qual === a.id ? 'bg-white text-black' : 'text-cimento hover:text-white',
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {e.status === 'carregando' && (
        <p className="py-4 font-mono text-[12px] text-cimento">Carregando…</p>
      )}
      {e.status === 'erro' && (
        <div className="border border-atencao/40 bg-atencao/10 px-3.5 py-3">
          <p className="text-[12px] leading-relaxed text-giz">
            Não deu para carregar as regras agora. Tente de novo em instantes.
          </p>
        </div>
      )}
      {e.status === 'ok' && qual === 'vault' && (
        <BlocoVault regra={e.regras.vault} fundo={e.fundo} meu={e.meu} verSplit={() => setQual('producao')} />
      )}
      {e.status === 'ok' && qual === 'producao' && (
        <BlocoProducao regra={e.regras.producao} fundo={e.fundo} meu={e.meu} />
      )}
      {e.status === 'ok' && qual === 'stake' && <BlocoStake regra={e.regras.stake} />}
    </section>
  );
}
