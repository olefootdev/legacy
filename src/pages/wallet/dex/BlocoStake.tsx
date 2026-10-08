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
      <h3 className="pt-1 font-impact text-[clamp(30px,8.5vw,40px)] uppercase leading-[0.95] text-papel">{L('Travado é travado', 'Locked is locked')}</h3>

      {!regra.aberto && (
        <div className="border-2 border-dashed border-fio px-4 py-3.5">
          <div className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('Ainda não abriu', 'Not open yet')}</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-suave">
            {L('O stake começa quando o OLEFOOT estiver na Solana. Estas são as regras, publicadas desde já.', 'Staking starts when OLEFOOT is on Solana. These are the rules, published now.')}
          </p>
        </div>
      )}

      <div className="bg-concreto px-4 py-4">
        <div className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('Prazo do travamento', 'Lock period')}</div>
        {/* DS 2027 · degrau CHÃO: regra publicada, ainda promessa — tracejado. */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {regra.prazos.map((p) => (
            <div key={p.dias}
                 className="flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1.5 border-2 border-dashed border-fio px-1">
              <span className="font-spray text-[22px] font-black leading-none text-papel tabular-nums">{p.dias}d</span>
              <span className="font-impact text-[16px] leading-none text-suave tabular-nums">{emVezes(p.multiplicadorBps)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[12.5px] leading-relaxed text-suave">
        {regra.saidaAntecipada ? L('Há saída antecipada.', 'Early exit available.') : L('Não há saída antecipada.', 'No early exit.')}{' '}
        {L('O multiplicador é fatia do que a pool produzir de verdade — não taxa prometida.', 'The multiplier is a slice of what the pool actually produces — not a promised rate.')}
      </p>
    </div>
  );
}
