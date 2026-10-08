import { emPorcento, emUnidades, type FundoDoVault, type MeuVault, type RegrasDeEarnings } from '@/wallet/earningsClient';
import { LinhaDeValor } from './LinhaDeValor';
import { L } from '@/i18n/L';

/**
 * Produção — como a colheita se divide, e o que já chegou pra pessoa.
 *
 * O split vem do servidor, do mesmo `harvestSplit.ts` que o rateio usa pra
 * pagar. A OLEWALLET tinha os seis números copiados na tela.
 *
 * Cor (DS 2027): ouro é a fatia de quem depositou — o que fica com você é
 * RESPEITO —, papel é a rede, linha é a casa. É a única leitura que a barra
 * precisa dar: quanto fica com você.
 */
const COR: Record<string, string> = {
  depositante: 'bg-ouro-27',
  casa: 'bg-linha',
};
const TOM: Record<string, string> = {
  depositante: 'text-ouro-27',
  casa: 'text-mudo',
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
      <h3 className="pt-1 font-impact text-[clamp(30px,8.5vw,40px)] uppercase leading-[0.95] text-papel">{L('Como a colheita se divide', 'How the harvest is split')}</h3>

      <div className="flex h-4 gap-1" aria-hidden>
        {regra.fatias.map((f) => (
          <div key={f.id} style={{ width: `${(f.bps / regra.totalBps) * 100}%` }}
               className={COR[f.papel] ?? 'bg-papel'} />
        ))}
      </div>

      <div className="bg-concreto">
        {regra.fatias.map((f) => (
          <div key={f.id}
               className="flex min-w-0 items-center justify-between gap-3 border-b-2 border-linha px-4 py-3 last:border-b-0">
            <div className="min-w-0">
              <div className="truncate font-impact text-[18px] uppercase leading-none text-papel">{f.rotulo}</div>
              {NOTA[f.papel] && <div className="mt-1 font-prova text-[11px] text-mudo">{NOTA[f.papel]}</div>}
            </div>
            <span className={`shrink-0 font-impact text-[22px] leading-none tabular-nums ${TOM[f.papel] ?? 'text-papel'}`}>
              {emPorcento(f.bps)}
            </span>
          </div>
        ))}
        <div className="flex items-baseline justify-between border-t-2 border-linha px-4 py-3">
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">Total</span>
          <span className="font-impact text-[20px] leading-none text-papel tabular-nums">{emPorcento(soma)}</span>
        </div>
      </div>

      <p className="text-[12.5px] leading-relaxed text-suave">
        {L('O split roda sobre o que a pool colheu — nunca sobre o que você depositou. Fatia sem dono na rede não vai para a casa: fica na pool e sobe a cota de todo mundo.', 'The split runs on what the pool harvested — never on what you deposited. An unowned network slice doesn\'t go to the house: it stays in the pool and lifts everyone\'s share.')}
      </p>

      {/* O que já chegou. Só aparece quando há fundo — sem fundo não há colheita. */}
      {fundo && (
        <div className="border-[3px] border-ouro-27 bg-asfalto-27">
          <LinhaDeValor rotulo={L('Você já recebeu', 'You\'ve received')}
                        valor={`${emUnidades(recebido, fundo.decimais)} ${fundo.ativo}`} forte />
          {(meu?.fatias ?? []).slice(0, 8).map((f, i) => (
            <div key={`${f.colheita}-${f.fatia}-${i}`}
                 className="flex min-w-0 items-baseline justify-between gap-3 border-b-2 border-linha px-4 py-3 last:border-b-0">
              <span className="min-w-0 truncate font-prova text-[12px] uppercase text-suave">{nomeDa(f.fatia)}</span>
              <span className="shrink-0 font-impact text-[17px] leading-none text-papel tabular-nums">
                +{emUnidades(f.unidades, fundo.decimais)} {fundo.ativo}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
