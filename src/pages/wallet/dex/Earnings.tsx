import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SecaoRua } from '@/components/ui/Rua';
import { useEarnings } from './useEarnings';
import { BlocoVault } from './BlocoVault';
import { BlocoProducao } from './BlocoProducao';
import { BlocoStake } from './BlocoStake';
import { L } from '@/i18n/L';

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
  { id: 'producao', rotulo: L('Produção', 'Production') },
  { id: 'stake', rotulo: 'Stake' },
];

export function Earnings() {
  const [qual, setQual] = useState<Qual>('vault');
  const e = useEarnings();

  return (
    <section className="min-w-0 space-y-3">
      <SecaoRua label="Earnings" aside={L('#vault #producao #stake', '#vault #production #stake')} />

      {/* DS 2027: o mesmo segmento do SPOT | DEX — Anton, a aba aberta em rua. */}
      <div className="grid grid-cols-3 border-2 border-linha p-0.5" role="tablist" aria-label="Earnings">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={qual === a.id}
            onClick={() => setQual(a.id)}
            className={cn(
              'min-h-[44px] min-w-0 truncate px-1 text-center font-impact text-[18px] uppercase leading-none transition-colors',
              qual === a.id ? 'bg-rua text-asfalto-27' : 'text-mudo hover:text-papel',
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {e.status === 'carregando' && (
        <p className="py-4 font-prova text-[12px] uppercase tracking-[0.16em] text-mudo">{L('Carregando…', 'Loading…')}</p>
      )}
      {e.status === 'erro' && (
        <div className="border-2 border-dashed border-fio px-4 py-4">
          <p className="font-voz text-[24px] leading-none text-papel">{L('Deu ruim aqui.', 'Something broke.')}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-suave">
            {L('Não deu para carregar as regras agora. Tente de novo em instantes.', 'Couldn\'t load the rules right now. Try again in a moment.')}
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
