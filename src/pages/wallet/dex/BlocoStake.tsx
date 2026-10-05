import { emVezes, type RegrasDeEarnings } from '@/wallet/earningsClient';
import { L } from '@/i18n/L';

/**
 * Stake — a regra publicada antes de existir.
 *
 * Não há motor de stake: ele começa quando o OLEFOOT estiver na Solana. A tela
 * existe pra regra estar escrita desde já, e a pessoa conferir depois que ele
 * lançar. Por isso NÃO tem botão: botão que não faz nada é pior que ausência.
 *
 * O multiplicador multiplica a FATIA do que a pool produzir. Não é taxa.
 */
export function BlocoStake({ regra }: { regra: RegrasDeEarnings['stake'] }) {
  return (
    <div className="min-w-0 space-y-3">
      <h3 className="font-impact text-[24px] uppercase leading-[1.1] text-white">{L('Travado é travado', 'Locked is locked')}</h3>

      {!regra.aberto && (
        <div className="border-l-2 border-atencao bg-card px-3.5 py-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-atencao">{L('Ainda não abriu', 'Not open yet')}</div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-giz">
            {L('O stake começa quando o OLEFOOT estiver na Solana. Estas são as regras, publicadas desde já.', 'Staking starts when OLEFOOT is on Solana. These are the rules, published now.')}
          </p>
        </div>
      )}

      <div className="border border-white/10 bg-panel px-4 py-3.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-cimento">{L('Prazo do travamento', 'Lock period')}</div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {regra.prazos.map((p) => (
            <div key={p.dias}
                 className="flex h-[56px] min-w-0 flex-col items-center justify-center gap-0.5 border border-white/10 bg-card">
              <span className="font-mono text-[12px] text-giz tabular-nums">{p.dias}d</span>
              <span className="ole-num text-[12px] text-white tabular-nums">{emVezes(p.multiplicadorBps)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11.5px] leading-relaxed text-poeira">
        {regra.saidaAntecipada ? L('Há saída antecipada.', 'Early exit available.') : L('Não há saída antecipada.', 'No early exit.')}{' '}
        {L('O multiplicador é fatia do que a pool produzir de verdade — não taxa prometida.', 'The multiplier is a slice of what the pool actually produces — not a promised rate.')}
      </p>
    </div>
  );
}
