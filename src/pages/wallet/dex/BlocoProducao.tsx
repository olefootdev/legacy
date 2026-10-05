import { emPorcento, emUnidades, type FundoDoVault, type MeuVault, type RegrasDeEarnings } from '@/wallet/earningsClient';
import { LinhaDeValor } from './LinhaDeValor';
import { L } from '@/i18n/L';

/**
 * Produção — como a colheita se divide, e o que já chegou pra pessoa.
 *
 * O split vem do servidor, do mesmo `harvestSplit.ts` que o rateio usa pra
 * pagar. A OLEWALLET tinha os seis números copiados na tela.
 *
 * Cor: volt é a fatia de quem depositou, verde é a rede, cinza é a casa. É a
 * única leitura que a barra precisa dar — quanto fica com você.
 */
const COR: Record<string, string> = {
  depositante: 'bg-neon-yellow',
  casa: 'bg-card-hi',
};
const TOM: Record<string, string> = {
  depositante: 'text-neon-yellow',
  casa: 'text-cimento',
};

const NOTA: Record<string, string> = {
  depositante: L('quem depositou', 'depositors'),
  casa: L('roda a operação', 'runs the operation'),
};

export function BlocoProducao({
  regra, fundo, meu,
}: {
  regra: RegrasDeEarnings['producao'];
  fundo: FundoDoVault | null;
  meu: MeuVault | null;
}) {
  const soma = regra.fatias.reduce((s, f) => s + f.bps, 0);
  const recebido = (meu?.fatias ?? []).reduce((s, f) => s + f.unidades, 0n);
  // O livro guarda o id da fatia ("myclub"); quem lê quer o nome ("MyClub").
  const nomeDa = (id: string) => regra.fatias.find((f) => f.id === id)?.rotulo ?? id;

  return (
    <div className="min-w-0 space-y-3">
      <h3 className="font-impact text-[24px] uppercase leading-[1.1] text-white">{L('Como a colheita se divide', 'How the harvest is split')}</h3>

      <div className="flex h-3 gap-[2px]" aria-hidden>
        {regra.fatias.map((f) => (
          <div key={f.id} style={{ width: `${(f.bps / regra.totalBps) * 100}%` }}
               className={COR[f.papel] ?? 'bg-alta'} />
        ))}
      </div>

      <div className="border border-white/10 bg-panel">
        {regra.fatias.map((f) => (
          <div key={f.id}
               className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5 last:border-b-0">
            <div className="min-w-0">
              <div className="ole-num truncate text-[13px] uppercase text-giz">{f.rotulo}</div>
              {NOTA[f.papel] && <div className="text-[11px] text-poeira">{NOTA[f.papel]}</div>}
            </div>
            <span className={`ole-num shrink-0 text-[17px] tabular-nums ${TOM[f.papel] ?? 'text-alta'}`}>
              {emPorcento(f.bps)}
            </span>
          </div>
        ))}
        <div className="flex items-baseline justify-between border-t border-white/10 px-4 py-2.5">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-poeira">Total</span>
          <span className="ole-num text-[15px] text-giz tabular-nums">{emPorcento(soma)}</span>
        </div>
      </div>

      <p className="text-[11.5px] leading-relaxed text-poeira">
        {L('O split roda sobre o que a pool colheu — nunca sobre o que você depositou. Fatia sem dono na rede não vai para a casa: fica na pool e sobe a cota de todo mundo.', 'The split runs on what the pool harvested — never on what you deposited. An unowned network slice doesn\'t go to the house: it stays in the pool and lifts everyone\'s share.')}
      </p>

      {/* O que já chegou. Só aparece quando há fundo — sem fundo não há colheita. */}
      {fundo && (
        <div className="border border-white/10 bg-panel">
          <LinhaDeValor rotulo={L('Você já recebeu', 'You\'ve received')}
                        valor={`${emUnidades(recebido, fundo.decimais)} ${fundo.ativo}`} forte />
          {(meu?.fatias ?? []).slice(0, 8).map((f, i) => (
            <div key={`${f.colheita}-${f.fatia}-${i}`}
                 className="flex min-w-0 items-baseline justify-between gap-3 border-b border-white/10 px-4 py-2.5 last:border-b-0">
              <span className="min-w-0 truncate font-mono text-[11px] uppercase text-cimento">{nomeDa(f.fatia)}</span>
              <span className="shrink-0 font-mono text-[11.5px] text-giz tabular-nums">
                +{emUnidades(f.unidades, fundo.decimais)} {fundo.ativo}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
